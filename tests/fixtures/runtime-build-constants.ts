/**
 * The snapshot constants Vite's `define` compiles into the app, for Vitest.
 *
 * `runtimeCatalog()` pins the manifest it reads to `__RUNTIME_MANIFEST_SHA256__`
 * and `__RUNTIME_SNAPSHOT_ID__`, which exist in a build and nowhere else: a test
 * that lets the real loader run would fail on the bare identifier rather than on
 * whatever it meant to assert. These placeholders are deliberately not any real
 * snapshot's digest, so a test that cares about verification stubs its own with
 * `vi.stubGlobal` and a test that does not never reaches one.
 */
Object.assign(globalThis, {
  __RUNTIME_MANIFEST_SHA256__: "0".repeat(64),
  __RUNTIME_SNAPSHOT_ID__: "1".repeat(64),
});
