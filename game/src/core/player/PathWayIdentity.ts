import type {
  CultivationPathBaseId,
  CultivationPathId,
  PathWayId,
} from './CultivationPathKit'

// Cultivation Path Framework (spec 2026-09-16, M5) — path/way identity
// primitives extracted as a LEAF module so domain systems (NodeSystem,
// the turn-battle adapter) can resolve era-tolerant path identity
// without importing the CultivationPathKit catalog — a runtime import
// would close a cycle (Kit -> SkillSystem -> PhapTuRoutes -> NodeSystem).
//
// LEGACY_PATH_TO_WAY is the transition adapter, deleted in M7;
// CultivationPathKit re-exports it so existing consumers keep their
// import site.

// Transition adapter (deleted in M7) — every legacy 5-id path maps to
// its (base path, way) pair so existing readers keep working against
// the module catalog without knowing way ids.
export const LEGACY_PATH_TO_WAY: Readonly<
  Record<CultivationPathId, { pathId: CultivationPathBaseId; wayId: PathWayId }>
> = {
  kiem_tu: { pathId: 'kiem_tu', wayId: 'hien' },
  phap_tu: { pathId: 'phap_tu', wayId: 'ngu_hanh' },
  phap_tu_an: { pathId: 'phap_tu', wayId: 'ngo_dao' },
  the_tu: { pathId: 'the_tu', wayId: 'hien' },
  the_tu_an: { pathId: 'the_tu', wayId: 'ung_the' },
}

/**
 * Resolves any persisted path id — legacy ('the_tu_an') or base
 * ('the_tu') — to the BASE path family it belongs to. During the
 * transition both eras appear in saves and on node stamps
 * (requiredCultivationPath), so path-ownership gates compare families,
 * never raw ids. Post-M7 the map holds only base rows and this reduces
 * to the identity mapping.
 */
export function resolveBasePathId(pathId: CultivationPathId): CultivationPathBaseId {
  return LEGACY_PATH_TO_WAY[pathId].pathId
}
