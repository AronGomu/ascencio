import type { ProgressiveContentStore } from "../../content/index.ts";
import type { StoryMigrationPort } from "../../story/saves/index.ts";
import type { PreparedRelease } from "./prepared-release.ts";
import {
  selectionTransaction,
  type ApplicationSelection,
} from "./application-state.ts";
import { pendingCoreApproval } from "./core-update-approval.ts";
import {
  APPLICATION_LIFECYCLE_LOCK,
  CONTENT_DOWNLOAD_LOCK,
} from "./application-locks.ts";
export type { ApplicationSelection } from "./application-state.ts";
export {
  acquireDomainSession,
  APPLICATION_LIFECYCLE_LOCK,
  CONTENT_DOWNLOAD_LOCK,
  type DomainSession,
} from "./application-locks.ts";
export type ActivationResult =
  | { readonly kind: "activated"; readonly selection: ApplicationSelection }
  | {
      readonly kind: "blocked";
      readonly code:
        | "APP_SESSION_ACTIVE"
        | "APP_DOWNLOAD_ACTIVE"
        | "APP_CORE_INCOMPATIBLE"
        | "APP_ACTIVATION_CONFLICT";
    }
  | {
      readonly kind: "failed";
      readonly code:
        | "APP_REQUIRED_INPUT_FAILED"
        | "APP_SAVE_MIGRATION_FAILED"
        | "APP_STORAGE_UNAVAILABLE";
    };
export interface ApplicationSelector {
  read(): Promise<ApplicationSelection>;
  activate(
    expectedGeneration: number,
    prepared: PreparedRelease,
    saves: StoryMigrationPort,
    signal: AbortSignal,
  ): Promise<ActivationResult>;
}

export function createApplicationSelector(options: {
  readonly factory: IDBFactory;
  readonly locks: LockManager;
  readonly store: ProgressiveContentStore;
  readonly coreContentApiVersion: number;
  readonly currentBuildId?: string;
  readonly notify?: (selection: ApplicationSelection) => void;
  readonly notificationError?: (error: unknown) => void;
}): ApplicationSelector {
  const read = async () => (await selectionTransaction(options.factory))!;
  return {
    read,
    async activate(expectedGeneration, prepared, saves, signal) {
      let failure:
        | "APP_REQUIRED_INPUT_FAILED"
        | "APP_SAVE_MIGRATION_FAILED"
        | "APP_STORAGE_UNAVAILABLE" = "APP_STORAGE_UNAVAILABLE";
      try {
        return await options.locks.request(
          APPLICATION_LIFECYCLE_LOCK,
          { mode: "exclusive", ifAvailable: true },
          async (lock): Promise<ActivationResult> => {
            if (!lock) return { kind: "blocked", code: "APP_SESSION_ACTIVE" };
            return options.locks.request(
              CONTENT_DOWNLOAD_LOCK,
              { mode: "exclusive", ifAvailable: true },
              async (download): Promise<ActivationResult> => {
                if (!download)
                  return { kind: "blocked", code: "APP_DOWNLOAD_ACTIVE" };
                signal.throwIfAborted();
                const current = await read();
                if (
                  current.generation !== expectedGeneration ||
                  current.generation === Number.MAX_SAFE_INTEGER
                )
                  return { kind: "blocked", code: "APP_ACTIVATION_CONFLICT" };
                failure = "APP_REQUIRED_INPUT_FAILED";
                const manifest = await options.store.readManifest(
                  prepared.content.manifestVersion,
                );
                const pending = options.currentBuildId
                  ? await pendingCoreApproval(
                      options.factory,
                      options.currentBuildId,
                    )
                  : null;
                if (
                  manifest.coreRange.min > options.coreContentApiVersion ||
                  manifest.coreRange.maxExclusive <=
                    options.coreContentApiVersion ||
                  (pending !== null &&
                    (manifest.coreRange.min > pending.coreContentApiVersion ||
                      manifest.coreRange.maxExclusive <=
                        pending.coreContentApiVersion))
                )
                  return { kind: "blocked", code: "APP_CORE_INCOMPATIBLE" };
                if (
                  manifest.releaseSequence !==
                    prepared.content.releaseSequence ||
                  (current.content &&
                    current.content.releaseSequence >
                      prepared.content.releaseSequence)
                )
                  return { kind: "blocked", code: "APP_ACTIVATION_CONFLICT" };
                await options.store.verifyRequired(prepared.content, signal);
                failure = "APP_SAVE_MIGRATION_FAILED";
                const seal = await saves.prepare(
                  current.storyGenerationId,
                  prepared.story,
                );
                await saves.verifySeal(seal);
                failure = "APP_REQUIRED_INPUT_FAILED";
                await options.store.verifyRequired(prepared.content, signal);
                signal.throwIfAborted();
                failure = "APP_STORAGE_UNAVAILABLE";
                const selection = await selectionTransaction(options.factory, {
                  schemaVersion: 1,
                  generation: current.generation + 1,
                  content: prepared.content,
                  storyGenerationId: seal.generationId,
                });
                if (!selection)
                  return { kind: "blocked", code: "APP_ACTIVATION_CONFLICT" };
                // Notification cannot retroactively roll back a committed selector.
                try {
                  options.notify?.(selection);
                } catch (error) {
                  try {
                    options.notificationError?.(error);
                  } catch {
                    console.warn("APP_NOTIFICATION_FAILED");
                  }
                }
                return { kind: "activated", selection };
              },
            );
          },
        );
      } catch (error) {
        if (
          error instanceof Error &&
          [
            "APP_STORAGE_UNAVAILABLE",
            "CONTENT_STORAGE_UNAVAILABLE",
            "STORY_STORAGE_UNAVAILABLE",
          ].includes(error.message)
        )
          failure = "APP_STORAGE_UNAVAILABLE";
        return { kind: "failed", code: failure };
      }
    },
  };
}
