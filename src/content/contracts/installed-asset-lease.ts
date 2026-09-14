export interface InstalledAssetLease {
  readonly url: string;
  release(): void;
}
