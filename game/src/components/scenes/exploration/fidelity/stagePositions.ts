// Thanh Van map design space + authored node positions.
// Coordinates live in a FIXED design space (MAP_DESIGN_W x MAP_DESIGN_H
// logical px) shared by the SVG route layer and the HTML node layer,
// so the two can never diverge regardless of outer CSS/scaling.
export const MAP_DESIGN_W = 1000
export const MAP_DESIGN_H = 800

export interface StagePosition { x: number; y: number }

// Authored trail tuned by Minh 2026-10-12 via on-map dragging; the
// winding path follows the island art. Keyed by stage id so roster
// order can change without moving nodes.
const AUTHORED_POSITIONS: Record<string, StagePosition> = {
  mortal_dong_1: { x: 292, y: 112 },
  mortal_dong_2: { x: 375, y: 177 },
  mortal_dong_3: { x: 233, y: 210 },
  mortal_dong_4: { x: 330, y: 247 },
  mortal_dong_5: { x: 437, y: 263 },
  mortal_dong_6: { x: 424, y: 337 },
  mortal_dong_7: { x: 324, y: 358 },
  mortal_dong_8: { x: 281, y: 453 },
  mortal_dong_9: { x: 379, y: 473 },
  mortal_dong_10: { x: 484, y: 522 },
  qi_refining_forest: { x: 513, y: 455 },
  qi_refining_deep_forest: { x: 442, y: 409 },
  qi_refining_ember_canyon: { x: 569, y: 403 },
  qi_refining_scorched_ridge: { x: 536, y: 323 },
  qi_refining_sand_plain: { x: 578, y: 232 },
  qi_refining_stone_range: { x: 570, y: 130 },
  qi_refining_blade_peak: { x: 730, y: 119 },
  qi_refining_mineral_pit: { x: 752, y: 197 },
  qi_refining_mystic_marsh: { x: 673, y: 220 },
  qi_refining_abyssal_pool: { x: 697, y: 295 },
  foundation_floor_1: { x: 817, y: 293 },
  foundation_floor_2: { x: 758, y: 372 },
  foundation_floor_3: { x: 672, y: 435 },
  foundation_floor_4: { x: 776, y: 482 },
  foundation_floor_5: { x: 674, y: 539 },
  foundation_floor_6: { x: 461, y: 769 },
  foundation_floor_7: { x: 572, y: 591 },
  foundation_floor_8: { x: 436, y: 620 },
  foundation_floor_9: { x: 480, y: 695 },
  foundation_floor_10: { x: 630, y: 683 },
}

// Fallback for stage ids missing from the authored map (new ai,
// preview fixtures): the original 3-rows-of-10 zigzag.
function fallbackPosition(index: number): StagePosition {
  const row = Math.floor(index / 10)
  const column = index % 10
  const x = 80 + column * 95 + (row % 2 === 0 ? 0 : 30)
  const y = 140 + row * 260
  return { x, y }
}

export function stagePosition(id: string, index: number): StagePosition {
  return AUTHORED_POSITIONS[id] ?? fallbackPosition(index)
}
