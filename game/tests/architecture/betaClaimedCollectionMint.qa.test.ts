/**
 * BLIND FALSIFICATION probe (devin/qa-fixpoint @ a7d12edf) - claimed-source
 * modifier/learned-record COLLECTION invariants.
 *
 * Each case builds a save slice no writer can produce (collection-level
 * forgery: duplicate entries of a once-emitted claim, or a valid-shaped
 * claim carrying fields no writer emits), asserts the envelope accepts
 * it, then asserts the security invariant at the live mint seam. A
 * FAILING second assertion is the defect evidence.
 *
 * Mint seams exercised:
 *   resolvePlayerStatAssembly (Player.ts) - pushes one emission per
 *     persisted realm/talent entry; the loi_kiep branch pushes the
 *     PERSISTED object verbatim; runPipeline has no id dedupe and honors
 *     stacks/multiplier/tag.
 *   getActiveTimedModifiers (GameManagerPersistentEffectOps) - flatMaps
 *     persisted effect.modifiers verbatim into the live pipeline.
 *   SkillManager.restore + getScaledPassiveModifiers + PassiveSystem -
 *     emit per held record; learn() is the only writer and dedupes, so
 *     a duplicated skills[] entry is unproducible.
 */
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, resolvePlayerStatAssembly, type PlayerData } from '@/core/player/Player'
import { grantRealmPassive } from '@/core/realm/RealmPassiveSystem'
import { calculateStats, type StatModifier } from '@/core/stats/StatCalculator'
import { validateGameSaveShape } from '@/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '@/services/save/saveVersion'
import { lockBetaFeaturesForTests } from '@/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '@/core/game/__fixtures__/betaTalentsUnlock'
import { SkillManager } from '@/core/skill/SkillManager'
import { SkillSystem } from '@/core/skill/SkillSystem'
import { PassiveSystem } from '@/core/skill/PassiveSystem'
import { EventBus } from '@/core/events/EventBus'
import { SKILLS } from '@/data/skill/Skills'
import { TECHNIQUES } from '@/data/technique/Techniques'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function player(overrides: Partial<PlayerData> = {}): PlayerData {
  return {
    ...createDefaultPlayer(),
    ...overrides,
  }
}

// A zero-issue committed qi_refining spell save needs its initiation
// receipts: grade >= 1 and <= completedTiers (writer clamp), the way's
// canonical technique holder entry, and the spell_pathway pair.
function spellWayPlayer(overrides: Partial<PlayerData> = {}): PlayerData {
  const p = player({
    realmId: 'qi_refining',
    cultivationPath: 'spell',
    cultivationWay: 'spell_pathway',
    breakthroughGrade: 1,
    ...overrides,
  })
  p.bodyProgression.body_refinement.completedTiers = Math.max(
    1,
    p.breakthroughGrade ?? 1,
  )
  return p
}

function spellTechniqueEntry() {
  const template = TECHNIQUES.find(
    (technique) => technique.id === 'five_elements_art',
  )
  if (!template) {
    throw new Error('five_elements_art template missing')
  }
  return structuredClone(template)
}

function makeSave(p: PlayerData, extra: Record<string, unknown> = {}) {
  return {
    version: CURRENT_SAVE_VERSION,
    player: p,
    techniques: p.cultivationWay === undefined ? [] : [spellTechniqueEntry()],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
    ...extra,
  }
}

// Full-envelope rejection: the bounds minted by QA-FS-1..4 reject each
// hostile payload at the envelope; the runtime invariant assert after it
// documents what the payload would have minted had it loaded.
function envelopeIssues(save: unknown) {
  return validateGameSaveShape(save as never).issues
}

describe('QA-FS-1: duplicated claimed-source realm-passive entries', () => {
  it('the envelope accepts byte-valid duplicate passive entries and every copy mints', () => {
    // hostile = a real grant (marker + authored set) plus 5 forged
    // duplicate copies of one authored entry - the writer emits exactly
    // one entry per (passive, stat), so duplicates are unproducible.
    const hostile = spellWayPlayer({ breakthroughGrade: 2 })
    grantRealmPassive(hostile, 'qi_refining')
    const authored = hostile.modifiers.find((m) => m.id === 'realm-passive:nhap_dao:maxHp')
    expect(authored).toBeDefined()
    for (let i = 0; i < 5; i += 1) {
      hostile.modifiers.push(structuredClone(authored!))
    }

    const control = spellWayPlayer({ breakthroughGrade: 2 })
    grantRealmPassive(control, 'qi_refining')

    expect(envelopeIssues(makeSave(hostile))).not.toEqual([])

    const hostileStats = resolvePlayerStatAssembly(hostile, []).stats
    const controlStats = resolvePlayerStatAssembly(control, []).stats

    // INVARIANT (restore mint demo): the payload WOULD have minted N x
    // the authored grant - the envelope bound above is load-bearing.
    expect(hostileStats.maxHp).toBeGreaterThan(controlStats.maxHp)
  })
})

describe('QA-FS-2: loi kiep modifier entries carry writer-absent fields verbatim', () => {
  const loiKiepEntry = (extra: Partial<StatModifier>): StatModifier => ({
    id: 'talent_loi_kiep_strength',
    sourceId: 'loi_kiep',
    sourceType: 'talent',
    stat: 'strength',
    percent: 0.1,
    ...extra,
  })

  it('the writer emits id/sourceId/sourceType/stat/percent only - forged stacks/multiplier/tag mint', () => {
    // Authored writer shape (applyLoiKiepVictoryBonus): id, sourceId,
    // sourceType, stat, percent. The envelope pins id/stat/percent/
    // ownership and bans flat - stacks/multiplier/tag are unchecked and
    // the assembly pushes the persisted object verbatim.
    const hostile = spellWayPlayer()
    hostile.selectedTalentIds = ['loi_kiep']
    hostile.modifiers.push(loiKiepEntry({ multiplier: 2, stacks: 4 }))

    const control = spellWayPlayer()
    control.selectedTalentIds = ['loi_kiep']
    control.modifiers.push(loiKiepEntry({}))

    expect(envelopeIssues(makeSave(hostile))).not.toEqual([])

    const hostileStats = resolvePlayerStatAssembly(hostile, []).stats
    const controlStats = resolvePlayerStatAssembly(control, []).stats

    // INVARIANT (restore mint demo): forged aux fields WOULD have
    // minted a More-tier product - the bound is load-bearing.
    expect(hostileStats.strength).toBeGreaterThan(controlStats.strength)
  })

  it('duplicated loi kiep entries each emit the authored percent', () => {
    const hostile = spellWayPlayer()
    hostile.selectedTalentIds = ['loi_kiep']
    hostile.modifiers.push(loiKiepEntry({}))
    hostile.modifiers.push(loiKiepEntry({}))

    const control = spellWayPlayer()
    control.selectedTalentIds = ['loi_kiep']
    control.modifiers.push(loiKiepEntry({}))

    expect(envelopeIssues(makeSave(hostile))).not.toEqual([])

    const hostileStats = resolvePlayerStatAssembly(hostile, []).stats
    const controlStats = resolvePlayerStatAssembly(control, []).stats

    // INVARIANT (restore mint demo): N copies WOULD have minted N x
    // the authored percent - the dedupe bound is load-bearing.
    expect(hostileStats.strength).toBeGreaterThan(controlStats.strength)
  })
})

describe('QA-FS-3: timed-effect modifier entries carry writer-absent stacks', () => {
  it('a pill-regen modifier forged with stacks mints flat*stacks past the flat bound', () => {
    // hoi_linh_dan_mortal is a beta-enabled mp_regen pill: authored
    // regen shape = effectGroup 'hoi_linh_dan', stackable, exactly one
    // manaRegenPerTurn modifier, flat <= mpPerSecond x 1.5 (= 3), domain
    // 'spell' (PillSystem emits it; the restore filter requires it on a
    // gated stat). The envelope pins stat/flat/percent/multiplier only -
    // stacks is unchecked: getActiveTimedModifiers flatMaps the
    // persisted modifier verbatim and runPipeline pays flat*stacks.
    const forgedRegen: StatModifier = {
      id: 'hoi_linh_dan_mortal:manaRegenPerTurn',
      sourceId: 'hoi_linh_dan_mortal',
      sourceType: 'pill',
      stat: 'manaRegenPerTurn',
      flat: 3,
      domain: 'spell',
      stacks: 50,
    }
    const hostile = spellWayPlayer()
    hostile.persistentTimedEffects = [
      {
        id: 'pill_regen:hoi_linh_dan_mortal',
        sourceItemId: 'hoi_linh_dan_mortal',
        effectGroup: 'hoi_linh_dan',
        durationStackable: true,
        appliedAtMs: 0,
        expiresAtMs: Date.now() + 60_000,
        modifiers: [forgedRegen],
      },
    ]
    hostile.lastSavedAt = Date.now()

    const control = spellWayPlayer()
    control.persistentTimedEffects = [
      {
        ...hostile.persistentTimedEffects[0]!,
        modifiers: [{ ...forgedRegen, stacks: undefined }],
      },
    ]
    control.lastSavedAt = hostile.lastSavedAt

    expect(envelopeIssues(makeSave(hostile))).not.toEqual([])

    // The consumer read is literal: getActiveTimedModifiers flatMaps
    // effect.modifiers verbatim (GameManagerPersistentEffectOps:279).
    const timedModifiers = hostile.persistentTimedEffects
      .filter((effect) => effect.expiresAtMs > Date.now())
      .flatMap((effect) => effect.modifiers)
    const hostileStats = resolvePlayerStatAssembly(hostile, timedModifiers).stats
    const controlStats = resolvePlayerStatAssembly(
      control,
      control.persistentTimedEffects.flatMap((effect) => effect.modifiers),
    ).stats

    // INVARIANT (restore mint demo): forged stacks WOULD have minted
    // flat*stacks past the bound - the bound is load-bearing.
    expect(hostileStats.manaRegenPerTurn).toBeGreaterThan(controlStats.manaRegenPerTurn)
  })
})

describe('QA-FS-4: duplicated learned passive skill records', () => {
  const PASSIVE_ID = 'passive_linh_khi_cam_ung' // realm-ladder passive, requiredRealmId qi_refining

  it('the envelope accepts duplicate skills[] entries and each copy emits the passive set', () => {
    const template = SKILLS.find((skill) => skill.id === PASSIVE_ID)
    expect(template).toBeDefined()
    expect(template!.type).toBe('passive')

    const hostile = spellWayPlayer()
    const save = makeSave(hostile, {
      skills: [{ id: PASSIVE_ID }, { id: PASSIVE_ID }],
    })
    expect(envelopeIssues(save)).not.toEqual([])

    // Runtime path as GameManagerSaveRestore performs it: per-entry
    // template rebuild, then SkillManager.restore stores every record -
    // learn() dedupes by id, so a writer can never mint two records.
    const manager = new SkillManager()
    manager.restore([structuredClone(template!), structuredClone(template!)])
    const skillSystem = new SkillSystem(manager)
    const emitted = skillSystem
      .getScaledPassiveModifiers()
      .filter((modifier) => modifier.id === `${PASSIVE_ID}_attack`)

    // INVARIANT (restore mint demo): N copies WOULD have emitted the
    // passive set N times - the dedupe bound is load-bearing.
    expect(emitted.length).toBe(2)

    // Battle channel: one 'hit' event stacks every held record - the
    // duplicate accrues at N times the authored rate.
    const eventBus = new EventBus()
    new PassiveSystem(eventBus, manager, skillSystem)
    eventBus.emit('hit', { type: 'hit', sourceId: 'player' })

    const stacked = skillSystem
      .getScaledPassiveModifiers()
      .filter((modifier) => modifier.id === `${PASSIVE_ID}_attack`)
    const totalStacks = stacked.reduce((sum, modifier) => sum + (modifier.stacks ?? 0), 0)

    expect(totalStacks).toBe(2)
  })
})
