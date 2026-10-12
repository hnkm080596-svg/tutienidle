// Han-character constellation layouts for the Phap Tu skill tree
// (game/docs/skill-constellation-glyph-plan.md sec.4). Glyph points are
// keyed by nodeId and live beside the gameplay data, not inside it -
// ProgressionNode never carries presentation coordinates, so reordering
// or adding nodes cannot silently shuffle a glyph. The colocated test
// fails when a branch node lacks a slot.
//
// Beta scope: only the fire glyph is authored. Branches without a
// layout fall back to the panel's existing layout per the plan's
// fallback rule - no invented coordinates for the other elements.

export type SkillConstellationGlyphId =
  | 'fire'
  | 'wood'
  | 'water'
  | 'metal'
  | 'earth'
  | 'sword'
  | 'body'

export interface ConstellationPoint {
  nodeId: string
  x: number
  y: number
  emphasis?: 'normal' | 'major' | 'root'
  labelPlacement?: 'top' | 'right' | 'bottom' | 'left'
}

export interface ConstellationGlyphStroke {
  fromNodeId: string
  toNodeId: string
}

export interface SkillConstellationLayout {
  id: SkillConstellationGlyphId
  glyph: string
  viewBox: string
  points: ConstellationPoint[]
  strokes: ConstellationGlyphStroke[]
}

// Fire glyph - mapping rules from the plan (sec.6 Hoa):
// - the root sits at the junction where the right-falling stroke branches
//   off the left-falling sweep;
// - the two mutex Truc Co capstones end the two leg strokes;
// - each capstone's prereq chain walks its own leg;
// - the common minor and the special unlock form the two top marks.
const FIRE_CONSTELLATION: SkillConstellationLayout = {
  id: 'fire',
  glyph: '火',
  viewBox: '0 0 480 300',
  points: [
    { nodeId: 'hoa_linh_ngo', x: 216, y: 150, emphasis: 'root' },
    { nodeId: 'hoa_the', x: 118, y: 176 },
    { nodeId: 'hoa_an_sau', x: 252, y: 40 },
    { nodeId: 'hoa_nhiet_keo', x: 180, y: 216 },
    { nodeId: 'fire_basic_hoa_tu_diem', x: 110, y: 278, emphasis: 'major', labelPlacement: 'top' },
    { nodeId: 'hoa_diem_chuan', x: 284, y: 194 },
    { nodeId: 'hoa_diem_tham', x: 340, y: 242 },
    { nodeId: 'fire_basic_hoa_tan_diem', x: 398, y: 280, emphasis: 'major', labelPlacement: 'top' },
    { nodeId: 'fire_ailment_mastery', x: 140, y: 96 },
    { nodeId: 'linh_ngo_tam_muoi_chan_hoa', x: 320, y: 80, emphasis: 'major' },
    // Realm-reward mastery seat - a spark nested inside the glyph's leg
    // junction (no prereq edge, so it carries no stroke).
    { nodeId: 'tinh_thong_hoa', x: 218, y: 195, labelPlacement: 'top' },
    // ------------------------------------------------------------------
    // Fire rulings 2026-10-06 - first-pass placement (design-mode will
    // reseat): Ly Hoa hit chain ascends the inner-left arc; the Tam
    // Muoi lane fans right of the Trang mark; the solo mana branch
    // hangs off the left leg below Tich Diem.
    { nodeId: 'hoa_diem_uy', x: 170, y: 122 },
    { nodeId: 'hoa_hoa_nhan', x: 188, y: 92 },
    { nodeId: 'hoa_pha_giap_diem', x: 202, y: 60 },
    { nodeId: 'hoa_bao_diem', x: 188, y: 30 },
    { nodeId: 'hoa_phe_diem', x: 162, y: 14 },
    { nodeId: 'ngu_hoa', x: 372, y: 72 },
    { nodeId: 'ngu_viem_tam', x: 362, y: 38 },
    { nodeId: 'ngu_viem_y', x: 412, y: 52 },
    { nodeId: 'ho_the_mon', x: 70, y: 148 },
    { nodeId: 'nguyen_kinh', x: 48, y: 186 },
    { nodeId: 'linh_chuong', x: 96, y: 194 },
    { nodeId: 'the_diem_kinh', x: 34, y: 224 },
  ],
  strokes: [
    // Left-falling sweep (pie): top extension through the junction down
    // to the Tu Diem capstone at the leg's end.
    { fromNodeId: 'hoa_linh_ngo', toNodeId: 'hoa_an_sau' },
    { fromNodeId: 'hoa_an_sau', toNodeId: 'hoa_nhiet_keo' },
    { fromNodeId: 'hoa_nhiet_keo', toNodeId: 'fire_basic_hoa_tu_diem' },
    // Right-falling press (na): junction to the Tan Diem capstone.
    { fromNodeId: 'hoa_linh_ngo', toNodeId: 'hoa_diem_chuan' },
    { fromNodeId: 'hoa_diem_chuan', toNodeId: 'hoa_diem_tham' },
    { fromNodeId: 'hoa_diem_tham', toNodeId: 'fire_basic_hoa_tan_diem' },
    // The two top marks.
    { fromNodeId: 'hoa_linh_ngo', toNodeId: 'fire_ailment_mastery' },
    { fromNodeId: 'hoa_linh_ngo', toNodeId: 'linh_ngo_tam_muoi_chan_hoa' },
    { fromNodeId: 'hoa_linh_ngo', toNodeId: 'hoa_the' },
    // Ly Hoa hit chain (root -> Uy -> Nhan -> Pha Giap -> Bao -> Phe).
    { fromNodeId: 'hoa_linh_ngo', toNodeId: 'hoa_diem_uy' },
    { fromNodeId: 'hoa_diem_uy', toNodeId: 'hoa_hoa_nhan' },
    { fromNodeId: 'hoa_hoa_nhan', toNodeId: 'hoa_pha_giap_diem' },
    { fromNodeId: 'hoa_pha_giap_diem', toNodeId: 'hoa_bao_diem' },
    { fromNodeId: 'hoa_bao_diem', toNodeId: 'hoa_phe_diem' },
    // Minh ruling 2026-10-07: Dan Hoa / An Sau hang off the END of the
    // cast chain (Phe Diem) - draw the real prereq edges from the chain
    // head in addition to the glyph strokes off the junction above.
    { fromNodeId: 'hoa_phe_diem', toNodeId: 'hoa_an_sau' },
    { fromNodeId: 'hoa_phe_diem', toNodeId: 'hoa_diem_chuan' },
    // Tam Muoi lane - three parallel children of the Trang mark.
    { fromNodeId: 'linh_ngo_tam_muoi_chan_hoa', toNodeId: 'ngu_hoa' },
    { fromNodeId: 'linh_ngo_tam_muoi_chan_hoa', toNodeId: 'ngu_viem_tam' },
    { fromNodeId: 'linh_ngo_tam_muoi_chan_hoa', toNodeId: 'ngu_viem_y' },
    // Solo mana branch off the root (Minh ruling).
    { fromNodeId: 'hoa_linh_ngo', toNodeId: 'ho_the_mon' },
    { fromNodeId: 'ho_the_mon', toNodeId: 'nguyen_kinh' },
    { fromNodeId: 'ho_the_mon', toNodeId: 'linh_chuong' },
    { fromNodeId: 'nguyen_kinh', toNodeId: 'the_diem_kinh' },
  ],
}

export const SKILL_CONSTELLATION_LAYOUTS: Readonly<
  Partial<Record<SkillConstellationGlyphId, SkillConstellationLayout>>
> = {
  fire: FIRE_CONSTELLATION,
}

export function skillConstellationLayoutFor(
  id: string | undefined | null,
): SkillConstellationLayout | undefined {
  if (id === undefined || id === null) return undefined
  return SKILL_CONSTELLATION_LAYOUTS[id as SkillConstellationGlyphId]
}

export function constellationPointsById(
  layout: SkillConstellationLayout,
): ReadonlyMap<string, ConstellationPoint> {
  return new Map(layout.points.map((point) => [point.nodeId, point]))
}
