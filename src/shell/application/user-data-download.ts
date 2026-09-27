export interface UserDataDownloadAdapter {
  createObjectURL(blob: Blob): string;
  createAnchor(url: string): { click(): void; remove(): void };
  afterDispatch(): Promise<void>;
  revokeObjectURL(url: string): void;
}

export const DOWNLOAD_REQUESTED =
  "Download requested. Check your browser downloads for user-data.sqlite; saving is not confirmed.";
export const DOWNLOAD_FAILED =
  "User data download failed. No saved backup was confirmed. Retry export.";

const browserDownload: UserDataDownloadAdapter = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  createAnchor(url) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "user-data.sqlite";
    anchor.hidden = true;
    anchor.dataset.cy = "user-data-export-download";
    document.body.append(anchor);
    return anchor;
  },
  // Keep the URL alive past click dispatch, until the browser's next task.
  // This is not an acknowledgement that the user saved the download.
  afterDispatch: () => new Promise((resolve) => setTimeout(resolve, 0)),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
};

export async function downloadUserData(
  blob: Blob,
  report: (message: string) => void,
  adapter: UserDataDownloadAdapter = browserDownload,
): Promise<void> {
  let url: string | null = null;
  let anchor: ReturnType<UserDataDownloadAdapter["createAnchor"]> | null = null;
  try {
    url = adapter.createObjectURL(blob);
    anchor = adapter.createAnchor(url);
    anchor.click();
    report(DOWNLOAD_REQUESTED);
    await adapter.afterDispatch();
  } catch {
    report(DOWNLOAD_FAILED);
  } finally {
    try {
      anchor?.remove();
    } finally {
      if (url !== null) adapter.revokeObjectURL(url);
    }
  }
}
