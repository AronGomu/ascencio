import { userWriteLifecycle, type UserNamespace } from "../../storage/index.ts";
import {
  defaultPersistedUiState,
  isPersistedUiState,
  type PersistedUiState,
} from "../../battle/ports/index.ts";
import { createSqliteDeckRepository } from "../../decks/repository/sqlite.ts";
import type {
  AsyncPreferencePort,
  StorageFailure,
  StorageResult,
  StoryReadLogPort,
  UserDataStore,
  UserRecord,
} from "../../storage/index.ts";
import {
  DEFAULT_STORY_PLAYBACK_SETTINGS,
  isStoryPlaybackSettings,
  type StoryPlaybackSettings,
} from "../../story/playback/index.ts";
import type {
  ShellUserServices,
  UserPreferencePorts,
} from "../core/user-services.ts";
import {
  DEFAULT_SHELL_SETTINGS,
  isShellSettings,
  type ShellSettings,
} from "../settings/index.ts";

interface ReadLogPayload {
  readonly version: 1;
  readonly beats: readonly string[];
}

export interface SqliteUserPreferencesSnapshot {
  readonly shell: ShellSettings;
  readonly battle: PersistedUiState;
  readonly battlePresent: boolean;
  readonly storyPlayback: StoryPlaybackSettings;
  readonly storyReadLog: ReadonlySet<string>;
}

const shellQueues = new WeakMap<
  UserDataStore,
  PreferenceQueue<ShellSettings>
>();
const battleQueues = new WeakMap<
  UserDataStore,
  PreferenceQueue<PersistedUiState>
>();
const storyPlaybackQueues = new WeakMap<
  UserDataStore,
  PreferenceQueue<StoryPlaybackSettings>
>();
const readLogQueues = new WeakMap<
  UserDataStore,
  PreferenceQueue<ReadLogPayload>
>();

export function createSqliteUserServices(
  store: UserDataStore,
): ShellUserServices {
  const shell = sharedQueue(
    shellQueues,
    store,
    "preferences",
    "shell",
    DEFAULT_SHELL_SETTINGS,
    isShellSettings,
  );
  const battle = sharedQueue(
    battleQueues,
    store,
    "preferences",
    "battle-ui",
    defaultPersistedUiState(),
    isPersistedUiState,
  );
  const storyPlayback = sharedQueue(
    storyPlaybackQueues,
    store,
    "preferences",
    "story-playback",
    DEFAULT_STORY_PLAYBACK_SETTINGS,
    isStoryPlaybackSettings,
  );
  const readLog = sharedQueue(
    readLogQueues,
    store,
    "story-read-log",
    "read",
    { version: 1, beats: [] },
    isReadLogPayload,
  );

  const preferences: UserPreferencePorts = Object.freeze({
    shell: preferencePort(shell),
    battle: preferencePort(battle),
    storyPlayback: preferencePort(storyPlayback),
    storyReadLog: readLogPort(readLog),
  });
  return Object.freeze({
    preferences,
    createDeckRepository: () => createSqliteDeckRepository(store),
  });
}

/** Value and row presence from the same hydrated queue generation. */
export function readSqliteBattlePreferences(
  store: UserDataStore,
): Promise<{ readonly value: PersistedUiState; readonly present: boolean }> {
  createSqliteUserServices(store);
  return battleQueues.get(store)!.readSnapshot();
}

export function invalidateSqliteUserPreferences(
  store: UserDataStore,
  namespaces: readonly UserNamespace[],
): void {
  if (namespaces.includes("preferences")) {
    shellQueues.get(store)?.invalidate();
    battleQueues.get(store)?.invalidate();
    storyPlaybackQueues.get(store)?.invalidate();
  }
  if (namespaces.includes("story-read-log"))
    readLogQueues.get(store)?.invalidate();
}

/** Raw reload for root-owned restore barrier. Never call from an admitted write. */
export async function reloadSqliteUserPreferences(
  store: UserDataStore,
): Promise<StorageResult<SqliteUserPreferencesSnapshot>> {
  const services = createSqliteUserServices(store);
  void services;
  const [shell, battle, storyPlayback, storyReadLog] = await Promise.all([
    store.readUser("preferences", "shell"),
    store.readUser("preferences", "battle-ui"),
    store.readUser("preferences", "story-playback"),
    store.readUser("story-read-log", "read"),
  ] as const);
  const failedResult = [shell, battle, storyPlayback, storyReadLog].find(
    (result): result is Extract<typeof result, { readonly kind: "failed" }> =>
      result.kind === "failed",
  );
  if (failedResult !== undefined) return failedResult;
  if (
    shell.kind !== "ok" ||
    battle.kind !== "ok" ||
    storyPlayback.kind !== "ok" ||
    storyReadLog.kind !== "ok"
  )
    return failed("STORAGE_UNAVAILABLE");
  const shellValue = restoredValue(
    shell.value,
    DEFAULT_SHELL_SETTINGS,
    isShellSettings,
  );
  const battleValue = restoredValue(
    battle.value,
    defaultPersistedUiState(),
    isPersistedUiState,
  );
  const playbackValue = restoredValue(
    storyPlayback.value,
    DEFAULT_STORY_PLAYBACK_SETTINGS,
    isStoryPlaybackSettings,
  );
  const logValue = restoredValue(
    storyReadLog.value,
    { version: 1 as const, beats: [] },
    isReadLogPayload,
  );
  if (
    shellValue === null ||
    battleValue === null ||
    playbackValue === null ||
    logValue === null
  )
    return failed("USER_DATA_INVALID");
  shellQueues.get(store)!.replace(shellValue.value, shellValue.revision);
  battleQueues.get(store)!.replace(battleValue.value, battleValue.revision);
  storyPlaybackQueues
    .get(store)!
    .replace(playbackValue.value, playbackValue.revision);
  readLogQueues.get(store)!.replace(logValue.value, logValue.revision);
  return ok({
    shell: clone(shellValue.value),
    battle: clone(battleValue.value),
    battlePresent: battleValue.revision !== null,
    storyPlayback: clone(playbackValue.value),
    storyReadLog: new Set(logValue.value.beats),
  });
}

class PreferenceQueue<T extends object> {
  readonly #store: UserDataStore;
  readonly #namespace: "preferences" | "story-read-log";
  readonly #key: string;
  readonly #fallback: T;
  readonly #validate: (value: unknown) => value is T;
  #value: T;
  #revision: number | null = null;
  #hydration: Promise<StorageResult<void>> | null = null;
  #tail: Promise<StorageResult<void>> = Promise.resolve(ok(undefined));

  constructor(
    store: UserDataStore,
    namespace: "preferences" | "story-read-log",
    key: string,
    fallback: T,
    validate: (value: unknown) => value is T,
  ) {
    this.#store = store;
    this.#namespace = namespace;
    this.#key = key;
    this.#fallback = clone(fallback);
    this.#value = clone(fallback);
    this.#validate = validate;
  }

  read(): Promise<T> {
    return userWriteLifecycle(this.#store).run(async () => {
      await this.#tail;
      const hydrated = await this.#hydrate();
      if (hydrated.kind === "failed") throw storageError(hydrated.error);
      return clone(this.#value);
    });
  }

  readSnapshot(): Promise<{ readonly value: T; readonly present: boolean }> {
    return userWriteLifecycle(this.#store).run(async () => {
      await this.#tail;
      const hydrated = await this.#hydrate();
      if (hydrated.kind === "failed") throw storageError(hydrated.error);
      // This is the record revision, never the database-wide revision.
      return { value: clone(this.#value), present: this.#revision !== null };
    });
  }

  invalidate(): void {
    this.#value = clone(this.#fallback);
    this.#revision = null;
    this.#hydration = null;
    this.#tail = Promise.resolve(ok(undefined));
  }

  replace(value: T, revision: number | null): void {
    this.#value = clone(value);
    this.#revision = revision;
    this.#hydration = Promise.resolve(ok(undefined));
    this.#tail = Promise.resolve(ok(undefined));
  }

  update(patch: Partial<T>): Promise<StorageResult<T>> {
    let patchSnapshot: Partial<T>;
    try {
      patchSnapshot = clone(patch);
    } catch {
      return Promise.resolve(failed("USER_DATA_INVALID"));
    }
    return this.#enqueue(() =>
      this.#write((current) => ({ ...current, ...patchSnapshot })),
    );
  }

  mutate(change: (current: T) => T): Promise<StorageResult<T>> {
    return this.#enqueue(() => this.#write(change));
  }

  flush(): Promise<StorageResult<void>> {
    return this.#tail;
  }

  #enqueue(
    operation: () => Promise<StorageResult<T>>,
  ): Promise<StorageResult<T>> {
    return userWriteLifecycle(this.#store)
      .run(
        () => {
          const result = this.#tail
            .then(operation)
            .catch(() => failed<T>("STORAGE_UNAVAILABLE"));
          this.#tail = result.then((completed) =>
            completed.kind === "ok" ? ok(undefined) : completed,
          );
          return result;
        },
        (result) => (result.kind === "failed" ? result.error : null),
      )
      .catch((error: unknown) =>
        failed(
          error instanceof Error && error.message === "STORAGE_CONFLICT"
            ? "STORAGE_CONFLICT"
            : "STORAGE_UNAVAILABLE",
        ),
      );
  }

  #hydrate(): Promise<StorageResult<void>> {
    this.#hydration ??= this.#reload();
    return this.#hydration;
  }

  async #reload(): Promise<StorageResult<void>> {
    const result = await this.#store.readUser(this.#namespace, this.#key);
    if (result.kind === "failed") return result;
    if (result.value === null) {
      this.#value = clone(this.#fallback);
      this.#revision = null;
      return ok(undefined);
    }
    if (!this.#validate(result.value.payload))
      return failed("USER_DATA_INVALID");
    this.#value = clone(result.value.payload);
    this.#revision = result.value.revision;
    return ok(undefined);
  }

  async #write(change: (current: T) => T): Promise<StorageResult<T>> {
    const hydrated = await this.#hydrate();
    if (hydrated.kind === "failed") return hydrated;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let candidate: T;
      try {
        candidate = clone(change(clone(this.#value)));
      } catch {
        return failed("USER_DATA_INVALID");
      }
      if (!this.#validate(candidate)) return failed("USER_DATA_INVALID");
      const result = await this.#store.writeUser([
        {
          kind: "put",
          namespace: this.#namespace,
          key: this.#key,
          expectedRevision: this.#revision,
          payload: candidate,
        },
      ]);
      if (result.kind === "ok") {
        const record = result.value[0];
        if (!this.#validWrittenRecord(record))
          return failed("USER_DATA_INVALID");
        this.#value = clone(record.payload);
        this.#revision = record.revision;
        return ok(clone(this.#value));
      }
      if (result.error.code !== "STORAGE_CONFLICT" || attempt === 1)
        return result;
      const reloaded = await this.#reload();
      if (reloaded.kind === "failed") return reloaded;
    }
    return failed("STORAGE_CONFLICT");
  }

  #validWrittenRecord(record: UserRecord | undefined): record is UserRecord & {
    readonly payload: T;
  } {
    return (
      record !== undefined &&
      record.namespace === this.#namespace &&
      record.key === this.#key &&
      Number.isSafeInteger(record.revision) &&
      record.revision > 0 &&
      this.#validate(record.payload)
    );
  }
}

function preferencePort<T extends object>(
  queue: PreferenceQueue<T>,
): AsyncPreferencePort<T> {
  return Object.freeze({
    read: () => queue.read(),
    update: (patch: Partial<T>) => queue.update(patch),
    flush: () => queue.flush(),
  });
}

function readLogPort(queue: PreferenceQueue<ReadLogPayload>): StoryReadLogPort {
  return Object.freeze({
    async read() {
      return new Set((await queue.read()).beats);
    },
    markRead(beatId: string): Promise<StorageResult<void>> {
      if (
        typeof beatId !== "string" ||
        beatId.length === 0 ||
        beatId.length > 65_536
      )
        return Promise.resolve(failed<void>("USER_DATA_INVALID"));
      return queue
        .mutate((current) => ({
          version: 1,
          beats: current.beats.includes(beatId)
            ? current.beats
            : [...current.beats, beatId],
        }))
        .then((result) => (result.kind === "ok" ? ok(undefined) : result));
    },
    flush: () => queue.flush(),
  });
}

function sharedQueue<T extends object>(
  queues: WeakMap<UserDataStore, PreferenceQueue<T>>,
  store: UserDataStore,
  namespace: "preferences" | "story-read-log",
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): PreferenceQueue<T> {
  let queue = queues.get(store);
  if (queue === undefined) {
    queue = new PreferenceQueue(store, namespace, key, fallback, validate);
    queues.set(store, queue);
  }
  return queue;
}

function isReadLogPayload(value: unknown): value is ReadLogPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join("\n") !== "beats\nversion" ||
    record.version !== 1 ||
    !Array.isArray(record.beats)
  )
    return false;
  return (
    record.beats.every((beat) => typeof beat === "string" && beat.length > 0) &&
    new Set(record.beats).size === record.beats.length
  );
}

function restoredValue<T>(
  record: UserRecord | null,
  fallback: T,
  validate: (value: unknown) => value is T,
): { readonly value: T; readonly revision: number | null } | null {
  if (record === null) return { value: clone(fallback), revision: null };
  return validate(record.payload)
    ? { value: clone(record.payload), revision: record.revision }
    : null;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
function ok<T>(value: T): StorageResult<T> {
  return { kind: "ok", value };
}
function failed<T>(code: StorageFailure["code"]): StorageResult<T> {
  return { kind: "failed", error: { code } };
}
function storageError(error: StorageFailure): Error {
  return new Error(error.code, { cause: error });
}
