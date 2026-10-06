<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import Tooltip from '@/components/common/Tooltip.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import ExplorationFidelityScene from '@/components/scenes/exploration/fidelity/ExplorationFidelityScene.vue'
import type { ExplorationPaperModel, ExplorationDetail, ExplorationChapter } from '@/components/scenes/exploration/fidelity/explorationUi'
const { t } = useI18n()
const selected = shallowRef('1-4')
const zoneId = shallowRef('zone-thanh-van')
const mode = shallowRef('manual')
const notice = shallowRef('')
const pointer = shallowRef({ x: 0, y: 0 })
const chapters = computed<ExplorationChapter[]>(() => ['mortal', 'qi', 'foundation'].map((realm, index) => {
  const nodes = Array.from({ length: 10 }, (_, i) => ({
    id: `${index + 1}-${i + 1}`, label: String(i + 1), x: 58 + i * 66, y: 60 + (i % 2 === 0 ? 0 : 17),
    state: index === 0 && i < 3 ? 'cleared' as const : index === 0 && i === 3 ? 'current' as const : index === 0 && i === 4 ? 'available' as const : 'locked' as const,
    boss: i === 9,
    perfect: index === 0 && i === 1,
  }))
  return { id: realm, label: t(`realm.${realm}`), tone: ['', 'blue', 'violet'][index]!, nodes, edges: nodes.slice(1).map((node, i) => ({ from: nodes[i]!.id, to: node.id })) }
}))
const model = computed<ExplorationPaperModel>(() => ({
  title: t('zone'),
  subtitle: 'Hành vạn dặm sơn hà · Ngộ thiên địa kỳ duyên',
  terrain: resolveAssetUrl('/assets/ui/huyen-kim/scene/exploration-v2/terrain-three-realms-v1.png'),
  zones: [{ id: 'zone-thanh-van', label: t('zone'), unlocked: true }, { id: 'zone-huyen-phong', label: 'Huyền Phong', unlocked: false }],
  zone: zoneId.value,
  chapters: chapters.value,
  progress: 10,
  progressLabel: '3 / 30',
  armedFarm: null,
  stopLabel: t('autoFarm.stop'),
}))
// Fixture drop cells - mirrors what ExplorationSurface builds from the
// registries: item art in the slot, drop range under the cell, item
// info card on hover (drop amount is part of the card).
const EQUIPMENT_ANY_ICON = resolveAssetUrl('/assets/ui/huyen-kim/symbols/equipment.svg')
const rewards = [
  { label: 'Linh thạch', amount: '×2.000', tooltip: { kind: 'plain', title: 'Linh Thạch', description: 'Tiền tệ tu luyện chung.' } },
  { label: 'Tâm pháp tinh thông', amount: '×50', tooltip: { kind: 'plain', title: 'Tâm Pháp Tinh Thông', description: 'Điểm tinh thông tâm pháp.' } },
  { label: 'Linh Mộc', amount: '×5–8', icon: resolveAssetUrl('/assets/materials/linh_moc.png'), tooltip: { kind: 'plain', title: 'Linh Mộc', description: 'Gỗ linh khí, nguyên liệu phổ biến của Thanh Vân.\nSố lượng rơi: ×5–8' } },
  { label: 'Trang bị bất kỳ', amount: '×1', icon: EQUIPMENT_ANY_ICON, tooltip: { kind: 'plain', title: 'Trang Bị Bất Kỳ', description: 'Một món trang bị ngẫu nhiên từ kho chung.\nSố lượng rơi: ×1' } },
] as const
const stage = computed<ExplorationDetail>(() => {
  const chapter = chapters.value.find(entry => entry.nodes.some(node => node.id === selected.value)) ?? chapters.value[0]!
  const node = chapter.nodes.find(entry => entry.id === selected.value) ?? chapter.nodes[0]!
  const locked = node.state === 'locked'
  return {
    id: node.id,
    title: t(node.boss ? 'bossTitle' : 'stageTitle', { code: node.id }),
    chapter: chapter.label,
    description: t('description'),
    state: node.state,
    stateLabel: t(`exploration.state.${node.state}`),
    enemySummary: node.boss ? t('bossEnemySummary') : t('enemySummary'),
    enemyLabel: node.boss ? t('bossEnemyLabel') : t('enemyLabel'),
    rewards,
    disabledLabel: locked ? t('disabled') : '',
    modes: ['manual', 'repeat', 'progress', 'perfect_farm'].map(id => ({ id, label: t(`panels.stageSelect.modes.${id === 'perfect_farm' ? 'perfectFarm' : id}`), active: mode.value === id, disabled: id === 'perfect_farm' })),
    modeHint: t(`panels.stageSelect.modeHints.${mode.value === 'perfect_farm' ? 'perfectFarm' : mode.value}`),
    buildLabel: t('panels.stageSelect.actions.editBuild'),
    startLabel: t('panels.stageSelect.actions.start'),
    startDisabled: locked,
  }
})
function choose(id: string) { selected.value = id; notice.value = '' }
function chooseZone(id: string) { if (id === zoneId.value) return; notice.value = t('navNotice', { name: 'Huyền Phong' }) }
function pickMode(id: string) { if (id === 'perfect_farm') { notice.value = t('disabled'); return } mode.value = id }
function back() { window.location.assign('/legacy/ui-dong-fu.html') }
function move(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) }
}
</script>
<template><SceneDesignCanvas><div class="exploration-preview" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }"><DongFuVista /><ExplorationFidelityScene :model="model" :stage="stage" :notice="notice" preview @select="choose" @zone="chooseZone" @mode="pickMode" @stop-farm="notice = t('notice')" @open-build="notice = t('navNotice', { name: t('nav.skill') })" @start="notice = t('notice')" @back="back" /></div></SceneDesignCanvas><Tooltip /></template>
<style scoped>.exploration-preview { position:relative; width:100%; height:100%; }</style>
