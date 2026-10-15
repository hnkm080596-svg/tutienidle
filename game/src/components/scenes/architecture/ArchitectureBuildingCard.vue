<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameCard from '@/components/common/GameCard.vue'
import GameActionButton from '@/components/common/GameActionButton.vue'
import SlotView from '@/components/common/SlotView.vue'
import type { ArchitectureBuildingModel } from '@/core/game/ArchitectureReadModel'
import type { ArchitectureCost } from '@/core/game/ArchitectureReadModel'
import { GAME_MANAGER_KEY } from '@/composables/useGameState'
import { createMaterialTooltipBuilder } from '@/composables/useMaterialTooltip'

type ProductionModel=ReturnType<typeof import('@/core/game/ArchitectureReadModel').getArchitectureProductionModels>[number]
const props=defineProps<{ model:ArchitectureBuildingModel|ProductionModel; artUrl:string }>()
const emit=defineEmits<{ upgrade:[] }>()
const { t,locale }=useI18n()
const manager=inject(GAME_MANAGER_KEY,null)
const buildMaterialTooltip=createMaterialTooltipBuilder(t)
function costTooltip(cost:ArchitectureCost) {
  const extraRows=[{label:t('architecture.costs'),value:String(cost.required)}]
  return manager?.materialRegistry.has(cost.id)
    ? buildMaterialTooltip(manager.materialRegistry.get(cost.id),{owned:cost.owned,extraRows})
    : {title:cost.name,description:t('architecture.costAmount',{owned:cost.owned,required:cost.required})}
}
const hovered=ref(false)
const preview=computed(()=>hovered.value && props.model.canUpgrade)
const maxed=computed(()=> 'maxed' in props.model ? props.model.maxed : props.model.level >= props.model.maxLevel)
const name=computed(()=> 'kind' in props.model ? t(`panels.production.sourceNames.${props.model.kind}`) : props.model.id === 'gathering_outpost' ? t('panels.production.linMach.title') : props.model.name)
function value(amount:number,unit:string) {
  const n=new Intl.NumberFormat(locale.value,{maximumFractionDigits:2}).format(amount)
  return unit==='percent' ? `${n}%` : unit==='multiplier' ? `×${n}` : unit==='perMinute' ? `${n}/${t('architecture.minuteShort')}` : n
}
const current=computed(()=> {
  const m=props.model
  return 'currentEffects' in m ? m.currentEffects.map(e=>({key:e.key,label:t(`architecture.effects.${e.key}`),value:value(e.value,e.unit)})) : [{key:'speed',label:t('panels.production.speedSuffix'),value:value(m.currentSpeed,'multiplier')}]
})
const next=computed(()=> {
  const m=props.model
  return 'nextEffects' in m ? m.nextEffects.map(e=>({key:e.key,label:t(`architecture.effects.${e.key}`),value:value(e.value,e.unit)})) : m.nextSpeed === null ? [] : [{key:'speed',label:t('panels.production.speedSuffix'),value:value(m.nextSpeed,'multiplier')}]
})
</script>
<template>
  <GameCard as="article" class="architecture-card" :title="name" data-testid="architecture-building-card" :data-building-id="model.id">
    <template #viewport><div class="architecture-card__landscape" :style="{backgroundImage:`url('${artUrl}')`}" /></template>
    <div class="architecture-card__content">
      <div class="architecture-card__level">{{ t('architecture.level',{level:model.level,max:model.maxLevel}) }}</div>
      <div class="architecture-card__effects" :class="{'is-preview':preview}">
        <section><h3>{{ t('architecture.current') }}</h3><ul><li v-for="e in current" :key="e.key"><span>{{ e.label }}</span><strong>{{ e.value }}</strong></li></ul><p v-if="!current.length">{{ t('architecture.noEffect') }}</p></section>
        <span v-if="preview" class="architecture-card__arrow" aria-hidden="true">⇒</span>
        <section v-if="preview"><h3>{{ t('architecture.next') }} · {{ model.level+1 }}</h3><ul><li v-for="e in next" :key="e.key"><span>{{ e.label }}</span><strong>{{ e.value }}</strong></li></ul></section>
      </div>
      <div class="architecture-card__costs" :aria-label="t('architecture.costs')">
        <div v-for="cost in model.costs" :key="cost.id" :class="{'is-missing':cost.owned<cost.required}">
          <SlotView class="architecture-card__cost-slot" static static-tooltip variant="preview" :item="null" :icon="cost.icon" :label="cost.name" :tooltip="costTooltip(cost)" />
          <span>{{ t('architecture.costAmount',{owned:cost.owned,required:cost.required}) }}</span>
        </div>
      </div>
      <div class="architecture-card__actions" v-tooltip="!maxed && !model.canUpgrade ? {title:t('architecture.upgrade'),description:'reason' in model && model.reason ? t(`architecture.reasons.${model.reason}`) : 'reasons' in model ? model.reasons.map(reason=>t(`architecture.productionReasons.${reason}`)).join('\n') : ''} : undefined">
        <GameActionButton v-if="!maxed" class="architecture-card__upgrade" :class="{'is-unavailable':!model.canUpgrade}" :gold="model.canUpgrade" @mouseenter="hovered=true" @mouseleave="hovered=false" @click="emit('upgrade')">{{t('architecture.upgrade')}}</GameActionButton>
        <span v-else>{{t('architecture.maximum')}}</span>
      </div>
    </div>
  </GameCard>
</template>
<style scoped>
.architecture-card__upgrade.is-unavailable { opacity: .55; }
.architecture-card { min-width:0; min-height:0; margin-top:12px; height:calc(100% - 12px); display:flex; flex-direction:column; }
.architecture-card__landscape { position:absolute; inset:0; background:center/cover no-repeat; opacity:.8; }
.architecture-card__landscape::after { content:''; position:absolute; inset:0; background:linear-gradient(rgba(7,12,10,.15),rgba(7,12,10,.85) 65%); }
.architecture-card__content { position:relative; z-index:1; min-height:0; flex:1; display:grid; grid-template-rows:24px minmax(0,1fr) 48px 38px; gap:8px; color:#eadbb9; text-shadow:0 1px 3px #000; }
.architecture-card__level { font-size:13px; text-align:center; display:grid; place-items:center; }
.architecture-card__effects { flex:1; min-height:40px; display:grid; grid-template-columns:1fr; align-content:center; }
.architecture-card__effects.is-preview { grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr); gap:4px; }
.architecture-card__effects h3 { font-size:11px; margin:0 0 3px; color:#e9c77d; }
.architecture-card__effects ul { padding:0; margin:0; list-style:none; }
.architecture-card__effects li { font-size:11px; display:flex; justify-content:space-between; gap:4px; }
.architecture-card__effects strong { color:#b9dcab; white-space:nowrap; }
.architecture-card__effects p { margin:0; font-size:11px; }
.architecture-card__arrow { align-self:center; color:#e9c77d; }
.architecture-card__costs { display:flex; gap:12px; align-items:center; justify-content:center; }
.architecture-card__costs > div { display:grid; justify-items:center; gap:3px; min-width:0; font-size:10px; }
.architecture-card__cost-slot { width:32px; height:32px; }
.architecture-card__costs .is-missing { color:#dd947b; }
.architecture-card__actions { display:flex; justify-content:center; align-items:center; font-size:12px; }
.architecture-card__actions .game-action-button { width:160px; height:32px; font-size:14px; }
</style>
