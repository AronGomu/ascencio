<script lang="ts">
  import type {
    CardDragOrigin,
    DragGhostFrame,
  } from "../../presentation/drag-ghost-physics.ts";

  export let frame: DragGhostFrame;
  export let origin: CardDragOrigin;
  export let settling = false;
  export let reducedMotion = false;

  $: liftScale = reducedMotion ? 1 : 1.08;
  $: ghostStyle =
    `--drag-ghost-x: ${frame.x}px; --drag-ghost-y: ${frame.y}px; ` +
    `--drag-ghost-width: ${origin.width}px; --drag-ghost-height: ${origin.height}px; ` +
    `--drag-ghost-rotate: ${reducedMotion ? 0 : frame.tiltDegrees}deg; ` +
    `--drag-ghost-lift-scale: ${liftScale};`;
</script>

<!-- Presentation-only follower: pointer-transparent, aria-hidden, never
     participates in `elementFromPoint` hit testing. Position/size/rotation
     are inline per-frame values; CSS owns the lift scale/shadow/layer. -->
<div
  class="drag-ghost"
  class:is-settling={settling}
  aria-hidden="true"
  data-cy="drag-ghost"
  style={ghostStyle}
>
  <img
    class="drag-ghost__image"
    src={origin.imageUrl}
    alt=""
    data-cy="drag-ghost-image"
  />
</div>
