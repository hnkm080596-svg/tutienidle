// QA FIXPOINT probe (third bind wave, run qa-fixpoint-master) -
// authority binds the save boundary owed but did not check:
//
// F-TRB-RECEIPT (High): committedOutcome.receipt was kind-checked
// only. presentOutcome (useTribulation.ts) derefs
// announcement.titleKey/.bodyKey on EVERY settle tick before
// consumeReceipt can clear the record - a receipt missing the field
// crash-loops the tick forever. A receipt.kind not matching
// committed.outcome replays the wrong settle arm, and a persisted
// receipt.standalonePanel bypassed ui.openStandalonePanel's
// isBetaStandalonePanel gate (a 'companion' receipt mounted a
// scope-hidden panel). The validator now binds the receipt to the
// exact writer emit shape (kind bound to outcome, announcement keys
// present, standalonePanel bound to the quan_khi emit AND the beta
// panel gate), and presentOutcome routes through the gated opener.
//
// F-REALM-CEILING (Medium): player.realmId was REALMS-membership
// only - a realmId above progressionCeilingRealmId validated and
// relaxed every realmIndex-scaled bound (talent picks, loi kiep
// percent, technique grade ceiling). No beta transition can produce
// it (isRealmTransitionEnabled fails closed), so the boundary now
// rejects the claim on player.realmId.
import { describe, expect, it } from 'vitest'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { createDefaultPlayer } from '../../core/player/Player'
import { commitWitnessFor } from '../../core/tribulation/TribulationCommitWitness.fixture'

function validSave(): Record<string, unknown> {
  return {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
}

function pathsOf(result: ReturnType<typeof validateGameSaveShape>): string[] {
  return result.issues.map((issue) => issue.path)
}

// A committed-path player that satisfies every realm-coherence witness
// the shape replays (F-REALM-1): committed (path, way) pair, stamped
// breakthroughGrade, highestFoundationAchieved at foundation+, the
// mortal-pick skill cleared by the ritual.
function committedPlayer(realmId: string): ReturnType<typeof createDefaultPlayer> {
  const player = createDefaultPlayer()
  player.realmId = realmId
  player.realmLevel = 1
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  player.spellPath = { element: null }
  player.mortalBasicSkillId = undefined
  player.breakthroughGrade = 1
  if (realmId !== 'qi_refining') {
    player.highestFoundationAchieved = 'human'
  }
  player.nodeLevels = {}
  player.purchasedNodeIds = []
  return player
}

// Lagging live grade at a foundation+ realm must carry the sealed
// grade-1 record (canonicality v75) so only the probed claim fires.
function laggingTechnique(): Record<string, unknown> {
  return {
    id: 'five_elements_art',
    name: 'Five Elements Art',
    description: 'payload',
    grade: 1,
    rank: 2,
    mastery: 100,
    quality: 'huyen',
    gradeHistory: { 1: { finalRank: 12, completionState: 'dai_thanh' } },
  }
}

type CommittedOutcomeRecord = Record<string, unknown> & { receipt: unknown }

function committedSaveWith(
  committedOutcome: Record<string, unknown>,
): Record<string, unknown> {
  const save = validSave()
  ;(save as Record<string, unknown>).tribulation = {
    committedOutcome,
    cooldownUntil: 0,
  }
  return save
}

// A replay-valid witnessed settle: qi_refining -> foundation_establishment
// victory, receipt bound (player already landed at the target realm).
function settledVictorySave(receiptOverrides: Record<string, unknown> = {}) {
  const save = committedSaveWith({
    attemptId: 1,
    outcome: 'victory',
    targetRealmId: 'foundation_establishment',
    grade: 'human',
    breakthroughType: 'normal',
    ...commitWitnessFor({
      attemptId: 1,
      outcome: 'victory',
      targetRealmId: 'foundation_establishment',
      grade: 'human',
      breakthroughType: 'normal',
      departingRealmId: 'qi_refining',
      chapterIndex: 2,
      chaptersTotal: 3,
      lightningStrikesTaken: 0,
      attemptSeed: 7,
    }),
    receipt: {
      kind: 'victory',
      realmEntered: 'foundation_establishment',
      realmName: 'Foundation Establishment',
      foundationGrade: 'human',
      talentConverted: false,
      questRealmTransitionMarked: true,
      announcement: {
        titleKey: 'announce.tribulation.foundation.title',
        titleParams: { label: 'HUMAN' },
        bodyKey: 'announce.tribulation.foundation.body',
      },
      ...receiptOverrides,
    },
    settlementError: false,
  })
  save.player = committedPlayer('foundation_establishment')
  save.techniques = [laggingTechnique()]
  return save
}

// A replay-valid witnessed settle: mortal -> qi_refining defeat,
// receipt bound (player still sits in the departing realm).
function settledDefeatSave(receiptOverrides: Record<string, unknown> = {}) {
  const save = committedSaveWith({
    attemptId: 2,
    outcome: 'defeat',
    targetRealmId: 'qi_refining',
    grade: 'human',
    breakthroughType: 'normal',
    ...commitWitnessFor({
      attemptId: 2,
      outcome: 'defeat',
      targetRealmId: 'qi_refining',
      grade: 'human',
      breakthroughType: 'normal',
      departingRealmId: 'mortal',
      chapterIndex: 1,
      chaptersTotal: 2,
      lightningStrikesTaken: 2,
      attemptSeed: 11,
    }),
    receipt: {
      kind: 'defeat',
      cultivationLossPercent: 10,
      spiritStoneId: 'spirit_stone_ha_pham',
      spiritStonesLost: 3,
      announcement: {
        titleKey: 'announce.tribulation.defeat.title',
        bodyKey: 'announce.tribulation.defeat.body',
      },
      ...receiptOverrides,
    },
    settlementError: false,
  })
  // The defeated run departed a plain mortal player (the Quan Khi
  // gauntlet is the mortal -> qi_refining ritual).
  return save
}

function receiptOf(save: Record<string, unknown>): Record<string, unknown> {
  const committed = (save.tribulation as Record<string, unknown>)
    .committedOutcome as CommittedOutcomeRecord
  return committed.receipt as Record<string, unknown>
}

describe('F-TRB-RECEIPT: committedOutcome.receipt binds the writer emit shape', () => {
  it('control: a bound replay-valid victory receipt validates', () => {
    expect(validateGameSaveShape(settledVictorySave()).ok).toBe(true)
  })

  it('control: a bound replay-valid defeat receipt validates', () => {
    expect(validateGameSaveShape(settledDefeatSave()).ok).toBe(true)
  })

  it('a receipt missing announcement.titleKey is rejected - presentOutcome derefs it every settle tick', () => {
    const save = settledVictorySave()
    receiptOf(save).announcement = { bodyKey: 'announce.tribulation.foundation.body' }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.tribulation.committedOutcome.receipt.announcement.titleKey')
  })

  it('a receipt with no announcement object is rejected', () => {
    const save = settledVictorySave()
    receiptOf(save).announcement = undefined

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.tribulation.committedOutcome.receipt.announcement')
  })

  it('non-object announcement params are rejected', () => {
    const save = settledVictorySave()
    ;(receiptOf(save).announcement as Record<string, unknown>).titleParams = 'label=HUMAN'

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(
      '.tribulation.committedOutcome.receipt.announcement.titleParams',
    )
  })

  it('a defeat receipt bound to a victory outcome is rejected', () => {
    const save = settledVictorySave({
      kind: 'defeat',
      cultivationLossPercent: 10,
      spiritStoneId: 'spirit_stone_ha_pham',
      spiritStonesLost: 3,
    })

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.tribulation.committedOutcome.receipt.kind')
  })

  it('a victory receipt bound to a defeat outcome is rejected', () => {
    const save = settledDefeatSave()
    // The receipt is not digest-covered - flipping only its kind
    // isolates the outcome binding.
    receiptOf(save).kind = 'victory'

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.tribulation.committedOutcome.receipt.kind')
  })

  it('a scope-hidden standalonePanel receipt is rejected (isBetaStandalonePanel gate)', () => {
    const save = settledVictorySave({ standalonePanel: 'companion' })

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.tribulation.committedOutcome.receipt.standalonePanel')
  })

  it('a standalonePanel receipt on a non-Quan-Khi target is rejected', () => {
    // The only writer emit is 'quan_khi' for the mortal -> qi_refining
    // ritual - the same panel id on a foundation victory is forged.
    const save = settledVictorySave({ standalonePanel: 'quan_khi' })

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.tribulation.committedOutcome.receipt.standalonePanel')
  })

  it('a realmEntered off the committed targetRealmId is rejected', () => {
    const save = settledVictorySave({ realmEntered: 'golden_core' })

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.tribulation.committedOutcome.receipt.realmEntered')
  })

  it('a victory receipt missing the writer flags is rejected', () => {
    const save = settledVictorySave()
    receiptOf(save).talentConverted = 'yes'

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.tribulation.committedOutcome.receipt.talentConverted')
  })

  it('a foundation victory receipt missing foundationGrade is rejected', () => {
    const save = settledVictorySave({ foundationGrade: undefined })

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.tribulation.committedOutcome.receipt.foundationGrade')
  })

  it('a defeat receipt missing spiritStoneId is rejected', () => {
    const save = settledDefeatSave({ spiritStoneId: undefined })

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.tribulation.committedOutcome.receipt.spiritStoneId')
  })
})

describe('F-REALM-CEILING: a realmId beyond the beta release ceiling is rejected', () => {
  it.each([
    'golden_core',
    'nascent_soul',
    'soul_transformation',
    'void_refinement',
    'body_integration',
    'mahayana',
    'tribulation',
  ])('realmId %s rejects on player.realmId', (realmId) => {
    const save = validSave()
    save.player = committedPlayer(realmId)
    save.techniques = [laggingTechnique()]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.realmId')
  })

  it('control: a coherent foundation_establishment save still validates', () => {
    const save = validSave()
    save.player = committedPlayer('foundation_establishment')
    save.techniques = [laggingTechnique()]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('control: a qi_refining save still validates', () => {
    const save = validSave()
    save.player = committedPlayer('qi_refining')
    save.techniques = [
      {
        id: 'five_elements_art',
        name: 'Five Elements Art',
        description: 'payload',
        grade: 1,
        rank: 2,
        mastery: 100,
        quality: 'huyen',
        gradeHistory: {},
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})
