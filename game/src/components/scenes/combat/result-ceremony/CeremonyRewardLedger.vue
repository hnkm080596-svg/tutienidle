<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import HuyenKimSymbol from '@/components/common/HuyenKimSymbol.vue'
import type {
  VictoryGrowthCardView,
  VictorySlotView,
} from '@/components/scenes/victory/victorySceneModel'
import { countedReward } from './useResultCeremonyPlayback'

const props = defineProps<{
  slots: VictorySlotView[]
  growth: VictoryGrowthCardView[]
  elapsed: number
  outcome: 'victory' | 'defeat'
}>()
const { t, locale } = useI18n()
const formatter = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }))
const rows = computed<VictorySlotView[]>(() => [
  ...props.slots,
  ...props.growth.map((card) => ({
    id: card.id,
    kind: 'growth' as const,
    icon: null,
    symbol: card.symbol,
    name: t(card.labelKey),
    amount: card.amount,
  })),
])
</script>

<template>
  <section
    class="ceremony-ledger"
    :aria-label="
      t(outcome === 'victory' ? 'combat.victory.sections.rewards' : 'combat.defeat.rewardsHeader')
    "
  >
    <header class="ceremony-ledger__heading">
      <span class="ceremony-ledger__line" />
      <h2>
        {{
          t(
            outcome === 'victory'
              ? 'combat.victory.sections.rewards'
              : 'combat.defeat.rewardsHeader',
          )
        }}
      </h2>
      <span class="ceremony-ledger__line" />
    </header>
    <ul v-if="rows.length" class="ceremony-ledger__rows" tabindex="0">
      <li
        v-for="(row, index) in rows"
        :key="row.id"
        class="ceremony-ledger__row"
        :class="{
          'is-growth': row.kind === 'growth',
          'is-settled': countedReward(row.amount, elapsed, index) === row.amount,
        }"
        :style="{ '--row-delay': `${Math.min(index, 5) * 65}ms` }"
      >
        <span class="ceremony-ledger__icon" aria-hidden="true">
          <InkNineSlice chrome-id="frame-s-slot" layer="surface" :thickness="12" />
          <HuyenKimSymbol v-if="row.symbol" :name="row.symbol" />
          <img v-else-if="row.icon" :src="row.icon" alt="" />
          <HuyenKimSymbol v-else :name="row.kind === 'equipment' ? 'equipment' : 'inventory'" />
        </span>
        <span class="ceremony-ledger__name">{{ row.name }}</span>
        <span class="ceremony-ledger__dots" aria-hidden="true" />
        <span
          class="ceremony-ledger__amount"
          :data-reward-id="row.id"
          :data-total="row.amount"
          :aria-label="`+${formatter.format(row.amount)}`"
        >
          +{{ formatter.format(countedReward(row.amount, elapsed, index)) }}
        </span>
      </li>
    </ul>
    <p v-else class="ceremony-ledger__empty">{{ t('combat.ceremony.noRewards') }}</p>
  </section>
</template>

<style scoped>
.ceremony-ledger {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.ceremony-ledger__heading {
  display: flex;
  gap: 16px;
  align-items: center;
  padding-bottom: 14px;
}
.ceremony-ledger__heading h2 {
  margin: 0;
  color: var(--paper-text, #342b20);
  font: 600 17px var(--font-display, serif);
  text-align: center;
}
.ceremony-ledger__line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, #9b7a4555);
}
.ceremony-ledger__line:last-child {
  transform: scaleX(-1);
}
.ceremony-ledger__rows {
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  padding: 0 8px 0 0;
  margin: 0;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-color: #9b7a4580 transparent;
}
.ceremony-ledger__rows:focus-visible {
  outline: 2px solid #82632e;
  outline-offset: 3px;
}
.ceremony-ledger__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 0;
  border-bottom: 1px solid #80653a20;
  animation: reward-in calc(420ms * var(--ceremony-pace))
    calc((850ms + var(--row-delay)) * var(--ceremony-pace)) both;
}
.ceremony-ledger__row:last-child {
  border-bottom: 0;
}
.ceremony-ledger__icon {
  position: relative;
  isolation: isolate;
  flex: 0 0 42px;
  height: 42px;
  display: grid;
  place-items: center;
}
.ceremony-ledger__icon > :not(.ink-nine-slice) {
  position: relative;
  width: 28px;
  height: 28px;
  object-fit: contain;
  color: #d8bd78;
}
.ceremony-ledger__name {
  color: var(--paper-text, #342b20);
  font-size: 14px;
  overflow-wrap: anywhere;
}
.ceremony-ledger__dots {
  flex: 1;
  min-width: 8px;
  align-self: flex-end;
  margin-bottom: 15px;
  border-bottom: 1px dotted #80653a50;
}
.ceremony-ledger__amount {
  flex-shrink: 0;
  min-width: 5ch;
  text-align: right;
  color: #76541d;
  font: 600 23px var(--font-display, serif);
  font-variant-numeric: tabular-nums;
}
.is-growth .ceremony-ledger__amount {
  color: #32604f;
}
.ceremony-ledger__empty {
  margin: 12px 0;
  text-align: center;
  color: var(--paper-text-soft, #5e5a50);
}
@keyframes reward-in {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (max-width: 480px) {
  .ceremony-ledger__amount {
    font-size: 19px;
  }
  .ceremony-ledger__row {
    gap: 8px;
  }
}
</style>
