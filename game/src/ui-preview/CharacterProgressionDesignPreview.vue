<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import PcPaperScene from '@/components/common/PcPaperScene.vue'
import PcPaperTabs from '@/components/common/PcPaperTabs.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import PcBodyDiagram from '@/components/common/PcBodyDiagram.vue'
import PcPaperLock from '@/components/common/PcPaperLock.vue'

import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { pcPaperIconUrl } from '@/presentation/assets/PcPaperIcons'

const { t } = useI18n()
const options = ['character', 'creation', 'technique', 'meridian', 'zhou']
const requested = new URLSearchParams(window.location.search).get('example')
const example = requested && options.includes(requested) ? requested : 'character'
const selected = shallowRef(example === 'meridian' || example === 'zhou' ? example : 'basic')
const talent = shallowRef(1)
const tabs = computed(() => (example === 'meridian' || example === 'zhou' ? ['body', 'meridian', 'zhou'] : example === 'character' ? ['basic', 'combat', 'other'] : []).map(id => ({ id, label: t(id) })))
const title = computed(() => t(example === 'meridian' || example === 'zhou' ? 'body' : example))
const hero = resolveAssetUrl('/assets/characters/player/mortal/player-mortal-ink-sword-concept-v2.png')
const ore = resolveAssetUrl('/assets/materials/linh_khoang.png')
const herb = resolveAssetUrl('/assets/materials/herbs/tu_linh_thao/decade.png')
const pill = resolveAssetUrl('/assets/pills/khai_linh_dan.png')
const manual = resolveAssetUrl('/assets/ui/huyen-kim/scene/technique-v2/temporary-manual-v1.png')
const statNames = ['vitality', 'strength', 'dexterity', 'attunement', 'intelligence']
const detailNames = ['hp', 'attack', 'defense', 'mana', 'critical', 'speed', 'accuracy', 'dodge', 'regen', 'reduction']
const elementNames = ['fire', 'wood', 'water', 'earth', 'metal']
const cycleNodes = Array.from({ length: 36 }, (_, index) => ({ x: 50 + Math.cos((index / 36 - .25) * Math.PI * 2) * 42, y: 45 + Math.sin((index / 36 - .25) * Math.PI * 2) * 41 }))
const elementArt = (name: string) => resolveAssetUrl(`/assets/ui/elements/el-${name}.png`)
</script>

<template>
  <SceneDesignCanvas><PcPaperScene :title="title" :data-character-design="example">
    <template #tabs><PcPaperTabs v-if="tabs.length" :items="tabs" :selected="selected" :label="t('tabs')" @select="selected = $event" /></template>
    <div v-if="example === 'character'" class="cp-character">
      <section class="cp-identity"><h2>{{ t('sampleName') }}</h2><p>{{ t('identity') }}</p><div class="cp-hero-ring" /><img class="cp-hero" :src="hero" alt=""><p class="cp-path"><img :src="pcPaperIconUrl('technique')" alt="">{{ t('pathway') }} · {{ t('swordPath') }}</p><div class="pc-paper-inspector cp-power"><h3>{{ t('power') }}</h3><b>125.680</b></div></section>
      <section class="cp-character-center"><div class="pc-paper-inspector cp-stats"><h2>{{ t('mainStats') }}</h2><p>{{ t('points') }}</p><dl><div v-for="(name,index) in statNames" :key="name"><dt>{{ t(name) }}</dt><dd>{{ [18,25,16,20,14][index] }}<button type="button" :aria-label="t(name)">+</button></dd></div></dl></div><div class="pc-paper-inspector cp-talents"><h2>{{ t('talent') }}</h2><div><span v-for="n in 3" :key="n"><img v-if="n === 1" :src="pcPaperIconUrl('body-arm')" alt=""><PcPaperLock v-else /><b>{{ t(n === 1 ? 'talentName1' : 'unopened') }}</b></span></div></div><div class="pc-paper-inspector cp-elements"><h2>{{ t('elements') }}</h2><div><span v-for="name in elementNames" :key="name"><img :src="elementArt(name)" alt=""><b>{{ t(name) }}</b><small>15</small></span></div></div></section>
      <aside class="pc-paper-inspector cp-character-details"><h2>{{ t('details') }}</h2><dl><div v-for="(name,index) in detailNames" :key="name"><dt>{{ t(name) }}</dt><dd>{{ ['2.480','320','280','860','12%','520','105','96','24','6%'][index] }}</dd></div></dl></aside>
    </div>
    <section v-else-if="example === 'creation'" class="cp-creation"><p class="cp-creation-intro">{{ t('creationIntro') }}</p><div class="cp-creation-name"><label for="design-name">{{ t('name') }}</label><input id="design-name" :placeholder="t('enterName')" :value="t('sampleName')"></div><h2>{{ t('choosePath') }}</h2><div class="cp-path-choices"><article v-for="(name,index) in ['swordPath','spellPath','bodyPath']" :key="name" :class="{ selected: index === 0 }"><img :src="pcPaperIconUrl(index === 0 ? 'equipment' : index === 1 ? 'skill' : 'body-arm')" alt=""><h3>{{ t(name) }}</h3><small>{{ t(`pathDescription${index + 1}`) }}</small></article></div><div class="cp-creation-talent-heading"><h2>{{ t('chooseTalent') }}</h2><PcPaperButton variant="secondary">{{ t('reroll') }}</PcPaperButton></div><div class="cp-talent-choices"><button v-for="n in 3" :key="n" :class="{ selected: talent === n }" @click="talent = n"><img :src="pcPaperIconUrl(n === 1 ? 'body-arm' : n === 2 ? 'body-flame' : 'body-brain')" alt=""><div><h3>{{ t(`talentName${n}`) }}</h3><p>{{ t(`talentDescription${n}`) }}</p></div></button></div><div class="cp-creation-actions"><PcPaperButton variant="secondary">{{ t('back') }}</PcPaperButton><PcPaperButton>{{ t('begin') }}</PcPaperButton></div></section>
    <div v-else-if="example === 'technique'" class="cp-technique"><nav class="cp-technique-catalog"><h2>{{ t('catalog') }}</h2><button v-for="(name,index) in ['manual','manual2','manual3']" :key="name" :class="{ selected: index === 0 }"><img :src="manual" alt=""><b>{{ t(name) }}</b><small>{{ t('grade') }} · Lv.1</small></button></nav><section class="cp-technique-art"><div class="cp-hero-ring" /><img :src="manual" alt=""><h2>{{ t('manual') }}</h2><p>{{ t('grade') }} · Lv.1</p></section><aside class="pc-paper-inspector cp-progression-inspector"><h2>{{ t('manual') }}</h2><p>{{ t('manualDescription') }}</p><h3>{{ t('effects') }}</h3><div class="cp-compare-heading"><b>{{ t('current') }}</b><b>{{ t('next') }}</b></div><dl><div v-for="(name,index) in ['hp','attack','defense','mana']" :key="name"><dt>{{ t(name) }}</dt><dd>{{ ['+120','+12','+10','+30'][index] }} <strong>» {{ ['+160','+16','+14','+40'][index] }}</strong></dd></div></dl><h3>{{ t('costs') }}</h3><div class="cp-materials"><span class="pc-paper-slot"><img :src="ore" alt=""></span><span>{{ t('stone') }}<b>12/5</b></span><span class="pc-paper-slot"><img :src="herb" alt=""></span><span>{{ t('herb') }}<b>3/2</b></span></div><PcPaperButton>{{ t('upgrade') }}</PcPaperButton></aside></div>
    <div v-else class="cp-body-scene"><section class="cp-body-figure" :class="{ 'cp-body-figure--cycle': example === 'zhou' }"><PcBodyDiagram class="cp-body-diagram" /><template v-if="example === 'meridian'"><div v-for="(name,index) in ['ren','du','yin']" :key="name" class="cp-meridian-mark" :class="{ active: index === 2 }" :style="{ left: index === 0 ? '1%' : '79%', top: index === 2 ? '45%' : '7%' }"><span><svg viewBox="0 0 50 70" fill="none" aria-hidden="true"><path :d="index === 0 ? 'M25 5V65M25 7C0 20 50 24 25 36C0 47 50 51 25 63' : index === 1 ? 'M25 7V62M5 35Q25 15 45 35Q25 55 5 35M25 15Q10 35 25 55Q40 35 25 15' : 'M16 7Q40 25 20 36Q0 45 30 63M28 7Q5 25 29 36Q50 45 18 63'" stroke="#f0cb7b" stroke-width="2" /></svg></span><h3>{{ t(name) }}</h3><b>{{ t(index === 2 ? 'nextMeridian' : 'opened') }}</b></div><div class="cp-body-caption"><h2>{{ t('meridianTitle') }}</h2><div class="cp-progress-bar"><span style="width:25%" /></div><p>{{ t('meridianSummary') }}</p></div></template><template v-else><div class="cp-cycle-milestones"><div v-for="(name,index) in ['capacity','smallCycle','largeCycle']" :key="name"><img :src="pcPaperIconUrl(index === 0 ? 'body-flame' : index === 1 ? 'skill' : 'body')" alt=""><b>{{ index === 2 ? 36 : 18 }}</b><small>{{ t(name) }}</small></div></div><div class="cp-cycle-ring" /><span v-for="(node,index) in cycleNodes" :key="index" class="cp-cycle-node" :class="{ active: index < 12 }" :style="{ left: `${node.x}%`, top: `${node.y}%` }"><PcPaperLock v-if="index >= 12" /></span><div class="cp-body-caption"><h2>12/36</h2><p>{{ t('zhouSummary') }}</p></div></template></section><aside class="pc-paper-inspector cp-progression-inspector"><h2>{{ t(example === 'meridian' ? 'yin' : 'zhou') }}</h2><p>{{ t(example === 'meridian' ? 'meridianDescription' : 'zhouDescription') }}</p><template v-if="example === 'meridian'"><h3>{{ t('effects') }}</h3><dl><div><dt>{{ t('regen') }}</dt><dd>+8%</dd></div></dl><h3>{{ t('conditions') }}</h3><p class="cp-condition">{{ t('realmGate') }} <strong>✓</strong></p><h3>{{ t('costs') }}</h3><div class="cp-materials"><span class="pc-paper-slot"><img :src="pill" alt=""></span><span>{{ t('pill') }}<b>5 / 4</b></span></div><PcPaperButton>{{ t('openMeridian') }}</PcPaperButton></template><template v-else><h3>{{ t('step') }}</h3><div class="cp-step-strip"><i v-for="n in 18" :key="n" :class="{ active: n <= 13 }" /></div><p>{{ t('stepCount') }}</p><h3>{{ t('stepRewards') }}</h3><dl><div v-for="(name,index) in ['hp','attack','defense','regen']" :key="name"><dt>{{ t(name) }}</dt><dd>{{ ['+34','+5','+3','+1'][index] }}</dd></div></dl><h3>{{ t('costs') }}</h3><div class="cp-materials"><span class="pc-paper-slot"><img :src="pcPaperIconUrl('body-flame')" alt=""></span><span>{{ t('essence') }}<b>120 / 75</b></span></div><PcPaperButton>{{ t('circulate') }}</PcPaperButton></template></aside></div>
    <template #footer><p class="cp-design-note">{{ t('designOnly') }}</p></template>
  </PcPaperScene></SceneDesignCanvas>
</template>

<style>
html, body, #app { margin: 0; width: 100%; height: 100%; background: #f4e7cc; }
.cp-character { display: grid; grid-template-columns: 350px minmax(0,1fr) 320px; gap: 23px; height: 100%; }
.cp-identity { position: relative; text-align: center; }
.cp-identity h2 { margin: 0; font-size: 30px; }
.cp-identity > p { font-size: 18px; margin: 7px 0; }
.cp-hero-ring { position: absolute; left: 7%; top: 10%; width: 86%; aspect-ratio: 1; border: 6px double #b68e4899; border-radius: 50%; box-shadow: 0 0 0 7px #c9a45e2c; }
.cp-hero { position: absolute; left: 1%; top: 12%; width: 98%; height: 73%; object-fit: contain; }
.cp-path { position: absolute; left: 0; right: 0; bottom: 84px; display: flex; align-items: center; justify-content: center; gap: 9px; }
.cp-path img { width: 30px; height: 30px; object-fit: contain; }
.cp-power { position: absolute; bottom: 0; inset-inline: 25px; padding: 12px; }
.cp-power h3 { margin: 0; border: 0; padding: 0; font-size: 18px; }
.cp-power b { font-size: 35px; color: #edce82; }
.cp-character-center { display: grid; grid-template-rows: 285px 113px 123px; gap: 12px; }
.cp-character-center .pc-paper-inspector { padding: 16px 23px; }
.cp-character-center h2, .cp-character-details h2 { font-size: 22px; }
.cp-stats > p { margin: 5px 0; font-size: 14px; }
.cp-stats dl > div { padding: 6px 0; font-size: 19px; }
.cp-stats dd { display: flex; gap: 15px; align-items: center; }
.cp-stats button { width: 27px; height: 27px; background: #6a522b; color: #e8ce93; border: 1px solid #b18a43; font-size: 23px; line-height: 1; }
.cp-talents > div { display: flex; align-items: center; justify-content: space-around; padding-top: 6px; }
.cp-talents span { display: grid; justify-items: center; gap: 3px; font-size: 14px; }
.cp-talents img, .cp-talents svg { width: 29px; height: 34px; object-fit: contain; }
.cp-elements > div { display: flex; justify-content: space-around; padding-top: 5px; }
.cp-elements span { display: grid; justify-items: center; font-size: 13px; }
.cp-elements img { width: 40px; height: 40px; object-fit: contain; }
.cp-character-details { padding: 20px 21px; }
.cp-character-details dl { margin-top: 17px; }
.cp-character-details dl > div { padding: 12px 0; font-size: 18px; }
.cp-design-note { text-align: center; font-size: 13px; color: #775e32; margin-top: 24px; }
.cp-creation { margin: -25px auto 0; max-width: 1100px; }
.cp-creation-intro { text-align: center; margin: 0 0 25px; font-size: 21px; }
.cp-creation-name { display: flex; align-items: center; gap: 30px; max-width: 650px; margin: auto; font-size: 25px; font-weight: bold; }
.cp-creation-name input { flex: 1; min-width: 0; background: #f6e7c580; border: 3px double #b28b46; padding: 12px 20px; font: 23px var(--pc-font-body); color: #302519; }
.cp-creation > h2 { text-align: center; font-size: 24px; margin: 22px 0 12px; }
.cp-path-choices { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
.cp-path-choices article { display: grid; grid-template-columns: 75px 1fr; gap: 0 10px; align-items: center; border: 3px double #b28b4660; padding: 17px 23px; }
.cp-path-choices article.selected { background: #d6ac4f25; border-color: #b28b46; }
.cp-path-choices img { grid-row: span 2; width: 64px; height: 64px; object-fit: contain; }
.cp-path-choices h3 { font-size: 25px; margin: 0; }
.cp-path-choices small { font-size: 13px; }
.cp-creation-talent-heading { display: flex; align-items: center; justify-content: space-between; margin: 23px 0 13px; }
.cp-creation-talent-heading h2 { font-size: 24px; margin: 0; }
.cp-creation-talent-heading .pc-paper-button { min-height: 36px; font-size: 17px; padding: 7px 18px; }
.cp-talent-choices { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
.cp-talent-choices button { display: flex; gap: 16px; align-items: center; background: #f2dfb746; border: 3px double #b28b4660; color: #2b2418; padding: 22px; text-align: left; }
.cp-talent-choices button.selected { border-color: #a77e35; box-shadow: inset 0 0 20px #d9b56330; }
.cp-talent-choices img { width: 52px; height: 52px; object-fit: contain; }
.cp-talent-choices h3 { font: bold 24px var(--pc-font-body); margin: 0 0 9px; }
.cp-talent-choices p { font: 16px/1.45 var(--pc-font-body); margin: 0; }
.cp-creation-actions { display: flex; justify-content: center; gap: 27px; margin-top: 28px; }
.cp-creation-actions .pc-paper-button { min-width: 190px; }
.cp-technique { display: grid; grid-template-columns: 230px minmax(0,1fr) 485px; gap: 24px; height: 100%; }
.cp-technique-catalog { border-right: 1px solid #b28b4650; padding-right: 16px; }
.cp-technique-catalog h2 { font-size: 23px; margin: 0 0 20px; }
.cp-technique-catalog button { display: grid; grid-template-columns: 55px 1fr; align-items: center; gap: 7px; width: 100%; border: 0; border-bottom: 1px solid #b28b4640; padding: 20px 8px; background: transparent; color: #302519; text-align: left; font: 18px var(--pc-font-body); }
.cp-technique-catalog button.selected { border: 3px double #b28b46; background: #d6ad4e20; }
.cp-technique-catalog img { grid-row: span 2; width: 55px; height: 70px; object-fit: contain; }
.cp-technique-catalog small { font-size: 15px; }
.cp-technique-art { position: relative; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.cp-technique-art .cp-hero-ring { top: 14%; }
.cp-technique-art > img { position: relative; z-index: 1; width: 78%; height: 62%; object-fit: contain; }
.cp-technique-art h2 { font-size: 29px; margin: 20px 0 7px; }
.cp-technique-art p { font-size: 21px; margin: 0; }
.cp-progression-inspector { height: 100%; display: flex; flex-direction: column; min-height: 0; padding: 22px 27px; }
.cp-progression-inspector h2 { font-size: 28px; }
.cp-progression-inspector p { font-size: 17px; margin: 12px 0; line-height: 1.5; }
.cp-progression-inspector h3 { margin: 12px 0 8px; font-size: 22px; padding: 9px 0; }
.cp-progression-inspector dl > div { padding: 9px 0; font-size: 19px; }
.cp-progression-inspector dd strong { color: #aed482; margin-left: 10px; }
.cp-progression-inspector > .pc-paper-button { margin-top: auto; }
.cp-technique .cp-progression-inspector { display: grid; grid-template-rows: 38px 55px 38px 26px minmax(0,1fr) 38px 68px 46px; gap: 6px; }
.cp-technique .cp-progression-inspector > p, .cp-technique .cp-progression-inspector h3, .cp-technique .cp-materials { margin: 0; }
.cp-technique .cp-progression-inspector h3 { padding: 4px 0; }
.cp-technique .cp-progression-inspector dl { display: flex; flex-direction: column; justify-content: space-evenly; }
.cp-technique .cp-progression-inspector dl > div { padding: 4px 0; }
.cp-technique .cp-progression-inspector > .pc-paper-button { margin-top: 0; }
.pc-paper-scene[data-character-design='meridian'] .cp-progression-inspector h3 { margin: 8px 0 6px; padding: 7px 0; }
.cp-compare-heading { display: flex; justify-content: space-between; font-size: 16px; }
.cp-materials { display: flex; align-items: center; gap: 11px; margin: 13px 0; }
.cp-materials .pc-paper-slot { width: 68px; height: 68px; flex-shrink: 0; }
.cp-materials b { display: block; margin-top: 7px; font-size: 19px; }
.cp-body-scene { height: 100%; display: grid; grid-template-columns: 1.45fr 1fr; gap: 25px; grid-template-rows: minmax(0,1fr); }
.cp-body-figure { position: relative; min-height: 0; }
.cp-body-figure > .cp-body-diagram { position: absolute; top: 0; left: 4%; width: 94%; height: 88%; object-fit: contain; pointer-events: none; }
.cp-meridian-mark { position: absolute; width: 135px; text-align: center; }
.cp-meridian-mark > span { display: grid; place-items: center; width: 97px; height: 97px; margin: auto; border: 5px double #b38b43; border-radius: 50%; background: radial-gradient(#665127,#211d15); }
.cp-meridian-mark svg { width: 39px; height: 58px; }
.cp-meridian-mark h3 { font-size: 21px; margin: 7px 0; }
.cp-meridian-mark b { color: #58763a; font-size: 17px; }
.cp-meridian-mark.active > span { box-shadow: 0 0 17px #e8b044; border-color: #dfaf55; }
.cp-meridian-mark.active b { color: #96712d; }
.cp-body-caption { position: absolute; bottom: 0; left: 17%; right: 17%; text-align: center; }
.cp-body-caption h2 { margin: 0 0 7px; font-size: 26px; }
.cp-body-caption p { margin: 8px 0 0; font-size: 19px; }
.cp-progress-bar { border: 3px double #a98239; background: #302b21; height: 15px; }
.cp-progress-bar > span { display: block; height: 100%; background: #e3bc65; }
.cp-condition strong { color: #9cd173; margin-left: 40px; }
.cp-cycle-ring { position: absolute; left: 8%; top: 4%; width: 84%; height: 82%; border: 5px double #b38b4377; border-radius: 50%; }
.cp-cycle-node { position: absolute; transform: translate(-50%,-50%); width: 25px; height: 25px; border: 3px double #a89058; border-radius: 50%; background: #443d30; display: grid; place-items: center; }
.cp-cycle-node.active { background: #fff1b0; border-color: #e5b752; box-shadow: 0 0 10px #eec26f; }
.cp-cycle-node .pc-paper-lock { width: 10px; height: 15px; }
.cp-step-strip { display: flex; justify-content: space-between; padding-top: 7px; gap: 3px; }
.cp-step-strip i { width: 15px; height: 15px; border: 2px solid #6e6a5a; border-radius: 50%; background: #27261f; }
.cp-step-strip i.active { background: #eed496; border-color: #c7973d; box-shadow: 0 0 6px #d5b05a; }
.pc-paper-scene[data-character-design="creation"] .pc-paper-scene__workspace, .pc-paper-scene[data-character-design="technique"] .pc-paper-scene__workspace { top: 149px; bottom: 67px; }

.pc-paper-scene[data-character-design] .pc-paper-scene__footer { top: auto; bottom: 12px; height: 28px; }
.cp-design-note { margin-top: 8px; }
.cp-talent-choices img { padding: 7px; background: #30281d; border: 3px double #b28b46; border-radius: 50%; width: 59px; height: 59px; }
.cp-path-choices article:last-child img { padding: 7px; background: #30281d; border: 3px double #b28b46; border-radius: 50%; }
.pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector p { font-size: 15px; margin: 5px 0; line-height: 1.3; }
.pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector h3 { font-size: 19px; padding: 4px 0; margin: 6px 0; }
.pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector dl > div { padding: 4px 0; font-size: 16px; }
.pc-paper-scene[data-character-design='zhou'] .cp-materials { margin: 6px 0; }
.pc-paper-scene[data-character-design='zhou'] .cp-materials .pc-paper-slot { width: 56px; height: 56px; }

.cp-cycle-node { width: 21px; height: 21px; }
.pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector { display: grid; grid-template-rows: 34px 38px 35px 20px 22px 35px minmax(0,1fr) 35px 66px 46px; gap: 5px; }
.pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector > p, .pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector h3 { margin: 0; }
.pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector h3 { font-size: 21px; padding: 5px 0; }
.pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector > p { font-size: 16px; }
.pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector dl { display: flex; flex-direction: column; justify-content: space-evenly; }
.pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector dl > div { padding: 3px 0; font-size: 18px; }
.pc-paper-scene[data-character-design='zhou'] .cp-materials { margin: 0; }
.pc-paper-scene[data-character-design='zhou'] .cp-progression-inspector > .pc-paper-button { margin-top: 0; }
.cp-body-figure--cycle { width: 86%; }
.cp-cycle-milestones { position: absolute; left: 101%; top: 8%; width: 98px; display: flex; flex-direction: column; gap: 25px; text-align: center; }
.cp-cycle-milestones > div { display: grid; justify-items: center; gap: 4px; }
.cp-cycle-milestones img { width: 58px; height: 58px; border: 4px double #b38b43; border-radius: 50%; background: #30281d; padding: 8px; object-fit: contain; }
.cp-cycle-milestones b { font-size: 24px; }
.cp-cycle-milestones small { font-size: 15px; }
</style>





