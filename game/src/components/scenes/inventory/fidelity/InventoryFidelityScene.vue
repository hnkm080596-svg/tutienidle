<script setup lang="ts">
// Scene 09 (Kho Vat / inventory) paper surface: the approved fidelity
// composition - toolbar tabs | bag grid | detail rail | count - now
// owning the shared paper chrome (nine-slice sheet + nav rail + title)
// exactly like the other migrated tabs. The fixture internals stay as
// slot fallbacks for the preview; production mounts the real bag
// sections + canonical tab state through #toolbar/#grid/#count.
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { useDialogFocus } from '@/composables/useDialogFocus'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import type { InventoryDisplay } from './inventoryUi'
import InventoryFidelityDetail from './InventoryFidelityDetail.vue'

withDefaults(defineProps<{
  items: readonly InventoryDisplay[]
  selected?: InventoryDisplay
  filter: string
  query: string
  notice: string
  preview?: boolean
}>(), { preview: false })

const emit = defineEmits<{ select: [id: string]; filter: [id: string]; query: [value: string]; sort: []; use: [id: string]; back: [] }>()
const { t } = useI18n()
const filters = ['all', 'equipment', 'material', 'pill']
function search(event: Event) { if (event.target instanceof HTMLInputElement) emit('query', event.target.value) }

const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
const titleDivider = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/title-divider-clouds-v1.png')

// Same dialog contract the imperial scroll carried: focus/pointer stay
// inside the open surface and Escape closes through emit('back').
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>

<template>
  <section ref="rootRef" class="inventory-scene" :aria-label="t('panels.bag.title')" @click.self="emit('back')">
    <div class="inventory-paper" :style="{ borderImageSource: `url('${paper}')` }" aria-hidden="true" />
    <h1 class="inventory-title">{{ t('panels.bag.title') }}</h1>
    <img class="inventory-divider" :src="titleDivider" alt="">

    <div class="inventory-content">
      <slot name="toolbar"><div class="toolbar"><nav><button v-for="id in filters" :key="id" :aria-pressed="filter===id" @click="emit('filter',id)">{{ t(`inventoryPreview.${id}`) }}</button></nav><input type="search" :value="query" :placeholder="t('inventoryPreview.search')" :aria-label="t('inventoryPreview.searchLabel')" @input="search"><button class="sort" @click="emit('sort')">{{ t('inventoryPreview.sort') }}</button></div></slot>
      <div class="workspace"><div class="bag"><slot name="grid"><div class="item-grid"><button v-for="item in items" :key="item.id" :aria-label="`${item.name} × ${item.amount}`" :aria-pressed="selected?.id===item.id" @click="emit('select',item.id)"><span class="corners" aria-hidden="true"/><img :src="item.icon" alt=""><b>{{ item.amount }}</b></button></div><p v-if="!items.length">{{ t('inventoryPreview.empty') }}</p></slot></div><InventoryFidelityDetail v-if="selected" :item="selected" @use="emit('use',$event)"/></div>
      <!-- "X mon" counter: resource-pill chrome capsule anchored
           bottom-left of the interior, sharing the pagination row's
           baseline (owner ruling: counter uses resource-pill art;
           ref image 2 has it on the footer line, not its own row). -->
      <p class="count"><InkNineSlice chrome-id="resource-pill" layer="surface" /><span class="count__label"><slot name="count">{{ t('inventoryPreview.count', { n: items.length }) }}</slot></span></p>
    </div>

    <p v-if="preview" class="inventory-preview">{{ t('preview') }}</p>
    <p class="inventory-notice" role="status">{{ notice }}</p>
  </section>
</template>

<style scoped>
.inventory-scene{position:absolute;inset:0;pointer-events:auto;color:#4b3924;font-family:var(--font-display,Georgia,serif)}
.inventory-scene :deep(*){box-sizing:border-box}
.inventory-paper{position:absolute;left:94px;top:123px;width:1334px;height:633px;border:0 solid transparent;border-image-slice:300 fill;border-image-width:83px;filter:drop-shadow(0 12px 15px #0009)}
.inventory-title{position:absolute;left:235px;top:165px;margin:0;font-size:32px;font-weight:700;color:#35250f;text-shadow:0 1px #fff7} .inventory-divider{position:absolute;left:237px;top:179px;width:230px;object-fit:contain;opacity:.9}
/* Interior region: clears the nav-rail column on the left and the
   paper's decorative frame all around (same rect the preview surface
   exposes). */
.inventory-content{position:absolute;left:234px;top:227px;width:1143px;height:465px;display:flex;flex-direction:column}
.toolbar{display:flex;gap:12px;align-items:center;height:42px;margin-bottom:20px;flex:0 0 auto}
.toolbar nav{display:flex;gap:7px;margin-right:auto}
.toolbar button{background:transparent;border:0;border-bottom:3px solid transparent;color:#654d30;height:40px;padding:0 16px;font:700 17px var(--font-display,Georgia,serif);cursor:pointer}
.toolbar button[aria-pressed=true]{color:#285237;border-color:#967139}
.toolbar input{width:212px;height:36px;border:1px solid #8f744aaa;background:#f4e4bb66;padding:0 12px;color:#433421;font-size:13px}
.toolbar .sort{border:1px solid #8f744a;height:36px;padding:0 17px;font-size:14px}
/* Compact bag layout (owner ruling 2026-10-04, ref image 2): flex so
   the preview-only detail rail costs NO gap when absent, the bag
   fills the whole row, and the count capsule overlays the pagination
   baseline instead of owning a dead line. */
.workspace{display:flex;flex:1;min-height:0}
.workspace > :not(.bag){flex:0 0 auto;margin-left:26px}
/* No internal scrolling (BagGrid pattern: the grid must fit the
   column, cells sized so the visible rows stay inside the workspace) -
   the content box already keeps the count line clear of the paper's
   bottom decorative edge. */
.bag{flex:1;min-width:0;overflow:hidden;min-height:0}
.item-grid{display:grid;grid-template-columns:repeat(8,76px);gap:10px}
.item-grid button{position:relative;width:76px;height:76px;border:1px solid #a59158;background:radial-gradient(ellipse at 50% 40%,#385442,#0f251c 83%);box-shadow:inset 0 0 0 3px #06160f,0 2px 4px #43341d44;cursor:pointer}
.item-grid img{width:62px;height:62px;object-fit:contain;filter:drop-shadow(0 2px 5px #000)}
.item-grid b{position:absolute;bottom:3px;right:5px;color:#f7e9b9;font-size:12px;text-shadow:0 1px 3px #000}
.corners{position:absolute;inset:4px;border:1px solid #d0b67388;clip-path:polygon(0 0,20% 0,20% 6%,6% 6%,6% 20%,0 20%,0 0,100% 0,100% 20%,94% 20%,94% 6%,80% 6%,80% 0,100% 0,100% 100%,80% 100%,80% 94%,94% 94%,94% 80%,100% 80%,100% 100%,0 100%,0 80%,6% 80%,6% 94%,20% 94%,20% 100%,0 100%)}
.item-grid button[aria-pressed=true]{outline:2px solid #d3aa55;outline-offset:2px;filter:brightness(1.2)}
.item-grid button:hover{filter:brightness(1.2)}
.item-grid button:focus-visible,.toolbar button:focus-visible{outline:2px solid #806126;outline-offset:3px}
.count{position:absolute;left:0;bottom:0;margin:0;min-width:72px;height:30px;font-size:12px;color:#e8d9ae;text-align:center;line-height:30px}
.count .count__label{position:relative;z-index:2;padding:0 12px}
.inventory-preview{position:absolute;left:235px;top:713px;margin:0;font-size:10px;line-height:15px;color:#7d6a45}
.inventory-notice{position:absolute;left:700px;top:710px;width:675px;height:28px;margin:0;text-align:right;font-size:12px;color:#62512d}
</style>
