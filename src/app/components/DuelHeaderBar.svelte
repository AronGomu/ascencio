<script lang="ts">
  const DEFAULT_AVATAR_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='19' fill='%2318243b' stroke='%23697895' stroke-width='2'/%3E%3Ccircle cx='20' cy='16' r='7' fill='%23697895'/%3E%3Cpath d='M6 34c2-8 9-12 14-12s12 4 14 12' fill='%23697895'/%3E%3C/svg%3E";

  export let lifePoints: readonly [number, number] | null = null;
  export let selfAvatarUrl = "";
  export let opponentAvatarUrl = "";
  export let onopensettings: () => void;
</script>

<header class="duel-header-bar" data-cy="duel-header-bar">
  <div class="duel-header-bar__player" data-cy="duel-header-player-1">
    <img
      class="duel-header-bar__avatar"
      src={opponentAvatarUrl || DEFAULT_AVATAR_PLACEHOLDER}
      alt=""
      aria-hidden="true"
      data-cy="duel-header-avatar-p1"
    />
    <p class="duel-header-bar__life" data-cy="duel-header-life-points-p1">
      {lifePoints === null ? "—" : `${lifePoints[1].toLocaleString()} LP`}
    </p>
  </div>

  <div class="duel-header-bar__spacer" data-cy="duel-header-spacer"></div>

  <div class="duel-header-bar__player" data-cy="duel-header-player-0">
    <img
      class="duel-header-bar__avatar"
      src={selfAvatarUrl || DEFAULT_AVATAR_PLACEHOLDER}
      alt=""
      aria-hidden="true"
      data-cy="duel-header-avatar-p0"
    />
    <p class="duel-header-bar__life" data-cy="duel-header-life-points-p0">
      {lifePoints === null ? "—" : `${lifePoints[0].toLocaleString()} LP`}
    </p>
  </div>

  <button
    type="button"
    aria-label="Settings"
    class="secondary duel-header-bar__settings"
    data-cy="app-menubar-settings-button"
    onclick={onopensettings}
  >
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-cy="duel-header-settings-icon"
    >
      <path
        data-cy="duel-header-settings-icon-path"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.63l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96c-.5-.38-1.04-.7-1.63-.94l-.36-2.54A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.6 8.48a.5.5 0 0 0 .12.63l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.72 14.15a.5.5 0 0 0-.12.63l1.92 3.32c.14.24.42.34.68.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54c.05.24.25.42.5.42h4c.25 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.63-.94l2.39.96c.26.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.63l-2.03-1.58ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  </button>
</header>
