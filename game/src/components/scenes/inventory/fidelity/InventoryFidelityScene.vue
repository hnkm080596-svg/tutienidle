<script setup lang="ts">
// Scene 09 (Tui Do / inventory) content region for the imperial scroll:
// toolbar tabs | bag grid | detail rail | count. The fixture internals
// stay as slot fallbacks for the preview; production mounts the real
// bag sections + canonical tab state through #toolbar/#grid/#count.
import { useI18n } from 'vue-i18n'
import type { InventoryDisplay } from './inventoryUi'
import InventoryFidelityDetail from './InventoryFidelityDetail.vue'
defineProps<{ items: readonly InventoryDisplay[]; selected?: InventoryDisplay; filter: string; query: string }>()
const emit = defineEmits<{ select: [id: string]; filter: [id: string]; query: [value: string]; sort: []; use: [id: string] }>()
const { t } = useI18n()
const filters = ['all', 'equipment', 'material', 'pill']
function search(event: Event) { if (event.target instanceof HTMLInputElement) emit('query', event.target.value) }
</script>
<template><div class="inventory-scene">
  <slot name="toolbar"><div class="toolbar"><nav><button v-for="id in filters" :key="id" :aria-pressed="filter===id" @click="emit('filter',id)">{{ t(`inventoryPreview.${id}`) }}</button></nav><input type="search" :value="query" :placeholder="t('inventoryPreview.search')" :aria-label="t('inventoryPreview.searchLabel')" @input="search"><button class="sort" @click="emit('sort')">{{ t('inventoryPreview.sort') }}</button></div></slot>
  <div class="workspace"><div class="bag"><slot name="grid"><div class="item-grid"><button v-for="item in items" :key="item.id" :aria-label="`${item.name} × ${item.amount}`" :aria-pressed="selected?.id===item.id" @click="emit('select',item.id)"><span class="corners" aria-hidden="true"/><img :src="item.icon" alt=""><b>{{ item.amount }}</b></button></div><p v-if="!items.length">{{ t('inventoryPreview.empty') }}</p></slot></div><InventoryFidelityDetail v-if="selected" :item="selected" @use="emit('use',$event)"/></div>
  <p class="count"><slot name="count">{{ t('inventoryPreview.count', { n: items.length }) }}</slot></p>
</div></template>
<style scoped>
.inventory-scene{height:100%;display:flex;flex-direction:column;color:#4b3924;font-family:var(--font-display,Georgia,serif)}
.toolbar{display:flex;gap:12px;align-items:center;height:42px;margin-bottom:20px}
.toolbar nav{display:flex;gap:7px;margin-right:auto}
.toolbar button{background:transparent;border:0;border-bottom:3px solid transparent;color:#654d30;height:40px;padding:0 16px;font:700 17px var(--font-display,Georgia,serif);cursor:pointer}
.toolbar button[aria-pressed=true]{color:#285237;border-color:#967139}
.toolbar input{width:212px;height:36px;border:1px solid #8f744aaa;background:#f4e4bb66;padding:0 12px;color:#433421;font-size:13px}
.toolbar .sort{border:1px solid #8f744a;height:36px;padding:0 17px;font-size:14px}
.workspace{display:grid;grid-template-columns:1fr auto;gap:26px;flex:1;min-height:0}
/* No internal scrolling (BagGrid pattern: the grid must fit the
   column, cells sized so 4 rows stay inside the workspace) - and the
   count line keeps ~30px off the paper's bottom decorative edge so the
   scene sits inside the sheet like the other tabs. */
.bag{overflow:hidden;padding:5px 9px 5px 3px;border-right:1px solid #97794655;min-height:0}
.item-grid{display:grid;grid-template-columns:repeat(8,76px);gap:10px}
.item-grid button{position:relative;width:76px;height:76px;border:1px solid #a59158;background:radial-gradient(ellipse at 50% 40%,#385442,#0f251c 83%);box-shadow:inset 0 0 0 3px #06160f,0 2px 4px #43341d44;cursor:pointer}
.item-grid img{width:62px;height:62px;object-fit:contain;filter:drop-shadow(0 2px 5px #000)}
.item-grid b{position:absolute;bottom:3px;right:5px;color:#f7e9b9;font-size:12px;text-shadow:0 1px 3px #000}
.corners{position:absolute;inset:4px;border:1px solid #d0b67388;clip-path:polygon(0 0,20% 0,20% 6%,6% 6%,6% 20%,0 20%,0 0,100% 0,100% 20%,94% 20%,94% 6%,80% 6%,80% 0,100% 0,100% 100%,80% 100%,80% 94%,94% 94%,94% 80%,100% 80%,100% 100%,0 100%,0 80%,6% 80%,6% 94%,20% 94%,20% 100%,0 100%)}
.item-grid button[aria-pressed=true]{outline:2px solid #d3aa55;outline-offset:2px;filter:brightness(1.2)}
.item-grid button:hover{filter:brightness(1.2)}
.item-grid button:focus-visible,.toolbar button:focus-visible{outline:2px solid #806126;outline-offset:3px}
.count{font-size:12px;margin:10px 0 30px}
</style>
