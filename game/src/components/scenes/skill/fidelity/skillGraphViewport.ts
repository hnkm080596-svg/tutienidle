import type { SkillUiNode } from './skillUi'

/** Fit painted discs and labels, rather than the unused square layout canvas. */
export function skillGraphViewport(nodes: readonly SkillUiNode[], requestedFit: number, width = 740, height = 420) {
  if (!nodes.length) return { scale: 1, x: 0, y: 0 }
  const left = Math.min(...nodes.map(node => node.x - 80))
  const right = Math.max(...nodes.map(node => node.x + 80))
  const top = Math.min(...nodes.map(node => node.y - (node.prominent ? 48 : 38)))
  const bottom = Math.max(...nodes.map(node => node.y + (node.prominent ? 114 : 94)))
  const scale = Math.min(Number.isFinite(requestedFit) && requestedFit > 0 ? requestedFit : 1, 1, (width - 32) / (right - left), (height - 32) / (bottom - top))
  return {
    scale,
    x: (width - (right - left) * scale) / 2 - left * scale,
    y: (height - (bottom - top) * scale) / 2 - top * scale,
  }
}
