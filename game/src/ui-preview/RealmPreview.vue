<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import RealmFidelityScene from '@/components/scenes/realm/fidelity/RealmFidelityScene.vue'
import type { RealmUiModel } from '@/components/scenes/realm/fidelity/realmUi'
import { previewPaperNavigation } from './paperNavigation'
const { t } = useI18n()
const selected = shallowRef(11)
const notice = shallowRef('')
const pointer = shallowRef({ x: 0, y: 0 })
const navigation = computed(() => previewPaperNavigation(t))
const model = computed<RealmUiModel>(() => ({ name: t('name'), currentFloor: 11, maxFloor: 18, progress: 70, progressLabel: '70%', cultivation: '7.000 / 10.000', rate: t('rateValue'), requirements: [{ id: 'level', label: t('level'), met: false }, { id: 'chapter', label: t('chapter'), met: true }], passives: [{ id: 'p1', name: 'Linh Khí Hộ Thể', description: 'Nhập đạo ban phúc.', effectLines: ['Sức mạnh +5%'] }], nextRealmName: 'Trúc Cơ', ctaLabel: t('breakthrough'), ctaVisible: true, ctaEnabled: false }))
function navigate(id: string) {
  if (id === 'inventory') { window.location.assign('/ui-inventory.html'); return }
  if (id === 'character') window.location.assign('/ui-character.html')
  else if (id === 'body') window.location.assign('/ui-body.html')
  else if (id === 'exploration') window.location.assign('/ui-exploration.html')
  else if (id === 'alchemy') window.location.assign('/ui-alchemy.html')
  else if (id === 'equipment') window.location.assign('/ui-equipment.html')
  else if (id === 'skill') window.location.assign('/ui-skill.html')
  else if (id === 'technique') window.location.assign('/ui-technique.html')
  else if (id !== 'realm') notice.value = t('navNotice', { name: t(`nav.${id}`) })
}
function back() { window.location.assign('/ui-dong-fu.html') }
function move(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) }
}
</script>
<template>
  <SceneDesignCanvas><div class="realm-preview" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }"><DongFuVista /><RealmFidelityScene :model="model" :navigation="navigation" :selected="selected" :notice="notice" preview @select-floor="selected = $event" @navigate="navigate" @back="back" @breakthrough="notice = t('notice')" /></div></SceneDesignCanvas>
</template>
<style scoped>.realm-preview { position:relative; width:100%; height:100%; }</style>
