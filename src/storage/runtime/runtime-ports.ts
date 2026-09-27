import type {
  StorageSqlReader,
  SqliteValue,
} from "../schema/package-database.ts";

export interface RuntimeRunResult {
  readonly changes: number;
}

export interface RuntimeDatabase extends StorageSqlReader {
  each(
    sql: string,
    parameters: readonly SqliteValue[],
    callback: (row: Readonly<Record<string, SqliteValue>>) => void | false,
  ): void;
  exec(sql: string): void;
  run(sql: string, parameters?: readonly SqliteValue[]): RuntimeRunResult;
  exportBytes(): Uint8Array;
  close(): void;
}

export interface RuntimeFileStore {
  reserveMinimumCapacity(databaseFiles: number): Promise<void>;
  importDatabase(
    key: string,
    nextChunk: () => Promise<Uint8Array | undefined>,
  ): Promise<number>;
  openDatabase(key: string): RuntimeDatabase;
  exportDatabase(key: string): Promise<Uint8Array>;
  has(key: string): boolean;
  list(): readonly string[];
  unlink(key: string): boolean;
  close(): void;
}
