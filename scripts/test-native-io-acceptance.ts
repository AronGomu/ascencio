import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const expectedTests = [
  "native_user_data::tests::traced_cached_writer_has_no_reads_after_ready",
  "native_user_data::tests::traced_writer_exposes_existing_compare_read",
];
const child = spawn(
  "cargo",
  [
    "test",
    "--manifest-path",
    path.join("src-tauri", "Cargo.toml"),
    "native_user_data::tests::traced_",
    "--",
    "--ignored",
    "--test-threads=1",
  ],
  {
    cwd: projectRoot,
    env: { ...process.env, ASCENCIO_IO_TRACE: "1" },
    stdio: ["inherit", "pipe", "pipe"],
  },
);

let output = "";
for (const [stream, destination] of [
  [child.stdout, process.stdout],
  [child.stderr, process.stderr],
] as const) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    output += chunk;
    destination.write(chunk);
  });
}

child.on("error", (error) => {
  throw error;
});
child.on("close", (status) => {
  if (status !== 0) {
    process.exitCode = status ?? 1;
    return;
  }

  const executedTests = [...output.matchAll(/^test (.+) \.\.\. ok$/gm)].map(
    ([, name]) => name,
  );
  if (
    executedTests.length !== expectedTests.length ||
    expectedTests.some((name) => !executedTests.includes(name))
  ) {
    process.stderr.write(
      `Expected exactly these traced native I/O tests to run: ${expectedTests.join(", ")}\n`,
    );
    process.exitCode = 1;
  }
});
