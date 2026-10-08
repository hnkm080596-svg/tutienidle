<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import ForgeFidelityWorkspace from './ForgeFidelityWorkspace.vue'
import ForgeBatchBag from './ForgeBatchBag.vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { useDialogFocus } from '@/composables/useDialogFocus'
import BuildingUpgradeButton from '@/components/common/BuildingUpgradeButton.vue'
import EquipmentPaperItem from './EquipmentPaperItem.vue'
import EquipmentPaperTooltip from './EquipmentPaperTooltip.vue'
import type { EquipmentDisplay, EquipmentSocket } from './equipmentUi'

const props = withDefaults(defineProps<{
  sockets?: readonly EquipmentSocket[]
  items?: readonly EquipmentDisplay[]
  notice: string
  characterImage?: string
  preview?: boolean
}>(), { sockets: () => [], items: () => [], preview: false })

const emit = defineEmits<{ back: []; action: [id: string] }>()

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
// Shared redesigned panel sheet: verbatim skill-sheet (Cong Phap) rect
// + art - flat shared paper page on the common panel band right of the
// nav rail. Class renamed off `equipment-paper` on purpose: the
// tien-hiep-ui.css global rules pin *-paper elements to the legacy
// 156/1272 nine-slice band.
const paper = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')
const divider = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-divider-v1.png')
const darkCard = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')
const circleFrame = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-circle-frame-v1.png')
const tabBrush = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-tab-brush-v1.png')
</script>

<template>
  <section ref="rootRef" class="equipment-scene" :aria-label="t('equipment.title')" @click.self="emit('back')" @keydown.esc="inspecting = null">
    <div class="equipment-sheet" :style="{ backgroundImage: `url('${paper}')` }" aria-hidden="true" />
    <header class="equipment-heading"><h1 class="equipment-title">{{ t('equipment.title') }}</h1><img class="equipment-divider" :src="divider" alt=""></header>
    <!-- Scene-level tab strip per the Codex preview: under the heading,
         above the doll column. The h1 carries `equipment-title` so the
         shared plaque + OngDoGia shine rule hits it like every sibling
         scene (owner ruling 2026-10-08). -->
    <slot name="tabs" />
    <p class="equipment-subtitle">{{ t('equipment.subtitle') }}</p>
    <!-- Cong 2 nang cap: cung nut/predicate voi chip ngoai plaque -
         neo o khe trong giua subtitle va cot bag/forge (design px). -->
    <BuildingUpgradeButton building-id="equipment_hall" class="equipment-upgrade" />

    <!-- The doll region (character stage + 2x3 socket grid) carries the
         fixture stand-in; production mounts the real EquipmentPaperdoll
         through the #doll slot. -->
    <slot name="doll">
      <div class="character-stage" data-character-socket><img v-if="characterImage" class="character-image" :src="characterImage" alt=""></div>
      <div class="equipment-sockets" :style="{ '--equipment-circle-frame': `url('${circleFrame}')` }"><div v-for="socket in sockets" :key="socket.id" class="equipment-socket"><EquipmentPaperItem :item="socket.item" :label="socket.label" @click="selected=socket.item??null" @inspect="inspecting = $event" @leave="inspecting = null" /><span>{{ socket.label }}</span></div></div>
    </slot>

    <!-- Stats card (owner ruling 2026-10-08): no title - the card only
         lists the stats contributed by equipped gear, and the list
         scrolls without ever showing a scrollbar. -->
    <div class="equipment-summary" :style="{ '--equipment-card-art': `url('${darkCard}')` }"><slot name="summary"><div><span>{{ t('equipment.stats.hp') }}</span><strong>18.200</strong><span>{{ t('equipment.stats.attack') }}</span><strong>1.260</strong><span>{{ t('equipment.stats.defense') }}</span><strong>840</strong></div></slot></div>

    <!-- The unified right region (ref: bag OR forge at the same rect)
         carries the fixture bag/forge toggle; production mounts the real
         workspace (detail + beta op tabs + canonical BagGrid). -->
    <slot name="workspace">
      <section v-if="mode==='bag'" class="equipment-bag" :style="{ '--equipment-card-art': `url('${darkCard}')`, '--equipment-tab-brush': `url('${tabBrush}')` }" :aria-label="t('equipment.bag')"><header><h2>{{ t('equipment.bag') }}</h2><button @click="mode='enhance'">{{t('equipment.forgeTitle')}}</button></header><div class="bag-tabs"><span class="active">{{ t('equipment.bagTabs.all') }}</span><span>{{ t('equipment.bagTabs.weapons') }}</span><span>{{ t('equipment.bagTabs.armor') }}</span><span>{{ t('equipment.bagTabs.accessories') }}</span></div><div class="bag-grid" @scroll="inspecting = null"><EquipmentPaperItem v-for="item in items" :key="item.id" :item="item" :label="item.slot" @click="selected=item;mode='enhance'" @inspect="inspecting = $event" @leave="inspecting = null" /><div v-for="n in emptyBagCells" :key="`empty-${n}`" class="empty-bag-cell" aria-hidden="true" /></div><footer><button @click="emit('action', 'sort')">{{ t('equipment.sort') }}</button><button @click="emit('action', 'filter')">{{ t('equipment.filter') }}</button></footer></section>
      <section v-if="mode!=='bag'" class="equipment-forge" :style="{ '--equipment-card-art': `url('${darkCard}')`, '--equipment-tab-brush': `url('${tabBrush}')` }"><header><h2>{{t('equipment.forgeTitle')}}</h2><button @click="mode='bag';inspecting=null">{{t('equipment.bag')}}</button></header><nav><button v-for="id in modes" :key="id" :aria-pressed="mode===id" @click="mode=id;inspecting=null">{{t(`panels.equipmentHall.tabs.${id}`)}}</button></nav><ForgeBatchBag v-if="mode==='dissolve'||mode==='decompose'" :mode="mode" :items="items" @submit="emit('action',$event.mode+':'+$event.itemIds.join(',')+':submit')"/><ForgeFidelityWorkspace v-else-if="forgeItem" compact :mode="mode" :item="forgeItem" @action="emit('action',mode+':'+forgeItem.id+':'+$event)"/></section>
    </slot>

    <EquipmentPaperTooltip v-if="inspecting" :item="inspecting" />

    <p v-if="preview" class="equipment-preview">{{ t('equipment.previewStamp') }}</p><p class="equipment-notice" role="status">{{ notice }}</p>
  </section>
</template>

<style scoped>
.equipment-scene { position:absolute; inset:0; pointer-events:auto; color:#30291d; font-family:var(--font-display,Georgia,serif); }
.equipment-scene :deep(*) { box-sizing:border-box; }
/* Sheet = .skill-sheet verbatim: the redesigned panels' shared band
   (24% / 12.5% / 74% / 75% of the 1440x810 design canvas). */
.equipment-sheet { position:absolute; left:345px; top:101px; width:1065px; height:608px; background-color:#f2e4c8; background-size:cover; background-position:center; background-repeat:no-repeat; border:3px double #b28a43; }
/* Content inside the sheet keeps the same insets Cong Phap uses
   (~27px sides): heading row per the Codex preview's 48px line. */
/* Inner insets mirror HomeEquipmentArtPanel verbatim: sheet padding
   16px 20px 18px -> content x365-1390, heading top 117, tabs 165,
   content grid 215. */
.equipment-heading { position:absolute; left:365px; top:117px; height:48px; display:flex; align-items:center; gap:30px; border-bottom:1px solid #b28a43; width:1025px; }
.equipment-heading h1 { margin:0; font-size:38px; line-height:1.15; font-weight:700; color:#35250f; text-shadow:0 1px #fff7; }
.equipment-divider { width:180px; height:23px; object-fit:contain; opacity:.65; }
.equipment-subtitle { position:absolute; left:365px; top:117px; width:1025px; height:48px; margin:0; display:flex; align-items:center; justify-content:flex-end; font-size:13px; color:#715627; }
.equipment-upgrade { position:absolute; left:1260px; top:124px; width:110px; }
/* Single-line cost: the row is bounded so it keeps its own lane and
   never spills onto the socket grid below (y=240). */
.equipment-upgrade :deep(.building-heading__cost) { color:#8b7246; font-size:10px; line-height:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
/* Columns start below the scene-level tab strip (heading 120-168,
   tabs ~178-220) - same stacking as the Codex preview. */
.character-stage { position:absolute; left:424px; top:215px; width:264px; height:340px; pointer-events:none; }
.character-image { width:100%; height:100%; object-fit:contain; }
.equipment-sockets { position:absolute; left:365px; top:215px; width:369px; height:348px; display:grid; grid-template-columns:74px 74px; grid-template-rows:repeat(3,1fr); justify-content:space-between; }
.equipment-socket { position:relative; display:flex; flex-direction:column; align-items:center; gap:7px; font-size:12px; color:#78623d; }
.equipment-socket::before { content:''; position:absolute; top:-6px; left:50%; width:88px; height:88px; transform:translateX(-50%); background:var(--equipment-circle-frame) center/contain no-repeat; pointer-events:none; z-index:1; }
.equipment-socket :deep(.gear-item) { width:64px; height:64px; border-radius:50%; }
.equipment-socket > span { font-size:14px; font-weight:600; color:#473315; }
/* Codex home-equipment stats card: dark nine-slice card under the doll
   (same character-card art the preview's EquipmentArtCard mounts) -
   title removed per owner ruling; a single-column name/value list in
   the Tu Si derived-stats pattern, gold values on dark. */
.equipment-summary { position:absolute; left:365px; top:572px; width:369px; height:119px; padding:11px 14px 12px; border:15px solid transparent; border-image:var(--equipment-card-art) 90 fill / 15px stretch; color:#f3e4c4; }
/* The list fills the card and scrolls invisibly (owner rule: roll nhung
   khong the hien scroller) - scrollbar-width:none + webkit display:none. */
.equipment-summary :deep(ul),
.equipment-summary :deep(dl) { margin:0; height:100%; align-content:start; overflow:auto; scrollbar-width:none; }
.equipment-summary :deep(ul::-webkit-scrollbar),
.equipment-summary :deep(dl::-webkit-scrollbar) { display:none; }
.equipment-bag { position:absolute; left:748px; top:215px; width:642px; height:476px; padding:14px 18px; border:15px solid transparent; border-image:var(--equipment-card-art) 90 fill / 15px stretch; color:#f3e4c4; }
.equipment-bag header { display:flex; align-items:baseline; justify-content:space-between; }
.equipment-bag h2 { margin:0; font-size:24px; font-weight:700; color:#f3e4c4; }
.equipment-bag header span { font-size:12px; color:#c9a95f; }
.bag-tabs { display:flex; gap:24px; padding:12px 2px 10px; font-size:14px; font-weight:600; color:#c9b184; }
.bag-tabs span { padding:6px 14px; }
.bag-tabs .active { color:#f7e4b5; background:var(--equipment-tab-brush) center/contain no-repeat; }
.bag-grid { display:grid; grid-template-columns:repeat(8,74px); grid-auto-rows:74px; gap:8px; max-height:355px; overflow:auto; padding:4px 0 5px; scrollbar-width:thin; scrollbar-color:#8a7444 transparent; }
.empty-bag-cell { border:1px solid #a68b574a; background:#15171588; box-shadow:inset 0 0 0 3px #00000044; border-radius:4px; }
.equipment-bag footer { display:flex; justify-content:flex-end; gap:12px; margin-top:12px; }
.equipment-scene button { font-family:inherit; }
.equipment-bag footer button { padding:7px 25px; border:1px solid #9f8248; color:#f6dfa6; font-weight:700; background:linear-gradient(#3c5946,#173024); border-radius:3px; cursor:pointer; box-shadow:inset 0 0 0 2px #d3b57633,0 2px 4px #3f2d1455; }
.equipment-bag footer button:hover { filter:brightness(1.15); }
.equipment-scene button:focus-visible { outline:2px solid #d6ad5d; outline-offset:3px; }
.equipment-preview { position:absolute; left:372px; top:692px; width:140px; margin:0; font-size:10px; line-height:15px; color:#7c6a48; }
.equipment-notice { position:absolute; left:750px; top:692px; width:640px; height:13px; margin:0; text-align:right; font-size:12px; color:#62512d; }
.equipment-forge { position:absolute;left:748px;top:215px;width:642px;height:476px;padding:14px 18px;border:15px solid transparent;border-image:var(--equipment-card-art) 90 fill / 15px stretch;color:#f3e4c4 }
.equipment-forge header { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px }
.equipment-forge h2 { font-size:24px;color:#f3e4c4;margin:0;font-weight:700 }
.equipment-forge header button,.equipment-bag header button { background:transparent;border:1px solid #a1844a;color:#c9b184;padding:5px 10px;font-size:12px;cursor:pointer }
.equipment-forge nav { display:flex;gap:5px;margin-bottom:16px;border-bottom:1px solid #95734266;height:38px }
.equipment-forge nav button { flex:1;padding:0 5px;border:0;border-bottom:3px solid transparent;color:#c9b184;background:transparent;font-size:14px;font-weight:700;cursor:pointer }
.equipment-forge nav button[aria-pressed=true] { color:#f7e4b5;border-color:#977337;background:var(--equipment-tab-brush) center/contain no-repeat;border-bottom-color:transparent }
</style>
