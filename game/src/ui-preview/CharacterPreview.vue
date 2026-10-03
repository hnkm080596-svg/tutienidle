<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import CharacterFidelityScene from '@/components/scenes/character/fidelity/CharacterFidelityScene.vue'
import type { CharacterUiModel } from '@/components/scenes/character/fidelity/characterUi'
import { previewPaperNavigation } from './paperNavigation'
const { t } = useI18n()
const navigation = computed(() => previewPaperNavigation(t))
function navigate(id: string) {
  if (id === 'inventory') { window.location.assign('/ui-inventory.html'); return }
  if (id === 'realm') window.location.assign('/ui-realm.html')
  else if (id === 'body') window.location.assign('/ui-body.html')
  else if (id === 'exploration') window.location.assign('/ui-exploration.html')
  else if (id === 'alchemy') window.location.assign('/ui-alchemy.html')
  else if (id === 'equipment') window.location.assign('/ui-equipment.html')
  else if (id === 'skill') window.location.assign('/ui-skill.html')
  else if (id === 'technique') window.location.assign('/ui-technique.html')
  else if (id !== 'character') select(`nav.${id}`)
}
function back() { window.location.assign('/ui-dong-fu.html') }
const notice = shallowRef('')
const detailsOpen = shallowRef(true)
const selectedElement = shallowRef<string | null>(null)
const pointer = shallowRef({ x: 0, y: 0 })
const model = computed<CharacterUiModel>(() => ({
  name: t('name'), realm: t('realm'), path: t('pathValue'), combatPower: '126.400',
  stats: [
    { id: 'vitality', label: t('stat.vitality'), value: '142', fill: 57, color: '#ad3f36', symbol: 'body', allocatable: true },
    { id: 'strength', label: t('stat.strength'), value: '168', fill: 67, color: '#b38b37', symbol: 'equipment', allocatable: true },
    { id: 'dexterity', label: t('stat.dexterity'), value: '156', fill: 62, color: '#477f47', symbol: 'exploration' },
    { id: 'attunement', label: t('stat.attunement'), value: '132', fill: 53, color: '#357c97', symbol: 'realm' },
    { id: 'intelligence', label: t('stat.intelligence'), value: '143', fill: 57, color: '#77419b', symbol: 'skill', capped: true },
  ],
  elements: [
    { id: 'fire', name: t('element.fire'), share: '28%', power: '280', resistance: '42', penetration: '18', x: 645, y: 194 },
    { id: 'wood', name: t('element.wood'), share: '19%', power: '190', resistance: '30', penetration: '12', x: 493, y: 267 },
    { id: 'earth', name: t('element.earth'), share: '18%', power: '180', resistance: '50', penetration: '10', x: 794, y: 267 },
    { id: 'water', name: t('element.water'), share: '22%', power: '220', resistance: '35', penetration: '15', x: 481, y: 411 },
    { id: 'metal', name: t('element.metal'), share: '13%', power: '130', resistance: '28', penetration: '22', x: 803, y: 411 },
  ],
  talents: [
    { id: 't1', name: 'Kiếm Tâm Thông Minh', description: 'Kỹ năng kiếm tăng sát thương.', rarity: 'epic' },
    { id: 't2', name: 'Linh Căn Thanh Tú', description: 'Tốc độ tu luyện tăng nhẹ.', rarity: 'rare' },
  ],
  combat: [
    { id: 'maxHp', label: t('detail.maxHp'), value: '12.640' }, { id: 'maxMp', label: t('detail.maxMp'), value: '4.320' },
    { id: 'might', label: t('detail.might'), value: '1.280' }, { id: 'defense', label: t('detail.defense'), value: '860' },
    { id: 'criticalRate', label: t('detail.criticalRate'), value: '18,5%' }, { id: 'criticalDamage', label: t('detail.criticalDamage'), value: '168%' },
    { id: 'accuracyRating', label: t('detail.accuracyRating'), value: '960' },
    { id: 'evasionRate', label: t('detail.evasionRate'), value: '14%' }, { id: 'speed', label: t('detail.speed'), value: '132' },
  ],
  other: [
    { id: 'leechPercent', label: t('detail.leechPercent'), value: '6%' }, { id: 'criticalAvoidance', label: t('detail.criticalAvoidance'), value: '12%' },
    { id: 'skillDamagePercent', label: t('detail.skillDamagePercent'), value: '8%' },
    { id: 'finalDamageReductionPercent', label: t('detail.finalDamageReductionPercent'), value: '5%' },
    { id: 'primordialPower', label: t('detail.primordialPower'), value: '120' },
  ],
  attributePoints: 3,
}))
function select(key: string) { notice.value = t('notice', { name: t(key) }) }
function selectElement(id: string) {
  selectedElement.value = id
  const element = model.value.elements.find(entry => entry.id === id)
  if (element) notice.value = t('elementInfo', { ...element })
}
function move(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) }
}
</script>
<template>
  <SceneDesignCanvas><div class="character-preview" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }">
    <DongFuVista />
    <CharacterFidelityScene :model="model" :navigation="navigation" :notice="notice" :selected-element="selectedElement" :details-open="detailsOpen" preview @select="select" @element="selectElement" @navigate="navigate" @allocate="select" @toggle-details="detailsOpen = !detailsOpen" @back="back" />
  </div></SceneDesignCanvas>
</template>
<style scoped>.character-preview { position: relative; width: 100%; height: 100%; }</style>
