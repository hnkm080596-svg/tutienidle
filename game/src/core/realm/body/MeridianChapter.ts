// P7-M5 - Bat Mach chapter of the unified BodyProgression authority.
// Progressive-percent rework (owner rule): each meridian holds a FLOAT
// progress 0..100 in player.bodyProgression.meridian.progress; each
// invest consumes exactly 1 Thong Mach Dan and adds a uniform random
// gain inside that meridian's investGainRange (Math.random, capped at
// 100, no pity). Stats apply per 20% milestone:
// floor(progress/20) milestones -> percentAtFullTier * milestones/5.
//
// Save migration WITHOUT reset: saves keep version 87; the legacy slice
// shape { openedIds: string[] } is still accepted by
// validatePersistedState + integrityIssues and is normalized to the
// progress map at restore (see stores/player.ts) - an opened id maps to
// progress 100. All live readers go through readMeridianProgress so a
// legacy-shaped slice never reaches the rules.
import {
  MERIDIANS,
  THONG_MACH_DAN_MATERIAL_ID,
} from '../../../data/realm/Meridians'
import type { MeridianDefinition } from '../../../data/realm/Meridians'
import type { PlayerData } from '../../player/Player'
import type { StatModifier } from '../../stats/StatCalculator'
import type {
  BodyProgressionIssue,
  MeridianChapterState,
  ModifierBodyChapter,
} from './BodyChapter'
import { isMeridianPageUnlocked } from './MeridianPages'

const MODIFIER_PREFIX = 'bat-mach:'
export const MERIDIAN_FULL_PROGRESS = 100
const MILESTONE_PERCENT_STEP = 20
const MILESTONE_COUNT = 5

function modifierId(meridianId: string, stat: string): string {
  return `${MODIFIER_PREFIX}${meridianId}:${stat}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type LegacyMeridianSlice = { progress?: unknown; openedIds?: unknown }

// Accepts BOTH the canonical { progress } map and the legacy v87
// { openedIds } list (opened id -> 100). Returns null when neither
// shape is present - callers treat null as corrupt/empty.
function coerceMeridianProgress(
  slice: LegacyMeridianSlice | undefined,
): Record<string, number> | null {
  if (slice === undefined || !isRecord(slice)) {
    return slice === undefined ? {} : null
  }
  if (isRecord(slice.progress)) {
    const out: Record<string, number> = {}
    // Non-number entries are kept as NaN so integrityIssues can flag
    // them instead of silently dropping a corrupt claim.
    for (const [id, value] of Object.entries(slice.progress)) {
      out[id] = typeof value === 'number' ? value : Number.NaN
    }
    return out
  }
  if (Array.isArray(slice.openedIds)) {
    const out: Record<string, number> = {}
    for (const id of slice.openedIds) {
      if (typeof id === 'string') {
        out[id] = MERIDIAN_FULL_PROGRESS
      }
    }
    return out
  }
  return null
}

// Live read: the meridian slice's progress map (legacy openedIds
// translated on the fly). Empty map when the slice is missing/corrupt.
export function readMeridianProgress(player: PlayerData): Record<string, number> {
  return coerceMeridianProgress(player.bodyProgression.meridian) ?? {}
}

// Raw-slice variant for save-layer readers (shape validation works on
// the untyped payload before restore normalizes it).
export function readMeridianProgressSlice(slice: unknown): Record<string, number> {
  return coerceMeridianProgress(slice as LegacyMeridianSlice | undefined) ?? {}
}

// Restore seam: writes the canonical progress map into the slice when
// the persisted shape was legacy { openedIds }; no-op otherwise.
export function normalizeMeridianChapterState(
  slice: MeridianChapterState | undefined,
): void {
  if (slice === undefined) {
    return
  }
  if (!isRecord(slice.progress)) {
    slice.progress = coerceMeridianProgress(slice) ?? {}
  }
}

// Stat emission rule: floor(progress/20) milestones of 5 ->
// percentAtFullTier * milestones/5. At 100 the meridian grants the full
// percentAtFullTier; below 20% it grants nothing.
export function meridianMilestonePercent(
  meridian: MeridianDefinition,
  progress: number,
): number {
  const milestones = Math.floor(progress / MILESTONE_PERCENT_STEP)
  return (meridian.percentAtFullTier * milestones) / MILESTONE_COUNT
}

// The first not-complete meridian in canonical order is the only
// investable one (strict sequential rule).
function nextMeridianIndex(progress: Record<string, number>): number {
  return MERIDIANS.findIndex(
    (meridian) => (progress[meridian.id] ?? 0) < MERIDIAN_FULL_PROGRESS,
  )
}

export const meridianChapter: ModifierBodyChapter = {
  kind: 'modifier',
  // M-F-BODY-CORE - the authored chapter classification (progressive
  // meridian openings); orthogonal to the emission `kind`.
  chapterKind: 'meridian',
  id: 'meridian',
  modifierPrefix: MODIFIER_PREFIX,
  // thong_mach_dan is a type:'material' PILL (data/pill/pills.ts) -
  // lives in pillBag, not materialBag.
  currency: { bag: 'pill', id: THONG_MACH_DAN_MATERIAL_ID },
  // M-F-CHU-THIEN (C2C-59) - system-wide sequentiality: meridian only
  // unlocks once body_refinement completes, so the canonical chain
  // body_refinement -> meridian -> zhou_tian holds at the dispatch gate
  // and as a persisted-state invariant.
  unlocksAfterChapters: ['body_refinement'],

  // Dau tu 1 Thong Mach Dan vao duong ke tiep: cong mot gain ngau nhien
  // dong deu trong investGainRange (Math.random), clamp o 100. Tra ve
  // so dan THAT SU da tieu (0 neu khong du dieu kien/da xong het).
  // Does NOT rebuild modifiers - the system dispatch owns the rebuild.
  invest(player: PlayerData, available: number, _auxOwned: number): number {
    const state = player.bodyProgression.meridian
    // A legacy-shaped slice reaching invest (un-normalized restore,
    // direct fixture writes) is canonicalized in place first.
    normalizeMeridianChapterState(state)
    const progress = state.progress

    const index = nextMeridianIndex(progress)
    if (index < 0) {
      return 0
    }
    const next = MERIDIANS[index]!

    if (available < next.thongMachDanCost) {
      return 0
    }

    // M-E (D2) - PAGE LOCK: the next meridian's page must be unlocked
    // (player realm index >= page realm index). A mortal player can
    // never invest even with materials - previously only the parked
    // caller masked this, since the pace check below was scoped to
    // realmId === 'qi_refining'.
    if (!isMeridianPageUnlocked(player, next.pageRealmId)) {
      return 0
    }

    // Gate tang chi pace tien do TRONG page realm (pattern
    // BodyRefinementChapter.isTierRequiredRealmLevelMet) - roi page
    // realm roi thi mo thang, chi con rang buoc tuan tu. Keyed on
    // next.pageRealmId so a future page paces inside ITS realm.
    if (
      player.realmId === next.pageRealmId &&
      player.realmLevel < next.requiredRealmLevel
    ) {
      return 0
    }

    const range = next.investGainRange
    const gain = range.min + Math.random() * (range.max - range.min)
    progress[next.id] = Math.min(
      MERIDIAN_FULL_PROGRESS,
      (progress[next.id] ?? 0) + gain,
    )

    return next.thongMachDanCost
  },

  applyModifiers(player: PlayerData): void {
    const progress = readMeridianProgress(player)
    const rebuilt: StatModifier[] = []

    for (const meridian of MERIDIANS) {
      const percent = meridianMilestonePercent(
        meridian,
        progress[meridian.id] ?? 0,
      )
      if (percent <= 0) {
        continue
      }
      for (const stat of meridian.stats) {
        rebuilt.push({
          id: modifierId(meridian.id, stat),
          sourceId: meridian.id,
          sourceType: 'realm',
          stat,
          percent,
        })
      }
    }

    player.modifiers = player.modifiers.filter((m) => !m.id.startsWith(MODIFIER_PREFIX))
    player.modifiers.push(...rebuilt)
  },

  progress(player: PlayerData): { completed: number; total: number } {
    const progress = readMeridianProgress(player)
    return {
      completed: MERIDIANS.filter(
        (meridian) => (progress[meridian.id] ?? 0) >= MERIDIAN_FULL_PROGRESS,
      ).length,
      total: MERIDIANS.length,
    }
  },

  isComplete(player: PlayerData): boolean {
    const progress = readMeridianProgress(player)
    return MERIDIANS.every(
      (meridian) => (progress[meridian.id] ?? 0) >= MERIDIAN_FULL_PROGRESS,
    )
  },

  validatePersistedState(
    slice: unknown,
    basePath: string,
    emit: (issue: BodyProgressionIssue) => void,
  ): void {
    if (!isRecord(slice)) {
      emit({ path: basePath, message: 'meridian chapter phai la object' })
      return
    }

    // v87 migration: the legacy { openedIds: string[] } shape stays
    // loadable - restore normalizes it into the progress map.
    if (slice.progress === undefined && Array.isArray(slice.openedIds)) {
      slice.openedIds.forEach((id, index) => {
        if (typeof id !== 'string') {
          emit({
            path: `${basePath}.openedIds[${index}]`,
            message: 'meridian id phai la string',
          })
        }
      })
      return
    }

    if (!isRecord(slice.progress)) {
      emit({ path: `${basePath}.progress`, message: 'progress phai la record id -> so' })
      return
    }

    for (const [id, value] of Object.entries(slice.progress)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        emit({
          path: `${basePath}.progress.${id}`,
          message: 'meridian progress phai la so huu han',
        })
      }
    }
  },

  // Strict-prefix rule under the progressive model: a meridian may hold
  // progress > 0 only when every earlier meridian in canonical order is
  // at 100 - unknown ids, out-of-range values, or a progress beyond the
  // first incomplete meridian are corrupt. Legacy openedIds slices
  // (raw save payload at acceptance) are coerced first.
  integrityIssues(player: PlayerData): string[] {
    const slice = player.bodyProgression.meridian
    const issues: string[] = []

    const progress = coerceMeridianProgress(slice)
    if (progress === null) {
      issues.push(
        `meridian.progress phai la record id -> so (nhan ${typeof slice?.progress})`,
      )
      return issues
    }

    if (Object.keys(progress).length > MERIDIANS.length) {
      issues.push(
        `meridian.progress co nhieu hon ${MERIDIANS.length} duong (${Object.keys(progress).length})`,
      )
      return issues
    }

    for (const [id, value] of Object.entries(progress)) {
      const index = MERIDIANS.findIndex((meridian) => meridian.id === id)
      if (index < 0) {
        issues.push(`meridian.progress['${id}'] khong thuoc MERIDIANS`)
        continue
      }
      if (!Number.isFinite(value) || value < 0 || value > MERIDIAN_FULL_PROGRESS) {
        issues.push(
          `meridian.progress['${id}'] = ${value} ngoai khoang [0, ${MERIDIAN_FULL_PROGRESS}]`,
        )
        continue
      }
      if (value <= 0) {
        continue
      }
      const blocker = MERIDIANS.slice(0, index).find(
        (earlier) => (progress[earlier.id] ?? 0) < MERIDIAN_FULL_PROGRESS,
      )
      if (blocker !== undefined) {
        issues.push(
          `meridian '${id}' co progress ${value} nhung '${blocker.id}' moi ${progress[blocker.id] ?? 0} (vi pham tuan tu)`,
        )
      }
    }

    // M-E (D2) cross-field invariant: a progressed meridian whose page
    // is still locked at player.realmId is semantically impossible -
    // realm index never decreases and the invest gate makes it
    // unreachable, so restore would otherwise emit bat-mach:* modifiers
    // on a locked page.
    for (const meridian of MERIDIANS) {
      const value = progress[meridian.id] ?? 0
      if (value <= 0) {
        continue
      }
      if (!isMeridianPageUnlocked(player, meridian.pageRealmId)) {
        issues.push(
          `meridian '${meridian.id}' co progress nhung page '${meridian.pageRealmId}' chua mo khoa o realm '${player.realmId}'`,
        )
        continue
      }
      // F-TC15-MERIDIAN-PACING - replay the invest gate's in-page
      // realmLevel pacing: inside the meridian's own page realm, any
      // progress requires realmLevel >= requiredRealmLevel (leaving the
      // page removes the pace). A persisted progress the writer could
      // not produce is incoherent.
      if (
        player.realmId === meridian.pageRealmId &&
        player.realmLevel < meridian.requiredRealmLevel
      ) {
        issues.push(
          `meridian '${meridian.id}' co progress tai realmLevel ${player.realmLevel} thap hon moc ${meridian.requiredRealmLevel} trong page '${meridian.pageRealmId}'`,
        )
      }
    }

    return issues
  },
}
