// Node-tree view mapping — single owner for which tags a tree view
// renders. Consumed by NodeTreePanel (render filter) and
// tests/architecture/nodeBranchCoverage.test.ts (guard).
//
// Phap Tu Reimagined (Task 16) — the reworked Phap Tu tree tags nodes
// by `elementTag`/`routeTag` (see PhapTuNodes.builders.ts); the retired
// `thuan_<element>`/`lap_dao` branchTag family is gone. A node now
// belongs to a view when EITHER tag equals the view tag, so element
// views (fire/water/...) and Kiem Tu route views (kiem_tran/bat_kiem)
// are all single-tag views and this mapping is a pass-through — kept
// as the documented boundary where future multi-tag views or hidden
// tags would live.

/**
 * branchTags that are registered but intentionally never rendered.
 * `da_phap` is the reserved tag for the future Phap Tu An tree — the
 * path owns no normal tree surface (its kit is granted at the ritual,
 * Task 7), so nothing under that tag may appear in a view.
 */
export const HIDDEN_BRANCH_TAGS: readonly string[] = ['da_phap']

/**
 * The tags a tree view for `viewTag` must render. Every current view is
 * single-tag: element views match `elementTag`, Kiem Tu route views
 * match `branchTag`. A HIDDEN tag as the view itself renders nothing.
 */
export function viewBranchTags(viewTag: string): readonly string[] {
  if ((HIDDEN_BRANCH_TAGS as readonly string[]).includes(viewTag)) {
    return []
  }

  return [viewTag]
}
