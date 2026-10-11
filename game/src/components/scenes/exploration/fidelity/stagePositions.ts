// Thanh Van map design space + authored node positions (Minh 2026-10-11:
// all 30 ai on one vista, positions drag-tunable via layout-tuner).
// Coordinates live in a FIXED design space (MAP_DESIGN_W x MAP_DESIGN_H
// logical px) shared by the SVG route layer and the HTML node layer,
// so the two can never diverge regardless of outer CSS/scaling.
export const MAP_DESIGN_W = 1000
export const MAP_DESIGN_H = 800

export interface StagePosition { x: number; y: number }

// Default trail: 3 rows of 10 zigzag, stable until tuned positions are
// baked in here (layout-tuner drop logs the final {id,x,y} for baking).
export function stagePosition(index: number): StagePosition {
  const row = Math.floor(index / 10)
  const column = index % 10
  const x = 80 + column * 95 + (row % 2 === 0 ? 0 : 30)
  const y = 140 + row * 260
  return { x, y }
}
