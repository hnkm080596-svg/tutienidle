<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GamePanel from '@/components/common/GamePanel.vue'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { useDialogFocus } from '@/composables/useDialogFocus'
import type { ArchitectureBuildingModel } from '@/core/game/ArchitectureReadModel'
import ArchitectureBuildingCard from './ArchitectureBuildingCard.vue'

type ProductionModel = ReturnType<typeof import('@/core/game/ArchitectureReadModel').getArchitectureProductionModels>[number]
const props=defineProps<{ buildings:readonly ArchitectureBuildingModel[]; productionSites:readonly ProductionModel[]; notice:string }>()
const emit=defineEmits<{ back:[]; upgradeBuilding:[id:string]; upgradeSite:[id:string] }>()
const { t }=useI18n()
const root=ref<HTMLElement|null>(null)
useDialogFocus(root,()=>true,{ onEscape:()=>emit('back') })
const artPath=(id:string)=>resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/architecture/${id}-background-v1.png`)
const entries=computed(()=> {
  const buildings=['equipment_hall','pill_room','teleport_array'].flatMap(id=>{
    const model=props.buildings.find(b=>b.id===id)
    return model ? [{model,art:artPath(id),site:false}] : []
  })
  const art={mine:'spirit-mine',forest:'blessed-forest',grotto:'herb-grotto'}
  const sites=['mine','forest','grotto'].flatMap(kind=>{
    const model=props.productionSites.find(s=>s.kind===kind)
    return model ? [{model,art:resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/production/${art[model.kind]}-v1.png`),site:true}] : []
  })
  return [...buildings,...sites]
})
function upgrade(entry:(typeof entries.value)[number]) {
  if (entry.site) emit('upgradeSite',entry.model.id)
  else emit('upgradeBuilding',entry.model.id)
}
</script>
<template>
  <SceneDesignCanvas overlay>
    <section ref="root" class="rail-panel-scene architecture-scene" :aria-label="t('architecture.title')">
      <GamePanel :title="t('architecture.title')">
        <div class="architecture-grid">
          <ArchitectureBuildingCard v-for="entry in entries" :key="entry.model.id" :model="entry.model" :art-url="entry.art" @upgrade="upgrade(entry)" />
        </div>
        <p v-if="notice" class="architecture-notice" role="status" aria-live="polite">{{ notice }}</p>
      </GamePanel>
    </section>
  </SceneDesignCanvas>
</template>
<style scoped>
.architecture-scene { position:absolute; inset:0; }
.architecture-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:repeat(2,minmax(0,1fr)); gap:10px; width:100%; height:100%; }
.architecture-notice { position:absolute; bottom:0; left:10px; right:10px; margin:0; padding:3px 8px; color:#f4dfac; background:#171b16eb; font-size:12px; text-align:center; pointer-events:none; z-index:3; }
</style>
