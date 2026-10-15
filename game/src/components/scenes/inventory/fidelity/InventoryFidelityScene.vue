<script setup lang="ts">
import GamePanel from '@/components/common/GamePanel.vue'
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
// InkNineSlice removed with the bottom count capsule (2026-10-11).
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

const paper = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')
const titleDivider = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/title-divider-clouds-v1.png')

// Same dialog contract the imperial scroll carried: focus/pointer stay
// inside the open surface and Escape closes through emit('back').
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })

// Title alignment landed (Minh dragged it on 2026-10-11): the glyph
// sits translate(124px, 4px) so its center reads over the cloud
// divider's knot - the machinery is gone now that the offset is baked.
</script>

<template>
  <section ref="rootRef" class="rail-panel-scene inventory-scene" :aria-label="t('panels.bag.title')" @click.self="emit('back')">
    <GamePanel :title="t('panels.bag.title')">
    
    

    <div class="inventory-content">
      <slot name="toolbar"><div class="toolbar"><nav><button v-for="id in filters" :key="id" :aria-pressed="filter===id" @click="emit('filter',id)">{{ t(`inventoryPreview.${id}`) }}</button></nav><input type="search" :value="query" :placeholder="t('inventoryPreview.search')" :aria-label="t('inventoryPreview.searchLabel')" @input="search"><button class="sort" @click="emit('sort')">{{ t('inventoryPreview.sort') }}</button></div></slot>
      <div class="workspace"><div class="bag"><slot name="grid"><div class="item-grid"><button v-for="item in items" :key="item.id" :aria-label="`${item.name} × ${item.amount}`" :aria-pressed="selected?.id===item.id" @click="emit('select',item.id)"><span class="corners" aria-hidden="true" /><img :src="item.icon" alt=""><b>{{ item.amount }}</b></button></div><p v-if="!items.length">{{ t('inventoryPreview.empty') }}</p></slot></div><InventoryFidelityDetail v-if="selected" :item="selected" @use="emit('use',$event)" /></div>
      <!-- Panel-level count removed (owner ruling 2026-10-11: the
           toolbar's "N loai" label inside the dark card is the single
           counter, matching the equipment bag's layout). -->
    </div>

    <p v-if="preview" class="inventory-preview">{{ t('preview') }}</p>
    <p class="inventory-notice" role="status">{{ notice }}</p>
    </GamePanel>
  </section>
</template>

<style scoped>
.inventory-scene{position:absolute;inset:0;color:#4b3924;font-family:var(--font-display,Georgia,serif)}
.inventory-scene :deep(*){box-sizing:border-box}
/* Sheet + head = .skill-sheet/.skill-head verbatim (shared redesigned
   band right of the nav rail, owner ruling: backdrop dong bo). */
.inventory-sheet{position:absolute;left:345px;top:101px;width:1065px;height:608px;background-color:#f2e4c8;background-size:cover;background-position:center;background-repeat:no-repeat;border:3px double #b28a43}
.inventory-head{position:absolute;left:372px;top:123px;width:1011px;height:61px;display:flex;align-items:flex-start;justify-content:flex-start;padding-left:54px;background:linear-gradient(#b28a43,#b28a43) left bottom/64px 1px no-repeat,linear-gradient(#b28a43,#b28a43) right bottom/calc(100% - 448px) 1px no-repeat}.inventory-head__title{display:flex;flex-direction:column;align-items:flex-start}.inventory-divider{width:388px;margin-top:0;object-fit:contain;opacity:.9;position:relative;top:-39px;left:8px;pointer-events:none}
:is(#app,body) .inventory-head h1{margin:0;padding:0;font-family:'UTM OngDoGia','Ma Shan Zheng','ZCOOL XiaoWei',var(--font-display,Georgia,serif);font-size:56px;font-style:normal;font-weight:400;line-height:58px;text-align:center;color:transparent;background:linear-gradient(100deg,#241a0c 20%,#6b5224 40%,#fff6d8 50%,#6b5224 60%,#241a0c 80%);background-size:220% 100%;background-position:0% 0;-webkit-background-clip:text;background-clip:text;animation:none;transform:translate(124px,4px)}
/* Interior region inside the shared sheet band - clears the head line
   and the paper's bottom decorative edge. */
/* Owner ruling 2026-10-11: the bag card must occupy the SAME stage
   rect as the equipment bag card (y215-691), only wider - NOT a
   proportional match. Content top 174 + toolbar h43 - 2px margin =
   card top 215; h517 lands the card bottom at 691. */
.inventory-content{position:absolute;left:372px;top:174px;width:1011px;height:517px;display:flex;flex-direction:column}
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
.inventory-preview{position:absolute;left:560px;top:719px;margin:0;font-size:10px;line-height:15px;color:#7d6a45}
.inventory-notice{position:absolute;left:900px;top:670px;width:480px;height:28px;margin:0;text-align:right;font-size:12px;color:#62512d}

/* Layout instances are relative to the owning panel content. */
.inventory-scene :deep(.game-panel__content :is(.inventory-sheet,.inventory-head)) { display: none; }
.inventory-scene :deep(.game-panel__content .inventory-content) { position: absolute; inset: 0; width: 100%; height: 100%; min-width: 0; min-height: 0; margin: 0; }
</style>
