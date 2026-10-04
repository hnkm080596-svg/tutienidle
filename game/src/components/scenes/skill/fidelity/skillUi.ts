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
  state: 'learned' | 'available' | 'locked'
  description: string
  rows: readonly { id: string; label: string; value: string }[]
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
}
export interface SkillUiEdge { from: string; to: string }
export interface SkillUiElement { id: string; label: string; icon: string }
