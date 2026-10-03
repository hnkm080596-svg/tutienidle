// BETA SCOPE LOCK v2 - the flag TABLE alone, extracted from betaScope.ts
// as a zero-dependency leaf. The flags stay the single authority;
// betaScope.ts re-exports this so every existing '@/core/betaScope'
// import is unchanged.
//
// Why a leaf: e2e specs are type-checked under tsconfig.node (types:
// ['node'], no '@/'' paths, no vite/client). A spec that imports
// betaScope.ts directly drags its whole realm/material/type graph into
// that project and fails to resolve. The table alone is import-safe.

/**
 * Beta feature admission table. Every listed feature is OUT of beta
 * scope; the table exists so each removal is a deliberate named flag
 * and re-enable is a single flip. Features not listed here are still
 * not offered - the fail-closed rule covers anything unnamed.
 *
 *   hiddenContent          - hidden ways' content: hidden lineage
 *                            (discovery / Co Thu trial / Quan The
 *                            diversion / Nghich Chu Thien), hidden
 *                            beasts, hidden material emissions
 *   swordPath / bodyPath   - Kiem Tu / The Tu ritual offers and panels
 *   companion              - companion roster/acquisition/progression
 *   formation              - Tran Phap formation access
 *   artifact               - artifact system surfaces
 *   manualWorkforce        - Nhan Cong manual workforce surface
 *   equipmentWash          - equipment wash (affix reroll) tab
 *   equipmentRefine        - equipment refine tab
 *   equipmentOreDecompose  - ore decompose tab
 *   dailyQuest             - all daily-cadence quests
 */
export const BETA_FEATURES = {
  hiddenContent: false,
  swordPath: false,
  bodyPath: false,
  companion: false,
  formation: false,
  artifact: false,
  manualWorkforce: false,
  equipmentWash: false,
  equipmentRefine: false,
  equipmentOreDecompose: false,
  dailyQuest: false,
} as const

export type BetaFeatureName = keyof typeof BETA_FEATURES
