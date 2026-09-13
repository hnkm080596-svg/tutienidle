// Node-tree view mapping (B1 fix, 2026-09-14) — single owner for which
// progression branchTags a tree view renders. PhapTuNodes ships the
// Thuan chain under `thuan_<element>` plus the shared Truc Co gate under
// `lap_dao`; element views must render all three tag sets or the chain
// is unreachable. Consumed by NodeTreePanel (render filter) and
// tests/architecture/nodeBranchCoverage.test.ts (guard).

import { ELEMENT_ORDER } from '../element/ElementLabels'
import type { ElementType } from '../element/ElementType'

const ELEMENT_TAG_SET = new Set<string>(ELEMENT_ORDER)

/** The shared Truc Co gate tag — renders inside every element view. */
export const LAP_DAO_BRANCH_TAG = 'lap_dao'

/**
 * branchTags that are registered but intentionally never rendered.
 * `da_phap` exists only as an `excludesNode` target for the Thuan
 * keystones (see PhapTuNodes.dao.test.ts) — a content placeholder, not
 * a purchaseable node. Keep this list explicit and minimal.
 */
export const HIDDEN_BRANCH_TAGS: readonly string[] = ['da_phap']

/**
 * The branchTags a tree view for `viewTag` must render.
 * - Element view (`fire`, ...): the element branch, the shared Lập Đạo
 *   gate, and that element's Thuan sub-branch.
 * - Anything else (kiem_tran/bat_kiem routes, future tags): pass-through
 *   single-tag view.
 * - A HIDDEN tag as the view itself renders nothing.
 */
export function viewBranchTags(viewTag: string): readonly string[] {
  if ((HIDDEN_BRANCH_TAGS as readonly string[]).includes(viewTag)) {
    return []
  }

  if (ELEMENT_TAG_SET.has(viewTag)) {
    const element = viewTag as ElementType
    return [viewTag, LAP_DAO_BRANCH_TAG, `thuan_${element}`]
  }

  return [viewTag]
}
