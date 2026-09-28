<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { useTurnCombatManual } from '@/composables/useTurnCombatManual'

// Combat UI Redesign mục 5 — tên Địa Giới/Màn + tiến độ quái. UI audit
// 2026-09-28: the mục-23 "no retreat" call predates the exit-confirm
// modal (6A-T6) — the modal exists and works, so the top bar now carries
// the visible exit affordance. The button only emits the bridge event
// `combat_exit_request`; CombatExitConfirmModal owns confirm/abandon.
// Still no Settings button (no sane home for SettingsPanel while Combat
// Scene owns the screen).
const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const ui = useUiStore()

const { isBattleFighting } = useTurnCombatManual()

const stage = computed(() => ui.selectedStageId ? gameManager.catalogOps.getStage(ui.selectedStageId) : undefined)

const zoneName = computed(() => {
  if (!ui.selectedZoneId) {
    return ''
  }

  return gameManager.zoneRegistry.has(ui.selectedZoneId) ? gameManager.zoneRegistry.get(ui.selectedZoneId).name : ''
})

const progress = computed(() => {
  stateVersion.value

  return gameManager.turnBattleOps.getStageProgress()
})

// HIDDEN-B (design sec.9.6) - while a hidden trial battle is live the
// top bar swaps the stage-progress counter for the survival objective.
const hiddenTrial = computed(() => {
  stateVersion.value

  return gameManager.turnBattleOps.getActiveHiddenTrial()
})

// Stage battles only — Tribulation runs its own flow and the modal gates
// on combatOrigin anyway. Hidden while the battle is not actually fighting
// (intro/results own their screens).
const canExit = computed(() => ui.combatOrigin === 'stage' && isBattleFighting.value)

function requestExit(): void {
  gameManager.eventBus.emit('combat_exit_request', undefined)
}
</script>

<template>
  <div class="combat-top-bar">
    <span class="combat-top-bar__title">{{ zoneName }}<template v-if="stage"> • {{ stage.name }}</template></span>

    <div class="combat-top-bar__side">
      <span v-if="hiddenTrial" class="combat-top-bar__trial">
        {{ t('hidden.trial.banner', { name: t('hidden.mortal.beastName'), elapsed: hiddenTrial.roundsElapsed, required: hiddenTrial.survivalRounds }) }}
      </span>
      <span v-else-if="progress" class="combat-top-bar__progress">{{ progress.spawned }} / {{ progress.total }} {{ t('combat.overlay.topBar.enemiesSuffix') }}</span>

      <button
        v-if="canExit"
        type="button"
        class="combat-top-bar__exit"
        :aria-label="t('combat.overlay.exitConfirm.exit')"
        @click="requestExit"
      >
        {{ t('combat.overlay.exitConfirm.exit') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.combat-top-bar {
  /* Layout fix (2026-09-07, plan Task 13) — box-sizing border-box: trước
     đây height:100% (46px token) + border-bottom 1px = 47px tổng (content-
     box mặc định) → tràn 1px đè lên bởi skill dock (top: 46px), fail
     combat-overlay-layout e2e cả 3 viewport. Border-box đưa tổng về đúng
     token, dock và TopBar khớp mép tuyệt đối. */
  box-sizing: border-box;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: color-mix(in srgb, var(--ink-950) 70%, transparent);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid color-mix(in srgb, var(--frame-outer) 55%, transparent);
  font-family: var(--font-body);
  pointer-events: auto;
}

.combat-top-bar__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-body);
  color: var(--chrome-100);
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.combat-top-bar__progress {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.combat-top-bar__trial {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--crimson);
}

.combat-top-bar__side {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.combat-top-bar__exit {
  flex: none;
  padding: 3px 10px;
  border: 1px solid color-mix(in srgb, var(--frame-outer) 55%, transparent);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  cursor: pointer;
}

.combat-top-bar__exit:hover {
  border-color: var(--crimson);
  color: var(--crimson);
}
</style>
