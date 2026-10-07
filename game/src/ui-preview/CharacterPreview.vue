<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import CharacterFidelityScene from '@/components/scenes/character/fidelity/CharacterFidelityScene.vue'
import Tooltip from '@/components/common/Tooltip.vue'
import type { CharacterUiModel } from '@/components/scenes/character/fidelity/characterUi'
const { t } = useI18n()
function back() { window.location.assign('/legacy/ui-dong-fu.html') }
const notice = shallowRef('')
const pointer = shallowRef({ x: 0, y: 0 })
const model = computed<CharacterUiModel>(() => ({
  name: t('name'), realm: t('realm'), path: t('pathValue'), combatPower: '126.400',
  stats: [
    { id: 'vitality', label: t('stat.vitality'), value: '142', fill: 57, color: '#ad3f36', symbol: 'body', allocatable: true,
      sources: { base: 120, bodyDelta: 12, contributions: [
        { label: 'Trang Bị · Giáp Vảy Rồng', flat: 22 },
      ] } },
    { id: 'strength', label: t('stat.strength'), value: '168', fill: 67, color: '#b38b37', symbol: 'equipment', allocatable: true,
      sources: { base: 150, contributions: [
        { label: 'Trang Bị · Kiếm Tre', flat: 12 },
        { label: 'Tâm Pháp · Ngự Kiếm Tâm Kinh', flat: 6 },
      ] } },
    { id: 'dexterity', label: t('stat.dexterity'), value: '156', fill: 62, color: '#477f47', symbol: 'exploration',
      sources: { base: 140, contributions: [
        { label: 'Cảnh Giới · Nhập Đạo', flat: 16 },
      ] } },
    { id: 'attunement', label: t('stat.attunement'), value: '132', fill: 53, color: '#357c97', symbol: 'realm',
      sources: { base: 120, contributions: [
        { label: 'Kỹ Năng · Tĩnh Tâm Quyết', flat: 12 },
      ] } },
    { id: 'intelligence', label: t('stat.intelligence'), value: '143', fill: 57, color: '#77419b', symbol: 'skill', capped: true,
      sources: { base: 130, contributions: [
        { label: 'Buff · Tụ Thần Hương', flat: 13 },
      ] } },
  ],
  elements: [
    { id: 'fire', name: t('element.fire'), share: '28%', power: '280', resistance: '42', penetration: '18' },
    { id: 'wood', name: t('element.wood'), share: '19%', power: '190', resistance: '30', penetration: '12' },
    { id: 'earth', name: t('element.earth'), share: '18%', power: '180', resistance: '50', penetration: '10' },
    { id: 'water', name: t('element.water'), share: '22%', power: '220', resistance: '35', penetration: '15' },
    { id: 'metal', name: t('element.metal'), share: '13%', power: '130', resistance: '28', penetration: '22' },
  ],
  talents: [
    { id: 't1', name: 'Kiếm Tâm Thông Minh', description: 'Kỹ năng kiếm tăng sát thương.', rarity: 'epic' },
    { id: 't2', name: 'Linh Căn Thanh Tú', description: 'Tốc độ tu luyện tăng nhẹ.', rarity: 'rare' },
  ],
  offense: [
    { id: 'might', label: t('detail.might'), value: '1.280',
      sources: { base: 1000, contributions: [
        { label: 'Căn Cốt', flat: 210 },
        { label: 'Trang Bị · Kiếm Tre', flat: 70 },
      ] } },
    { id: 'speed', label: t('detail.speed'), value: '132' },
    { id: 'accuracyRating', label: t('detail.accuracyRating'), value: '960' },
    { id: 'criticalRate', label: t('detail.criticalRate'), value: '18,5%',
      sources: { base: 0.05, contributions: [
        { label: 'Thân Pháp', flat: 0.085 },
        { label: 'Trang Bị · Kiếm Tre', flat: 0.05 },
      ] } },
    { id: 'criticalDamage', label: t('detail.criticalDamage'), value: '168%' },
    { id: 'skillDamagePercent', label: t('detail.skillDamagePercent'), value: '8%',
      sources: { base: 0, contributions: [
        { label: 'Buff · Tụ Thần Hương', flat: 0.08 },
      ] } },
    { id: 'primordialPower', label: t('detail.primordialPower'), value: '120' },
  ],
  defense: [
    { id: 'defense', label: t('detail.defense'), value: '860',
      sources: { base: 800, contributions: [
        { label: 'Căn Cốt', flat: 20 },
        { label: 'Trang Bị · Giáp Vảy Rồng', flat: 40 },
      ] } },
    { id: 'maxHp', label: t('detail.maxHp'), value: '12.640',
      sources: { base: 12000, contributions: [
        { label: 'Thể Chất', flat: 640 },
      ] } },
    { id: 'maxMp', label: t('detail.maxMp'), value: '4.320' },
    { id: 'evasionRate', label: t('detail.evasionRate'), value: '14%' },
    { id: 'criticalAvoidance', label: t('detail.criticalAvoidance'), value: '12%' },
    { id: 'leechPercent', label: t('detail.leechPercent'), value: '6%' },
    { id: 'finalDamageReductionPercent', label: t('detail.finalDamageReductionPercent'), value: '5%' },
  ],
  attributePoints: 3,
}))
function select(key: string) { notice.value = t('notice', { name: t(key) }) }
function move(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) }
}
</script>
<template>
  <SceneDesignCanvas><div class="character-preview" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }">
    <DongFuVista />
    <CharacterFidelityScene :model="model" :notice="notice" preview @select="select" @allocate="select" @back="back" />
    <Tooltip />
  </div></SceneDesignCanvas>
</template>
<style scoped>.character-preview { position: relative; width: 100%; height: 100%; }</style>
