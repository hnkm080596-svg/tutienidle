// @vitest-environment node
// @ts-expect-error project omits Node ambient types by design (pattern: deadReferences.test.ts)
import { readdirSync, readFileSync, statSync } from 'node:fs'
// @ts-expect-error see above
import { join, extname } from 'node:path'
// @ts-expect-error see above
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { freshKiemTuState, KIEM_PHO_ORB_IDS, MORTAL_PRECURSOR_SKILL_IDS, type OrbId } from './KiemTuState'
import {
  initKiemPhoBattle,
  nextOrb,
  realmComboMax,
  recordCastAndMatch,
  validatePreset,
} from './KiemPhoSystem'
import { buildKiemPhoProvider } from './KiemPhoProvider'
import {
  buildNguKiemDaoProvider,
  collectKiemDaoCascadeUnlocks,
} from './NguKiemDaoProvider'
import {
  applyBreakthroughMerge,
  forgeCost,
  gainKiemY,
  kiemDaoCap,
  CASCADE_CRIT_CHANCE,
  CASCADE_PIERCE_CHANCE,
  EXECUTE_MULT,
} from './NguKiemDao'
import { KIEM_PHO_COMBOS } from '../../data/skill/KiemPhoCombos'
import { KIEM_PHO_ORBS, ORB_UNLOCK_REALM, unlockedOrbs } from '../../data/skill/KiemPhoOrbs'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { turnSkillDisplayMetaOf } from '../../data/skill/TurnSkillDisplayMeta'
import { GameManager } from '../game/GameManager'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { CombatSystem } from '../combat/CombatSystem'
import { EventBus } from '../events/EventBus'
import { BuffPool } from '../buff/BuffPool'
import { TurnBattleSystem, type TurnBattle, type TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import { createBaseStats } from '../stats/StatBlock'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import type { CombatEntity } from '../combat/CombatEntity'
import type { BuffDefinition, BuffDefinitionCatalog } from '../buff/BuffTypes'

// Kiem Tu Reimagined Task 13 — spec 2026-09-15 §10 invariant suite.
// One consolidated contract surface: every INV below cites its spec
// invariant. These codify Tasks 1-12 — they intentionally overlap the
// per-task tests; this file is the regression tripwire a future edit
// hits FIRST when it breaks the cross-system contract.

function hienPlayer(preset: OrbId[], realmId = 'qi_refining'): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = realmId
  player.cultivationPath = 'kiem_tu'
  player.kiemTu = { ...freshKiemTuState(), mode: 'hien', preset }
  return player
}

function nguPlayer(realmId = 'golden_core'): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = realmId
  player.cultivationPath = 'kiem_tu'
  player.kiemTu = { ...freshKiemTuState(), mode: 'ngu' }
  return player
}

// ---- shared turn-battle harness (same shape as dynamicBasic.test.ts) ----

const EMPTY_CATALOG: BuffDefinitionCatalog = {
  get: (id: string): BuffDefinition => {
    throw new Error(`unknown buff id: ${id}`)
  },
}

function makeEntity(id: string, overrides: Partial<CombatEntity> = {}): CombatEntity {
  const stats = createBaseStats({ evasionRate: 0, dexterity: 0, criticalRate: 0, ...overrides.stats })
  return {
    id,
    name: id,
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: 1_000_000,
    maxHp: 1_000_000,
    currentMp: stats.maxMp,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    currentThe: 0,
    timeSinceLastBleedProc: 0,
    currentWard: 0,
    turnsSinceLastHitLanded: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
    ...overrides,
  } as CombatEntity
}

function makeBattle(dynamicBasic: TurnBattleParticipant['dynamicBasic'], defenderMaxHp = 1_000_000) {
  const eventBus = new EventBus()
  const combat = new CombatSystem(eventBus)
  const system = new TurnBattleSystem(combat, 10, EMPTY_CATALOG)

  const attacker = makeEntity('attacker', {
    stats: createBaseStats({ might: 100, accuracyRating: 9999 }),
  })
  const defender = makeEntity('defender', {
    stats: createBaseStats({ evasionRate: 0, maxHp: defenderMaxHp }),
  })

  const attackerP: TurnBattleParticipant = {
    id: 'attacker',
    entity: attacker,
    speed: attacker.stats.speed,
    priority: 0,
    actionGauge: 0,
    alive: attacker.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
    basic: {
      id: 'fallback_basic',
      cooldownTurns: 0,
      damage: { kind: 'physical', multiplier: 1 },
      targeting: { shape: 'single' },
    },
    dynamicBasic,
  }
  const defenderP: TurnBattleParticipant = {
    id: 'defender',
    entity: defender,
    speed: defender.stats.speed,
    priority: 1,
    actionGauge: 0,
    alive: defender.alive,
    buffs: new BuffPool(),
    consecutiveHardCcTurns: 0,
  }

  const battle: TurnBattle = { players: [attackerP], enemies: [defenderP], state: 'fighting' }

  return { system, battle, attackerP, defenderP, eventBus }
}

// ---- fs-scan helpers (pattern: deadReferences.test.ts) ----

const srcRoot = fileURLToPath(new URL('../../', import.meta.url))

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (extname(entry) === '.ts' || extname(entry) === '.vue') {
      out.push(full)
    }
  }
  return out
}

/** Strip // line comments and block comments before scanning so removal
 *  notes naming retired ids do not trip the guard. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

describe('INV-1 — mode single-owner', () => {
  it('hien provider output never depends on kiemY/kiemDao state', () => {
    const player = hienPlayer(['orb_dam', 'orb_chem'])
    const provider = buildKiemPhoProvider(player, [])
    const participant = {} as Parameters<typeof provider.resolveBasic>[0]

    const before = [provider.resolveBasic(participant).id, provider.resolveBasic(participant).id]

    player.kiemTu!.kiemY = 777_777
    player.kiemTu!.kiemDaoCount = 9
    player.kiemTu!.kiemDaoBase = 42

    expect(provider.resolveBasic(participant).id).toBe('orb_dam')
    expect(before).toEqual(['orb_dam', 'orb_chem'])
  })

  it('ngu provider output never depends on the persisted preset', () => {
    const player = nguPlayer()
    player.kiemTu!.kiemDaoCount = 3
    player.kiemTu!.kiemDaoBase = 2

    const provider = buildNguKiemDaoProvider(player, { a: false, e: false, d: false })
    const before = provider.resolveBasic({} as TurnBattleParticipant)

    player.kiemTu!.preset = ['orb_quet', 'orb_hat', 'orb_bo']

    const after = provider.resolveBasic({} as TurnBattleParticipant)
    expect(after.instances?.count).toBe(before.instances?.count)
    expect(after.damage).toEqual(before.damage)
  })
})

describe('INV-2 — preset shape + cursor bounds', () => {
  it('preset must be 1-9 orbs, all realm-unlocked; cursor stays in bounds', () => {
    expect(validatePreset([], 1)).toBe(false)
    expect(validatePreset(Array(10).fill('orb_dam'), 9)).toBe(false)
    expect(validatePreset(['orb_quet'], 4)).toBe(false)
    expect(validatePreset(['orb_quet'], 5)).toBe(true)

    const state = initKiemPhoBattle(hienPlayer(['orb_dam', 'orb_chem']))
    for (let i = 0; i < 7; i++) {
      nextOrb(state)
      expect(state.cursor).toBeGreaterThanOrEqual(0)
      expect(state.cursor).toBeLessThan(state.preset.length)
    }
  })

  it('KIEM_PHO_ORB_IDS stays in parity with the orb catalog', () => {
    // The save validator consumes KIEM_PHO_ORB_IDS; if a future orb
    // reaches the unlock table but not this list, a legal preset would
    // be rejected on restore — the two sets must never drift.
    expect([...KIEM_PHO_ORB_IDS].sort()).toEqual(Object.keys(ORB_UNLOCK_REALM).sort())
    expect([...KIEM_PHO_ORB_IDS].sort()).toEqual(Object.keys(KIEM_PHO_ORBS).sort())
  })

  it('every orb has a display meta (preset strip + picker readout)', () => {
    // Same drift class one layer over — the hand-authored meta map in
    // TurnSkillDisplayMeta must cover every orb the catalog offers.
    for (const orbId of KIEM_PHO_ORB_IDS) {
      expect(turnSkillDisplayMetaOf(orbId), `missing display meta for ${orbId}`).toBeDefined()
    }
  })
})

describe('INV-3/4/6 — combo determinism + suffix-free table + realm gating', () => {
  it('authored table is suffix-free: no pattern is a proper suffix of a shorter-or-equal pattern', () => {
    for (const combo of KIEM_PHO_COMBOS) {
      for (const other of KIEM_PHO_COMBOS) {
        if (other === combo || other.pattern.length > combo.pattern.length) continue
        const tail = combo.pattern.slice(combo.pattern.length - other.pattern.length)
        expect(tail, `${other.id} is a suffix of ${combo.id}`).not.toEqual(other.pattern)
      }
    }
  })

  it('one fire per cast — a cleared log cannot chain into a second combo', () => {
    const state = initKiemPhoBattle(hienPlayer(['orb_dam']))
    recordCastAndMatch(state, 'orb_dam', KIEM_PHO_COMBOS)
    recordCastAndMatch(state, 'orb_dam', KIEM_PHO_COMBOS)
    expect(recordCastAndMatch(state, 'orb_dam', KIEM_PHO_COMBOS)?.id).toBe('tam_thich')
    expect(state.log).toEqual([])
    expect(recordCastAndMatch(state, 'orb_dam', KIEM_PHO_COMBOS)).toBeNull()
  })

  it('cast log never exceeds 5 and combos above realmComboMax cannot match', () => {
    const state = initKiemPhoBattle(hienPlayer(['orb_dam'], 'qi_refining')) // comboMaxLength 3
    for (let i = 0; i < 9; i++) recordCastAndMatch(state, 'orb_chem', KIEM_PHO_COMBOS)
    expect(state.log.length).toBeLessThanOrEqual(5)
    expect(realmComboMax(2)).toBe(3)
    expect(realmComboMax(3)).toBe(4)
    expect(realmComboMax(6)).toBe(5)
  })
})

describe('INV-5 — additive resolution: the completing orb hit still lands', () => {
  it('combo turn resolves BOTH the orb damage and the combo impact', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const provider = buildKiemPhoProvider(hienPlayer(['orb_dam']), [])
    const { system, battle, attackerP, eventBus } = makeBattle(provider)

    let damages = 0
    eventBus.on('damage', () => {
      damages += 1
    })

    // Drive the attacker directly (resolveNextStep would interleave the
    // defender's turns) — declare + apply is the same pipeline the
    // engine runs per actor turn.
    for (let i = 0; i < 2; i++) {
      system.applyActionImpact(battle, system.declareActorAction(battle, attackerP))
    }
    const comboDamagesBefore = damages
    const result = system.applyActionImpact(battle, system.declareActorAction(battle, attackerP))

    // Third cast: orb_dam lands (1) AND tam_thich fires as extraImpact (2).
    expect(damages - comboDamagesBefore).toBe(2)
    expect(result.extraImpacts[0]?.presetId).toBe('kiem_combo_tam_thich')
    vi.restoreAllMocks()
  })
})

describe('INV-7 — hardcore discovery', () => {
  it('every combo has a UNIQUE presetId', () => {
    const seen = new Set<string>()
    for (const combo of KIEM_PHO_COMBOS) {
      expect(seen.has(combo.presetId), `${combo.id} reuses presetId ${combo.presetId}`).toBe(false)
      seen.add(combo.presetId)
    }
    expect(seen.size).toBe(KIEM_PHO_COMBOS.length)
  })

  it('no combo id resolves to display text (K11 — name is data-only)', () => {
    for (const combo of KIEM_PHO_COMBOS) {
      expect(
        turnSkillDisplayMetaOf(combo.id),
        `${combo.id} leaks a name/description to presentation`,
      ).toBeUndefined()
    }
  })

  it('grep-guard: nothing outside the owner seam reads the combo table', () => {
    // K11's discovery contract binds EVERY layer — scan all of src,
    // allowlisting the only legitimate referencers: the table itself
    // and the matcher/provider that own and inject it. A combo name or
    // id must NEVER reach presentation (no display-meta entry, no name
    // flash): the fired payload's VFX/damage is the only signal. A new
    // referencer must be allowlisted deliberately.
    const ALLOWED_REFERENCERS = [
      'src/data/skill/KiemPhoCombos.ts',
      'src/core/kiem-tu/KiemPhoProvider.ts',
      'src/core/kiem-tu/KiemPhoSystem.ts',
    ]
    const violations: string[] = []

    for (const file of listSourceFiles(srcRoot)) {
      const rel = file.replace(/\\/g, '/')
      if (rel.endsWith('.test.ts')) continue
      if (ALLOWED_REFERENCERS.some((allowed) => rel.endsWith(allowed))) continue
      const source = stripComments(readFileSync(file, 'utf-8'))
      if (/KiemPhoCombos|KIEM_PHO_COMBOS/.test(source)) {
        violations.push(rel)
      }
    }

    expect(violations).toEqual([])
  })
})

describe('INV-8 — ngu gate (reveal / purchase / one-way / mode filter)', () => {
  function setupGame(tramLevel = 3) {
    const gameManager = new GameManager()
    gameManager.setCombatClockSource(new ManualClockSource())
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
    const player = nguPlayer('golden_core')
    player.kiemTu!.mode = 'hien'
    player.skillInsight = 500
    player.skillLevels = { tram: tramLevel }
    player.skillCastCounts = { tram: tramLevel >= 3 ? 10_000 : 9_000 }
    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('tram')
    return { gameManager, player }
  }

  it('kiem_tu_an is hidden until tram Lv3, then purchasable exactly once', () => {
    const { gameManager, player } = setupGame(2)
    expect(gameManager.progressionOps.canPurchaseNode('kiem_tu_an', player)).toBe(false)

    const ready = setupGame(3)
    expect(ready.gameManager.progressionOps.canPurchaseNode('kiem_tu_an', ready.player)).toBe(true)
    expect(ready.gameManager.progressionOps.purchaseNode('kiem_tu_an', ready.player)).toBe(true)
    expect(ready.player.kiemTu!.mode).toBe('ngu')

    ready.player.skillInsight = 500
    expect(ready.gameManager.progressionOps.purchaseNode('kiem_tu_an', ready.player)).toBe(false)
  })

  it('kiem_tu_an still commits when van_kiem_quyet is already learned (learn is idempotent)', () => {
    const { gameManager, player } = setupGame(3)
    expect(gameManager.realmAdvanceOps.learnTechnique('van_kiem_quyet')).toBe(true)

    expect(gameManager.progressionOps.purchaseNode('kiem_tu_an', player)).toBe(true)
    expect(player.kiemTu!.mode).toBe('ngu')
  })

  it('kiem_tu_an is transactional — a post-commit equip failure rolls back insight, node and mode', () => {
    const { gameManager, player } = setupGame(3)
    vi.spyOn(gameManager.realmAdvanceOps, 'equipTechnique').mockReturnValue(false)

    expect(gameManager.progressionOps.purchaseNode('kiem_tu_an', player)).toBe(false)
    expect(player.skillInsight).toBe(500)
    expect(player.nodeLevels?.['kiem_tu_an']).toBeUndefined()
    expect(player.purchasedNodeIds).not.toContain('kiem_tu_an')
    expect(player.kiemTu!.mode).toBe('hien')
  })

  it('kiem_tu_an preflight rejects the purchase when the signature technique is unregistered', () => {
    const gameManager = new GameManager()
    gameManager.setCombatClockSource(new ManualClockSource())
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
    // Deliberately no registerTechniqueTemplates — van_kiem_quyet can
    // never learn/equip, so the conversion must refuse to start.
    const player = nguPlayer('golden_core')
    player.kiemTu!.mode = 'hien'
    player.skillInsight = 500
    player.skillLevels = { tram: 3 }
    player.skillCastCounts = { tram: 10_000 }
    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('tram')

    expect(gameManager.progressionOps.purchaseNode('kiem_tu_an', player)).toBe(false)
    expect(player.skillInsight).toBe(500)
    expect(player.nodeLevels?.['kiem_tu_an']).toBeUndefined()
    expect(player.purchasedNodeIds).not.toContain('kiem_tu_an')
    expect(player.kiemTu!.mode).toBe('hien')
  })

  it('ngu mode hides hien orb nodes; hien mode hides ngu branch nodes', () => {
    const orbNode = KIEM_TU_NODES.find(n => n.id === 'orb_dam_1')
    const nguNode = KIEM_TU_NODES.find(n => n.branchTag === 'ngu_kiem' && n.id !== 'kiem_tu_an')
    expect(orbNode).toBeDefined()
    expect(nguNode).toBeDefined()
    expect(orbNode!.kiemTuMode).toBe('hien')
    expect(nguNode!.kiemTuMode).toBe('ngu')
  })
})

describe('INV-9 — cascade bounds', () => {
  it('guaranteedHit is unconditional; no unlocks consume zero RNG', () => {
    const rng = vi.fn(() => 0)
    const player = nguPlayer()
    const provider = buildNguKiemDaoProvider(player, { a: false, e: false, d: false }, rng)
    const def = provider.resolveBasic({} as TurnBattleParticipant)

    for (let i = 0; i < 3; i++) {
      const opts = def.instances!.perInstanceOptions!(i, { currentHp: 1, maxHp: 100 } as CombatEntity)
      expect(opts.guaranteedHit).toBe(true)
      expect(Object.keys(opts).sort()).toEqual(['guaranteedHit'])
    }
    expect(rng).not.toHaveBeenCalled()
  })

  it('rolls happen only when unlocked — e consumes 1 rng, d consumes 1 rng per instance', () => {
    const player = nguPlayer()
    const eOnly = vi.fn(() => CASCADE_CRIT_CHANCE + 0.001)
    const eProvider = buildNguKiemDaoProvider(player, { a: false, e: true, d: false }, eOnly)
    eProvider.resolveBasic({} as TurnBattleParticipant).instances!.perInstanceOptions!(0, { currentHp: 100, maxHp: 100 } as CombatEntity)
    expect(eOnly).toHaveBeenCalledTimes(1)

    const dOnly = vi.fn(() => CASCADE_PIERCE_CHANCE + 0.001)
    const dProvider = buildNguKiemDaoProvider(player, { a: false, e: false, d: true }, dOnly)
    dProvider.resolveBasic({} as TurnBattleParticipant).instances!.perInstanceOptions!(0, { currentHp: 100, maxHp: 100 } as CombatEntity)
    expect(dOnly).toHaveBeenCalledTimes(1)

    const both = vi.fn(() => 0.999)
    const bothProvider = buildNguKiemDaoProvider(player, { a: true, e: true, d: true }, both)
    // a is deterministic (hp check, no rng); e + d each consume one roll.
    bothProvider.resolveBasic({} as TurnBattleParticipant).instances!.perInstanceOptions!(0, { currentHp: 100, maxHp: 100 } as CombatEntity)
    expect(both).toHaveBeenCalledTimes(2)
  })

  it('execute is damage-scale only (survives SurviveLethalGuard); break-on-death consumes no further RNG', () => {
    const player = nguPlayer('golden_core') // threshold min(0.5, 0.3) = 0.3
    player.kiemTu!.kiemDaoCount = 5 // multi-instance required for the break-on-death half
    const rng = vi.fn(() => 0)
    const provider = buildNguKiemDaoProvider(player, { a: true, e: true, d: true }, rng)
    const def = provider.resolveBasic({} as TurnBattleParticipant)

    const opts = def.instances!.perInstanceOptions!(0, { currentHp: 20, maxHp: 100 } as CombatEntity)
    expect(opts.damageMultiplier).toBe(EXECUTE_MULT)
    expect(Object.keys(opts).sort()).toEqual([
      'armorBypass',
      'critical',
      'damageMultiplier',
      'guaranteedHit',
    ])

    // Battle-level: target dies on sword 1 — remaining instances never
    // evaluate options, so rng is consumed for live instances only.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const rngCallsBefore = rng.mock.calls.length
    const { system, battle, defenderP } = makeBattle(provider, 10)
    system.resolveNextStep(battle)

    expect(defenderP.entity.alive).toBe(false)
    // 1 live instance evaluated × 2 rolls (e + d); dead instances: 0.
    expect(rng.mock.calls.length - rngCallsBefore).toBe(2)
    vi.restoreAllMocks()
  })
})

describe('INV-10/11 — economy + base monotonic', () => {
  it('gain gate at cap: no banking past kiemDaoCap; conversion only inside gainKiemY', () => {
    const player = nguPlayer('qi_refining') // cap 2, forgeCost 9999
    gainKiemY(player, 9_999)
    expect(player.kiemTu!.kiemDaoCount).toBe(2)

    gainKiemY(player, 50_000) // fully gated at cap — nothing banks
    expect(player.kiemTu!.kiemDaoCount).toBe(2)
    expect(player.kiemTu!.kiemY).toBe(0)
  })

  it('merge is exactly-once per breakthrough: snapshot before reset, kiemY untouched, base monotonic', () => {
    const state = { ...freshKiemTuState(), mode: 'ngu' as const, kiemDaoCount: 4, kiemDaoBase: 1, kiemY: 123 }
    const before = state.kiemDaoBase

    applyBreakthroughMerge(state) // base = 1 * (1 + 0.3*4) = 2.2
    expect(state.kiemDaoBase).toBeCloseTo(2.2, 10)
    expect(state.kiemDaoBase).toBeGreaterThanOrEqual(before)
    expect(state.kiemDaoCount).toBe(1)
    expect(state.kiemY).toBe(123)

    // kiemDaoCount can never drop below 1 while ngu.
    for (let i = 0; i < 5; i++) {
      state.kiemDaoCount = i % 3 + 1
      applyBreakthroughMerge(state)
      expect(state.kiemDaoCount).toBeGreaterThanOrEqual(1)
      expect(state.kiemDaoBase).toBeGreaterThanOrEqual(before)
    }
  })

  it('forgeCost/cap are realm-indexed and forge asserts realmIndex >= 1', () => {
    expect(forgeCost(1)).toBe(9_999)
    expect(kiemDaoCap(1)).toBe(2)
    expect(() => forgeCost(0)).toThrow()
    expect(() => kiemDaoCap(0)).toThrow()
  })
})

describe('INV-12 — no dead ids in production content (Task 12 sweep)', () => {
  const DEAD_IDS = [
    /kiem_tran_/, /bat_kiem/, /tru_tien_kiem/, /khai_thien_mon/,
    /TRAN_SEQUENCE/, /KIEM_TRAN_SLOT_INDEX/, /getFormationSwordCount/,
    /currentSwordIntent/, /currentKiemThe/, /currentKiemYTemp/,
    /sword_intent/, /swordIntentDamageRatio/, /grantsSwordIntentPerHit/,
    /spawnSwordZone/, /KiemTuResourceSystem/, /KiemYSystem/,
    /MAX_SWORD_INTENT/, /MAX_KIEM_THE/, /MAX_KIEM_Y_TEMP_CAP/,
    /KIEM_Y_DMG_TAKEN_GAIN_PER_MAXHP_PERCENT/,
    /kiemTuRoute/, /KiemTuRoute/, /usesSwordIntentResource/,
    /onhit_/, /tuLucActive/, /tuLucElapsed/, /tuLucDamageTakenPercent/,
    /KIEM_TRAN_BURN/, /dispatchOnHitEffect/, /OnHitEffectKind/,
  ]

  it('no production source file references a retired id', () => {
    const violations: string[] = []
    for (const file of listSourceFiles(srcRoot)) {
      const rel = file.replace(/\\/g, '/')
      if (rel.endsWith('.test.ts')) continue
      // Save-version history comments legitimately name retired ids.
      if (/services\/save\/(saveTypes|saveVersion)\.ts$/.test(rel)) continue
      const source = stripComments(readFileSync(file, 'utf-8'))
      for (const id of DEAD_IDS) {
        if (id.test(source)) violations.push(`${rel} matches ${id}`)
      }
    }
    expect(violations).toEqual([])
  })
})

describe('INV-13 — manual/auto parity', () => {
  it('the same orb resolves identically through manual pick and auto cursor', () => {
    const manualProvider = buildKiemPhoProvider(hienPlayer(['orb_dam', 'orb_chem'], 'golden_core'), [])
    const autoProvider = buildKiemPhoProvider(hienPlayer(['orb_dam', 'orb_chem'], 'golden_core'), [])
    const participant = {} as Parameters<typeof autoProvider.resolveBasic>[0]

    // Advance auto cursor to orb_chem (slot 2), then compare defs.
    autoProvider.resolveBasic(participant)
    const autoDef = autoProvider.resolveBasic(participant)
    const manualDef = manualProvider.resolveManualPick!('orb_chem')

    expect(manualDef).toBe(autoDef) // same authored def object
    expect(manualDef).toBe(KIEM_PHO_ORBS['orb_chem'])
  })
})

describe('INV-14 — `the` isolation', () => {
  it('no kiem-tu source file reads or writes currentThe', () => {
    const kiemTuDirs = [
      join(srcRoot, 'core', 'kiem-tu'),
      join(srcRoot, 'data', 'progression'),
    ]
    const extraFiles = [
      join(srcRoot, 'data', 'skill', 'KiemPhoOrbs.ts'),
      join(srcRoot, 'data', 'skill', 'KiemPhoCombos.ts'),
      join(srcRoot, 'data', 'buff', 'KiemPhoBuffs.ts'),
      join(srcRoot, 'data', 'skill', 'NguKiemDaoSkills.ts'),
    ]

    const files = [
      ...kiemTuDirs.flatMap(listSourceFiles),
      ...extraFiles,
    ].filter((f) => /KiemTu|kiem-tu|KiemPho|NguKiem/i.test(f) && !f.endsWith('.test.ts'))

    for (const file of files) {
      const source = stripComments(readFileSync(file, 'utf-8'))
      expect(/currentThe/.test(source), `${file} touches currentThe`).toBe(false)
    }
  })
})

describe('INV-15 — precursor lock (K3)', () => {
  it.each(MORTAL_PRECURSOR_SKILL_IDS)(
    'precursor %s is unequippable once any cultivation path is chosen',
    (skillId) => {
      const gameManager = new GameManager()
      gameManager.catalogOps.registerSkillTemplates(SKILLS)
      gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)

      const player = createDefaultPlayer()
      player.realmId = 'mortal'
      player.realmLevel = 12
      player.skillCastCounts = { tram: 0 }
      gameManager.setActivePlayer(player)
      gameManager.progressionOps.learnSkill('tram')
      gameManager.skillSystem.equipToSlot('tram', 0)

      expect(gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', player)).toBe(true)
      expect(gameManager.progressionOps.setSkillLoadoutSlot(player, 0, skillId)).toBe(false)
    },
  )

  it('kiem_tu basic resolution no longer routes through authored precursor skills', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)

    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    gameManager.setActivePlayer(player)
    gameManager.progressionOps.learnSkill('tram')
    gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', player)

    const authoredId = (
      gameManager as unknown as {
        authoredBasicSkillId(p: typeof player): string | undefined
      }
    ).authoredBasicSkillId(player)

    expect(authoredId).toBeUndefined()
    expect(unlockedOrbs(1)).toContain('orb_dam')
  })
})
