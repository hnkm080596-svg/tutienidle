// ---------------------------------------------------------------------------
// qa-fixpoint WAVE 2 regression probes - holes asserted CLOSED.
//
//   F-TRB-FORGE   (High)   forged tribulation committedOutcome settled a free
//                          breakthrough: the record was content-bound but never
//                          provenance-bound. commitOutcome now stamps a witness
//                          (departing realm, chapter floor, strikes taken,
//                          per-attempt seed, digest over the bundle) and the
//                          shape gate + settle seam both re-derive it.
//   F-ALCH-JOB-FORGE (Med) a fabricated finished alchemyJob settled the pill
//                          without paying inputs. startJob stamps a
//                          reservation witness (canonical wood id, recipe
//                          costs at the rolled costScale, specials, digest);
//                          shape validation and tick both replay it.
//   F-ENHANCE-STREAK (Med) enhanceFailStreak accepted unproducible magnitudes;
//                          the writer never persists > ENHANCE_PITY_THRESHOLD.
//   F-PHAGIAP-CARRY (Med)  phaGiapCarryStacks was unbounded; the sole writer
//                          banks floor(stacks * 0.5) <= the authored max.
//
// Exception ledger (documented acceptance, not fixed this wave):
//   F-ENH-SLOT-FORGE / F-COMPANION-EXP - same-value counter class: a forged
//   value INSIDE authored bounds is indistinguishable from earned progress
//   (no event ledger exists in the schema). Accepted residual per Minh's
//   ruling - owned by the future online-authority layer.
//
// ASCII only (P15).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest'
import { createDefaultPlayer, type PlayerData } from '../../src/core/player/Player'
import { GameManager } from '../../src/core/game/GameManager'
import { EventBus } from '../../src/core/events/EventBus'
import { getRealmIndex } from '../../src/core/realm/realmSystem'
import { ENHANCE_PITY_THRESHOLD } from '../../src/core/equipment/EnhanceCurve'
import { lockBetaFeaturesForTests } from '../../src/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../src/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../src/core/game/__fixtures__/betaTalentsUnlock'
import { materials } from '../../src/data/materials/materials'
import { pills } from '../../src/data/pill/pills'
import { buildings } from '../../src/data/building/buildings'
import { SKILLS } from '../../src/data/skill/Skills'
import { TECHNIQUES } from '../../src/data/technique/Techniques'
import { alchemyRecipes } from '../../src/data/alchemy/alchemyRecipes'
import { alchemySecondsFor } from '../../src/core/alchemy/AlchemySystem'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import type { GameSave } from '../../src/services/save/SaveSystem'
import type { Technique } from '../../src/core/technique/Technique'
import { TribulationDirector } from '../../src/core/tribulation/TribulationDirector'
import {
  TribulationOutcomeService,
  type TribulationPlayerWriter,
} from '../../src/core/tribulation/TribulationOutcomeService'
import {
  alchemyJobFixture as witnessedAlchemyJob,
} from '../../src/core/alchemy/AlchemyJob.fixture'
import {
  commitWitnessFor as witnessedCommitOutcomeFields,
} from '../../src/core/tribulation/TribulationCommitWitness.fixture'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function makeManager(): GameManager {
  const manager = new GameManager()
  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerPills(pills)
  manager.catalogOps.registerBuildings(buildings)
  manager.catalogOps.registerSkillTemplates([...SKILLS])
  manager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  manager.catalogOps.registerAlchemyRecipes(alchemyRecipes)
  return manager
}

function committedPlayer(realmId: string): PlayerData {
  const player = createDefaultPlayer()
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  player.spellPath = { element: null }
  player.realmId = realmId
  player.realmLevel = 1
  delete player.mortalBasicSkillId
  if (getRealmIndex(realmId) >= getRealmIndex('qi_refining')) {
    player.breakthroughGrade = 1
  }
  if (getRealmIndex(realmId) >= getRealmIndex('foundation_establishment')) {
    player.highestFoundationAchieved = 'human'
  }
  return player
}

function wayTechnique(realmIndex: number): Technique {
  const entry = structuredClone(TECHNIQUES.find((t) => t.id === 'five_elements_art')!)
  entry.grade = Math.max(1, Math.min(entry.grade, realmIndex))
  entry.gradeHistory = {}
  for (let g = 1; g < entry.grade; g += 1) {
    entry.gradeHistory[g] = { finalRank: 18, completionState: 'vien_man' }
  }
  if (entry.grade < realmIndex) {
    entry.gradeHistory[entry.grade] = { finalRank: 18, completionState: 'vien_man' }
  }
  return entry
}

function committedSave(
  realmId: string,
  overrides: Partial<GameSave> = {},
): { save: GameSave } {
  const player = committedPlayer(realmId)
  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: { ...player, lastSavedAt: Date.now() },
    techniques: [wayTechnique(getRealmIndex(realmId))],
    skills: [],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    quests: { active: [], completedOnceIds: [], lastDailyResetAtMs: 0 },
    productionSites: [],
    alchemyJobs: [],
    decompose: {
      settings: { gradeFilter: 'all', ageFilter: 'all', workers: 0 },
      nextCycleAt: 0,
      started: false,
    },
    ...overrides,
  }
  return { save }
}

function shapeOf(save: GameSave) {
  return validateGameSaveShape(JSON.parse(JSON.stringify(save)))
}

// A witnessed qi_refining -> foundation_establishment victory record,
// pending settle. Replays the exact bundle commitOutcome stamps.
function witnessedVictory() {
  return {
    attemptId: 1,
    outcome: 'victory' as const,
    targetRealmId: 'foundation_establishment',
    grade: 'human' as const,
    breakthroughType: 'normal' as const,
    ...witnessedCommitOutcomeFields({
      attemptId: 1,
      outcome: 'victory' as const,
      targetRealmId: 'foundation_establishment',
      grade: 'human' as const,
      breakthroughType: 'normal' as const,
      departingRealmId: 'qi_refining',
      chapterIndex: 2,
      chaptersTotal: 3,
      lightningStrikesTaken: 0,
      attemptSeed: 7,
    }),
    receipt: null,
    settlementError: false,
  }
}

const pillRoom = {
  instanceId: 'b-pill',
  buildingId: 'pill_room',
  level: 1,
  lastCollectedAt: 0,
}

const LIVE_RECIPE = alchemyRecipes.find((r) => r.id === 'alchemy_truc_co_dan')!

// ---------------------------------------------------------------------------
// F-TRB-FORGE: committedOutcome provenance witness
// ---------------------------------------------------------------------------
describe('F-TRB-FORGE: a committedOutcome without provenance is rejected', () => {
  it('a record with no witness field at all is rejected', () => {
    const { witness: _stripped, ...witnessless } = witnessedVictory()
    void _stripped
    const { save } = committedSave('qi_refining', {
      // Cast: the forged record deliberately omits the writer field -
      // that is exactly what the boundary arm rejects.
      tribulation: {
        committedOutcome: witnessless as never,
        cooldownUntil: 0,
      },
    })
    expect(shapeOf(save).ok).toBe(false)
  })

  it('a witness whose digest does not replay is rejected', () => {
    const record = witnessedVictory()
    const { save } = committedSave('qi_refining', {
      tribulation: {
        committedOutcome: {
          ...record,
          witness: { ...record.witness, digest: (record.witness.digest + 1) >>> 0 },
        },
        cooldownUntil: 0,
      },
    })
    expect(shapeOf(save).ok).toBe(false)
  })

  it('a victory record claiming a floor off the authored final chapter is rejected', () => {
    const record = witnessedVictory()
    // Victory only commits from the last chapter - a mid-gauntlet floor
    // can never come from commitOutcome's victory arm. The digest is
    // recomputed over the shifted floor so only the floor rule fires.
    const shifted = {
      ...record,
      ...witnessedCommitOutcomeFields({
        attemptId: record.attemptId,
        outcome: 'victory',
        targetRealmId: record.targetRealmId,
        grade: record.grade,
        breakthroughType: record.breakthroughType,
        departingRealmId: 'qi_refining',
        chapterIndex: 0,
        chaptersTotal: 3,
        lightningStrikesTaken: 0,
        attemptSeed: 7,
      }),
    }
    const { save } = committedSave('qi_refining', {
      tribulation: { committedOutcome: shifted, cooldownUntil: 0 },
    })
    expect(shapeOf(save).ok).toBe(false)
  })

  it('a record targeting a realm with no authored gauntlet is rejected', () => {
    // golden_core has no authored chapter table: no writer can ever
    // have produced the record (dormant-transition laundering is closed).
    const record = {
      attemptId: 2,
      outcome: 'victory' as const,
      targetRealmId: 'golden_core',
      grade: 'human' as const,
      breakthroughType: 'normal' as const,
      ...witnessedCommitOutcomeFields({
        attemptId: 2,
        outcome: 'victory',
        targetRealmId: 'golden_core',
        grade: 'human',
        breakthroughType: 'normal',
        departingRealmId: 'foundation_establishment',
        chapterIndex: 0,
        chaptersTotal: 1,
        lightningStrikesTaken: 0,
        attemptSeed: 9,
      }),
      receipt: null,
      settlementError: false,
    }
    const { save } = committedSave('foundation_establishment', {
      tribulation: { committedOutcome: record, cooldownUntil: 0 },
    })
    expect(shapeOf(save).ok).toBe(false)
  })

  it('a pending record whose departing realm does not match the player is rejected', () => {
    // A real commit remembers the realm the run departed FROM - a forged
    // record claiming it departed mortal while the player stands at
    // qi_refining is unproducible.
    const record = witnessedVictory()
    const { save } = committedSave('qi_refining', {
      tribulation: {
        committedOutcome: {
          ...record,
          ...witnessedCommitOutcomeFields({
            attemptId: record.attemptId,
            outcome: 'victory',
            targetRealmId: record.targetRealmId,
            grade: record.grade,
            breakthroughType: record.breakthroughType,
            departingRealmId: 'mortal',
            chapterIndex: 2,
            chaptersTotal: 3,
            lightningStrikesTaken: 0,
            attemptSeed: 7,
          }),
        },
        cooldownUntil: 0,
      },
    })
    expect(shapeOf(save).ok).toBe(false)
  })

  it('control: a replay-valid witnessed pending record still validates', () => {
    const { save } = committedSave('qi_refining', {
      tribulation: { committedOutcome: witnessedVictory(), cooldownUntil: 0 },
    })
    expect(shapeOf(save).ok).toBe(true)
  })

  it('settle seam: a committedOutcome whose witness cannot replay parks inert', () => {
    // Defense in depth: even past admission, settleOutcome re-derives
    // the witness before any realm write.
    const director = new TribulationDirector({ eventBus: new EventBus() })
    const record = witnessedVictory()
    director.restoreRuntime({
      committedOutcome: {
        ...record,
        witness: { ...record.witness, attemptSeed: 0 }, // refold breaks digest
      },
    })
    const player = committedPlayer('qi_refining')
    const writer = player as TribulationPlayerWriter
    writer.setEquipmentModifiers = (modifiers) => {
      player.modifiers = modifiers
    }
    expect(
      new TribulationOutcomeService().settleOutcome(
        writer,
        new GameManager(),
        director,
      ),
    ).toBeNull()
    expect(player.realmId).toBe('qi_refining')
    expect(director.getCommittedOutcome()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// F-ALCH-JOB-FORGE: reservation witness on persisted jobs
// ---------------------------------------------------------------------------
describe('F-ALCH-JOB-FORGE: a job without a reservation witness is rejected', () => {
  const authoredJob = () => {
    // F-A12-4: the span replays the authored recipe duration and the
    // window closed before the save - a finished job ready to settle.
    const startedAtMs = Date.now() - alchemySecondsFor(LIVE_RECIPE, 1) * 1000 - 10_000
    return {
      jobId: 'j1',
      recipeId: LIVE_RECIPE.id,
      pillId: LIVE_RECIPE.pillId,
      herbMaterialId: LIVE_RECIPE.herbVariants[0]!.materialId,
      startedAtMs,
      completesAtMs: startedAtMs + alchemySecondsFor(LIVE_RECIPE, 1) * 1000,
      roomLevelAtStart: 1,
    }
  }

  it('a job with no reservation at all is rejected', () => {
    const { save } = committedSave('qi_refining', {
      buildings: [pillRoom],
      // Cast: the forged record deliberately omits the writer field -
      // that is exactly what the boundary arm rejects.
      alchemyJobs: [authoredJob()] as never,
    })
    expect(shapeOf(save).ok).toBe(false)
  })

  it('a reservation whose digest does not replay is rejected', () => {
    const job = witnessedAlchemyJob(authoredJob(), undefined, LIVE_RECIPE)
    job.reservation = { ...job.reservation, digest: (job.reservation.digest + 1) >>> 0 }
    const { save } = committedSave('qi_refining', {
      buildings: [pillRoom],
      alchemyJobs: [job],
    })
    expect(shapeOf(save).ok).toBe(false)
  })

  it('a reservation claiming an unproducible costScale is rejected', () => {
    // costScale rides the digest AND the producible-scale set derived
    // from the authored talent catalog - no authored talent mints 9x.
    const job = witnessedAlchemyJob(authoredJob(), { costScale: 9 }, LIVE_RECIPE)
    const { save } = committedSave('qi_refining', {
      buildings: [pillRoom],
      alchemyJobs: [job],
    })
    expect(shapeOf(save).ok).toBe(false)
  })

  it('a reservation claiming inputs the recipe never consumed is rejected', () => {
    // Digest replays over the forged claim, but the wood re-derivation
    // from the authored recipe fails - the reservation must name the
    // canonical fuel wood id.
    const job = witnessedAlchemyJob(
      authoredJob(),
      { woodId: 'forged_wood_of_doom', fuelWoodAmount: 0, spiritStoneCost: 0 },
      LIVE_RECIPE,
    )
    const { save } = committedSave('qi_refining', {
      buildings: [pillRoom],
      alchemyJobs: [job],
    })
    expect(shapeOf(save).ok).toBe(false)
  })

  it('control: a replay-valid witnessed job still validates', () => {
    const { save } = committedSave('qi_refining', {
      buildings: [pillRoom],
      alchemyJobs: [witnessedAlchemyJob(authoredJob(), undefined, LIVE_RECIPE)],
    })
    expect(shapeOf(save).ok).toBe(true)
  })

  it('settle seam: a fabricated finished job settles as a failure - no pill mints', () => {
    // Defense in depth: restored jobs hit the witness check inside
    // tick, before the percent roll - a record that never reserved
    // inputs consumes the job as a failed batch instead of minting.
    const manager = makeManager()
    const pillBag = manager.pillBag
    manager.alchemySystem.restoreJobs([
      authoredJob() as never, // no reservation - unwitnessable
    ])
    manager.alchemySystem.tick(
      Date.now(),
      pillBag,
      (pillId) => pills.find((pill) => pill.id === pillId),
      () => 0,
    )
    expect(manager.alchemySystem.getJobs()).toHaveLength(0)
    const events = manager.alchemySystem.drainSettlementEvents()
    expect(events).toHaveLength(1)
    expect(events[0]!.success).toBe(false)
    expect(events[0]!.pills).toBe(0)
    expect(pillBag.getAmount(LIVE_RECIPE.pillId)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// F-ENHANCE-STREAK: enhanceFailStreak bounded by the pity reset
// ---------------------------------------------------------------------------
describe('F-ENHANCE-STREAK: enhanceFailStreak above the pity threshold is rejected', () => {
  it('a streak above ENHANCE_PITY_THRESHOLD is unproducible', () => {
    // The writer resets at the threshold: pity fires on the attempt
    // AT the cap, so a persisted streak of threshold+1 has no writer.
    const { save } = committedSave('qi_refining', {
      equipmentSlots: [
        { slot: 'weapon', enhanceLevel: 0, enhanceFailStreak: ENHANCE_PITY_THRESHOLD + 1 },
      ],
    })
    expect(shapeOf(save).ok).toBe(false)
  })

  it('control: a streak AT the pity threshold validates', () => {
    // The writer persists the count exactly when the roll consumed it -
    // pity guarantees the NEXT attempt, so streak == threshold is the
    // last producible persisted value.
    const { save } = committedSave('qi_refining', {
      equipmentSlots: [
        { slot: 'weapon', enhanceLevel: 0, enhanceFailStreak: ENHANCE_PITY_THRESHOLD },
      ],
    })
    expect(shapeOf(save).ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// F-PHAGIAP-CARRY: phaGiapCarryStacks bounded by the producible bank max
// ---------------------------------------------------------------------------
describe('F-PHAGIAP-CARRY: phaGiapCarryStacks above the producible bank is rejected', () => {
  it('a carry claim above floor(maxStacks * carryFraction) is unproducible', () => {
    // The sole writer banks floor(stacks * 0.5) at battle seed - the
    // authored pha_giap cap is 5 stacks, so the bank can never exceed 2.
    const { save } = committedSave('qi_refining')
    save.player.phaGiapCarryStacks = 3
    expect(shapeOf(save).ok).toBe(false)
  })

  it('control: a claim at the bank max validates', () => {
    const { save } = committedSave('qi_refining')
    save.player.phaGiapCarryStacks = 2
    expect(shapeOf(save).ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Exception ledger: same-value residual class (documented acceptance)
// ---------------------------------------------------------------------------
describe('accepted residuals (Minh ruling: same-value class, deferred to online authority)', () => {
  it('F-ENH-SLOT-FORGE: a within-cap enhanceLevel counter claim stays accepted', () => {
    // No ledger witnesses paid rolls; a counter inside authored bounds
    // is indistinguishable from earned progress on the current schema.
    const { save } = committedSave('qi_refining', {
      equipmentSlots: [
        { slot: 'weapon', enhanceLevel: 3, enhanceFailStreak: 0 },
      ],
    })
    expect(shapeOf(save).ok).toBe(true)
  })

  it('F-COMPANION-EXP: a within-bounds companion exp claim stays accepted', () => {
    // Same class: the exp counter is inside authored bounds; nothing in
    // the save schema can separate it from earned kills.
    const { save } = committedSave('qi_refining')
    save.player.companions = [
      {
        instanceId: 'c1',
        definitionId: 'ho_ly_tinh',
        realmId: 'mortal',
        realmLevel: 10,
        exp: 9_999,
        constellationRank: 0,
      },
    ]
    expect(shapeOf(save).ok).toBe(true)
  })
})
