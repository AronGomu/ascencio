export type { GlobalSet } from "./contracts/global-set.ts";
export type {
  PackageDependency,
  PackageId,
  PackageManifest,
  PackageType,
  StorageCode,
  StorageFailure,
  StorageResult,
} from "./contracts/package.ts";
export type {
  CardLibraryConfig,
  CardRow,
  ChapterConfig,
  DeckRow,
  DuelCoreConfig,
  FreeplayConfig,
  PackageConfig,
  SetRow,
  StoryDocumentRow,
} from "./contracts/package-payloads.ts";
export type {
  DownloadLinks,
  ExportPackages,
  ExportReceipt,
  PackageBuildSpec,
} from "./contracts/package-build.ts";
export type {
  ActivePackage,
  ContentQueries,
  ContentQuery,
  ImportProgress,
  LocalStorageClient,
  MediaWarning,
  ModeReadiness,
  PackageStack,
  PackageStore,
  QueryMap,
  RemovePackageResult,
} from "./contracts/storage-client.ts";
export type {
  BackupPreview,
  RestoreOutcomeUnknown,
  RestoreUserDataResult,
  UserDataStore,
  UserMutation,
  UserNamespace,
  UserRecord,
} from "./contracts/user-data.ts";
export type {
  AsyncPreferencePort,
  StoryReadLogPort,
} from "./contracts/preferences.ts";
export {
  orderPackages,
  parsePackageManifest,
} from "./schema/package-manifest.ts";
export { openLocalStorage } from "./create-storage-client.ts";
export {
  prepareNativeStorage,
  closePreparedNativeStorage,
  flushPreparedNativeStorage,
  disableStartupMods,
} from "./native/startup-storage.ts";
export type { StartupProgress } from "./native/prepared-storage.ts";
export type { ContentComposition } from "./mods/mod-contracts.ts";
export { isContentComposition } from "./mods/validate-composition.ts";
export {
  DEFAULT_MOD_PREFERENCES,
  isModPreferences,
} from "./mods/mod-preferences.ts";
export type { ModPreferences } from "./mods/mod-preferences.ts";
export { userWriteLifecycle } from "./user-write-lifecycle.ts";

export { invokeNative, nativeIoTrace } from "./native/invoke.ts";
export { assertNoCriticalReads } from "./diagnostics/io-trace.ts";
export { assertStartupReady, READY_REQUIREMENTS } from "./contracts/startup.ts";
export type { ReadyRequirement, StartupPhase } from "./contracts/startup.ts";
export type {
  IoCategory,
  IoOperation,
  IoTraceEvent,
  IoTraceSnapshot,
} from "./contracts/io-trace.ts";

export type {
  StartupDiagnostic,
  DiagnosticLocation,
  StartupLogStatus,
} from "./contracts/startup-diagnostic.ts";
