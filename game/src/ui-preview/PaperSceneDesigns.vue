<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import PcPaperLock from '@/components/common/PcPaperLock.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { pcPaperIconUrl } from '@/presentation/assets/PcPaperIcons'
defineProps<{ kind: string }>()
const { t } = useI18n()
const vista = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/world-vista-warm-v1.png')
const figure = resolveAssetUrl('/assets/ui/huyen-kim/scene/body-v2/zhou-meditation-v1.png')
const skills = ['fire', 'fire', 'earth', 'primordial', 'wood', 'water', 'metal']
const fireArt = resolveAssetUrl('/assets/ui/elements/el-fire.png')
const ore = resolveAssetUrl('/assets/materials/linh_khoang.png')
const herb = resolveAssetUrl('/assets/materials/herbs/tu_linh_thao/decade.png')
const sword = resolveAssetUrl('/assets/equipment/items/base-kiem/kiem-01.png')
const skillNodes = [{ x: 50, y: 22 }, { x: 24, y: 48 }, { x: 76, y: 48 }, { x: 50, y: 56 }, { x: 12, y: 77 }, { x: 35, y: 77 }, { x: 65, y: 77 }, { x: 88, y: 77 }, { x: 12, y: 97 }, { x: 50, y: 97 }, { x: 88, y: 97 }]
const stages = [{ x: 20, y: 75 }, { x: 36, y: 53 }, { x: 55, y: 69 }, { x: 63, y: 36 }, { x: 81, y: 49 }]
const realmPositions = [1, 14, 27, 62, 74, 86, 98]
const realmNames = ['realmQi', 'realmFoundation', 'realmCore', 'realmSpirit', 'realmVoid', 'realmUnion', 'realmAscendant']
</script>

<template>
  <section v-if="kind === 'progression'" class="paper-realms">
    <p class="paper-realms__intro">{{ t('realmIntro') }}</p>
    <div class="paper-realms__line" />
    <article v-for="(name,index) in realmNames" :key="name" class="paper-realms__stop" :class="{ locked: index > 2 }" :style="{ left: `${realmPositions[index]}%` }"><div class="paper-realms__portrait" :style="{ backgroundImage: `url('${vista}')`, backgroundPosition: `${index * 16}% 45%` }"><span v-if="index > 2"><PcPaperLock /></span></div><h2>{{ t(name) }}</h2><small>{{ t(index > 2 ? 'unopened' : 'achieved') }}</small></article>
    <article class="paper-realms__current"><h2>{{ t('realmSoul') }}</h2><b>{{ t('realmTier') }}</b><div class="paper-realms__meditation" :style="{ backgroundImage: `url('${vista}')` }"><div class="paper-realms__enso" /><img :src="figure" alt=""><div class="paper-realms__qi" /></div><div class="paper-realms__progress-label"><span>{{ t('realmProgress') }}</span><span>650 / 1.000</span></div><div class="paper-realms__progress"><span /></div><PcPaperButton>{{ t('breakthrough') }}</PcPaperButton></article>
    <div class="paper-realms__lower"><section><h2>{{ t('realmEffects') }}</h2><dl><div v-for="(label,index) in ['hp','attack','defense','mana','critical','artifactLimit']" :key="label"><dt>{{ t(label) }}</dt><dd>{{ ['+30%','+25%','+25%','+30%','+10%','+1'][index] }}</dd></div></dl></section><section><h2>{{ t('realmLoreTitle') }}</h2><p>{{ t('realmLore') }}</p></section></div>
  </section>
  <div v-else-if="kind === 'graph'" class="paper-skill-scene">
    <section class="paper-skill-scene__tree"><div class="paper-skill-scene__elements"><button v-for="(name,index) in ['fire','wood','water','earth','metal']" :key="name" :class="{ selected: index === 0 }"><span><img :src="resolveAssetUrl(`/assets/ui/elements/el-${name}.png`)" alt=""></span><b>{{ t(name) }}</b></button></div><svg class="paper-skill-scene__paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50 22C40 22 32 34 24 48M50 22C60 22 68 34 76 48M50 22V56M24 48L12 77V97M24 48L35 77M76 48L65 77M76 48L88 77V97M50 56V97" /></svg><div v-for="(node,index) in skillNodes" :key="index" class="paper-skill-scene__node" :class="{ central: index === 0, active: index < 3, locked: index > 6 }" :style="{ left: `${node.x}%`, top: `${18 + node.y * .76}%` }"><span><img v-if="index < 7" :src="index === 0 ? fireArt : resolveAssetUrl(`/assets/ui/elements/el-${skills[index]}.png`)" alt=""><PcPaperLock v-else /></span><small v-if="index < 7">Lv.{{ index < 2 ? 1 : 0 }}</small></div></section>
    <aside class="pc-paper-inspector paper-scene-inspector"><div class="paper-skill-scene__identity"><img :src="fireArt" alt=""><div><h2>{{ t('flameSlash') }}</h2><p>{{ t('activeSkill') }} · Lv.1/5</p></div></div><p>{{ t('flameDescription') }}</p><h3>{{ t('skillEffects') }}</h3><div class="paper-skill-scene__compare"><div><b>{{ t('currentLevel') }}</b><p>{{ t('currentDamage') }}</p></div><span>»</span><div><b>{{ t('nextLevel') }}</b><p>{{ t('nextDamage') }}</p></div></div><h3>{{ t('skillConditions') }}</h3><dl><div><dt>{{ t('prerequisite') }}</dt><dd>{{ t('none') }}</dd></div><div><dt>{{ t('requiredRealm') }}</dt><dd>{{ t('realmQi') }} Lv.1</dd></div></dl><h3>{{ t('costs') }}</h3><div class="paper-skill-scene__cost"><span class="pc-paper-slot"><img :src="ore" alt=""></span><span>{{ t('stone') }}<b>12/10</b></span><span class="pc-paper-slot"><img :src="pcPaperIconUrl('body-flame')" alt=""></span><span>{{ t('fireStone') }}<b>3/2</b></span></div><PcPaperButton>{{ t('upgrade') }}</PcPaperButton></aside>
  </div>
  <div v-else class="paper-map-scene">
    <nav class="paper-map-scene__chapters"><h2>{{ t('chapters') }}</h2><button v-for="n in 5" :key="n" :class="{ selected: n === 1 }"><small>{{ t('chapter', { n }) }}</small><b>{{ t(`chapterName${n}`) }}</b><span>{{ n === 1 ? '3 / 8' : t('unopened') }}</span></button></nav>
    <section class="paper-map-scene__landscape" :style="{ backgroundImage: `url('${vista}')` }"><h2>{{ t('chapterName1') }}</h2><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M20 75L36 53 55 69 63 36 81 49" /></svg><div v-for="(stage,index) in stages" :key="index" class="paper-map-scene__stage" :class="{ selected: index === 2 }" :style="{ left: `${stage.x}%`, top: `${stage.y}%` }"><span>{{ index + 1 }}</span><b>{{ t('stage', { n: index + 1 }) }}</b></div><p>{{ t('mapCaption') }}</p></section>
    <aside class="pc-paper-inspector paper-scene-inspector"><h2>{{ t('stage', { n: 3 }) }}</h2><p>{{ t('mapDescription') }}</p><h3>{{ t('stageInformation') }}</h3><dl><div><dt>{{ t('requiredRealm') }}</dt><dd>{{ t('realmQi') }}</dd></div><div><dt>{{ t('stageProgress') }}</dt><dd>2 / 3</dd></div></dl><h3>{{ t('stageRewards') }}</h3><div class="paper-map-scene__rewards"><span class="pc-paper-slot"><img :src="sword" alt=""></span><span class="pc-paper-slot"><img :src="ore" alt=""></span><span class="pc-paper-slot"><img :src="herb" alt=""></span></div><PcPaperButton>{{ t('explore') }}</PcPaperButton></aside>
  </div>
</template>

<style>
.paper-realms { position: relative; height: 100%; }
.paper-realms__intro { margin: 0; font-size: 20px; }
.paper-realms__line { position: absolute; top: 165px; left: -96px; right: -48px; height: 4px; background: #a27b38; border-block: 1px solid #d6b574; }
.paper-realms__stop { position: absolute; top: 103px; transform: translateX(-50%); text-align: center; width: 130px; }
.paper-realms__portrait { width: 112px; height: 112px; border: 6px double #916c2e; border-radius: 50%; background-size: auto 150px; margin: auto; box-shadow: 0 0 0 2px #e5c889; display: grid; place-items: center; }
.paper-realms__portrait span { width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center; background: #201e1dc9; color: #ead9ad; font-size: 55px; }
.paper-realms__stop h2 { font-size: 22px; margin: 10px 0; }
.paper-realms__stop small { padding: 4px 20px; border: 3px double #ad8a4a; background: #c9a662; color: #fff2ce; font-size: 16px; white-space: nowrap; }
.paper-realms__stop.locked small { background: #2d2c24; }
.paper-realms__current { position: absolute; top: 16px; left: 35%; width: 300px; height: 433px; box-sizing: border-box; border: 5px double #b28b46; padding: 16px 22px; text-align: center; background: #f3e4cbea; display: flex; flex-direction: column; z-index: 1; }
.paper-realms__current > h2 { font-size: 31px; margin: 0; }
.paper-realms__current > b { font-size: 19px; }
.paper-realms__meditation { position: relative; height: 247px; margin-block: 4px; background-size: auto 100%; background-position: 50% 45%; mask-image: radial-gradient(ellipse,black 52%,transparent 77%); }
.paper-realms__meditation img { position: absolute; inset: 8% 5% 0; width: 90%; height: 94%; object-fit: contain; }
.paper-realms__enso { position: absolute; inset: 5% 8% 9%; border: 8px double #726653; border-radius: 50%; transform: rotate(-18deg); }
.paper-realms__qi { position: absolute; left: 3%; top: 64%; width: 94%; height: 18%; border: 3px solid #e4b65b; border-radius: 50%; box-shadow: 0 0 12px #fff1b3, inset 0 0 10px #fff1b3; transform: rotate(-8deg); }
.paper-realms__progress-label { display: flex; justify-content: space-between; font-size: 14px; }
.paper-realms__progress { height: 13px; background: #333026; border: 2px solid #b38c45; margin: 7px 0 14px; }
.paper-realms__progress span { display: block; height: 100%; width: 65%; background: linear-gradient(#f4d9a0,#c99442); }
.paper-realms__current .pc-paper-button { font-size: 23px; }
.paper-realms__lower { position: absolute; left: 60px; right: 60px; bottom: 0; height: 165px; padding: 18px 25px; box-sizing: border-box; border: 3px double #b38b43; background: #f0dfbf9c; display: grid; grid-template-columns: 2fr 1fr; gap: 30px; }
.paper-realms__lower h2 { margin: 0 0 11px; font-size: 21px; border-bottom: 1px solid #b38b43; padding-bottom: 6px; }
.paper-realms__lower dl { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 45px; margin: 0; }
.paper-realms__lower dl > div { display: flex; justify-content: space-between; }
.paper-realms__lower dd { margin: 0; }
.paper-realms__lower p { margin: 0; font-size: 16px; line-height: 1.45; }
.paper-realms__lower section + section { border-left: 1px solid #b38b43; padding-left: 25px; }
.paper-skill-scene { height: 100%; display: grid; grid-template-columns: 1.4fr 1fr; gap: 30px; }
.paper-skill-scene__tree { position: relative; }
.paper-skill-scene__elements { display: flex; justify-content: space-around; height: 92px; border-block: 1px solid #b28b46; }
.paper-skill-scene__elements button { background: transparent; border: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; color: #282317; font: 19px var(--pc-font-body); }
.paper-skill-scene__elements span { width: 54px; height: 54px; border: 4px double #b28b46; background: #302c25; border-radius: 50%; display: grid; place-items: center; color: #e4be76; font-size: 33px; }
.paper-skill-scene__elements .selected span { color: #ffe7ac; background: #84310d; box-shadow: 0 0 12px #eeb94b; }
.paper-skill-scene__paths { position: absolute; left: 0; top: 18%; height: 76%; width: 100%; fill: none; stroke: #ae873e; stroke-width: .6; }
.paper-skill-scene__node { position: absolute; transform: translate(-50%,-50%); display: grid; place-items: center; }
.paper-skill-scene__node > span { width: 73px; height: 73px; border: 5px double #ab8545; border-radius: 50%; background: #332f29; display: grid; place-items: center; overflow: hidden; }
.paper-skill-scene__node img { width: 100%; height: 100%; object-fit: cover; }
.paper-skill-scene__node.active > span { box-shadow: 0 0 13px #eaa827; border-color: #e1ad41; }
.paper-skill-scene__node.central > span { width: 112px; height: 112px; }
.paper-skill-scene__node small { font-size: 16px; margin-top: 3px; }
.paper-skill-scene__node.locked b { color: #d6ccb4; font-size: 38px; }
.paper-scene-inspector { display: flex; flex-direction: column; height: 100%; }
.paper-scene-inspector h2 { font-size: 29px; }
.paper-scene-inspector p { font-size: 17px; line-height: 1.4; }
.paper-scene-inspector h3 { margin: 10px 0; font-size: 22px; }
.paper-scene-inspector > .pc-paper-button { margin-top: auto; }
.paper-skill-scene__identity { display: flex; align-items: center; gap: 17px; }
.paper-skill-scene__identity > img { width: 84px; height: 84px; border: 3px double #b38b43; }
.paper-skill-scene__identity p { margin: 8px 0 0; }
.paper-skill-scene__compare { display: grid; grid-template-columns: 1fr 30px 1fr; gap: 7px; }
.paper-skill-scene__compare > span { font-size: 45px; color: #d7b266; align-self: center; }
.paper-skill-scene__compare b { font-size: 17px; }
.paper-skill-scene__compare p { margin-block: 8px; }
.paper-skill-scene__cost { display: flex; align-items: center; gap: 11px; margin-bottom: 17px; }
.paper-skill-scene__cost .pc-paper-slot { width: 62px; height: 62px; }
.paper-skill-scene__cost b { display: block; margin-top: 5px; }
.paper-map-scene { height: 100%; display: grid; grid-template-columns: 190px minmax(0,1fr) 340px; gap: 22px; }
.paper-map-scene__chapters { border-right: 1px solid #b28b4650; padding-right: 16px; }
.paper-map-scene__chapters h2 { font-size: 25px; margin: 0 0 18px; }
.paper-map-scene__chapters button { width: 100%; background: transparent; border: 0; border-bottom: 1px solid #b28b4650; padding: 13px 9px; display: grid; gap: 7px; text-align: left; color: #30271b; font: 18px var(--pc-font-body); }
.paper-map-scene__chapters button.selected { background: #dcb86450; border: 3px double #b28b46; }
.paper-map-scene__chapters small { font-size: 15px; }
.paper-map-scene__chapters span { font-size: 14px; }
.paper-map-scene__landscape { position: relative; background-size: auto 100%; background-position: 52% 50%; border: 3px double #b28b46; }
.paper-map-scene__landscape > h2 { position: absolute; left: 25px; top: 5px; font-size: 25px; background: #f1dfbbbe; padding: 8px 15px; }
.paper-map-scene__landscape svg { position: absolute; inset: 0; width: 100%; height: 100%; fill: none; stroke: #896632; stroke-width: .4; stroke-dasharray: 1.2 1; }
.paper-map-scene__stage { position: absolute; transform: translate(-50%,-50%); display: grid; justify-items: center; gap: 4px; }
.paper-map-scene__stage > span { width: 35px; height: 35px; border: 3px double #b28b46; border-radius: 50%; background: #2c2b21; color: #ebd5a2; display: grid; place-items: center; font-size: 20px; }
.paper-map-scene__stage.selected > span { background: #a47b2c; box-shadow: 0 0 12px #ffd887; }
.paper-map-scene__stage b { white-space: nowrap; background: #f4e4caba; padding: 3px 6px; font-size: 17px; }
.paper-map-scene__landscape > p { position: absolute; bottom: 0; inset-inline: 0; padding: 13px; margin: 0; text-align: center; background: #f4e4cabd; }
.paper-map-scene__rewards { display: flex; gap: 12px; padding-top: 12px; }
.paper-map-scene__rewards .pc-paper-slot { width: 79px; height: 79px; }
.pc-paper-scene[data-design-example="progression"] .pc-paper-scene__workspace { top: 132px; bottom: 45px; }
.pc-paper-scene[data-design-example="progression"] .pc-paper-scene__footer { display: none; }

.paper-skill-scene { grid-template-rows: minmax(0,1fr); }
.paper-skill-scene__tree, .paper-skill-scene .paper-scene-inspector { min-height: 0; }
.paper-skill-scene .paper-scene-inspector { padding: 18px 22px; }
.paper-skill-scene .paper-scene-inspector p { font-size: 15px; line-height: 1.3; margin: 6px 0; }
.paper-skill-scene .paper-scene-inspector h3 { font-size: 19px; padding: 5px 0; margin: 6px 0; }
.paper-skill-scene .paper-scene-inspector dl > div { font-size: 15px; padding: 6px 0; }
.paper-skill-scene__identity > img { width: 66px; height: 66px; padding: 8px; object-fit: contain; }
.paper-skill-scene__node img { width: 73%; height: 73%; object-fit: contain; }
.paper-skill-scene__cost .pc-paper-slot { width: 54px; height: 54px; }
.paper-skill-scene__cost { margin-bottom: 10px; }

.paper-skill-scene__elements img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
</style>


