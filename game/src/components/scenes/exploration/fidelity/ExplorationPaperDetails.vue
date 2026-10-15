<script setup lang="ts">
import GameCard from "@/components/common/GameCard.vue"
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import GameActionButton from '@/components/common/GameActionButton.vue'
import GameDropdownButton from '@/components/common/GameDropdownButton.vue'
import SlotView from '@/components/common/SlotView.vue'
import type { ExplorationPaperModel, ExplorationDetail } from './explorationUi'
const props = defineProps<{ model: ExplorationPaperModel; stage: ExplorationDetail | null; notice: string }>()
const emit = defineEmits<{ mode: [id: string]; openBuild: []; start: [] }>()
const { t } = useI18n()
const modeOptions = computed(() => props.stage?.modes.map(chip => ({ value:chip.id, label:chip.label, disabled:chip.disabled })) ?? [])
const currentMode = computed(() => props.stage?.modes.find(chip => chip.active)?.id ?? '')
function pickMode(id:string) {
  const mode = props.stage?.modes.find(chip => chip.id === id)
  if (mode && !mode.disabled) emit('mode',id)
}
</script>
<template>
  <GameCard as="aside" class="exploration-details" :title="stage?.title ?? model.title">
    <template v-if="stage">

      <div class="details-body">
        <p v-if="stage.disabledLabel" class="disabled-line">{{ stage.disabledLabel }}</p>
        <h3 class="section-heading">{{ t('exploration.rewards') }}</h3>
        <div class="rewards"><div v-for="(reward, index) in stage.rewards" :key="index" class="reward"><SlotView :item="reward" :icon="reward.icon" :label="reward.label" :variant="reward.variant ?? 'item'" :accessible-label="[reward.label, reward.amount].filter(Boolean).join(' ')" :tooltip="reward.tooltip" show-label /><strong>{{ reward.amount }}</strong></div></div>
      </div>
      <!-- Mode picker stays under the rewards (Minh 2026-10-12); the
           list opens UPWARD over the rewards body so it never
           overflows the card bottom. The armed-farm banner is gone on
           his call - the Dong Fu AutoFarmIndicator keeps stop duty. -->
      <div class="mode-block" v-tooltip="{title:currentMode ? modeOptions.find(option=>option.value===currentMode)?.label : t('exploration.modes'),description:stage.modeHint}">
        <GameDropdownButton :model-value="currentMode" :options="modeOptions" :label="t('exploration.modes')" placement="up" hide-selected @update:model-value="pickMode" />
      </div>
      <div class="start-row">
        <GameActionButton :gold="false" class="build-link" @click="emit('openBuild')">{{ stage.buildLabel }}</GameActionButton>
        <div class="challenge-tooltip" v-tooltip="stage.startDisabled ? {title:stage.startLabel,description:stage.disabledLabel} : undefined"><GameActionButton class="challenge" :disabled="stage.startDisabled" data-testid="stage-start-button" @click="emit('start')">{{ stage.startLabel }}</GameActionButton></div>
      </div>
    </template>
    <template v-else><p class="empty-line">{{ t('exploration.empty') }}</p></template>
    <p class="notice" role="status">{{ notice }}</p>
  </GameCard>
</template>
<style scoped>
.exploration-details { position:relative; min-height:0; display:flex; flex-direction:column; gap:4px; }
.details-body { flex:1; min-height:0; overflow:auto; scrollbar-width:none; }
.details-body::-webkit-scrollbar { display:none; }
.disabled-line { font-size:12px; color:#d98d6a; margin:5px 0; text-align:center; }
.section-heading { margin:12px 0 6px; border-block:1px solid #ab8a4b66; padding:6px 0; font-size:15px; font-weight:600; text-align:center; color:#f0dcae; }
.rewards { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; padding-top:4px; }
.reward { flex:0 0 auto; width:52px; text-align:center; font-size:10px; }
.reward .slot-view { width:100%; }
.reward strong { display:block; margin-top:2px; font-weight:500; font-size:12px; color:#c4d9a8; }
.mode-block { flex:none; margin-top:6px; display:flex; justify-content:center; }
.start-row { display:flex; flex-direction:column; align-items:center; gap:0; margin-top:auto; }
.build-link.game-action-button { width:100%; height:58px; aspect-ratio:auto; font-size:24px; }
.challenge.game-action-button { width:100%; height:58px; aspect-ratio:auto; font-size:24px; }
.challenge-tooltip { width:100%; }
.empty-line { margin-top:16px; font-size:13px; color:#b99f6d; font-style:italic; text-align:center; }
.notice { min-height:0; flex:none; max-height:30px; margin:4px 0 0; text-align:center; color:#c9a96f; font-size:11px; line-height:1.3; overflow:auto; }
</style>
