import { describe, expect, it } from 'vitest'
import { PHAP_TU_NODES } from '../../src/data/progression/PhapTuNodes'
import { KIEM_TU_NODES } from '../../src/data/progression/KiemTuNodes'
import { THE_TU_NODES } from '../../src/data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../src/data/progression/TheTuAnNodes'
import { HIDDEN_BRANCH_TAGS, viewBranchTags } from '../../src/core/progression/NodeBranchViews'
import { ELEMENT_ORDER } from '../../src/core/element/ElementLabels'

/**
 * Node-branch coverage guard (B1 fix, 2026-09-14).
 *
 * Origin: PhapTuNodes shipped 45 `thuan_*` nodes + the shared `lap_dao`
 * gate under branchTags no tree view could ever select — NodeTreePanel
 * filters `branchTag === viewTag` and views only ever pass an ElementType
 * or a kiem-tu route. The whole Thuan chain was dead content.
 *
 * Guard: every registered node's branchTag must be renderable by at
 * least one tree view OR explicitly listed in HIDDEN_BRANCH_TAGS (the
 * documented placeholder-trap case). Adding a node under a brand-new
 * tag without a render path fails here instead of shipping silently.
 */

// Kiem Tu Reimagined Task 11 — the retired kiem_tran/bat_kiem route
// tags are gone; the reimagined tree renders through 'kiem_pho' and
// 'ngu_kiem' (both map to the combined kiem-tu view).
// The Tu Reimagined (Task 12) — 'the_tu' is a single-tag pass-through
// view (one tree, mutex roots inside it); 'the_tu_an' is the hidden
// path's view tag.
const VIEW_TAGS = [...ELEMENT_ORDER, 'kiem_pho', 'ngu_kiem', 'the_tu', 'the_tu_an']

function renderableTags(): Set<string> {
  const tags = new Set<string>()
  for (const view of VIEW_TAGS) {
    for (const tag of viewBranchTags(view)) {
      tags.add(tag)
    }
  }
  return tags
}

describe('node branch coverage', () => {
  it('every node tag is renderable by a tree view or explicitly hidden', () => {
    const renderable = renderableTags()
    const hidden = new Set<string>(HIDDEN_BRANCH_TAGS)
    const unrenderable: string[] = []

    for (const node of [...PHAP_TU_NODES, ...KIEM_TU_NODES, ...THE_TU_NODES, ...THE_TU_AN_NODES]) {
      // Phap Tu Reimagined (Task 16) — the view membership tag is
      // elementTag for the reworked Phap Tu tree, branchTag for the
      // Kiem Tu routes and the The Tu trees; a node is renderable when
      // its view tag is.
      const tag = node.elementTag ?? node.branchTag
      if (tag === undefined) continue
      if (!renderable.has(tag) && !hidden.has(tag)) {
        unrenderable.push(`${node.id} (tag '${tag}')`)
      }
    }

    expect(unrenderable).toEqual([])
  })

  it('hidden tags never leak into a renderable view', () => {
    const renderable = renderableTags()
    for (const tag of HIDDEN_BRANCH_TAGS) {
      expect(renderable.has(tag), `hidden tag '${tag}' is renderable`).toBe(false)
    }
  })
})
