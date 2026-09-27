import type {
  ContentQuery,
  ImportProgress,
  MediaWarning,
} from "./storage-client.ts";
import type { PackageId, StorageResult } from "./package.ts";
import type { UserMutation, UserNamespace } from "./user-data.ts";

export interface RpcArgs {
  readonly current: readonly [];
  readonly importPackages: readonly [
    files: readonly File[],
    expectedGeneration: number,
  ];
  readonly verifyInstalled: readonly [];
  readonly removePackage: readonly [
    packageId: PackageId,
    expectedGeneration: number,
  ];
  readonly cleanupUnused: readonly [];
  readonly acquireSession: readonly [];
  readonly releaseSession: readonly [sessionId: string];
  readonly query: readonly [request: ContentQuery];
  readonly readUser: readonly [namespace: UserNamespace, key: string];
  readonly listUser: readonly [namespace: UserNamespace];
  readonly writeUser: readonly [mutations: readonly UserMutation[]];
  readonly exportUserData: readonly [];
  readonly inspectUserDataBackup: readonly [file: File];
  readonly restoreUserData: readonly [
    token: string,
    expectedRevision: number,
    confirmed: true,
  ];
  readonly cancel: readonly [operationId: string];
  readonly close: readonly [];
}
export type RpcRequest = {
  [M in keyof RpcArgs]: {
    readonly id: string;
    readonly method: M;
    readonly args: RpcArgs[M];
  };
}[keyof RpcArgs];
export type RpcResponse =
  | {
      readonly id: string;
      readonly kind: "result";
      readonly result: StorageResult<unknown>;
    }
  | {
      readonly id: string;
      readonly kind: "progress";
      readonly progress: ImportProgress;
    }
  | {
      readonly id: string;
      readonly kind: "media-warning";
      readonly warning: MediaWarning;
    };
