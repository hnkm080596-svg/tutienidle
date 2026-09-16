import { describe, expect, it } from 'vitest'
import { validateGameSaveShape } from './saveShapeValidation'
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { createDefaultPlayer } from '../../core/player/Player'
import { COMPANIONS } from '../../data/companion/Companions'

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
})

describe('validateGameSaveShape — cultivationPath / cultivationWay (v66)', () => {
  function playerOf(save: Record<string, unknown>): Record<string, unknown> {
    return save.player as Record<string, unknown>
  }

  // A post-ritual player: pair committed atomically and the realm has
  // already advanced (the ritual never leaves a mortal carrying a pair).
  function withPair(pathId: string, wayId: string): Record<string, unknown> {
    const save = validSave()
    const player = playerOf(save)

    player.realmId = 'qi_refining'
    player.cultivationPath = pathId
    player.cultivationWay = wayId
    if (pathId === 'kiem_tu') {
      player.kiemTu = { preset: ['orb_dam'], kiemY: 0, kiemDaoCount: 1, kiemDaoBase: 1 }
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
    ['kiem_tu', 'hien'],
    ['kiem_tu', 'ngu'],
    ['phap_tu', 'ngu_hanh'],
    ['phap_tu', 'ngo_dao'],
    ['the_tu', 'hien'],
    ['the_tu', 'ung_the'],
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

  it.each(['khong_ton_tai', 'ngu', '', 7, null, { id: 'phap_tu' }])(
    'từ chối cultivationPath = %j ngoài union (enum check — M0 gap)',
    (value) => {
      const save = validSave()

      playerOf(save).cultivationPath = value

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.cultivationPath')
    },
  )

  it.each(['hien', 'ngu_hanh', 'ngo_dao', 'ung_the', 'ngu', 'bat_ky_way_naotn'])(
    'từ chối cultivationWay = %s khi cultivationPath vắng mặt (pair nguyên tử)',
    (wayId) => {
      const save = validSave()

      playerOf(save).cultivationWay = wayId

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.cultivationWay')
    },
  )

  it.each(['kiem_tu', 'phap_tu', 'the_tu'])(
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
    ['kiem_tu', 'ngo_dao'],
    ['kiem_tu', 'ung_the'],
    ['phap_tu', 'hien'],
    ['the_tu', 'ngu_hanh'],
    ['phap_tu', 'bat_ky_way_naotn'],
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

    playerOf(save).cultivationPath = 'phap_tu'
    playerOf(save).cultivationWay = 'ngu_hanh'

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.cultivationPath')
  })

  it("từ chối ('kiem_tu', <way>) khi player.kiemTu vắng mặt (slice nguyên tử)", () => {
    const save = validSave()
    const player = playerOf(save)

    player.realmId = 'qi_refining'
    player.cultivationPath = 'kiem_tu'
    player.cultivationWay = 'hien'

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.kiemTu')
  })

  it.each([[7], [null], [{ id: 'hien' }], [['hien']], [true]])(
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
    playerOf(save).cultivationPath = 'phap_tu'
    playerOf(save).cultivationWay = 'ngo_dao'

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})

describe('validateGameSaveShape — phapTu atomic (element ↔ route)', () => {
  // Review round-2 (LOW): writers commit {element, route} atomically, so a
  // half-set pair is corrupt. The validator must enforce the invariant,
  // not just each field's type.
  it.each([
    [{ element: null, route: 'no' }],
    [{ element: 'fire', route: null }],
  ])('từ chối cặp lệch %j', (phapTu) => {
    const save = validSave()

    ;(save.player as Record<string, unknown>).cultivationPath = 'phap_tu'
    ;(save.player as Record<string, unknown>).phapTu = phapTu

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('player.phapTu')
  })

  it('chấp nhận {null, null} và cặp hợp lệ trên phap_tu', () => {
    for (const phapTu of [
      { element: null, route: null },
      { element: 'fire', route: 'dot' },
    ]) {
      const save = validSave()

      ;(save.player as Record<string, unknown>).realmId = 'qi_refining'
      ;(save.player as Record<string, unknown>).cultivationPath = 'phap_tu'
      ;(save.player as Record<string, unknown>).cultivationWay = 'ngu_hanh'
      ;(save.player as Record<string, unknown>).phapTu = phapTu

      expect(validateGameSaveShape(save).ok).toBe(true)
    }
  })

  it.each([
    ['kiem_tu', undefined],
    // M4+M7: element ownership is way-gated — the ngo_dao way and a
    // way-less phap_tu save both reject it.
    ['phap_tu', 'ngo_dao'],
    ['phap_tu', undefined],
  ])(
    'từ chối route/element state trên %s/%s — chỉ ngu_hanh sở hữu nó',
    (path, way) => {
      const save = validSave()

      ;(save.player as Record<string, unknown>).cultivationPath = path
      ;(save.player as Record<string, unknown>).cultivationWay = way
      ;(save.player as Record<string, unknown>).phapTu = { element: 'fire', route: 'dot' }

      const result = validateGameSaveShape(save)

      expect(result.ok).toBe(false)
      expect(pathsOf(result)).toContain('player.phapTu')
    },
  )
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
      activeCycle: validCycle(),
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

  it('từ chối activeCycle sai shape (completesAtMs non-finite)', () => {
    const save = validSave()

    save.productionSites = [
      { ...validSite(), activeCycle: { ...validCycle(), completesAtMs: 'x' } },
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(false)
    expect(pathsOf(result)).toContain('productionSites[0].activeCycle')
  })

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

  // Stat-key migration (stat-system-reimagined rename pass) — saves
  // written before the rename keep legacy keys in mainStat.stat and
  // socketed modifier copies; the boundary remaps them instead of
  // rejecting the whole save as corrupted.
  it('remaps legacy mainStat.stat keys instead of rejecting the save', () => {
    const save = validSave()
    const entry = validEquipmentEntry()

    ;(entry.mainStat as Record<string, unknown>).stat = 'attack'
    save.equipment = [entry]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const equipment = normalizedSaveOf(result).equipment as Record<string, unknown>[]

      expect((equipment[0]!.mainStat as Record<string, unknown>).stat).toBe('might')
    }
  })

  it('remaps legacy socketed modifier stat keys in equipmentSlots', () => {
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
            { id: 'tran-1_b', sourceId: 'tran-1', sourceType: 'formation', stat: 'manaRegenPerSecond', flat: 1 },
          ],
        },
      },
    ]

    const result = validateGameSaveShape(save)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const slots = normalizedSaveOf(result).equipmentSlots as Record<string, unknown>[]
      const item = slots[0]!.socketedFormation as Record<string, unknown>
      const modifiers = item.modifiers as Record<string, unknown>[]

      expect(modifiers.map((modifier) => modifier.stat)).toEqual([
        'might',
        'manaRegenPerTurn',
      ])
    }
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
    player.tribulationBonusStacks = 3
    player.nodeFreePurchaseRecord = { node_a: 2 }
    player.phaGiapCarryStacks = 4
    player.phaGiapCarryRealmId = 'qi_refining'

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it.each([
    ['cultivationOvercharge', 'player.cultivationOvercharge'],
    ['tribulationBonusStacks', 'player.tribulationBonusStacks'],
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
    ['tribulationBonusStacks', 'player.tribulationBonusStacks'],
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
