<script setup lang="ts">
import QuestObjectiveArt from './QuestObjectiveArt.vue'
import QuestCategoryArtButton from './QuestCategoryArtButton.vue'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import EquipmentArtCard from './equipment/EquipmentArtCard.vue'
import EquipmentArtButton from './equipment/EquipmentArtButton.vue'
import EquipmentArtSlot from './equipment/EquipmentArtSlot.vue'
import EquipmentEnergyTube from './equipment/EquipmentEnergyTube.vue'
const { t } = useI18n()
const group = shallowRef(0), selected = shallowRef(0), notice = shallowRef('')
const amounts = ['9 / 10','1 / 1','3 / 5','12 / 20','0 / 1','0 / 1']
const fills = [90,100,60,60,0,0]
const icons = ['quest','alchemy','production','feedback','exploration']
const art = '/assets/ui/tien-hiep-2026-10/'
const pictures = [art+'source/world-vista-warm-v1.png',art+'realm/landscape-1-v1.png',art+'realm/meditation-v1.png','/assets/materials/linh_moc.png',art+'realm/landscape-2-v1.png','/assets/ui/huyen-kim/alchemy/alchemy-cauldron-prop@2x.png']
const rewards = [art+'controls/resource-crystal-v1.png',art+'controls/resource-essence-v1.png',art+'controls/resource-coin-v1.png','/assets/pills/tu_linh_dan.png']
const currentFill = computed(()=>fills[selected.value] ?? 0)
function chooseGroup(index:number) { group.value=index;notice.value='' }
function chooseQuest(index:number) { selected.value=index;notice.value='' }
</script>
<template>
<section class="home-quest-art" data-testid="home-quest-panel">
 <header><h1>{{ t('qp.title') }}</h1><p>{{ t('qp.intro') }}</p></header>
 <div class="quest-columns">
  <nav class="quest-groups"><QuestCategoryArtButton v-for="(icon,index) in icons" :key="icon" :icon="art+'icons/navigation-'+icon+'-v2.png'" :label="t('qp.groups.'+index)" :hint="t('qp.hints.'+index)" :selected="group===index" @click="chooseGroup(index)" /></nav>
  <EquipmentArtCard class="quest-list"><h2>{{ t('qp.list') }}</h2><div class="quest-list-scroll"><button v-for="(amount,index) in amounts" :key="index" :class="{selected:selected===index}" @click="chooseQuest(index)"><img :src="pictures[index]" alt=""><div><h3>{{ t('qp.names.'+index) }}</h3><p>{{ t('qp.summary') }}</p><div class="quest-progress"><EquipmentEnergyTube :fill="fills[index] ?? 0" color="#e7bb62"/><span>{{ amount }}</span></div></div><small :class="{complete:index===1}">{{ t(index===1?'qp.complete':index>3?'qp.pending':'qp.doing') }}</small></button></div></EquipmentArtCard>
  <EquipmentArtCard class="quest-details"><div class="quest-banner" :style="{backgroundImage:`url('${pictures[selected]}')`}"><h2>{{ t('qp.names.'+selected) }}</h2><p>{{ t('qp.groups.'+group) }}</p></div><p class="quest-description">{{ t('qp.description') }}</p><h3>{{ t('qp.objective') }}</h3><QuestObjectiveArt v-for="index in 3" :key="index" :done="index < 3" :label="t('qp.objectives.'+(index-1))" :amount="index < 3?'1 / 1':'1 / 3'" /><h3>{{ t('qp.progress') }}</h3><div class="quest-progress"><EquipmentEnergyTube :fill="currentFill" color="#e7bb62"/><span>{{ amounts[selected] }}</span></div><h3>{{ t('qp.rewards') }}</h3><div class="quest-rewards"><div v-for="(icon,index) in rewards" :key="icon"><EquipmentArtSlot :icon="icon" :label="t('qp.rewardNames.'+index)"/><small>×{{ [500,300,50,1][index] }}</small></div></div><EquipmentArtButton gold @click="notice=t('qp.notice')">{{ t('qp.claim') }}</EquipmentArtButton><small role="status">{{ notice }}</small></EquipmentArtCard>
 </div>
</section>
</template>
<style scoped>
.home-quest-art{position:absolute;left:24%;top:12.5%;width:74%;height:75%;z-index:20;box-sizing:border-box;padding:12px 22px 18px;background:#f2e4c8 url('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png') center/cover;border:3px double #b28a43;color:#efdfb9;}
header{position:relative;inset:auto;height:75px;color:#30271b;border-bottom:1px solid #b28a4370;}header h1{margin:0;font:700 38px/1.15 var(--pc-font-body);}header p{margin:7px 0;font-size:14px;font-style:italic;}
.quest-columns{height:calc(100% - 88px);padding-top:13px;display:grid;grid-template-columns:19% 43% minmax(0,1fr);gap:12px;}.quest-groups{display:flex;flex-direction:column;gap:16px;padding-top:12px;}.quest-groups button{position:relative;isolation:isolate;display:flex;align-items:center;gap:7px;height:65px;border:0;background:url('/assets/ui/tien-hiep-2026-10/controls/navigation-medallion-v1.png') center/100% 100% no-repeat;color:#f0dfb9;cursor:pointer;padding:5px;}.quest-groups button.selected{filter:brightness(1.22) drop-shadow(0 0 4px #dfa947);}.quest-groups img{width:42px;height:42px;object-fit:contain;}.quest-groups span{text-align:left;}.quest-groups b{display:block;font:700 17px var(--pc-font-body);}.quest-groups small{font-size:10px;}
.quest-list,.quest-details{min-height:0;display:flex;flex-direction:column;gap:8px;}h2{font-size:18px;margin:0;}h3{font-size:15px;margin:0;}.quest-list-scroll{overflow-y:auto;scrollbar-width:none;flex:1;}.quest-list-scroll::-webkit-scrollbar{display:none;}.quest-list-scroll>button{width:100%;display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:7px;color:#efdfb9;border:1px solid #947444;background:#15171550;text-align:left;cursor:pointer;}.quest-list-scroll>button.selected{border-color:#f5ce78;box-shadow:inset 0 0 8px #e1a94370,0 0 4px #e1a94380;}.quest-list-scroll img{width:64px;height:64px;object-fit:cover;border:1px solid #ad8a46;}.quest-list-scroll>button>div{flex:1;min-width:0;}.quest-list-scroll h3{font-size:16px;}.quest-list-scroll p{font-size:11px;margin:5px 0;}.quest-list-scroll>button>small{font-size:10px;border:1px solid #947444;padding:4px;white-space:nowrap;}.quest-list-scroll .complete{color:#9ccc82;}.quest-progress{display:flex;align-items:center;gap:9px;font-size:11px;}.quest-progress>span:last-child{white-space:nowrap;}.quest-banner{height:98px;flex:none;background-position:center;background-size:cover;display:flex;flex-direction:column;justify-content:end;padding:8px;box-sizing:border-box;position:relative;isolation:isolate;}.quest-banner:before{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(transparent,#141511e8);}.quest-banner p{font-size:12px;margin:3px 0;}.quest-description{font-size:12px;line-height:1.4;margin:0;}.quest-details>h3{border-bottom:1px solid #b18a4660;padding-bottom:4px;}.quest-objective{display:flex;align-items:center;gap:6px;font-size:11px;}.quest-objective i{font-style:normal;color:#e8bb63;font-size:18px;}.quest-objective .done{color:#8ace83;}.quest-objective small{margin-left:auto;white-space:nowrap;}.quest-rewards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;}.quest-rewards>div{position:relative;}.quest-rewards small{position:absolute;bottom:5px;right:5px;font-size:10px;}.quest-rewards :deep(button){width:100%;aspect-ratio:1;}.quest-details>.equipment-art-button{margin-top:auto;flex:none;min-height:38px;}.quest-details>[role=status]{font-size:10px;min-height:12px;}
.quest-details{gap:5px;overflow:hidden;}.quest-banner{height:78px;}.quest-description{font-size:11px;}.quest-details>h3{font-size:14px;}.quest-rewards{max-height:65px;flex:none;}.quest-rewards :deep(button){max-height:65px;}.quest-details>.equipment-art-button{height:35px;min-height:35px;margin-top:3px;}.quest-list-scroll>button:hover{border-color:#d2af66;box-shadow:inset 0 0 7px #d5a35230;}.quest-list-scroll>button:active{filter:brightness(.9);}.quest-list-scroll h3{font-family:var(--pc-font-body);}
</style>


