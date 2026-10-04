<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import SkillFidelityScene from '@/components/scenes/skill/fidelity/SkillFidelityScene.vue'
import type { SkillUiNode, SkillUiEdge } from '@/components/scenes/skill/fidelity/skillUi'
import { SKILL_CONSTELLATION_LAYOUTS } from '@/data/progression/SkillConstellationLayouts'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { previewPaperNavigation } from './paperNavigation'
const { t } = useI18n()
const elementIds = ['fire', 'wood', 'water', 'metal', 'earth'] as const
type ElementId = typeof elementIds[number]
const element = shallowRef<ElementId>('fire')
const selectedId = shallowRef('hoa_linh_ngo')
const notice = shallowRef('')
const pointer = shallowRef({ x: 0, y: 0 })
const navigation = computed(() => previewPaperNavigation(t))
const elements = computed(() => elementIds.map(id => ({ id, label: t(`element.${id}`), icon: resolveAssetUrl(`/assets/ui/elements/el-${id}.png`) })))
// Authored fire glyph from SkillConstellationLayouts renders the real
// constellation in preview; the other elements keep the generic
// radial fixture until their glyphs exist.
const fireLayout = SKILL_CONSTELLATION_LAYOUTS.fire
const fireFixture: Record<string, { state: SkillUiNode['state']; level: string }> = {
  hoa_linh_ngo: { state: 'learned', level: '2 / 3' },
  hoa_an_sau: { state: 'learned', level: '1 / 5' },
  fire_ailment_mastery: { state: 'learned', level: '1 / 5' },
  linh_ngo_tam_muoi_chan_hoa: { state: 'available', level: '0 / 1' },
  hoa_diem_chuan: { state: 'available', level: '0 / 5' },
  hoa_diem_tham: { state: 'locked', level: '0 / 4' },
  hoa_nhiet_keo: { state: 'locked', level: '0 / 4' },
  fire_basic_hoa_tu_diem: { state: 'locked', level: '0 / 3' },
  fire_basic_hoa_tan_diem: { state: 'locked', level: '0 / 3' },
  // Info anchor - read-only seat, mirrors the mortal precursor level.
  linh_bao_tien_than: { state: 'learned', level: '1 / 3' },
}
const constellation = computed(() => (element.value === 'fire' ? fireLayout ?? null : null))
const nodes = computed<SkillUiNode[]>(() => {
  const icon = resolveAssetUrl(`/assets/ui/elements/el-${element.value}.png`)
  const make = (id: string, name: string, x: number, y: number, state: SkillUiNode['state'], level: string): SkillUiNode => ({
    id, name, icon, x, y, state, level,
    description: id === 'root' && element.value === 'fire' ? t('fireDescription') : t('description'),
    rows: [{ id: 'level', label: t('level'), value: level }, { id: 'effect', label: t('effect'), value: t('effectValue') }],
    conditions: state === 'locked' ? [t('lockedHint')] : [],
    costLabel: state === 'learned' ? '' : t('costSample'),
    actionLabel: state === 'learned' ? '' : state === 'available' ? t('upgrade') : t('upgrade'),
    actionDisabled: state !== 'available',
    actionHint: state === 'locked' ? t('fixtureNote') : '',
  })
  if (element.value === 'fire' && fireLayout !== undefined) {
    return fireLayout.points.map((point) => ({
      ...make(point.nodeId, t(`fireConst.${point.nodeId}`), point.x, point.y, fireFixture[point.nodeId]?.state ?? 'locked', fireFixture[point.nodeId]?.level ?? '0 / 1'),
      emphasis: point.emphasis ?? 'normal',
      // The info anchor offers no action - read-only like production.
      ...(point.nodeId === 'linh_bao_tien_than'
        ? { actionLabel: '', actionDisabled: true, actionHint: '', costLabel: '', conditions: [t('fixtureInfoOnly')] }
        : {}),
    }))
  }
  return [make('core', t('skillName.core'), 355, 195, 'learned', '3 / 10'), make('root', t(`skillName.${element.value}`), 355, 36, 'learned', '3 / 10'), make('a', t(`branch.${element.value}.a`), 169, 148, 'learned', '1 / 5'), make('b', t(`branch.${element.value}.b`), 540, 148, 'available', '0 / 5'), make('passive', t(`branch.${element.value}.passive`), 169, 310, 'available', '0 / 5'), make('future-a', t('future'), 355, 359, 'locked', '0 / 5'), make('future-b', t('future'), 540, 310, 'locked', '0 / 5')]
})
const radialEdges: readonly SkillUiEdge[] = [{ from: 'core', to: 'root' }, { from: 'core', to: 'a' }, { from: 'core', to: 'b' }, { from: 'a', to: 'passive' }, { from: 'core', to: 'future-a' }, { from: 'b', to: 'future-b' }]
const edges = computed<SkillUiEdge[]>(() =>
  constellation.value !== null
    ? (constellation.value?.strokes.map((stroke) => ({ from: stroke.fromNodeId, to: stroke.toNodeId })) ?? [])
    : [...radialEdges],
)
const selected = computed(() => nodes.value.find(node => node.id === selectedId.value) ?? nodes.value[0] ?? null)
function chooseElement(id: string) { if (elementIds.includes(id as ElementId)) { element.value = id as ElementId; selectedId.value = element.value === 'fire' ? 'hoa_linh_ngo' : 'root'; notice.value = '' } }
function navigate(id: string) {
  if (id === 'inventory') { window.location.assign('/ui-inventory.html'); return }
  if (id === 'equipment') { window.location.assign('/ui-equipment.html'); return }
  const routes: Record<string, string> = { character: '/ui-character.html', realm: '/ui-realm.html', technique: '/ui-technique.html', body: '/ui-body.html', exploration: '/ui-exploration.html', alchemy: '/ui-alchemy.html' }
  const route = routes[id]
  if (route) window.location.assign(route)
  else if (id !== 'skill') notice.value = t('navNotice', { name: t(`nav.${id}`) })
}
function back() { window.location.assign('/ui-dong-fu.html') }
function move(event: PointerEvent) { const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(); pointer.value = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) } }
</script>
<template>
  <SceneDesignCanvas><div class="skill-preview" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }"><DongFuVista /><SkillFidelityScene :nodes="nodes" :edges="edges" :elements="elements" :element="element" :selected="selected" :navigation="navigation" :notice="notice" :identity="`Pháp Tu · ${t(`element.${element}`)}`" insight-label="Cảm Ngộ: 42" :respec-disabled="false" :constellation="constellation" preview @select="selectedId = $event" @element="chooseElement" @navigate="navigate" @back="back" @upgrade="notice = t('notice')" @respec="notice = t('notice')" /></div></SceneDesignCanvas>
</template>
<style scoped>.skill-preview { position:relative; width:100%; height:100%; }</style>
