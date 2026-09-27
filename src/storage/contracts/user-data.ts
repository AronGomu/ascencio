import type { StorageResult } from "./package.ts";

export type UserNamespace =
  | "decks"
  | "deck-meta"
  | "deck-autosaves"
  | "story"
  | "preferences"
  | "story-read-log";

export interface UserRecord {
  readonly namespace: UserNamespace;
  readonly key: string;
  readonly revision: number;
  readonly payload: unknown;
}

export type UserMutation =
  | {
      readonly kind: "put";
      readonly namespace: UserNamespace;
      readonly key: string;
      readonly expectedRevision: number | null;
      readonly payload: unknown;
    }
  | {
      readonly kind: "delete";
      readonly namespace: UserNamespace;
      readonly key: string;
      readonly expectedRevision: number;
    };

export interface BackupPreview {
  readonly token: string;
  readonly currentRevision: number;
  readonly counts: Readonly<Record<UserNamespace, number>>;
}

/** Local transport outcome only; never an authoritative Worker response. */
export interface RestoreOutcomeUnknown {
  readonly kind: "restore-outcome-unknown";
}

export type RestoreUserDataResult =
  StorageResult<{ readonly revision: number }> | RestoreOutcomeUnknown;

export interface UserDataStore {
  readUser(
    namespace: UserNamespace,
    key: string,
  ): Promise<StorageResult<UserRecord | null>>;
  listUser(
    namespace: UserNamespace,
  ): Promise<StorageResult<readonly UserRecord[]>>;
  writeUser(
    mutations: readonly UserMutation[],
  ): Promise<StorageResult<readonly UserRecord[]>>;
  exportUserData(): Promise<StorageResult<Blob>>;
  inspectUserDataBackup(file: File): Promise<StorageResult<BackupPreview>>;
  restoreUserData(
    token: string,
    expectedRevision: number,
    confirmed: true,
  ): Promise<RestoreUserDataResult>;
}
