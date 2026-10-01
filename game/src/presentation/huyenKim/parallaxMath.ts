/**
 * Pure geometry for the stable-art parallax presenter. Kept framework-free
 * so the contract rules are unit-testable without a DOM:
 *
 * - all layers share one canvas family + one center (no independent crop);
 * - each layer cover-fits the container PLUS its drift margin: the render
 *   scale solves `layerSize * s >= container + 2 * maxDrift * s` on both
 *   axes, so at maximum drift every edge still covers the container —
 *   i.e. rendered overscan >= 2 * rendered drift (the contract's
 *   `2 * max_drift_px` read in rendered units; drift scales with the
 *   canvas so motion stays proportional at 0.765 runtime scaling);
 * - pointer input is normalized to [-1, 1]; rendered offset =
 *   -pointer * maxDrift * s, hard-clamped to +/- maxDrift * s;
 * - prefers-reduced-motion collapses every offset to exactly 0.
 */

export interface ParallaxLayerGeometry {
  readonly width: number
  readonly height: number
  readonly maxDriftPx: { readonly x: number; readonly y: number }
}

export interface LayerFrame {
  /** Element size in rendered px (cover + centered overscan included). */
  readonly width: number
  readonly height: number
  /** Translation bounds in rendered px (symmetric around center). */
  readonly maxOffsetX: number
  readonly maxOffsetY: number
}

export function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

export function layerFrame(
  containerW: number,
  containerH: number,
  layer: ParallaxLayerGeometry,
): LayerFrame {
  // Degenerate guard: drift larger than half the canvas has no solution;
  // cap it so the geometry always closes.
  const driftX = Math.min(layer.maxDriftPx.x, Math.max(0, (layer.width - 1) / 2))
  const driftY = Math.min(layer.maxDriftPx.y, Math.max(0, (layer.height - 1) / 2))

  const denomW = Math.max(1, layer.width - 2 * driftX)
  const denomH = Math.max(1, layer.height - 2 * driftY)
  const scale = Math.max(containerW / denomW, containerH / denomH)

  return {
    width: layer.width * scale,
    height: layer.height * scale,
    maxOffsetX: driftX * scale,
    maxOffsetY: driftY * scale,
  }
}

export interface ParallaxOffset {
  readonly x: number
  readonly y: number
}

/**
 * Translation for one layer. `pointer` units must already be in [-1, 1]
 * (clampUnit); the result is hard-clamped to the layer's rendered bounds.
 */
export function parallaxOffset(
  pointerX: number,
  pointerY: number,
  frame: LayerFrame,
  reducedMotion: boolean,
): ParallaxOffset {
  if (reducedMotion) {
    return { x: 0, y: 0 }
  }
  // `=== 0` also matches -0: normalize so neutral/static layers emit a
  // clean positive 0 (avoids `-0px` style strings).
  const x = Math.max(-frame.maxOffsetX, Math.min(frame.maxOffsetX, -pointerX * frame.maxOffsetX))
  const y = Math.max(-frame.maxOffsetY, Math.min(frame.maxOffsetY, -pointerY * frame.maxOffsetY))
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y }
}
