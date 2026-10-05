<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import { stableSymbolUrl } from '@/presentation/huyenKim/StableSceneArt'
import TribulationFidelityFrame from './TribulationFidelityFrame.vue'
import TribulationFidelityChapters from './TribulationFidelityChapters.vue'
import TribulationFidelityQuestion from './TribulationFidelityQuestion.vue'
import CombatFidelityMeter from '@/components/scenes/combat/fidelity/CombatFidelityMeter.vue'
import type { TribulationUiModel } from './tribulationUi'
import '@/assets/tien-hiep-outcomes.css'
const props = defineProps<{ model: TribulationUiModel; selected: string | null; notice: string }>()
const emit = defineEmits<{ answer: [id: string]; back: [] }>()
const { t } = useI18n()
const chapter = computed(() => props.model.chapters.find(entry => entry.id === props.model.chapterId))
const ring = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/orb-frame.png')
const meditator = resolveAssetUrl('/assets/ui/huyen-kim/scene/body-v2/zhou-meditation-v1.png')
const backIcon = stableSymbolUrl('back')
</script>
<template><section class="tribulation-hud" :aria-label="t('title')"><div class="scene-heading"><button :aria-label="t('back')" @click="emit('back')"><img :src="backIcon" alt=""></button><h1>{{ t('title') }}</h1><p>{{ t('subtitle') }}</p></div><TribulationFidelityChapters :chapters="model.chapters" :current="model.chapterId" />
  <TribulationFidelityFrame class="realm-card"><h2>{{ model.realm }}</h2><div class="strike-pips" :aria-label="t('strikesValue', { value: model.strikes })"><i v-for="pip in model.strikePips" :key="pip.id" :class="{ lit: pip.lit }" aria-hidden="true" /></div><p>{{ t('progress') }} <strong>{{ model.progress }}</strong></p></TribulationFidelityFrame>
  <TribulationFidelityFrame class="status-card"><h2>{{ t('current', { name: chapter?.name }) }}</h2><p class="trial-description">{{ model.description }}</p><dl><div><dt>{{ t('time') }}</dt><dd>{{ model.seconds }}</dd></div><div><dt>{{ t('chapterProgress') }}</dt><dd>{{ model.progress }}</dd></div><div><dt>{{ t('strikes') }}</dt><dd>{{ model.strikes }}</dd></div></dl></TribulationFidelityFrame>
  <TribulationFidelityQuestion v-if="model.question" :question="model.question" :answers="model.answers" :selected="selected" :seconds="model.seconds" :percent="model.timePercent" :notice="notice" @answer="emit('answer', $event)" />
  <TribulationFidelityFrame v-else class="endurance-card"><p>{{ t('endurance') }}</p><h2>{{ chapter?.name }}</h2><span>{{ t('enduranceHint') }}</span></TribulationFidelityFrame>
  <div class="hp-cluster"><div class="hp-medallion"><div class="medallion-center"><img :src="meditator" alt=""></div><img class="medallion-ring" :src="ring" alt=""></div><div class="hp-plaque"><span class="hp-label">{{ model.hp.label }}</span><CombatFidelityMeter v-bind="model.hp" /></div><p class="resolve-caption">{{ t('resolve') }}</p></div>
</section></template>
<style scoped>
.tribulation-hud { position:absolute; inset:0; pointer-events:none; color:#ecdbb0; font-family:var(--font-display,Georgia,serif); }.tribulation-hud :deep(*) { box-sizing:border-box; }.scene-heading { position:absolute; left:35px; top:29px; width:266px; text-shadow:0 2px 4px #000; }.scene-heading h1 { margin:0 0 10px 34px; font-size:31px; color:#ffe2a3; }.scene-heading p { margin:0 0 0 34px; font-size:14px; line-height:1.6; color:#d6c69e; }.scene-heading button { position:absolute; top:4px; left:0; width:27px; height:31px; padding:3px; border:1px solid #aa925b; background:#102018b3; cursor:pointer; pointer-events:auto; }.scene-heading button img { width:100%; filter:invert(.85) sepia(.8); }.scene-heading button:focus-visible { outline:2px solid #f2d185; outline-offset:3px; }
.realm-card { position:absolute; right:31px; top:25px; width:247px; height:138px; padding:20px 23px; text-align:center; }.realm-card h2 { margin:0 0 13px; font-size:18px; font-weight:500; color:#f1d492; }.realm-card p { margin:12px 0 0; font-size:12px; color:#c1b187; }.realm-card strong { margin-left:7px; color:#f5dfab; }.strike-pips { display:flex; justify-content:center; gap:11px; }.strike-pips i { display:block; width:13px; height:21px; border:1px solid #8b805e; border-radius:80% 10% 70% 30%; transform:rotate(-35deg); background:#1c2723; }.strike-pips i.lit { background:radial-gradient(#fff2be,#ecb449 65%,#946421); border-color:#eaca80; box-shadow:0 0 8px #f3b73c88; }
.status-card { position:absolute; left:35px; top:280px; width:285px; height:290px; padding:26px 25px; }.status-card h2 { margin:0 0 15px; padding-bottom:11px; border-bottom:1px solid #bd9c5c66; color:#f0d495; font-size:20px; font-weight:500; }.trial-description { margin:0; height:80px; font-size:13px; line-height:1.65; color:#d1c4a2; }.status-card dl { margin:12px 0 0; }.status-card dl div { display:flex; justify-content:space-between; gap:10px; padding:10px 0; border-top:1px solid #b89b4926; font-size:13px; }.status-card dd { margin:0; font-weight:600; color:#f0cf81; }
.endurance-card { position:absolute; right:31px; top:280px; width:321px; height:225px; padding:36px 30px; text-align:center; }.endurance-card p { font-size:12px; color:#bfa879; letter-spacing:2px; }.endurance-card h2 { margin:15px 0; font-size:28px; color:#ffdc93; }.endurance-card span { font-size:14px; line-height:1.7; color:#d4c8a7; }
.hp-cluster { position:absolute; left:493px; top:619px; width:454px; height:156px; }.hp-medallion { position:relative; width:96px; height:96px; margin:auto; z-index:2; }.medallion-center { position:absolute; inset:12%; display:grid; place-items:center; border-radius:50%; background:radial-gradient(#d9b96d,#725121 65%,#10201b); }.medallion-center img { width:78%; height:78%; object-fit:contain; }.medallion-ring { position:absolute; inset:0; width:100%; height:100%; filter:drop-shadow(0 0 8px #d7b35b66); }.hp-plaque { margin-top:-14px; padding:14px 23px 12px; background:linear-gradient(90deg,transparent,#102018ed 10%,#102018ed 90%,transparent); border-bottom:1px solid #baa05a; }.hp-label { display:block; margin:0 0 5px; color:#ffe2a1; font-size:13px; text-shadow:0 2px 3px #000; }.hp-plaque :deep(.meter) { height:20px; }.hp-plaque :deep(.value) { font-size:12px; line-height:18px; }.resolve-caption { margin:8px 0 0; text-align:center; font-size:14px; font-style:italic; letter-spacing:1px; color:#ead292; text-shadow:0 1px 4px #000; }
.status-card { height:310px; }
</style>
