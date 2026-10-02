<script setup lang="ts">
// Scene 02 prop — the cinnabar seal stamp pressed beside the title in the
// ref. TEMP ART: carved square placeholder until the seal art lands.
</script>

<template>
  <span
    class="creation-seal-stamp art-needed"
    data-art-id="creation-title-seal"
    aria-hidden="true"
  />
</template>

<style scoped>
.creation-seal-stamp {
  display: inline-block;
  width: clamp(22px, 2.6vw, 34px);
  aspect-ratio: 5 / 6;
  border-radius: 3px;
  background:
    /* carved strokes: two pale vertical bars like a seal-script glyph */
    linear-gradient(90deg, transparent 30%, rgba(237, 230, 214, 0.85) 30% 40%, transparent 40% 60%, rgba(237, 230, 214, 0.85) 60% 70%, transparent 70%),
    linear-gradient(180deg, #d4654f 0%, #b54432 55%, #7e2e21 100%);
  box-shadow:
    inset 0 0 0 2px rgba(237, 230, 214, 0.28),
    inset 0 -3px 6px rgba(93, 35, 26, 0.8),
    0 2px 6px rgba(5, 8, 9, 0.45);
  transform: rotate(-3deg);
}
</style>
