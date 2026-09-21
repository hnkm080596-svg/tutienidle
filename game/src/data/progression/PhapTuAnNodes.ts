import type { ProgressionNode } from '../../core/progression/ProgressionNode'

// Phap Tu Reimagined (Task 7) — Phap Tu An is a separate
// CultivationPathId with its own skill tree, deliberately deferred:
// the deeper tree gets its own spec (design doc §5.3). This stub keeps
// the path's registry mapping explicit instead of falling back to the
// hien tree.
//
// Cultivation Path Framework (M4) — hidden_spell_pathway is now the 'hidden_spell_pathway'
// WAY of base path 'spell', and the way owns no progression nodes:
// its power is the fixed three-skill kit (HIDDEN_SPELL_REQUIRED_SKILLS)
// plus the shared spell stat domain. The ordinary tree is stamped
// requiredWay 'spell_pathway' (PhapTuNodes.ts), so this registry entry
// stays empty by design — if a deeper Ngo Dao tree ever lands it
// would be stamped requiredWay 'hidden_spell_pathway' on the same base path.
export const PHAP_TU_AN_NODES: ProgressionNode[] = []
