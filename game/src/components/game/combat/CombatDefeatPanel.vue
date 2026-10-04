<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBattleActions } from '@/composables/useBattleActions'
import { useAutoRetryCountdown } from '@/composables/useAutoRetryCountdown'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import DefeatHintBlock from '@/components/scenes/defeat/DefeatHintBlock.vue'
import DefeatActionRow from '@/components/scenes/defeat/DefeatActionRow.vue'
import { useVictorySceneModel } from '@/components/scenes/victory/useVictorySceneModel'
import type { VictorySlotView } from '@/components/scenes/victory/victorySceneModel'
import VictorySectionPlaque from '@/components/scenes/victory/VictorySectionPlaque.vue'
import VictoryRewardSlots from '@/components/scenes/victory/VictoryRewardSlots.vue'

// Combat UI Redesign muc 18/23, mo rong 2026-08-22 -- truoc day CHI 1
// nut "Ve Dong Phu" (khong danh lai). Gio them "Tai Chien" (LUON danh
// lai DUNG stage vua thua -- KHONG advance sang Man ke tiep nhu
// CombatVictoryPanel.vue luc thang, vi thua thi khong co ly do "tien
// bo" sang stage moi):
//   - ui.isAuto && explorationMode==='repeat' (Lap Lai Khieu Chien) ->
//     tu dem 3s roi Tai Chien, y het co che Auto-refight cua
//     CombatVictoryPanel.vue.
//   - ui.isAuto && explorationMode==='auto' (Tu Dong Tham Hiem) ->
//     KHONG tu dem 3s (tranh auto-thua-lap-lai ma nguoi choi khong de
//     y) -- chi hien 2 lua chon, cho bam tay.
//   - Ca 2 truong hop tren deu co fallback: 10 giay khong bam gi thi
//     tu ve Dong Phu (khac 3s auto-refight -- dung setTimeout rieng,
//     chi chay khi nhanh 3s KHONG chay).
// Nut "Ve Dong Phu" LUON hien (khac Victory panel an "Tiep Tuc" khi
// isAuto) -- nguoi choi phai huy duoc auto-countdown bat cu luc nao.
// 9.6 -- fallback 10s (da hua trong comment tren nhung CHUA BAO GIO duoc
// implement truoc 2026-09-03): 10 giay khong bam gi thi tu ve Dong Phu,
// bat ke nhanh 3s co chay hay khong (repeat -> refight o 3s se unmount
// panel; manual -> chi minh 10s chay). Chay song song nhanh 3s qua
// useAutoRetryCountdown thay vi setTimeout rieng de dung chung co che
// deadline thuc + stop() don interval (xem useAutoRetryCountdown.ts).
const RETRY_COUNTDOWN_SECONDS = 3
const RETURN_COUNTDOWN_SECONDS = 10

const gameManager = useGameManager()
const ui = useUiStore()
const player = usePlayerStore()
const { t } = useI18n()
const { startBattle, exitCombatToHome } = useBattleActions()

// ARCH-005 (M12): same in-place-mutated summary object every call -- the
// version signal is the only invalidation channel for it.
const { stateVersion } = useStateVersion()

const summary = computed(() => {
  stateVersion.value

  return gameManager.getBattleRewardSummary()
})

const model = useVictorySceneModel(summary)

const titleUrl = resolveAssetUrl('/assets/ui/huyen-kim/scene/defeat-v2/defeat-title-v1.png')
const stageLabel = computed(() => model.stageName.value ?? t('combat.defeat.subtitle'))

// Defeat rewards ride the same tile family as victory: growth gains
// (mastery/insight) become symbol tiles ahead of the treasure slots -
// preserves the old RewardList ordering (growth first, then drops).
const rewardSlots = computed<VictorySlotView[]>(() => {
  const growthTiles: VictorySlotView[] = model.growth.value.map((card) => ({
    id: card.id,
    kind: 'growth',
    icon: null,
    symbol: card.symbol,
    name: t(card.labelKey),
    amount: card.amount,
  }))

  return [...growthTiles, ...model.slots.value]
})

// B2-1 ruling (2026-09-14): floor 1 stays un-winnable on first entry by
// design -- the hint tells the player WHY. At/below the stage's realm
// gate the answer is "cultivate more levels"; above it, gear/pills/
// insight are the gap.
const isCultivationGap = computed(() => {
  const stage = ui.selectedStageId ? gameManager.catalogOps.getStage(ui.selectedStageId) : undefined

  return stage?.requiredRealmLevel !== undefined && player.realmLevel <= stage.requiredRealmLevel
})

const isAutoRetrying = ref(false)

async function refight(): Promise<void> {
  if (!ui.selectedStageId) {
    isAutoRetrying.value = false
    return
  }

  const stage = gameManager.catalogOps.getStage(ui.selectedStageId)

  if (!stage) {
    isAutoRetrying.value = false
    return
  }

  const started = await startBattle(stage)

  if (!started) {
    // A refused/failed start must not leave the retry button permanently
    // disabled (T1-5): re-enable it and disarm auto-retry, same rollback
    // contract as the victory panel's !refight() branch.
    isAutoRetrying.value = false
    ui.battleRunMode = 'manual'
  }
}

const { remaining: retryCountdown, start: startAutoRetryCountdown, stop: stopAutoRetryCountdown } = useAutoRetryCountdown(RETRY_COUNTDOWN_SECONDS, refight)

// 9.6 -- countdown fallback 10s ve Dong Phu; clear chung voi nhanh 3s.
const { remaining: returnCountdown, start: startReturnCountdown, stop: stopReturnCountdown } = useAutoRetryCountdown(RETURN_COUNTDOWN_SECONDS, returnHome)

function clearTimers() {
  stopAutoRetryCountdown()
  stopReturnCountdown()
}

function retryNow() {
  clearTimers()
  void refight()
}

function returnHome() {
  clearTimers()
  // Teardown (run-mode reset, dismissed flag, scene-exit event) runs inside
  // the closed curtain - the defeat panel stays on screen until the swap
  // behind it is ready (useBattleActions).
  exitCombatToHome()
}

onMounted(() => {
  startReturnCountdown()

  if (ui.battleRunMode === 'repeat') {
    isAutoRetrying.value = true
    startAutoRetryCountdown()
  }
})
</script>

<template>
  <div class="combat-defeat-panel">
    <header class="combat-defeat-panel__hero" data-hk-region="title">
      <h1 class="combat-defeat-panel__title">
        <img :src="titleUrl" :alt="t('combat.defeat.title')" />
      </h1>
      <p class="combat-defeat-panel__stage">
        <InkNineSlice chrome-id="scroll-title-plaque" layer="surface" />
        <span class="combat-defeat-panel__stage-name">{{ stageLabel }}</span>
      </p>
      <p class="combat-defeat-panel__flavor">{{ t('combat.defeat.subtitle') }}</p>
    </header>

    <section class="combat-defeat-panel__paper">
      <InkNineSlice chrome-id="imperial-scroll-body" layer="surface" />
      <InkNineSlice chrome-id="frame-xl-ceremony" layer="frame" />
      <div class="combat-defeat-panel__paper-inner">
        <DefeatHintBlock :hint="t(isCultivationGap ? 'combat.defeat.hintCultivate' : 'combat.defeat.hintGear')" />
        <div v-if="rewardSlots.length" class="combat-defeat-panel__reward-col">
          <VictorySectionPlaque>{{ t('combat.defeat.rewardsHeader') }}</VictorySectionPlaque>
          <VictoryRewardSlots :slots="rewardSlots" />
        </div>
      </div>
    </section>

    <DefeatActionRow
      class="combat-defeat-panel__action-row"
      :is-auto-retrying="isAutoRetrying"
      :retry-countdown="retryCountdown"
      :return-countdown="returnCountdown"
      @retry="retryNow"
      @return-home="returnHome"
    />
  </div>
</template>

<style scoped>
/* Scene 16 (huyen-kim reskin): same mock family as Victory - floating
   calligraphy title over the scrim, stage plaque, cream paper
   (imperial-scroll-body + frame-xl-ceremony) split into the reason
   column + reward tile column, dark-metal actions below the paper. */
.combat-defeat-panel {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  width: min(64vw, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  font-family: var(--font-body);
}

.combat-defeat-panel__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 6px;
}
.combat-defeat-panel__title {
  margin: 0;
  width: min(56%, 600px);
}
.combat-defeat-panel__title img {
  display: block;
  width: 100%;
  filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.6));
}
.combat-defeat-panel__stage {
  position: relative;
  isolation: isolate;
  margin: 4px auto 0;
  min-width: 240px;
  padding: 9px 34px;
}
.combat-defeat-panel__stage-name {
  position: relative;
  z-index: 3;
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--hk-gold-radiant, #f4d98b);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}
.combat-defeat-panel__flavor {
  margin: 6px 0 0;
  font-size: var(--text-sm);
  color: var(--hk-text-secondary, #e5d3a9);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.85);
}

.combat-defeat-panel__paper {
  position: relative;
  isolation: isolate;
  width: 100%;
  padding: 30px 44px 26px;
  filter: drop-shadow(0 9px 14px rgba(0, 0, 0, 0.55));
}
.combat-defeat-panel__paper > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}
.combat-defeat-panel__paper-inner {
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) 1.6fr;
  gap: 22px;
  align-items: start;
  text-align: left;
}
.combat-defeat-panel__reward-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.combat-defeat-panel__action-row {
  margin-top: 14px;
}
</style>
