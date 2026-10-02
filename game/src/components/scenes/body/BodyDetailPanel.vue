<script setup lang="ts">
// Scene 08 region `detail-panel` (design 1092/176/440/610): the right
// hand card - unit title + description, stat gains, material slots and
// the invest CTA. The unit view comes pre-built from the scene model;
// chapter-specific extras (hidden discovered rows, milestone lines)
// render through the default footer slot.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import Bar from '@/components/common/primitives/Bar.vue'
import { formatNumber } from '@/core/format/NumberFormatter'
import type { BodyUnitView } from './bodySceneModel'
import BodyGainList from './BodyGainList.vue'
import BodyCostSlots from './BodyCostSlots.vue'
import BodyInvestCta from './BodyInvestCta.vue'

const props = defineProps<{
  unit: BodyUnitView | null
  ctaLabel: string
  chapterUnlocked: boolean
  chapterGate?: string | null
}>()

const emit = defineEmits<{ invest: [] }>()
const { t } = useI18n()

const stateLabel = computed(() => {
  switch (props.unit?.status) {
    case 'done': return t('panels.body.states.done')
    case 'active': return t('panels.body.states.active')
    case 'next': return t('panels.realm.meridian.stateNext')
    case 'realm_locked': return t('panels.body.states.realmLocked')
    case 'complete': return t('panels.body.states.done')
    default: return t('panels.body.states.locked')
  }
})
</script>

<template>
  <aside class="body-detail" data-hk-region="detail-panel">
    <InkNineSlice chrome-id="surface-m-panel" layer="surface" />

    <div class="body-detail__inner">
      <header class="body-detail__head">
        <h3 class="body-detail__title">{{ unit?.title }}</h3>
        <span v-if="unit" class="body-detail__state" :class="`is-${unit.status}`">
          {{ stateLabel }}
        </span>
      </header>

      <p v-if="unit?.description" class="body-detail__desc">{{ unit.description }}</p>

      <div v-if="unit?.progress" class="body-detail__progress">
        <Bar :value="unit.progress.value" :max="unit.progress.max" :height="6" />
        <span class="body-detail__progress-label">
          {{ formatNumber(unit.progress.value) }} / {{ formatNumber(unit.progress.max) }}
        </span>
      </div>

      <BodyGainList v-if="unit && unit.gains.length" :gains="unit.gains" />

      <BodyCostSlots v-if="unit && unit.costs.length" :costs="unit.costs" />

      <ul v-if="unit && unit.gates.length" class="body-detail__gates">
        <li v-for="gate in unit.gates" :key="gate">{{ gate }}</li>
      </ul>
      <p v-else-if="!chapterUnlocked && chapterGate" class="body-detail__gates">
        {{ chapterGate }}
      </p>

      <div class="body-detail__spacer" />

      <slot />

      <BodyInvestCta
        v-if="unit && unit.actionable"
        :label="ctaLabel"
        :can-invest="unit.canInvest"
        @invest="emit('invest')"
      />
    </div>
  </aside>
</template>

<style scoped>
.body-detail {
  position: relative;
  isolation: isolate;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* InkNineSlice surface layer paints at z-index 1 - keep content above. */
.body-detail__inner {
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 14px;
  overflow: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  mask-image: linear-gradient(180deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
}
.body-detail__inner::-webkit-scrollbar { display: none; }

/* The corner L-brackets reach ~50px up the card's bottom edge - the
   last row (physique note or the invest CTA) needs its own clearance
   so it never paints inside the ornament zone. */
.body-detail__inner > :last-child {
  margin-bottom: 36px;
}

.body-detail__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--hk-border-muted, #2a352f);
}
.body-detail__title {
  margin: 0;
  font-family: var(--font-display, serif);
  font-weight: 700;
  font-size: var(--text-lg);
  color: var(--hk-gold-radiant, #f4d98b);
}
.body-detail__state {
  flex: 0 0 auto;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--hk-ink, #5b6266);
}
.body-detail__state.is-done,
.body-detail__state.is-complete { color: var(--hk-jade, #3fa68b); }
.body-detail__state.is-active,
.body-detail__state.is-next { color: var(--hk-gold, #b99a55); }

.body-detail__desc {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--hk-text-secondary, #b8ae97);
}

.body-detail__progress {
  display: flex;
  align-items: center;
  gap: 8px;
}
.body-detail__progress :deep(.bar) { flex: 1; }
.body-detail__progress-label {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--hk-text-muted, #7a7260);
}

.body-detail__gates {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--text-sm);
  color: var(--hk-cinnabar, #b54432);
}

.body-detail__spacer { flex: 1; min-height: 4px; }
</style>
