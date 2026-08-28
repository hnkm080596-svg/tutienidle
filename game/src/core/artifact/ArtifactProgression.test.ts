import { describe, expect, it } from 'vitest'
import {
  advanceArtifactRealmLevel,
  applyArtifactExperience,
  createDefaultArtifactProgress,
  DOAN_BAO_THACH_MATERIAL_ID,
  getArtifactExpRequired,
  getArtifactExperienceReward,
  getArtifactExpStatus,
  getArtifactGradeMultiplier,
  getArtifactGradeUpgradeCost,
  getNextArtifactGrade,
  normalizeArtifactProgress,
  tryUpgradeArtifactGrade,
} from './ArtifactProgression'
import type { Enemy } from '../enemy/Enemy'
import { createDefaultPlayer } from '../player/Player'
import { MaterialBag } from '../material/MaterialBag'
import type { Material } from '../material/Material'

const DOAN_BAO_THACH: Material = {
  id: DOAN_BAO_THACH_MATERIAL_ID,
  name: 'Đoán Bảo Thạch',
  category: 'other',
  sourceType: 'monster',
  description: 'test fixture',
}

function enemyWithInsight(techniqueInsight: number, flags: Partial<Pick<Enemy, 'isElite' | 'isBoss'>> = {}) {
  return {
    rewards: { techniqueInsight, spiritStone: 0 },
    ...flags,
  } as Pick<Enemy, 'rewards' | 'isElite' | 'isBoss'>
}

describe('ArtifactProgression (doc §5)', () => {
  it('getArtifactExpRequired tăng đơn điệu theo level', () => {
    let previous = 0

    for (let level = 1; level <= 18; level++) {
      const required = getArtifactExpRequired(level)

      expect(required).toBeGreaterThan(previous)

      previous = required
    }
  })

  it('getArtifactExperienceReward: base = max(1, floor(techniqueInsight * 0.25)), elite x2, boss x5', () => {
    expect(getArtifactExperienceReward(enemyWithInsight(10))).toBe(2)
    expect(getArtifactExperienceReward(enemyWithInsight(10, { isElite: true }))).toBe(4)
    expect(getArtifactExperienceReward(enemyWithInsight(10, { isBoss: true }))).toBe(10)
    // sàn tối thiểu 1 dù techniqueInsight rất nhỏ
    expect(getArtifactExperienceReward(enemyWithInsight(0))).toBe(1)
  })

  it('bảng hệ số phẩm tra đúng thứ tự Phàm -> Tiên', () => {
    expect(getArtifactGradeMultiplier('pham')).toBe(1.0)
    expect(getArtifactGradeMultiplier('linh')).toBe(1.12)
    expect(getArtifactGradeMultiplier('dia')).toBe(1.26)
    expect(getArtifactGradeMultiplier('thien')).toBe(1.42)
    expect(getArtifactGradeMultiplier('tien')).toBe(1.6)

    expect(getArtifactGradeUpgradeCost('pham')).toBe(10)
    expect(getArtifactGradeUpgradeCost('tien')).toBeUndefined()

    expect(getNextArtifactGrade('pham')).toBe('linh')
    expect(getNextArtifactGrade('tien')).toBeUndefined()
  })

  it('createDefaultArtifactProgress: thức tỉnh ở Trúc Cơ tầng 1, EXP 0, Phàm phẩm', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')

    expect(progress).toEqual({
      artifactId: 'ngu_hanh_chau',
      realmId: 'foundation_establishment',
      realmLevel: 1,
      experience: 0,
      grade: 'pham',
      selectedPath: undefined,
    })
  })

  it('applyArtifactExperience: tự tăng tầng không tốn material, dừng đúng trần player', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')
    const required1 = getArtifactExpRequired(1)

    // Vừa đủ để tăng đúng 1 tầng, không hơn.
    applyArtifactExperience(progress, required1, 5)

    expect(progress.realmLevel).toBe(2)
    expect(progress.experience).toBe(0)
  })

  it('applyArtifactExperience: KHÔNG tăng vượt trần player, EXP bank tới đúng requirement rồi dừng', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')
    progress.realmLevel = 3

    const required3 = getArtifactExpRequired(3)

    // Player đứng yên ở tầng 3 (bằng artifact) — bơm EXP khổng lồ vẫn
    // không được vượt trần, không bank nhiều tầng.
    applyArtifactExperience(progress, required3 * 100, 3)

    expect(progress.realmLevel).toBe(3)
    expect(progress.experience).toBe(required3)
  })

  it('applyArtifactExperience: nhảy nhiều tầng liên tiếp nếu đủ EXP và trần player đủ cao', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')

    const bigAmount = getArtifactExpRequired(1) + getArtifactExpRequired(2) + getArtifactExpRequired(3)

    applyArtifactExperience(progress, bigAmount, 10)

    expect(progress.realmLevel).toBe(4)
    expect(progress.experience).toBe(0)
  })

  it('advanceArtifactRealmLevel: player vừa đột phá giải phóng ĐÚNG 1 tầng đã bank sẵn, EXP về 0', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')
    const required1 = getArtifactExpRequired(1)

    // Artifact đã chạm trần cũ (player tầng 1) với EXP đầy.
    applyArtifactExperience(progress, required1, 1)
    expect(progress.realmLevel).toBe(1)
    expect(progress.experience).toBe(required1)

    // Player vừa đột phá lên tầng 2.
    advanceArtifactRealmLevel(progress, 2)

    expect(progress.realmLevel).toBe(2)
    expect(progress.experience).toBe(0)
  })

  it('advanceArtifactRealmLevel: không đủ EXP thì không tăng, không mất EXP', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')
    progress.experience = 1

    advanceArtifactRealmLevel(progress, 5)

    expect(progress.realmLevel).toBe(1)
    expect(progress.experience).toBe(1)
  })
})

describe('getArtifactExpStatus (doc §12.1)', () => {
  it('artifact dưới trần player -> training', () => {
    expect(getArtifactExpStatus(3, 'foundation_establishment', 5)).toBe('training')
  })

  it('artifact bằng trần player (chưa 18) -> capped_by_player', () => {
    expect(getArtifactExpStatus(5, 'foundation_establishment', 5)).toBe('capped_by_player')
  })

  it('artifact tầng 18 -> content_ceiling dù player còn cao hơn', () => {
    expect(getArtifactExpStatus(18, 'foundation_establishment', 18)).toBe('content_ceiling')
  })

  it('player đã vượt qua foundation_establishment -> luôn capped_by_player (chưa content Kim Đan)', () => {
    expect(getArtifactExpStatus(10, 'golden_core', 1)).toBe('capped_by_player')
  })
})

describe('normalizeArtifactProgress (doc §10.2)', () => {
  it('Kiếm Tu (chưa có definition) luôn artifact = undefined dù save có state cũ', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'kiem_tu'
    player.realmId = 'foundation_establishment'
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')

    normalizeArtifactProgress(player)

    expect(player.artifact).toBeUndefined()
  })

  it('chưa chọn nghề (Phàm Nhân) thì artifact = undefined', () => {
    const player = createDefaultPlayer()

    normalizeArtifactProgress(player)

    expect(player.artifact).toBeUndefined()
  })

  it('Pháp Tu đã Trúc Cơ nhưng thiếu state -> tự tạo default lúc boot', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.realmId = 'foundation_establishment'
    player.realmLevel = 5

    normalizeArtifactProgress(player)

    expect(player.artifact).toEqual(createDefaultArtifactProgress('ngu_hanh_chau'))
  })

  it('Pháp Tu chưa tới Trúc Cơ thì không tạo state dù thiếu', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.realmId = 'qi_refining'

    normalizeArtifactProgress(player)

    expect(player.artifact).toBeUndefined()
  })

  it('artifactId lệch cultivationPath -> bỏ và tái thức tỉnh nếu đủ gate', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.realmId = 'foundation_establishment'
    player.artifact = { ...createDefaultArtifactProgress('ngu_hanh_chau'), artifactId: 'other' as never }

    normalizeArtifactProgress(player)

    expect(player.artifact).toEqual(createDefaultArtifactProgress('ngu_hanh_chau'))
  })

  it('grade/path sai enum -> fallback pham/undefined, không mất realm/level/exp hợp lệ', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.realmId = 'foundation_establishment'
    player.realmLevel = 5
    player.artifact = {
      artifactId: 'ngu_hanh_chau',
      realmId: 'foundation_establishment',
      realmLevel: 3,
      experience: 10,
      grade: 'invalid-grade' as never,
      selectedPath: 'invalid-path' as never,
    }

    normalizeArtifactProgress(player)

    expect(player.artifact?.grade).toBe('pham')
    expect(player.artifact?.selectedPath).toBeUndefined()
    expect(player.artifact?.realmLevel).toBe(3)
    expect(player.artifact?.experience).toBe(10)
  })

  it('realm/level của artifact không được vượt player', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.realmId = 'foundation_establishment'
    player.realmLevel = 4
    player.artifact = {
      artifactId: 'ngu_hanh_chau',
      realmId: 'foundation_establishment',
      realmLevel: 10,
      experience: 0,
      grade: 'pham',
      selectedPath: undefined,
    }

    normalizeArtifactProgress(player)

    expect(player.artifact?.realmLevel).toBe(4)
  })

  it('EXP âm/NaN -> reset 0; EXP vượt requirement -> clamp về đúng requirement', () => {
    const player = createDefaultPlayer()
    player.cultivationPath = 'phap_tu'
    player.realmId = 'foundation_establishment'
    player.realmLevel = 5
    player.artifact = {
      artifactId: 'ngu_hanh_chau',
      realmId: 'foundation_establishment',
      realmLevel: 2,
      experience: -5,
      grade: 'pham',
      selectedPath: undefined,
    }

    normalizeArtifactProgress(player)

    expect(player.artifact?.experience).toBe(0)

    player.artifact!.experience = getArtifactExpRequired(2) + 1000

    normalizeArtifactProgress(player)

    expect(player.artifact?.experience).toBe(getArtifactExpRequired(2))
  })
})

describe('tryUpgradeArtifactGrade (doc §5.3)', () => {
  it('thiếu đá không mutate gì (progress lẫn bag)', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')
    const bag = new MaterialBag()
    bag.add(DOAN_BAO_THACH, 5) // pham -> linh cần 10, thiếu

    expect(tryUpgradeArtifactGrade(progress, bag)).toBe(false)
    expect(progress.grade).toBe('pham')
    expect(bag.getAmount(DOAN_BAO_THACH_MATERIAL_ID)).toBe(5)
  })

  it('đủ đá trừ đúng và tăng đúng 1 phẩm', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')
    const bag = new MaterialBag()
    bag.add(DOAN_BAO_THACH, 10)

    expect(tryUpgradeArtifactGrade(progress, bag)).toBe(true)
    expect(progress.grade).toBe('linh')
    expect(bag.getAmount(DOAN_BAO_THACH_MATERIAL_ID)).toBe(0)
  })

  it('trừ đúng phần dư, không trừ quá cost', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')
    const bag = new MaterialBag()
    bag.add(DOAN_BAO_THACH, 30)

    tryUpgradeArtifactGrade(progress, bag)

    expect(bag.getAmount(DOAN_BAO_THACH_MATERIAL_ID)).toBe(20)
  })

  it('nâng phẩm quá tien là no-op, không lỗi, không mutate bag', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')
    progress.grade = 'tien'
    const bag = new MaterialBag()
    bag.add(DOAN_BAO_THACH, 500)

    expect(tryUpgradeArtifactGrade(progress, bag)).toBe(false)
    expect(progress.grade).toBe('tien')
    expect(bag.getAmount(DOAN_BAO_THACH_MATERIAL_ID)).toBe(500)
  })

  it('nâng phẩm liên tiếp đi đúng thứ tự Phàm -> Linh -> Địa', () => {
    const progress = createDefaultArtifactProgress('ngu_hanh_chau')
    const bag = new MaterialBag()
    bag.add(DOAN_BAO_THACH, 1000)

    tryUpgradeArtifactGrade(progress, bag)
    expect(progress.grade).toBe('linh')

    tryUpgradeArtifactGrade(progress, bag)
    expect(progress.grade).toBe('dia')
  })
})
