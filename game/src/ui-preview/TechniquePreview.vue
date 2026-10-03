<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import TechniqueFidelityScene from '@/components/scenes/technique/fidelity/TechniqueFidelityScene.vue'
import type { TechniqueUiModel } from '@/components/scenes/technique/fidelity/techniqueUi'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { previewPaperNavigation } from './paperNavigation'
const { t } = useI18n()
const selected = shallowRef('major')
const notice = shallowRef('')
const pointer = shallowRef({ x: 0, y: 0 })
// ?empty shows the no-technique page (info card alone, no artifact
// vista or upgrade rail); ?locked dims the Tam Phap rail item like the
// production progression lock below Luyen Khi.
const flags = new URLSearchParams(window.location.search)
const emptyState = flags.has('empty')
const navLocked = flags.has('locked')
const navigation = computed(() => previewPaperNavigation(t, navLocked ? ['technique'] : []))
const model = computed<TechniqueUiModel>(() => emptyState
  ? {
      hasTechnique: false,
      name: '', quality: '', description: t('empty'), art: '',
      sections: [], stages: [],
      rankLabel: '', masteryLabel: '', masteryPercent: 0,
      currentGrade: '', nextGrade: '',
      material: { name: '', amountLabel: '' }, materialNote: '',
      advanceDisabled: true, disabledReason: '', artTemporary: false,
    }
  : ({
  hasTechnique: true,
  name: t('name'), quality: t('quality'), description: t('description'), art: resolveAssetUrl('/assets/ui/huyen-kim/scene/technique-v2/temporary-manual-v1.png'),
  sections: [{ id: 'combat', title: t('combat'), rows: [{ id: 'system', label: t('system'), value: t('systemValue') }, { id: 'might', label: t('might'), value: '+120' }, { id: 'defense', label: t('defense'), value: '+80' }, { id: 'mana', label: t('mana'), value: '+12%' }] }],
  stages: [{ id: 'entry', label: t('stage.entry'), state: 'reached' }, { id: 'minor', label: t('stage.minor'), state: 'reached' }, { id: 'major', label: t('stage.major'), state: 'current' }, { id: 'complete', label: t('stage.complete'), state: 'next' }],
  rankLabel: t('rank'), masteryLabel: '210 / 300', masteryPercent: 70, currentGrade: t('currentGrade'), nextGrade: t('nextGrade'), material: { name: t('material'), amountLabel: '1.280 / 800' }, materialNote: t('materialNote'),
  advanceDisabled: false, disabledReason: '', artTemporary: true,
}))
function navigate(id: string) {
  if (id === 'inventory') { window.location.assign('/ui-inventory.html'); return }
  if (id === 'character') window.location.assign('/ui-character.html')
  else if (id === 'body') window.location.assign('/ui-body.html')
  else if (id === 'exploration') window.location.assign('/ui-exploration.html')
  else if (id === 'alchemy') window.location.assign('/ui-alchemy.html')
  else if (id === 'equipment') window.location.assign('/ui-equipment.html')
  else if (id === 'skill') window.location.assign('/ui-skill.html')
  else if (id === 'realm') window.location.assign('/ui-realm.html')
  else if (id !== 'technique') notice.value = t('navNotice', { name: t(`nav.${id}`) })
}
function back() { window.location.assign('/ui-dong-fu.html') }
function select(id: string) {
  const stage = model.value.stages.find(entry => entry.id === id)
  if (!stage) return
  selected.value = id
  notice.value = t('selection', { name: stage.label })
}
function move(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) }
}
</script>
<template>
  <SceneDesignCanvas><div class="technique-preview" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }"><DongFuVista /><TechniqueFidelityScene :model="model" :navigation="navigation" :selected="selected" :notice="notice" preview @navigate="navigate" @back="back" @select="select" @advance="notice = t('notice')" /></div></SceneDesignCanvas>
</template>
<style scoped>.technique-preview { position:relative; width:100%; height:100%; }</style>
