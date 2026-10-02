<script setup lang="ts">
// Scene 11 detail-panel cost rows (audit EXACT: fuel wood row +
// spirit-stone row; ref's "Nhiên Liệu" + "Tiêu Hao Linh Thạch").
import { useI18n } from 'vue-i18n'
import StatRow from '@/components/common/primitives/StatRow.vue'

export interface AlchemyCostRow {
  label: string
  owned: number
  amount: number
}

defineProps<{
  fuelWoodRow: AlchemyCostRow | null
  spiritStoneRow: { owned: number; amount: number }
}>()
const { t } = useI18n()
</script>

<template>
  <section class="alchemy-detail__block">
    <h4>{{ t('alchemy.otherCosts') }}</h4>

    <ul class="alchemy-costs">
      <StatRow v-if="fuelWoodRow" :label="fuelWoodRow.label" :tone="fuelWoodRow.owned < fuelWoodRow.amount ? 'negative' : 'default'">
        {{ fuelWoodRow.owned }}/{{ fuelWoodRow.amount }}
      </StatRow>
      <StatRow :label="t('alchemy.spiritStones')" :tone="spiritStoneRow.owned < spiritStoneRow.amount ? 'negative' : 'default'">
        {{ spiritStoneRow.owned }}/{{ spiritStoneRow.amount }}
      </StatRow>
    </ul>
  </section>
</template>

<style scoped>
.alchemy-detail__block h4 {
  margin: 0 0 6px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--cinnabar);
}
.alchemy-costs { margin: 0; padding: 0; list-style: none; }
</style>
