<script setup lang="ts">
// Scene 11 recipe-list row (spec asset: list-row). Canonical row =
// name + herb count; ref also draws a pill icon tile - temp art chip
// stands in until per-pill icons exist.
defineProps<{
  index: number
  pillName: string
  herbAmountLabel: string
  selected: boolean
}>()
const emit = defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    class="alchemy-row"
    :class="{ 'is-selected': selected }"
    @click="emit('select')"
  >
    <span class="alchemy-row__pill">
      <i class="alchemy-row__pill-icon art-needed" data-art-id="alchemy-pill-icon" aria-hidden="true" />
      <b>{{ String(index + 1).padStart(2, '0') }}</b>
      {{ pillName }}
    </span>

    <span class="alchemy-row__herb">{{ herbAmountLabel }}</span>
  </button>
</template>

<style scoped>
.alchemy-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  padding: 9px 10px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--scene-fire-accent) 10%, var(--paper-50)), color-mix(in srgb, var(--scene-fire-accent) 4%, var(--paper-100)));
  border: 1px solid color-mix(in srgb, var(--scene-fire-accent) 30%, var(--paper-line));
  border-radius: var(--radius-sm);
  color: var(--paper-text);
  cursor: pointer;
  font-family: var(--font-body);
}
.alchemy-row.is-selected {
  border-color: var(--scene-fire-glow);
  box-shadow: inset 3px 0 var(--scene-fire-glow), 0 0 14px color-mix(in srgb, var(--scene-fire-glow) 18%, transparent);
}
.alchemy-row__pill { display: flex; align-items: center; gap: 8px; }
.alchemy-row__pill b { color: var(--cinnabar); font-size: var(--text-xs); }
.alchemy-row__herb { font-size: var(--text-xs); color: var(--paper-text-soft); }

/* Ref: glowing pill icon tile per row (temp art - pill orb). */
.alchemy-row__pill-icon {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--scene-fire-accent) 85%, #ffd9a0), var(--scene-fire-accent) 55%, #4a1f14);
  border: 1px solid color-mix(in srgb, var(--scene-fire-glow, #d8a24a) 70%, transparent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--scene-fire-accent) 45%, transparent);
}
</style>
