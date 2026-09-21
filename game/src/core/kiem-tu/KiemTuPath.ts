import type {
  CultivationPathId,
  PathStateIssue,
  PathWayDefinition,
  CultivationWayId,
} from '../player/CultivationPathKit'
import type { PlayerData } from '../player/Player'
import { freshSwordPathState, KIEM_PHO_ORB_IDS } from './KiemTuState'
import { composeRealmRewards } from '../../data/progression/RealmPassiveLadder'
import { KIEM_PHO_BUFFS } from '../../data/buff/KiemPhoBuffs'
import {
  KIEM_DAO_CASCADE_EMBLEM,
  NGU_KIEM_THUAT,
  TU_KIEM_Y_EMBLEM,
} from '../../data/skill/NguKiemDaoSkills'

// Cultivation Path Framework (spec 2026-09-16, M6) — the Kiem Tu path
// module: the two way definitions + the way membership predicates.
//
//   sword_pathway — Kiem Pho (preset-combo): the orb preset lives on
//     player.swordPath.preset; combat basics come from the KiemPho
//     dynamicBasic provider.
//   hidden_sword_pathway — Ngu Kiem Dao (hidden): ritual-only entry gated by tram Lv3,
//     permanent; combat action is provider-injected (ngu_kiem_thuat +
//     emblem slots). The Kiem Y -> Kiem Dao economy lives on the same
//     player.swordPath slice — hidden_sword_pathway was NEVER a separate path id (the old
//     swordPath.mode discriminator retired in M6; cultivationWay is the
//     discriminator now).
//
// Dependency direction: this file is a leaf — it never imports back
// into the catalog/authority. The only runtime import is the sibling
// SwordPathState slice factory (createInitialState below), so domain code
// (NodeSystem/NguKiemDao) can consume the way predicates without a
// runtime cycle.

/**
 * Structural read shape for the way predicates — PlayerData and the
 * presentation-side player slices (e.g. KiemBarPlayerState) both
 * satisfy it; the fields stay nullable because slices keep the
 * persisted `| null` convention.
 */
export interface SwordPathWayRead {
  cultivationPath?: CultivationPathId | null
  cultivationWay?: CultivationWayId | null
}

/**
 * M8 — the module-owned state-slice factory, invoked by
 * CultivationPathSystem.applyPathChoice via the module contract
 * (createInitialState). The canonical fresh player.swordPath is
 * way-agnostic: the Kiem Y / Kiem Dao fields start at hidden_sword_pathway's defaults
 * and sword_pathway simply never reads them.
 */
export function createSwordPathInitialState(player: PlayerData): void {
  player.swordPath = freshSwordPathState()
}

// ---------------------------------------------------------------------------
// P1-M6 - module-owned persisted-slice validation. The save boundary
// iterates this hook generically for EVERY save; the module owns ALL
// rules for player.swordPath: optional shape (a malformed present copy
// silently degraded sword_pathway combat - empty preset -> nextOrb NaN), and
// REQUIRED once the committed pair is sword (applyPathChoice creates
// the slice atomically; provider attach + NguKiemDao reads assume it).
// The payload is untrusted - narrow with guards, never cast.
// ---------------------------------------------------------------------------
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function validateSwordPathPersistedState(
  playerPayload: unknown,
  emit: (issue: PathStateIssue) => void,
): void {
  if (!isRecord(playerPayload)) {
    return
  }

  if (playerPayload.cultivationPath === 'sword' && playerPayload.swordPath === undefined) {
    emit({
      path: 'player.swordPath',
      message: "bắt buộc khi cultivationPath là 'sword' (applyPathChoice tạo slice nguyên tử)",
    })
  }

  const swordPath = playerPayload.swordPath

  if (swordPath === undefined) {
    return
  }

  if (!isRecord(swordPath)) {
    emit({ path: 'player.swordPath', message: 'phải là object hoặc vắng mặt' })
    return
  }

  // M6 retired swordPath.mode - a save still carrying it predates the
  // way model (or was hand-edited); reject rather than persist the
  // dead key forever.
  if ('mode' in swordPath) {
    emit({
      path: 'player.swordPath.mode',
      message: 'field đã bị retire từ v66 (cultivationWay thay thế)',
    })
  }

  const preset = swordPath.preset

  if (!Array.isArray(preset) || preset.length < 1 || preset.length > 9) {
    emit({ path: 'player.swordPath.preset', message: 'phải là array 1-9 phần tử' })
  } else {
    for (const orbId of preset) {
      if (!KIEM_PHO_ORB_IDS.some((id) => id === orbId)) {
        emit({
          path: 'player.swordPath.preset',
          message: `orb id không hợp lệ: ${String(orbId)}`,
        })
        break
      }
    }
  }

  if (!isNonNegativeFiniteNumber(swordPath.kiemY)) {
    emit({ path: 'player.swordPath.kiemY', message: 'phải là number hữu hạn >= 0' })
  }

  if (typeof swordPath.kiemDaoCount !== 'number' || !Number.isFinite(swordPath.kiemDaoCount) || swordPath.kiemDaoCount < 1) {
    emit({ path: 'player.swordPath.kiemDaoCount', message: 'phải là number hữu hạn >= 1' })
  }

  if (typeof swordPath.kiemDaoBase !== 'number' || !Number.isFinite(swordPath.kiemDaoBase) || swordPath.kiemDaoBase < 1) {
    emit({ path: 'player.swordPath.kiemDaoBase', message: 'phải là number hữu hạn >= 1' })
  }
}

/**
 * sword_pathway membership — the gate for ALL Kiem Pho machinery: the preset
 * write op (setKiemPhoPreset), the KiemPho dynamicBasic provider, the
 * preset HUD/editor surfaces, and the sword_pathway node subtree.
 *
 * Reads the RAW fields, same contract as NodeSystem.nodeWayApplies:
 * cultivationWay is authoritative once the ritual writes it. A
 * legacy-shaped player (cultivationPath only, no way) is NOT sword_pathway —
 * the gate fails closed so way machinery never runs for a state the
 * path authority did not commit.
 */
export function isSwordPathway(player: SwordPathWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'sword' && player?.cultivationWay === 'sword_pathway'
}

/**
 * hidden_sword_pathway membership — the gate for the hidden way's machinery: the
 * NguKiemDao economy (gainKiemY/grantKiemDao/merge), the
 * NguKiemDaoProvider attach, the kiemDaoBelowCap prereq, and the hidden_sword_pathway
 * node subtree. sword never had a hidden-variant path id, so a
 * single era exists: ('sword', 'hidden_sword_pathway') — the WAY id is the check.
 */
export function isHiddenSwordPathway(player: SwordPathWayRead | null | undefined): boolean {
  return player?.cultivationPath === 'sword' && player?.cultivationWay === 'hidden_sword_pathway'
}

// ---------------------------------------------------------------------------
// Way definitions — consumed by CULTIVATION_PATH_MODULES.sword.ways in
// CultivationPathKit (the catalog is the single aggregation point).
// ---------------------------------------------------------------------------

export const SWORD_PATHWAY: PathWayDefinition = {
  id: 'sword_pathway',
  pathId: 'sword',
  name: 'Kiếm Tu — Ngự Kiếm Tâm Kinh',
  element: 'metal',
  techniqueId: 'sword_control_art',
  // Kiem Tu Reimagined (spec 2026-09-15) — no authored skill grants:
  // sword_pathway basics come from the Kiem Pho orb preset (KiemPhoProvider).
  // P7-M4 — mortal precursor skills stay learned past initiation; the
  // ritual clears mortalBasicSkillId inside the commit block and the
  // mortal-only pick gate blocks re-selection post-path.
  // P7-M2 - canonical realm-entry passive ladder (delivered by
  // syncRealmPassive); the initiation passive below replaces the
  // retired ngu_kiem.innateSkillId grant.
  realmRewards: composeRealmRewards(),
  passiveSkillIds: ['passive_kiem_tam_lanh_liet'],
  // M7 — the facet declares domain OWNERSHIP only (resolveActiveWayStatDomains
  // is the authority now that the path-keyed domain map is gone); Kiem Tu
  // has no totals-driven emission channel, so collectModifiers is a no-op.
  stats: {
    domains: ['sword'],
    collectModifiers: () => [],
  },
  // P1 - sword_pathway owns the Kiem Pho preset-combo machinery: the preset write
  // op, the preset HUD/editor surfaces, and the 'kiem_pho' node-tree tag.
  capabilities: {
    static: ['sword.sword_scroll'],
  },
  // P1-M2 - the orb defs the preset composes from and the kiem_thuong
  // bleed the orbs plant; declared by reference so a def rename breaks
  // the build instead of drifting.
  ownedContent: {
    skillIds: [...KIEM_PHO_ORB_IDS, 'passive_kiem_tam_lanh_liet'],
    buffIds: KIEM_PHO_BUFFS.map((buff) => buff.id),
  },
  // P1-M3 - the preset axis lives on player.swordPath (written by
  // setKiemPhoPreset); sword_pathway owns it, hidden_sword_pathway never reads it. Data-only
  // declaration - the read lives in CultivationPathSystem.
  subpaths: {
    preset: {
      requiresCapability: 'sword.sword_scroll',
      state: 'player.swordPath.preset',
    },
  },
  // P1 - the fixed tree tag the panel renders (replaces the module
  // predicate chain selecting 'kiem_pho').
  nodeTreeTag: 'kiem_pho',
}

export const HIDDEN_SWORD_PATHWAY: PathWayDefinition = {
  id: 'hidden_sword_pathway',
  pathId: 'sword',
  name: 'Kiếm Tu Ẩn — Vạn Kiếm Quyết',
  techniqueId: 'myriad_swords_art',
  // P7-M2 - canonical realm-entry passive ladder; no initiation passive
  // (myriad_swords_art carries none).
  realmRewards: composeRealmRewards(),
  // Ritual-only entry, permanent, FREE — the exact port of the retired
  // kiem_tu_an node's skillCastCount {tram, 3} gate (reads the
  // skillLevels mirror). A mortal without tram Lv3 at the ritual can
  // never enter hidden_sword_pathway — there is no mid-progression flip any more.
  offerGate: { requiresSkillLevel: { skillId: 'tram', level: 3 } },
  // P7-M4 - same mortal-precursor contract as sword_pathway (learned
  // skills kept; pick cleared at commit; mortal-only gate).
  // M7 — same shared-domain facet as sword_pathway: 'sword', no totals-driven
  // channel.
  stats: {
    domains: ['sword'],
    collectModifiers: () => [],
  },
  // P1 - hidden_sword_pathway owns the Ngu Kiem Dao machinery: the Kiem Y -> Kiem Dao
  // economy + realm merge, the provider-injected combat action, the
  // emblem slots, and the 'ngu_kiem' node-tree tag.
  capabilities: {
    static: ['sword.sword_riding'],
  },
  // P1-M2 - the provider-injected action plus the two emblem defs the
  // combat slots carry (emblemOnly markers, never real casts).
  ownedContent: {
    skillIds: [NGU_KIEM_THUAT.id, TU_KIEM_Y_EMBLEM.id, KIEM_DAO_CASCADE_EMBLEM.id],
  },
  nodeTreeTag: 'ngu_kiem',
}
