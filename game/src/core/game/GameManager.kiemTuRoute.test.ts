import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { defineEnemy } from '../enemy/Enemy'
import { createBaseStats } from '../stats/StatBlock'
import type { CombatEntity } from '../combat/CombatEntity'
import type { EnemyDefinition } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { SKILLS } from '../../data/skill/Skills'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'

// Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y mục 1) — route
// chốt VĨNH VIỄN đúng lúc chooseCultivationPath('kiem_tu'): Huy Kiếm
// (tram) đạt Lv3 (10.000 lần trảm) → Bạt Kiếm, chưa → Kiếm Trận.
// KHÔNG còn setKiemTuRoute — mỗi route ĐÚNG 1 active skill ở slot 0.

const MINIMAL_STATS_INPUT = {
  maxHp: 100,
  attack: 0,
  attackSpeed: 1,
  movementSpeed: 60,
  attackRangeRanks: 999999,
  criticalRate: 0,
  criticalDamage: 1.5,
  armor: 0,
}

function createPlayerEntity(): CombatEntity {
  const stats = { ...createBaseStats(), attack: 0 }

  return {
    id: 'player',
    name: 'Player',
    type: 'player',
    baseStats: stats,
    stats,
    currentHp: stats.maxHp,
    maxHp: stats.maxHp,
    currentMp: stats.maxMp,
    currentSwordIntent: 0,
    currentKiemThe: 0,
    currentKiemYTemp: 0,
    currentMomentum: 0,
    currentHoaThe: 0,
    currentThoThe: 0,
    currentKimThe: 0,
    timeSinceLastBleedProc: 0,
    tuLucActive: false,
    tuLucElapsed: 0,
    tuLucDamageTakenPercent: 0,
    currentWard: 0,
    timeSinceLastHitTaken: Infinity,
    realmIndex: 0,
    x: 0,
    row: 2,
    alive: true,
  }
}

function enemyDefinition(): EnemyDefinition {
  return {
    id: 'target_dummy',
    name: 'Bia Tập',
    level: 1,
    realmId: 'mortal',
    lane: 'ground',
    statsInput: MINIMAL_STATS_INPUT,
    rewards: { techniqueInsight: 0, spiritStone: 0 },
  }
}

function setup() {
  const gameManager = new GameManager()

  gameManager.registerSkillTemplates(SKILLS)
  gameManager.registerProgressionNodes(KIEM_TU_NODES)

  return gameManager
}

// setup route-lock: Phàm Nhân realmLevel 12 (đủ điều kiện Quán Khí),
// tram đã học+trang bị sẵn như App.vue grant.
function setupMortalWithPathReady(tramTotalCasts: number) {
  const gameManager = setup()
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  player.skillCastCounts = { tram: tramTotalCasts }
  player.skillLevels = { tram: tramTotalCasts >= 10000 ? 3 : tramTotalCasts >= 1000 ? 2 : 1 }

  gameManager.learnSkill('tram')
  gameManager.skillSystem.equipToSlot('tram', 0)

  return { gameManager, player }
}

describe('GameManager — Kiếm Tu route chốt vĩnh viễn lúc chọn path', () => {
  it('tram < Lv3 → route Kiếm Trận, slot 0 = Lưỡng Nghi, tram tháo khỏi loadout', () => {
    const { gameManager, player } = setupMortalWithPathReady(999)

    expect(gameManager.chooseCultivationPath('kiem_tu', player)).toBe(true)
    expect(player.kiemTuRoute).toBe('kiem_tran')
    expect(gameManager.skillManager.getEquippedInSlot(0)?.id).toBe('kiem_tran_luong_nghi')
    expect(gameManager.skillManager.get('tram')!.equipped).toBe(false)
    expect(gameManager.skillManager.get('tram')!.loadoutSlots).toEqual([])
  })

  it('tram ≥ Lv3 (10.000 trảm) → route Bạt Kiếm, slot 0 = Bạt Kiếm Thức, tram tháo', () => {
    const { gameManager, player } = setupMortalWithPathReady(10000)

    expect(gameManager.chooseCultivationPath('kiem_tu', player)).toBe(true)
    expect(player.kiemTuRoute).toBe('bat_kiem')
    expect(gameManager.skillManager.getEquippedInSlot(0)?.id).toBe('bat_kiem_thuat')
    expect(gameManager.skillManager.get('tram')!.equipped).toBe(false)
    // Skill kit cũ (nếu từng được học trong save) không còn chỗ trong
    // loadout — mọi slot ngoài 0 trống (mỗi route 1 skill duy nhất).
    for (const slot of [1, 2, 3, 4]) {
      expect(gameManager.skillManager.getEquippedInSlot(slot)).toBeUndefined()
    }
  })

  it('setKiemTuRoute KHÔNG còn tồn tại — route vĩnh viễn sau khi chọn', () => {
    const { gameManager, player } = setupMortalWithPathReady(999)
    gameManager.chooseCultivationPath('kiem_tu', player)

    expect(
      (gameManager as unknown as { setKiemTuRoute?: unknown }).setKiemTuRoute,
    ).toBeUndefined()
  })

  it('chọn phap_tu → kiemTuRoute vẫn undefined', () => {
    const { gameManager, player } = setupMortalWithPathReady(10000)

    expect(gameManager.chooseCultivationPath('phap_tu', player)).toBe(true)
    expect(player.kiemTuRoute).toBeUndefined()
  })

  it('mua keystone trận mới tự THAY THẾ slot 0 (tiến hóa 1 skill duy nhất)', () => {
    const gameManager = setup()
    const player = createDefaultPlayer()
    player.cultivationPath = 'kiem_tu'
    player.kiemTuRoute = 'kiem_tran'
    player.skillInsight = 100
    player.realmId = 'foundation_establishment'

    // Chain thật: Lưỡng Nghi (root, cost 0) mua trước → Tam Tài thay slot 0
    expect(gameManager.purchaseNode('kiem_tran_luong_nghi', player)).toBe(true)
    expect(gameManager.skillManager.getEquippedInSlot(0)?.id).toBe('kiem_tran_luong_nghi')

    expect(gameManager.purchaseNode('kiem_tran_tam_tai', player)).toBe(true)
    expect(gameManager.skillManager.getEquippedInSlot(0)?.id).toBe('kiem_tran_tam_tai')
    expect(gameManager.skillManager.get('kiem_tran_luong_nghi')!.equipped).toBe(false)
  })
})
