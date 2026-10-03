<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import ForgeFidelityWorkspace from './ForgeFidelityWorkspace.vue'
import ForgeBatchBag from './ForgeBatchBag.vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { useDialogFocus } from '@/composables/useDialogFocus'
import PaperPanelNavigation, { type PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
import BuildingUpgradeButton from '@/components/common/BuildingUpgradeButton.vue'
import EquipmentPaperItem from './EquipmentPaperItem.vue'
import EquipmentPaperTooltip from './EquipmentPaperTooltip.vue'
import type { EquipmentDisplay, EquipmentSocket } from './equipmentUi'

const props = withDefaults(defineProps<{
  sockets?: readonly EquipmentSocket[]
  items?: readonly EquipmentDisplay[]
  navigation: readonly PaperNavigationItem[]
  notice: string
  characterImage?: string
  preview?: boolean
}>(), { sockets: () => [], items: () => [], preview: false })

const emit = defineEmits<{ navigate: [id: string]; back: []; action: [id: string] }>()

const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)

useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })

const inspecting = shallowRef<EquipmentDisplay | null>(null)
const mode = shallowRef('bag')
const selected = shallowRef<EquipmentDisplay | null>(null)
const forgeItem = computed(() => selected.value ?? props.sockets.find(socket => socket.item)?.item ?? props.items[0])
const modes = ['enhance', 'wash', 'refine', 'dissolve', 'decompose']
// The bag grid always pads its trailing row out to a full row of cells
// (the v3 ref's last-row cell loss was a bug, not a design).
const BAG_COLUMNS = 8
const emptyBagCells = computed(() => {
  const remainder = props.items.length % BAG_COLUMNS
  return remainder === 0 ? 0 : BAG_COLUMNS - remainder
})
const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
</script>

<template>
  <section ref="rootRef" class="equipment-scene" :aria-label="t('equipment.title')" @click.self="emit('back')" @keydown.esc="inspecting = null">
    <div class="equipment-paper" :style="{ borderImageSource: `url('${paper}')` }" aria-hidden="true" />
    <PaperPanelNavigation :items="navigation" active="equipment" :label="t('equipment.navigation')" :back-label="t('dongFu.aria')" @select="emit('navigate', $event)" @back="emit('back')" />
    <h1 class="equipment-title">{{ t('equipment.title') }}</h1><p class="equipment-subtitle">{{ t('equipment.subtitle') }}</p>
    <!-- Cong 2 nang cap: cung nut/predicate voi chip ngoai plaque -
         neo o khe trong giua subtitle va cot bag/forge (design px). -->
    <BuildingUpgradeButton building-id="equipment_hall" class="equipment-upgrade" />

    <!-- The doll region (character stage + 2x3 socket grid) carries the
         fixture stand-in; production mounts the real EquipmentPaperdoll
         through the #doll slot. -->
    <slot name="doll">
      <div class="character-stage" data-character-socket><img v-if="characterImage" class="character-image" :src="characterImage" alt=""></div>
      <div class="equipment-sockets"><div v-for="socket in sockets" :key="socket.id" class="equipment-socket"><EquipmentPaperItem :item="socket.item" :label="socket.label" @click="selected=socket.item??null" @inspect="inspecting = $event" @leave="inspecting = null" /><span>{{ socket.label }}</span></div></div>
    </slot>

    <div class="equipment-summary"><h2>{{ t('equipment.summary') }}</h2><slot name="summary"><div><span>{{ t('equipment.stats.hp') }}</span><strong>18.200</strong><span>{{ t('equipment.stats.attack') }}</span><strong>1.260</strong><span>{{ t('equipment.stats.defense') }}</span><strong>840</strong></div></slot></div>

    <!-- The unified right region (ref: bag OR forge at the same rect)
         carries the fixture bag/forge toggle; production mounts the real
         workspace (detail + beta op tabs + canonical BagGrid). -->
    <slot name="workspace">
      <section v-if="mode==='bag'" class="equipment-bag" :aria-label="t('equipment.bag')"><header><h2>{{ t('equipment.bag') }}</h2><button @click="mode='enhance'">{{t('equipment.forgeTitle')}}</button></header><div class="bag-tabs"><span class="active">{{ t('equipment.bagTabs.all') }}</span><span>{{ t('equipment.bagTabs.weapons') }}</span><span>{{ t('equipment.bagTabs.armor') }}</span><span>{{ t('equipment.bagTabs.accessories') }}</span></div><div class="bag-grid" @scroll="inspecting = null"><EquipmentPaperItem v-for="item in items" :key="item.id" :item="item" :label="item.slot" @click="selected=item;mode='enhance'" @inspect="inspecting = $event" @leave="inspecting = null" /><div v-for="n in emptyBagCells" :key="`empty-${n}`" class="empty-bag-cell" aria-hidden="true" /></div><footer><button @click="emit('action', 'sort')">{{ t('equipment.sort') }}</button><button @click="emit('action', 'filter')">{{ t('equipment.filter') }}</button></footer></section>
      <section v-if="mode!=='bag'" class="equipment-forge"><header><h2>{{t('equipment.forgeTitle')}}</h2><button @click="mode='bag';inspecting=null">{{t('equipment.bag')}}</button></header><nav><button v-for="id in modes" :key="id" :aria-pressed="mode===id" @click="mode=id;inspecting=null">{{t(`panels.equipmentHall.tabs.${id}`)}}</button></nav><ForgeBatchBag v-if="mode==='dissolve'||mode==='decompose'" :mode="mode" :items="items" @submit="emit('action',$event.mode+':'+$event.itemIds.join(',')+':submit')"/><ForgeFidelityWorkspace v-else-if="forgeItem" compact :mode="mode" :item="forgeItem" @action="emit('action',mode+':'+forgeItem.id+':'+$event)"/></section>
    </slot>

    <EquipmentPaperTooltip v-if="inspecting" :item="inspecting" />

    <p v-if="preview" class="equipment-preview">{{ t('equipment.previewStamp') }}</p><p class="equipment-notice" role="status">{{ notice }}</p>
  </section>
</template>

<style scoped>
.equipment-scene { position:absolute; inset:0; pointer-events:auto; color:#30291d; font-family:var(--font-display,Georgia,serif); }
.equipment-scene :deep(*) { box-sizing:border-box; }
.equipment-paper { position:absolute; left:94px; top:123px; width:1334px; height:633px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:83px; filter:drop-shadow(0 12px 15px #0009); }
.equipment-title { position:absolute; left:235px; top:166px; margin:0; font-size:32px; font-weight:500; }
.equipment-subtitle { position:absolute; left:380px; top:183px; margin:0; font-size:13px; color:#8b7246; }
.equipment-upgrade { position:absolute; left:572px; top:176px; width:120px; }
.equipment-upgrade :deep(.building-heading__cost) { color:#8b7246; font-size:10px; line-height:11px; }
.character-stage { position:absolute; left:338px; top:229px; width:264px; height:374px; pointer-events:none; }
.character-image { width:100%; height:100%; object-fit:contain; }
.equipment-sockets { position:absolute; left:244px; top:240px; width:449px; height:350px; display:grid; grid-template-columns:74px 74px; grid-template-rows:repeat(3,1fr); justify-content:center; column-gap:264px; }
.equipment-socket { display:flex; flex-direction:column; align-items:center; gap:7px; font-size:12px; color:#78623d; }
.equipment-summary { position:absolute; left:244px; top:605px; width:449px; padding:12px 0; border-top:1px solid #a0875166; }
.equipment-summary h2 { font-size:15px; font-weight:500; margin:0 0 12px; }
.equipment-summary :deep(div) { display:grid; grid-template-columns:repeat(3,auto auto); gap:8px 13px; font-size:12px; }
.equipment-summary :deep(strong) { font-weight:500; color:#496747; }
.equipment-bag { position:absolute; left:700px; top:178px; width:678px; height:507px; padding:0 0 0 20px; border-left:1px solid #a0875166; }
.equipment-bag header { display:flex; align-items:baseline; justify-content:space-between; }
.equipment-bag h2 { margin:0; font-size:23px; font-weight:500; }
.equipment-bag header span { font-size:12px; color:#7d6946; }
.bag-tabs { display:flex; gap:36px; padding:17px 2px 13px; font-size:12px; color:#806b42; }
.bag-tabs .active { color:#345b47; border-bottom:2px solid #668469; padding-bottom:5px; }
.bag-grid { display:grid; grid-template-columns:repeat(8,74px); grid-auto-rows:74px; gap:8px; max-height:365px; overflow:auto; padding:4px 0 5px; scrollbar-width:thin; scrollbar-color:#9c8048 transparent; }
.empty-bag-cell { border:1px solid #a68b574a; background:#aa915418; box-shadow:inset 0 0 0 3px #fff2; border-radius:4px; }
.equipment-bag footer { display:flex; justify-content:flex-end; gap:12px; margin-top:12px; }
.equipment-scene button { font-family:inherit; }
.equipment-bag footer button { padding:7px 25px; border:1px solid #9f8248; color:#59411f; background:linear-gradient(#f4e6bc,#d6bf81); border-radius:3px; cursor:pointer; box-shadow:inset 0 0 0 2px #fff3; }
.equipment-scene button:focus-visible { outline:2px solid #47765f; outline-offset:3px; }
.equipment-preview { position:absolute; left:244px; top:690px; width:140px; margin:0; font-size:10px; line-height:15px; color:#7c6a48; }
.equipment-notice { position:absolute; left:700px; top:710px; width:675px; height:28px; margin:0; text-align:right; font-size:12px; color:#62512d; }
.equipment-title { font-weight:700; color:#35250f; text-shadow:0 1px #fff7; }
.equipment-subtitle { color:#715627; font-size:14px; }
.equipment-socket { color:#473315; font-size:14px; font-weight:600; }
.equipment-summary h2 { font-size:18px; font-weight:700; color:#3f2c12; }
.equipment-summary :deep(div) { font-size:14px; }
.equipment-summary :deep(strong) { font-weight:700; color:#234d3b; }
.equipment-bag h2 { color:#392811; font-weight:700; font-size:26px; }
.equipment-bag header span { font-size:14px; color:#59421e; }
.bag-tabs { gap:24px; padding-top:15px; padding-bottom:15px; font-size:14px; font-weight:600; color:#60481e; }
.bag-tabs span { padding:7px 14px; }
.bag-tabs .active { color:#f7e4b5; background:linear-gradient(#345244,#162d23); border:1px solid #ac8a44; border-radius:3px; box-shadow:inset 0 0 0 2px #d8b46122,0 2px 3px #43280c33; padding-bottom:7px; }
.empty-bag-cell { background:linear-gradient(145deg,#283d328c,#102119b3); border:1px solid #9d834f; box-shadow:inset 0 0 0 3px #1f302aaa; }
.equipment-bag footer button { color:#f6dfa6; font-weight:700; background:linear-gradient(#3c5946,#173024); border-color:#a78745; box-shadow:inset 0 0 0 2px #d3b57633,0 2px 4px #3f2d1455; }
.equipment-bag footer button:hover { filter:brightness(1.15); }
.equipment-forge { position:absolute;left:700px;top:178px;width:678px;height:507px;padding-left:20px;border-left:1px solid #a0875166 }
.equipment-forge header { display:flex;align-items:center;justify-content:space-between;margin-bottom:13px }
.equipment-forge h2 { font-size:23px;color:#392811;margin:0 }
.equipment-forge header button,.equipment-bag header button { background:transparent;border:1px solid #a1844a;color:#5d4320;padding:5px 10px;font-size:12px;cursor:pointer }
.equipment-forge nav { display:flex;gap:5px;margin-bottom:16px;border-bottom:1px solid #95734266;height:38px }
.equipment-forge nav button { flex:1;padding:0 5px;border:0;border-bottom:3px solid transparent;color:#71532f;background:transparent;font-size:14px;font-weight:700;cursor:pointer }
.equipment-forge nav button[aria-pressed=true] { color:#28523a;border-color:#977337;background:#9e823422 }
</style>
