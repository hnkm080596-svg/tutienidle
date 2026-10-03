<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { ExplorationPaperModel, ExplorationDetail } from './explorationUi'
defineProps<{ model: ExplorationPaperModel; stage: ExplorationDetail | null; notice: string }>()
const emit = defineEmits<{ mode: [id: string]; stopFarm: []; openBuild: []; start: [] }>()
const { t } = useI18n()
const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
</script>
<template>
  <aside class="exploration-details" :style="{ borderImageSource: `url('${paper}')` }">
    <div v-if="model.armedFarm" class="exploration-armed"><span>{{ t('exploration.armedFarm', { stage: model.armedFarm.stageName }) }}</span><button type="button" class="exploration-stop" data-testid="autofarm-stop" @click="emit('stopFarm')">{{ model.stopLabel }}</button></div>
    <template v-if="stage">
      <p class="chapter-name">{{ stage.chapter }}</p>
      <h2 class="stage-title">{{ stage.title }}</h2>
      <div class="details-body">
        <div class="stage-vista" aria-hidden="true" :style="{ backgroundImage: `url('${model.terrain}')`, backgroundSize: '100% 300%' }" />
        <p class="description">{{ stage.description }}</p>
        <p class="state-line">{{ stage.stateLabel }}</p>
        <p v-if="stage.disabledLabel" class="disabled-line">{{ stage.disabledLabel }}</p>
        <h3 class="section-heading">{{ t('exploration.enemies') }}</h3>
        <p v-if="stage.enemySummary" class="enemy-summary">{{ stage.enemySummary }}</p>
        <p class="enemy-name">{{ stage.enemyLabel }}</p>
        <h3 class="section-heading">{{ t('exploration.rewards') }}</h3>
        <div class="rewards"><div v-for="(reward, index) in stage.rewards" :key="index" class="reward"><span>{{ reward.label }}</span><strong>{{ reward.amount }}</strong></div></div>
      </div>
      <!-- Mode chips stay OUT of the scrollable body - arming a mode is
           part of the primary start flow and must never clip behind
           the CTA on shorter viewports. -->
      <div class="mode-block"><div class="mode-chips" role="group" :aria-label="t('exploration.modes')"><button v-for="chip in stage.modes" :key="chip.id" type="button" :class="['mode-chip', { active: chip.active }]" :disabled="chip.disabled" :aria-pressed="chip.active" :data-mode="chip.id" @click="emit('mode', chip.id)">{{ chip.label }}</button></div><p class="mode-hint">{{ stage.modeHint }}</p></div>
      <div class="start-row"><button type="button" class="build-link" @click="emit('openBuild')">{{ stage.buildLabel }}</button><button class="challenge" type="button" :disabled="stage.startDisabled" data-testid="stage-start-button" @click="emit('start')">{{ stage.startLabel }}</button></div>
    </template>
    <template v-else><h2 class="stage-title">{{ model.title }}</h2><p class="empty-line">{{ t('exploration.empty') }}</p></template>
    <p class="notice" role="status">{{ notice }}</p>
  </aside>
</template>
<style scoped>
.exploration-details { position:absolute; left:983px; top:154px; width:405px; height:575px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:35px; padding:22px 27px 12px; display:flex; flex-direction:column; }
.exploration-armed { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:8px; padding:8px 10px; border:1px solid #a98a4b; border-radius:6px; background:#e8d5a855; font-size:13px; color:#6a5326; }.exploration-stop { padding:3px 10px; border:1px solid #7d3b2b; border-radius:5px; background:#8f4632; color:#ffedd0; font:inherit; font-size:12px; cursor:pointer; }
.chapter-name { margin:0 0 7px; text-align:center; color:#887044; font-size:13px; }.stage-title { margin:0; padding-bottom:12px; text-align:center; font-size:25px; font-weight:500; border-bottom:1px solid #b3996377; }
.details-body { flex:1; min-height:0; overflow:auto; scrollbar-width:thin; }.stage-vista { height:64px; margin:8px 0; background-size:cover; background-position:center; border-radius:3px; }.description { font-size:14px; line-height:1.6; margin:6px 0; }.state-line { font-size:13px; color:#3c674c; margin:8px 0; }.disabled-line { font-size:13px; color:#9c4f2e; margin:8px 0; }.section-heading { font-size:16px; font-weight:500; margin:11px 0 5px; }.enemy-summary { margin:0 0 4px; font-size:13px; color:#6a5326; }.enemy-name { margin:0; font-size:15px; }.rewards { display:flex; gap:8px; }.reward { flex:1; padding:8px 5px; border:1px solid #ac915b77; background:#e6d5ad55; text-align:center; font-size:12px; }.reward strong { display:block; margin-top:5px; font-weight:500; font-size:16px; color:#385e45; }
.mode-block { flex:0 0 auto; margin-top:8px; }.mode-chips { display:flex; gap:6px; flex-wrap:wrap; }.mode-chip { flex:1; min-width:60px; padding:6px 4px; border:1px solid #a98a4b; border-radius:11px; background:#f2e6c8; color:#5a4a28; font:inherit; font-size:12px; cursor:pointer; }.mode-chip.active { background:#315f46; border-color:#315f46; color:#f4ead0; }.mode-chip:disabled { opacity:.5; cursor:default; }.mode-hint { margin:5px 0 0; font-size:11px; color:#8a7448; line-height:1.4; max-height:30px; overflow:hidden; }
.start-row { display:flex; gap:8px; margin-top:10px; }.build-link { flex:0 0 auto; padding:0 12px; border:1px solid #a98a4b; border-radius:8px; background:#ece0c4; color:#5f4c26; font:inherit; font-size:14px; cursor:pointer; }.challenge { flex:1; min-height:47px; background:#285e4b; border:3px double #bca264; color:#fff0c9; font:23px var(--font-display,Georgia,serif); cursor:pointer; }.challenge:hover:not(:disabled) { background:#34705a; }.challenge:disabled { opacity:.55; cursor:default; }.challenge:focus-visible { outline:2px solid #315d48; outline-offset:3px; }
.empty-line { margin-top:16px; font-size:14px; color:#9a8562; font-style:italic; text-align:center; }
.notice { height:35px; flex:0 0 35px; margin:7px 0 0; text-align:center; color:#775f3e; font-size:12px; line-height:1.35; overflow:auto; }
</style>
