import type { StorageResult } from "./package.ts";

export interface AsyncPreferencePort<T> {
  read(): Promise<T>;
  update(patch: Partial<T>): Promise<StorageResult<T>>;
  flush(): Promise<StorageResult<void>>;
}
export interface StoryReadLogPort {
  read(): Promise<ReadonlySet<string>>;
  markRead(beatId: string): Promise<StorageResult<void>>;
  flush(): Promise<StorageResult<void>>;
}
