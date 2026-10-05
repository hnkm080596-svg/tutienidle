<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { useTurnCombatManual } from '@/composables/useTurnCombatManual'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import GameButton from '@/components/common/GameButton.vue'

// Combat UI Redesign muc 5 -- ten Dia Gioi/Man + tien do quai. UI audit
// 2026-09-28: the muc-23 "no retreat" call predates the exit-confirm
// modal (6A-T6) -- the modal exists and works, so the top bar now carries
// the visible exit affordance. The button only emits the bridge event
// `combat_exit_request`; CombatExitConfirmModal owns confirm/abandon.
// Still no Settings button (no sane home for SettingsPanel while Combat
// Scene owns the screen).
//
// ui-combat reskin (2026-10-04): mock ui-combat.html centers an ornate
// stage plaque (zone small + stage big) and gathers the utility cluster
// right: enemy counter, the Tu Dong/Thu Cong mode toggle (moved from the
// skill bar - selector class kept for e2e/tooling compatibility), a
// circular pause toggle (clock freeze reason 'user-pause', no overlay),
// and the exit button.
const { t } = useI18n()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const ui = useUiStore()

const { battle, isBattleFighting } = useTurnCombatManual()

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

// Stage battles only -- Tribulation runs its own flow and the modal gates
// on combatOrigin anyway. Hidden while the battle is not actually fighting
// (intro/results own their screens).
const canExit = computed(() => ui.combatOrigin === 'stage' && isBattleFighting.value)

function requestExit(): void {
  gameManager.eventBus.emit('combat_exit_request', undefined)
}

// Auto/Manual toggle (moved up from TurnCombatSkillBar for the reskin) -
// same read/write pair: ui.combatInputMode persists per-device,
// GameManager flag syncs the live battle. `turn-combat-skill-bar__mode-toggle`
// class is kept on the label for selector compatibility.
const isManualMode = computed(() => ui.combatInputMode === 'manual')

function setManualMode(enabled: boolean): void {
  ui.setCombatInputMode(enabled ? 'manual' : 'auto')

  gameManager.setBattleManualMode(enabled)
}

// Sync persisted mode -> GameManager on mount (reload page: ui flag
// persists, GameManager flag defaults false) - was the skill bar's
// onMounted before the move.
onMounted(() => {
  gameManager.setBattleManualMode(ui.combatInputMode === 'manual')
})

// Pause toggle (ui-combat reskin) - a plain clock freeze reason
// ('user-pause'), composing like 'tab-hidden': the clock runs only when
// the reason set is empty. No overlay - the pause overlay belongs to
// tab-hidden via useCombatPause.
const userPaused = ref(false)

function togglePause(): void {
  // Pausing only means something while the clock can run - a click on
  // the result screen would just latch the seal look without freezing
  // anything (the ended battle's clock is already stopped).
  if (!isBattleFighting.value && !userPaused.value) {
    return
  }

  userPaused.value = !userPaused.value

  if (userPaused.value) {
    gameManager.freezeCombat('user-pause')
  } else {
    gameManager.resumeCombat('user-pause')
  }

  bumpState()
}

// A fresh TurnBattle object means a new clock - drop the latch so a
// stale 'user-pause' never leaks into the next battle.
watch(battle, () => {
  userPaused.value = false
})

// If the overlay dies while paused (scene switch without battle_end),
// the ops-level clock would keep 'user-pause' with no UI left to clear
// it - release the reason with the button that owns it.
onUnmounted(() => {
  if (userPaused.value) {
    gameManager.resumeCombat('user-pause')
  }
})
</script>

<template>
  <div class="combat-top-bar">
    <!-- Centered ornate plaque (mock): section-plaque chrome, zone over
         stage name. `__plaque` class kept on the frame wrapper. -->
    <div class="combat-top-bar__plaque">
      <InkNineSlice chrome-id="section-plaque" layer="surface" />
      <span class="combat-top-bar__plaque-text">
        <span v-if="zoneName" class="combat-top-bar__zone">{{ zoneName }}</span>
        <span class="combat-top-bar__title">{{ stage?.name ?? zoneName }}</span>
      </span>
    </div>

    <div class="combat-top-bar__side">
      <span v-if="hiddenTrial" class="combat-top-bar__trial">
        {{ t('hidden.trial.banner', { name: t('hidden.mortal.beastName'), elapsed: hiddenTrial.roundsElapsed, required: hiddenTrial.survivalRounds }) }}
      </span>
      <span v-else-if="progress" class="combat-top-bar__progress">{{ progress.spawned }} / {{ progress.total }} {{ t('combat.overlay.topBar.enemiesSuffix') }}</span>

      <label class="combat-top-bar__auto turn-combat-skill-bar__mode-toggle" :class="{ 'is-on': isManualMode }">
        <input
          type="checkbox"
          class="combat-top-bar__auto-input"
          :checked="isManualMode"
          @change="setManualMode(($event.target as HTMLInputElement).checked)"
        />
        <span class="combat-top-bar__control">{{ t(isManualMode ? 'combat.overlay.topBar.manualMode' : 'combat.overlay.topBar.autoMode') }}</span>
      </label>

      <GameButton
        variant="secondary"
        shape="circle"
        class="combat-top-bar__pause"
        :aria-label="t(userPaused ? 'combat.overlay.topBar.resume' : 'combat.overlay.topBar.pause')"
        :aria-pressed="userPaused"
        @click="togglePause"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="combat-top-bar__pause-icon">
          <path v-if="userPaused" d="M8 5 19 12 8 19Z" />
          <path v-else d="M7 5h3v14H7zM14 5h3v14h-3z" />
        </svg>
      </GameButton>

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
  /* Layout fix (2026-09-07, plan Task 13) -- box-sizing border-box: truoc
     day height:100% (46px token) + border-bottom 1px = 47px tong (content-
     box mac dinh) -> tran 1px de len boi skill dock (top: 46px), fail
     combat-overlay-layout e2e ca 3 viewport. Border-box dua tong ve dung
     token, dock va TopBar khop mep tuyet doi. */
  box-sizing: border-box;
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 20px;
  background: color-mix(in srgb, var(--ink-950) 70%, transparent);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid color-mix(in srgb, var(--frame-outer) 55%, transparent);
  font-family: var(--font-body);
  pointer-events: auto;
}

/* Centered stage plaque (ui-combat reskin): section-plaque chrome, a
   touch taller than the slim bar so the frame reads - like the mock's
   banner. Absolutely centered; never intercepts pointer input. */
.combat-top-bar__plaque {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(30vw, 400px);
  min-width: 200px;
  height: calc(100% + 14px);
  max-height: 76px;
  isolation: isolate;
  pointer-events: none;
}

.combat-top-bar__plaque > :not(.ink-nine-slice) {
  position: relative;
  z-index: 2;
}

.combat-top-bar__plaque-text {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
}

.combat-top-bar__zone {
  font-family: var(--font-display);
  font-size: var(--text-xs);
  color: #e4cf95;
  letter-spacing: 0.06em;
  line-height: 1.1;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.combat-top-bar__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(13px, 1.4vw, var(--text-body));
  color: #fff1c6;
  letter-spacing: 0.02em;
  line-height: 1.15;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.combat-top-bar__side {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.combat-top-bar__progress {
  font-size: var(--text-sm);
  color: #e7d8ae;
}

.combat-top-bar__trial {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--crimson);
}

/* The utility cluster from the mock: flat gold-hairline buttons on a
   dark ink fill, serif display font. Shared by the auto toggle, pause
   button (GameButton circle) and exit button. */
.combat-top-bar__control,
.combat-top-bar__exit {
  min-height: 32px;
  padding: 4px 12px;
  border: 1px solid #b69b58;
  border-radius: 4px;
  background: #0c1616e8;
  color: #ead69f;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
}

.combat-top-bar__control:hover,
.combat-top-bar__exit:hover {
  color: #ffe8a4;
  border-color: #e4c673;
}

/* The real checkbox stays in the DOM for selector/state compatibility
   (tooling pokes `__mode-toggle input`) but the look is the mock's
   labeled utility button; :is-on = manual mode engaged. */
.combat-top-bar__auto {
  display: inline-flex;
  cursor: pointer;
}

.combat-top-bar__auto-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.combat-top-bar__auto.is-on .combat-top-bar__control {
  color: #ffe8a4;
  border-color: #e4c673;
  box-shadow: inset 0 0 8px #b79b4333;
}

.combat-top-bar__auto:focus-within .combat-top-bar__control {
  outline: 2px solid rgba(217, 212, 199, 0.65);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--hk-gold-muted), 0 0 10px var(--hk-glow-gold);
}

.combat-top-bar__pause {
  min-width: 36px;
  min-height: 36px;
  color: #e4ca83;
}

.combat-top-bar__pause-icon {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.combat-top-bar__pause[aria-pressed='true'] {
  color: #ffe8a4;
}
</style>
