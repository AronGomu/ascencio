/** Only the instrumented acceptance build reads the local evidence server. */
export function fixtureFetch(path: string, init?: RequestInit) {
  return fetch(new URL(path, "http://127.0.0.1:4214"), init);
}
