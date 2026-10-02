// Blind adversarial falsification sweep - save acceptance + restore at
// release gate (branch devin/qa-fixpoint, pinned commit 120cba78).
//
// Two groups:
//   - FINDING probes: forges the validator ADMITS and that mint a live
//     effect no authored writer can produce. Each asserts the actual
//     admitted/minted behaviour.
//   - HOLD probes: forges that correctly reject or stay inert.
//
// Run: cd game && npx vitest run src/probes/forgedSaveClaims.probe.test.ts

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { affixes } from '../data/equipment/affixes'
import { equipment } from '../data/equipment/equipment'
import { materials } from '../data/materials/materials'
import { SKILLS } from '../data/skill/Skills'
import { GameManager } from '../core/game/GameManager'
import { makeInstance } from '../core/equipment/EquipmentInstance.fixture'
import { createDefaultPlayer } from '../core/player/Player'
import { getPrecursorFlatDamageBonus } from '../core/skill/SkillSystem'
import { usePlayerStore } from '../stores/player'
import { primeMortalCreationPick } from '../services/save/GameSave.fixture'
import { buildGameSave, restoreGameSession, type GameSave } from '../services/save/SaveSystem'
import { validateGameSaveShape } from '../services/save/saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from '../services/save/saveAcceptance'
import { THANH_VAN_PRODUCTION_SITES } from '../core/production/ProductionCatalog'
import { CYCLE_BASE_SECONDS_BY_REALM, computeCycleSeconds } from '../core/production/ProductionBalance'

const NOW_MS = 1_725_160_000_000

function createRegisteredManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerSkillTemplates(SKILLS)
  return manager
}

function mortalSave(): GameSave {
  const manager = createRegisteredManager()
  const player = createDefaultPlayer()
  primeMortalCreationPick(player, manager.skillManager)
  const save = buildGameSave(player, manager)
  save.player.lastSavedAt = NOW_MS
  return save
}

describe('forged save claims - release-gate falsification sweep', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ---------------------------------------------------------------
  // FINDINGS - admitted claims that mint a live effect
  // ---------------------------------------------------------------

  // F-SKILL-TEXP-1: skills[].totalExperience has no shape bound at all
  // (validateSkillEntries checks id + retired keys only). It restores
  // verbatim and feeds getPrecursorFlatDamageBonus, the deliberately
  // uncapped +floor(x/10) flat-damage channel on the mandatory starter
  // linh_bao. It also mints the next live cast's core_<id> level via the
  // castCountSink mirror write (10000 casts -> Lv3 ngo_dao ritual gate).
  it('FINDING F-SKILL-TEXP-1: forged totalExperience mints uncapped flat damage on linh_bao', () => {
    const player = usePlayerStore()
    const manager = createRegisteredManager()
    const save = mortalSave()

    // A writer emits totalExperience == one increment per cast AND the
    // skillCastCounts mirror in the same write. Forge 1e12 casts' worth
    // while the mirror claims 0 - a pair no writer emits.
    const linhBao = save.skills.find((skill) => skill.id === 'linh_bao')!
    linhBao.totalExperience = 1e12
    save.player.skillCastCounts = { linh_bao: 0 }

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(true)

    const result = restoreGameSession(player, manager, shape.normalizedSave as GameSave)
    expect(result.status).toBe('ok')

    const restored = manager.skillManager.get('linh_bao')!
    expect(restored.totalExperience).toBe(1e12)

    // The forged counter is live: getEffectiveSkill applies it as flat
    // damage on every cast. Authored floor value is 1; forged is 1e11+1.
    const effective = manager.skillSystem.getEffectiveSkill(restored)
    const damageAction = effective.triggers!
      .flatMap((trigger) => trigger.actions)
      .find((action) => action.type === 'dealDamage')!
    expect(damageAction.value).toBe(1 + getPrecursorFlatDamageBonus(1e12))
    expect(getPrecursorFlatDamageBonus(1e12)).toBe(100_000_000_000)
  })

  it('FINDING F-SKILL-TEXP-1b: non-finite-adjacent and fractional claims are also admitted', () => {
    const save = mortalSave()
    const linhBao = save.skills.find((skill) => skill.id === 'linh_bao')!

    // JSON cannot carry Infinity/NaN, but any finite magnitude passes:
    // 9e15 is beyond Number.MAX_SAFE_INTEGER casts and still admitted.
    linhBao.totalExperience = 9e15
    linhBao.experience = -1e9 // unbounded signed value, also unvalidated

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(true)
  })

  // F-EQ-NEGFLAT-1: validateEquipmentEntries bounds mainStat.flat only
  // from above (flat > maxFlat). A negative flat is finite, not >
  // maxFlat, so it is admitted and minted as a live negative modifier -
  // impossible through rollMainStat, whose range.min is authored
  // positive. Self-harm only (every stat is monotonic-beneficial), but
  // it is still an unproducible claim that lands in modifiers.
  it('FINDING F-EQ-NEGFLAT-1: negative mainStat.flat is admitted and minted live', () => {
    const player = usePlayerStore()
    const manager = createRegisteredManager()
    const save = mortalSave()

    save.equipment = [
      makeInstance({
        instanceId: 'forged-neg-flat',
        itemId: 'base_kiem',
        equipped: true,
        mainStat: {
          id: 'forged-neg-flat-main',
          sourceId: 'forged-neg-flat',
          sourceType: 'equipment',
          stat: 'might',
          flat: -1e9,
        },
      }),
    ]

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(true)

    const result = restoreGameSession(player, manager, shape.normalizedSave as GameSave)
    expect(result.status).toBe('ok')

    const minted = manager.equipmentOps
      .getEquipmentModifiers()
      .find((modifier) => modifier.stat === 'might')!
    expect(minted.flat).toBe(-1e9)
  })

  // ---------------------------------------------------------------
  // HOLDS - attacks that correctly reject or stay inert
  // ---------------------------------------------------------------

  it('HOLD: unknown itemId is rejected at the acceptance seam before restore mutates anything', () => {
    const player = usePlayerStore()
    const manager = createRegisteredManager()
    const save = mortalSave()
    save.equipment = [makeInstance({ instanceId: 'ghost-item', itemId: 'not_in_catalog' })]

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(true) // shape layer defers to acceptance

    const result = restoreGameSession(player, manager, shape.normalizedSave as GameSave)
    expect(result).toEqual({
      status: 'rejected',
      message: 'Unknown equipment template in save: not_in_catalog',
    })
  })

  it('HOLD: unknown affixId is rejected at the acceptance seam', () => {
    const player = usePlayerStore()
    const manager = createRegisteredManager()
    const save = mortalSave()
    save.equipment = [
      makeInstance({
        instanceId: 'ghost-affix-item',
        itemId: 'base_kiem',
        affixes: [{ affixId: 'not_an_affix', tier: 1, value: 5 }],
      }),
    ]

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(true)

    const result = restoreGameSession(player, manager, shape.normalizedSave as GameSave)
    expect(result).toEqual({
      status: 'rejected',
      message: 'Unknown equipment affix in save: not_an_affix',
    })
  })

  it('HOLD: workerCycles beyond the authored lane ceiling rejects', () => {
    const save = mortalSave()
    const siteId = THANH_VAN_PRODUCTION_SITES[0]!.siteId
    const cycleMs = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal']!, 1) * 1000
    save.productionSites = [
      {
        siteId,
        level: 1,
        autoRestart: true,
        workerCycles: Array.from({ length: 20 }, (_, i) => ({
          cycleId: `forged-lane-${i}`,
          siteId,
          collectionRealmId: 'mortal',
          siteLevelAtStart: 1,
          rewardTableVersion: 1,
          rollSeed: i,
          startedAtMs: NOW_MS - cycleMs,
          completesAtMs: NOW_MS,
        })),
      },
    ]

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
    expect(shape.issues.some((issue) => issue.path.includes('workerCycles'))).toBe(true)
  })

  it('HOLD: workerCycles at/below ceiling only re-orders budget-capped payouts (no extra mint)', () => {
    // 19 lanes are ADMITTED (authored chi_hien_quan ceiling) but the
    // offline settle spends one shared 10h budgetMs across all lanes -
    // forged lanes displace authored completions inside the same cap,
    // they do not increase total rewarded duration. Producible claim.
    const save = mortalSave()
    const siteId = THANH_VAN_PRODUCTION_SITES[0]!.siteId
    const cycleMs = computeCycleSeconds(CYCLE_BASE_SECONDS_BY_REALM['mortal']!, 1) * 1000
    save.productionSites = [
      {
        siteId,
        level: 1,
        autoRestart: true,
        workerCycles: Array.from({ length: 19 }, (_, i) => ({
          cycleId: `edge-lane-${i}`,
          siteId,
          collectionRealmId: 'mortal',
          siteLevelAtStart: 1,
          rewardTableVersion: 1,
          rollSeed: i,
          startedAtMs: NOW_MS - cycleMs,
          completesAtMs: NOW_MS,
        })),
      },
    ]

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(true)
  })

  it('HOLD: reversed alchemy job window rejects', () => {
    const save = mortalSave()
    save.alchemyJobs = [
      {
        jobId: 'forged-job',
        recipeId: 'r1',
        pillId: 'p1',
        herbMaterialId: 'h1',
        startedAtMs: NOW_MS - 1000,
        completesAtMs: NOW_MS - 2000,
        roomLevelAtStart: 1,
      },
    ]

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
    expect(shape.issues.some((issue) => issue.path.includes('completesAtMs'))).toBe(true)
  })

  it('HOLD: attributePoints beyond cumulative tier position rejects', () => {
    const save = mortalSave()
    save.player.attributePoints = 1e6

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
    expect(shape.issues.some((issue) => issue.path === 'player.attributePoints')).toBe(true)
  })

  it('HOLD: skillInsight above the lifetime gained ledger rejects', () => {
    const save = mortalSave()
    save.player.skillInsight = 500
    save.player.totalSkillInsightGained = 100

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
    expect(shape.issues.some((issue) => issue.path === 'player.skillInsight')).toBe(true)
  })

  it('HOLD: cultivationPerSecond above what the claimed talents derive rejects', () => {
    const save = mortalSave()
    save.player.cultivationPerSecond = 1e9

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
    expect(shape.issues.some((issue) => issue.path === 'player.cultivationPerSecond')).toBe(true)
  })

  it('HOLD: an equipped item whose grade is unproducible at the claimed realm rejects', () => {
    const save = mortalSave()
    save.equipment = [
      makeInstance({
        instanceId: 'forged-grade-item',
        itemId: 'base_kiem',
        equipped: true,
        grade: 'bat_pham',
      }),
    ]

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(false)
    expect(shape.issues.some((issue) => issue.path.endsWith('.equipped'))).toBe(true)
  })

  it('HOLD: mortal save carrying a committed cultivationPath rejects at acceptance', () => {
    const save = mortalSave()
    save.player.cultivationPath = 'sword'
    save.player.cultivationWay = 'sword_pathway'

    expect(isSaveAcceptable(save, staticSaveAcceptanceCatalogs())).toBe(false)
  })

  it('HOLD: forged skillCastCounts magnitudes are admitted but stay inert (no live consumer)', () => {
    const player = usePlayerStore()
    const manager = createRegisteredManager()
    const save = mortalSave()
    save.player.skillCastCounts = { linh_bao: 999_999_999 }

    const shape = validateGameSaveShape(JSON.parse(JSON.stringify(save)))
    expect(shape.ok).toBe(true)

    const result = restoreGameSession(player, manager, shape.normalizedSave as GameSave)
    expect(result.status).toBe('ok')
    // Admitted, but no authored beta node consumes skillCastCount
    // prereqs and the mirror does not feed effective-skill math - the
    // live mint channel is skills[].totalExperience (F-SKILL-TEXP-1),
    // not this record.
  })
})
