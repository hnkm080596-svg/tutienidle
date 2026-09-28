import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameManager } from './GameManager'
import { startAStage } from './__fixtures__/startAStage'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { ANIMATION_FALLBACK_MS } from './GameManagerTurnBattleOps'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { Skill } from '../skill/Skill'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import { createDefaultPlayer } from '../player/Player'
import { toTurnSkillDefinition } from '../skilldef/LegacySkillAdapter'

// Wave-5 pins (QA finding, MEDIUM): an in-flight charge
// (chargingTurnsRemaining / pendingChargedSkillId on the participant) is a
// COMMITTED claim lane like a queued execution or reactive bypass - the
// payload was already committed at charge-init and declareActorAction's
// !isCharging gate never reads a submitted choice mid-charge. Claim site
// and drain gate both consult TurnBattleSystem.isCommittedFollowUpClaim,
// so a charging player-side actor must (a) never park AWAITING_INPUT and
// (b) never re-park into awaitedManualActor on a drain. Before the fix
// both sites enumerated only the two pending* lanes and a charging
// player was solicited for a choice that the declare then discarded.

const CHARGED_ULT: TurnSkillDefinition = {
  id: 'charged_ult',
  cooldownTurns: 0,
  chargeTurns: 2,
  damage: { kind: 'physical', multiplier: 5 },
  targeting: { shape: 'single' },
}

function createPlayer(): CombatEntity {
  const stats = createBaseStats({ might: 50, speed: 100, criticalRate: 0 })

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 4,
    alive: true,
  }
}

function createBasicSkill(): Skill {
  return {
    id: 'basic_test',
    name: 'Basic (test)',
    description: '',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 0,
    cost: 0,
    target: 'enemy',
    effects: [{ type: 'damage', value: 1, damageType: 'physical' }],
    execution: { kind: 'attack_speed' },
    resourceType: 'none',
  }
}

function createDummyEnemy() {
  return defineEnemy({
    id: 'charge_manual_dummy',
    name: 'Dummy',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: {
      maxHp: 10_000_000,
      might: 0,
      attackSpeed: 1,
      criticalRate: 0,
      criticalDamage: 1.5,
      armor: 0,
      evasionRate: 0,
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

// Non-interactive manual-mode harness (same wiring as
// GameManager.turnManualMode.test.ts): real GameManager + TurnBattleSystem
// with the plan runtime, manual flag flipped on the live boundary.
function startManualBattle(): { gameManager: GameManager; combatSource: ManualClockSource } {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)
  const player = createPlayer()

  gameManager.catalogOps.registerSkillTemplates([createBasicSkill()])
  gameManager.catalogOps.registerProgressionNodes([{
    id: 'core_basic_test',
    name: 'Core: Basic',
    type: 'minor',
    insightCost: 0,
    maxLevel: 10,
    levelsSkillId: 'basic_test',
    effect: {},
  }])
  gameManager.progressionOps.learnSkill('basic_test', createDefaultPlayer())
  const basicSkill = gameManager.skillManager.get('basic_test')!
  gameManager.setPathRuntimeResolver(() => ({
    resolveBasic: () =>
      toTurnSkillDefinition(basicSkill, gameManager.skillSystem.getEffectiveSkill(basicSkill)),
    resolveSpecialUltimate: () => undefined,
    resolveMaxThe: () => 0,
    resolveStatDomains: () => undefined,
  }))

  gameManager.startBattle(player, createDummyEnemy())

  for (let i = 0; i < 30; i++) {
    combatSource.advance(COMBAT_STEP_SECONDS)
  }

  return { gameManager, combatSource }
}

// Interactive presentation harness (same wiring as
// GameManagerTurnBattleOps.presentationReceipt.test.ts): held session +
// fake timers so the deferral cap drains pending playback mechanically.
function setupInteractive() {
  vi.useFakeTimers()
  const manager = new GameManager()
  const clock = new ManualClockSource()
  manager.setCombatClockSource(clock)
  manager.setPresentationActive(true)
  manager.setPresentationMode('interactive')
  startAStage(manager)
  const port = manager.getPresentationPort()
  const initial = port.hold(port.getCurrentSession()!)!
  port.attach(initial)
  port.release(initial)
  clock.advance(COMBAT_STEP_SECONDS * 260)
  return { manager, clock }
}

afterEach(() => vi.useRealTimers())

describe('charge committed lane - manual-mode claim (wave-5 pin)', () => {
  it('a charging player-side actor never parks AWAITING_INPUT on charge ticks, and the charge still resolves', () => {
    const { gameManager, combatSource } = startManualBattle()
    const battle = gameManager.getTurnBattle()!
    const player = battle.players[0]!
    const enemy = battle.enemies[0]!

    // Mid-flight committed charge: the cast committed at charge-init and
    // the next two player turns tick/resolve it. The declare-side
    // !isCharging gate never reads a manual choice while this is set.
    player.chargingTurnsRemaining = 2
    player.pendingChargedSkillId = 'charged_ult'
    player.ultimate = { skill: CHARGED_ULT, remainingCooldownTurns: 0 }

    gameManager.setBattleManualMode(true)

    const awaitedDuringCharge: Array<string | null> = []
    let wasCharging = true
    let prevEnemyHp = enemy.entity.currentHp
    let resolveHpDrop = 0
    let resolved = false

    for (let i = 0; i < 400 && !resolved; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)

      if (gameManager.isAwaitingManualTurnChoice()) {
        const awaitedId = gameManager.consumeAwaitedActorId()
        if (player.chargingTurnsRemaining !== undefined || player.pendingChargedSkillId !== undefined) {
          // Any pause inside the charge window is the misroute this test
          // pins: the claimed actor is solicited for a choice the declare
          // will discard (pre-fix: 'player' parks here).
          awaitedDuringCharge.push(awaitedId)
        }
        expect(gameManager.submitTurnChoice('basic')).toBe(true)
      }

      const stillCharging =
        player.chargingTurnsRemaining !== undefined || player.pendingChargedSkillId !== undefined
      if (wasCharging && !stillCharging) {
        // The resolve turn completed inside this step: the deferred hit
        // must have actually landed, not fizzled.
        resolveHpDrop = prevEnemyHp - enemy.entity.currentHp
        resolved = true
      }
      prevEnemyHp = enemy.entity.currentHp
      wasCharging = stillCharging
    }

    expect(resolved).toBe(true)
    expect(awaitedDuringCharge).toEqual([])
    expect(resolveHpDrop).toBeGreaterThan(0)
    const chargeEntries = (battle.log ?? []).filter(
      (entry) => entry.actorId === 'player' && entry.skillId === 'charged_ult',
    )
    expect(chargeEntries.length).toBeGreaterThan(0)

    // The exemption is lane-scoped: the player's next GENUINE turn still
    // pauses for manual input.
    let pausedAgain = false
    for (let i = 0; i < 200 && !pausedAgain; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
      pausedAgain = gameManager.isAwaitingManualTurnChoice()
    }
    expect(pausedAgain).toBe(true)
  })

  it('cap drain resolves a committed charge claim under manual mode - token IDLE, no manual-pause residue', () => {
    // Drain-time pin: manual toggled while a committed charge claim is in
    // flight; the held session's cap drain must settle it through the AUTO
    // lane rather than re-park the player into awaitedManualActor on the
    // live flag.
    const { manager, clock } = setupInteractive()
    const port = manager.getPresentationPort()
    const battle = manager.getTurnBattle()!
    const participant = battle.players[0]!

    // The drain loop resolves every parked turn live - keep the stage
    // enemy alive for its duration so the battle cannot end mid-pin.
    const enemy = battle.enemies[0]!
    enemy.entity.maxHp = 10_000_000
    enemy.entity.currentHp = 10_000_000

    const driveParkedTurn = () => {
      const token = manager.getPendingPlaybackToken()

      if (token) {
        manager.acknowledgeTurnReady(token)
        manager.acknowledgeActionImpact(token)
        manager.acknowledgeActionComplete(token)
      }
    }

    driveParkedTurn()
    expect(manager.getTurnTokenState()).toBe('IDLE')
    manager.setBattleManualMode(true)

    participant.chargingTurnsRemaining = 1
    participant.pendingChargedSkillId = 'charged_ult'
    participant.ultimate = { skill: CHARGED_ULT, remainingCooldownTurns: 0 }

    // A held session freezes the combat clock ('not-revealed'), so the
    // charge claim must park FIRST: advance unheld windows until it is
    // the parked 'ready' step, acking any other actors' turns to walk
    // on. Manual is on - the committed charge claim must never park
    // AWAITING_INPUT (pre-fix it did, and the declare's !isCharging gate
    // was never even reached).
    let chargeParked = false
    for (let i = 0; i < 40 && !chargeParked; i++) {
      clock.advance(COMBAT_STEP_SECONDS * 260)
      expect(manager.isAwaitingManualTurnChoice()).toBe(false)

      const resume = manager.preparePresentationResume()
      if (resume?.phase === 'ready' && resume.actorId === 'player') {
        chargeParked = true
      } else {
        driveParkedTurn()
      }
    }
    expect(chargeParked).toBe(true)

    // Renderer never acks: hold the session past the deferral cap so the
    // parked ready step drains mechanically through the AUTO lane.
    const hold = port.hold(port.getCurrentSession()!)!
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.advanceTimersByTime(ANIMATION_FALLBACK_MS * 8)

    // Token drained to IDLE with no manual-pause residue, and the
    // committed payload actually executed rather than being orphaned.
    expect(manager.getTurnTokenState()).toBe('IDLE')
    expect(manager.consumeAwaitedActorId()).toBeNull()
    expect(manager.preparePresentationResume()).toBeNull()
    expect(participant.chargingTurnsRemaining).toBeUndefined()
    expect(participant.pendingChargedSkillId).toBeUndefined()
    expect(battle.log?.at(-1)).toMatchObject({ actorId: 'player', skillId: 'charged_ult' })

    warn.mockRestore()

    // Reveal the session: nothing replays and the battle walks on to the
    // player's next real manual pause.
    expect(port.attach(hold)).toBe(true)
    expect(port.release(hold)).toBe(true)
    for (let i = 0; i < 400 && !manager.isAwaitingManualTurnChoice(); i++) {
      driveParkedTurn()

      if (manager.getTurnTokenState() === 'IDLE') {
        clock.advance(COMBAT_STEP_SECONDS)
      }
    }

    expect(manager.isAwaitingManualTurnChoice()).toBe(true)
    manager.abandonBattle()
  })
})
