import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ARTIFACT_UNLOCK_REALM_ID,
  createDefaultArtifactProgress,
} from '../artifact/ArtifactProgression'
import { createDeadEnemy, createLootTestSetup } from './battleLootTestSetup'

// Bản Mệnh Pháp Bảo (doc §6/§5.2) — drop-system (2026-09-12): Đoán Bảo
// Thạch không còn roll riêng có gate realm trong grantArtifactStoneDrop —
// nó là 1 dòng weighted trong POOL của stage table Trúc Cơ (w25/60), vắng
// mặt ở mọi bảng thấp hơn. "Gate" giờ là dữ liệu bảng, không phải `if`.
// M-F-ARTIFACT-DEFER: the authored row is RETAINED but the material
// record is domain-scoped (domainUnlockRealmId = ARTIFACT_UNLOCK_REALM_ID)
// and the material arm composes isDomainScopedAcquisitionEnabled - under
// the real window nothing delivers; the open-window positive lives in
// ReleasePolicy.artifactDeferred.test.ts.
const DOMAIN_TAGGED_STONE = {
  id: 'doan_bao_thach',
  domainUnlockRealmId: ARTIFACT_UNLOCK_REALM_ID,
}

const FOUNDATION_STAGE = {
  stageId: 'fe_5',
  requiredRealmId: 'foundation_establishment',
  floor: 5,
}

describe('BattleLootSystem — Đoán Bảo Thạch drop deferred (doc §6, M-F-ARTIFACT-DEFER)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stage dưới Trúc Cơ không rơi đá — bảng Luyện Khí không chứa nó', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0) // mọi roll trúng/draw entry đầu

    const { killEnemy, materialBag } = createLootTestSetup({
      realmId: 'qi_refining',
      stage: { stageId: 'qr_5', requiredRealmId: 'qi_refining', floor: 5 },
      materialTemplates: [DOMAIN_TAGGED_STONE, { id: 'qi_refining_ore_decade' }],
    })

    killEnemy()

    expect(materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('quái Trúc Cơ bốc trúng dòng đá (pool entry đầu) vẫn không rơi — domain chưa mở', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { killEnemy, materialBag } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialTemplates: [DOMAIN_TAGGED_STONE],
    })

    killEnemy()

    expect(materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('pool draw trượt qua đá (roll vào equipment_any) thì không rơi', () => {
    // rng 0.999 -> roll 59.94/60 -> entry cuối = equipment_any; registry
    // trống nên không có gì rơi.
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const { killEnemy, materialBag } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialTemplates: [DOMAIN_TAGGED_STONE],
    })

    killEnemy()

    expect(materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('boss extraRolls cũng không rơi — domain gate chặn trước delivery', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { killEnemy, materialBag } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialTemplates: [DOMAIN_TAGGED_STONE],
    })

    killEnemy({ isBoss: true })

    // Boss modifier = 3 extraRolls -> 4 pool draws, moi luot trung
    // doan_bao_thach - nhung domain gate tra 0.
    expect(materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('rewardGranted chặn double-grant — bag vẫn 0 (domain chưa mở)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { loot, materialBag } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialTemplates: [DOMAIN_TAGGED_STONE],
    })

    const battleEnemy = createDeadEnemy('mob')

    loot.processDefeatedEnemies([battleEnemy], null)
    // giả lập entity vẫn còn trong mảng do caller quên filter — rewardGranted đã true
    loot.processDefeatedEnemies([battleEnemy], null)

    expect(materialBag.getAmount('doan_bao_thach')).toBe(0)
  })

  it('summary.items không ghi nhận viên đá nào khi domain chưa mở', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const { killEnemy, loot } = createLootTestSetup({
      realmId: 'foundation_establishment',
      stage: FOUNDATION_STAGE,
      materialTemplates: [DOMAIN_TAGGED_STONE],
    })

    killEnemy()

    const summary = loot.getSummary()
    const stoneItem = summary.items.filter((item) => item.itemId === 'doan_bao_thach')

    expect(stoneItem).toHaveLength(0)
  })
})

describe('BattleLootSystem — EXP Bản Mệnh Pháp Bảo deferred (doc §5.2, M-F-ARTIFACT-DEFER)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('quái chết KHÔNG cấp artifact EXP khi domain chưa mở (Trúc Cơ, artifact còn dormant)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999) // pool draw trượt đá, cô lập EXP

    const { killEnemy, loot, player } = createLootTestSetup({
      realmId: 'foundation_establishment',
      rewards: { techniqueMastery: 10, spiritStone: 0 },
      stage: FOUNDATION_STAGE,
      materialTemplates: [DOMAIN_TAGGED_STONE],
    })
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    // M-F-ARTIFACT-DEFER: the persisted artifact survives dormant but the
    // EXP feed reads isArtifactDomainUnlocked(player.realmId) -> 0 at TC.
    player.realmId = 'foundation_establishment'

    killEnemy()

    expect(player.artifact?.experience).toBe(0)
    expect(loot.getSummary().artifactInsight).toBe(0)
  })

  it('không có artifact (Kiếm Tu) thì không crash, không cộng gì', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    const { killEnemy, loot } = createLootTestSetup({
      realmId: 'foundation_establishment',
      rewards: { techniqueMastery: 10, spiritStone: 0 },
      stage: FOUNDATION_STAGE,
      materialTemplates: [DOMAIN_TAGGED_STONE],
    })

    expect(() => killEnemy()).not.toThrow()
    expect(loot.getSummary().artifactInsight).toBe(0)
  })
})
