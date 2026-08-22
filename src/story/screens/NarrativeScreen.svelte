<script lang="ts">
  import ChoiceList from "../components/ChoiceList.svelte";
  import GearIcon from "../components/icons/GearIcon.svelte";
  import type { StoryBeat } from "../content/prologue.ts";
  import { PROLOGUE } from "../content/prologue.ts";
  import type { ChoiceId } from "../model/story-state.ts";
  import type { PlaybackMode } from "../playback/story-playback.ts";

  export let beat: StoryBeat = PROLOGUE.beats[0]!;
  export let narrativeIndex = 0;
  export let choices: readonly {
    readonly id: ChoiceId;
    readonly label: string;
  }[] = [];
  export let selectedChoice: ChoiceId | null = null;
  export let choiceResponse: string | null = null;
  export let missingAssets = false;
  export let playback: PlaybackMode = "off";
  /** Why playback last stopped on its own, or null when it did not. */
  export let playbackNotice: string | null = null;
  export let onadvance: () => void = () => undefined;
  export let ontoggleplayback: (mode: "auto" | "skip") => void = () =>
    undefined;
  export let onchoose: (choice: ChoiceId) => void = () => undefined;
  export let onutility: (utility: "history" | "pause") => void = () =>
    undefined;

  let uiHidden = false;

  function isControl(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLElement &&
      target.closest("button, input, select, textarea, [role='dialog']") !==
        null
    );
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (
      uiHidden ||
      choices.length > 0 ||
      event.repeat ||
      isControl(event.target)
    )
      return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onadvance();
    }
  }

  /* Every click advances, including the second and third of a fast burst: a
     reader tapping through a scene produces clicks with a rising `detail`,
     and dropping those was indistinguishable from a dead dialogue box. The
     stage is unselectable instead, so a fast burst cannot highlight the line
     it is trying to advance past. */
  function handleStageClick(event: MouseEvent): void {
    if (!uiHidden && choices.length === 0 && !isControl(event.target))
      onadvance();
  }

  function characterName(character: StoryBeat["characters"][number]): string {
    return character
      .replace("-", " ")
      .replace(/^./, (value) => value.toUpperCase());
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="narrative-stage"
  data-testid="narrative-stage"
  data-cy="story-narrative-stage"
  aria-label="Narrative scene"
  onclick={handleStageClick}
>
  <div
    class="background"
    class:fallback={missingAssets}
    data-testid="narrative-background"
    data-cy="story-narrative-background"
    data-background={beat.background}
    data-fallback={missingAssets}
    role="img"
    aria-label={missingAssets
      ? `Missing background art: ${beat.background}`
      : `${beat.background} background`}
  ></div>

  <div
    class="characters"
    aria-label="Characters present"
    data-cy="story-narrative-characters"
  >
    {#each beat.characters as character, index (`${character}-${index}`)}
      <div
        class:missing={missingAssets}
        class="character"
        role="img"
        aria-label={missingAssets
          ? `Missing character art: ${characterName(character)}`
          : characterName(character)}
        data-expression={character}
        data-cy={`story-narrative-character-${character}-${index}`}
      >
        <span
          aria-hidden="true"
          data-cy={`story-narrative-character-glyph-${character}-${index}`}
          >{missingAssets ? "?" : character.startsWith("rin") ? "R" : "K"}</span
        >
      </div>
    {/each}
  </div>

  <div
    class="utility-bar"
    aria-label="Narrative utilities"
    data-cy="story-narrative-utilities"
  >
    <button
      type="button"
      class="secondary compact"
      data-cy="story-narrative-ui-toggle"
      aria-pressed={uiHidden}
      onclick={() => (uiHidden = !uiHidden)}
      >{uiHidden ? "Show UI" : "Hide UI"}</button
    >
    {#if !uiHidden}
      <button
        type="button"
        class="secondary compact"
        data-cy="story-narrative-history"
        onclick={() => onutility("history")}>History</button
      >
      <button
        type="button"
        class="secondary compact"
        class:engaged={playback === "auto"}
        aria-pressed={playback === "auto"}
        data-cy="story-narrative-auto"
        onclick={() => ontoggleplayback("auto")}>Auto</button
      >
      <button
        type="button"
        class="secondary compact"
        class:engaged={playback === "skip"}
        aria-pressed={playback === "skip"}
        data-cy="story-narrative-skip"
        onclick={() => ontoggleplayback("skip")}>Skip</button
      >
      <button
        type="button"
        class="secondary compact"
        data-cy="story-narrative-menu"
        aria-label="Open menu"
        onclick={() => onutility("pause")}
        ><GearIcon cy="story-narrative-menu-icon" /></button
      >
    {/if}
  </div>

  {#if !uiHidden && playbackNotice !== null}
    <p
      class="playback-notice"
      role="status"
      data-cy="story-narrative-playback-notice"
    >
      {playbackNotice}
    </p>
  {/if}

  {#if !uiHidden}
    <article
      class="dialogue"
      data-kind={beat.kind}
      aria-label="Current dialogue"
      data-cy="story-narrative-dialogue"
    >
      {#if beat.speaker}<p class="speaker" data-cy="story-narrative-speaker">
          {beat.speaker}
        </p>{/if}
      <p class="line" aria-live="off" data-cy="story-narrative-text">
        {beat.text}
      </p>
      <span class="advance-cue" aria-hidden="true" data-cy="story-narrative-cue"
        >◆</span
      >
      <span class="visually-hidden" data-cy="story-narrative-advance-hint"
        >Press Enter, Space, or tap to advance.</span
      >
      <span
        data-testid="narrative-cursor"
        class="cursor"
        data-cy="story-narrative-cursor">Beat {narrativeIndex + 1}</span
      >
    </article>

    {#if choices.length > 0}
      <div class="choices" data-cy="story-narrative-choices">
        <h2 data-cy="story-narrative-choices-heading">Choose your response</h2>
        <ChoiceList
          choices={choices.map((choice) => ({
            id: choice.id,
            label: choice.label,
            dataCy: `story-choice-${choice.id}`,
            pressed: selectedChoice === choice.id,
          }))}
          dataCy="story-narrative-choice-list"
          label="Choose your response"
          onchoose={(id) =>
            /* The list hands back an id this screen gave it, and every one of
               those came from `choices`. */
            onchoose(id as ChoiceId)}
        />
      </div>
    {/if}
    {#if choiceResponse}<p
        class="choice-response"
        role="status"
        data-cy="story-narrative-choice-response"
      >
        {choiceResponse}
      </p>{/if}
  {/if}
</section>

<style>
  .narrative-stage {
    position: relative;
    min-height: 100svh;
    overflow: hidden;
    background: var(--bg);
    /* Tapping through a scene must never select the line being tapped; the
       history overlay is where the text stays selectable. */
    user-select: none;
  }
  .background {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 65% 25%, var(--border), transparent 16%),
      linear-gradient(155deg, var(--field-glow), var(--bg) 75%);
    transition: opacity 220ms ease;
  }
  .background[data-background="concourse"] {
    background: linear-gradient(
      115deg,
      var(--surface),
      var(--border-strong) 45%,
      var(--bg-deep)
    );
  }
  .background[data-background="arena"] {
    background:
      radial-gradient(
        ellipse at 50% 70%,
        var(--border-strong) 0 18%,
        transparent 19%
      ),
      linear-gradient(var(--bg), var(--field-glow));
  }
  .background.fallback {
    background: repeating-linear-gradient(
      135deg,
      var(--surface-chain) 0 16px,
      var(--surface) 16px 32px
    );
  }
  .characters {
    position: absolute;
    inset: 8% 4% 11rem;
    display: flex;
    justify-content: center;
    align-items: end;
    gap: min(5vw, 4rem);
    pointer-events: none;
  }
  .character {
    width: min(33vw, 20rem);
    height: min(68vh, 37rem);
    display: grid;
    place-items: center;
    border: 2px solid var(--border-light);
    border-radius: 48% 48% 16% 16%;
    background: linear-gradient(var(--border-strong), var(--surface-chain));
    font:
      800 clamp(3rem, 12vw, 8rem) Georgia,
      serif;
    color: var(--text);
    filter: drop-shadow(
      0 1rem 2rem color-mix(in srgb, var(--shadow) 73%, transparent)
    );
  }
  .character[data-expression="rin-smile"] {
    background: linear-gradient(var(--border-strong), var(--surface));
  }
  .character.missing {
    border-style: dashed;
    background: var(--surface-raised);
  }
  .utility-bar {
    position: absolute;
    z-index: 3;
    inset: max(0.5rem, env(safe-area-inset-top))
      max(0.5rem, env(safe-area-inset-right)) auto
      max(0.5rem, env(safe-area-inset-left));
    display: flex;
    flex-wrap: wrap;
    justify-content: end;
    gap: 0.35rem;
  }
  .compact {
    min-height: 44px;
    padding: 0.5rem 0.7rem;
    background: color-mix(in srgb, var(--bg) 80%, transparent);
  }
  .compact.engaged {
    border-color: var(--story-accent);
    background: var(--surface-chain);
    color: var(--accent);
  }
  .playback-notice {
    position: absolute;
    z-index: 3;
    left: 50%;
    top: max(4rem, calc(3.5rem + env(safe-area-inset-top)));
    width: min(34rem, calc(100% - 2rem));
    transform: translateX(-50%);
    margin: 0;
    padding: 0.6rem 0.9rem;
    border: 1px solid var(--story-accent);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    text-align: center;
  }
  .dialogue {
    position: absolute;
    z-index: 2;
    left: max(1rem, env(safe-area-inset-left));
    right: max(1rem, env(safe-area-inset-right));
    bottom: max(1rem, env(safe-area-inset-bottom));
    min-height: 9rem;
    padding: 1.2rem 3rem 1.2rem 1.2rem;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: color-mix(in srgb, var(--bg) 91%, transparent);
    box-shadow: 0 1rem 3rem color-mix(in srgb, var(--shadow) 60%, transparent);
  }
  .dialogue[data-kind="thought"] {
    border-left: 0.35rem solid var(--stack-accent);
    font-style: italic;
  }
  .dialogue[data-kind="narration"] {
    background: color-mix(in srgb, var(--bg) 80%, transparent);
  }
  .speaker {
    width: fit-content;
    margin: -2.2rem 0 0.7rem;
    padding: 0.35rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 0.35rem;
    background: var(--surface-chain);
    color: var(--accent);
    font-weight: 800;
  }
  .line {
    max-width: 70ch;
    margin: 0;
    font-size: clamp(1rem, 2.3vw, 1.35rem);
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  .advance-cue {
    position: absolute;
    right: 1.2rem;
    bottom: 1rem;
    color: var(--story-accent);
  }
  .cursor {
    position: absolute;
    right: 1rem;
    top: 0.5rem;
    color: var(--story-muted);
    font-size: 0.7rem;
  }
  /* Centred on the stage rather than stacked above the dialogue box: a branch
     point is the screen's whole question while it is open, and the shopkeeper's
     menu meets the player in the same place. Sized to its content instead of
     spanning the stage, so the utility bar underneath it stays clickable. */
  .choices {
    position: absolute;
    z-index: 4;
    left: 50%;
    top: 50%;
    width: min(28rem, calc(100% - 2rem));
    transform: translate(-50%, -50%);
    display: grid;
    gap: 0.5rem;
  }
  .choices h2 {
    margin: 0;
    text-align: center;
    text-shadow: 0 2px 5px var(--shadow);
  }
  .choice-response {
    position: absolute;
    z-index: 5;
    inset: auto 1rem 12rem;
    padding: 1rem;
    background: var(--surface-chain);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  @media (max-width: 40rem) {
    .characters {
      bottom: 14rem;
    }
    .character {
      width: 45vw;
      height: 50vh;
    }
    .dialogue {
      bottom: max(0.5rem, env(safe-area-inset-bottom));
    }
    .utility-bar {
      justify-content: start;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .background {
      transition: none;
    }
  }
</style>
