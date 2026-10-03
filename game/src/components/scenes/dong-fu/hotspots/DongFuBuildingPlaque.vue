<script setup lang="ts">
// Building nameplate (scene 03 spec: `building-plaque` family): the
// always-visible vertical hanging tag under each Dong Fu hotspot - name
// runs top-to-bottom, level sits under the tag, status is the dot at the
// tag top. Pure presentation; all resolved values arrive via props.
import type { BuildingBadgeStatus } from '@/composables/useBuildingNavigation'

defineProps<{
  buildingId: string
  name: string
  status: BuildingBadgeStatus
  levelText: string
  /** Resolved `building-plaque` chrome URL; empty/undefined keeps the CSS tag. */
  plaqueUrl?: string
}>()
</script>

<template>
  <span
    class="building-nameplate"
    :class="`building-nameplate--${status}`"
    :data-hk-region="`hotspot-${buildingId}`"
    aria-hidden="true"
  >
    <span v-if="status === 'locked'" class="building-nameplate__lock" />
    <span v-else-if="status === 'ready'" class="building-nameplate__ready" />
    <span v-else-if="status === 'active'" class="building-nameplate__active" />
    <span v-else-if="status === 'upgradeable'" class="building-nameplate__upgradeable" />
    <span
      class="building-nameplate__tag"
      :class="{ 'building-nameplate__tag--art': Boolean(plaqueUrl) }"
      :art-needed="!plaqueUrl"
      data-art-id="building-plaque"
    >
      <img v-if="plaqueUrl" class="building-nameplate__plaque" :src="plaqueUrl" alt="" aria-hidden="true" />
      <span class="building-nameplate__text">{{ name }}</span>
    </span>
    <small class="building-nameplate__level">{{ levelText }}</small>
  </span>
</template>

<style scoped>
/* Huyen Kim S03 (2026-10-02): the plate is a VERTICAL hanging tag using
   the `building-plaque` chrome art (96x160) instead of the old horizontal
   pill - name runs top-to-bottom (vertical-rl, wrapping into columns for
   long names), level sits under the tag, status is the dot at the tag
   top. */
.building-nameplate {
  position: absolute;
  left: 50%;
  top: calc(var(--baseline-y) + 2px);
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  transform: translateX(-50%);
  pointer-events: none;
}

.building-nameplate__tag {
  position: relative;
  display: grid;
  place-items: center;
  min-width: 30px;
  min-height: 58px;
  padding: 8px 6px;
  /* Pending/fallback surface - the plaque PNG owns the tag face when
     the chrome slot resolves. */
  border: 1px solid color-mix(in srgb, var(--gold-500) 55%, var(--frame-outer));
  border-radius: 4px;
  background: linear-gradient(180deg, var(--paper-50), color-mix(in srgb, var(--paper-50) 88%, var(--gold-500)));
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  color: var(--paper-text);
  font: 600 10px var(--font-body);
  line-height: var(--lh-tight);
}

.building-nameplate__tag--art,
.building-nameplate__tag:has(.building-nameplate__plaque) {
  border-color: transparent;
  background: none;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
}

.building-nameplate__plaque {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.building-nameplate__text {
  position: relative;
  z-index: 1;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  max-height: 76px;
  overflow: hidden;
  letter-spacing: 0.02em;
  filter: drop-shadow(0 1px 0 rgba(255, 248, 220, 0.35));
}

.building-nameplate__level {
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink-950) 78%, transparent);
  color: var(--surface-text-soft);
  font-size: 9px;
  font-weight: 400;
  white-space: nowrap;
}

.building-nameplate__lock {
  position: relative;
  flex: 0 0 auto;
  width: 0.58em;
  height: 0.5em;
  border: 1px solid currentColor;
  border-radius: 2px;
}
.building-nameplate__lock::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -0.55em;
  width: 0.36em;
  height: 0.55em;
  border: 1px solid currentColor;
  border-bottom: 0;
  border-radius: 0.36em 0.36em 0 0;
  transform: translateX(-50%);
}
.building-nameplate__ready,
.building-nameplate__active,
.building-nameplate__upgradeable {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.building-nameplate--locked { color: var(--paper-text-muted); opacity: 0.85; }
.building-nameplate--locked .building-nameplate__lock { border-color: var(--paper-text-muted); }
.building-nameplate--ready { color: var(--jade-on-paper, var(--jade)); }
.building-nameplate--ready .building-nameplate__ready { background: var(--jade); box-shadow: 0 0 6px var(--jade); }
.building-nameplate--active { color: var(--el-fire); }
.building-nameplate--active .building-nameplate__active { background: var(--el-fire); box-shadow: 0 0 6px var(--el-fire); }
.building-nameplate--upgradeable { color: var(--gold-700-on-paper, var(--mineral-gold)); }
.building-nameplate--upgradeable .building-nameplate__upgradeable { background: var(--gold-500); box-shadow: 0 0 6px var(--gold-500); }
</style>
