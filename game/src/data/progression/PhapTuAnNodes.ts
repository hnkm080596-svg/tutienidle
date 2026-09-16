import type { ProgressionNode } from '../../core/progression/ProgressionNode'

// Phap Tu Reimagined (Task 7) — Phap Tu An is a separate
// CultivationPathId with its own skill tree, deliberately deferred:
// the deeper tree gets its own spec (design doc §5.3). This stub keeps
// the path's registry mapping explicit instead of falling back to the
// hien tree.
//
// Cultivation Path Framework (M4) — phap_tu_an is now the 'ngo_dao'
// WAY of base path 'phap_tu', and the way owns no progression nodes:
// its power is the fixed three-skill kit (PHAP_TU_AN_REQUIRED_SKILLS)
// plus the shared phap_tu stat domain. The ordinary tree is stamped
// requiredWay 'ngu_hanh' (PhapTuNodes.ts), so this registry entry
// stays empty by design — if a deeper Ngo Dao tree ever lands it
// would be stamped requiredWay 'ngo_dao' on the same base path.
export const PHAP_TU_AN_NODES: ProgressionNode[] = []
