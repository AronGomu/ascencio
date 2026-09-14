import { createShellGameplay } from "../../src/shell/application/legacy-content.ts";
import { installedGameplayFixture } from "./installed-gameplay.ts";

export function shellGameplayFixture(
  overrides: Parameters<typeof installedGameplayFixture>[0] = {},
) {
  return createShellGameplay(installedGameplayFixture(overrides), null);
}
