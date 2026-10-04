<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import DongFuFidelityScene from '@/components/scenes/dong-fu/fidelity/DongFuFidelityScene.vue'
import type { DongFuUiModel } from '@/components/scenes/dong-fu/fidelity/dongFuUi'
const { t } = useI18n()
const selected = shallowRef<string | null>(null)
const notice = shallowRef('')
const model = computed<DongFuUiModel>(() => ({
  name: t('identity'), realm: t('realmName'), progressLabel: t('progress'), progressPercent: 96.6,
  resources: [
    { id: 'stone', label: t('currency.stone'), value: '326.4K' },
    { id: 'gold', label: t('currency.gold'), value: '12.8K' },
    { id: 'crystal', label: t('currency.crystal'), value: '1.240' },
  ],
  actions: [
    { id: 'character' }, { id: 'realm' }, { id: 'skill' },
    { id: 'body' }, { id: 'alchemy' }, { id: 'exploration' }, { id: 'equipment' },
    { id: 'inventory' }, { id: 'technique' },
  ].map(action => ({ ...action, labelKey: `action.${action.id}`, symbol: action.id })),
  utilities: ['feedback', 'inventory', 'settings'].map(id => ({ id, labelKey: `action.${id}`, symbol: id })),
  buildings: [
    { id: 'teleport_array', x: 131, y: 301, symbol: 'exploration' },
    { id: 'gathering_outpost', x: 44, y: 448, symbol: 'home' },
    { id: 'pill_room', x: 292, y: 555, symbol: 'alchemy' },
    { id: 'equipment_hall', x: 978, y: 475, symbol: 'equipment' },
    { id: 'vendor', x: 1200, y: 625, symbol: 'inventory' },
  ].map(building => ({ ...building, labelKey: `building.${building.id}` })),
  opportunities: [
    { id: 'realm', symbol: 'realm' }, { id: 'alchemy', symbol: 'alchemy' },
    { id: 'technique', symbol: 'technique' }, { id: 'production', symbol: 'home' },
    { id: 'quest', symbol: 'quest' },
  ].map(entry => ({ ...entry, labelKey: `opportunity.${entry.id}`, detailKey: `detail.${entry.id}` })),
  quest: { name: t('questName'), detail: '2/5', claimable: false },
}))
function select(id: string) {
  selected.value = id
  const item = [...model.value.actions, ...model.value.buildings, ...model.value.opportunities, ...model.value.utilities].find(entry => entry.id === id)
  notice.value = t('notice', { name: t(item?.labelKey ?? `action.${id}`) })
}
</script>
<template><DongFuFidelityScene :model="model" :notice="notice" :selected="selected" @action="select" /></template>
