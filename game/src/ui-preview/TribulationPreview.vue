<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import { stableSceneArtUrl, stableSymbolUrl } from '@/presentation/huyenKim/StableSceneArt'
import TribulationFidelityScene from '@/components/scenes/tribulation/fidelity/TribulationFidelityScene.vue'
import type { TribulationUiModel } from '@/components/scenes/tribulation/fidelity/tribulationUi'
const { t } = useI18n()
const chapterId = shallowRef('mind')
const selected = shallowRef<string | null>(null)
const notice = shallowRef('')
const phases = ['mind','body','lightning'] as const
const symbols = ['character','body','realm'] as const
// Existing environment art is shown statically for UI review only.
const layers = ['tribulation-storm-far','tribulation-dais','tribulation-storm-near','tribulation-sky-vignette'].map(id=>({ id, src:stableSceneArtUrl(id) }))
const model = computed<TribulationUiModel>(() => ({
  realm:t('realm'), progress:`${phases.findIndex(id=>id===chapterId.value)+1} / 3`, chapterId:chapterId.value,
  chapters:phases.map((id,i)=>({ id,name:t(`chapter.${id}`),hint:t(`hint.${id}`),icon:stableSymbolUrl(symbols[i]!) })),
  description:t(`description.${chapterId.value}`),seconds:chapterId.value==='mind'?'01:28':'00:46',strikes:chapterId.value==='lightning'?'3 / 5':'0 / 5',
  strikePips:Array.from({length:5},(_,i)=>({id:`pip-${i}`,lit:chapterId.value==='lightning'&&i<3})),
  hp:{label:t('hp'),value:'68.420 / 82.000',percent:83.4}, question:chapterId.value==='mind'?t('question'):null,
  answers:['a','b','c','d'].map(id=>({id,label:t(`answers.${id}`)})),timePercent:73,
}))
function answer(id:string) { selected.value=id; notice.value=t('notice') }
function phase(id:string) { chapterId.value=id; selected.value=null; notice.value='' }
function back() { window.location.assign('/ui-dong-fu.html') }
</script>
<template><SceneDesignCanvas><div class="tribulation-preview"><div class="existing-environment" aria-hidden="true"><img v-for="layer in layers" :key="layer.id" :src="layer.src" :class="layer.id" alt="" draggable="false"></div><TribulationFidelityScene :model="model" :selected="selected" :notice="notice" @answer="answer" @back="back" /><div class="review-phases" role="group" :aria-label="t('reviewPhase')"><span>{{ t('preview') }}</span><button v-for="id in phases" :key="id" :aria-pressed="chapterId===id" @click="phase(id)">{{ t(`chapter.${id}`) }}</button></div></div></SceneDesignCanvas></template>
<style scoped>.tribulation-preview { position:relative; width:100%; height:100%; background:#101718; }.existing-environment { position:absolute; inset:0; pointer-events:none; }.existing-environment img { position:absolute; left:0; top:0; width:100%; height:auto; }.existing-environment .tribulation-dais { top:auto; bottom:0; }.existing-environment .tribulation-sky-vignette { width:100%; height:100%; object-fit:cover; }.review-phases { position:absolute; left:35px; bottom:26px; width:365px; display:flex; flex-wrap:wrap; gap:8px; font-family:var(--font-display,Georgia,serif); }.review-phases span { width:100%; font-size:10px; color:#c4b68f; text-shadow:0 1px 3px #000; }.review-phases button { padding:6px 12px; border:1px solid #8b7544; background:#102018e6; color:#d3c29a; font:12px var(--font-display,Georgia,serif); cursor:pointer; }.review-phases button[aria-pressed=true] { color:#ffe3a3; border-color:#d4b76b; background:#4a3c22; }.review-phases button:focus-visible { outline:2px solid #f4d17c; outline-offset:3px; }</style>
