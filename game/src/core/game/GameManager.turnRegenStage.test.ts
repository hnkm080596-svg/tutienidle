import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { asBaseStats } from '../stats/StatBlock'
import { defineEnemy } from '../enemy/Enemy'
import { SKILLS, SPELL_KIT_IDS } from '../../data/skill/Skills'
import type { Stage } from '../stage/Stage'
import type { CombatEntity } from '../combat/CombatEntity'
import type { EntityVitalsChangedEvent } from '../combat/EntityVitalsSystem'
import type { StatusVfxAttachedEvent } from '../battle/BattleEvents'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// M8 (ARCH-003) — real stage-loop regression for the per-turn resource
// contract: the REAL Phap Tu chain kits (resolved through
// resolvePlayerSpecialUltimate + toTurnSkillDefinition (LegacySkillAdapter) +
// playerToCombatEntity) apply thanh_tuyen / bang_giap / dia_tru through
// appliesBuff, and the legacy-named regen stats they grant produce real
// MP/Ward on the entity-turn cadence — nothing here is a synthetic
// participant or a mocked stat.
//
// Vitals events carry the authoritative before/after views, so each test
// asserts on the emitted regen stream AND the live pool, not on fixture
// shortcuts.

const STAGE_ID = 'm8_regen_stage'
const ENEMY_ID = 'm8_regen_dummy'

function stageFixture(): Stage {
  return {
    id: STAGE_ID,
    name: STAGE_ID,
    description: '',
    floor: 1,
    enemyPool: [{ enemyId: ENEMY_ID, weight: 1 }],
    totalEnemyCount: 1,
    waves: [1],
    spawnIntervalSeconds: 0,
  }
}

function makeEnemy() {
  return defineEnemy({
    id: ENEMY_ID,
    name: 'Regen Dummy',
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
    },
    rewards: { techniqueMastery: 0, spiritStone: 0 },
  })
}

interface Harness {
  gameManager: GameManager
  combatSource: ManualClockSource
  player: ReturnType<typeof createDefaultPlayer>
  playerEntity: () => CombatEntity
  regenEvents: EntityVitalsChangedEvent[]
  attached: StatusVfxAttachedEvent[]
  advanceUntil: (predicate: () => boolean, maxSteps?: number) => boolean
}

function buildHarness(element: 'water' | 'earth', playerSpeed: number): Harness {
  const gameManager = new GameManager()
  const combatSource = new ManualClockSource()
  gameManager.setCombatClockSource(combatSource)

  const regenEvents: EntityVitalsChangedEvent[] = []
  const attached: StatusVfxAttachedEvent[] = []
  gameManager.eventBus.on<EntityVitalsChangedEvent>('entity_vitals_changed', (event) => {
    if (event.reason === 'regen') regenEvents.push(event)
  })
  gameManager.eventBus.on<StatusVfxAttachedEvent>('status_vfx_attached', (event) => attached.push(event))

  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  player.spellPath = { element }
  // Speed boost: the player must take >= 3 unhit turns between enemy hits
  // for the Ward delay gate to open inside the real loop.
  player.baseStats = asBaseStats({ ...player.baseStats, speed: playerSpeed })

  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
  gameManager.catalogOps.registerEnemyTemplates([makeEnemy()])
  gameManager.catalogOps.registerStages([stageFixture()])
  gameManager.setActivePlayer(player)

  // Learn the chain special through SkillManager.add — the same manager
  // API the unlocksSkillIds node effect calls — so the real
  // resolvePlayerSpecialUltimate path converts it into the battle's
  // `special` slot. The chain ultimate stays unlearned, so the special
  // is the player's first cast (turn 1) and regen starts immediately.
  const specialId = element === 'water' ? 'thanh_tuyen_duong_linh' : 'dia_tru_thua_thien'
  const template = SKILLS.find((skill) => skill.id === specialId)!
  gameManager.skillManager.add(template)
  // The committed element's basic is required at battle build (round-3
  // fail-fast: missing required basic throws, no melee substitute).
  expect(
    gameManager.progressionOps.learnSkill(SPELL_KIT_IDS[element][0], player),
  ).toBe(true)

  return {
    gameManager,
    combatSource,
    player,
    playerEntity: () => gameManager.getTurnBattle()!.players[0]!.entity,
    regenEvents,
    attached,
    advanceUntil: (predicate, maxSteps = 3000) => {
      for (let i = 0; i < maxSteps; i++) {
        if (predicate()) return true
        combatSource.advance(COMBAT_STEP_SECONDS)
      }
      return predicate()
    },
  }
}

function startStage(h: Harness): void {
  expect(
    h.gameManager.turnBattleOps.startStage(
      h.player,
      h.gameManager.catalogOps.getStage(STAGE_ID)!,
      false,
    ),
  ).toBe(true)
}

describe('M8 — real stage-loop resource regen (ARCH-003)', () => {
  it('Thanh Tuyen (water special) restores MP on the turn cadence through the vitals authority', () => {
    const h = buildHarness('water', 100)
    startStage(h)

    const entity = h.playerEntity()
    // Drain the pool so the regen is observable (test fixture write —
    // production mutation still flows through EntityVitalsSystem).
    entity.currentMp = 0

    // Player turn 1 casts thanh_tuyen_duong_linh (the ultimate stays
    // unlearned) -> thanh_tuyen buff -> +8 mana regen/turn. The Phap Tu
    // path kit also grants a +2/turn baseline, so the assertion waits for
    // a buff-driven tick clearly above that baseline.
    const sawBuffedRegen = h.advanceUntil(
      () =>
        h.regenEvents.some((e) => e.entityId === entity.id && e.mpAfter - e.mpBefore > 5),
    )

    expect(sawBuffedRegen).toBe(true)
    expect(h.attached.some((e) => e.dotType === 'thanh_tuyen' && e.targetId === entity.id)).toBe(true)
    expect(entity.currentMp).toBeGreaterThan(0)
    expect(entity.currentMp).toBeLessThanOrEqual(entity.stats.maxMp)
  })

  // Phap Tu Reimagined: the Ward-regen legs are retired by design -
  // the reimagined specials are pure Phap Trang windows (Tam Muoi /
  // Thanh Tuyen / Van Moc / Kim Y / Trong Nhac), none grants bang_giap
  // or dia_tru, and the duong_linh_bang_giap specialization no longer
  // exists. The old tests pinned `wardAfter > wardBefore` through those
  // payloads; there is no phap tu Ward producer left to exercise them
  // with. Thanh Tuyen's MP-regen leg above remains the live coverage.
})
