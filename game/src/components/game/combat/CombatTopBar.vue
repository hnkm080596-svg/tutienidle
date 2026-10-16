<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'
import { useTurnCombatManual } from '@/composables/useTurnCombatManual'
import GameCardTitle from '@/components/common/GameCardTitle.vue'
import CombatControlButton from '@/components/scenes/combat/CombatControlButton.vue'
import { getCombatPlaybackSpeed, setCombatPlaybackSpeed } from '@/presentation/combat/CombatPlaybackSpeed'


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
const playbackSpeed = ref(getCombatPlaybackSpeed())
function togglePlaybackSpeed(): void {
  playbackSpeed.value = playbackSpeed.value === 1 ? 2 : 1
  setCombatPlaybackSpeed(playbackSpeed.value)
}

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

// r39 adjudication - this button owns the 'user-pause' latch: the clock
// accepts an arm only while userPaused holds, so a foreign emit-listener
// plant cannot wedge the battle behind a button showing unpaused.
const unregisterUserPauseTruth = gameManager.registerFreezeLatchTruth(
  'user-pause',
  () => userPaused.value,
)

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
  unregisterUserPauseTruth()
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
      <GameCardTitle class="combat-top-bar__region-title" :label="stage?.name || zoneName" />
    </div>

    <div class="combat-top-bar__side">
      <span v-if="hiddenTrial" class="combat-top-bar__trial">
        {{ t('hidden.trial.banner', { name: t('hidden.mortal.beastName'), elapsed: hiddenTrial.roundsElapsed, required: hiddenTrial.survivalRounds }) }}
      </span>
      <span v-else-if="progress" class="combat-top-bar__progress">{{ progress.spawned }} / {{ progress.total }} {{ t('combat.overlay.topBar.enemiesSuffix') }}</span>

      <div class="combat-top-bar__auto turn-combat-skill-bar__mode-toggle" :class="{ 'is-on': isManualMode }">
        <input
          type="checkbox"
          class="combat-top-bar__auto-input" tabindex="-1" aria-hidden="true"
          :checked="isManualMode"
          @change="setManualMode(($event.target as HTMLInputElement).checked)"
        />
        <CombatControlButton class="combat-top-bar__mode" :class="{ 'is-auto-mode': !isManualMode }" @click="setManualMode(!isManualMode)"><svg v-if="!isManualMode" class="combat-auto-glow" viewBox="0 0 108 49" aria-hidden="true"><path d="M14 8H94L102 15V35L94 42H14L6 35V15Z" fill="none" stroke="#bfe8da" stroke-width="1" stroke-dasharray="35 250" /></svg>{{ t(isManualMode ? 'combat.overlay.topBar.manualMode' : 'combat.overlay.topBar.autoMode') }}</CombatControlButton>
      </div>

      <CombatControlButton class="combat-top-bar__speed" :selected="playbackSpeed === 2" :aria-pressed="playbackSpeed === 2" :aria-label="t('combat.playbackSpeed', { speed: playbackSpeed })" @click="togglePlaybackSpeed">×{{ playbackSpeed }}</CombatControlButton>
      <CombatControlButton


        class="combat-top-bar__pause"
        :aria-label="t(userPaused ? 'combat.overlay.topBar.resume' : 'combat.overlay.topBar.pause')"
        :aria-pressed="userPaused"
        :selected="userPaused"
        @click="togglePause"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="combat-top-bar__pause-icon">
          <path v-if="userPaused" d="M8 5 19 12 8 19Z" />
          <path v-else d="M7 5h3v14H7zM14 5h3v14h-3z" />
        </svg>
      </CombatControlButton>

      <CombatControlButton
        v-if="canExit"
        class="combat-top-bar__exit"
        :aria-label="t('combat.overlay.exitConfirm.exit')"
        @click="requestExit"
      >
        {{ t('combat.overlay.exitConfirm.exit') }}
      </CombatControlButton>
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
  background: transparent;
  font-family: var(--font-body);
  pointer-events: none;
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

.combat-top-bar__plaque > .combat-top-bar__plaque-text {
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
  position: absolute;
  right: 24px;
  top: 62px;
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
   button (CombatControlButton circle) and exit button. */
.combat-top-bar__control {
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

.combat-top-bar__control:hover {
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
.combat-top-bar__side { pointer-events: auto; }
.combat-top-bar__plaque.game-card { padding: 0; }
.combat-top-bar__mode.game-tab-button { height: 38px; min-width: 110px; }
.combat-top-bar__exit.game-action-button { height: 38px; min-width: 100px; border: 0; background: transparent; padding: 0 12px; }
.combat-top-bar__pause.game-action-button { height: 38px; width: 48px; padding: 0; }
.combat-top-bar__plaque.combat-art-surface { left: 14px; top: 3px; transform: none; width: 390px; min-width: 0; height: 86px; padding: 0; }
.combat-top-bar__zone { font-size: 23px; }
.combat-top-bar__title { font-size: 16px; font-weight: 400; }
.combat-top-bar__side { position: absolute; right: 18px; top: 14px; gap: 6px; }
.combat-top-bar__mode.combat-control-button,.combat-top-bar__exit.combat-control-button { width: 110px; height: 50px; padding: 8px 12px; background-color: transparent; border: 0; }
.combat-top-bar__pause.combat-control-button { width: 54px; height: 50px; }
.combat-top-bar__progress,.combat-top-bar__trial { max-width: 145px; font-size: 13px; }
.combat-top-bar__pending .combat-control-button { width: 64px; height: 50px; }
.combat-top-bar__plaque { left: 14px; top: 12px; transform: none; width: 300px; height: 74px; min-width: 0; max-height: none; text-align: center; }
.combat-top-bar__region-title.game-card-title { width: 300px; height: 44px; font-size: 23px; }
.combat-top-bar__stage-label { display: block; margin-top: 4px; color: #e5d4af; font-size: 16px; }
.combat-auto-glow { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; filter: drop-shadow(0 0 2px #9ccfbd); } .combat-auto-glow path { animation: combat-auto-flow 3s linear infinite; } @keyframes combat-auto-flow { to { stroke-dashoffset: -285; } } @media (prefers-reduced-motion: reduce) { .combat-auto-glow path { animation: none; } }
</style>
