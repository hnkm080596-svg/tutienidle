<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import RealmFidelityScene from '@/components/scenes/realm/fidelity/RealmFidelityScene.vue'
import type { RealmUiModel } from '@/components/scenes/realm/fidelity/realmUi'
const { t } = useI18n()
const selected = shallowRef(11)
const notice = shallowRef('')
const pointer = shallowRef({ x: 0, y: 0 })
const model = computed<RealmUiModel>(() => ({ name: t('name'), currentFloor: 11, maxFloor: 18, progress: 70, progressLabel: '70%', cultivation: '7.000 / 10.000', rate: t('rateValue'), requirements: [{ id: 'level', label: t('level'), met: false }, { id: 'chapter', label: t('chapter'), met: true }], passives: [{ id: 'p1', name: 'Linh Khí Hộ Thể', description: 'Nhập đạo ban phúc.', effectLines: ['Sức mạnh +5%'] }], nextRealmName: 'Trúc Cơ', ctaLabel: t('breakthrough'), ctaVisible: true, ctaEnabled: false, quanKhiEntry: true }))
function back() { window.location.assign('/legacy/ui-dong-fu.html') }
function move(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) }
}
</script>
<template>
  <SceneDesignCanvas><div class="realm-preview" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }"><DongFuVista /><RealmFidelityScene :model="model" :selected="selected" :notice="notice" preview @select-floor="selected = $event" @back="back" @breakthrough="notice = t('notice')" /></div></SceneDesignCanvas>
</template>
<style scoped>.realm-preview { position:relative; width:100%; height:100%; }</style>
