// Huyen Kim scene 07 (Tinh Do constellation) -- pure radial layout for
// the real skill graph. Input is ONLY the projected node data (id +
// resolved parent + depth); the helper owns no unlock/cost/prereq
// semantics -- NodeTreePanel keeps consuming the canonical
// betaSkillTreeFor model and merely positions the rows it returns.
//
// Algorithm: single-parent forest (guaranteed by the data contract --
// see NodeTreePanel's depthOf note). Depth maps to orbit radius
// (root near the core, deeper nodes on wider rings); angular sectors
// are allocated by leaf count so subtrees never collide.

export interface RadialGraphNode {
  id: string
  parentId: string | null
  depth: number
}

export interface RadialGraphPosition {
  x: number
  y: number
}

export interface RadialGraphLayout {
  positions: Map<string, RadialGraphPosition>
  /** Square canvas edge (px) the positions were computed for. */
  size: number
}

// Node card footprint used for arc clearance (matches
// .node-tree__node width + breathing room).
const NODE_ARC_PX = 132
const CORE_RADIUS = 80
const MIN_RING_GAP = 82
const MIN_OUTER_RADIUS = 170
const CANVAS_MARGIN = 64

export function layoutRadialGraph(nodes: readonly RadialGraphNode[]): RadialGraphLayout {
  const positions = new Map<string, RadialGraphPosition>()

  if (nodes.length === 0) {
    return { positions, size: 0 }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const childrenOf = new Map<string, RadialGraphNode[]>()
  const roots: RadialGraphNode[] = []

  for (const node of nodes) {
    if (node.parentId !== null && byId.has(node.parentId)) {
      const siblings = childrenOf.get(node.parentId) ?? []
      siblings.push(node)
      childrenOf.set(node.parentId, siblings)
    } else {
      roots.push(node)
    }
  }

  // Leaf weight: internal nodes anchor at the midpoint of their subtree
  // span, so every leaf owns one equal angular slot.
  const leafCountOf = new Map<string, number>()
  const leafCount = (node: RadialGraphNode, guard: Set<string>): number => {
    if (guard.has(node.id)) return 1
    const cached = leafCountOf.get(node.id)
    if (cached !== undefined) return cached

    const children = childrenOf.get(node.id) ?? []
    const count = children.length === 0
      ? 1
      : children.reduce((sum, child) => sum + leafCount(child, new Set(guard).add(node.id)), 0)

    leafCountOf.set(node.id, count)
    return count
  }

  const totalLeaves = Math.max(1, roots.reduce((sum, root) => sum + leafCount(root, new Set()), 0))

  const maxDepth = nodes.reduce((max, node) => Math.max(max, node.depth), 0)

  // Per-depth occupancy: an inner ring can hold MORE nodes than the
  // leaf ring (wide fans), so every ring's circumference must clear its
  // own population, not just the outermost's.
  const countAtDepth = new Map<number, number>()
  for (const node of nodes) {
    countAtDepth.set(node.depth, (countAtDepth.get(node.depth) ?? 0) + 1)
  }
  const densityRadius = (depth: number): number =>
    ((countAtDepth.get(depth) ?? 0) * NODE_ARC_PX) / (2 * Math.PI)

  // Ring radii: circumference clears the ring's own population AND the
  // leaf rim, and radial spacing between consecutive depths clears a
  // card's height (MIN_RING_GAP) so a child never lands on its parent.
  const outerRadius = Math.max(
    MIN_OUTER_RADIUS,
    (totalLeaves * NODE_ARC_PX) / (2 * Math.PI),
    CORE_RADIUS + maxDepth * MIN_RING_GAP,
    ...Array.from(countAtDepth.keys()).map(densityRadius),
  )

  // Tidy radial invariant: every leaf owns an equal angular slot
  // (2pi / totalLeaves), so a leaf only clears its card on the leaf rim.
  // Internal nodes (subtree midpoints) ride depth-scaled inner rings;
  // multiple depth-0 roots share a tight inner orbit instead of stacking.
  const coreRadius = roots.length > 1 ? CORE_RADIUS * 0.6 : 0
  const isLeaf = (node: RadialGraphNode): boolean =>
    nodes.length > 1 && (childrenOf.get(node.id) ?? []).length === 0

  const radiusOf = (node: RadialGraphNode): number => {
    if (isLeaf(node)) {
      return outerRadius
    }

    if (node.depth === 0 || maxDepth === 0) {
      return coreRadius
    }

    return Math.max(
      CORE_RADIUS + ((outerRadius - CORE_RADIUS) * node.depth) / maxDepth,
      densityRadius(node.depth),
    )
  }

  const center = outerRadius + CANVAS_MARGIN
  const size = center * 2

  // Walk each root's sector: [start,end] radians. -PI/2 = 12 o'clock.
  let cursor = -Math.PI / 2

  const place = (node: RadialGraphNode, start: number, end: number, guard: Set<string>): void => {
    const angle = (start + end) / 2
    const radius = radiusOf(node)

    positions.set(node.id, {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    })

    if (guard.has(node.id)) return

    const children = childrenOf.get(node.id) ?? []
    let childStart = start

    for (const child of children) {
      const span = (end - start) * (leafCount(child, guard) / Math.max(1, leafCount(node, guard)))
      place(child, childStart, childStart + span, new Set(guard).add(node.id))
      childStart += span
    }
  }

  for (const root of roots) {
    const share = leafCount(root, new Set()) / totalLeaves
    const span = Math.PI * 2 * share
    place(root, cursor, cursor + span, new Set())
    cursor += span
  }

  return { positions, size }
}
