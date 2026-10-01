// QA pin - writer-bound wave (blind TC8/B10 sweep on ae4af514).
//
// F-TC8-1  persisted breakthroughGrade had no authored ceiling - the
//          writer clamps [1,6] (computeBreakthroughGrade); >6 rejects.
// F-TC8-2  grantedRealmPassiveIds markers carried no realm-order
//          coherence - a marker above the player's own realm is an
//          impossible grant (rejected at the boundary AND inert at the
//          emit seam); highestFoundationAchieved is the same class.
// F-TC8-3  the loi_kiep victory grant bounds at 0.1 per realm
//          transition - the bound scales with the player's own realm
//          index, not the all-realm constant.
// F-TC8-4  skill restore trusted persisted combat scalars - restore
//          now re-derives every authored field from the template.
// F-TC8-6  PassiveSystem stacked persisted dormant-kit passives -
//          the runtime channel now consults betaSkillAdmitted.
// F-TC8-7  perfectClearSeconds under 1s minted thousands of auto-farm
//          cycles per tick - the 1s authored floor holds at both the
//          boundary and the cycle guard.
// F-TC8-8  tu_linh_tran timed effects minted any duration - the span
//          bound expiresAtMs - appliedAtMs <= 24h now applies.
// F-TC8-11 persisted equipment affixes had no count/slot bounds -
//          GLOBAL_MAX_AFFIXES and the roller slot eligibility now apply.
// F-B10-1  unsupportedReleaseReason missed the decompose slice and
//          dormant talent carries - both flag explicitly now.
import { describe, expect, it } from 'vitest'

import { createDefaultPlayer, resolvePlayerStatAssembly } from '../../src/core/player/Player'
import { GameManager } from '../../src/core/game/GameManager'
import { PassiveSystem } from '../../src/core/skill/PassiveSystem'
import { SkillManager } from '../../src/core/skill/SkillManager'
import { SkillSystem } from '../../src/core/skill/SkillSystem'
import { EventBus } from '../../src/core/events/EventBus'
import { defineEnemy } from '../../src/core/enemy/Enemy'
import { createDefaultBodyProgression } from '../../src/core/realm/body/BodyChapter'
import { createDefaultHiddenPerfection } from '../../src/core/realm/hidden/HiddenPerfection'
import { unsupportedReleaseReason } from '../../src/core/betaScopeSurface'
import { isBetaTalentId } from '../../src/core/betaScope'
import { lockBetaFeaturesForTests } from '../../src/core/game/__fixtures__/betaFeaturesUnlock'
import { lockBetaWaysForTests } from '../../src/core/game/__fixtures__/betaWaysUnlock'
import { lockBetaTalentsForTests } from '../../src/core/game/__fixtures__/betaTalentsUnlock'
import { SKILLS } from '../../src/data/skill/Skills'
import { PASSIVE_SKILLS } from '../../src/data/skill/PassiveSkills'
import { CURRENT_SAVE_VERSION } from '../../src/services/save/saveVersion'
import { validateGameSaveShape } from '../../src/services/save/saveShapeValidation'
import { TU_LINH_TRAN_DURATION_MS, TU_LINH_TRAN_EFFECT_GROUP } from '../../src/core/economy/TuLinhTranBalance'
import type { GameSave } from '../../src/services/save/SaveSystem'
import type { Skill } from '../../src/core/skill/Skill'

lockBetaFeaturesForTests()
lockBetaWaysForTests()
lockBetaTalentsForTests()

function player() {
  const p = createDefaultPlayer()
  p.mortalBasicSkillId = 'linh_bao'
  return p
}

function validSave() {
  const p = player()
  p.nodeLevels = { ...p.nodeLevels, core_linh_bao: 1 }
  p.purchasedNodeIds = [...p.purchasedNodeIds, 'core_linh_bao']

  return {
    version: CURRENT_SAVE_VERSION,
    player: p,
    techniques: [],
    skills: [{ id: 'linh_bao', name: 'Linh Bao', description: 'pick', type: 'active', level: 1, maxLevel: 10, cooldown: 1, target: 'enemy', effects: [] }],
    materials: [],
    equipment: [],
    equipmentSlots: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    productionSites: [],
    alchemyJobs: [],
  } as Record<string, unknown>
}

describe('F-TC8-1: breakthroughGrade authored ceiling', () => {
  it('a persisted grade above the authored 6 is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.breakthroughGrade = 12

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('the legit authored ceiling grade 6 still validates', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.breakthroughGrade = 6

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('F-TC8-2: realm-passive marker realm-order coherence', () => {
  it('a marker for a realm above the player realm is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    // mortal (index 0) holding the foundation_establishment marker is
    // an impossible grant - the writer only stamps on advance INTO it.
    p.grantedRealmPassiveIds = ['foundation_establishment']
    p.modifiers.push({
      id: 'realm-passive:kien_co:strength',
      sourceId: 'kien_co',
      sourceType: 'realm',
      stat: 'strength',
      percent: 0.05,
    })

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('emit stays inert on a marker indexed above the player realm', () => {
    const p = player()
    p.grantedRealmPassiveIds = ['qi_refining']
    p.modifiers.push({
      id: 'realm-passive:nhap_dao:maxHp',
      sourceId: 'nhap_dao',
      sourceType: 'realm',
      stat: 'maxHp',
      percent: 0.03,
    })

    const base = resolvePlayerStatAssembly(player(), []).stats.maxHp
    expect(resolvePlayerStatAssembly(p, []).stats.maxHp).toBe(base)
  })

  it('a marker matching the player realm still emits (legit grant)', () => {
    const p = player()
    p.realmId = 'qi_refining'
    p.realmLevel = 1
    p.grantedRealmPassiveIds = ['qi_refining']
    p.modifiers.push({
      id: 'realm-passive:nhap_dao:maxHp',
      sourceId: 'nhap_dao',
      sourceType: 'realm',
      stat: 'maxHp',
      percent: 0.03,
    })

    const base = resolvePlayerStatAssembly(player(), []).stats.maxHp
    expect(resolvePlayerStatAssembly(p, []).stats.maxHp).not.toBe(base)
  })

  it('highestFoundationAchieved on a pre-foundation realm is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.highestFoundationAchieved = 'heaven'

    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

describe('F-TC8-3: loi kiep victory bound scales with player realm', () => {
  it('percent above 0.1 x realm index is rejected even under the old global bound', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.realmId = 'foundation_establishment'
    p.realmLevel = 1
    p.selectedTalentIds = ['loi_kiep']
    p.modifiers.push({
      id: 'talent_loi_kiep_strength',
      sourceId: 'loi_kiep',
      sourceType: 'talent',
      stat: 'strength',
      percent: 0.5,
    })

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('two victories at foundation_establishment (0.2) still validate', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.realmId = 'foundation_establishment'
    p.realmLevel = 1
    p.selectedTalentIds = ['loi_kiep']
    p.modifiers.push({
      id: 'talent_loi_kiep_strength',
      sourceId: 'loi_kiep',
      sourceType: 'talent',
      stat: 'strength',
      percent: 0.2,
    })

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('F-TC8-4: skill restore re-derives all authored combat fields', () => {
  function buildSave(skills: Skill[]): GameSave {
    return {
      player: {
        bodyProgression: createDefaultBodyProgression(),
        physiqueGrade: 'pham',
        realmId: 'mortal',
        mortalBasicSkillId: 'linh_bao',
        nodeLevels: { core_linh_bao: 1, core_tram: 1 },
        purchasedNodeIds: ['core_linh_bao', 'core_tram'],
        hiddenPerfection: createDefaultHiddenPerfection(),
      },
      techniques: [],
      skills,
      materials: [],
      pills: [],
      talismans: [],
      formations: [],
      equipment: [],
      buildings: [],
      equipmentSlots: [],
    } as unknown as GameSave
  }

  it('forged cooldown/cost/target/execution fields are re-derived from the template', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const template = SKILLS.find((skill) => skill.id === 'tram')!
    const forged = JSON.parse(JSON.stringify(template)) as Skill
    forged.cooldown = 0
    forged.cost = 0
    forged.target = 'self'
    forged.execution = { kind: 'cooldown' }
    forged.requiredRealmId = undefined

    const linhBao = JSON.parse(
      JSON.stringify(SKILLS.find((skill) => skill.id === 'linh_bao')),
    ) as Skill

    gameManager.saveOps.restoreFromSave(buildSave([forged, linhBao]))

    const restored = gameManager.skillManager.get('tram')!
    expect(restored.cooldown).toBe(template.cooldown)
    expect(restored.cost).toBe(template.cost)
    expect(restored.target).toBe(template.target)
    expect(restored.execution).toEqual(template.execution)
    expect(restored.requiredRealmId).toBe(template.requiredRealmId)
  })

  it('instance-progress fields survive the template rebuild', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)

    const tram = JSON.parse(JSON.stringify(SKILLS.find((skill) => skill.id === 'tram'))) as Skill
    tram.totalExperience = 42

    const linhBao = JSON.parse(
      JSON.stringify(SKILLS.find((skill) => skill.id === 'linh_bao')),
    ) as Skill

    gameManager.saveOps.restoreFromSave(buildSave([tram, linhBao]))

    expect(gameManager.skillManager.get('tram')!.totalExperience).toBe(42)
  })
})

describe('F-TC8-6: PassiveSystem respects beta skill admission', () => {
  function makeHarness(skillIds: string[]) {
    const skillManager = new SkillManager()
    for (const id of skillIds) {
      const source = PASSIVE_SKILLS.find((s) => s.id === id) ?? SKILLS.find((s) => s.id === id)
      if (!source) throw new Error(`skill ${id} missing`)
      skillManager.add({
        ...source,
        passiveModifiers: source.passiveModifiers?.map((m) => ({ ...m })),
      } as Skill)
    }
    const skillSystem = new SkillSystem(skillManager)
    const bus = new EventBus()
    return { system: new PassiveSystem(bus, skillManager, skillSystem), skillManager, bus }
  }

  it('a dormant-way passive never stacks on events or per-second ticks', () => {
    // passive_kim_cang_y_chi is authored on the dormant The Tu way -
    // betaSkillAdmitted(id) === false under the lock.
    const { system, skillManager, bus } = makeHarness(['passive_kim_cang_y_chi'])

    bus.emit('damage', { type: 'damage', targetId: 'player' })

    const modifier = skillManager.get('passive_kim_cang_y_chi')!.passiveModifiers![0]!
    expect(modifier.stacks).toBe(0)

    system.tick(5)
    expect(modifier.stacks).toBe(0)
  })

  it('an admitted passive still stacks (positive control)', () => {
    // A fabricated id not owned by any dormant way stays admitted -
    // the gate only excludes dormant-way-owned content.
    const skillManager = new SkillManager()
    skillManager.add({
      id: 'fake_passive_control',
      name: 'control',
      description: 'control',
      type: 'passive',
      level: 1,
      maxLevel: 1,
      cooldown: 0,
      target: 'self',
      effects: [],
      passiveTrigger: 'damage_taken',
      passiveModifiers: [
        { id: 'm', sourceId: 'fake_passive_control', sourceType: 'skill', stat: 'defense', percent: 0.01, stacks: 0, maxStacks: 5 },
      ],
    } as Skill)
    const skillSystem = new SkillSystem(skillManager)
    const bus = new EventBus()
    new PassiveSystem(bus, skillManager, skillSystem)

    bus.emit('damage', { type: 'damage', targetId: 'player' })

    const modifier = skillManager.get('fake_passive_control')!.passiveModifiers![0]!
    expect(modifier.stacks).toBe(1)
  })
})

describe('F-TC8-7: perfectClearSeconds authored floor', () => {
  const DUMMY = defineEnemy({
    id: 'tc8_dummy', name: 'TC8 Dummy', level: 1, realmId: 'mortal', lane: 'ground',
    statsInput: { maxHp: 10, might: 0, attackSpeed: 1, criticalRate: 0, criticalDamage: 1.5, armor: 0 },
    rewards: { techniqueMastery: 0, spiritStone: 5 },
  })
  const STAGE = {
    id: 'tc8_stage', name: 'TC8 Stage', description: '', floor: 1,
    enemyPool: [{ enemyId: 'tc8_dummy', weight: 1 }], totalEnemyCount: 2, waves: [2], spawnIntervalSeconds: 0,
  }

  it('a sub-second clear is rejected at the boundary', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.perfectClearSeconds = { tc8_stage: 0.5 }

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a 0.001s claim mints zero offline cycles (was: 1.8M rolls/hour)', () => {
    const gameManager = new GameManager()
    const p = player()
    gameManager.catalogOps.registerEnemyTemplates([DUMMY])
    gameManager.catalogOps.registerStages([STAGE])
    p.perfectClearStageIds.push('tc8_stage')
    p.perfectClearSeconds['tc8_stage'] = 0.001
    const lastCheckedMs = Date.now() - 3_600_000
    p.autoFarmStage = { stageId: 'tc8_stage', lastCheckedMs }

    gameManager.turnBattleOps.autoFarmOps.settleAutoFarmOffline(p, 3600)

    // No cycle ran: the lease timestamp never advanced.
    expect(p.autoFarmStage!.lastCheckedMs).toBe(lastCheckedMs)
  })
})

describe('F-TC8-8: tu_linh_tran duration bound', () => {
  it('a span wider than the authored 24h writer window is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.persistentTimedEffects = [
      {
        id: 'fx1',
        sourceItemId: 'tu_linh_tran',
        appliedAtMs: 1000,
        expiresAtMs: 1000 + TU_LINH_TRAN_DURATION_MS + 60_000,
        effectGroup: TU_LINH_TRAN_EFFECT_GROUP,
        cultivationSpeedPercent: 0.2,
        modifiers: [],
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('an exact 24h writer span still validates', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.persistentTimedEffects = [
      {
        id: 'fx1',
        sourceItemId: 'tu_linh_tran',
        appliedAtMs: 1000,
        expiresAtMs: 1000 + TU_LINH_TRAN_DURATION_MS,
        effectGroup: TU_LINH_TRAN_EFFECT_GROUP,
        cultivationSpeedPercent: 0.2,
        modifiers: [],
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('F-TC8-11: equipment affix authored bounds', () => {
  it('more than GLOBAL_MAX_AFFIXES entries is rejected', () => {
    const save = validSave()
    save.equipment = [
      {
        instanceId: 'w1',
        itemId: 'base_kiem',
        slot: 'weapon',
        equipped: true,
        grade: 'ngu_pham',
        quality: 'hoang',
        mainStat: { id: 'm1', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 15 },
        affixes: Array.from({ length: 9 }, (_, i) => ({ affixId: 'prefix_max_hp', tier: 1, value: 10 })),
        forgeUsesTotal: 0,
        forgeUsesRemaining: 0,
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a slotted affix persisted on an excluded slot is rejected', () => {
    const save = validSave()
    // prefix_ward is authored helmet/necklace only - a weapon claim
    // could never have rolled.
    save.equipment = [
      {
        instanceId: 'w1',
        itemId: 'base_kiem',
        slot: 'weapon',
        equipped: true,
        grade: 'ngu_pham',
        quality: 'hoang',
        mainStat: { id: 'm1', sourceId: 'roll-main', sourceType: 'equipment', stat: 'might', flat: 15 },
        affixes: [{ affixId: 'prefix_ward', tier: 1, value: 10 }],
        forgeUsesTotal: 0,
        forgeUsesRemaining: 0,
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

describe('F-B10-1: unsupportedReleaseReason covers dormant records', () => {
  it('a running decompose station flags dormant_decompose_state', () => {
    const p = player()
    expect(
      unsupportedReleaseReason(p, {
        decompose: { started: true, settings: { workers: 0 } },
      }),
    ).toBe('dormant_decompose_state')
  })

  it('decompose with staffed workers flags even when not started', () => {
    const p = player()
    expect(
      unsupportedReleaseReason(p, {
        decompose: { started: false, settings: { workers: 2 } },
      }),
    ).toBe('dormant_decompose_state')
  })

  it('a dormant talent in selectedTalentIds flags dormant_talent_state', () => {
    const p = player()
    p.realmId = 'qi_refining'
    p.realmLevel = 1
    // kd_thanh_dan lives in the golden_core pool - authored but dormant.
    expect(isBetaTalentId('kd_thanh_dan')).toBe(false)
    p.selectedTalentIds = ['kd_thanh_dan']

    expect(unsupportedReleaseReason(p)).toBe('dormant_talent_state')
  })

  it('a beta-admitted talent alone does not flag', () => {
    const p = player()
    p.realmId = 'qi_refining'
    p.realmLevel = 1
    expect(isBetaTalentId('lk_linh_mach')).toBe(true)
    p.selectedTalentIds = ['lk_linh_mach']

    expect(unsupportedReleaseReason(p)).toBeNull()
  })
})

describe('F-A10-1: breakthrough-pool talents need the pool realm', () => {
  it('a mortal holding an lk_* pool talent is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.selectedTalentIds = ['lk_linh_mach']

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a qi_refining save holding a tc_* pool talent is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.realmId = 'qi_refining'
    p.realmLevel = 1
    p.selectedTalentIds = ['tc_truc_hon']

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a qi_refining save holding an lk_* pool talent still validates', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.realmId = 'qi_refining'
    p.realmLevel = 1
    p.selectedTalentIds = ['lk_linh_mach']

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('a non-pool talent at mortal still validates', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    // loi_kiep is a reward/creation talent, not a breakthrough-pool
    // entry - the pool bound does not apply to it.
    p.selectedTalentIds = ['loi_kiep']

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('F-A10-2: skill membership respects template requiredRealmId', () => {
  it('a mortal claiming a golden_core realm-ladder passive is rejected', () => {
    const save = validSave()
    const forged = SKILLS.find((skill) => skill.id === 'passive_kim_dan_chi_quang')
    expect(forged?.requiredRealmId).toBe('golden_core')
    save.skills = [structuredClone(SKILLS.find((skill) => skill.id === 'linh_bao')!), structuredClone(forged!)]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a qi_refining save claiming a foundation realm-ladder passive is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.realmId = 'qi_refining'
    p.realmLevel = 1
    save.skills = [
      structuredClone(SKILLS.find((skill) => skill.id === 'linh_bao')!),
      structuredClone(SKILLS.find((skill) => skill.id === 'passive_truc_co_y_chi')!),
    ]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a qi_refining save claiming the qi_refining realm passive still validates', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.realmId = 'qi_refining'
    p.realmLevel = 1
    save.skills = [
      structuredClone(SKILLS.find((skill) => skill.id === 'linh_bao')!),
      structuredClone(SKILLS.find((skill) => skill.id === 'passive_linh_khi_cam_ung')!),
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('F-A10-6: stage-clear and autofarm claims respect the stage realm', () => {
  it('a mortal claiming a qi_refining clear is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.completedStageIds = ['qi_refining_forest']

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a mortal claiming a foundation perfect clear is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.perfectClearStageIds = ['foundation_floor_1']
    p.perfectClearSeconds = { foundation_floor_1: 60 }

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a mortal autofarm record on a foundation stage is rejected', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.autoFarmStage = { stageId: 'foundation_floor_1', lastCheckedMs: 1 }

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('a mortal clear on a mortal stage still validates', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.completedStageIds = ['mortal_dong_1']

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('a foundation save claiming a foundation floor still validates', () => {
    const save = validSave()
    const p = save.player as ReturnType<typeof createDefaultPlayer>
    p.realmId = 'foundation_establishment'
    p.realmLevel = 1
    p.completedStageIds = ['foundation_floor_1']

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})
