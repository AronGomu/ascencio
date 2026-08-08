<script lang="ts">
  export let onopensettings: () => void;
</script>

<header class="app-menubar" data-cy="app-menubar">
  <button
    type="button"
    class="secondary"
    data-cy="app-menubar-settings-button"
    onclick={onopensettings}>Settings</button
  >
</header>
