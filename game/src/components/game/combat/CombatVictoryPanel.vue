<script setup lang="ts">
// Scene 14 VICTORY mount point: owns the battle-side behavior (refight
// stage resolution, continue teardown, auto-refight countdown) and
// renders the decomposed scroll in components/scenes/victory/*.
// Presentation restructure only - same countdown contract (manual:
// retry+continue; auto: locked retry with countdown).
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBattleActions } from '@/composables/useBattleActions'
import { useAutoRetryCountdown } from '@/composables/useAutoRetryCountdown'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { formatDuration } from '@/core/format/formatDuration'
import { resolveNextProgressStage } from '@/core/stage/ProgressStageResolver'
import VictoryScene from '@/components/scenes/victory/VictoryScene.vue'

// Combat UI Redesign muc 14-19 -- thang thi hien reward tich luy ca
// tran (xem GameManager.getBattleRewardSummary()). Auto Battle OFF:
// "Danh Lai"/"Tiep Tuc" bam tay. Auto Battle ON: "Danh Lai" toi mau +
// dem nguoc 3s roi TU bat dau tran moi -- thang + explorationMode
// 'auto' thi leo len Man ke tiep trong Dia Gioi (y het logic
// Auto-refight cu cua App.vue's tick(), chi doi trigger tu "ngay tick
// do" sang "het dem nguoc" -- xem plan muc 15/19).
const COUNTDOWN_SECONDS = 3

const gameManager = useGameManager()
const ui = useUiStore()
const player = usePlayerStore()
const { startBattle, exitCombatToHome } = useBattleActions()

// ARCH-005 (M12): getBattleRewardSummary() returns the same in-place-
// mutated summary object every call -- without a direct version read this
// computed evaluates once and caches forever.
const { stateVersion } = useStateVersion()

const summary = computed(() => {
  stateVersion.value

  return gameManager.getBattleRewardSummary()
})

async function refight(): Promise<boolean> {
  if (!ui.selectedStageId) {
    return false
  }

  const stage = gameManager.catalogOps.getStage(ui.selectedStageId)

  if (!stage) {
    return false
  }

  return startBattle(stage)
}

function retryNow() {
  void refight()
}

function continueToStageSelect() {
  // Teardown runs inside the closed curtain - the victory panel stays on
  // screen until the swap behind it is ready (useBattleActions).
  exitCombatToHome()
}

const { remaining: countdown, start: startAutoRefightCountdown } = useAutoRetryCountdown(COUNTDOWN_SECONDS, async () => {
  // Tu Dong Tham Hiem -- chi tien khi resolver xac nhan man ke da mo. Man
  // ton tai nhung bi gate boi tu vi la trang thai dung auto hop le, khong
  // duoc goi startStage() mu roi de modal victory ket o 0s.
  if (ui.battleRunMode === 'progress' && ui.selectedZoneId && ui.selectedStageId) {
    const resolution = resolveNextProgressStage(
      gameManager,
      player.$state,
      ui.selectedZoneId,
      ui.selectedStageId,
    )

    if (resolution.status === 'ready') {
      const nextStageId = resolution.stage.id

      if (!gameManager.catalogOps.isStageUnlocked(nextStageId, player.$state)) {
        // Co man ke tiep nhung progression hien tai chua mo no (vd thang 1.5
        // khi moi o canh gioi tang 5). Ket thuc auto bang UI thu cong thay vi
        // goi startStage() that bai roi ket modal victory o countdown 0s.
        ui.battleRunMode = 'manual'

        return
      }

      const previousStageId = ui.selectedStageId
      ui.selectedStageId = nextStageId

      if (!(await refight())) {
        ui.selectedStageId = previousStageId
        ui.battleRunMode = 'manual'
      }

      return
    } else {
      // Da hoan tat tuyen hien tai: progress phai dung, khong duoc am tham
      // bien thanh repeat o tang cuoi. Cung nhanh nay xu ly stage ke bi khoa
      // hoac du lieu dich khong hop le de modal tro lai tuong tac duoc.
      ui.battleRunMode = 'manual'

      return
    }
  }

  if (!(await refight())) {
    ui.battleRunMode = 'manual'
  }
})

const { t } = useI18n()
const countdownLabel = computed(() => t('combat.victory.retryCountdown', { duration: formatDuration(countdown.value, 'countdown') }))

onMounted(() => {
  if (ui.battleRunMode !== 'manual') {
    startAutoRefightCountdown()
  }
})
</script>

<template>
  <VictoryScene
    class="combat-victory-panel"
    :summary="summary"
    :run-mode="ui.battleRunMode"
    :countdown-label="countdownLabel"
    @retry="retryNow"
    @continue="continueToStageSelect"
  />
</template>
