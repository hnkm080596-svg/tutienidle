<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBattleActions } from '@/composables/useBattleActions'
import { useAutoRetryCountdown } from '@/composables/useAutoRetryCountdown'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import InkWashBackdrop from '@/components/common/InkWashBackdrop.vue'
import DefeatTitleBand from '@/components/scenes/defeat/DefeatTitleBand.vue'
import DefeatHintBlock from '@/components/scenes/defeat/DefeatHintBlock.vue'
import DefeatRewardBlock from '@/components/scenes/defeat/DefeatRewardBlock.vue'
import DefeatActionRow from '@/components/scenes/defeat/DefeatActionRow.vue'

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

// B2-1 ruling (2026-09-14): floor 1 stays un-winnable on first entry by
// design -- the hint tells the player WHY. At/below the stage's realm
// gate the answer is "cultivate more levels"; above it, gear/pills/
// insight are the gap.
const isCultivationGap = computed(() => {
  const stage = ui.selectedStageId ? gameManager.catalogOps.getStage(ui.selectedStageId) : undefined

  return stage?.requiredRealmLevel !== undefined && player.realmLevel <= stage.requiredRealmLevel
})

const hasAnyReward = computed(() => {
  stateVersion.value

  return summary.value.techniqueMastery > 0 || summary.value.skillInsight > 0 || summary.value.artifactInsight > 0 || summary.value.spiritStone > 0 || summary.value.items.length > 0
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
  <div class="combat-defeat-panel paper-on-dark">
    <InkWashBackdrop left-mountain bottom-mist :right-mountain="false" />
    <InkNineSlice chrome-id="surface-xl-scroll" layer="surface" />
    <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" tint-var="--cinnabar" />

    <DefeatTitleBand :title="t('combat.defeat.title')" :subtitle="t('combat.defeat.subtitle')" />

    <DefeatHintBlock :hint="t(isCultivationGap ? 'combat.defeat.hintCultivate' : 'combat.defeat.hintGear')" />

    <DefeatRewardBlock v-if="hasAnyReward" :summary="summary" />

    <DefeatActionRow
      :is-auto-retrying="isAutoRetrying"
      :retry-countdown="retryCountdown"
      :return-countdown="returnCountdown"
      @retry="retryNow"
      @return-home="returnHome"
    />
  </div>
</template>

<style scoped>
/* Scene 16: same ceremonial family as Victory - ink + cinnabar. */
.combat-defeat-panel {
  /* .paper-on-dark owns the paper->surface remap (theme.css). */
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  /* Spec envelope 760 design px = 45.45% of the 1672 frame - identical
     to the victory scroll's width; a fixed ~582px was only correct at
     1280w. */
  width: min(45.45vw, calc(100vw - 32px));
  padding: 34px 40px 30px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  text-align: center;
  font-family: var(--font-body);
}

.combat-defeat-panel > :not(.ink-nine-slice):not(.ink-wash-backdrop) {
  position: relative;
  z-index: 3;
}
</style>
