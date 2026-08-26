/** What the shell handed the duel on the last render of `BattleFacadeProbe`.
    The probe stands in for `BattleFacade` in shell tests, which never boot a
    real duel: the shell's side of a duel-hosted control is the prop it passes,
    so that is what these tests read. */
export interface BattleFacadeProps {
  readonly onleavematch: (() => void) | null;
}

export const battleFacadeProps: { current: BattleFacadeProps | null } = {
  current: null,
};

export function resetBattleFacadeProps(): void {
  battleFacadeProps.current = null;
}
