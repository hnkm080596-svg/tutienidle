// P7-M5 - Luyen The chapter of the unified BodyProgression authority.
// Verbatim port of the retired BodyRefinementSystem onto the canonical
// chapter-keyed state (player.bodyProgression.body_refinement). Same
// tier-progress strategy, same mortal-pace gate, same talent-multiplier
// pipeline.
//
// P7-M-F (D1) - emission kind changed: BASE-STAT chapter. The tier gains
// are flat base-stat deltas derived on the fly by collectBaseStatDeltas
// (assembled into the pipeline base by resolvePlayerStatAssembly), NOT
// `luyen-the:` percent modifiers. scrubLegacyModifiers strips the
// retired prefix so chapter state stays the sole authority at
// invest/restore.
import { baseGainKeys, BODY_REFINEMENT_TIERS, TINH_HOA_PHAM_THE_MATERIAL_ID } from '../../../data/realm/BodyRefinement'
import { clamp } from '../../math/clamp'
import type { PlayerData } from '../../player/Player'
import type { StatType } from '../../stats/StatTypes'
import { getBodyRefinementProgressMultiplier } from '../../talent/TalentEffects'
import type { BaseStatBodyChapter, BodyProgressionIssue } from './BodyChapter'

const TOTAL_TIERS = BODY_REFINEMENT_TIERS.length
const LEGACY_MODIFIER_PREFIX = 'luyen-the:'

export function getTierCap(tierIndex: number): number {
  return BODY_REFINEMENT_TIERS[tierIndex]?.cap ?? 0
}

// Tang DANG DO (0-based, thuan theo THU TU hoan thanh) - undefined khi
// da hoan thanh ca 6 tang (khong con gi de dau tu tiep, xem
// BodyRefinementSection.vue's read-only state). KHONG xet requiredRealmLevel -
// tang tra ve co the van dang khoa theo canh gioi, xem
// isActiveTierUnlocked().
export function getActiveTierIndex(player: PlayerData): number | undefined {
  const completed = player.bodyProgression.body_refinement.completedTiers
  return completed < TOTAL_TIERS ? completed : undefined
}

// requiredRealmLevel chi pace tien do TRONG Pham Nhan (cho len dung tang
// moi duoc dau tu tang Luyen The ke) - roi Pham Nhan roi thi khong con
// tang Pham Nhan nao de cho nua (2026-08-22, cho phep tieu not Tinh
// Hoa Pham The con ton trong tui o canh gioi sau thay vi ket vinh
// vien), mo thang - chi con thu tu tuan tu (getActiveTierIndex) rang
// buoc.
export function isTierRequiredRealmLevelMet(player: PlayerData, tierIndex: number): boolean {
  if (player.realmId !== 'mortal') {
    return true
  }

  return player.realmLevel >= (BODY_REFINEMENT_TIERS[tierIndex]?.requiredRealmLevel ?? 0)
}

// Tang DANG DO da du dieu kien de dau tu chua - true neu khong con
// tang nao de dau tu (da hoan thanh ca 6), khong co gi de khoa.
export function isActiveTierUnlocked(player: PlayerData): boolean {
  const activeTierIndex = getActiveTierIndex(player)

  if (activeTierIndex === undefined) {
    return true
  }

  return isTierRequiredRealmLevelMet(player, activeTierIndex)
}

// Flat base-stat deltas for the whole chapter (D1): moi tang DA HOAN
// THANH dong gop day du baseGains; tang DANG DO scale tuyen tinh theo
// progress/cap - cung duong cong ty le voi percent emission cu, doi don
// vi tu % sang flat base stat. Derived on the fly: the persisted
// completedTiers/currentTierProgress record stays the sole authority.
function collectTierBaseStatDeltas(player: PlayerData): Partial<Record<StatType, number>> {
  const state = player.bodyProgression.body_refinement
  const deltas: Partial<Record<StatType, number>> = {}

  BODY_REFINEMENT_TIERS.forEach((tier, index) => {
    let ratio = 0

    if (index < state.completedTiers) {
      ratio = 1
    } else if (index === state.completedTiers) {
      ratio = clamp(state.currentTierProgress / tier.cap, 0, 1)
    }

    if (ratio <= 0) {
      return
    }

    for (const stat of baseGainKeys(tier.baseGains)) {
      deltas[stat] = (deltas[stat] ?? 0) + (tier.baseGains[stat] ?? 0) * ratio
    }
  })

  return deltas
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

// Bac Nhap Dao (1-6) - chot luc Le Nhap Mon (xem
// GameManager.chooseCultivationPath()) tu so tang DA HOAN THANH. Dot
// pha som du chua hoan thanh tang nao van hop le (muc V tai lieu -
// "nguoi choi khong bat buoc hoan thanh ca 6 tang"), toi thieu grade 1.
export function computeRefinementBreakthroughGrade(player: PlayerData): number {
  return clamp(player.bodyProgression.body_refinement.completedTiers, 1, TOTAL_TIERS)
}

export function getRefinementCurrentTierProgress(player: PlayerData): number {
  return player.bodyProgression.body_refinement.currentTierProgress
}

export const bodyRefinementChapter: BaseStatBodyChapter = {
  kind: 'baseStat',
  id: 'body_refinement',
  // M-QI-07 (QI-D4) - filling all 6 tiers transforms the physique
  // pham -> bao, once. The transform write itself lives in
  // BodyProgressionSystem (the dispatch authority), not here.
  physiqueAdvancement: { from: 'pham', to: 'bao' },
  legacyModifierPrefix: LEGACY_MODIFIER_PREFIX,
  currency: { bag: 'material', id: TINH_HOA_PHAM_THE_MATERIAL_ID },

  // Dau tu Tinh Hoa Pham The (dang cam trong tui) vao tang DANG DO -
  // tieu toi da `available`, KHONG vuot qua phan con thieu cua tang hien
  // tai (du thi giu lai trong tui cho luot dau tu sau, khong tu dong
  // tran sang tang ke). Tra ve so Tinh Hoa THAT SU da tieu (de op tru
  // dung so luong khoi materialBag). Does NOT rebuild modifiers - the
  // system dispatch owns the exactly-once rebuild.
  invest(player: PlayerData, available: number, _auxOwned: number): number {
    const activeTierIndex = getActiveTierIndex(player)

    if (activeTierIndex === undefined || available <= 0) {
      return 0
    }

    // requiredRealmLevel gate (2026-08-20) - chua dat tang yeu cau thi
    // KHONG duoc dau tu du da lam day tang truoc, xem
    // data/realm/BodyRefinement.ts.
    if (!isActiveTierUnlocked(player)) {
      return 0
    }

    const state = player.bodyProgression.body_refinement
    const cap = getTierCap(activeTierIndex)
    const remaining = cap - state.currentTierProgress

    if (remaining <= 0) {
      return 0
    }

    // Thien phu Luyen The Ky Tai - nhan progress truoc khi so cap (plan
    // sec.6). needed = ceil(remaining / multiplier) de multiplier > 1
    // tieu IT Tinh Hoa hon ma khong lang phi (progress clamp dung phan
    // con thieu); tra ve so Tinh Hoa THAT SU da tieu. Talent is retired
    // at catalog v4 (empty effect -> multiplier 1) - pipeline preserved.
    const multiplier = getBodyRefinementProgressMultiplier(player.selectedTalentIds)
    const needed = Math.ceil(remaining / multiplier)
    const consumed = Math.min(available, needed)
    const progress = Math.min(consumed * multiplier, remaining)

    state.currentTierProgress += progress

    if (state.currentTierProgress >= cap) {
      state.completedTiers += 1
      state.currentTierProgress = 0
    }

    return consumed
  },

  collectBaseStatDeltas(player: PlayerData): Partial<Record<StatType, number>> {
    return collectTierBaseStatDeltas(player)
  },

  // Strips the retired `luyen-the:*` modifier slice and emits nothing:
  // the base-stat chapter owns no modifier channel, so the only correct
  // "rebuild" of its old prefix is an empty one.
  scrubLegacyModifiers(player: PlayerData): void {
    player.modifiers = player.modifiers.filter(
      modifier => !modifier.id.startsWith(LEGACY_MODIFIER_PREFIX),
    )
  },

  progress(player: PlayerData): { completed: number; total: number } {
    return {
      completed: player.bodyProgression.body_refinement.completedTiers,
      total: TOTAL_TIERS,
    }
  },

  isComplete(player: PlayerData): boolean {
    return player.bodyProgression.body_refinement.completedTiers >= TOTAL_TIERS
  },

  validatePersistedState(
    slice: unknown,
    basePath: string,
    emit: (issue: BodyProgressionIssue) => void,
  ): void {
    if (!isRecord(slice)) {
      emit({ path: basePath, message: 'body_refinement chapter phai la object' })
      return
    }

    if (!isNonNegativeFiniteNumber(slice.completedTiers)) {
      emit({
        path: `${basePath}.completedTiers`,
        message: 'completedTiers phai la so khong am',
      })
    }
    if (!isNonNegativeFiniteNumber(slice.currentTierProgress)) {
      emit({
        path: `${basePath}.currentTierProgress`,
        message: 'currentTierProgress phai la so khong am',
      })
    }
  },

  integrityIssues(player: PlayerData): string[] {
    const issues: string[] = []
    const state = player.bodyProgression.body_refinement

    if (!Number.isInteger(state.completedTiers)) {
      issues.push(`body_refinement.completedTiers phai la so nguyen (nhan ${state.completedTiers})`)
    }
    if (state.completedTiers < 0 || state.completedTiers > TOTAL_TIERS) {
      issues.push(`body_refinement.completedTiers ngoai 0..${TOTAL_TIERS} (nhan ${state.completedTiers})`)
    }
    if (!Number.isFinite(state.currentTierProgress) || state.currentTierProgress < 0) {
      issues.push(`body_refinement.currentTierProgress phai la so khong am (nhan ${state.currentTierProgress})`)
    }

    if (state.completedTiers >= 0 && state.completedTiers < TOTAL_TIERS) {
      const cap = getTierCap(state.completedTiers)
      if (Number.isFinite(state.currentTierProgress) && state.currentTierProgress >= cap) {
        issues.push(`body_refinement.currentTierProgress ${state.currentTierProgress} >= cap ${cap} cua tang dang do`)
      }
    } else if (state.completedTiers === TOTAL_TIERS && state.currentTierProgress !== 0) {
      issues.push(`body_refinement.currentTierProgress phai = 0 khi da hoan thanh ${TOTAL_TIERS} tang (nhan ${state.currentTierProgress})`)
    }

    return issues
  },
}
