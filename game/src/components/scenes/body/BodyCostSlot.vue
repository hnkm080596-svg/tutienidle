<script setup lang="ts">
// Scene 08 detail-panel material slot: icon tile + name + have/need
// readout (met = jade, unmet = cinnabar) matching the reference's three
// requirement slots.
import { formatNumber } from '@/core/format/NumberFormatter'
import type { BodyCostView } from './bodySceneModel'

defineProps<{
  cost: BodyCostView
}>()
</script>

<template>
  <div class="body-cost" :class="{ 'is-met': cost.met, 'is-short': !cost.met }">
    <span class="body-cost__icon art-needed" :data-art-id="`body-cost-icon-${cost.id}`">
      <img v-if="cost.icon" class="body-cost__img" :src="cost.icon" alt="" aria-hidden="true" />
    </span>
    <span class="body-cost__name">{{ cost.name }}</span>
    <span class="body-cost__count">
      {{ formatNumber(cost.have) }}/{{ formatNumber(cost.need) }}
    </span>
  </div>
</template>

<style scoped>
.body-cost {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  border-radius: var(--hk-radius-sm, 6px);
  border: 1px solid var(--hk-border-muted, #2a352f);
  background: var(--hk-surface-raised, #131b17);
}
.body-cost__icon {
  position: relative;
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--hk-border-ceremony, #b99a55);
  background:
    radial-gradient(circle at 35% 30%, rgba(244, 217, 139, 0.35) 0%, transparent 62%),
    var(--hk-surface-base, #0b0f0d);
  overflow: hidden;
}
.body-cost__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.body-cost__name {
  flex: 1;
  min-width: 0;
  font-size: var(--text-xs);
  color: var(--hk-text-secondary, #b8ae97);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.body-cost__count {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: var(--text-xs);
  color: var(--hk-text-primary, #ede6d6);
}
.body-cost.is-short .body-cost__count { color: var(--hk-cinnabar, #b54432); }
.body-cost.is-met .body-cost__count { color: var(--hk-jade-soft, #67c4ab); }
</style>
