<script setup lang="ts">
// Scene 11 detail-panel "Nguyên Liệu Cần Thiết" block (audit EXACT:
// herb variant radios — owned/enough per variant).
import { useI18n } from 'vue-i18n'

export interface AlchemyVariantRow {
  materialId: string
  label: string
  owned: number
  enough: boolean
}

defineProps<{
  variants: AlchemyVariantRow[]
  herbAmount: number
}>()
const selectedHerbId = defineModel<string | null>('selectedHerbId', { required: true })
const { t } = useI18n()
</script>

<template>
  <section class="alchemy-detail__block">
    <h4>{{ t('alchemy.herb') }} ({{ herbAmount }})</h4>

    <label
      v-for="variant in variants"
      :key="variant.materialId"
      class="alchemy-variant"
      :class="{ 'is-enough': variant.enough }"
    >
      <input type="radio" :value="variant.materialId" v-model="selectedHerbId" />
      <span>{{ variant.label }}</span>
      <span class="alchemy-variant__owned">×{{ variant.owned }}</span>
    </label>
  </section>
</template>

<style scoped>
.alchemy-detail__block h4 {
  margin: 0 0 6px;
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--cinnabar);
}
.alchemy-variant {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: var(--text-sm);
  cursor: pointer;
}
.alchemy-variant:not(.is-enough) { color: var(--paper-text-muted); }
.alchemy-variant__owned { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--paper-text-soft); }
</style>
