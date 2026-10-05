// QA FIXPOINT probe (blind authority bind, clean round 7) - the seams
// that remained AFTER every covered class was excluded: persisted
// modifier channels carrying forged extra StatModifier fields, the
// consume-side re-derivation points that decide whether those extras
// matter, and the residual bounds that survived the sweep. Probes
// assert the CURRENT boundary - a passing suite is the CLEAN verdict's
// evidence.
//
// R7-AUTH-REBUILD (gate lenient, port strict): player.modifiers
// entries are trusted only for CLAIM (id/sourceId/sourceType/stat/
// percent/flat/domain). A forged stacks/multiplier/tag/perLevel*
// rides past the F-MOD-1/F-TC6-9 field comparison - but
// resolvePlayerStatAssembly re-derives the whole realm-sourced channel
// from the authored builders (realm passives + meridian catalog) and
// pushes the AUTHORED record, never the persisted one. The forge is
// scrubbed at the authority port: stats resolve to the authored
// value, identical to an unmodified save.
//
// R7-LANES-BETA-BOUND: the workerCycles lane ceiling reads
// betaEffectiveWorkerCapacity(player.autoWorkerCapacity) - under the
// beta scope lock the effective pool is BETA_BASELINE_WORKER_CAPACITY
// (3) no matter what the persisted scalar claims, so a forged
// capacity cannot inflate the lane bound.
//
// R7-BANK-MAX: phaGiapCarryStacks is writer-bounded by floor(passive
// maxStacks * carryFraction) replayed over the authored carry effects
// (pha giap caps at 5 stacks * 0.5 = 2) - an over-claim rejects.
//
// R7-ENTITLEMENT-REALM: a pending talent entitlement names the realm
// the decision is in-flight for; the only writer binds it to the
// just-entered realm, so any other realmId - or an offer the pool
// could not have drawn - is an impossible record.
//
// R7-ARTIFACT-CLAMP: artifact realmLevel/experience over-claims pass
// shape (non-negative only) but normalizeArtifactProgress clamps both
// against the holder's realm at restore - the scope verdict is
// re-checked at the consume point.
//
// R7-BAG-SLOT-UNIQUE: a save carrying two equipped-flagged items in
// one slot cannot double-emit - EquipmentBag.indexEquipped keeps
// exactly one live entry per slot, so refreshModifiers sees one.
//
// R7-FORMATION-SCOPE: commitFormationLoadout fails closed while the
// formation domain is scope-hidden (and below FORMATION_UNLOCK_REALM_ID
// when live) - the write seam cannot mint a loadout the consume seam
// would honor.
//
// R7-ACCEPT-ROOT: assertSaveAcceptable replays the atomic element
// commit - an element-root node claim whose owning element does not
// match the committed axis (or is absent) is unproducible.
import { describe, expect, it } from 'vitest'
import { lockBetaFeaturesForTests } from '../../core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../core/game/__fixtures__/betaTalentsUnlock'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

import { validateGameSaveShape } from './saveShapeValidation'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from './saveAcceptance'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import {
  createDefaultPlayer,
  resolvePlayerStatAssembly,
  type PlayerData,
} from '../../core/player/Player'
import { REALM_PASSIVES } from '../../data/realm/RealmPassives'
import { MERIDIANS } from '../../data/realm/Meridians'
import {
  getArtifactExpRequired,
  normalizeArtifactProgress,
} from '../../core/artifact/ArtifactProgression'
import { EquipmentBag } from '../../core/equipment/EquipmentBag'
import type { EquipmentInstance } from '../../core/equipment/EquipmentInstance'
import { commitFormationLoadout } from '../../core/game/FormationPlacement'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { PHAP_TU_SKILLS } from '../../data/skill/PhapTuSkills'
import { SPELL_KIT_IDS } from '../../data/skill/Skills'

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

// Committed-path player satisfying the realm-coherence witnesses the
// shape replays (same fixture class as the earlier clean rounds).
function committedPlayer(realmId: string, realmLevel = 1): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = realmId
  player.realmLevel = realmLevel
  player.cultivationPath = 'spell'
  player.cultivationWay = 'spell_pathway'
  // F-SCOPE-1 (fixpoint W2-3): the element-axis commit is atomic - a
  // committed pair always carries the beta-scope element, its minted
  // element root, and the learned basic's writer node.
  player.spellPath = { element: 'fire' }
  player.mortalBasicSkillId = undefined
  player.breakthroughGrade = 1
  if (realmId !== 'qi_refining') {
    player.highestFoundationAchieved = 'human'
  }
  player.nodeLevels = { hoa_linh_ngo: 1 }
  player.purchasedNodeIds = ['hoa_linh_ngo']
  return player
}

// Canonical initiation witness: at realm >= qi_refining the techniques
// slice cannot be empty, so committed saves carry the spell-path art.
function spellTechnique(): Record<string, unknown> {
  return {
    id: 'five_elements_art',
    name: 'Five Elements Art',
    description: 'canonical entry',
    grade: 1,
    rank: 0,
    mastery: 0,
    quality: 'huyen',
    gradeHistory: {},
  }
}

const QI_PASSIVE = REALM_PASSIVES.find((entry) => entry.id === 'qi_refining')!

function authoredMaxHpEntry(player: PlayerData): StatModifier {
  return QI_PASSIVE.buildModifiers(player).find(
    (entry) => entry.id === 'realm-passive:nhap_dao:maxHp',
  )!
}

describe('R7-AUTH-REBUILD: forged extra StatModifier fields on realm-sourced channels are scrubbed at the authority port', () => {
  it('stacks/multiplier/tag extras on a realm-passive claim pass the shape gate', () => {
    const save = validSave()
    const player = committedPlayer('qi_refining')
    const authored = authoredMaxHpEntry(player)

    player.grantedRealmPassiveIds = ['qi_refining']
    player.modifiers = [
      {
        ...authored,
        stacks: 99,
        multiplier: 5,
        tag: 'forged-pool',
        maxStacks: 99,
        perLevelFlat: 7,
        perLevelPercent: 0.7,
      },
    ]
    save.player = player
    save.techniques = [spellTechnique()]

    // The gate compares the authored field set only - the extras pass,
    // which is exactly why the consume point must re-derive.
    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('the forged extras never reach the pipeline: assembly re-derives the authored entry', () => {
    const forged = committedPlayer('qi_refining')
    const authored = authoredMaxHpEntry(forged)

    forged.grantedRealmPassiveIds = ['qi_refining']
    forged.modifiers = [
      {
        ...authored,
        stacks: 99,
        multiplier: 5,
        tag: 'forged-pool',
        maxStacks: 99,
        perLevelFlat: 7,
        perLevelPercent: 0.7,
      },
    ]

    const clean = committedPlayer('qi_refining')
    clean.grantedRealmPassiveIds = ['qi_refining']
    clean.modifiers = [{ ...authored }]

    const forgedStats = resolvePlayerStatAssembly(forged, []).stats
    const cleanStats = resolvePlayerStatAssembly(clean, []).stats

    // stat-by-stat identical resolution - the forged stacks/multiplier
    // amplified nothing.
    expect(forgedStats).toEqual(cleanStats)
  })

  it('a realm-passive claim with a FORGED percent is still rejected (F-MOD-1 envelope)', () => {
    const save = validSave()
    const player = committedPlayer('qi_refining')
    const authored = authoredMaxHpEntry(player)

    player.grantedRealmPassiveIds = ['qi_refining']
    player.modifiers = [{ ...authored, percent: authored.percent! * 10 }]
    save.player = player

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
  })

  it('stacks/multiplier extras on a meridian bat-mach claim resolve to the authored percent', () => {
    const meridian = MERIDIANS[0]!
    const stat = meridian.stats[0]!
    const forged = committedPlayer('qi_refining', meridian.requiredRealmLevel)
    forged.bodyProgression.meridian.openedIds = [meridian.id]
    forged.modifiers = [
      {
        id: `bat-mach:${meridian.id}:${stat}`,
        sourceId: meridian.id,
        sourceType: 'realm',
        stat,
        percent: meridian.percentAtFullTier,
        stacks: 50,
        multiplier: 3,
        perLevelPercent: 1,
      },
    ]

    const clean = committedPlayer('qi_refining', meridian.requiredRealmLevel)
    clean.bodyProgression.meridian.openedIds = [meridian.id]
    clean.modifiers = [
      {
        id: `bat-mach:${meridian.id}:${stat}`,
        sourceId: meridian.id,
        sourceType: 'realm',
        stat,
        percent: meridian.percentAtFullTier,
      },
    ]

    expect(resolvePlayerStatAssembly(forged, []).stats).toEqual(
      resolvePlayerStatAssembly(clean, []).stats,
    )
  })

  it('a bat-mach claim for an UNOPENED meridian emits nothing', () => {
    const meridian = MERIDIANS[0]!
    const stat = meridian.stats[0]!
    const forged = committedPlayer('qi_refining', meridian.requiredRealmLevel)
    forged.bodyProgression.meridian.openedIds = []
    forged.modifiers = [
      {
        id: `bat-mach:${meridian.id}:${stat}`,
        sourceId: meridian.id,
        sourceType: 'realm',
        stat,
        percent: meridian.percentAtFullTier,
      },
    ]

    const clean = committedPlayer('qi_refining', meridian.requiredRealmLevel)
    clean.modifiers = []

    expect(resolvePlayerStatAssembly(forged, []).stats).toEqual(
      resolvePlayerStatAssembly(clean, []).stats,
    )
  })

  it('a talent-sourced modifier other than the loi_kiep witness is dropped', () => {
    const forged = committedPlayer('qi_refining')
    forged.selectedTalentIds = ['pha_giap']
    forged.modifiers = [
      {
        id: 'talent_pha_giap:maxHp',
        sourceId: 'pha_giap',
        sourceType: 'talent',
        stat: 'maxHp',
        flat: 9999,
      },
    ]

    const clean = committedPlayer('qi_refining')
    clean.selectedTalentIds = ['pha_giap']
    clean.modifiers = []

    expect(resolvePlayerStatAssembly(forged, []).stats).toEqual(
      resolvePlayerStatAssembly(clean, []).stats,
    )
  })

  it('a loi_kiep modifier without the ownership witness is dropped (F-TC6-1)', () => {
    const forged = committedPlayer('qi_refining')
    forged.selectedTalentIds = []
    forged.modifiers = [
      {
        id: 'talent_loi_kiep_maxHp',
        sourceId: 'loi_kiep',
        sourceType: 'talent',
        stat: 'maxHp',
        percent: 0.5,
      },
    ]

    const clean = committedPlayer('qi_refining')
    clean.selectedTalentIds = []
    clean.modifiers = []

    expect(resolvePlayerStatAssembly(forged, []).stats).toEqual(
      resolvePlayerStatAssembly(clean, []).stats,
    )
  })

  it('a realm-sourced claim naming no authored writer is dropped', () => {
    const forged = committedPlayer('qi_refining')
    forged.modifiers = [
      {
        id: 'realm-forged:x',
        sourceId: 'no_such_source',
        sourceType: 'realm',
        stat: 'maxHp',
        flat: 9999,
      },
    ]

    const clean = committedPlayer('qi_refining')
    clean.modifiers = []

    expect(resolvePlayerStatAssembly(forged, []).stats).toEqual(
      resolvePlayerStatAssembly(clean, []).stats,
    )
  })
})

describe('R7-LANES-BETA-BOUND: forged autoWorkerCapacity cannot inflate the beta lane ceiling', () => {
  it('autoWorkerCapacity=999 with 4 in-flight lanes still rejects (effective pool is 3)', () => {
    const save = validSave()
    const player = committedPlayer('qi_refining')
    player.autoWorkerCapacity = 999
    save.player = player

    const cycle = {
      cycleId: 'c1',
      siteId: 'thanh_van_quang',
      collectionRealmId: 'qi_refining',
      siteLevelAtStart: 1,
      rewardTableVersion: 1,
      rollSeed: 1,
      startedAtMs: 1,
      completesAtMs: 2,
    }

    ;(save as Record<string, unknown>).productionSites = [
      {
        siteId: 'thanh_van_quang',
        level: 1,
        autoRestart: true,
        activeWorkerSlots: 4,
        workerCycles: [
          { ...cycle, cycleId: 'c1' },
          { ...cycle, cycleId: 'c2' },
          { ...cycle, cycleId: 'c3' },
          { ...cycle, cycleId: 'c4' },
        ],
      },
    ]

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('productionSites[0].workerCycles')
  })
})

describe('R7-BANK-MAX: phaGiapCarryStacks replays the authored carry bound', () => {
  it('a carry bank above floor(5 * 0.5) rejects', () => {
    const save = validSave()
    const player = committedPlayer('qi_refining')
    player.phaGiapCarryStacks = 3
    player.phaGiapCarryRealmId = 'qi_refining'
    save.player = player

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.phaGiapCarryStacks')
  })

  it('the authored bank max (2) validates', () => {
    const save = validSave()
    const player = committedPlayer('qi_refining')
    player.phaGiapCarryStacks = 2
    player.phaGiapCarryRealmId = 'qi_refining'
    save.player = player
    save.techniques = [spellTechnique()]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('R7-ENTITLEMENT-REALM: a pending talent entitlement binds the realm it was minted in', () => {
  it('entitlement.realmId other than the current realm rejects', () => {
    const save = validSave()
    const player = committedPlayer('qi_refining')
    player.pendingTalentEntitlement = {
      realmId: 'foundation_establishment',
      offeredTalentIds: [],
    }
    save.player = player

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.pendingTalentEntitlement.realmId')
  })

  it('an offer outside the realm pool rejects', () => {
    const save = validSave()
    const player = committedPlayer('qi_refining')
    player.pendingTalentEntitlement = {
      realmId: 'qi_refining',
      offeredTalentIds: ['no_such_talent_id'],
    }
    save.player = player

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(
      pathsOf(result).some((path) =>
        path.startsWith('player.pendingTalentEntitlement.offeredTalentIds'),
      ),
    ).toBe(true)
  })

  it('a duplicated offer rejects (live draws are deduped)', () => {
    const save = validSave()
    const player = committedPlayer('qi_refining')
    player.pendingTalentEntitlement = {
      realmId: 'qi_refining',
      offeredTalentIds: ['pha_giap', 'pha_giap'],
    }
    save.player = player

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(
      pathsOf(result).some((path) =>
        path.startsWith('player.pendingTalentEntitlement.offeredTalentIds'),
      ),
    ).toBe(true)
  })
})

describe('R7-ARTIFACT-CLAMP: artifact over-claims are re-checked at restore', () => {
  it('realmLevel above the holder level and experience above required clamp to the holder', () => {
    const player = committedPlayer('foundation_establishment', 3)
    player.artifact = {
      artifactId: 'ngu_hanh_chau',
      realmId: 'foundation_establishment',
      realmLevel: 99,
      experience: 1e12,
      grade: 'pham',
    }

    normalizeArtifactProgress(player)

    // realmLevel clamps to the holder's level; experience clamps to the
    // clamped level's requirement - the persisted claim survives only
    // within the authored envelope.
    expect(player.artifact?.realmLevel).toBe(3)
    expect(player.artifact?.experience).toBeLessThanOrEqual(
      getArtifactExpRequired(3),
    )
  })
})

describe('R7-BAG-SLOT-UNIQUE: two equipped claims in one slot cannot double-emit', () => {
  it('EquipmentBag keeps exactly one equipped entry per slot', () => {
    const bag = new EquipmentBag()
    const item = (instanceId: string): EquipmentInstance => ({
      instanceId,
      itemId: 'iron_sword',
      slot: 'weapon',
      equipped: true,
      grade: 'cuu_pham',
      quality: 'hoang',
      mainStat: { id: 'm', sourceId: instanceId, sourceType: 'equipment', stat: 'might', flat: 1 },
      affixes: [],
      forgeUsesTotal: 1,
      forgeUsesRemaining: 1,
    })

    bag.add(item('a'))
    bag.add(item('b'))

    expect(bag.getEquipped().length).toBe(1)
  })
})

describe('R7-FORMATION-SCOPE: the loadout write seam fails closed', () => {
  it('commitFormationLoadout rejects under the beta scope lock at any realm', () => {
    const player = committedPlayer('foundation_establishment')

    const committed = commitFormationLoadout(player, {
      formationId: 'unknown_anyway',
      assignments: [{ row: 0, column: 0, combatantId: 'player' }],
    })

    expect(committed).toBe(false)
    expect(player.formationLoadout).toBeNull()
  })
})

describe('R7-ACCEPT-ROOT: the atomic element commit is replayed at acceptance', () => {
  function acceptanceReadySave(): Record<string, unknown> {
    const save = validSave()
    const player = committedPlayer('qi_refining')
    save.player = player
    save.skills = [
      structuredClone(
        PHAP_TU_SKILLS.find((skill) => skill.id === SPELL_KIT_IDS.fire[0])!,
      ) as never,
    ]
    player.nodeLevels.core_hoa_cau_thuat = 1
    player.purchasedNodeIds.push('core_hoa_cau_thuat')
    save.techniques = [
      {
        id: 'five_elements_art',
        name: 'Five Elements Art',
        description: 'holder',
        grade: 1,
        rank: 0,
        mastery: 0,
        quality: 'huyen',
        gradeHistory: {},
      },
    ]
    return save
  }

  it('a committed spell_pathway save is acceptable', () => {
    const save = acceptanceReadySave()
    expect(isSaveAcceptable(save as never, staticSaveAcceptanceCatalogs())).toBe(true)
  })

  it('an element-root claim without the owning element rejects', () => {
    const save = acceptanceReadySave()
    const player = save.player as PlayerData
    // fire is committed - a water root claim has no owning element.
    player.nodeLevels = { thuy_linh_ngo: 1 }
    player.purchasedNodeIds = ['thuy_linh_ngo']

    expect(isSaveAcceptable(save as never, staticSaveAcceptanceCatalogs())).toBe(false)
  })

  it('an element-root claim under a FOREIGN element rejects', () => {
    const save = acceptanceReadySave()
    const player = save.player as PlayerData
    player.spellPath = { element: 'water' }
    player.nodeLevels = { hoa_linh_ngo: 1 }
    player.purchasedNodeIds = ['hoa_linh_ngo']

    expect(isSaveAcceptable(save as never, staticSaveAcceptanceCatalogs())).toBe(false)
  })

  it('a non-canonical technique gradeHistory keySet rejects', () => {
    const save = acceptanceReadySave()
    ;(save.techniques as Record<string, unknown>[])[0]!.gradeHistory = {
      1: { finalRank: 9, completionState: 'dai_thanh' },
    }

    expect(isSaveAcceptable(save as never, staticSaveAcceptanceCatalogs())).toBe(false)
  })
})
