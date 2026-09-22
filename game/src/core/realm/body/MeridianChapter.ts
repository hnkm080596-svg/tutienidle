// P7-M5 - Bat Mach chapter of the unified BodyProgression authority.
// Verbatim port of the retired MeridianSystem onto the canonical
// chapter-keyed state (player.bodyProgression.meridian.openedIds).
//
// [M13 STATUS: PARKED] - invest has no production caller (no Thong Mach
// Dan UI/gateway); the chapter contract is still fully implemented and
// tested per the M5 spec. Same one-shot sequential strategy, same
// qi_refining pace gate, same `bat-mach:` modifier emission - ownership
// moved, rules did not.
import {
  MERIDIANS,
  THIEN_DIA_CHI_KIEU_MATERIAL_ID,
  THONG_MACH_DAN_MATERIAL_ID,
} from '../../../data/realm/Meridians'
import type { PlayerData } from '../../player/Player'
import type { StatModifier } from '../../stats/StatCalculator'
import type { BodyProgressionIssue, ModifierBodyChapter } from './BodyChapter'
import { isMeridianPageUnlocked } from './MeridianPages'

const MODIFIER_PREFIX = 'bat-mach:'

// Bat Mach (spec dot-pha-loi-kiep sec.4.1a) - khac Luyen The: moi duong
// chi CHUA MO / DA MO (du nguyen lieu la thong hoan toan, khong co
// progress tung phan). Tuan tu bat buoc: duong N can du N-1 trong
// openedIds.
function nextMeridian(player: PlayerData) {
  return MERIDIANS[player.bodyProgression.meridian.openedIds.length]
}

function modifierId(meridianId: string, stat: string): string {
  return `${MODIFIER_PREFIX}${meridianId}:${stat}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const meridianChapter: ModifierBodyChapter = {
  kind: 'modifier',
  id: 'meridian',
  modifierPrefix: MODIFIER_PREFIX,
  // thong_mach_dan is a type:'material' PILL (data/pill/pills.ts) -
  // lives in pillBag, not materialBag. thien_dia_chi_kieu is a material.
  currency: { bag: 'pill', id: THONG_MACH_DAN_MATERIAL_ID },
  auxCurrency: { bag: 'material', id: THIEN_DIA_CHI_KIEU_MATERIAL_ID },

  // Dau tu Thong Mach Dan vao duong ke tiep. Tra ve so dan THAT SU da
  // tieu (0 neu khong du dieu kien/khong con duong). auxOwned chi co y
  // nghia voi duong cuoi (Ky Kinh) - cac duong khac bo qua. Does NOT
  // rebuild modifiers - the system dispatch owns the rebuild.
  invest(player: PlayerData, available: number, auxOwned: number): number {
    const next = nextMeridian(player)

    if (!next || available < next.thongMachDanCost) {
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
    if (player.realmId === next.pageRealmId && player.realmLevel < next.requiredRealmLevel) {
      return 0
    }

    if (next.requiresThienDiaChiKieu && auxOwned < 1) {
      return 0
    }

    player.bodyProgression.meridian.openedIds.push(next.id)

    return next.thongMachDanCost
  },

  applyModifiers(player: PlayerData): void {
    const opened = new Set(player.bodyProgression.meridian.openedIds)
    const rebuilt: StatModifier[] = []

    for (const meridian of MERIDIANS) {
      if (!opened.has(meridian.id)) continue
      for (const stat of meridian.stats) {
        rebuilt.push({
          id: modifierId(meridian.id, stat),
          sourceId: meridian.id,
          sourceType: 'realm',
          stat,
          percent: meridian.percentAtFullTier,
        })
      }
    }

    player.modifiers = player.modifiers.filter((m) => !m.id.startsWith(MODIFIER_PREFIX))
    player.modifiers.push(...rebuilt)
  },

  progress(player: PlayerData): { completed: number; total: number } {
    return {
      completed: player.bodyProgression.meridian.openedIds.length,
      total: MERIDIANS.length,
    }
  },

  isComplete(player: PlayerData): boolean {
    return player.bodyProgression.meridian.openedIds.length >= MERIDIANS.length
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

    if (!Array.isArray(slice.openedIds)) {
      emit({ path: `${basePath}.openedIds`, message: 'openedIds phai la array' })
      return
    }

    slice.openedIds.forEach((id, index) => {
      if (typeof id !== 'string') {
        emit({
          path: `${basePath}.openedIds[${index}]`,
          message: 'meridian id phai la string',
        })
      }
    })
  },

  // Strict-prefix rule: openedIds must be a prefix of canonical
  // MERIDIANS order - unknown ids or non-prefix order are corrupt.
  integrityIssues(player: PlayerData): string[] {
    const openedIds = player.bodyProgression.meridian.openedIds
    const issues: string[] = []

    // A non-array slice is corrupt before any ordering question - a
    // string would otherwise iterate chars, a number slip through
    // silently (undefined.length).
    if (!Array.isArray(openedIds)) {
      issues.push(`meridian.openedIds phai la array (nhan ${typeof openedIds})`)
      return issues
    }

    if (openedIds.length > MERIDIANS.length) {
      issues.push(`meridian.openedIds dai hon ${MERIDIANS.length} duong (${openedIds.length})`)
      return issues
    }

    for (let index = 0; index < openedIds.length; index++) {
      const expected = MERIDIANS[index]!.id
      const actual = openedIds[index]
      if (actual !== expected) {
        const known = MERIDIANS.some(m => m.id === actual)
        issues.push(
          known
            ? `meridian.openedIds[${index}] = '${actual}' vi pham thu tu tuan tu (ky vong '${expected}')`
            : `meridian.openedIds[${index}] = '${actual}' khong thuoc MERIDIANS`,
        )
      }
    }

    // M-E (D2) cross-field invariant: an opened meridian whose page is
    // still locked at player.realmId is a strict-prefix pass but
    // semantically impossible - realm index never decreases and the
    // invest gate makes it unreachable, so restore would otherwise
    // emit bat-mach:* modifiers on a locked page.
    for (const id of openedIds) {
      const meridian = MERIDIANS.find((m) => m.id === id)
      if (meridian && !isMeridianPageUnlocked(player, meridian.pageRealmId)) {
        issues.push(
          `meridian '${id}' da mo nhung page '${meridian.pageRealmId}' chua mo khoa o realm '${player.realmId}'`,
        )
      }
    }

    return issues
  },
}
