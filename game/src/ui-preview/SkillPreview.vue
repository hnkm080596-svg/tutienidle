<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import SkillFidelityScene from '@/components/scenes/skill/fidelity/SkillFidelityScene.vue'
import type { SkillUiNode, SkillUiEdge } from '@/components/scenes/skill/fidelity/skillUi'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { previewPaperNavigation } from './paperNavigation'
const { t } = useI18n()
const elementIds = ['fire', 'wood', 'water', 'metal', 'earth'] as const
type ElementId = typeof elementIds[number]
const element = shallowRef<ElementId>('fire')
const selectedId = shallowRef('root')
const notice = shallowRef('')
const pointer = shallowRef({ x: 0, y: 0 })
const navigation = computed(() => previewPaperNavigation(t))
const elements = computed(() => elementIds.map(id => ({ id, label: t(`element.${id}`), icon: resolveAssetUrl(`/assets/ui/elements/el-${id}.png`) })))
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
  return [make('core', t('skillName.core'), 355, 195, 'learned', '3 / 10'), make('root', t(`skillName.${element.value}`), 355, 36, 'learned', '3 / 10'), make('a', t(`branch.${element.value}.a`), 169, 148, 'learned', '1 / 5'), make('b', t(`branch.${element.value}.b`), 540, 148, 'available', '0 / 5'), make('passive', t(`branch.${element.value}.passive`), 169, 310, 'available', '0 / 5'), make('future-a', t('future'), 355, 359, 'locked', '0 / 5'), make('future-b', t('future'), 540, 310, 'locked', '0 / 5')]
})
const edges: readonly SkillUiEdge[] = [{ from: 'core', to: 'root' }, { from: 'core', to: 'a' }, { from: 'core', to: 'b' }, { from: 'a', to: 'passive' }, { from: 'core', to: 'future-a' }, { from: 'b', to: 'future-b' }]
const selected = computed(() => nodes.value.find(node => node.id === selectedId.value) ?? nodes.value[0] ?? null)
function chooseElement(id: string) { if (elementIds.includes(id as ElementId)) { element.value = id as ElementId; selectedId.value = 'root'; notice.value = '' } }
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
  <SceneDesignCanvas><div class="skill-preview" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }"><DongFuVista /><SkillFidelityScene :nodes="nodes" :edges="edges" :elements="elements" :element="element" :selected="selected" :navigation="navigation" :notice="notice" :identity="`Pháp Tu · ${t(`element.${element}`)}`" insight-label="Cảm Ngộ: 42" :respec-disabled="false" preview @select="selectedId = $event" @element="chooseElement" @navigate="navigate" @back="back" @upgrade="notice = t('notice')" @respec="notice = t('notice')" /></div></SceneDesignCanvas>
</template>
<style scoped>.skill-preview { position:relative; width:100%; height:100%; }</style>
