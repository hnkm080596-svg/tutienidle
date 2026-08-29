import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from './player'
import type { GameSave } from '../services/save/SaveSystem'
import { createDefaultArtifactProgress } from '../core/artifact/ArtifactProgression'

// Bản Mệnh Pháp Bảo (doc §10.2) — restoreFromSave() phải tự sửa mọi
// invariant sai của player.artifact ngay sau blind Object.assign(),
// cùng pattern player.aiStrategy.test.ts's combatAiStrategy fallback.
function buildMinimalSave(playerOverrides: Record<string, unknown>): GameSave {
  const base = {
    name: 'Test',
    realmId: 'mortal',
    realmLevel: 1,
    cultivation: 0,
    cultivationPerSecond: 10,
    baseStats: {},
    modifiers: [],
    externalModifiers: [],
    spiritStone: 0,
    selectedTalentIds: [],
    unlockedRealmEnhancements: [],
    hasSeenTutorial: false,
    isCultivating: false,
    totalCultivationGained: 0,
    bossKillCount: 0,
    skillInsight: 0,
    totalSkillInsightGained: 0,
    attributePoints: 0,
    unlockedElements: [],
    equippedElements: [],
    purchasedNodeIds: [],
    completedStageIds: [],
    bodyRefinementCompletedTiers: 0,
    bodyRefinementCurrentTierProgress: 0,
    breakthroughGrade: 6,
    grantedRealmPassiveIds: [],
    persistentTimedEffects: [],
    lastSavedAt: Date.now(),
  }

  return { player: { ...base, ...playerOverrides } } as unknown as GameSave
}

describe('player store — artifact normalize on restore (doc §10.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Pháp Tu đã Trúc Cơ nhưng save thiếu artifact -> tự tạo default lúc load', () => {
    const store = usePlayerStore()

    store.restoreFromSave(
      buildMinimalSave({ cultivationPath: 'phap_tu', realmId: 'foundation_establishment', realmLevel: 3 }),
    )

    expect(store.artifact).toEqual(createDefaultArtifactProgress('ngu_hanh_chau'))
  })

  it('Kiếm Tu (chưa có definition) -> artifact luôn undefined dù save có state cũ', () => {
    const store = usePlayerStore()

    store.restoreFromSave(
      buildMinimalSave({
        cultivationPath: 'kiem_tu',
        realmId: 'foundation_establishment',
        artifact: createDefaultArtifactProgress('ngu_hanh_chau'),
      }),
    )

    expect(store.artifact).toBeUndefined()
  })

  it('save hợp lệ -> giữ nguyên grade/path/realm/level/exp', () => {
    const store = usePlayerStore()

    const validArtifact = {
      artifactId: 'ngu_hanh_chau',
      realmId: 'foundation_establishment',
      realmLevel: 4,
      experience: 5,
      grade: 'linh',
      selectedPath: 'defense',
    }

    store.restoreFromSave(
      buildMinimalSave({
        cultivationPath: 'phap_tu',
        realmId: 'foundation_establishment',
        realmLevel: 5,
        artifact: validArtifact,
      }),
    )

    expect(store.artifact).toEqual(validArtifact)
  })

  it('save có grade/path sai enum -> fallback pham/undefined', () => {
    const store = usePlayerStore()

    store.restoreFromSave(
      buildMinimalSave({
        cultivationPath: 'phap_tu',
        realmId: 'foundation_establishment',
        realmLevel: 5,
        artifact: {
          artifactId: 'ngu_hanh_chau',
          realmId: 'foundation_establishment',
          realmLevel: 2,
          experience: 0,
          grade: 'legendary',
          selectedPath: 'berserk',
        },
      }),
    )

    expect(store.artifact?.grade).toBe('pham')
    expect(store.artifact?.selectedPath).toBeUndefined()
  })

  it('save có artifact tầng vượt player -> clamp về đúng tầng player', () => {
    const store = usePlayerStore()

    store.restoreFromSave(
      buildMinimalSave({
        cultivationPath: 'phap_tu',
        realmId: 'foundation_establishment',
        realmLevel: 3,
        artifact: {
          artifactId: 'ngu_hanh_chau',
          realmId: 'foundation_establishment',
          realmLevel: 15,
          experience: 0,
          grade: 'pham',
        },
      }),
    )

    expect(store.artifact?.realmLevel).toBe(3)
  })

  it('Phàm Nhân/chưa chọn nghề -> artifact undefined', () => {
    const store = usePlayerStore()

    store.restoreFromSave(buildMinimalSave({}))

    expect(store.artifact).toBeUndefined()
  })
})
