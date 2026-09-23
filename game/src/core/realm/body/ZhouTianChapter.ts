// M-F-CHU-THIEN - Chu Thien (Heavenly Circuit) chapter, the Truc Co
// normal-Body track of the unified BodyProgression authority. One
// scalar state (circulation), capacity derived from the
// foundation_establishment realm level (20/level -> 180 Tieu at Lv9,
// 360 Dai at Lv18 = normal completion; 361+ does not exist).
//
// Sequentiality: the chapter declares unlocksAfterChapters: ['meridian']
// - enforced by BodyProgressionSystem.investBodyChapterState (dispatch
// authority), mirrored by isBodyChapterUnlocked, and pinned as a
// persisted-state invariant by assertBodyProgressionIntegrity.
//
// Emission kind: baseStat with an EMPTY delta map - the mechanism is
// the mission, stat values are content-deferred (no invest costs,
// per-invest amounts, or stat values authored here).
import {
  ZHOU_TIAN_CAPACITY_PER_REALM_LEVEL,
  ZHOU_TIAN_CURRENCY_MATERIAL_ID,
  ZHOU_TIAN_DAI_CIRCULATION,
  ZHOU_TIAN_REALM_ID,
  ZHOU_TIAN_TIEU_CIRCULATION,
} from '../../../data/realm/ZhouTian'
import { getRealmIndex } from '../realmSystem'
import type { PlayerData } from '../../player/Player'
import type { StatType } from '../../stats/StatTypes'
import type { BaseStatBodyChapter, BodyProgressionIssue } from './BodyChapter'

const LEGACY_MODIFIER_PREFIX = 'zhou-tian:'

/** Chu Thien capacity: 0 before Truc Co, 20*realmLevel inside the
 * foundation_establishment realm, and the full 360 once past it.
 * Fails closed on unresolved realm ids (getRealmIndex -1 -> 0). */
export function getZhouTianCapacity(player: PlayerData): number {
  const realmIndex = getRealmIndex(player.realmId)
  const zhouTianIndex = getRealmIndex(ZHOU_TIAN_REALM_ID)

  if (realmIndex < 0 || realmIndex < zhouTianIndex) {
    return 0
  }
  if (realmIndex > zhouTianIndex) {
    return ZHOU_TIAN_DAI_CIRCULATION
  }

  return Math.min(
    ZHOU_TIAN_DAI_CIRCULATION,
    ZHOU_TIAN_CAPACITY_PER_REALM_LEVEL * player.realmLevel,
  )
}

/** Tieu Chu Thien milestone - circulation reached 180. */
export function isTieuChuThienReached(player: PlayerData): boolean {
  return player.bodyProgression.zhou_tian.circulation >= ZHOU_TIAN_TIEU_CIRCULATION
}

/** Dai Chu Thien milestone - circulation reached 360 = chapter complete. */
export function isDaiChuThienReached(player: PlayerData): boolean {
  return player.bodyProgression.zhou_tian.circulation >= ZHOU_TIAN_DAI_CIRCULATION
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export const zhouTianChapter: BaseStatBodyChapter = {
  kind: 'baseStat',
  // M-F-CHU-THIEN - authored chapter classification (the Chu Thien
  // circulation chapter); orthogonal to the emission `kind`.
  chapterKind: 'zhou_tian',
  id: 'zhou_tian',
  unlocksAfterChapters: ['meridian'],
  legacyModifierPrefix: LEGACY_MODIFIER_PREFIX,
  currency: { bag: 'material', id: ZHOU_TIAN_CURRENCY_MATERIAL_ID },

  // Dau tu Tinh Hoa Phap The vao circulation - tieu toi da `available`,
  // KHONG vuot qua capacity hien tai (clamped to the realm-derived cap).
  // Tra ve so Tinh Hoa THAT SU da tieu (0 khi locked/capped/complete).
  // No modifier rebuild here - the system dispatch owns that step.
  invest(player: PlayerData, available: number, _auxOwned: number): number {
    const state = player.bodyProgression.zhou_tian
    const capacity = getZhouTianCapacity(player)
    const remaining = capacity - state.circulation

    if (available <= 0 || remaining <= 0) {
      return 0
    }

    const consumed = Math.min(available, remaining)
    state.circulation += consumed
    return consumed
  },

  // Mechanism-only chapter: the base-stat channel is reserved for the
  // circulation's gains, but no stat values are authored yet
  // (content-deferred) - the delta map is intentionally empty.
  collectBaseStatDeltas(_player: PlayerData): Partial<Record<StatType, number>> {
    return {}
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
      completed: player.bodyProgression.zhou_tian.circulation,
      total: ZHOU_TIAN_DAI_CIRCULATION,
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

    if (!Number.isFinite(slice.circulation) || (slice.circulation as number) < 0) {
      emit({
        path: `${basePath}.circulation`,
        message: 'circulation phai la so khong am',
      })
    }
  },

  integrityIssues(player: PlayerData): string[] {
    const issues: string[] = []
    const state = player.bodyProgression.zhou_tian

    if (!Number.isInteger(state.circulation)) {
      issues.push(`zhou_tian.circulation phai la so nguyen (nhan ${state.circulation})`)
    }
    if (state.circulation < 0 || state.circulation > ZHOU_TIAN_DAI_CIRCULATION) {
      issues.push(`zhou_tian.circulation ngoai 0..${ZHOU_TIAN_DAI_CIRCULATION} (nhan ${state.circulation})`)
    }

    return issues
  },
}
