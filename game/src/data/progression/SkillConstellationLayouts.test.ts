import { describe, expect, it } from 'vitest'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { KIEM_TU_NODES } from './KiemTuNodes'
import { THE_TU_NODES } from './TheTuNodes'
import { THE_TU_AN_NODES } from './TheTuAnNodes'
import {
  SKILL_CONSTELLATION_LAYOUTS,
  skillConstellationLayoutFor,
  type SkillConstellationLayout,
} from './SkillConstellationLayouts'
import { betaNodeTreeRenderable } from '@/core/betaScopeSkillDomain'
import type { ProgressionNode } from '@/core/progression/ProgressionNode'

// Layout integrity guards (skill-constellation-glyph-plan.md sec.4):
// a branch without a slot for every renderable node must fail here
// instead of silently dropping the node from the constellation.
//
// "Renderable" shares the betaSkillTreeFor grant-only verdict through
// betaNodeTreeRenderable: reward grants, granted-only nodes and skill
// core levels never join the tree surface, so they own no glyph point.

const ALL_PROGRESSION_NODES: readonly ProgressionNode[] = [
  ...PHAP_TU_NODES,
  ...KIEM_TU_NODES,
  ...THE_TU_NODES,
  ...THE_TU_AN_NODES,
]

const layouts = Object.values(SKILL_CONSTELLATION_LAYOUTS).filter(
  (layout): layout is SkillConstellationLayout => layout !== undefined,
)

describe('skill constellation layouts', () => {
  it('declares a parseable viewBox with a positive span', () => {
    for (const layout of layouts) {
      const parts = layout.viewBox.split(/\s+/).map(Number)
      expect(parts.length, `layout '${layout.id}' viewBox`).toBe(4)
      expect(parts.every((part) => Number.isFinite(part)), `layout '${layout.id}'`).toBe(true)
      expect(parts[2], `layout '${layout.id}'`).toBeGreaterThan(0)
      expect(parts[3], `layout '${layout.id}'`).toBeGreaterThan(0)
      // The panel fits the glyph into the tree slot's aspect, so the
      // authored box must stay close to landscape.
      expect(parts[2]! / parts[3]!, `layout '${layout.id}'`).toBeGreaterThan(1)
    }
  })

  it('has no duplicated point nodeId inside a layout', () => {
    for (const layout of layouts) {
      const ids = layout.points.map((point) => point.nodeId)
      expect(new Set(ids).size, `layout '${layout.id}'`).toBe(ids.length)
    }
  })

  it('every stroke endpoint exists in the layout points', () => {
    for (const layout of layouts) {
      const pointIds = new Set(layout.points.map((point) => point.nodeId))
      const dangling = layout.strokes.flatMap((stroke) =>
        [stroke.fromNodeId, stroke.toNodeId].filter((id) => !pointIds.has(id)),
      )
      expect(dangling, `layout '${layout.id}'`).toEqual([])
    }
  })

  it('assigns every renderable node of the branch exactly one point', () => {
    for (const layout of layouts) {
      const branchNodes = ALL_PROGRESSION_NODES.filter(
        (node) => node.elementTag === layout.id && betaNodeTreeRenderable(node),
      ).map((node) => node.id)
      const pointIds = layout.points.map((point) => point.nodeId)
      expect([...pointIds].sort(), `layout '${layout.id}'`).toEqual([...branchNodes].sort())
    }
  })

  it('never references nodes outside the layout branch', () => {
    const branchIds = new Set(
      ALL_PROGRESSION_NODES.filter(
        (node) => node.elementTag !== undefined && betaNodeTreeRenderable(node),
      ).map((node) => node.id),
    )
    for (const layout of layouts) {
      for (const point of layout.points) {
        const node = ALL_PROGRESSION_NODES.find((entry) => entry.id === point.nodeId)
        expect(node, `${layout.id}: unknown node '${point.nodeId}'`).not.toBeUndefined()
        expect(node!.elementTag, `${layout.id}: '${point.nodeId}' is not a ${layout.id} node`).toBe(layout.id)
        expect(branchIds.has(point.nodeId)).toBe(true)
      }
    }
  })

  it('keeps real prerequisite edges on glyph strokes', () => {
    for (const layout of layouts) {
      const pointIds = new Set(layout.points.map((point) => point.nodeId))
      const strokePairs = new Set(
        layout.strokes.map((stroke) => `${stroke.fromNodeId}->${stroke.toNodeId}`),
      )
      const offStroke: string[] = []
      for (const node of ALL_PROGRESSION_NODES) {
        if (!pointIds.has(node.id)) continue
        for (const prereq of node.prerequisites ?? []) {
          if (prereq.kind !== 'node' || !pointIds.has(prereq.nodeId)) continue
          const pair = `${prereq.nodeId}->${node.id}`
          if (!strokePairs.has(pair)) offStroke.push(pair)
        }
      }
      expect(offStroke, `layout '${layout.id}'`).toEqual([])
    }
  })

  it('resolves only authored layouts through the helper', () => {
    expect(skillConstellationLayoutFor('fire')?.glyph).toBe('火')
    expect(skillConstellationLayoutFor('wood')).toBeUndefined()
    expect(skillConstellationLayoutFor('sword')).toBeUndefined()
    expect(skillConstellationLayoutFor(undefined)).toBeUndefined()
    expect(skillConstellationLayoutFor(null)).toBeUndefined()
    expect(skillConstellationLayoutFor('not-a-glyph')).toBeUndefined()
  })
})
