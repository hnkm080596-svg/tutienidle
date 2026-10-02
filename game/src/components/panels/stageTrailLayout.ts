// Huyen Kim scene 10 (Son Ha Do map) - pure serpentine trail layout for
// the canonical stage list. Input is ONLY the node count; the helper
// owns no lock/progress/enemy semantics - StageSelectPanel keeps
// consuming the zone/stage read-models and positions what they return.
//
// Nodes walk a winding path across the map parchment (row-major snake:
// left->right then right->left) matching the reference's mountain
// trail; the SVG path connects consecutive stage orbits.

export interface StageTrailPoint {
  /** 0..1 fraction of the map canvas. */
  x: number
  y: number
}

export interface StageTrailLayout {
  points: StageTrailPoint[]
  /** SVG path through the node centers, in a 0..1000 viewBox space. */
  pathD: string
}

const MARGIN_X = 0.14
// Compressed vertical span: at ~720p the third row must clear the map
// frame's bottom band without forcing the parchment field to scroll.
const MARGIN_TOP = 0.13
const TRAIL_SPAN_Y = 0.5
const PER_ROW_MAX = 4

export function layoutStageTrail(count: number): StageTrailLayout {
  if (count <= 0) {
    return { points: [], pathD: '' }
  }

  const columns = Math.max(1, Math.min(PER_ROW_MAX, count))
  const rows = Math.ceil(count / columns)

  const points: StageTrailPoint[] = []

  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns)
    const col = index % columns
    // A short final row centers itself instead of hugging the left edge.
    const rowCount = Math.min(columns, count - row * columns)
    const effectiveCol = row % 2 === 1 ? rowCount - 1 - col : col
    const span = rowCount > 1 ? rowCount - 1 : 1
    const xBase = rowCount > 1
      ? MARGIN_X + (effectiveCol / span) * (1 - MARGIN_X * 2)
      : 0.5
    const y = rows > 1
      ? MARGIN_TOP + (row / (rows - 1)) * TRAIL_SPAN_Y
      : 0.45

    points.push({ x: xBase, y })
  }

  return { points, pathD: pathThroughPoints(points) }
}

// Chapter-band variant: the audit's EXACT scene-10 pattern renders all
// three chapter tracks at once, one serpentine wave per band ending on
// the chapter's boss medallion at the right edge.
// Node span keeps clear of the chapter marker (left edge, ~90px of the
// band) on the left and of the band's right edge on the right - an
// 84px node centered at 0.92/0.26 of a ~464px trail clipped into the
// marker copy / off the band (D-M4).
const BAND_START_X = 0.3
const BAND_SPAN_X = 0.5
const BAND_Y_HIGH = 0.36
const BAND_Y_LOW = 0.62
const BAND_BOSS_X = 0.885
const BAND_BOSS_Y = 0.48

export function layoutChapterBandTrail(count: number): StageTrailLayout {
  if (count <= 0) {
    return { points: [], pathD: '' }
  }

  const regular = Math.max(0, count - 1)
  const points: StageTrailPoint[] = []

  for (let index = 0; index < regular; index += 1) {
    const x = regular > 1
      ? BAND_START_X + (index / (regular - 1)) * BAND_SPAN_X
      : BAND_START_X + BAND_SPAN_X / 2
    points.push({ x, y: index % 2 === 0 ? BAND_Y_HIGH : BAND_Y_LOW })
  }

  // The band's last stage is its chapter-end boss seal.
  points.push({ x: BAND_BOSS_X, y: BAND_BOSS_Y })

  return { points, pathD: pathThroughPoints(points) }
}

// Smooth the polyline with quadratic mid-segment joins so the trail
// reads as a drawn path, not a wire graph.
// viewBox is 0..1000 on both axes (preserveAspectRatio="none"
// stretches the trail to the parchment field, same mapping as the
// nodes' left/top %).
function pathThroughPoints(points: StageTrailPoint[]): string {
  const toViewBox = (point: StageTrailPoint) => ({
    x: Math.round(point.x * 10000) / 10,
    y: Math.round(point.y * 10000) / 10,
  })

  const vb = points.map(toViewBox)
  let pathD = ''

  if (vb.length === 1) {
    pathD = `M ${vb[0]!.x} ${vb[0]!.y}`
  } else if (vb.length > 1) {
    pathD = `M ${vb[0]!.x} ${vb[0]!.y}`

    // Midpoint smoothing: segments meet at edge midpoints with the node
    // centers as quadratic controls, so the trail bends through every
    // node without angular joints.
    pathD += ` L ${(vb[0]!.x + vb[1]!.x) / 2} ${(vb[0]!.y + vb[1]!.y) / 2}`

    for (let i = 1; i < vb.length - 1; i += 1) {
      const curr = vb[i]!
      const next = vb[i + 1]!
      const midX = (curr.x + next.x) / 2
      const midY = (curr.y + next.y) / 2
      pathD += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`
    }

    const last = vb[vb.length - 1]!
    pathD += ` L ${last.x} ${last.y}`
  }

  return pathD
}
