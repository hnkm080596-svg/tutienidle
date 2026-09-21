// P4-M1 - deterministic combat simulation harness (plan:
// docs/superpowers/plans/2026-09-22-deterministic-combat-simulation.md).
// An ORCHESTRATOR, not a rule owner: constructs a real GameManager,
// registers the real catalogs, restores the detached build snapshot
// through the canonical M1 restore seams, installs ManualClockSource +
// SeededCombatRng through the existing seams, drives the clock to
// terminal, and reads only public surfaces. Headless tooling - nothing
// on the gameplay path may import it.

import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { driveTurnBattleToTerminal } from './BattleDriver'
import { SeededCombatRng } from '../battle/runtime/rng/SeededCombatRng'
import { GameManager } from '../game/GameManager'
import type { PlayerData } from '../player/Player'
import type { Skill } from '../skill/Skill'
import type { Technique } from '../technique/Technique'
import type { Enemy } from '../enemy/Enemy'
import type { Stage } from '../stage/Stage'
import type { CultivationPathId, CultivationWayId } from '../player/CultivationPathKit'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../data/progression/TheTuAnNodes'
import { ENEMIES } from '../../data/enemy/Enemies'
import { STAGES } from '../../data/stage/Stages'
import type { ElementType } from '../element/ElementType'
import type { SpellPathRoute } from '../phap-tu/PhapTuState'
import { BattleMetricsCollector, type BattleMetrics } from './BattleMetrics'

// Detached post-ritual build identity - PlayerData alone is NOT enough:
// path capabilities read skillManager.has(), kit resolution and scaled
// passives read SkillSystem, equipped-technique combat modifiers read
// TechniqueManager. All three are restored per run via the canonical
// M1 session-restore seams (restore() deep-clones its payload).
export interface SimBuildSnapshot {
  player: PlayerData
  skills: Skill[]
  techniques: Technique[]
}

// Exactly one encounter variant - no optional-field precedence. There is
// no production multi-enemy raw seam (startBattle* take a singular
// enemy), so multi-enemy goes through a real/in-memory Stage.
export type SimEncounter =
  | { kind: 'stage'; stageId: string }
  // The stage's enemyPool templates travel WITH the encounter - a custom
  // stage is unregistered content, so its enemies register alongside it.
  | { kind: 'customStage'; stage: Stage; enemies: readonly Enemy[] }
  | { kind: 'enemy'; enemy: Enemy }

// P5 - canonical post-ritual setup writes. A CLOSED union (never
// callbacks - an arbitrary mutation seam inside the harness): each
// entry maps 1:1 onto a public GameManagerProgressionOps writer.
// A recipe needing a new setup operation extends the union explicitly.
export type SimulationCanonicalWrite =
  | { type: 'select_phap_tu_element'; element: ElementType; route: SpellPathRoute }
  | { type: 'purchase_node'; nodeId: string }

export interface BattleSimulationInput {
  seed: number
  build: SimBuildSnapshot
  // Optional PAIR - both required together. Runs the real
  // chooseCultivationPath; the snapshot's player must be pre-ritual
  // (the ritual legitimately rejects an already-chosen player).
  ritual?: { pathId: CultivationPathId; wayId: CultivationWayId }
  // Ordered canonical post-ritual writes (P5 BaselineRecipe setup) -
  // executed through the public progressionOps surface AFTER the ritual,
  // BEFORE battle start. A write returning false fails the run loudly.
  postRitual?: readonly SimulationCanonicalWrite[]
  encounter: SimEncounter
  // Consumed-step cap (turn_battle_entity_snapshot count), default 5000.
  maxSteps?: number
  // How much wall time each ManualClockSource.advance() feeds per
  // iteration (default COMBAT_STEP_SECONDS). A test-only FPS knob -
  // the engine consumes integer fixed steps regardless, so chunking
  // must never change the result (the FPS-independence proof).
  advanceChunkSeconds?: number
}

export interface BattleSimulationResult {
  outcome: 'victory' | 'defeat' | 'timeout'
  // ALL consumed lifecycle steps (intro + countdown + fighting).
  steps: number
  durationSeconds: number
  // Consumed steps with snapshot.phase === 'fighting' - the DPS/TTK
  // time base (intro/countdown are fixed presentation time).
  fightingSteps: number
  combatDurationSeconds: number
  metrics: BattleMetrics
  // FNV-1a over the normalized digest - the determinism witness.
  fingerprint: string
  diagnostics: {
    // Wall-clock consumables stripped from the cloned player - never
    // silently dropped (timed effects are not deterministic build
    // identity; a deterministic `now` seam is a deferred conditional
    // repair if a future sim needs buffed builds).
    timedEffectsStripped: number
    // Observability gaps recorded honestly (full mitigation, regen
    // overheal) instead of silently claimed.
    gaps: string[]
  }
}

const DEFAULT_MAX_STEPS = 5000

const RECORDED_GAPS = [
  'full_mitigation_unobservable', // armor/resist/block reduce before damage.value - no canonical surface
  'regen_overheal_unobservable', // regen vitals `amount` = post-clamp applied, not a request
]

export function runBattle(input: BattleSimulationInput): BattleSimulationResult {
  const gameManager = new GameManager()
  const clock = new ManualClockSource()
  gameManager.turnBattleOps.setCombatClockSource(clock)
  gameManager.turnBattleOps.setBattleRngFactory(() => new SeededCombatRng(input.seed))

  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  // Same progression-node closure production registers (App.vue) -
  // postRitual purchases (cuong_chien, element roots) resolve through
  // nodeRegistry, so a missing catalog would fail the canonical write.
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(THE_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(THE_TU_AN_NODES)
  gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
  gameManager.catalogOps.registerStages(STAGES)

  // Restore manager-owned build state through the canonical seams -
  // restore() already deep-clones its payload, so the caller's arrays
  // are never held by reference.
  gameManager.skillManager.restore(input.build.skills)
  gameManager.techniqueManager.restore(input.build.techniques)

  // Detached player + wall-clock strip BEFORE setActivePlayer (its
  // tickTimedEffects would read Date.now() on a populated list).
  const player = structuredClone(input.build.player)
  const timedEffectsStripped = player.persistentTimedEffects.length
  player.persistentTimedEffects = []
  gameManager.setActivePlayer(player)

  if (input.ritual !== undefined) {
    if (player.cultivationPath) {
      throw new Error(
        'runBattle: ritual requires a pre-ritual player - snapshot already carries cultivationPath',
      )
    }
    if (
      !gameManager.realmAdvanceOps.chooseCultivationPath(
        input.ritual.pathId,
        input.ritual.wayId,
        player,
      )
    ) {
      throw new Error(
        `runBattle: ritual rejected (${input.ritual.pathId}/${input.ritual.wayId})`,
      )
    }
  }

  // P5 BaselineRecipe setup - closed union, exhaustive switch onto the
  // public writer surface. Never add a callback variant.
  for (const write of input.postRitual ?? []) {
    let ok: boolean
    switch (write.type) {
      case 'select_phap_tu_element':
        ok = gameManager.progressionOps.selectSpellPathElement(write.element, write.route, player)
        break
      case 'purchase_node':
        ok = gameManager.progressionOps.purchaseNode(write.nodeId, player)
        break
      default: {
        const exhaustive: never = write
        throw new Error(`runBattle: unknown postRitual write ${JSON.stringify(exhaustive)}`)
      }
    }
    if (!ok) {
      throw new Error(`runBattle: postRitual write rejected (${write.type})`)
    }
  }

  const collector = new BattleMetricsCollector(gameManager)
  try {
    const encounter = input.encounter
    if (encounter.kind === 'enemy') {
      gameManager.turnBattleOps.startBattleWithPlayer(player, encounter.enemy)
    } else {
      if (encounter.kind === 'customStage') {
        gameManager.catalogOps.registerEnemyTemplates([...encounter.enemies])
        gameManager.catalogOps.registerStages([encounter.stage])
      }
      const stage =
        encounter.kind === 'stage'
          ? gameManager.catalogOps.getStage(encounter.stageId)
          : encounter.stage
      if (!stage) {
        throw new Error(`runBattle: unknown stage '${encounter.kind === 'stage' ? encounter.stageId : ''}'`)
      }
      if (!gameManager.turnBattleOps.startStage(player, stage)) {
        throw new Error(`runBattle: startStage refused '${stage.id}'`)
      }
    }

    const maxSteps = input.maxSteps ?? DEFAULT_MAX_STEPS
    // Shared deterministic driver (P6-M1): the SAME stepping loop drives
    // disposable benchmark battles and persistent-session battles.
    const outcome = driveTurnBattleToTerminal({
      gameManager,
      clock,
      maxConsumedSteps: maxSteps,
      countSteps: () => collector.steps,
      advanceChunkSeconds: input.advanceChunkSeconds,
      onMissingBattle: () => {
        throw new Error('runBattle: encounter produced no battle')
      },
    })
    // Capture BEFORE abandonBattle - teardown may emit terminal noise
    // that must not drift the reported step counters.
    const steps = collector.steps
    const fightingSteps = collector.fightingSteps
    const metrics = collector.finalize(gameManager)
    const fingerprint = collector.fingerprint(gameManager, outcome)
    if (outcome === 'timeout') {
      gameManager.turnBattleOps.abandonBattle()
    }

    return {
      outcome,
      steps,
      durationSeconds: steps * COMBAT_STEP_SECONDS,
      fightingSteps,
      combatDurationSeconds: fightingSteps * COMBAT_STEP_SECONDS,
      metrics,
      fingerprint,
      diagnostics: { timedEffectsStripped, gaps: [...RECORDED_GAPS] },
    }
  } finally {
    collector.dispose()
  }
}

// Fresh GameManager per run - isolation by construction (P3 teardown
// audit already proved per-cycle freshness).
export function runBattles(
  inputs: readonly BattleSimulationInput[],
): readonly BattleSimulationResult[] {
  return inputs.map((input) => runBattle(input))
}
