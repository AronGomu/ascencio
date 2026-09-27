import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  orderPackages,
  parsePackageManifest,
  validatePackageDatabase,
  type PackageManifest,
} from "../../../src/storage/schema/index.ts";
import {
  createPackageFixture,
  packageManifest,
  sqliteReader,
} from "./sqlite-fixtures.ts";

function expectFailureCode(value: unknown, code: string): void {
  expect(value).toMatchObject({ kind: "failed", error: { code } });
}

describe("SQLite package contracts", () => {
  it.each(["duel-core", "card-library", "freeplay", "chapter-01"] as const)(
    "validates real schema-v1 %s SQLite fixture",
    (packageId) => {
      const fixture = createPackageFixture(packageId);
      const result = validatePackageDatabase(fixture.reader);
      expect(result).toMatchObject({
        kind: "ok",
        value: { manifest: { packageId }, assetCount: 0 },
      });
      expect(fixture.database.prepare("PRAGMA integrity_check").get()).toEqual({
        integrity_check: "ok",
      });
      fixture.database.close();
    },
  );

  it.each(["TABLE hostile(value TEXT)", "VIEW hostile AS SELECT 1 AS value"])(
    "rejects extra schema object: %s",
    (definition) => {
      const fixture = createPackageFixture("duel-core");
      fixture.database.exec(`CREATE ${definition}`);
      expectFailureCode(
        validatePackageDatabase(fixture.reader),
        "PACKAGE_INVALID",
      );
      fixture.database.close();
    },
  );

  it("rejects package-authored triggers without firing them", () => {
    const fixture = createPackageFixture("duel-core");
    fixture.database.exec(
      "CREATE TRIGGER hostile AFTER INSERT ON assets BEGIN DELETE FROM package_manifest; END",
    );
    expectFailureCode(
      validatePackageDatabase(fixture.reader),
      "PACKAGE_INVALID",
    );
    expect(
      fixture.database
        .prepare("SELECT count(*) AS count FROM package_manifest")
        .get(),
    ).toEqual({ count: 1 });
    fixture.database.close();
  });

  it("establishes trusted_schema=OFF on a read-only SQLite handle", () => {
    const fixture = createPackageFixture("duel-core");
    fixture.database.close();
    const database = new DatabaseSync(fixture.file, { readOnly: true });
    try {
      database.exec("PRAGMA trusted_schema=ON");
      expect(validatePackageDatabase(sqliteReader(database)).kind).toBe("ok");
      expect(database.prepare("PRAGMA trusted_schema").get()).toEqual({
        trusted_schema: 0,
      });
    } finally {
      database.close();
    }
  });

  it("rejects an adapter that does not disable trusted_schema before schema reads", () => {
    const fixture = createPackageFixture("duel-core");
    const queries: string[] = [];
    fixture.database.exec("PRAGMA trusted_schema=ON");
    try {
      const result = validatePackageDatabase({
        all(sql, parameters) {
          queries.push(sql);
          return sql === "PRAGMA trusted_schema=OFF"
            ? []
            : fixture.reader.all(sql, parameters);
        },
      });
      expect
        .soft(result)
        .toMatchObject({ kind: "failed", error: { code: "PACKAGE_INVALID" } });
      expect(queries).toEqual([
        "PRAGMA trusted_schema=OFF",
        "PRAGMA trusted_schema",
      ]);
    } finally {
      fixture.database.close();
    }
  });

  it.each(["CHECK", "view", "generated"] as const)(
    "rejects hostile %s before integrity checks or package SELECTs with zero UDF calls",
    (kind) => {
      let calls = 0;
      const fixture = createPackageFixture("duel-core", {
        configure(database) {
          database.exec("PRAGMA trusted_schema=ON");
          database.function("hostile", { deterministic: true }, (value) => {
            calls += 1;
            return Number(value !== null);
          });
        },
        transformSchema(sql) {
          if (kind === "CHECK")
            return sql.replace(
              "mime TEXT NOT NULL",
              "mime TEXT NOT NULL CHECK (hostile(mime))",
            );
          if (kind === "generated")
            return sql.replace(
              "data BLOB NOT NULL,",
              "data BLOB NOT NULL, injected TEXT GENERATED ALWAYS AS (hostile(mime)) VIRTUAL,",
            );
          return sql;
        },
      });
      try {
        fixture.database
          .prepare(
            "INSERT INTO assets (path, mime, byte_length, sha256, data) VALUES (?, ?, ?, ?, ?)",
          )
          .run(
            "engine/ocgcore.sync.wasm",
            "application/wasm",
            1,
            "0".repeat(64),
            new Uint8Array([1]),
          );
        if (kind === "view")
          fixture.database.exec(`
          ALTER TABLE package_manifest RENAME TO manifest_source;
          CREATE VIEW package_manifest AS SELECT
            CASE WHEN hostile(package_id) THEN package_id END AS package_id,
            package_type, version, schema_version, dependencies_json, created_at FROM manifest_source;
        `);
        calls = 0;
        const queries: string[] = [];
        const result = validatePackageDatabase({
          all(sql, parameters) {
            queries.push(sql);
            return fixture.reader.all(sql, parameters);
          },
        });
        expect.soft(calls).toBe(0);
        expect.soft(result).toMatchObject({
          kind: "failed",
          error: { code: "PACKAGE_INVALID" },
        });
        expect(
          queries.filter((sql) =>
            /integrity_check|foreign_key_check|FROM (?:package_manifest|package_meta|assets)\b/.test(
              sql,
            ),
          ),
        ).toEqual([]);
      } finally {
        fixture.database.close();
      }
    },
  );

  it.each([
    [
      "generated column",
      "data BLOB NOT NULL,",
      "data BLOB NOT NULL, injected TEXT GENERATED ALWAYS AS (mime) VIRTUAL,",
    ],
    [
      "stored generated column",
      "data BLOB NOT NULL,",
      "data BLOB NOT NULL, injected TEXT GENERATED ALWAYS AS (mime) STORED,",
    ],
    [
      "default",
      "mime TEXT NOT NULL",
      "mime TEXT NOT NULL DEFAULT 'application/wasm'",
    ],
    [
      "extra CHECK",
      "mime TEXT NOT NULL",
      "mime TEXT NOT NULL CHECK (length(mime) > 0)",
    ],
    [
      "spoofed CHECK comments",
      "CHECK (byte_length >= 0)",
      "CHECK (1) /* CHECK (byte_length >= 0) */",
    ],
    [
      "spoofed BLOB CHECK comments",
      "CHECK (length(data) = byte_length)",
      "CHECK (1) /* CHECK (length(data) = byte_length) */",
    ],
    [
      "primary key collation",
      "path TEXT PRIMARY KEY",
      "path TEXT PRIMARY KEY COLLATE NOCASE",
    ],
    [
      "primary key direction",
      "path TEXT PRIMARY KEY",
      "path TEXT PRIMARY KEY DESC",
    ],
  ])(
    "rejects noncanonical schema: %s before data access",
    (_label, before, after) => {
      const fixture = createPackageFixture("duel-core", {
        transformSchema: (sql) => sql.replace(before!, after!),
      });
      const queries: string[] = [];
      try {
        expectFailureCode(
          validatePackageDatabase({
            all(sql, parameters) {
              queries.push(sql);
              return fixture.reader.all(sql, parameters);
            },
          }),
          "PACKAGE_INVALID",
        );
        expect(
          queries.filter((sql) =>
            /integrity_check|foreign_key_check|FROM (?:package_manifest|package_meta|assets)\b/.test(
              sql,
            ),
          ),
        ).toEqual([]);
      } finally {
        fixture.database.close();
      }
    },
  );

  it.each([
    [
      "unique index",
      "CREATE INDEX card_search_name",
      "CREATE UNIQUE INDEX card_search_name",
    ],
    [
      "partial index",
      "ON card_search(locale, normalized_name, card_code)",
      "ON card_search(locale, normalized_name, card_code) WHERE card_code > 0",
    ],
    [
      "index collation",
      "ON card_search(locale, normalized_name, card_code)",
      "ON card_search(locale, normalized_name COLLATE NOCASE, card_code)",
    ],
    [
      "index direction",
      "ON card_search(locale, normalized_name, card_code)",
      "ON card_search(locale, normalized_name DESC, card_code)",
    ],
    [
      "FK delete action",
      "REFERENCES cards(code)",
      "REFERENCES cards(code) ON DELETE CASCADE",
    ],
    [
      "FK update action",
      "REFERENCES cards(code)",
      "REFERENCES cards(code) ON UPDATE CASCADE",
    ],
    [
      "FK deferral",
      "REFERENCES cards(code)",
      "REFERENCES cards(code) DEFERRABLE INITIALLY DEFERRED",
    ],
    [
      "unexpected FK",
      "mime TEXT NOT NULL,",
      "mime TEXT NOT NULL REFERENCES scripts(name),",
    ],
  ])("rejects noncanonical key definition: %s", (_label, before, after) => {
    const fixture = createPackageFixture("card-library", {
      transformSchema: (sql) => sql.replace(before!, after!),
    });
    try {
      expectFailureCode(
        validatePackageDatabase(fixture.reader),
        "PACKAGE_INVALID",
      );
    } finally {
      fixture.database.close();
    }
  });

  it("rejects user tables resembling SQLite internal names", () => {
    const fixture = createPackageFixture("duel-core");
    try {
      fixture.database.exec("CREATE TABLE sqliteXhostile (value TEXT)");
      expectFailureCode(
        validatePackageDatabase(fixture.reader),
        "PACKAGE_INVALID",
      );
    } finally {
      fixture.database.close();
    }
  });

  it.each([
    [
      "card-library",
      "UPDATE cards SET definition_json=json_set(definition_json, '$.code', 2)",
    ],
    [
      "card-library",
      "UPDATE sets SET metadata_json=json_set(metadata_json, '$.id', 'other-set')",
    ],
    ["chapter-01", "UPDATE story_documents SET id='other-story'"],
  ] as const)("rejects SQL/JSON identity mismatch: %s %s", (packageId, sql) => {
    const fixture = createPackageFixture(packageId);
    try {
      fixture.database.exec(sql);
      expectFailureCode(
        validatePackageDatabase(fixture.reader),
        "PACKAGE_INVALID",
      );
    } finally {
      fixture.database.close();
    }
  });

  it.each([
    ["malformed beat", "$.beats", [{}]],
    ["missing beats", "$.beats", []],
    ["bad speaker", "$.beats[0].speaker", "Unknown"],
    ["bad kind", "$.beats[0].kind", "script"],
    ["bad background", "$.beats[0].background", "unknown"],
    ["bad characters", "$.beats[0].characters", ["unknown"]],
    ["bad text", "$.beats[0].text", 7],
    ["malformed choice", "$.choices[0]", {}],
    ["missing choices", "$.choices", []],
    ["bad choice id", "$.choices[0].id", "other"],
    ["bad choice label", "$.choices[0].label", 7],
    ["missing responses", "$.choiceResponses", {}],
    ["bad response", '$.choiceResponses."trust-rin"', 7],
    ["missing acknowledgments", "$.laterAcknowledgments", {}],
    ["bad acknowledgment", '$.laterAcknowledgments."trust-rin"', 7],
  ])("rejects nested Story document: %s", (_label, jsonPath, value) => {
    const fixture = createPackageFixture("chapter-01");
    try {
      fixture.database
        .prepare(
          "UPDATE story_documents SET payload_json=json_set(payload_json, ?, json(?))",
        )
        .run(jsonPath as string, JSON.stringify(value));
      expectFailureCode(
        validatePackageDatabase(fixture.reader),
        "PACKAGE_INVALID",
      );
    } finally {
      fixture.database.close();
    }
  });

  it("reports unsupported schema versions without raw SQLite errors", () => {
    const fixture = createPackageFixture("duel-core");
    fixture.database.exec("PRAGMA user_version=2");
    expectFailureCode(
      validatePackageDatabase(fixture.reader),
      "PACKAGE_SCHEMA_UNSUPPORTED",
    );
    fixture.database.close();
  });

  it.each([
    { packageId: "chapter-1", expected: "PACKAGE_INVALID" },
    { packageId: "chapter-00", expected: "PACKAGE_INVALID" },
    { version: "01.0.0", expected: "PACKAGE_INVALID" },
    { createdAt: "2026-09-24", expected: "PACKAGE_INVALID" },
    { extra: true, expected: "PACKAGE_INVALID" },
  ])("rejects malformed manifest %#", ({ expected, ...patch }) => {
    const input = { ...packageManifest("chapter-01"), ...patch };
    expectFailureCode(parsePackageManifest(input), expected);
  });

  it("orders reversed package selection prerequisite-first", () => {
    const selected = [
      packageManifest("chapter-01"),
      packageManifest("freeplay"),
      packageManifest("card-library"),
      packageManifest("duel-core"),
    ];
    expect(orderPackages(selected, [])).toEqual({
      kind: "ok",
      value: [...selected].reverse(),
    });
  });

  it("rejects duplicate selected package IDs", () => {
    const manifest = packageManifest("duel-core");
    expectFailureCode(
      orderPackages([manifest, manifest], []),
      "PACKAGE_DUPLICATE",
    );
  });

  it("rejects missing dependencies", () => {
    expectFailureCode(
      orderPackages([packageManifest("freeplay")], []),
      "PACKAGE_DEPENDENCY_MISSING",
    );
  });

  it("rejects an update that breaks a retained dependant", () => {
    const selected = [{ ...packageManifest("duel-core"), version: "0.9.0" }];
    const installed = [
      packageManifest("duel-core"),
      packageManifest("card-library"),
    ];
    expectFailureCode(
      orderPackages(selected, installed),
      "PACKAGE_DEPENDENCY_INCOMPATIBLE",
    );
  });

  it("reports dependency cycles before hierarchy rejection", () => {
    const core = {
      ...packageManifest("duel-core"),
      dependencies: [
        { packageId: "card-library", requirement: "exact", version: "1.0.0" },
      ],
    } as PackageManifest;
    const library = {
      ...packageManifest("card-library"),
      dependencies: [
        { packageId: "duel-core", requirement: "exact", version: "1.0.0" },
      ],
    } as PackageManifest;
    expectFailureCode(
      orderPackages([core, library], []),
      "PACKAGE_DEPENDENCY_CYCLE",
    );
  });
});
