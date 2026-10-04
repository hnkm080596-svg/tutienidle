<script setup lang="ts">
// Dev-only bridge for the Phap Tu test lab (window.__tutienPhapTuLab).
//
// The lab's battle entry must reuse the canonical startSelectedStage
// path, which lives in useBattleActions - but useBattleActions inject()s
// the GameManager/presentation keys, and inject() inside App.vue's own
// setup cannot see provide() calls made in that same setup (the root
// component reads app-level provides only). Mounting this child makes
// the injection legal, so the poke keeps the real admitted combat path
// instead of a re-implemented copy.
//
// Hidden mount point, no UI. Registration is gated here (DEV + mock
// backend) matching the enemySpawnDebug registration in App.vue's
// bootGame, so the poke never arms itself against a real backend save.
import { onMounted } from 'vue'
import { registerPhapTuLab } from '../core/dev/phapTuLab'
import { useBattleActions } from '../composables/useBattleActions'
import { useGameManager, useStateVersion } from '../composables/useGameState'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { backendBundle } from '../services/backend/backendBundle'

const gameManager = useGameManager()
const { bumpState } = useStateVersion()
const player = usePlayerStore()
const ui = useUiStore()
const battleActions = useBattleActions()

onMounted(() => {
  if (!import.meta.env.DEV || backendBundle.mode !== 'mock') {
    return
  }

  registerPhapTuLab({
    gameManager,
    player,
    getPlayerState: () => player.$state,
    enterStage: (zoneId, stage) => battleActions.startSelectedStage(zoneId, stage, 'manual'),
    exitCombat: () => battleActions.exitCombatToHome({ abandon: true }),
    openSkillPanel: () => ui.openStandalonePanel('skill'),
    setManualInput: (enabled) => {
      ui.setCombatInputMode(enabled ? 'manual' : 'auto')
      gameManager.setBattleManualMode(enabled)
    },
    refreshUi: bumpState,
  })
})
</script>

<template>
  <div style="display: none" aria-hidden="true" />
</template>
