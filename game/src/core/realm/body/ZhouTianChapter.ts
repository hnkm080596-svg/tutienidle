// HIDDEN-C - Chu Thien (Heavenly Circuit) chapter reworked to the design
// 2026-09-23 sec.11 discrete-step track: 36 deterministic advancements
// (0/36), each advancing exactly +1 for an authored Tinh Hoa Phap The
// cost (no RNG at the normal seam) and each granting authored raw/base
// combat stats through the baseStat channel (sec.11.3 vocabulary:
// maxHp/might/defense/hpRegenPerTurn - never the five main stats, never
// a generic percentage). Capacity derives from the
// foundation_establishment realm level (2 steps/level -> 36 at Lv18);
// Tieu/Dai Chu Thien remain lore marks only, not gates.
//
// Sequentiality: the chapter declares unlocksAfterChapters: ['meridian']
// - enforced by BodyProgressionSystem.investBodyChapterState (dispatch
// authority), mirrored by isBodyChapterUnlocked, and pinned as a
// persisted-state invariant by assertBodyProgressionIntegrity.
import {
  ZHOU_TIAN_CURRENCY_MATERIAL_ID,
  ZHOU_TIAN_DAI_STEP,
  ZHOU_TIAN_REALM_ID,
  ZHOU_TIAN_STEPS_PER_REALM_LEVEL,
  ZHOU_TIAN_TIEU_STEP,
  ZHOU_TIAN_TOTAL_STEPS,
  zhouTianStepCost,
  zhouTianStepReward,
} from '../../../data/realm/ZhouTian'
import { getRealmIndex } from '../realmSystem'
import type { PlayerData } from '../../player/Player'
import type { StatType } from '../../stats/StatTypes'
import type { BaseStatBodyChapter, BodyProgressionIssue } from './BodyChapter'

const LEGACY_MODIFIER_PREFIX = 'zhou-tian:'

/** Chu Thien step capacity: 0 before Truc Co, 2*realmLevel inside the
 * foundation_establishment realm, and the full 36 once past it.
 * Fails closed on unresolved realm ids (getRealmIndex -1 -> 0). */
export function getZhouTianCapacity(player: PlayerData): number {
  const realmIndex = getRealmIndex(player.realmId)
  const zhouTianIndex = getRealmIndex(ZHOU_TIAN_REALM_ID)

  if (realmIndex < 0 || realmIndex < zhouTianIndex) {
    return 0
  }
  if (realmIndex > zhouTianIndex) {
    return ZHOU_TIAN_TOTAL_STEPS
  }

  return Math.min(
    ZHOU_TIAN_TOTAL_STEPS,
    ZHOU_TIAN_STEPS_PER_REALM_LEVEL * player.realmLevel,
  )
}

/** Tieu Chu Thien lore mark - step 18 reached (display only). */
export function isTieuChuThienReached(player: PlayerData): boolean {
  return player.bodyProgression.zhou_tian.completed >= ZHOU_TIAN_TIEU_STEP
}

/** Dai Chu Thien lore mark - step 36 = chapter complete. */
export function isDaiChuThienReached(player: PlayerData): boolean {
  return player.bodyProgression.zhou_tian.completed >= ZHOU_TIAN_DAI_STEP
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export const zhouTianChapter: BaseStatBodyChapter = {
  kind: 'baseStat',
  // M-F-BODY-CORE - authored chapter classification (the Chu Thien
  // circulation chapter); orthogonal to the emission `kind`.
  chapterKind: 'zhou_tian',
  id: 'zhou_tian',
  unlocksAfterChapters: ['meridian'],
  legacyModifierPrefix: LEGACY_MODIFIER_PREFIX,
  currency: { bag: 'material', id: ZHOU_TIAN_CURRENCY_MATERIAL_ID },

  // Dau tu Tinh Hoa Phap The vao cac nang cap Chu Thien - moi nang cap
  // deterministic +1 buoc, tieu gia cua buoc ke tiep. Chi tieu duoc toi
  // da `available` va KHONG vuot qua capacity hien tai. Tra ve tong Tinh
  // Hoa THAT SU da tieu (0 khi locked/capped/complete/khong du gia buoc).
  // No modifier rebuild here - the system dispatch owns that step.
  invest(player: PlayerData, available: number, _auxOwned: number): number {
    const state = player.bodyProgression.zhou_tian
    const capacity = getZhouTianCapacity(player)

    let remaining = available
    let consumed = 0

    while (state.completed < capacity) {
      const cost = zhouTianStepCost(state.completed)
      if (remaining < cost) {
        break
      }
      remaining -= cost
      consumed += cost
      state.completed += 1
    }

    return consumed
  },

  // Sec.11.3 - each completed step contributes its authored raw/base
  // combat-stat reward through the chapter's baseStat channel. The map
  // is derived on the fly from canonical state (never persisted).
  collectBaseStatDeltas(player: PlayerData): Partial<Record<StatType, number>> {
    const state = player.bodyProgression.zhou_tian
    const deltas: Partial<Record<StatType, number>> = {}

    for (let step = 0; step < state.completed; step++) {
      const reward = zhouTianStepReward(step)
      for (const [stat, amount] of Object.entries(reward) as [StatType, number][]) {
        deltas[stat] = (deltas[stat] ?? 0) + amount
      }
    }

    return deltas
  },

  // The chapter emits no modifiers today; the only correct "rebuild"
  // of a zhou-tian:*-prefixed slice is an empty one.
  scrubLegacyModifiers(player: PlayerData): void {
    player.modifiers = player.modifiers.filter(
      modifier => !modifier.id.startsWith(LEGACY_MODIFIER_PREFIX),
    )
  },

  progress(player: PlayerData): { completed: number; total: number } {
    return {
      completed: player.bodyProgression.zhou_tian.completed,
      total: ZHOU_TIAN_TOTAL_STEPS,
    }
  },

  isComplete(player: PlayerData): boolean {
    return isDaiChuThienReached(player)
  },

  validatePersistedState(
    slice: unknown,
    basePath: string,
    emit: (issue: BodyProgressionIssue) => void,
  ): void {
    if (!isRecord(slice)) {
      emit({ path: basePath, message: 'zhou_tian chapter phai la object' })
      return
    }

    if (!Number.isInteger(slice.completed)) {
      emit({
        path: `${basePath}.completed`,
        message: 'completed phai la so nguyen',
      })
      return
    }

    if ((slice.completed as number) < 0 || (slice.completed as number) > ZHOU_TIAN_TOTAL_STEPS) {
      emit({
        path: `${basePath}.completed`,
        message: `completed phai nam trong 0..${ZHOU_TIAN_TOTAL_STEPS}`,
      })
    }
  },

  integrityIssues(player: PlayerData): string[] {
    const issues: string[] = []
    const state = player.bodyProgression.zhou_tian

    if (!Number.isInteger(state.completed)) {
      issues.push(`zhou_tian.completed phai la so nguyen (nhan ${state.completed})`)
    }
    if (state.completed < 0 || state.completed > ZHOU_TIAN_TOTAL_STEPS) {
      issues.push(`zhou_tian.completed ngoai 0..${ZHOU_TIAN_TOTAL_STEPS} (nhan ${state.completed})`)
    }

    // Realm-capacity invariant (C2C-75 analogue): completed can never
    // exceed the capacity derivable at the player's realm (TC Lv1 -> 2);
    // a coherent-prerequisite save carrying more is still corrupt.
    const capacity = getZhouTianCapacity(player)
    if (state.completed > capacity) {
      issues.push(
        `zhou_tian.completed vuot capacity hien tai (nhan ${state.completed}, capacity ${capacity})`,
      )
    }

    return issues
  },
}
