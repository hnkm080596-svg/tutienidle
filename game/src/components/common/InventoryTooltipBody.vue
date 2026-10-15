<script setup lang="ts">
import { computed } from 'vue'
import SlotView from './SlotView.vue'
import { i18n } from '@/i18n'
import { formatNumber } from '@/core/format/NumberFormatter'
import { isMaxRankTone } from '@/core/profession/slotRank'
import type { GradedItemTooltipContent } from '@/composables/useTooltip'

const props=defineProps<{content:GradedItemTooltipContent}>()
const pill=computed(()=>props.content.kind==='pill')
const titleStyle=computed(()=>!isMaxRankTone(props.content.nameTone) && props.content.nameColorVar ? {color:`var(${props.content.nameColorVar})`} : undefined)
const sections=computed(()=>props.content.sections.filter(section=>section.rows.length>0))
const hints=computed(()=>props.content.sections.filter(section=>section.rows.length===0))
const t=i18n.global.t
</script>
<template>
  <div class="inventory-tooltip" :class="{'inventory-tooltip--pill':pill}">
    <header class="inventory-tooltip__header">
      <SlotView class="inventory-tooltip__slot" v-bind="content.slotPreview ?? {icon:content.imagePath,label:content.name,variant:'bag'}" :item="{}" static />
      <div class="inventory-tooltip__identity">
        <span class="inventory-tooltip__kind">{{t(pill?'panels.bag.tabs.pill':'panels.bag.tabs.material')}}</span>
        <h2 class="inventory-tooltip__name" :class="{'inventory-tooltip__name--rainbow':isMaxRankTone(content.nameTone)}" :style="titleStyle">{{content.name}}</h2>
        <p v-if="content.gradeLine" class="inventory-tooltip__grade">{{content.gradeLine}}</p>
        <p v-if="content.gradeLabel" class="inventory-tooltip__grade">{{content.gradeLabel}}</p>
      </div>
    </header>
    <section v-if="!pill && content.description" class="inventory-tooltip__purpose">
      <h3>{{t('inventoryTooltip.purpose')}}</h3>
      <p>{{content.description}}</p>
    </section>
    <section v-for="section in sections" :key="section.label" class="inventory-tooltip__section">
      <h3>{{section.label}}</h3>
      <dl><div v-for="row in section.rows" :key="row.label" class="inventory-tooltip__row" :class="row.tone ? `inventory-tooltip__row--${row.tone}` : undefined">
        <dt>{{row.label}}</dt><dd :style="row.colorVar ? {color:`var(${row.colorVar})`} : undefined">{{row.value}}<small v-if="row.range"> {{row.range}}</small><small v-if="row.delta"> {{row.delta}}</small></dd>
        <p v-if="row.detail" class="inventory-tooltip__detail">{{row.detail}}</p>
      </div></dl>
    </section>
    <p v-if="pill && content.description" class="inventory-tooltip__description">{{content.description}}</p>
    <p v-for="hint in hints" :key="hint.label" class="inventory-tooltip__hint">{{hint.label}}</p>
    <footer v-if="(content.ownedCount ?? 0)>0" class="inventory-tooltip__owned">{{t('panels.bag.tooltip.owned',{count:formatNumber(content.ownedCount ?? 0)})}}</footer>
  </div>
</template>
<style scoped>
.inventory-tooltip { font:13px/1.45 var(--pc-font-body,Georgia,serif); color:#e5d8b9; }
.inventory-tooltip__header { display:flex; gap:12px; align-items:center; padding-bottom:12px; border-bottom:1px solid #ba95544d; }
.inventory-tooltip__slot { width:52px; height:52px; flex:0 0 52px; }
.inventory-tooltip__identity { min-width:0; }
.inventory-tooltip__kind { font-size:10px; color:#bba77c; letter-spacing:.06em; }
.inventory-tooltip__name { margin:2px 0 3px; font:700 17px/1.3 var(--pc-font-body,Georgia,serif); overflow-wrap:anywhere; color:#f3dfb0; }
.inventory-tooltip__name--rainbow { color:transparent; background:var(--rank-gradient-10); background-clip:text; -webkit-background-clip:text; }
.inventory-tooltip__grade { margin:0; font-size:11px; color:#c7b791; }
.inventory-tooltip h3 { margin:0 0 6px; font:700 11px/1.3 var(--pc-font-body,Georgia,serif); color:#d7b779; }
.inventory-tooltip__purpose { padding-top:12px; }
.inventory-tooltip__purpose p { margin:0; color:#e0d3b5; }
.inventory-tooltip__section { margin-top:12px; padding-top:10px; border-top:1px solid #ba955430; }
.inventory-tooltip dl { margin:0; }
.inventory-tooltip__row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:3px 12px; padding:3px 0; }
.inventory-tooltip dt { color:#bdae8b; }
.inventory-tooltip dd { margin:0; text-align:right; color:#efdfba; overflow-wrap:anywhere; }
.inventory-tooltip--pill dd { color:#bce0aa; font-weight:700; }
.inventory-tooltip__row--negative dd,.inventory-tooltip__row--warning dd { color:#dd987c; }
.inventory-tooltip__row small { font-weight:400; color:#b8a987; }
.inventory-tooltip__detail { grid-column:1/-1; margin:0; font-size:11px; color:#b8a987; }
.inventory-tooltip__description { margin:12px 0 0; font-size:12px; color:#c8b995; }
.inventory-tooltip__hint { margin:10px 0 0; font-size:11px; color:#ddc593; }
.inventory-tooltip__owned { margin-top:12px; padding-top:8px; border-top:1px solid #ba95544d; text-align:right; font-size:12px; color:#ddc593; font-variant-numeric:tabular-nums; }
</style>
