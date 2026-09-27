export async function requestLifetimeOwnerLock(
  locks: LockManager,
  run: () => Promise<void>,
): Promise<{ readonly acquired: boolean }> {
  let acquired = false;
  await locks.request(
    "ascencio-sqlite-owner-v1",
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      acquired = lock !== null;
      if (acquired) await run();
    },
  );
  return { acquired };
}
