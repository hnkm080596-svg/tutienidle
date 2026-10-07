<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { pcPaperIconUrl } from '@/presentation/assets/PcPaperIcons'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'

const { t } = useI18n()
const stats = ['vitality','strength','dexterity','attunement','intelligence']
const values = [18,30,16,20,14]
const colors = ['#b98a3f','#b54432','#3f9e6f','#4a8fc4','#7a6fc4']
const groups = [{id:'basic',rows:['hp','mana','attack','defense']},{id:'combat',rows:['critical','speed','accuracy','dodge','reduction']},{id:'other',rows:['regen']}]
const numbers: Record<string,string> = {hp:'2.480',mana:'860',attack:'320',defense:'280',critical:'12%',speed:'520',accuracy:'105',dodge:'96',reduction:'6%',regen:'24'}
const root = '/assets/ui/tien-hiep-2026-10/'
const style = {'--character-paper': `url('${resolveAssetUrl(root+'source/shared-paper-page-v1.png')}')`, '--character-card': `url('${resolveAssetUrl(root+'controls/character-card-nine-slice-v2.png')}')`}
const hero = resolveAssetUrl('/assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png')
</script>
<template>
<section class="home-character-panel" :style="style" data-testid="home-character-panel">

<header><h1>{{ t('character') }}</h1></header>
<div class="character-panel-content">
<section class="character-portrait"><h2>{{ t('sampleName') }}</h2><p>{{ t('identity') }}</p><img :src="hero" alt=""><div class="character-card character-power"><h3>{{ t('power') }}</h3><b>125.680</b></div></section>
<section class="character-central">
<div class="character-card character-mainstats"><h2>{{ t('mainStats') }}</h2><p>{{ t('points') }}</p><div v-for="(stat,i) in stats" :key="stat" class="character-stat-row"><span>{{ t(stat) }}</span><b>{{ values[i] }} <small v-if="values[i]===30">MAX</small></b><span class="character-stat-tube"><i :style="{width: `${values[i]!/30*100}%`,background:colors[i]}" /></span><button :disabled="values[i]===30" :aria-label="t(stat)" class="character-allocate"><img :src="resolveAssetUrl(root+'controls/attribute-plus-v2.png')" alt=""></button></div></div>
<div class="character-card character-small-card"><h2>{{ t('talent') }}</h2><img :src="pcPaperIconUrl('body-arm')" alt=""><span>{{ t('talentName1') }}</span></div>
<div class="character-card character-small-card"><h2>{{ t('elements') }}</h2><span class="character-element" v-for="element in ['metal','wood','water','fire','earth']" :key="element"><img :src="resolveAssetUrl(root+'icons/element-'+element+'-ivory-v1.png')" :alt="t(element)"><b>15</b></span></div>
</section>
<aside class="character-detail-scroll" data-testid="character-detail-scroll"><section v-for="group in groups" :key="group.id" class="character-card character-detail-card"><h2>{{ t(group.id) }}</h2><dl class="character-card-scroll"><div v-for="row in group.rows" :key="row"><dt>{{ t(row) }}</dt><dd>{{ numbers[row] }}</dd></div></dl></section></aside>
</div>
</section>
</template>
<style scoped>
.home-character-panel { position:absolute; left:24%;top:12.5%;width:74%;height:75%;z-index:20;padding:20px 24px 22px 24px;background:#f2e4c8 var(--character-paper) center/cover;border:3px double #b28a43;color:#302519;overflow:hidden; }
.character-icon-tree { position:absolute;left:7px;top:12px;bottom:12px;width:57px;display:grid;grid-template-columns:repeat(2,1fr);align-content:space-between;gap:3px; }
.character-icon-tree button { width:27px;height:42px;padding:4px;border:1px solid #af8c48;background:#252a22;cursor:pointer; }.character-icon-tree button.active {background:#a27d35;}.character-icon-tree img {width:100%;height:100%;object-fit:contain;}
header {height:61px;border-bottom:1px solid #b28a43;display:flex;align-items:flex-start;justify-content:space-between;}h1 {font-size:38px;margin:0;} .character-back {border:1px solid #b28a43;background:#ead8b4;font:30px var(--pc-font-body);cursor:pointer;width:36px;}
.character-panel-content {display:grid;grid-template-columns:28% 39% 1fr;gap:14px;height:calc(100% - 72px);margin-top:11px;min-height:0;}
.character-card {position:relative;isolation:isolate;background:transparent;border:0;color:#f0dfbb;padding:13px 16px;}
.character-card::before {content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;border:15px solid transparent;border-image:var(--character-card) 90 fill / 15px stretch;}
.character-card h2 {font-size:19px;margin:0 0 9px;padding-bottom:7px;border-bottom:1px solid #9d8049;} .character-portrait {position:relative;text-align:center;min-height:0;}.character-portrait h2 {font-size:24px;margin:0;}.character-portrait p {font-size:15px;margin:6px;}.character-portrait>img {height:73%;width:100%;object-fit:contain;}.character-power {position:absolute;bottom:0;left:0;right:0;}.character-power h3 {margin:0;font-size:16px;}.character-power b {font-size:29px;color:#dfbc71;}
.character-central {display:grid;grid-template-rows:minmax(0,1fr) 75px 75px;gap:9px;min-height:0;}.character-mainstats>p {font-size:13px;margin:0 0 9px;}.character-stat-row {position:relative;display:grid;grid-template-columns:1fr auto 39px;gap:3px 8px;padding:3px 0;font-size:15px;line-height:1.2;height:40px;}.character-stat-row b {font-size:15px;}.character-stat-row small {font-size:9px;color:#edcd7e;}.character-stat-row button {grid-column:3;grid-row:1/3;background:#59462b;border:1px solid #b09250;color:#f0dfbb;}.character-stat-tube {grid-column:1/3;height:9px;border:1px solid #927747;border-radius:9px;background:#111912;overflow:hidden;box-shadow:inset 0 2px 3px #0009;}.character-stat-tube i {display:block;height:100%;border-radius:7px;box-shadow:inset 0 2px 2px #fff5;}
.character-small-card {padding:9px 15px;font-size:13px;}.character-small-card h2 {font-size:16px;margin-bottom:5px;padding-bottom:3px;}.character-small-card img {height:24px;width:24px;object-fit:contain;vertical-align:middle;margin-right:12px;}
.character-detail-scroll {min-height:0;overflow:hidden;display:grid;grid-template-rows:repeat(3,minmax(0,1fr));gap:12px;}.character-detail-scroll::-webkit-scrollbar {display:none;}.character-detail-card {margin:0;min-height:0;display:flex;flex-direction:column;}.character-card-scroll {min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;}.character-card-scroll::-webkit-scrollbar {display:none;}.character-detail-card dl {margin:0;}.character-detail-card dl>div {display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #a98b4230;font-size:14px;}.character-detail-card dd {margin:0;}
.character-stat-tube i {position:relative;overflow:hidden;}
.character-stat-tube i::after {content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 10%,#ffffff18 30%,#fff8 48%,#ffffff20 60%,transparent 80%);width:60%;transform:translateX(-160%);animation:stat-energy-flow 2.8s linear infinite;}
.character-stat-row:nth-of-type(2) .character-stat-tube i::after {animation-delay:-.7s;}.character-stat-row:nth-of-type(3) .character-stat-tube i::after {animation-delay:-1.4s;}.character-stat-row:nth-of-type(4) .character-stat-tube i::after {animation-delay:-2.1s;}
@keyframes stat-energy-flow {to {transform:translateX(270%);}}
@media (prefers-reduced-motion:reduce) {.character-stat-tube i::after {animation:none;transform:translateX(65%);opacity:.3;}}
.character-stat-row .character-allocate {position:relative;z-index:1;width:39px;height:39px;padding:0;border:0;background:transparent;align-self:center;cursor:pointer;}.character-allocate img {width:100%;height:100%;object-fit:contain;}.character-allocate:not(:disabled):hover img {filter:brightness(1.18) drop-shadow(0 0 3px #e8b657);}.character-allocate:not(:disabled):active img {filter:brightness(.88);transform:translateY(1px);}.character-allocate:disabled img {opacity:.45;filter:saturate(.4);}
.character-element {display:inline-flex;align-items:center;gap:4px;margin-right:9px;}.character-small-card .character-element img {width:27px;height:27px;margin:0;}.character-element b {font-size:13px;}</style>











