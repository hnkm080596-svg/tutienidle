// save-shape-validation-plan.md Task 3 - luoi an toan round-trip:
// buildGameSave() that -> JSON.stringify -> JSON.parse -> validateGameSaveShape()
// phai luon ok. Bat ky field bat buoc moi nao thieu trong save (hoac
// validator qua chat voi field that) deu lam test nay do.
import { describe, expect, it } from 'vitest'
import { buildGameSave } from './SaveSystem'
import { validateGameSaveShape } from './saveShapeValidation'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import type { Material } from '../../core/material/Material'
import type { EquipmentInstance } from '../../core/equipment/EquipmentInstance'

const TEST_MATERIAL: Material = {
  id: 'round_trip_test_material',
  name: 'Round Trip Material',
  category: 'other',
  sourceType: 'monster',
}

function createBootedGameManager(): GameManager {
  const gameManager = new GameManager()

  gameManager.catalogOps.registerMaterials([TEST_MATERIAL])

  return gameManager
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

describe('SaveRoundTrip — buildGameSave() luôn qua validateGameSaveShape()', () => {
  it('save mới khởi tạo (chưa có gì) vẫn nguyên shape', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    expect(validateGameSaveShape(roundTripped)).toMatchObject({
      ok: true,
      issues: [],
      discardedEquipmentCount: 0,
    })
  })

  it('save sau thao tác đại diện (material vào túi) vẫn nguyên shape', () => {
    const gameManager = createBootedGameManager()

    gameManager.materialBag.add(TEST_MATERIAL, 42)

    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    const result = validateGameSaveShape(roundTripped)

    expect(result).toMatchObject({ ok: true, issues: [], discardedEquipmentCount: 0 })

    // Material that su di qua serialize dung shape.
    const materials = (roundTripped as { materials: Array<{ materialId: string; amount: number }> })
      .materials

    expect(materials).toContainEqual({ materialId: TEST_MATERIAL.id, amount: 42 })
  })

  // The persisted breakthrough-adjacent fields (meridian opened
  // ids inside bodyProgression since v72, hiddenBeastKills since v81,
  // hiddenPerfection since v82) must survive the JSON round-trip.
  it('các field đột phá round-trip nguyên vẹn', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    player.bodyProgression.meridian.openedIds = ['nham_mach', 'doi_mach']
    player.hiddenBeastKills = { huyet_mong: 500 }
    player.hiddenPerfection.realms.mortal = { discovered: true }

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    expect(validateGameSaveShape(roundTripped)).toMatchObject({
      ok: true,
      issues: [],
      discardedEquipmentCount: 0,
    })

    const playerData = (roundTripped as { player: typeof player }).player

    expect(playerData.bodyProgression.meridian.openedIds).toEqual(['nham_mach', 'doi_mach'])
    expect(playerData.hiddenBeastKills).toEqual({ huyet_mong: 500 })
    expect(playerData.hiddenPerfection.lineageActive).toBe(true)
    expect(playerData.hiddenPerfection.realms.mortal?.discovered).toBe(true)
  })

  // M-F-BODY-HIDDEN (v81) - the two channel-counter maps ride the same
  // detach->JSON->validate pipeline: player.hiddenBeastKills is required,
  // productionSites[].hiddenChannelCycles is optional and whitelisted
  // through the production-sites serializer + restoreStates copy.
  it('hiddenBeastKills + hiddenChannelCycles round-trip nguyên vẹn (v81)', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    player.hiddenBeastKills = { huyet_mong: 750, fixture_beast: 12 }

    const grottoSite = gameManager.productionSystem
      .getSiteDefinitions()
      .find((site) => site.kind === 'grotto')

    expect(grottoSite).toBeDefined()

    const siteState = gameManager.productionSystem.ensureSiteState(grottoSite!.siteId)
    siteState.hiddenChannelCycles = { fixture_channel: 3 }

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    expect(validateGameSaveShape(roundTripped)).toMatchObject({
      ok: true,
      issues: [],
      discardedEquipmentCount: 0,
    })

    const restored = roundTripped as {
      player: { hiddenBeastKills: Record<string, number> }
      productionSites: Array<{ siteId: string; hiddenChannelCycles?: Record<string, number> }>
    }

    expect(restored.player.hiddenBeastKills).toEqual({ huyet_mong: 750, fixture_beast: 12 })

    const restoredSite = restored.productionSites.find((site) => site.siteId === grottoSite!.siteId)
    expect(restoredSite?.hiddenChannelCycles).toEqual({ fixture_channel: 3 })
  })

  it('hiddenBeastKills sai shape (non-object / non-int value) bị từ chối', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const roundTripped = JSON.parse(JSON.stringify(save)) as {
      player: Record<string, unknown>
    }

    roundTripped.player.hiddenBeastKills = 42
    expect(validateGameSaveShape(roundTripped).ok).toBe(false)

    roundTripped.player.hiddenBeastKills = { huyet_mong: 1.5 }
    expect(validateGameSaveShape(roundTripped).ok).toBe(false)
  })

  it('hiddenBeastKills thiếu bị từ chối; luyenKhiKillsSinceBeast cũ chỉ bị whitelist ra', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const save = buildGameSave(player, gameManager)
    const roundTripped = JSON.parse(JSON.stringify(save)) as {
      player: Record<string, unknown>
    }

    delete roundTripped.player.hiddenBeastKills
    expect(validateGameSaveShape(roundTripped).ok).toBe(false)

    // A stale v54-era scalar key in an otherwise-current payload is
    // tolerated out by the key whitelist (dev phase, no migration).
    roundTripped.player.hiddenBeastKills = {}
    roundTripped.player.luyenKhiKillsSinceBeast = 500
    expect(validateGameSaveShape(roundTripped).ok).toBe(true)
  })

  it('hiddenChannelCycles sai shape bị từ chối khi có mặt', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const siteDef = gameManager.productionSystem.getSiteDefinitions()[0]
    gameManager.productionSystem.ensureSiteState(siteDef!.siteId)

    const save = buildGameSave(player, gameManager)
    const roundTripped = JSON.parse(JSON.stringify(save)) as {
      productionSites: Array<Record<string, unknown>>
    }

    const site = roundTripped.productionSites[0]
    expect(site).toBeDefined()

    site!.hiddenChannelCycles = { fixture_channel: -1 }
    expect(validateGameSaveShape(roundTripped).ok).toBe(false)

    site!.hiddenChannelCycles = 'not-a-map'
    expect(validateGameSaveShape(roundTripped).ok).toBe(false)
  })

  // P7-M5 (v72) - the chapter-keyed bodyProgression record round-trips
  // byte-faithful across default / mid-progress / complete states.
  it.each([
    {
      label: 'default',
      state: {
        body_refinement: { completedTiers: 0, currentTierProgress: 0 },
        meridian: { openedIds: [] as string[] },
        zhou_tian: { circulation: 0 },
      },
    },
    {
      label: 'mid-progress',
      state: {
        body_refinement: { completedTiers: 3, currentTierProgress: 120 },
        meridian: { openedIds: ['nham_mach', 'doi_mach'] },
        zhou_tian: { circulation: 0 },
      },
    },
    {
      label: 'complete',
      state: {
        body_refinement: { completedTiers: 6, currentTierProgress: 0 },
        meridian: {
          openedIds: [
            'nham_mach', 'doi_mach', 'am_kieu_mach', 'am_duy_mach',
            'duong_duy_mach', 'duong_kieu_mach', 'xung_mach', 'doc_mach',
          ],
        },
        zhou_tian: { circulation: 360 },
      },
    },
  ])('bodyProgression ($label) round-trip nguyen ven', ({ state }) => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    player.bodyProgression = JSON.parse(JSON.stringify(state))

    // M-QI-07 - a persisted 6/6 refinement chapter implies the
    // transform already fired; keep the fixture grade coherent.
    if (state.body_refinement.completedTiers === 6) {
      player.physiqueGrade = 'bao'
    }

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    expect(validateGameSaveShape(roundTripped)).toMatchObject({
      ok: true,
      issues: [],
      discardedEquipmentCount: 0,
    })

    const playerData = (roundTripped as { player: typeof player }).player

    expect(playerData.bodyProgression).toEqual(state)
  })

  // Cultivation Path Framework M2 (v65) - the way id persists beside the
  // legacy-effective path id; an unchosen player serializes with the key
  // absent (undefined drops out of JSON) and validates clean.
  it('cultivationPath + cultivationWay round-trip nguyên vẹn (v65)', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    expect(validateGameSaveShape(roundTripped)).toMatchObject({
      ok: true,
      issues: [],
      discardedEquipmentCount: 0,
    })

    const playerData = (roundTripped as { player: typeof player }).player

    expect(playerData.cultivationPath).toBe('spell')
    expect(playerData.cultivationWay).toBe('hidden_spell_pathway')
  })

  it('cultivationWay vắng mặt trên save chưa chọn path vẫn hợp lệ', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const roundTripped: unknown = JSON.parse(JSON.stringify(buildGameSave(player, gameManager)))
    const result = validateGameSaveShape(roundTripped)

    expect(result).toMatchObject({ ok: true, issues: [] })

    const playerData = (roundTripped as { player: Record<string, unknown> }).player
    expect('cultivationWay' in playerData).toBe(false)
  })

  // M-F-TALENT (v76) - a save taken mid-decision (entitlement still
  // pending + an upgraded talent level) round-trips both records so the
  // reload re-presents the SAME bound offers - no reroll, no loss.
  it('pendingTalentEntitlement + talentLevels round-trip nguyên vẹn (v76, reload mid-decision)', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    player.realmId = 'foundation_establishment'
    player.selectedTalentIds = ['pham_nhan_chi_cot', 'lk_dung_nap']
    player.talentLevels = { lk_dung_nap: 2 }
    player.pendingTalentEntitlement = {
      realmId: 'foundation_establishment',
      offeredTalentIds: ['tc_dia_can', 'tc_kim_lan', 'tc_truc_hon'],
    }

    const save = buildGameSave(player, gameManager)
    const roundTripped: unknown = JSON.parse(JSON.stringify(save))

    expect(validateGameSaveShape(roundTripped)).toMatchObject({
      ok: true,
      issues: [],
      discardedEquipmentCount: 0,
    })

    const playerData = (roundTripped as { player: typeof player }).player

    expect(playerData.talentLevels).toEqual({ lk_dung_nap: 2 })
    expect(playerData.pendingTalentEntitlement).toEqual({
      realmId: 'foundation_establishment',
      offeredTalentIds: ['tc_dia_can', 'tc_kim_lan', 'tc_truc_hon'],
    })
  })

  it('pendingTalentEntitlement vắng mặt trên save đã resolve vẫn hợp lệ', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()

    const roundTripped: unknown = JSON.parse(JSON.stringify(buildGameSave(player, gameManager)))
    const result = validateGameSaveShape(roundTripped)

    expect(result).toMatchObject({ ok: true, issues: [] })

    const playerData = (roundTripped as { player: Record<string, unknown> }).player
    expect('pendingTalentEntitlement' in playerData).toBe(false)
  })

  it('save có equipment schema mới round-trip qua validator', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()
    const instance: EquipmentInstance = {
      instanceId: 'round-trip-equipment',
      itemId: 'round-trip-sword',
      slot: 'weapon',
      equipped: false,
      grade: 'cuu_pham',
      quality: 'hoang',
      forgeUsesTotal: 6,
      forgeUsesRemaining: 4,
      mainStat: {
        id: 'round-trip-main-stat',
        sourceId: 'round-trip-sword',
        sourceType: 'equipment',
        stat: 'might',
        flat: 2,
      },
      affixes: [],
    }

    gameManager.equipmentBag.add(instance)

    const roundTripped: unknown = JSON.parse(JSON.stringify(buildGameSave(player, gameManager)))
    const result = validateGameSaveShape(roundTripped)

    expect(result).toMatchObject({ ok: true, issues: [], discardedEquipmentCount: 0 })
    if (result.ok) {
      expect(normalizedSaveOf(result).equipment).toEqual([instance])
    }
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'affix value không hữu hạn %s serialize thành null nhưng current save vẫn bị từ chối',
    (invalidValue) => {
      const gameManager = createBootedGameManager()
      const player = createDefaultPlayer()
      const instance: EquipmentInstance = {
        instanceId: 'invalid-affix-round-trip',
        itemId: 'round-trip-sword',
        slot: 'weapon',
        equipped: false,
        grade: 'cuu_pham',
        quality: 'hoang',
        forgeUsesTotal: 5,
        forgeUsesRemaining: 5,
        mainStat: {
          id: 'invalid-affix-main-stat',
          sourceId: 'invalid-affix-round-trip',
          sourceType: 'equipment',
          stat: 'might',
          flat: 2,
        },
        affixes: [{ affixId: 'prefix_attack', tier: 2, value: invalidValue }],
      }
      gameManager.equipmentBag.add(instance)

      const roundTripped = JSON.parse(JSON.stringify(buildGameSave(player, gameManager))) as {
        equipment: Array<{ affixes: Array<{ value: unknown }> }>
      }
      expect(roundTripped.equipment[0]!.affixes[0]!.value).toBeNull()

      const result = validateGameSaveShape(roundTripped)
      expect(result.ok).toBe(false)
      expect(result.issues.map((issue) => issue.path)).toContain(
        'equipment[0].affixes[0].value',
      )
    },
  )

  it.each([
    ['equipment entry', 'equipment'],
    ['equipmentSlots entry', 'equipmentSlots'],
  ] as const)('%s có slot lạ bị từ chối sau JSON round-trip', (_case, collection) => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()
    const instance: EquipmentInstance = {
      instanceId: 'invalid-slot-round-trip',
      itemId: 'round-trip-sword',
      slot: 'weapon',
      equipped: false,
      grade: 'cuu_pham',
      quality: 'hoang',
      forgeUsesTotal: 6,
      forgeUsesRemaining: 6,
      mainStat: {
        id: 'invalid-slot-main-stat',
        sourceId: 'invalid-slot-round-trip',
        sourceType: 'equipment',
        stat: 'might',
        flat: 2,
      },
      affixes: [],
    }
    gameManager.equipmentBag.add(instance)

    const roundTripped = JSON.parse(JSON.stringify(buildGameSave(player, gameManager))) as {
      equipment: Array<{ slot: unknown }>
      equipmentSlots: Array<{ slot: unknown }>
    }
    roundTripped[collection][0]!.slot = 'not-an-equipment-slot'

    const result = validateGameSaveShape(roundTripped)

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.path)).toContain(`${collection}[0].slot`)
  })

  // QA deep audit (M-F-COMPANION-GIFT): issued gift records must ride
  // the same detach->JSON->validate pipeline as every other player
  // slice - a dropped field here silently loses an issued gift.
  it('issued companion gift records round-trip với shape hợp lệ', () => {
    const gameManager = createBootedGameManager()
    const player = createDefaultPlayer()
    player.realmId = 'foundation_establishment'
    player.companionGifts.push(
      {
        id: 'gift_than_nong_foundation_entry',
        definitionId: 'than_nong',
        claimed: false,
      },
      {
        id: 'gift_khai_minh_foundation_floor_10',
        definitionId: 'khai_minh',
        claimed: true,
      },
    )

    const roundTripped: unknown = JSON.parse(
      JSON.stringify(buildGameSave(player, gameManager)),
    )

    const result = validateGameSaveShape(roundTripped)
    expect(result).toMatchObject({ ok: true, issues: [] })

    const restored = roundTripped as {
      player: { companionGifts: Array<Record<string, unknown>> }
    }
    expect(restored.player.companionGifts).toEqual([
      {
        id: 'gift_than_nong_foundation_entry',
        definitionId: 'than_nong',
        claimed: false,
      },
      {
        id: 'gift_khai_minh_foundation_floor_10',
        definitionId: 'khai_minh',
        claimed: true,
      },
    ])
  })
})
