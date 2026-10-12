<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import SlotView from '@/components/common/SlotView.vue'
import type { ExplorationPaperModel, ExplorationDetail } from './explorationUi'
defineProps<{ model: ExplorationPaperModel; stage: ExplorationDetail | null; notice: string }>()
const emit = defineEmits<{ mode: [id: string]; stopFarm: []; openBuild: []; start: [] }>()
const { t } = useI18n()
const card = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')
const ctaArt = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png')
</script>
<template>
  <aside class="exploration-details" :style="{ borderImageSource: `url('${card}')` }">
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
        <div class="rewards"><div v-for="(reward, index) in stage.rewards" :key="index" class="reward"><SlotView :item="reward" :icon="reward.icon" :label="reward.label" :accessible-label="[reward.label, reward.amount].filter(Boolean).join(' ')" :tooltip="reward.tooltip" show-label /><strong>{{ reward.amount }}</strong></div></div>
      </div>
      <!-- Mode chips stay OUT of the scrollable body - arming a mode is
           part of the primary start flow and must never clip behind
           the CTA on shorter viewports. -->
      <div class="mode-block"><div class="mode-chips" role="group" :aria-label="t('exploration.modes')"><button v-for="chip in stage.modes" :key="chip.id" type="button" :class="['mode-chip', { active: chip.active }]" :disabled="chip.disabled" :aria-pressed="chip.active" :data-mode="chip.id" @click="emit('mode', chip.id)">{{ chip.label }}</button></div><p class="mode-hint">{{ stage.modeHint }}</p></div>
      <div class="start-row"><button type="button" class="build-link" @click="emit('openBuild')">{{ stage.buildLabel }}</button><button class="challenge" type="button" :disabled="stage.startDisabled" data-testid="stage-start-button" :style="{ backgroundImage: `url('${ctaArt}')` }" @click="emit('start')">{{ stage.startLabel }}</button></div>
    </template>
    <template v-else><h2 class="stage-title">{{ model.title }}</h2><p class="empty-line">{{ t('exploration.empty') }}</p></template>
    <p class="notice" role="status">{{ notice }}</p>
  </aside>
</template>
<style scoped>
/* Son Ha Do home-panel inspector: the dark character-card nine-slice
   with light text (same frame the preview stamps on every panel's
   detail rail) - all canonical rows keep their order and meaning. */
/* #app ancestor + doubled class beats the global tien-hiep-ui
   paper-skin overrides (:is(#app,body) .exploration-details +
   ::before/::after cream fill + frame). */
:is(#app,body) .exploration-details.exploration-details { position:relative; min-height:0; border:14px solid transparent; border-image-slice:160; border-image-width:14px; border-image-repeat:stretch; clip-path:inset(4.7px 1.8px 5.3px 1.9px round 5px); box-sizing:border-box; padding:10px 12px 8px; display:flex; flex-direction:column; gap:4px; color:#efdfb9; background:linear-gradient(#000000d9,#000000d9) padding-box; }
:is(#app,body) .exploration-details.exploration-details::before,
:is(#app,body) .exploration-details.exploration-details::after { display:none; content:none; }
.exploration-armed { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:5px 8px; border:1px solid #a98a4b; border-radius:6px; background:#e8d5a822; font-size:11px; color:#d9b87c; }
.exploration-stop { padding:3px 8px; border:1px solid #7d3b2b; border-radius:5px; background:#8f4632; color:#ffedd0; font:inherit; font-size:11px; cursor:pointer; }
.chapter-name { margin:0; text-align:center; color:#b99f6d; font-size:12px; }
.stage-title { margin:0; padding-bottom:8px; text-align:center; font-size:21px; font-weight:500; color:#f4e4c0; border-bottom:1px solid #b3996355; }
.details-body { flex:1; min-height:0; overflow:auto; scrollbar-width:thin; }
.stage-vista { height:52px; margin:8px 0 4px; background-size:cover; background-position:center; border-radius:3px; border:1px solid #ab8a4b44; }
.description { font-size:13px; line-height:1.4; margin:6px 0; text-align:center; }
.state-line { font-size:12px; color:#a8c9a4; margin:5px 0; text-align:center; }
.disabled-line { font-size:12px; color:#d98d6a; margin:5px 0; text-align:center; }
.section-heading { margin:12px 0 6px; border-block:1px solid #ab8a4b66; padding:6px 0; font-size:15px; font-weight:600; text-align:center; color:#f0dcae; }
.enemy-summary { margin:0 0 3px; font-size:12px; color:#d9b87c; text-align:center; }
.enemy-name { margin:0; font-size:13px; text-align:center; }
.rewards { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; padding-top:4px; }
.reward { flex:0 0 auto; width:52px; text-align:center; font-size:10px; }
.reward .slot-view { width:100%; }
.reward strong { display:block; margin-top:2px; font-weight:500; font-size:12px; color:#c4d9a8; }
.mode-block { flex:0 0 auto; margin-top:6px; }
.mode-chips { display:grid; grid-template-columns:1fr 1fr; gap:5px; }
.mode-chip { padding:5px 4px; border:1px solid #a98a4b; border-radius:11px; background:#f2e6c814; color:#e8d5a8; font:inherit; font-size:12px; cursor:pointer; }
.mode-chip.active { background:#315f46; border-color:#6fae8a; color:#f4ead0; }
.mode-chip:disabled { opacity:.45; cursor:default; }
.mode-hint { margin:4px 0 0; font-size:10px; color:#b99f6d; line-height:1.3; max-height:26px; overflow:hidden; text-align:center; }
.start-row { display:flex; flex-direction:column; gap:6px; margin-top:8px; }
.build-link { align-self:center; padding:2px 10px; border:1px solid #a98a4b; border-radius:8px; background:#ece0c41a; color:#d9b87c; font:inherit; font-size:12px; cursor:pointer; }
.challenge { min-height:42px; border:0; background:transparent center/100% 100% no-repeat; color:#efdcb6; font:700 19px var(--font-display,Georgia,serif); cursor:pointer; }
.challenge:hover:not(:disabled) { filter:brightness(1.12); }
.challenge:disabled { opacity:.55; cursor:default; }
.challenge:focus-visible { outline:2px solid #d8b56a; outline-offset:2px; }
.empty-line { margin-top:16px; font-size:13px; color:#b99f6d; font-style:italic; text-align:center; }
.notice { min-height:0; flex:0 0 auto; max-height:30px; margin:4px 0 0; text-align:center; color:#c9a96f; font-size:11px; line-height:1.3; overflow:auto; }
</style>
