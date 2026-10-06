<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { stableSceneArtUrl } from '@/presentation/huyenKim/StableSceneArt'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import DongFuVista from '@/components/scenes/dong-fu/fidelity/DongFuVista.vue'
import EquipmentFidelityScene from '@/components/scenes/equipment/fidelity/EquipmentFidelityScene.vue'
import type { EquipmentDisplay, EquipmentSocket } from '@/components/scenes/equipment/fidelity/equipmentUi'
const { t } = useI18n()
const notice = shallowRef('')
const pointer = shallowRef({ x: 0, y: 0 })
// Same mannequin art the production doll mounts - lets the preview
// exercise the narrow art gap between the two socket columns.
const characterImage = stableSceneArtUrl('equipment-paperdoll-base', '@1x')
const kinds = ['kiem', 'bao', 'quan', 'hai', 'gioi', 'chau'] as const
const items = computed<EquipmentDisplay[]>(() => Array.from({ length: 18 }, (_, i) => {
  const kind = kinds[i % kinds.length]!
  return { id: `fixture-${i}`, name: t(`names.${kind}`), slot: t(`slots.${kind}`), icon: resolveAssetUrl(`/assets/equipment/items/base-${kind}/${kind}-0${1 + Math.floor(i / 6)}.png`), grade: t('grade'), level: t('level', { n: 1 + Math.floor(i / 6) }), enhancement: `+${12 - i % 6}`, tone: ['#80c99b', '#c6a0ee', '#efc76e'][Math.floor(i / 6)]!, description: t('description'), stats: [{ label: t('attack'), value: '+1.260' }, { label: t('defense'), value: '+840' }, { label: t('critical'), value: '+8,5%' }, { label: t('spirit'), value: '+320' }] }
}))
const sockets = computed<EquipmentSocket[]>(() => kinds.map((kind, i) => ({ id: kind, label: t(`slots.${kind}`), item: items.value[i]! })))
function move(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pointer.value = { x: Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)), y: Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) }
}
function back() { window.location.assign('/ui-dong-fu.html') }
function action(id:string) {
  if(id==='enhance'||id==='dissolve')window.location.assign(`/ui-forge.html#${id}`)
  else notice.value=t('notice')
}
</script>
<template><SceneDesignCanvas><div class="equipment-preview-host" :style="{ '--df-x': pointer.x, '--df-y': pointer.y }" @pointermove="move" @pointerleave="pointer = { x: 0, y: 0 }"><DongFuVista /><EquipmentFidelityScene :sockets="sockets" :items="items" :notice="notice" :character-image="characterImage" preview @back="back" @action="action" /></div></SceneDesignCanvas></template>
<style scoped>.equipment-preview-host { position:relative; width:100%; height:100%; }</style>
