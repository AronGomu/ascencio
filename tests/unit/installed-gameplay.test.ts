import { afterEach, expect, it } from "vitest";
import {
  semanticShellStartup,
  disposeSemanticShells,
} from "../fixtures/semantic-shell.ts";
import { installedGameplayFixture } from "../fixtures/installed-gameplay.ts";
import { resetStorySessionFixture } from "../fixtures/story-session.ts";

afterEach(async () => {
  await disposeSemanticShells();
  await resetStorySessionFixture();
});
it("SQLite inputs expose global card semantics without a hosted chapter union or selected receipt", async () => {
  const startup = await semanticShellStartup(installedGameplayFixture());
  const session = await startup.application!.acquire(
    "freeplay",
    new AbortController().signal,
  );
  expect(session.inputs.cards.all().map(({ code }) => Number(code))).toEqual(
    Array.from({ length: 14 }, (_, i) => i + 1),
  );
  expect(session.inputs).not.toHaveProperty("content");
  expect(session.inputs.editor.starter.name).toBe("Installed Starter");
  await session.close();
});
it("Story independently receives chapter semantics while Freeplay retains its global catalog", async () => {
  const startup = await semanticShellStartup(installedGameplayFixture());
  const session = await startup.application!.acquire(
    "story",
    new AbortController().signal,
  );
  expect(session.inputs.release.chapters[0]!.cardCodes).toHaveLength(14);
  expect(session.inputs.gameplay.presentation.cards).toHaveLength(14);
  expect(session.inputs.gameplay).not.toHaveProperty("readFile");
  await session.close();
});
it("prototype domain decks load through current SQLite Story adapter", async () => {
  const startup = await semanticShellStartup();
  const session = await startup.application!.acquire(
    "story",
    new AbortController().signal,
  );
  expect(session.inputs.gameplay.defaults.starterDeckId).toBe(
    "chapter-one-starter",
  );
  await session.close();
});
