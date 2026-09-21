import type {
  CultivationPathId,
  PathStateIssue,
  PathWayDefinition,
  PathWayId,
} from '../player/CultivationPathKit'
import type { PlayerData } from '../player/Player'
import { freshKiemTuState, KIEM_PHO_ORB_IDS, MORTAL_PRECURSOR_SKILL_IDS } from './KiemTuState'
import { KIEM_PHO_BUFFS } from '../../data/buff/KiemPhoBuffs'
import {
  KIEM_DAO_CASCADE_EMBLEM,
  NGU_KIEM_THUAT,
  TU_KIEM_Y_EMBLEM,
} from '../../data/skill/NguKiemDaoSkills'

// Cultivation Path Framework (spec 2026-09-16, M6) — the Kiem Tu path
// module: the two way definitions + the way membership predicates.
//
//   hien — Kiem Pho (preset-combo): the orb preset lives on
//     player.kiemTu.preset; combat basics come from the KiemPho
//     dynamicBasic provider.
//   ngu — Ngu Kiem Dao (hidden): ritual-only entry gated by tram Lv3,
//     permanent; combat action is provider-injected (ngu_kiem_thuat +
//     emblem slots). The Kiem Y -> Kiem Dao economy lives on the same
//     player.kiemTu slice — ngu was NEVER a separate path id (the old
//     kiemTu.mode discriminator retired in M6; cultivationWay is the
//     discriminator now).
//
// Dependency direction: this file is a leaf — it never imports back
// into the catalog/authority. The only runtime import is the sibling
// KiemTuState slice factory (createInitialState below), so domain code
// (NodeSystem/NguKiemDao) can consume the way predicates without a
// runtime cycle.

/**
 * Structural read shape for the way predicates — PlayerData and the
 * presentation-side player slices (e.g. KiemBarPlayerState) both
 * satisfy it; the fields stay nullable because slices keep the
 * persisted `| null` convention.
 */
export interface KiemTuWayRead {
  cultivationPath?: CultivationPathId | null
  cultivationWay?: PathWayId | null
}

/**
 * M8 — the module-owned state-slice factory, invoked by
 * CultivationPathSystem.applyPathChoice via the module contract
 * (createInitialState). The canonical fresh player.kiemTu is
 * way-agnostic: the Kiem Y / Kiem Dao fields start at ngu's defaults
 * and hien simply never reads them.
 */
export function createKiemTuInitialState(player: PlayerData): void {
  player.kiemTu = freshKiemTuState()
}

// ---------------------------------------------------------------------------
// P1-M6 - module-owned persisted-slice validation. The save boundary
// iterates this hook generically for EVERY save; the module owns ALL
// rules for player.kiemTu: optional shape (a malformed present copy
// silently degraded hien combat - empty preset -> nextOrb NaN), and
// REQUIRED once the committed pair is kiem_tu (applyPathChoice creates
// the slice atomically; provider attach + NguKiemDao reads assume it).
// The payload is untrusted - narrow with guards, never cast.
// ---------------------------------------------------------------------------
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function validateKiemTuPersistedState(
  playerPayload: unknown,
  emit: (issue: PathStateIssue) => void,
): void {
  if (!isRecord(playerPayload)) {
    return
  }

  if (playerPayload.cultivationPath === 'kiem_tu' && playerPayload.kiemTu === undefined) {
    emit({
      path: 'player.kiemTu',
      message: "bắt buộc khi cultivationPath là 'kiem_tu' (applyPathChoice tạo slice nguyên tử)",
    })
  }

  const kiemTu = playerPayload.kiemTu

  if (kiemTu === undefined) {
    return
  }

  if (!isRecord(kiemTu)) {
    emit({ path: 'player.kiemTu', message: 'phải là object hoặc vắng mặt' })
    return
  }

  // M6 retired kiemTu.mode - a save still carrying it predates the
  // way model (or was hand-edited); reject rather than persist the
  // dead key forever.
  if ('mode' in kiemTu) {
    emit({
      path: 'player.kiemTu.mode',
      message: 'field đã bị retire từ v66 (cultivationWay thay thế)',
    })
  }

  const preset = kiemTu.preset

  if (!Array.isArray(preset) || preset.length < 1 || preset.length > 9) {
    emit({ path: 'player.kiemTu.preset', message: 'phải là array 1-9 phần tử' })
  } else {
    for (const orbId of preset) {
      if (!KIEM_PHO_ORB_IDS.some((id) => id === orbId)) {
        emit({
          path: 'player.kiemTu.preset',
          message: `orb id không hợp lệ: ${String(orbId)}`,
        })
        break
      }
    }
  }

  if (!isNonNegativeFiniteNumber(kiemTu.kiemY)) {
    emit({ path: 'player.kiemTu.kiemY', message: 'phải là number hữu hạn >= 0' })
  }

  if (typeof kiemTu.kiemDaoCount !== 'number' || !Number.isFinite(kiemTu.kiemDaoCount) || kiemTu.kiemDaoCount < 1) {
    emit({ path: 'player.kiemTu.kiemDaoCount', message: 'phải là number hữu hạn >= 1' })
  }

  if (typeof kiemTu.kiemDaoBase !== 'number' || !Number.isFinite(kiemTu.kiemDaoBase) || kiemTu.kiemDaoBase < 1) {
    emit({ path: 'player.kiemTu.kiemDaoBase', message: 'phải là number hữu hạn >= 1' })
  }
}

/**
 * hien membership — the gate for ALL Kiem Pho machinery: the preset
 * write op (setKiemPhoPreset), the KiemPho dynamicBasic provider, the
 * preset HUD/editor surfaces, and the hien node subtree.
 *
 * Reads the RAW fields, same contract as NodeSystem.nodeWayApplies:
 * cultivationWay is authoritative once the ritual writes it. A
 * legacy-shaped player (cultivationPath only, no way) is NOT hien —
 * the gate fails closed so way machinery never runs for a state the
 * path authority did not commit.
 */
export function isKiemTuHien(player: KiemTuWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'kiem_tu' && player?.cultivationWay === 'hien'
}

/**
 * ngu membership — the gate for the hidden way's machinery: the
 * NguKiemDao economy (gainKiemY/grantKiemDao/merge), the
 * NguKiemDaoProvider attach, the kiemDaoBelowCap prereq, and the ngu
 * node subtree. kiem_tu never had a hidden-variant path id, so a
 * single era exists: ('kiem_tu', 'ngu') — the WAY id is the check.
 */
export function isKiemTuNgu(player: KiemTuWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'kiem_tu' && player?.cultivationWay === 'ngu'
}

// ---------------------------------------------------------------------------
// Way definitions — consumed by CULTIVATION_PATH_MODULES.kiem_tu.ways in
// CultivationPathKit (the catalog is the single aggregation point).
// ---------------------------------------------------------------------------

export const KIEM_TU_HIEN_WAY: PathWayDefinition = {
  id: 'hien',
  pathId: 'kiem_tu',
  name: 'Kiếm Tu — Ngự Kiếm Tâm Kinh',
  element: 'metal',
  techniqueId: 'ngu_kiem',
  // Kiem Tu Reimagined (spec 2026-09-15) — no authored skill grants:
  // hien basics come from the Kiem Pho orb preset (KiemPhoProvider).
  // M9 — the ritual strips the mortal precursor skills from the loadout
  // (NOT unlearn: a Pham Nhan save can still use them; the precursor
  // equip gate blocks re-equip post-path).
  unequipSkillIds: MORTAL_PRECURSOR_SKILL_IDS,
  // M7 — the facet declares domain OWNERSHIP only (resolveActiveWayStatDomains
  // is the authority now that the path-keyed domain map is gone); Kiem Tu
  // has no totals-driven emission channel, so collectModifiers is a no-op.
  stats: {
    domains: ['kiem_tu'],
    collectModifiers: () => [],
  },
  // P1 - hien owns the Kiem Pho preset-combo machinery: the preset write
  // op, the preset HUD/editor surfaces, and the 'kiem_pho' node-tree tag.
  capabilities: {
    static: ['kiem_tu.kiem_pho'],
  },
  // P1-M2 - the orb defs the preset composes from and the kiem_thuong
  // bleed the orbs plant; declared by reference so a def rename breaks
  // the build instead of drifting.
  ownedContent: {
    skillIds: KIEM_PHO_ORB_IDS,
    buffIds: KIEM_PHO_BUFFS.map((buff) => buff.id),
  },
  // P1-M3 - the preset axis lives on player.kiemTu (written by
  // setKiemPhoPreset); hien owns it, ngu never reads it. Data-only
  // declaration - the read lives in CultivationPathSystem.
  subpaths: {
    preset: {
      requiresCapability: 'kiem_tu.kiem_pho',
      state: 'player.kiemTu.preset',
    },
  },
  // P1 - the fixed tree tag the panel renders (replaces the module
  // predicate chain selecting 'kiem_pho').
  nodeTreeTag: 'kiem_pho',
}

export const KIEM_TU_NGU_WAY: PathWayDefinition = {
  id: 'ngu',
  pathId: 'kiem_tu',
  name: 'Kiếm Tu Ẩn — Vạn Kiếm Quyết',
  techniqueId: 'van_kiem_quyet',
  // Ritual-only entry, permanent, FREE — the exact port of the retired
  // kiem_tu_an node's skillCastCount {tram, 3} gate (reads the
  // skillLevels mirror). A mortal without tram Lv3 at the ritual can
  // never enter ngu — there is no mid-progression flip any more.
  offerGate: { requiresSkillLevel: { skillId: 'tram', level: 3 } },
  // M9 — same mortal-precursor strip as hien.
  unequipSkillIds: MORTAL_PRECURSOR_SKILL_IDS,
  // M7 — same shared-domain facet as hien: 'kiem_tu', no totals-driven
  // channel.
  stats: {
    domains: ['kiem_tu'],
    collectModifiers: () => [],
  },
  // P1 - ngu owns the Ngu Kiem Dao machinery: the Kiem Y -> Kiem Dao
  // economy + realm merge, the provider-injected combat action, the
  // emblem slots, and the 'ngu_kiem' node-tree tag.
  capabilities: {
    static: ['kiem_tu.ngu_kiem_dao'],
  },
  // P1-M2 - the provider-injected action plus the two emblem defs the
  // combat slots carry (emblemOnly markers, never real casts).
  ownedContent: {
    skillIds: [NGU_KIEM_THUAT.id, TU_KIEM_Y_EMBLEM.id, KIEM_DAO_CASCADE_EMBLEM.id],
  },
  nodeTreeTag: 'ngu_kiem',
}
