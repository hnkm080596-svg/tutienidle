export interface SkillUiNode {
  id: string
  name: string
  icon: string
  x: number
  y: number
  prominent?: boolean
  /** Constellation emphasis from the glyph layout (plan sec.4) - drives
   *  the minor/major/root sizing inside SkillConstellationPanel. */
  emphasis?: 'normal' | 'major' | 'root'
  level: string
  /** Numeric level/maxLevel driving the segmented pipe fill on edges
   *  entering this node (one slot per level, filled per current level).
   *  Optional - preview/fixture nodes leave them unset and draw a plain
   *  pipe. */
  levelCurrent?: number
  levelMax?: number
  state: 'learned' | 'available' | 'locked'
  description: string
  /** XP line under level in the detail card ('' = row hidden). Cast-leveled
   *  skills report "casts / next threshold"; insight-priced nodes have no
   *  per-node XP channel so they stay ''. */
  experience: string
  /** Combat/effect stat rows - damage, ailment chance, granted skills. */
  stats: readonly { id: string; label: string; value: string }[]
  /** Unmet purchase/level gate lines for the conditions block. */
  conditions: readonly string[]
  /** Cost line under the action button ('' = hidden). */
  costLabel: string
  /** Resolved CTA text: the unlock label for the purchase, the upgrade
   *  label for a level, the maxed label at cap. Empty renders no button. */
  actionLabel: string
  actionDisabled: boolean
  /** Why the CTA is gated - sits in the reserved notice area. */
  actionHint: string
  /** Next-level Insight cost shown in the detail card's unlocked body
   *  ('Cam Ngo can thiet'). null at the level cap. */
  nextCost?: number | null
  /** 'Hieu Qua' ladder (Minh 2026-10-07): one line per level with the
   *  cumulative contribution the level buys - real numbers derived
   *  from node.effect, not prose. met = level already owned (gold). */
  levelEffects?: readonly { lv: number; text: string; met: boolean }[]
  /** Frame tier override (tien-hiep skill-node-{tier}-v1.png). Set only for
   *  the three mortal precursor seats - their frame upgrades with the
   *  skill's core level; every other node keeps the prominent/sub frames. */
  frameKind?: 'main' | 'parent' | 'sub' | 'passive' | 'keystone'
}
export interface SkillUiEdge { from: string; to: string }

// Minh's pipe-segment ruling (2026-10): an edge renders one pipe per
// level of the TARGET node; the NODE's distance from its parent is what
// grows with level count. Each pipe is the full pipe art scaled
// UNIFORMLY to EDGE_PIPE_H (never stretched to fit): the v2 source art
// is 1088x183 (~5.9:1) so one scaled pipe is ~131px wide. The level
// fill lives INSIDE the pipe's dark channel (rows ~27-84% of art
// height) - never a bar over the art. Both the layout
// post-pass (SkillSurface) and the edge renderer (SkillPaperTree) share
// these metrics so the pipe chain exactly tiles the link.
export const EDGE_PIPE_ART_W = 1088
export const EDGE_PIPE_ART_H = 183
export const EDGE_PIPE_H = 22
export const EDGE_PIPE_CELL = EDGE_PIPE_H * (EDGE_PIPE_ART_W / EDGE_PIPE_ART_H)
export const EDGE_PIPE_GAP = 6
// Pipe-to-disc gaps are asymmetric (Minh ruling): the PARENT side keeps
// an 8px breathing gap past the disc rim while the TARGET node sits
// 8px closer, right at its rim (node disc radius 30px).
export const EDGE_PIPE_INSET = 38
export const EDGE_PIPE_INSET_TO = 30
export const edgeLinkLength = (max: number): number =>
  EDGE_PIPE_INSET + EDGE_PIPE_INSET_TO + max * EDGE_PIPE_CELL + Math.max(0, max - 1) * EDGE_PIPE_GAP
export interface SkillUiElement { id: string; label: string; icon: string }
