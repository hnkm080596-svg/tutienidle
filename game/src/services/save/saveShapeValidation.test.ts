import { describe, expect, it } from 'vitest'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { createDefaultPlayer } from '../../core/player/Player'
import { COMPANIONS } from '../../data/companion/Companions'
import { CULTIVATION_PATH_MODULES, type CultivationPathId } from '../../core/player/CultivationPathKit'
import { skillCoreNodeId } from '../../core/progression/SkillCoreLevel'

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

function normalizedSaveOf(
  result: ReturnType<typeof validateGameSaveShape>,
): Record<string, unknown> {
  if (
    !result.ok ||
    !isRecord(result.normalizedSave)
  ) {
    throw new Error('Expected a normalized save object')
  }

  return result.normalizedSave
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

describe('validateGameSaveShape — save hợp lệ', () => {
  it('ok với save đầy đủ field bắt buộc', () => {
    const save = validSave()
    const result = validateGameSaveShape(save)

    expect(result).toEqual({
      ok: true,
      issues: [],
      normalizedSave: save,
      discardedEquipmentCount: 0,
    })
  })

  it('ok khi optional fields vắng mặt', () => {
    const save = validSave()

    delete save.productionSites
    delete save.alchemyJobs
    delete save.quests

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('validateGameSaveShape — root', () => {
  it('từ chối non-object (null/array/string)', () => {
    expect(validateGameSaveShape(null).ok).toBe(false)
    expect(validateGameSaveShape([]).ok).toBe(false)
    expect(validateGameSaveShape('save').ok).toBe(false)
  })

  it('từ chối sai version, path "version"', () => {
    const save = validSave()

    save.version = 7

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('version')
  })
})

describe('validateGameSaveShape — player', () => {
  it('từ chối player thiếu/thủng, path "player"', () => {
    const save = validSave()

    delete save.player

    expect(pathsOf(validateGameSaveShape(save))).toContain('player')
  })

  it.each([
    ['name', 'player.name'],
    ['realmId', 'player.realmId'],
    ['realmLevel', 'player.realmLevel'],
    ['cultivation', 'player.cultivation'],
    ['cultivationPerSecond', 'player.cultivationPerSecond'],
    ['baseStats', 'player.baseStats'],
    ['modifiers', 'player.modifiers'],
    ['selectedTalentIds', 'player.selectedTalentIds'],
    ['nodeLevels', 'player.nodeLevels'],
    ['physiqueGrade', 'player.physiqueGrade'],
    ['lastSavedAt', 'player.lastSavedAt'],
  ])('từ chối khi thiếu %s, path "%s"', (field, expectedPath) => {
    const save = validSave()

    delete (save.player as Record<string, unknown>)[field]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(expectedPath)
  })

  it('từ chối realmLevel NaN / 0 / âm', () => {
    for (const bad of [Number.NaN, 0, -1]) {
      const save = validSave()
      ;(save.player as Record<string, unknown>).realmLevel = bad

      expect(validateGameSaveShape(save).ok).toBe(false)
    }
  })

  it('từ chối realmId string nhưng không tồn tại trong danh sách cảnh giới', () => {
    const save = validSave()

    ;(save.player as Record<string, unknown>).realmId = 'khong_ton_tai'

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.realmId')
  })

  // M-QI-07 (QI-D4) - physiqueGrade is a typed ladder member: shape
  // validation accepts every authored rung and rejects non-members,
  // non-strings, and missing values.
  it('từ chối physiqueGrade không phải thành viên của thang thể phách', () => {
    for (const bad of ['pham_the', 'TIEN', 'dao_the', '', 3, null, {}, ['bao']]) {
      const save = validSave()
      ;(save.player as Record<string, unknown>).physiqueGrade = bad

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.physiqueGrade')
    }
  })

  it('chấp nhận mọi bậc thể phách hợp lệ của thang', () => {
    for (const grade of ['pham', 'bao', 'phap', 'linh', 'huyen', 'chan', 'dao', 'than', 'thanh', 'tien']) {
      const save = validSave()
      ;(save.player as Record<string, unknown>).physiqueGrade = grade

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(true)
    }
  })
})

describe('validateGameSaveShape — cultivationPath / cultivationWay (v66)', () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }

  // A post-ritual player: pair committed atomically and the realm has
  // already advanced (the ritual never leaves a mortal carrying a pair).
  // M-QI-05 - the way's declared coreSkillIds are granted at commit:
  // nodeLevels[core_<id>] = 1 plus purchasedNodeIds membership, exactly
  // what grantSkillCore writes.
  function withPair(pathId: string, wayId: string): Record<string, unknown> {
    const save = validSave()
    const player = playerOf(save)

    player.realmId = 'qi_refining'
    player.cultivationPath = pathId
    player.cultivationWay = wayId
    if (pathId === 'sword') {
      player.swordPath = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 1 }
    }

    const way = Object.values(
      CULTIVATION_PATH_MODULES[pathId as CultivationPathId].ways,
    ).find((candidate) => candidate?.id === wayId)

    for (const skillId of way?.coreSkillIds ?? []) {
      const coreId = skillCoreNodeId(skillId)
      ;(player.nodeLevels as Record<string, number>)[coreId] = 1
      ;(player.purchasedNodeIds as string[]).push(coreId)
    }

    return save
  }

  it('chấp nhận save khi cả hai field vắng mặt (nhân vật chưa chọn path)', () => {
    const save = validSave()

    delete playerOf(save).cultivationPath
    delete playerOf(save).cultivationWay

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([
    ['sword', 'sword_pathway'],
    ['sword', 'hidden_sword_pathway'],
    ['spell', 'spell_pathway'],
    ['spell', 'hidden_spell_pathway'],
    ['body', 'body_pathway'],
    ['body', 'hidden_body_pathway'],
  ])(
    'chấp nhận cặp (path %s, way %s) post-ritual',
    (pathId, wayId) => {
      expect(validateGameSaveShape(withPair(pathId, wayId)).ok).toBe(true)
    },
  )

  it.each(['phap_tu_an', 'the_tu_an'])(
    'từ chối cultivationPath = %s (legacy _an id đã xoá ở v66)',
    (pathId) => {
      const save = validSave()

      playerOf(save).cultivationPath = pathId

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.cultivationPath')
    },
  )

  it.each(['khong_ton_tai', 'hidden_sword_pathway', '', 7, null, { id: 'spell' }])(
    'từ chối cultivationPath = %j ngoài union (enum check — M0 gap)',
    (value) => {
      const save = validSave()

      playerOf(save).cultivationPath = value

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.cultivationPath')
    },
  )

  it.each(['sword_pathway', 'spell_pathway', 'hidden_spell_pathway', 'hidden_body_pathway', 'hidden_sword_pathway', 'bat_ky_way_naotn'])(
    'từ chối cultivationWay = %s khi cultivationPath vắng mặt (pair nguyên tử)',
    (wayId) => {
      const save = validSave()

      playerOf(save).cultivationWay = wayId

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.cultivationWay')
    },
  )

  it.each(['sword', 'spell', 'body'])(
    'từ chối cultivationPath = %s khi cultivationWay vắng mặt (way-less là corrupt post-M7)',
    (pathId) => {
      const save = validSave()

      playerOf(save).realmId = 'qi_refining'
      playerOf(save).cultivationPath = pathId

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.cultivationWay')
    },
  )

  it.each([
    ['sword', 'hidden_spell_pathway'],
    ['sword', 'hidden_body_pathway'],
    ['spell', 'sword_pathway'],
    ['body', 'spell_pathway'],
    ['spell', 'bat_ky_way_naotn'],
  ])(
    'từ chối way ngoại path: (path %s, way %s) — way phải thuộc module của path',
    (pathId, wayId) => {
      const result = validateGameSaveShape(withPair(pathId, wayId))

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.cultivationWay')
    },
  )

  it('từ chối pair khi realmId vẫn mortal (nghi lễ thăng cảnh trong cùng commit)', () => {
    const save = validSave()

    playerOf(save).cultivationPath = 'spell'
    playerOf(save).cultivationWay = 'spell_pathway'

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.cultivationPath')
  })

  it("từ chối ('sword', <way>) khi player.swordPath vắng mặt (slice nguyên tử)", () => {
    const save = validSave()
    const player = playerOf(save)

    player.realmId = 'qi_refining'
    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.swordPath')
  })

  it.each([[7], [null], [{ id: 'sword_pathway' }], [['sword_pathway']], [true]])(
    'từ chối cultivationWay = %j không phải string',
    (value) => {
      const save = validSave()

      playerOf(save).cultivationWay = value

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.cultivationWay')
    },
  )

  it('cặp hợp lệ post-ritual: cultivationPath base id + cultivationWay', () => {
    const save = validSave()

    playerOf(save).realmId = 'qi_refining'
    playerOf(save).cultivationPath = 'spell'
    playerOf(save).cultivationWay = 'hidden_spell_pathway'

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('validateGameSaveShape — spellPath atomic (element ↔ route)', () => {
  // Review round-2 (LOW): writers commit {element, route} atomically, so a
  // half-set pair is corrupt. The validator must enforce the invariant,
  // not just each field's type.
  it.each([
    [{ element: null, route: 'no' }],
    [{ element: 'fire', route: null }],
  ])('từ chối cặp lệch %j', (spellPath) => {
    const save = validSave()

    ;(save.player as Record<string, unknown>).cultivationPath = 'spell'
    ;(save.player as Record<string, unknown>).spellPath = spellPath

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.spellPath')
  })

  it('chấp nhận {null, null} và cặp hợp lệ trên spell', () => {
    for (const spellPath of [
      { element: null, route: null },
      { element: 'fire', route: 'dot' },
    ]) {
      const save = validSave()

      ;(save.player as Record<string, unknown>).realmId = 'qi_refining'
      ;(save.player as Record<string, unknown>).cultivationPath = 'spell'
      ;(save.player as Record<string, unknown>).cultivationWay = 'spell_pathway'
      ;(save.player as Record<string, unknown>).spellPath = spellPath

      expect(validateGameSaveShape(save).ok).toBe(true)
    }
  })

  it.each([
    ['sword', undefined],
    // M4+M7: element ownership is way-gated - the ngo_dao way and a
    // way-less spell save both reject it.
    ['spell', 'hidden_spell_pathway'],
    ['spell', undefined],
  ])(
    'từ chối route/element state trên %s/%s — chỉ spell_pathway sở hữu nó',
    (path, way) => {
      const save = validSave()

      ;(save.player as Record<string, unknown>).cultivationPath = path
      ;(save.player as Record<string, unknown>).cultivationWay = way
      ;(save.player as Record<string, unknown>).spellPath = { element: 'fire', route: 'dot' }

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.spellPath')
    },
  )
})

describe('validateGameSaveShape — module-owned persisted slices (P1-M6)', () => {
  // The boundary iterates CULTIVATION_PATH_MODULES' validatePersistedState
  // hooks generically - each module owns the rules for its own fields.
  // These regressions pin the moved rules: spellPath is required on EVERY
  // save (mortal and other-path included), swordPath is required once the
  // committed pair is sword, and a corrupt swordPath is rejected wherever
  // it appears.
  it.each([['mortal'], ['sword'], ['body']])(
    'từ chối save thiếu player.spellPath (path/commit %s)',
    (pathId) => {
      const save = validSave()
      const player = save.player as Record<string, unknown>

      delete player.spellPath
      if (pathId !== 'mortal') {
        player.realmId = 'qi_refining'
        player.cultivationPath = pathId
        player.cultivationWay = pathId === 'sword' ? 'sword_pathway' : 'body_pathway'
        if (pathId === 'sword') {
          player.swordPath = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 1 }
        }
      }

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.spellPath')
    },
  )

  it.each([
    ['spell', 'spell_pathway'],
    ['body', 'hidden_body_pathway'],
    ['mortal', undefined],
  ])(
    'từ chối swordPath hỏng trên save ngoài sword (%s/%s) — shape-check chạy mọi save',
    (pathId, wayId) => {
      const save = validSave()
      const player = save.player as Record<string, unknown>

      if (pathId !== 'mortal') {
        player.realmId = 'qi_refining'
        player.cultivationPath = pathId
        player.cultivationWay = wayId
      }
      player.swordPath = { preset: 'not-an-array', kiemY: Number.NaN, kiemDaoCount: 0 }

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result).some((path) => path.startsWith('player.swordPath'))).toBe(true)
    },
  )

  // F-NK-CLO-1 - kiemDaoBase is a float multiplier: post-breakthrough
  // merges produce fractional bases (1 + 0.3*merged). The validator must
  // accept them; integer bound applies to kiemDaoCount only.
  it('chấp nhận kiemDaoBase phân số sau breakthrough-merge', () => {
    const save = validSave()
    const player = save.player as Record<string, unknown>
    player.realmId = 'golden_core'
    player.cultivationPath = 'sword'
    player.cultivationWay = 'hidden_sword_pathway'
    player.swordPath = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 2.2 }

    const result = validateGameSaveShape(save)

    expect(pathsOf(result).some((path) => path === 'player.swordPath.kiemDaoBase')).toBe(false)
  })

  // F-NK-AUT-8 - kiemDaoBase is the breakthrough-merge PRODUCT, not the
  // live queue count: after enough merges it legitimately grows past
  // kiemDaoCap (base *= 1+0.3*merged). The cap bound applies to
  // kiemDaoCount only - a save with base > cap is still valid.
  it('chấp nhận kiemDaoBase vượt trần count-cap sau nhiều merge', () => {
    const save = validSave()
    const player = save.player as Record<string, unknown>
    player.realmId = 'foundation_establishment'
    player.cultivationPath = 'sword'
    player.cultivationWay = 'hidden_sword_pathway'
    // cap(2)=3: qi merge x1.6 -> TC merge x1.9 = 3.04 > 3, all legal.
    player.swordPath = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 3.04 }

    const result = validateGameSaveShape(save)

    expect(pathsOf(result).some((path) => path.startsWith('player.swordPath'))).toBe(false)
  })

  // F-NK-CLO-2 - the cap lane guards realmIndex>=1: a mortal-realm
  // swordPath slice emits a fault, it never lets kiemDaoCap throw
  // inside the untrusted-input validator.
  it('mortal + swordPath slice emits fault thay vì throw', () => {
    const save = validSave()
    const player = save.player as Record<string, unknown>
    player.realmId = 'mortal'
    player.swordPath = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 1 }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result).some((path) => path === 'player.swordPath')).toBe(true)
  })
})

describe('validateGameSaveShape — arrays bắt buộc', () => {
  it.each([
    'techniques',
    'skills',
    'materials',
    'equipment',
    'pills',
    'talismans',
    'formations',
    'buildings',
    'equipmentSlots',
  ])('từ chối khi thiếu array %s', (field) => {
    const save = validSave()

    delete save[field]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(`.${field}`)
  })
})

describe('validateGameSaveShape — phần tử', () => {
  it('materials entry thiếu materialId / amount NaN bị từ chối', () => {
    const save = validSave()

    save.materials = [
      { amount: 3 },
      { materialId: 'ok_id', amount: Number.NaN },
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('materials[0].materialId')
    expect(pathsOf(result)).toContain('materials[1].amount')
  })

  it('equipment entry thiếu instanceId / itemId bị từ chối', () => {
    const save = validSave()

    save.equipment = [{ itemId: 'sword' }, { instanceId: 'inst-1' }]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('equipment[0].instanceId')
    expect(pathsOf(result)).toContain('equipment[1].itemId')
  })

  // Mission A1 - talismans/formations luon rong tren serializer, nhung
  // element lech shape van phai bi chan tai trust boundary.
  it('talismans/formations entry lệch shape bị từ chối', () => {
    const save = validSave()

    save.talismans = [{ talismanId: 5, amount: 1 }, { talismanId: 'ok', amount: 'x' }]
    save.formations = [{ formationId: 'f1' }]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('talismans[0].talismanId')
    expect(pathsOf(result)).toContain('talismans[1].amount')
    expect(pathsOf(result)).toContain('formations[0].amount')
  })

  it('optional field sai kiểu vẫn bị từ chối (productionSites không phải array)', () => {
    const save = validSave()

    save.productionSites = { not: 'an array' }

    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

describe('validateGameSaveShape — quests slice (Mission A1)', () => {
  function validQuests(): Record<string, unknown> {
    return {
      active: [{ questId: 'daily_kill_wolves', progress: 2, claimed: false }],
      completedOnceIds: ['once_quest_a'],
      lastDailyResetAtMs: 1_725_000_000_000,
    }
  }

  it('chấp nhận quests slice hợp lệ', () => {
    const save = validSave()

    save.quests = validQuests()

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('từ chối quests không phải object', () => {
    const save = validSave()

    save.quests = 'not-an-object'

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.quests')
  })

  it('từ chối quests.active không phải array', () => {
    const save = validSave()

    save.quests = { ...validQuests(), active: 'x' }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.quests.active')
  })

  it.each([
    [{ questId: 5, progress: 1, claimed: false }, 'questId'],
    [{ questId: 'q', progress: 'x', claimed: false }, 'progress'],
    [{ questId: 'q', progress: -1, claimed: false }, 'progress'],
    [{ questId: 'q', progress: Number.NaN, claimed: false }, 'progress'],
    [{ questId: 'q', progress: 1, claimed: 'y' }, 'claimed'],
  ])('từ chối quests.active entry sai field (%j)', (entry, _field) => {
    const save = validSave()

    save.quests = { ...validQuests(), active: [entry] }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.quests.active[0]')
  })

  it('từ chối quests.completedOnceIds không phải string[]', () => {
    const save = validSave()

    save.quests = { ...validQuests(), completedOnceIds: [1, 'ok'] }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.quests.completedOnceIds')
  })

  it.each([Number.NaN, -1, 'x'])(
    'từ chối quests.lastDailyResetAtMs = %s',
    (value) => {
      const save = validSave()

      save.quests = { ...validQuests(), lastDailyResetAtMs: value }

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('.quests.lastDailyResetAtMs')
    },
  )
})

describe('validateGameSaveShape — buildings slice (Mission A1)', () => {
  function validBuilding(): Record<string, unknown> {
    return {
      instanceId: 'b1',
      buildingId: 'chi_hien_quan',
      level: 2,
      lastCollectedAt: 1_725_000_000_000,
    }
  }

  it('chấp nhận buildings entry hợp lệ', () => {
    const save = validSave()

    save.buildings = [validBuilding()]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([
    [{ ...validBuilding(), level: 'bad' }, 'level string'],
    [{ ...validBuilding(), level: 0 }, 'level 0'],
    [{ ...validBuilding(), level: 1.5 }, 'level non-integer'],
    [{ ...validBuilding(), level: Number.NaN }, 'level NaN'],
    [{ ...validBuilding(), instanceId: 7 }, 'instanceId non-string'],
    [{ ...validBuilding(), buildingId: 7 }, 'buildingId non-string'],
    [{ ...validBuilding(), lastCollectedAt: -5 }, 'lastCollectedAt âm'],
    [{ ...validBuilding(), lastCollectedAt: 'x' }, 'lastCollectedAt string'],
    ['not-an-object', 'entry non-object'],
  ])('từ chối buildings entry: %s', (entry, _case) => {
    const save = validSave()

    save.buildings = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('buildings[0]')
  })
})

describe('validateGameSaveShape — productionSites slice (Mission A1)', () => {
  function validCycle(): Record<string, unknown> {
    return {
      cycleId: 'cycle-1',
      siteId: 'thanh_van_forest',
      collectionRealmId: 'mortal',
      siteLevelAtStart: 1,
      rewardTableVersion: 1,
      rollSeed: 12345,
      startedAtMs: 1_725_000_000_000,
      completesAtMs: 1_725_000_060_000,
    }
  }

  function validSite(): Record<string, unknown> {
    return {
      siteId: 'thanh_van_forest',
      level: 2,
      autoRestart: true,
      assignedWorkers: 2,
      workerCycles: [validCycle()],
    }
  }

  it('chấp nhận productionSites đầy đủ hợp lệ', () => {
    const save = validSave()

    save.productionSites = [validSite()]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([
    [{ ...validSite(), siteId: 5 }, 'siteId non-string'],
    [{ ...validSite(), level: 'x' }, 'level non-integer'],
    [{ ...validSite(), level: 1.5 }, 'level thập phân'],
    [{ ...validSite(), level: 0 }, 'level = 0'],
    [{ ...validSite(), level: -2 }, 'level âm'],
    [{ ...validSite(), autoRestart: 'yes' }, 'autoRestart non-bool'],
    ['not-an-object', 'entry non-object'],
  ])('từ chối productionSites entry: %s', (entry, _case) => {
    const save = validSave()

    save.productionSites = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('productionSites[0]')
  })

  it.each([['x'], [1.5], [-1]])(
    'từ chối productionSites[0].assignedWorkers = %s',
    (value) => {
      const save = validSave()

      save.productionSites = [{ ...validSite(), assignedWorkers: value }]

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('productionSites[0].assignedWorkers')
    },
  )

  it('từ chối workerCycles không phải array', () => {
    const save = validSave()

    save.productionSites = [{ ...validSite(), workerCycles: 'x' }]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('productionSites[0].workerCycles')
  })

  it('từ chối workerCycles entry sai shape (rollSeed NaN)', () => {
    const save = validSave()

    save.productionSites = [
      { ...validSite(), workerCycles: [{ ...validCycle(), rollSeed: Number.NaN }] },
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('productionSites[0].workerCycles[0]')
  })

  it('chấp nhận site tối thiểu (không cycle/assignedWorkers)', () => {
    const save = validSave()

    save.productionSites = [{ siteId: 'thanh_van_forest', level: 1, autoRestart: false }]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('validateGameSaveShape — alchemyJobs slice (Mission A1)', () => {
  function validJob(): Record<string, unknown> {
    return {
      jobId: 'job-1',
      recipeId: 'pill_regen_mortal',
      pillId: 'pill_regen_mortal',
      herbMaterialId: 'mortal_herb_decade',
      startedAtMs: 1_725_000_000_000,
      completesAtMs: 1_725_000_060_000,
      roomLevelAtStart: 1,
    }
  }

  it('chấp nhận alchemyJobs entry hợp lệ', () => {
    const save = validSave()

    save.alchemyJobs = [validJob()]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([
    [{ ...validJob(), jobId: 5 }],
    [{ ...validJob(), recipeId: undefined }],
    [{ ...validJob(), pillId: 7 }],
    [{ ...validJob(), herbMaterialId: null }],
    [{ ...validJob(), startedAtMs: 'x' }],
    [{ ...validJob(), completesAtMs: 'x' }],
    [{ ...validJob(), completesAtMs: Number.NaN }],
    [{ ...validJob(), roomLevelAtStart: 'x' }],
    ['not-an-object'],
  ])('từ chối alchemyJobs entry: %j', (entry) => {
    const save = validSave()
    const normalized = isRecord(entry)
      ? Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined))
      : entry

    save.alchemyJobs = [normalized]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('alchemyJobs[0]')
  })
})

describe('validateGameSaveShape — decompose slice (Mission A1 extension)', () => {
  function validDecompose(): Record<string, unknown> {
    return {
      settings: { gradeFilter: 'all', ageFilter: 'decade', workers: 2 },
      nextCycleAt: 1_725_000_030_000,
      started: true,
    }
  }

  it('chấp nhận decompose slice hợp lệ', () => {
    const save = validSave()

    save.decompose = validDecompose()

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([['bad'], [Number.NaN], [-5]])(
    'từ chối decompose.nextCycleAt = %s (timer poison — runaway tick)',
    (value) => {
      const save = validSave()

      save.decompose = { ...validDecompose(), nextCycleAt: value }

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('.decompose.nextCycleAt')
    },
  )

  it('từ chối decompose.started non-boolean', () => {
    const save = validSave()

    save.decompose = { ...validDecompose(), started: 'yes' }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.decompose.started')
  })

  it('từ chối decompose.settings.gradeFilter ngoài enum', () => {
    const save = validSave()

    save.decompose = {
      ...validDecompose(),
      settings: { gradeFilter: 'bogus', ageFilter: 'all', workers: 1 },
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.decompose.settings.gradeFilter')
  })

  it('từ chối decompose.settings.ageFilter ngoài enum', () => {
    const save = validSave()

    save.decompose = {
      ...validDecompose(),
      settings: { gradeFilter: 'all', ageFilter: 'bogus', workers: 1 },
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.decompose.settings.ageFilter')
  })

  it('từ chối decompose.settings không phải object', () => {
    const save = validSave()

    save.decompose = { ...validDecompose(), settings: 'x' }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('.decompose.settings')
  })
})

describe('validateGameSaveShape — equipment & slot shape (chặn crash boot/NaN)', () => {
  function validEquipmentEntry(): Record<string, unknown> {
    return {
      instanceId: 'inst-1',
      itemId: 'sword',
      slot: 'weapon',
      equipped: true,
      grade: 'cuu_pham',
      quality: 'hoang',
      mainStat: {
        id: 'inst-1:main',
        sourceId: 'inst-1',
        sourceType: 'equipment',
        stat: 'might',
        flat: 1,
      },
      affixes: [],
      forgeUsesTotal: 6,
      forgeUsesRemaining: 6,
    }
  }

  it('chấp nhận equipment entry schema mới đủ field bắt buộc', () => {
    const save = validSave()
    const entry = validEquipmentEntry()

    save.equipment = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(normalizedSaveOf(result).equipment).toEqual([entry])
      expect(result.discardedEquipmentCount).toBe(0)
    }
  })

  // Dev-stage rule (Mission G) - legacy stat keys are REJECTED at the
  // boundary, not remapped: a save carrying them fails validation.
  it('rejects a legacy mainStat.stat key', () => {
    const save = validSave()
    const entry = validEquipmentEntry()

    ;(entry.mainStat as Record<string, unknown>).stat = 'attack'
    save.equipment = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(
        result.issues.some((issue) => issue.path.endsWith('mainStat.stat')),
      ).toBe(true)
    }
  })

  it('tolerates a legacy socketed payload on equipmentSlots — fields retired, ignored', () => {
    const save = validSave()

    save.equipmentSlots = [
      {
        slot: 'weapon',
        enhanceLevel: 0,
        enhanceFailStreak: 0,
        socketedFormation: {
          itemId: 'tran-1',
          realmId: 'luyen_khi',
          modifiers: [
            { id: 'tran-1_a', sourceId: 'tran-1', sourceType: 'formation', stat: 'attack', flat: 5 },
          ],
        },
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([
    ['slot'],
    ['equipped'],
    ['grade'],
    ['quality'],
    ['mainStat'],
    ['affixes'],
    ['forgeUsesTotal'],
    ['forgeUsesRemaining'],
  ])(
    'từ chối equipment entry thiếu %s',
    (field) => {
      const save = validSave()

      const entry = validEquipmentEntry()

      delete entry[field]

      save.equipment = [entry]

      expect(validateGameSaveShape(save).ok).toBe(false)
    },
  )

  it.each([
    ['slot', 'not-an-equipment-slot'],
    ['grade', 'not-a-grade'],
    ['quality', 'not-a-quality'],
    ['forgeUsesTotal', Number.NaN],
    ['forgeUsesTotal', -1],
    ['forgeUsesRemaining', Number.NaN],
    ['forgeUsesRemaining', -1],
  ])('từ chối equipment entry có %s không hợp lệ', (field, value) => {
    const save = validSave()
    const entry = validEquipmentEntry()

    entry[field] = value

    save.equipment = [entry]

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('từ chối equipment entry có forgeUsesRemaining vượt forgeUsesTotal', () => {
    const save = validSave()
    const entry = validEquipmentEntry()

    entry.forgeUsesTotal = 5
    entry.forgeUsesRemaining = 6
    save.equipment = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('equipment[0].forgeUsesRemaining')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null])(
    'từ chối equipment current-shape có affix value không hữu hạn %s',
    (invalidValue) => {
      const save = validSave()
      const entry = validEquipmentEntry()
      entry.affixes = [{ affixId: 'prefix_attack', tier: 2, value: invalidValue }]
      save.equipment = [entry]

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('equipment[0].affixes[0].value')
    },
  )

  it.each(['id', 'sourceId', 'sourceType', 'stat'])(
    'từ chối equipment current-shape thiếu mainStat.%s',
    (field) => {
      const save = validSave()
      const entry = validEquipmentEntry()

      delete (entry.mainStat as Record<string, unknown>)[field]
      save.equipment = [entry]

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain(`equipment[0].mainStat.${field}`)
    },
  )

  it.each([
    ['id', ''],
    ['sourceId', ''],
    ['sourceType', 'buff'],
    ['stat', 'not_a_stat'],
    ['tag', null],
  ])('từ chối equipment current-shape có mainStat.%s sai contract', (field, value) => {
    const save = validSave()
    const entry = validEquipmentEntry()

    ;(entry.mainStat as Record<string, unknown>)[field] = value
    save.equipment = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(`equipment[0].mainStat.${field}`)
  })

  it.each([
    'flat',
    'percent',
    'multiplier',
    'stacks',
    'maxStacks',
    'perLevelFlat',
    'perLevelPercent',
  ])('từ chối mainStat.%s optional nếu không phải số hữu hạn', (field) => {
    for (const invalidValue of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const save = validSave()
      const entry = validEquipmentEntry()

      ;(entry.mainStat as Record<string, unknown>)[field] = invalidValue
      save.equipment = [entry]

      const result = validateGameSaveShape(save)

      expect(result.ok, `${field}=${String(invalidValue)}`).toBe(false)
      expect(pathsOf(result)).toContain(`equipment[0].mainStat.${field}`)
    }
  })

  it.each([
    ['affixId', undefined],
    ['affixId', ''],
    ['tier', undefined],
    ['tier', 0],
    ['tier', -1],
    ['tier', 1.5],
  ])('từ chối equipment current-shape có affix.%s = %s', (field, value) => {
    const save = validSave()
    const entry = validEquipmentEntry()
    const affix: Record<string, unknown> = {
      affixId: 'prefix_attack',
      tier: 2,
      value: 8,
    }

    if (value === undefined) {
      delete affix[field]
    } else {
      affix[field] = value
    }
    entry.affixes = [affix]
    save.equipment = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(`equipment[0].affixes[0].${field}`)
  })

  it('chấp nhận đầy đủ StatModifier optional hữu hạn và RolledAffix current hợp lệ', () => {
    const save = validSave()
    const entry = validEquipmentEntry()

    entry.mainStat = {
      id: 'inst-1:main',
      sourceId: 'inst-1',
      sourceType: 'equipment',
      stat: 'might',
      tag: 'weapon',
      flat: 1,
      percent: 0.1,
      multiplier: 1.2,
      stacks: 1,
      maxStacks: 2,
      perLevelFlat: 0.5,
      perLevelPercent: 0.01,
    }
    entry.affixes = [{ affixId: 'prefix_attack', tier: 2, value: 8 }]
    save.equipment = [entry]

    expect(validateGameSaveShape(save)).toMatchObject({ ok: true, issues: [] })
  })

  it.each(['realmId', 'rarity'])(
    'loại bỏ equipment legacy có %s, ghi counter và không làm hỏng toàn save',
    (legacyField) => {
      const save = validSave()
      const currentEntry = { ...validEquipmentEntry(), instanceId: 'inst-current' }
      const legacyEntry = {
        instanceId: 'inst-legacy',
        itemId: 'old-sword',
        slot: 'weapon',
        equipped: false,
        mainStat: null,
        affixes: [{ affixId: '', tier: 0, value: null }],
        forgePoints: 0,
        [legacyField]: legacyField === 'realmId' ? 'mortal' : 'hoang',
      }

      save.equipment = [legacyEntry, currentEntry]

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(normalizedSaveOf(result).equipment).toEqual([currentEntry])
        expect(result.discardedEquipmentCount).toBe(1)
      }
    },
  )

  it('ok với equipmentSlots entry đủ slot + enhanceLevel', () => {
    const save = validSave()

    save.equipmentSlots = [{ slot: 'weapon', enhanceLevel: 0 }]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(normalizedSaveOf(result).equipmentSlots).toEqual([
        { slot: 'weapon', enhanceLevel: 0, enhanceFailStreak: 0 },
      ])
    }
  })

  it('từ chối equipmentSlots entry thiếu enhanceLevel', () => {
    const save = validSave()

    save.equipmentSlots = [{ slot: 'weapon' }]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('equipmentSlots[0].enhanceLevel')
  })

  it('từ chối equipmentSlots entry có slot ngoài EQUIPMENT_SLOTS', () => {
    const save = validSave()

    save.equipmentSlots = [{ slot: 'not-an-equipment-slot', enhanceLevel: 0 }]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('equipmentSlots[0].slot')
  })

  it('từ chối equipmentSlots entry có enhanceFailStreak âm', () => {
    const save = validSave()

    save.equipmentSlots = [{ slot: 'weapon', enhanceLevel: 0, enhanceFailStreak: -1 }]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('equipmentSlots[0].enhanceFailStreak')
  })
})

describe('validateGameSaveShape - companion gacha (v60)', () => {
  function validCompanionEntry(): Record<string, unknown> {
    return {
      instanceId: 'comp-1',
      // The validator rejects definitionIds absent from the live roster,
      // so entries must use a real production id.
      definitionId: COMPANIONS[0]!.id,
      realmId: 'mortal',
      realmLevel: 5,
      exp: 12,
      constellationRank: 2,
    }
  }

  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }

  it('chấp nhận player shape v60 có companion hợp lệ', () => {
    const save = validSave()
    const player = playerOf(save)

    player.companions = [validCompanionEntry()]
    player.companionPullsSinceRare = 3
    player.duyenPhan = 7

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([
    ['companionPullsSinceRare', 'player.companionPullsSinceRare'],
    ['duyenPhan', 'player.duyenPhan'],
  ])('từ chối khi %s = NaN, path "%s"', (field, expectedPath) => {
    const save = validSave()

    playerOf(save)[field] = Number.NaN

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(expectedPath)
  })

  it.each([
    ['companionPullsSinceRare', 'player.companionPullsSinceRare'],
    ['duyenPhan', 'player.duyenPhan'],
    ['companions', 'player.companions'],
  ])('từ chối khi thiếu %s, path "%s"', (field, expectedPath) => {
    const save = validSave()

    delete playerOf(save)[field]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(expectedPath)
  })

  it('từ chối companions entry thiếu instanceId', () => {
    const save = validSave()
    const entry = validCompanionEntry()

    delete entry.instanceId
    playerOf(save).companions = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.companions[0].instanceId')
  })

  it('từ chối companions entry có instanceId rỗng', () => {
    const save = validSave()
    const entry = validCompanionEntry()

    entry.instanceId = ''
    playerOf(save).companions = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.companions[0].instanceId')
  })

  it('từ chối companions entry có realmId không tồn tại trong REALMS', () => {
    const save = validSave()
    const entry = validCompanionEntry()

    entry.realmId = 'khong_ton_tai'
    playerOf(save).companions = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.companions[0].realmId')
  })

  it.each([0, -1, 1.5, Number.NaN])(
    'từ chối companions entry có realmLevel = %s',
    (realmLevel) => {
      const save = validSave()
      const entry = validCompanionEntry()

      entry.realmLevel = realmLevel
      playerOf(save).companions = [entry]

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.companions[0].realmLevel')
    },
  )

  it('từ chối (không clamp) companions entry có realmLevel vượt maxLevel của cảnh giới', () => {
    const save = validSave()
    const entry = validCompanionEntry()

    // mortal.maxLevel = 18 - 19 must fail loud, not be clamped.
    entry.realmLevel = 19
    playerOf(save).companions = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.companions[0].realmLevel')
  })

  it.each([7, -1, 1.5, Number.NaN])(
    'từ chối companions entry có constellationRank = %s',
    (constellationRank) => {
      const save = validSave()
      const entry = validCompanionEntry()

      entry.constellationRank = constellationRank
      playerOf(save).companions = [entry]

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.companions[0].constellationRank')
    },
  )

  it('từ chối companions entry có exp âm / NaN', () => {
    for (const bad of [-1, Number.NaN]) {
      const save = validSave()
      const entry = validCompanionEntry()

      entry.exp = bad
      playerOf(save).companions = [entry]

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.companions[0].exp')
    }
  })

  it('từ chối companions entry không phải object', () => {
    const save = validSave()

    playerOf(save).companions = ['not-an-object']

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.companions[0]')
  })

  it('từ chối companions có instanceId trùng giữa 2 entry', () => {
    const save = validSave()

    playerOf(save).companions = [
      validCompanionEntry(),
      { ...validCompanionEntry(), definitionId: COMPANIONS[1]!.id },
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.companions[1].instanceId')
  })

  it('từ chối companions có definitionId trùng (invariant 1 instance / definition)', () => {
    const save = validSave()

    playerOf(save).companions = [
      validCompanionEntry(),
      { ...validCompanionEntry(), instanceId: 'comp-2' },
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.companions[1].definitionId')
  })

  it('từ chối companions entry có definitionId không tồn tại trong COMPANIONS (registry drift)', () => {
    const save = validSave()
    const entry = validCompanionEntry()

    // An owned companion whose definitionId fell out of the roster is
    // permanently inert - panel hides it, buildTurnBattle skips it,
    // battle EXP skips it - while still occupying player.companions.
    // Same registry-drift contract as realmId above and the
    // learned-defect QA-2026-09-01-013 principle: an owned current
    // entry must hard-fail, not silently load as dead weight.
    entry.definitionId = 'khong_ton_tai_trong_roster'
    playerOf(save).companions = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.companions[0].definitionId')
  })
})

describe('validateGameSaveShape - talent v4 M2 fields (v61)', () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }

  it('chấp nhận player shape v61 với đầy đủ field M2', () => {
    const save = validSave()
    const player = playerOf(save)

    player.cultivationOvercharge = 12
    player.nodeFreePurchaseRecord = { node_a: 2 }
    player.phaGiapCarryStacks = 4
    player.phaGiapCarryRealmId = 'qi_refining'

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([
    ['cultivationOvercharge', 'player.cultivationOvercharge'],
    ['nodeFreePurchaseRecord', 'player.nodeFreePurchaseRecord'],
    ['phaGiapCarryStacks', 'player.phaGiapCarryStacks'],
    ['phaGiapCarryRealmId', 'player.phaGiapCarryRealmId'],
  ])('từ chối khi thiếu %s, path "%s"', (field, expectedPath) => {
    const save = validSave()

    delete playerOf(save)[field]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(expectedPath)
  })

  it.each([
    ['cultivationOvercharge', 'player.cultivationOvercharge'],
    ['phaGiapCarryStacks', 'player.phaGiapCarryStacks'],
  ])('từ chối khi %s âm / NaN, path "%s"', (field, expectedPath) => {
    for (const bad of [-1, Number.NaN]) {
      const save = validSave()

      playerOf(save)[field] = bad

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain(expectedPath)
    }
  })

  it('từ chối nodeFreePurchaseRecord không phải object', () => {
    const save = validSave()

    playerOf(save).nodeFreePurchaseRecord = 'not-an-object'

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.nodeFreePurchaseRecord')
  })

  it('từ chối phaGiapCarryRealmId không phải string/null', () => {
    const save = validSave()

    playerOf(save).phaGiapCarryRealmId = 42

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.phaGiapCarryRealmId')
  })
})

describe('validateGameSaveShape — C1 corrupt-save residuals', () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }

  it.each([undefined, 'not-an-object', 5, []])(
    'từ chối perfectClearSeconds = %s',
    (value) => {
      const save = validSave()
      const player = playerOf(save)

      if (value === undefined) {
        delete player.perfectClearSeconds
      } else {
        player.perfectClearSeconds = value
      }

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.perfectClearSeconds')
    },
  )

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY, 'not-a-number'])(
    'từ chối perfectClearSeconds entry = %s (consumer assumes finite > 0)',
    (value) => {
      const save = validSave()

      playerOf(save).perfectClearSeconds = { some_stage: value }

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.perfectClearSeconds.some_stage')
    },
  )

  it('chấp nhận perfectClearSeconds entry hợp lệ', () => {
    const save = validSave()

    playerOf(save).perfectClearSeconds = { mortal_dong_1: 42.5 }

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([undefined, 'not-an-object', 5, []])(
    'từ chối formationLoadout = %s (non-null nhưng sai shape)',
    (value) => {
      const save = validSave()
      const player = playerOf(save)

      if (value === undefined) {
        delete player.formationLoadout
      } else {
        player.formationLoadout = value
      }

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.formationLoadout')
    },
  )

  it('từ chối formationLoadout thiếu assignments — resolvePartyFormation đọc .assignments.map trực tiếp', () => {
    const save = validSave()

    playerOf(save).formationLoadout = { formationId: 'ngu_hanh_tran' }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.formationLoadout.assignments')
  })

  it('từ chối formationLoadout assignment sai shape field', () => {
    const save = validSave()

    playerOf(save).formationLoadout = {
      formationId: 'ngu_hanh_tran',
      assignments: [
        { row: 0, column: 0, combatantId: 'player' },
        { row: 'front', column: 1, combatantId: 'comp-1' },
        'not-an-object',
      ],
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.formationLoadout.assignments[1].row')
    expect(pathsOf(result)).toContain('player.formationLoadout.assignments[2]')
  })

  it('chấp nhận formationLoadout hợp lệ (shape-only; semantic check ở commitFormationLoadout)', () => {
    const save = validSave()

    playerOf(save).formationLoadout = {
      formationId: 'ngu_hanh_tran',
      assignments: [{ row: 0, column: 0, combatantId: 'player' }],
    }

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([
    [{}, 'player.autoFarmStage.stageId'],
    [{ stageId: 'x' }, 'player.autoFarmStage.lastCheckedMs'],
    [{ stageId: 'x', lastCheckedMs: Number.NaN }, 'player.autoFarmStage.lastCheckedMs'],
    [{ stageId: 'x', lastCheckedMs: -1 }, 'player.autoFarmStage.lastCheckedMs'],
  ])('từ chối autoFarmStage = %j, path "%s"', (value, expectedPath) => {
    const save = validSave()

    playerOf(save).autoFarmStage = value

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(expectedPath)
  })
})

describe('validateGameSaveShape — player record/array deep checks (Mission A review)', () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }

  it.each([
    ['might', 'huge'],
    ['might', Number.NaN],
    ['might', null],
  ])('từ chối baseStats.%s = %j', (statKey, value) => {
    const save = validSave()
    const player = playerOf(save)

    player.baseStats = { ...(player.baseStats as object), [statKey]: value }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(`player.baseStats.${statKey}`)
  })

  it('chấp nhận baseStats có stat = 0 và stat âm (shape-only)', () => {
    const save = validSave()
    const player = playerOf(save)

    player.baseStats = {
      ...(player.baseStats as object),
      might: 0,
      customStat: -5,
    }

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  // M-F-TALENT (v76) - talentLevels is the UPGRADE axis (sparse map,
  // absent id = tang 1): required object, integer values >= 1.
  it.each([Number.NaN, 0, -1, 1.5, 'x'])('từ chối talentLevels value = %j', (value) => {
    const save = validSave()

    playerOf(save).talentLevels = { tc_dia_can: value }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.talentLevels.tc_dia_can')
  })

  it('từ chối khi thiếu talentLevels (required v76)', () => {
    const save = validSave()

    delete (save.player as Record<string, unknown>).talentLevels

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.talentLevels')
  })

  it('chấp nhận talentLevels rỗng và thưa', () => {
    const save = validSave()

    playerOf(save).talentLevels = {}
    expect(validateGameSaveShape(save).ok).toBe(true)

    const owned = validSave()

    playerOf(owned).selectedTalentIds = ['tc_dia_can', 'lk_linh_mach']
    playerOf(owned).talentLevels = { tc_dia_can: 2, lk_linh_mach: 3 }
    expect(validateGameSaveShape(owned).ok).toBe(true)
  })

  it('từ chối talentLevels của talent save không sở hữu (latent level bypass)', () => {
    const save = validSave()

    // NEW ownership grants level 1 by contract - a stored level for an
    // unowned id can only come from a shaped save and would bypass the
    // level ladder on first grant. Fail loud.
    playerOf(save).talentLevels = { lk_bac_hai: 2 }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.talentLevels.lk_bac_hai')
  })

  it.each([
    // Pool talents author levels to maxLevel 3 - a persisted 4+ cannot
    // come from the domain (UPGRADE grants at most level+1 up to max).
    [{ tc_dia_can: 99 }, 'player.talentLevels.tc_dia_can'],
    [{ lk_bac_hai: 4 }, 'player.talentLevels.lk_bac_hai'],
    // pham_cot has no levels table - maxLevel 1, any stored level is
    // corruption (the domain never writes it).
    [{ pham_cot: 2 }, 'player.talentLevels.pham_cot'],
  ])('từ chối talentLevels vượt maxLevel = %j, path "%s"', (value, expectedPath) => {
    const save = validSave()

    playerOf(save).talentLevels = value

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(expectedPath)
  })

  it('chấp nhận talentLevels của talent retired nhưng vẫn sở hữu (tolerated)', () => {
    const save = validSave()

    // A retired-but-owned talent keeps its level entry: the id stays in
    // selectedTalentIds so consumers can skip it without losing data.
    playerOf(save).selectedTalentIds = ['retired_talent_id']
    playerOf(save).talentLevels = { retired_talent_id: 9 }

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  // pendingTalentEntitlement - the persisted breakthrough-decision
  // record (optional; reload re-presents the same offers).
  it.each([
    [{ realmId: '', offeredTalentIds: [] }, 'player.pendingTalentEntitlement.realmId'],
    [{ realmId: 7, offeredTalentIds: [] }, 'player.pendingTalentEntitlement.realmId'],
    [{ realmId: 'qi_refining' }, 'player.pendingTalentEntitlement.offeredTalentIds'],
    [{ realmId: 'qi_refining', offeredTalentIds: 'not-array' }, 'player.pendingTalentEntitlement.offeredTalentIds'],
    [{ realmId: 'qi_refining', offeredTalentIds: ['ok', 5] }, 'player.pendingTalentEntitlement.offeredTalentIds[1]'],
  ])('từ chối pendingTalentEntitlement = %j, path "%s"', (value, expectedPath) => {
    const save = validSave()

    playerOf(save).pendingTalentEntitlement = value

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(expectedPath)
  })

  it('chấp nhận pendingTalentEntitlement hợp lệ / vắng mặt', () => {
    const save = validSave()

    playerOf(save).pendingTalentEntitlement = {
      realmId: 'foundation_establishment',
      offeredTalentIds: ['tc_dia_can', 'tc_kim_lan', 'tc_truc_hon'],
    }
    expect(validateGameSaveShape(save).ok).toBe(true)

    delete (save.player as Record<string, unknown>).pendingTalentEntitlement
    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  // QA-2026-09-23-MF-TALENT-1 - the persisted record drives a blocking
  // uncancellable modal: a malformed one must fail at the boundary
  // (registry-drift rule QA-2026-09-12-013), never restore into an
  // empty decision surface that strands the transition lock forever.
  it.each([
    [{ realmId: 'not_a_realm', offeredTalentIds: ['tc_dia_can'] }, 'player.pendingTalentEntitlement.realmId'],
    [{ realmId: 'qi_refining', offeredTalentIds: ['retired_talent_id'] }, 'player.pendingTalentEntitlement.offeredTalentIds[0]'],
    [{ realmId: 'qi_refining', offeredTalentIds: [] }, 'player.pendingTalentEntitlement'],
    [
      { realmId: 'qi_refining', offeredTalentIds: ['lk_bac_hai', 'lk_bac_hai'] },
      'player.pendingTalentEntitlement.offeredTalentIds[1]',
    ],
  ])('từ chối pendingTalentEntitlement lệch catalog = %j, path "%s"', (value, expectedPath) => {
    const save = validSave()

    playerOf(save).pendingTalentEntitlement = value

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(expectedPath)
  })

  it('từ chối entitlement mà save không còn quyết định hợp lệ nào (empty offers + không talent nâng được)', () => {
    const save = validSave()
    const player = playerOf(save)

    // Offers empty AND every owned talent is unknown or already at
    // maxLevel - the modal would render zero legal branches.
    player.selectedTalentIds = ['retired_talent_id', 'pham_cot']
    player.talentLevels = {}
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [] }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.pendingTalentEntitlement')
  })

  it('từ chối entitlement mà mọi offer đã sở hữu + không talent nâng được (all-owned offers)', () => {
    const save = validSave()
    const player = playerOf(save)

    // Every offered card is already owned at maxLevel, and the owner
    // has no legal upgrade left - every NEW decision would be rejected
    // and the uncancellable modal would lock forever. Fail loud.
    player.selectedTalentIds = ['lk_bac_hai']
    player.talentLevels = { lk_bac_hai: 3 }
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: ['lk_bac_hai'] }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.pendingTalentEntitlement')
  })

  it('từ chối entitlement có MỘT offer ngoài pool giữa các offer hợp lệ (mixed set, C2C-47)', () => {
    const save = validSave()
    const player = playerOf(save)

    // lk_bac_hai is a live qi_refining member, but tc_dia_can is a
    // catalog id from foundation_establishment's pool - a foreign offer.
    // EVERY persisted id must satisfy isLegalBreakthroughOffer, not just
    // SOME of them: a mixed set is corruption, fail loud at [1].
    player.pendingTalentEntitlement = {
      realmId: 'qi_refining',
      offeredTalentIds: ['lk_bac_hai', 'tc_dia_can'],
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.pendingTalentEntitlement.offeredTalentIds[1]')
  })

  it('chấp nhận entitlement offers rỗng KHI vẫn còn nhánh UPGRADE hợp lệ', () => {
    const save = validSave()
    const player = playerOf(save)

    // A drained pool legitimately produces offeredTalentIds: [] - the
    // decision survives on the UPGRADE branch (owned, levels authored).
    player.selectedTalentIds = ['lk_bac_hai']
    player.talentLevels = { lk_bac_hai: 2 }
    player.pendingTalentEntitlement = { realmId: 'qi_refining', offeredTalentIds: [] }

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([Number.NaN, -1, 'x'])('từ chối nodeLevels value = %j', (value) => {
    const save = validSave()

    playerOf(save).nodeLevels = { node_1: value }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.nodeLevels.node_1')
  })

  it.each([Number.NaN, 'x'])('từ chối nodeFreePurchaseRecord value = %j', (value) => {
    const save = validSave()

    playerOf(save).nodeFreePurchaseRecord = { node_1: value }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.nodeFreePurchaseRecord.node_1')
  })

  it.each([
    'selectedTalentIds',
    'purchasedNodeIds',
    'completedStageIds',
    'perfectClearStageIds',
    'grantedRealmPassiveIds',
  ])('từ chối %s chứa phần tử non-string', (field) => {
    const save = validSave()

    playerOf(save)[field] = ['ok_id', 7]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain(`player.${field}[1]`)
  })

  it.each([
    'selectedTalentIds',
    'purchasedNodeIds',
    'completedStageIds',
    'grantedRealmPassiveIds',
    'externalModifiers',
    'persistentTimedEffects',
  ])('từ chối khi %s không phải array', (field) => {
    const save = validSave()

    playerOf(save)[field] = 'not-an-array'

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('từ chối modifiers chứa phần tử non-object / thiếu stat', () => {
    const save = validSave()

    playerOf(save).modifiers = ['x', { id: 'm1' }]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.modifiers[0]')
    expect(pathsOf(result)).toContain('player.modifiers[1].stat')
  })

  it('từ chối modifier có numeric field NaN', () => {
    const save = validSave()

    playerOf(save).modifiers = [
      { id: 'm1', sourceId: 's1', sourceType: 'buff', stat: 'might', flat: Number.NaN },
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.modifiers[0].flat')
  })

  it('từ chối persistentTimedEffects có expiresAtMs NaN', () => {
    const save = validSave()

    playerOf(save).persistentTimedEffects = [
      { id: 'e1', sourceItemId: 'pill_x', appliedAtMs: 1, expiresAtMs: Number.NaN, modifiers: [] },
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.persistentTimedEffects[0].expiresAtMs')
  })

  it.each(['warp_speed', 5, null])('từ chối combatAiStrategy = %j', (value) => {
    const save = validSave()

    playerOf(save).combatAiStrategy = value

    expect(validateGameSaveShape(save).ok).toBe(false)
    expect(pathsOf(validateGameSaveShape(save))).toContain('player.combatAiStrategy')
  })

  // M-QI-05 (v73) - skillLevels is a retired field: ANY presence
  // rejects at the field path, regardless of its contents.
  it.each([{ skill_1: 1 }, { skill_1: null }, { skill_1: -3 }, {}])(
    'từ chối skillLevels hiện diện = %j',
    (value) => {
      const save = validSave()

      playerOf(save).skillLevels = value

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.skillLevels')
    },
  )

  it('chấp nhận skillCastCounts vắng mặt (optional)', () => {
    const save = validSave()

    delete playerOf(save).skillCastCounts

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  // P7-M6 - techniqueProgress is an optional derived mirror; shape is
  // type-checked but consistency vs techniques[] is NOT (the canonical
  // holder republishes the mirror on restore).
  it.each([Number.NaN, -1, 1.5])('từ chối techniqueProgress.rank = %j', (value) => {
    const save = validSave()

    playerOf(save).techniqueProgress = { rank: value, grade: 1 }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.techniqueProgress.rank')
  })

  it.each([Number.NaN, -2, 0.5])('từ chối techniqueProgress.grade = %j', (value) => {
    const save = validSave()

    playerOf(save).techniqueProgress = { rank: 3, grade: value }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.techniqueProgress.grade')
  })

  it.each([42, 'rank3', null])('từ chối techniqueProgress = %j', (value) => {
    const save = validSave()

    playerOf(save).techniqueProgress = value

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.techniqueProgress')
  })

  it('chấp nhận techniqueProgress vắng mặt / undefined / hợp lệ', () => {
    const absent = validSave()
    delete playerOf(absent).techniqueProgress
    expect(validateGameSaveShape(absent).ok).toBe(true)

    const undef = validSave()
    playerOf(undef).techniqueProgress = undefined
    expect(validateGameSaveShape(undef).ok).toBe(true)

    const valid = validSave()
    playerOf(valid).techniqueProgress = { rank: 7, grade: 3 }
    expect(validateGameSaveShape(valid).ok).toBe(true)
  })

  it.each([
    'hasSeenTutorial',
    'autoWorkerCapacity',
    'totalCultivationGained',
    'bossKillCount',
    'skillInsight',
    'attributePoints',
    'breakthroughGrade',
  ])('từ chối %s sai kiểu', (field) => {
    const save = validSave()

    playerOf(save)[field] = 'junk'

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it.each(['warp', 5])('từ chối highestFoundationAchieved = %j', (value) => {
    const save = validSave()

    playerOf(save).highestFoundationAchieved = value

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.highestFoundationAchieved')
  })

  it('từ chối artifact malformed, chấp nhận artifact vắng mặt', () => {
    const save = validSave()

    playerOf(save).artifact = { artifactId: '', grade: 'than' }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)

    const clean = validSave()

    delete playerOf(clean).artifact

    expect(validateGameSaveShape(clean).ok).toBe(true)
  })
})

describe('validateGameSaveShape — cycle/site consistency (Mission A review)', () => {
  function validCycle(): Record<string, unknown> {
    return {
      cycleId: 'cycle-1',
      siteId: 'thanh_van_forest',
      collectionRealmId: 'mortal',
      siteLevelAtStart: 1,
      rewardTableVersion: 1,
      rollSeed: 12345,
      startedAtMs: 1_725_000_000_000,
      completesAtMs: 1_725_000_060_000,
    }
  }

  it('a stale activeCycle key in productionSites is tolerated (removed field, dev-stage: no migration, no rejection)', () => {
    const save = validSave()
    ;(save as Record<string, unknown>).productionSites = [
      {
        siteId: 'thanh_van_lam', level: 1, autoRestart: true,
        activeCycle: { cycleId: 'old', siteId: 'thanh_van_lam', collectionRealmId: 'mortal',
          siteLevelAtStart: 1, rewardTableVersion: 1, rollSeed: 1, startedAtMs: 0, completesAtMs: 1 },
      },
    ]
    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('từ chối workerCycles có siteId khác site cha', () => {
    const save = validSave()

    save.productionSites = [
      {
        siteId: 'thanh_van_forest',
        level: 1,
        autoRestart: true,
        workerCycles: [validCycle(), { ...validCycle(), cycleId: 'c2', siteId: 'other_site' }],
      },
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('productionSites[0].workerCycles[1].siteId')
  })
})

// P7-M5 (v72) - bodyProgression is a REQUIRED chapter-keyed record; the
// boundary delegates shape checks to the BodyProgression authority
// (each chapter validates its own slice).
describe('validateGameSaveShape — v72 bodyProgression delegation', () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }

  it('từ chối khi bodyProgression vắng mặt / không phải object', () => {
    const save = validSave()

    delete playerOf(save).bodyProgression
    expect(validateGameSaveShape(save).ok).toBe(false)

    const save2 = validSave()
    playerOf(save2).bodyProgression = 7

    const result = validateGameSaveShape(save2)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.bodyProgression')
  })

  it('từ chối body_refinement slice có member sai kiểu với chapter-keyed path', () => {
    const save = validSave()

    playerOf(save).bodyProgression = {
      body_refinement: { completedTiers: 'x', currentTierProgress: -1 },
      meridian: { openedIds: [] },
      zhou_tian: { completed: 0 },
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.bodyProgression.body_refinement.completedTiers')
    expect(pathsOf(result)).toContain('player.bodyProgression.body_refinement.currentTierProgress')
  })

  it('từ chối meridian.openedIds không phải array / chứa non-string với indexed path', () => {
    const save = validSave()

    playerOf(save).bodyProgression = {
      body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      meridian: { openedIds: 'nope' },
      zhou_tian: { completed: 0 },
    }
    expect(validateGameSaveShape(save).ok).toBe(false)

    const save2 = validSave()
    playerOf(save2).bodyProgression = {
      body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      meridian: { openedIds: ['nham_mach', 7] },
      zhou_tian: { completed: 0 },
    }

    const result = validateGameSaveShape(save2)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.bodyProgression.meridian.openedIds[1]')
  })

  it('chấp nhận mid-progress + completed canonical states', () => {
    const save = validSave()

    playerOf(save).bodyProgression = {
      body_refinement: { completedTiers: 3, currentTierProgress: 100 },
      meridian: { openedIds: ['nham_mach', 'doi_mach'] },
      zhou_tian: { completed: 0 },
    }
    expect(validateGameSaveShape(save).ok).toBe(true)

    const save2 = validSave()
    playerOf(save2).bodyProgression = {
      body_refinement: { completedTiers: 6, currentTierProgress: 0 },
      meridian: {
        openedIds: [
          'nham_mach', 'doi_mach', 'am_kieu_mach', 'am_duy_mach',
          'duong_duy_mach', 'duong_kieu_mach', 'xung_mach', 'doc_mach',
        ],
      },
      zhou_tian: { completed: 0 },
    }
    expect(validateGameSaveShape(save2).ok).toBe(true)
  })

  // M-F-CHU-THIEN (v77) - the zhou_tian slice is required in the
  // persisted canonical set; a missing slice reports at its chapter path.
  it('từ chối save thiếu zhou_tian slice tại player.bodyProgression.zhou_tian', () => {
    const save = validSave()

    playerOf(save).bodyProgression = {
      body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      meridian: { openedIds: [] },
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.bodyProgression.zhou_tian')
  })

  // C2C-79 - fractional completed rejects through the shape layer at
  // the persisted-state path (integrity would also catch it later).
  it('từ chối zhou_tian completed không nguyên tại player.bodyProgression.zhou_tian.completed', () => {
    const save = validSave()

    playerOf(save).bodyProgression = {
      body_refinement: { completedTiers: 0, currentTierProgress: 0 },
      meridian: { openedIds: [] },
      zhou_tian: { completed: 1.5 },
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.bodyProgression.zhou_tian.completed')
  })
})

// P7-M4 (v71) - retired-key rejection lives at this shape layer; the
// mortalBasicSkillId precursor/mortal-only contract lives at the
// restore preflight (GameManagerSaveRestore.boundary.test.ts), so the
// pick cases below only assert the shape layer stays pick-agnostic.
describe('validateGameSaveShape — v71 retired skill fields', () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }

  // M-QI-05 (v73) - a learned levelled template (tram, maxLevel 3)
  // carries its canonical core grant: nodeLevels.core_tram >= 1 plus
  // purchasedNodeIds membership.
  function withSkillEntry(extra: Record<string, unknown>): Record<string, unknown> {
    const save = validSave()
    save.skills = [
      { id: 'tram', name: 'Trảm', type: 'active', level: 1, ...extra },
    ]
    ;(playerOf(save).nodeLevels as Record<string, number>).core_tram = 1
    ;(playerOf(save).purchasedNodeIds as string[]).push('core_tram')

    return save
  }

  // P7-M4 - every retired key rejects (parameterized, not just unlocked):
  // learned = SkillManager membership, roles resolve from the way kit -
  // the boundary refuses to sanitize-and-load stale loadout state.
  it.each(['loadoutSlot', 'loadoutSlots', 'equipped', 'unlocked'])(
    'từ chối skill entry mang retired key %s',
    (key) => {
      const result = validateGameSaveShape(withSkillEntry({ [key]: key === 'loadoutSlots' ? [0] : key === 'loadoutSlot' ? 0 : true }))

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain(`skills[0].${key}`)
    },
  )

  it('chấp nhận skill entry không mang retired key nào', () => {
    expect(validateGameSaveShape(withSkillEntry({})).ok).toBe(true)
  })

  it.each(['tram', 'linh_bao', 'huy_quyen'])(
    'chấp nhận mortalBasicSkillId = %s trên player chưa chọn path',
    (skillId) => {
      const save = validSave()
      playerOf(save).mortalBasicSkillId = skillId

      expect(validateGameSaveShape(save).ok).toBe(true)
    },
  )

  it('player mặc định không mang mortalBasicSkillId (absent = tram default)', () => {
    const save = validSave()

    expect(playerOf(save).mortalBasicSkillId).toBeUndefined()
    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('validateGameSaveShape — v73 core inverse ownership', () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }

  // M-QI-05 (D9f) - every owned registered core must trace to a
  // declared source: learned template, owned node's grantsSkillCoreIds,
  // or the active way's coreSkillIds. A core with no source is a state
  // no legal path produces - the boundary rejects, never repairs.
  it('từ chối core_cuong_quyen orphan (cuong_chien không được sở hữu)', () => {
    const save = validSave()
    const player = playerOf(save)

    ;(player.nodeLevels as Record<string, number>).core_cuong_quyen = 1
    ;(player.purchasedNodeIds as string[]).push('core_cuong_quyen')

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.nodeLevels.core_cuong_quyen')
  })

  it('từ chối core_tram orphan khi skills[] không có entry tram (learned-template core mất chủ)', () => {
    const save = validSave()
    const player = playerOf(save)

    save.skills = []
    ;(player.nodeLevels as Record<string, number>).core_tram = 1
    ;(player.purchasedNodeIds as string[]).push('core_tram')

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.nodeLevels.core_tram')
  })

  it('từ chối core orphan khi grant-node bị revoke nhưng core level sót lại', () => {
    const save = validSave()
    const player = playerOf(save)

    player.realmId = 'qi_refining'
    player.cultivationPath = 'body'
    player.cultivationWay = 'body_pathway'
    ;(player.nodeLevels as Record<string, number>).core_cuong_quyen = 2
    ;(player.purchasedNodeIds as string[]).push('core_cuong_quyen')

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.nodeLevels.core_cuong_quyen')
  })

  it('chấp nhận core_cuong_quyen khi cuong_chien grant-node được sở hữu (canonical + mirror)', () => {
    const save = validSave()
    const player = playerOf(save)

    // major_loan_dau gates on realm >= foundation_establishment --
    // the save-boundary canonicality replay (clean-B INT-B fix) rejects
    // owned nodes whose monotonic prereqs no longer hold, so the
    // fixture must carry a canonical realm for the grant test.
    player.realmId = 'foundation_establishment'
    player.cultivationPath = 'body'
    player.cultivationWay = 'body_pathway'

    // A real purchase writes BOTH: nodeLevels.<id> = 1 is the
    // canonical ownership; purchasedNodeIds is the mirror. The
    // forward check requires every grantsSkillCoreIds member present.
    // Beta grant seams: cuong_chien -> cuong_quyen, major_loan_dau ->
    // loan_dau. core_bat_tu_ba_the has NO beta source (parked def).
    for (const nodeId of ['cuong_chien', 'major_loan_dau']) {
      ;(player.nodeLevels as Record<string, number>)[nodeId] = 1
      ;(player.purchasedNodeIds as string[]).push(nodeId)
    }

    for (const skillId of ['cuong_quyen', 'loan_dau']) {
      const coreId = skillCoreNodeId(skillId)
      ;(player.nodeLevels as Record<string, number>)[coreId] = 1
      ;(player.purchasedNodeIds as string[]).push(coreId)
    }

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  // Ownership is canonical (D9d): nodeLevels[id] >= 1 decides - the
  // purchasedNodeIds mirror can never fabricate or hide ownership.
  it('từ chối kit-core thiếu khi cuong_chien được sở hữu canonical dù mirror sót', () => {
    const save = validSave()
    const player = playerOf(save)

    player.realmId = 'qi_refining'
    player.cultivationPath = 'body'
    player.cultivationWay = 'body_pathway'
    ;(player.nodeLevels as Record<string, number>).cuong_chien = 1

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.nodeLevels.cuong_chien')
  })

  it('từ chối cores khi cuong_chien chỉ tồn tại trong mirror (canonical absent)', () => {
    const save = validSave()
    const player = playerOf(save)

    player.realmId = 'qi_refining'
    player.cultivationPath = 'body'
    player.cultivationWay = 'body_pathway'

    // Mirror claims ownership but nodeLevels.cuong_chien is absent -
    // the grant source does not exist canonically, so every kit core
    // is an orphan (D9f).
    ;(player.purchasedNodeIds as string[]).push('cuong_chien')

    for (const skillId of ['cuong_quyen', 'loan_dau', 'bat_tu_ba_the']) {
      const coreId = skillCoreNodeId(skillId)
      ;(player.nodeLevels as Record<string, number>)[coreId] = 1
      ;(player.purchasedNodeIds as string[]).push(coreId)
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.nodeLevels.core_cuong_quyen')
  })

  // cleanD AUT: the mirror check is symmetric -- a canonical non-core
  // level without its purchasedNodeIds mirror is non-canonical by
  // construction (NodeSystem mirrors every purchase).
  it('từ chối node level canonical khi purchasedNodeIds mirror sót entry đó', () => {
    const save = validSave()
    const player = playerOf(save)

    player.realmId = 'qi_refining'
    player.cultivationPath = 'body'
    player.cultivationWay = 'body_pathway'
    ;(player.nodeLevels as Record<string, number>).cuong_chien = 1

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.nodeLevels.cuong_chien')
  })

  it('từ chối core_cuong_quyen khi skills[] chứa entry giả id cuong_quyen (không phải learned template)', () => {
    const save = validSave()
    const player = playerOf(save)

    // cuong_quyen is a native TurnSkillDefinition, not a learnable
    // Skill template - a skills[] entry cannot satisfy the learned
    // source for a native core (D9f).
    save.skills = [{ id: 'cuong_quyen', name: 'Cương Quyền', type: 'active', level: 1 }]
    ;(player.nodeLevels as Record<string, number>).core_cuong_quyen = 1
    ;(player.purchasedNodeIds as string[]).push('core_cuong_quyen')

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.nodeLevels.core_cuong_quyen')
  })
})

// M-F-COMPANION-GIFT (v77) - player.companionGifts slice: required
// array, unique nonempty ids, definitionId inside the Beta gift
// authority (not merely the full catalog), claimed boolean. Record ids
// are NOT validated against COMPANION_GIFT_MOMENTS - records outlive
// authored moments (drift tolerance).
describe('validateGameSaveShape - companion gifts (v77)', () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }

  it('chấp nhận companionGifts hợp lệ (pending + claimed)', () => {
    const save = validSave()

    playerOf(save).companionGifts = [
      { id: 'gift_than_nong_foundation_entry', definitionId: 'than_nong', claimed: false },
      { id: 'gift_khai_minh_foundation_floor_10', definitionId: 'khai_minh', claimed: true },
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('từ chối companionGifts vắng mặt / không phải array', () => {
    const save = validSave()
    const player = playerOf(save)

    delete player.companionGifts
    expect(pathsOf(validateGameSaveShape(save))).toContain('player.companionGifts')

    const save2 = validSave()
    playerOf(save2).companionGifts = 'not-an-array'
    expect(pathsOf(validateGameSaveShape(save2))).toContain('player.companionGifts')
  })

  it('từ chối record id rỗng hoặc trùng', () => {
    const save = validSave()
    playerOf(save).companionGifts = [
      { id: '', definitionId: 'than_nong', claimed: false },
    ]
    expect(pathsOf(validateGameSaveShape(save))).toContain('player.companionGifts[0].id')

    const dup = validSave()
    playerOf(dup).companionGifts = [
      { id: 'gift_a', definitionId: 'than_nong', claimed: false },
      { id: 'gift_a', definitionId: 'khai_minh', claimed: true },
    ]
    expect(pathsOf(validateGameSaveShape(dup))).toContain('player.companionGifts[1].id')
  })

  it('từ chối definitionId ngoài gift authority - kể cả catalog member thật', () => {
    const save = validSave()

    // Real COMPANIONS member but NOT a Beta gift - the acquisition
    // boundary fails loud on a persisted future-realm gift.
    playerOf(save).companionGifts = [
      { id: 'gift_x', definitionId: 'ho_ly_tinh', claimed: false },
    ]

    const result = validateGameSaveShape(save)
    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.companionGifts[0].definitionId')

    const ghost = validSave()
    playerOf(ghost).companionGifts = [
      { id: 'gift_y', definitionId: 'no_such_companion', claimed: false },
    ]
    expect(pathsOf(validateGameSaveShape(ghost))).toContain('player.companionGifts[0].definitionId')
  })

  it('từ chối claimed không phải boolean', () => {
    const save = validSave()

    playerOf(save).companionGifts = [
      { id: 'gift_x', definitionId: 'than_nong', claimed: 'yes' },
    ]

    expect(pathsOf(validateGameSaveShape(save))).toContain('player.companionGifts[0].claimed')
  })

  it('chấp nhận record id không thuộc COMPANION_GIFT_MOMENTS (drift tolerance)', () => {
    const save = validSave()

    // A save may carry records from moments since removed/renamed -
    // they stay claimable, validation must not reject them.
    playerOf(save).companionGifts = [
      { id: 'gift_retired_moment', definitionId: 'than_nong', claimed: false },
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('validateGameSaveShape — v82 seam repair cross-checks', () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }
  it('F-W-9: từ chối grantedRealmPassiveIds mồ côi không modifier sống', () => {
    const save = validSave()

    playerOf(save).grantedRealmPassiveIds = ['qi_refining']
    playerOf(save).modifiers = []

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.grantedRealmPassiveIds[0]')
  })

  it('F-W-9: từ chối grantedRealmPassiveIds chứa id không có trong registry', () => {
    const save = validSave()

    playerOf(save).grantedRealmPassiveIds = ['no_such_passive']

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.grantedRealmPassiveIds[0]')
  })

  it('F-W-9: chấp nhận marker kèm modifier sống cùng sourceId', () => {
    const save = validSave()

    playerOf(save).grantedRealmPassiveIds = ['qi_refining']
    playerOf(save).modifiers = [
      { id: 'm1', sourceId: 'nhap_dao', sourceType: 'realm', stat: 'might', flat: 2 },
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('F-W-16: từ chối autoWorkerCapacity > 0 khi không có chi_hien_quan', () => {
    const save = validSave()

    playerOf(save).autoWorkerCapacity = 5

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.autoWorkerCapacity')
  })

  it('F-W-16: chấp nhận autoWorkerCapacity > 0 khi có chi_hien_quan instance', () => {
    const save = validSave()

    playerOf(save).autoWorkerCapacity = 5
    save.buildings = [
      {
        instanceId: 'b-chq',
        buildingId: 'chi_hien_quan',
        level: 2,
        lastCollectedAt: 1_725_000_000_000,
      },
    ]

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('F-W-17: từ chối formationLoadout assignment ô ngoài cellPattern', () => {
    const save = validSave()

    playerOf(save).formationLoadout = {
      formationId: 'ngu_hanh_tran',
      assignments: [{ combatantId: 'player', row: 9, column: 9 }],
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.formationLoadout.assignments[0]')
  })

  it('F-W-17: từ chối formationLoadout combatant trùng trong đội hình', () => {
    const save = validSave()

    playerOf(save).formationLoadout = {
      formationId: 'ngu_hanh_tran',
      assignments: [
        { combatantId: 'player', row: 0, column: 0 },
        { combatantId: 'player', row: 0, column: 2 },
      ],
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.formationLoadout.assignments[1].combatantId')
  })

  it('F-W-17: từ chối formationLoadout combatant không thuộc đội', () => {
    const save = validSave()

    playerOf(save).formationLoadout = {
      formationId: 'ngu_hanh_tran',
      assignments: [{ combatantId: 'ghost_member', row: 0, column: 0 }],
    }

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.formationLoadout.assignments[0].combatantId')
  })
})
