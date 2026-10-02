<script setup lang="ts">
// Dao Luan center seal (spec SS10.1, scene 03 wheel region): the hub is
// a hollow ring AROUND the seated cultivator - the S03 ref keeps the
// figure visible inside a glowing ring, so this stays a CSS ring even
// though the `dao-luan-center` manifest slot is ready (a filled 192px
// medallion would cover the figure). The label hangs below the ring on
// the dais. Art inventory 03-dong-fu tracks the hollow-ring treatment.
defineProps<{
  label: string
}>()
</script>

<template>
  <span
    class="command-wheel__center-seal"
    art-needed
    data-art-id="dao-luan-center"
    aria-hidden="true"
  >{{ label }}</span>
</template>

<style scoped>
.command-wheel__center-seal {
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: end center;
  /* Spec dao-luan-hub: 192px diameter at design scale -> ~147px at the
     1280x720 stage (x0.7655), matching the wheel orbit convention. */
  width: 147px;
  height: 147px;
  padding-bottom: 6px;
  border: 1px solid color-mix(in srgb, var(--hk-gold, var(--mineral-gold)) 78%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--hk-surface-base, var(--ink-950)) 18%, transparent);
  box-shadow:
    inset 0 0 0 3px color-mix(in srgb, var(--hk-surface-base, var(--ink-950)) 55%, transparent),
    inset 0 0 0 4px color-mix(in srgb, var(--hk-gold-muted, var(--mineral-gold)) 55%, transparent),
    0 0 22px var(--hk-glow-gold, rgba(232, 195, 90, 0.35));
  color: var(--hk-gold-bright, var(--mineral-gold));
  font-family: var(--hk-font-display, var(--font-display));
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.6);
  transition:
    opacity 0.24s ease-out,
    transform 0.32s cubic-bezier(0.2, 0.75, 0.3, 1);
}
</style>
