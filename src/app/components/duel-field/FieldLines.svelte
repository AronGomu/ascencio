<script lang="ts">
  import type { FieldFeedbackLine } from "../../presentation/dom-feedback-controller.ts";

  export let line: FieldFeedbackLine;
</script>

<svg
  class="field-lines"
  class:is-attack={line.kind === "attack"}
  aria-hidden="true"
  focusable="false"
  data-cy="field-lines"
>
  <line
    x1={line.x1}
    y1={line.y1}
    x2={line.x2}
    y2={line.y2}
    data-cy="field-lines-segment"
  />
</svg>
