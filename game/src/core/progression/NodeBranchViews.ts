// Node-tree view mapping — single owner for which tags a tree view
// renders. Consumed by NodeTreePanel (render filter) and
// tests/architecture/nodeBranchCoverage.test.ts (guard).
//
// Phap Tu Reimagined (Task 16) — the reworked Phap Tu tree tags nodes
// by `elementTag`/`routeTag` (see PhapTuNodes.builders.ts); the retired
// `thuan_<element>`/`lap_dao` branchTag family is gone. A node now
// belongs to a view when EITHER tag equals the view tag, so element
// views (fire/water/...) are all single-tag views and this mapping is
// a pass-through — kept as the documented boundary where multi-tag
// views or hidden tags live. Kiem Tu Reimagined: kiem_pho/ngu_kiem are
// the one current multi-tag view (both render BOTH branch tags).

/**
 * branchTags that are registered but intentionally never rendered.
 * `da_phap` is the reserved tag for the future Phap Tu An tree — the
 * path owns no normal tree surface (its kit is granted at the ritual,
 * Task 7), so nothing under that tag may appear in a view.
 */
export const HIDDEN_BRANCH_TAGS: readonly string[] = ['da_phap']

/** Kiem Tu Reimagined (spec §6) — one kiem-tu tree, two branchTags:
 *  'kiem_pho' holds the orb branches, 'ngu_kiem' the hidden root +
 *  Ngu branch. Both views render BOTH tags — visibility inside the
 *  tree is governed by revealWhen (kiem_tu_an) and the kiemTuMode
 *  display filter in NodeTreePanel (opposite-mode nodes hidden). */
const KIEM_TU_VIEW_TAGS = ['kiem_pho', 'ngu_kiem'] as const

/**
 * The tags a tree view for `viewTag` must render. Element views match
 * `elementTag` single-tag; `kiem_pho`/`ngu_kiem` form the one multi-tag
 * view (both render the whole kiem-tu tree — opposite-mode nodes are
 * hidden by the display filter, not by tag). A HIDDEN tag as the view
 * itself renders nothing.
 */
export function viewBranchTags(viewTag: string): readonly string[] {
  if ((HIDDEN_BRANCH_TAGS as readonly string[]).includes(viewTag)) {
    return []
  }

  if ((KIEM_TU_VIEW_TAGS as readonly string[]).includes(viewTag)) {
    return KIEM_TU_VIEW_TAGS
  }

  return [viewTag]
}
