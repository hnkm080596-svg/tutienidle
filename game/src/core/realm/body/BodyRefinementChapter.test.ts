import { describe, expect, it } from 'vitest'

import { BODY_REFINEMENT_TIERS } from '../../../data/realm/BodyRefinement'
import { createDefaultPlayer } from '../../player/Player'
import {
  bodyRefinementChapter,
  computeRefinementBreakthroughGrade,
  getActiveTierIndex,
  getRefinementCurrentTierProgress,
  isActiveTierUnlocked,
  isTierRequiredRealmLevelMet,
} from './BodyRefinementChapter'

// Luyen The KHONG con gioi han rieng Pham Nhan (2026-08-22) - nguoi
// choi van dau tu duoc (len chi so) o canh gioi sau neu con ton Tinh
// Hoa Pham The trong tui. requiredRealmLevel (pace theo tang Pham Nhan)
// chi ap dung luc CON O Pham Nhan - xem
// BodyRefinementChapter.isTierRequiredRealmLevelMet(). Ported verbatim
// from the retired BodyRefinementSystem.test.ts onto the chapter-keyed
// canonical state (player.bodyProgression.body_refinement).
describe('BodyRefinementChapter - dau tu xuyen canh gioi', () => {
  it('con o Pham Nhan, chua du tang yeu cau (requiredRealmLevel) - van khoa nhu cu', () => {
    const player = createDefaultPlayer()

    player.realmId = 'mortal'
    player.realmLevel = 1 // tier dau (Luyen Bi) can requiredRealmLevel=2

    expect(isActiveTierUnlocked(player)).toBe(false)
    expect(bodyRefinementChapter.invest(player, 100, 0)).toBe(0)
  })

  it('roi Pham Nhan (da Le Nhap Mon) - requiredRealmLevel tu bypass, Tinh Hoa con ton van tieu duoc', () => {
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'
    player.realmLevel = 1 // KHONG dat requiredRealmLevel=2 cua Luyen Bi neu con tinh theo Pham Nhan

    expect(isActiveTierUnlocked(player)).toBe(true)

    const cap = BODY_REFINEMENT_TIERS[0]!.cap
    const consumed = bodyRefinementChapter.invest(player, cap, 0)

    expect(consumed).toBe(cap)
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(1)
  })

  it('roi Pham Nhan van giu dung thu tu tuan tu - khong nhay coc qua tang chua toi luot', () => {
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'
    player.bodyProgression.body_refinement.completedTiers = 2 // dang do tang index 2 (Luyen Cot)

    expect(getActiveTierIndex(player)).toBe(2)

    const consumed = bodyRefinementChapter.invest(player, 1, 0)

    expect(consumed).toBe(1)
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(2) // chua day, chua nhay tang
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(1)
  })

  it('da hoan thanh ca 6 tang - khong con gi de dau tu o canh gioi nao nua', () => {
    const player = createDefaultPlayer()

    player.realmId = 'foundation_establishment'
    player.bodyProgression.body_refinement.completedTiers = BODY_REFINEMENT_TIERS.length

    expect(getActiveTierIndex(player)).toBeUndefined()
    expect(isActiveTierUnlocked(player)).toBe(true)
    expect(bodyRefinementChapter.invest(player, 100, 0)).toBe(0)
  })
})

// Thien phu Luyen The Ky Tai - RETIRED o catalog v4 (spec 2026-09-03
// sec.4.4: talent khong gan 1 canh gioi). The chapter van doc
// getBodyRefinementProgressMultiplier - file nay khoa: (1) pipeline dau
// tu nen khong doi, (2) id retired khong con nhan doi progress (effect
// rong -> multiplier 1), phong duong M2 tai dung getter.
describe('BodyRefinementChapter - thien phu Luyen The Ky Tai (retired v4)', () => {
  function playerWithTalent(): ReturnType<typeof createDefaultPlayer> {
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'
    player.selectedTalentIds = ['luyen_the_ky_tai']

    return player
  }

  it('id retired - dau tu 1 Tinh Hoa chi tinh 1 progress (khong nhan doi)', () => {
    const player = playerWithTalent()

    const consumed = bodyRefinementChapter.invest(player, 1, 0)

    expect(consumed).toBe(1)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(1)
  })

  it('id retired - dau tu het cap van hoan thanh tang binh thuong', () => {
    const player = playerWithTalent()

    const cap = BODY_REFINEMENT_TIERS[0]!.cap
    const consumed = bodyRefinementChapter.invest(player, cap, 0)

    expect(consumed).toBe(cap)
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(1)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(0)
  })

  it('phan con thieu - clamp progress dung remaining, khong tran cap', () => {
    const player = playerWithTalent()

    const cap = BODY_REFINEMENT_TIERS[0]!.cap

    player.bodyProgression.body_refinement.currentTierProgress = cap - 5

    const consumed = bodyRefinementChapter.invest(player, 100, 0)

    expect(consumed).toBe(5) // khong multiplier - tieu dung phan thieu
    expect(player.bodyProgression.body_refinement.completedTiers).toBe(1)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(0)
  })

  it('khong co talent - hanh vi giu nguyen (1 Tinh Hoa = 1 progress)', () => {
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'

    const consumed = bodyRefinementChapter.invest(player, 1, 0)

    expect(consumed).toBe(1)
    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(1)
  })
})

describe('BodyRefinementChapter - chapter contract', () => {
  it('descriptor: id/prefix/currency channel', () => {
    expect(bodyRefinementChapter.id).toBe('body_refinement')
    expect(bodyRefinementChapter.modifierPrefix).toBe('luyen-the:')
    expect(bodyRefinementChapter.currency).toEqual({
      bag: 'material',
      id: 'tinh_hoa_pham_the',
    })
    expect(bodyRefinementChapter.auxCurrency).toBeUndefined()
  })

  it('invest does NOT rebuild modifiers (the system dispatch owns the rebuild)', () => {
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'
    player.modifiers = []

    bodyRefinementChapter.invest(player, 10, 0)

    expect(player.bodyProgression.body_refinement.currentTierProgress).toBe(10)
    expect(player.modifiers.filter(m => m.id.startsWith('luyen-the:'))).toHaveLength(0)
  })

  it('applyModifiers emits luyen-the:<tier>:<stat> ids - completed tiers full percent, active tier linear, rebuild idempotent', () => {
    const player = createDefaultPlayer()

    player.realmId = 'qi_refining'
    player.bodyProgression.body_refinement.completedTiers = 1
    player.bodyProgression.body_refinement.currentTierProgress =
      BODY_REFINEMENT_TIERS[1]!.cap / 2

    bodyRefinementChapter.applyModifiers(player)

    const tier0 = BODY_REFINEMENT_TIERS[0]!
    const tier1 = BODY_REFINEMENT_TIERS[1]!
    const mods = player.modifiers.filter(m => m.id.startsWith('luyen-the:'))

    for (const stat of tier0.stats) {
      const mod = mods.find(m => m.id === `luyen-the:${tier0.id}:${stat}`)
      expect(mod?.percent).toBeCloseTo(tier0.percentAtFullTier)
    }
    for (const stat of tier1.stats) {
      const mod = mods.find(m => m.id === `luyen-the:${tier1.id}:${stat}`)
      expect(mod?.percent).toBeCloseTo(tier1.percentAtFullTier * 0.5)
    }

    const firstCount = player.modifiers.length
    bodyRefinementChapter.applyModifiers(player)
    expect(player.modifiers).toHaveLength(firstCount)
  })

  it('applyModifiers clears stale luyen-the: entries not backed by state', () => {
    const player = createDefaultPlayer()

    player.modifiers = [
      {
        id: 'luyen-the:luyen_bi:defense',
        sourceId: 'luyen_bi',
        sourceType: 'realm',
        stat: 'defense',
        percent: 0.08,
      },
    ]

    bodyRefinementChapter.applyModifiers(player)

    expect(player.modifiers.filter(m => m.id.startsWith('luyen-the:'))).toHaveLength(0)
  })

  it('progress / isComplete / raw-state reads', () => {
    const player = createDefaultPlayer()

    expect(bodyRefinementChapter.progress(player)).toEqual({ completed: 0, total: 6 })
    expect(bodyRefinementChapter.isComplete(player)).toBe(false)
    expect(getRefinementCurrentTierProgress(player)).toBe(0)

    player.bodyProgression.body_refinement.completedTiers = 6

    expect(bodyRefinementChapter.progress(player)).toEqual({ completed: 6, total: 6 })
    expect(bodyRefinementChapter.isComplete(player)).toBe(true)
  })

  it('computeRefinementBreakthroughGrade clamps completed tiers to 1..6 (0 tiers -> grade 1)', () => {
    const player = createDefaultPlayer()

    expect(computeRefinementBreakthroughGrade(player)).toBe(1)

    player.bodyProgression.body_refinement.completedTiers = 3
    expect(computeRefinementBreakthroughGrade(player)).toBe(3)

    player.bodyProgression.body_refinement.completedTiers = 6
    expect(computeRefinementBreakthroughGrade(player)).toBe(6)
  })
})

describe('BodyRefinementChapter - persisted state + integrity', () => {
  it('validatePersistedState accepts the canonical slice and rejects malformed members', () => {
    const issues: { path: string; message: string }[] = []
    const emit = (issue: { path: string; message: string }) => issues.push(issue)

    bodyRefinementChapter.validatePersistedState(
      { completedTiers: 2, currentTierProgress: 10 },
      'player.bodyProgression.body_refinement',
      emit,
    )
    expect(issues).toHaveLength(0)

    bodyRefinementChapter.validatePersistedState(
      'not-a-record',
      'player.bodyProgression.body_refinement',
      emit,
    )
    bodyRefinementChapter.validatePersistedState(
      { completedTiers: 'x', currentTierProgress: -1 },
      'player.bodyProgression.body_refinement',
      emit,
    )

    const paths = issues.map(i => i.path)
    expect(paths).toContain('player.bodyProgression.body_refinement')
    expect(paths).toContain('player.bodyProgression.body_refinement.completedTiers')
    expect(paths).toContain('player.bodyProgression.body_refinement.currentTierProgress')
  })

  it('integrityIssues covers the spec sec.3.7 pinned invariant set', () => {
    const player = createDefaultPlayer()

    expect(bodyRefinementChapter.integrityIssues(player)).toHaveLength(0)

    player.bodyProgression.body_refinement.completedTiers = 1.5
    expect(bodyRefinementChapter.integrityIssues(player).length).toBeGreaterThan(0)

    player.bodyProgression.body_refinement.completedTiers = -1
    expect(bodyRefinementChapter.integrityIssues(player).length).toBeGreaterThan(0)

    player.bodyProgression.body_refinement.completedTiers = 7
    expect(bodyRefinementChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // progress >= active tier cap while incomplete
    player.bodyProgression.body_refinement.completedTiers = 0
    player.bodyProgression.body_refinement.currentTierProgress =
      BODY_REFINEMENT_TIERS[0]!.cap
    expect(bodyRefinementChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // completed all tiers but residue progress != 0
    player.bodyProgression.body_refinement.completedTiers = 6
    player.bodyProgression.body_refinement.currentTierProgress = 1
    expect(bodyRefinementChapter.integrityIssues(player).length).toBeGreaterThan(0)

    // valid mid-progress state passes
    player.bodyProgression.body_refinement.completedTiers = 2
    player.bodyProgression.body_refinement.currentTierProgress = 5
    expect(bodyRefinementChapter.integrityIssues(player)).toHaveLength(0)
  })
})
