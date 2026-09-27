export type CoreCandidate = Readonly<{
  schemaVersion: 1;
  buildId: string;
  coreContentApiVersion: number;
}>;

export interface CoreApproval {
  readonly schemaVersion: 1;
  readonly buildId: string;
  readonly coreContentApiVersion: number;
  readonly approvedAt: number;
}

const BUILD_ID = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}$/;

export function parseCoreCandidate(value: unknown): CoreCandidate {
  const row = value as CoreCandidate;
  if (
    !row ||
    typeof row !== "object" ||
    Object.keys(row).sort().join(",") !==
      "buildId,coreContentApiVersion,schemaVersion" ||
    row.schemaVersion !== 1 ||
    typeof row.buildId !== "string" ||
    !BUILD_ID.test(row.buildId) ||
    !Number.isSafeInteger(row.coreContentApiVersion) ||
    row.coreContentApiVersion < 1
  )
    throw new Error("CORE_UPDATE_INVALID");
  return Object.freeze({ ...row });
}

export function parseCoreApproval(value: unknown): CoreApproval | null {
  if (value === undefined) return null;
  const row = value as CoreApproval;
  if (
    !row ||
    typeof row !== "object" ||
    Object.keys(row).sort().join(",") !==
      "approvedAt,buildId,coreContentApiVersion,schemaVersion" ||
    row.schemaVersion !== 1 ||
    typeof row.buildId !== "string" ||
    !BUILD_ID.test(row.buildId) ||
    !Number.isSafeInteger(row.coreContentApiVersion) ||
    row.coreContentApiVersion < 1 ||
    !Number.isSafeInteger(row.approvedAt) ||
    row.approvedAt < 0
  )
    throw new Error("APP_STORAGE_UNAVAILABLE");
  return Object.freeze({ ...row });
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open("ygo-app-update-approval", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("approval"))
        request.result.createObjectStore("approval");
    };
    request.onerror = () =>
      reject(new Error("APP_STORAGE_UNAVAILABLE", { cause: request.error }));
    request.onblocked = () => reject(new Error("APP_STORAGE_UNAVAILABLE"));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function readCoreApproval(
  factory: IDBFactory,
): Promise<CoreApproval | null> {
  const db = await open(factory);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("approval", "readonly");
      const request = tx.objectStore("approval").get("approved");
      request.onsuccess = () => {
        try {
          resolve(parseCoreApproval(request.result));
        } catch (error) {
          reject(error);
        }
      };
      request.onerror = () =>
        reject(new Error("APP_STORAGE_UNAVAILABLE", { cause: request.error }));
    });
  } finally {
    db.close();
  }
}

export async function writeCoreApproval(
  factory: IDBFactory,
  input: CoreCandidate,
  currentBuildId: string,
  approvedAt: number,
): Promise<CoreApproval> {
  const candidate = parseCoreCandidate(input);
  const db = await open(factory);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("approval", "readwrite");
      const store = tx.objectStore("approval");
      const request = store.get("approved");
      let result: CoreApproval | null = null;
      request.onsuccess = () => {
        try {
          const existing = parseCoreApproval(request.result);
          if (
            existing !== null &&
            existing.buildId !== currentBuildId &&
            existing.buildId !== candidate.buildId
          )
            throw new Error("CORE_UPDATE_PENDING");
          result = Object.freeze({ ...candidate, approvedAt });
          store.put(result, "approved");
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      request.onerror = () =>
        reject(new Error("APP_STORAGE_UNAVAILABLE", { cause: request.error }));
      tx.oncomplete = () => {
        if (result === null) reject(new Error("APP_STORAGE_UNAVAILABLE"));
        else resolve(result);
      };
      tx.onabort = () => {
        if (result !== null) reject(new Error("APP_STORAGE_UNAVAILABLE"));
      };
      tx.onerror = () => reject(new Error("APP_STORAGE_UNAVAILABLE"));
    });
  } finally {
    db.close();
  }
}

export async function pendingCoreApproval(
  factory: IDBFactory,
  currentBuildId: string,
): Promise<CoreApproval | null> {
  const approval = await readCoreApproval(factory);
  return approval !== null && approval.buildId !== currentBuildId
    ? approval
    : null;
}
