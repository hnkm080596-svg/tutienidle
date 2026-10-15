import {
  layoutRadialGraph,
  type RadialGraphNode,
  type RadialGraphPosition,
} from '@/components/panels/skill-path/skillGraphLayout'
import { edgeLinkLength, type SkillUiEdge } from '@/components/scenes/skill/fidelity/skillUi'
import type { ElementType } from '@/core/element/ElementType'

// Design-mode anchor geometry (element trees): parked authored nodes
// form a left column; the root sits center-top with the 3 skill
// children one pipe-link below it (basic bottom-left, the sealed
// top seat bottom-center, special bottom-right).
export const PARKED_X = 90
export const PARKED_TOP = 90
export const PARKED_STEP = 74
export const MAIN_CX = 420
export const MAIN_ROOT_Y = 150
// Children sit exactly one pipe-link from the root: side children fan
// out at ~35 degrees from vertical, the middle child drops straight
// down (edgeLinkLength(1) ~= 321 for the uniform-scaled pipe art).
export const CHILD_D = edgeLinkLength(1)
export const CHILD_DX = Math.sin((Math.PI * 35) / 180) * CHILD_D
export const CHILD_DY = Math.cos((Math.PI * 35) / 180) * CHILD_D

// Skill-seat ids for Minh's design tree (declared up top - the fire
// design tables below reference them).
export const DESIGN_BASIC_ID = 'design_basic_skill'
export const ULTIMATE_NODE_ID = 'design_ultimate_placeholder'

// Fire branch wiring (Minh ruling 2026-10-07): the 3 skill seats are
// the main-branch anchors. The basic seat grows the Ly Hoa hit chain
// that ends in the two mutex capstones; the Tam Muoi special seat
// (a real node) fans its three trade children; the sealed ultimate
// stays a stub. The two unattached side branches sit off the root:
// mana (Ho The) left, Hoa The + mastery leaves right. tinh_thong_hoa
// is a realm grant and carries no edge.
export const FIRE_DESIGN_POS: Readonly<Record<string, RadialGraphPosition>> = {
  hoa_linh_ngo: { x: 360, y: 270 },
  // Mana branch - left of the root.
  ho_the_mon: { x: 235, y: 270 },
  nguyen_kinh: { x: 150, y: 235 },
  linh_chuong: { x: 150, y: 310 },
  the_diem_kinh: { x: 75, y: 235 },
  // Standalone leaves - right of the root; tinh_thong sits apart (no edge).
  hoa_the: { x: 485, y: 255 },
  fire_ailment_mastery: { x: 515, y: 320 },
  tinh_thong_hoa: { x: 555, y: 170 },
  // Ly Hoa main chain - domain-gated off the element root (Diem Uy's
  // prereq is hoa_linh_ngo, not the basic seat), so the chain drops
  // straight under the root and curves left to the capstone legs.
  hoa_diem_uy: { x: 365, y: 372 },
  hoa_hoa_nhan: { x: 340, y: 445 },
  hoa_pha_giap_diem: { x: 300, y: 510 },
  hoa_bao_diem: { x: 255, y: 565 },
  hoa_phe_diem: { x: 215, y: 620 },
  // Tu Diem leg (left) and Tan Diem leg (right) off the chain end.
  hoa_an_sau: { x: 160, y: 665 },
  hoa_nhiet_keo: { x: 110, y: 705 },
  fire_basic_hoa_tu_diem: { x: 60, y: 745 },
  hoa_diem_chuan: { x: 270, y: 665 },
  hoa_diem_tham: { x: 320, y: 705 },
  fire_basic_hoa_tan_diem: { x: 375, y: 745 },
  // Tam Muoi lane - fan below the special seat (445, 370).
  linh_ngo_tam_muoi_chan_hoa: { x: 445, y: 370 },
  ngu_hoa: { x: 413, y: 445 },
  ngu_viem_tam: { x: 465, y: 458 },
  ngu_viem_y: { x: 515, y: 445 },
}

export const FIRE_DESIGN_EDGES: ReadonlyArray<readonly [string, string]> = [
  ['hoa_linh_ngo', DESIGN_BASIC_ID],
  ['hoa_linh_ngo', ULTIMATE_NODE_ID],
  ['hoa_linh_ngo', 'linh_ngo_tam_muoi_chan_hoa'],
  ['hoa_linh_ngo', 'ho_the_mon'],
  ['hoa_linh_ngo', 'hoa_the'],
  ['hoa_linh_ngo', 'fire_ailment_mastery'],
  // The Ly Hoa chain is domain-gated off the root, not the seat (seats
  // are skill grants, not progression nodes) - drawing seat->Diem Uy
  // would claim a dependency the game never enforces.
  ['hoa_linh_ngo', 'hoa_diem_uy'],
  ['hoa_diem_uy', 'hoa_hoa_nhan'],
  ['hoa_hoa_nhan', 'hoa_pha_giap_diem'],
  ['hoa_pha_giap_diem', 'hoa_bao_diem'],
  ['hoa_bao_diem', 'hoa_phe_diem'],
  ['hoa_phe_diem', 'hoa_an_sau'],
  ['hoa_an_sau', 'hoa_nhiet_keo'],
  ['hoa_nhiet_keo', 'fire_basic_hoa_tu_diem'],
  ['hoa_phe_diem', 'hoa_diem_chuan'],
  ['hoa_diem_chuan', 'hoa_diem_tham'],
  ['hoa_diem_tham', 'fire_basic_hoa_tan_diem'],
  ['linh_ngo_tam_muoi_chan_hoa', 'ngu_hoa'],
  ['linh_ngo_tam_muoi_chan_hoa', 'ngu_viem_tam'],
  ['linh_ngo_tam_muoi_chan_hoa', 'ngu_viem_y'],
  ['ho_the_mon', 'nguyen_kinh'],
  ['ho_the_mon', 'linh_chuong'],
  ['nguyen_kinh', 'the_diem_kinh'],
]

export interface SkillPaperGraphNode extends RadialGraphNode {
  grantsSkillIds: readonly string[]
}

export function computeSkillPaperLayout(
  entries: readonly SkillPaperGraphNode[],
  options: {
    mortal: boolean
    committedElement: ElementType | undefined
    seatNodesRendered: boolean
    specialSkillIds: ReadonlySet<string>
  },
): { positions: Map<string, RadialGraphPosition>; size: number } {
  const base = layoutRadialGraph(
    entries.map((entry) => ({
      id: entry.id,
      parentId: entry.parentId,
      depth: entry.depth,
    })),
  )
  if (options.mortal || entries.length <= 1) return base

  const positions = new Map<string, RadialGraphPosition>()
  const specialId = entries.find((entry) =>
    entry.grantsSkillIds.some((id) => options.specialSkillIds.has(id)),
  )?.id

  const rootId = entries.find((entry) => entry.depth === 0)?.id
  if (options.committedElement === 'fire') {
    let parkIndex = 0
    for (const entry of entries) {
      const authored = FIRE_DESIGN_POS[entry.id]
      positions.set(
        entry.id,
        authored !== undefined
          ? { ...authored }
          : { x: PARKED_X, y: PARKED_TOP + parkIndex++ * PARKED_STEP },
      )
    }
    if (options.seatNodesRendered) {
      positions.set(DESIGN_BASIC_ID, { x: 290, y: 370 })
      positions.set(ULTIMATE_NODE_ID, { x: 360, y: 175 })
    }
  } else {
    const parked = entries.filter(
      (entry) => entry.id !== rootId && entry.id !== specialId,
    )
    parked.forEach((entry, i) =>
      positions.set(entry.id, { x: PARKED_X, y: PARKED_TOP + i * PARKED_STEP }),
    )
    if (rootId !== undefined) positions.set(rootId, { x: MAIN_CX, y: MAIN_ROOT_Y })
    if (specialId !== undefined) {
      positions.set(specialId, { x: MAIN_CX + CHILD_DX, y: MAIN_ROOT_Y + CHILD_DY })
    }
    if (options.seatNodesRendered) {
      positions.set(DESIGN_BASIC_ID, { x: MAIN_CX - CHILD_DX, y: MAIN_ROOT_Y + CHILD_DY })
      positions.set(ULTIMATE_NODE_ID, { x: MAIN_CX, y: MAIN_ROOT_Y - CHILD_D })
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x)
    maxX = Math.max(maxX, pos.x)
    minY = Math.min(minY, pos.y)
    maxY = Math.max(maxY, pos.y)
  }
  const MARGIN = 80
  const size = Math.max(maxX - minX, maxY - minY) + 2 * MARGIN
  const shiftX = size / 2 - (minX + maxX) / 2
  const shiftY = size / 2 - (minY + maxY) / 2
  for (const pos of positions.values()) {
    pos.x += shiftX
    pos.y += shiftY
  }
  return { positions, size }
}

export function computeSkillPaperEdges(
  entries: readonly SkillPaperGraphNode[],
  options: {
    mortal: boolean
    committedElement: ElementType | undefined
    specialSkillIds: ReadonlySet<string>
  },
): SkillUiEdge[] {
  if (options.mortal) {
    return entries
      .filter((entry) => entry.parentId !== null)
      .map((entry) => ({ from: entry.parentId!, to: entry.id }))
  }
  const rootId = entries.find((entry) => entry.depth === 0)?.id
  if (options.committedElement === 'fire' && rootId !== undefined) {
    const ids = new Set<string>([
      DESIGN_BASIC_ID,
      ULTIMATE_NODE_ID,
      ...entries.map((entry) => entry.id),
    ])
    return FIRE_DESIGN_EDGES.filter(([from, to]) => ids.has(from) && ids.has(to)).map(
      ([from, to]) => ({ from, to }),
    )
  }
  const specialId = entries.find((entry) =>
    entry.grantsSkillIds.some((id) => options.specialSkillIds.has(id)),
  )?.id
  if (rootId === undefined) return []
  return [
    { from: rootId, to: DESIGN_BASIC_ID },
    { from: rootId, to: ULTIMATE_NODE_ID },
    ...(specialId !== undefined ? [{ from: rootId, to: specialId }] : []),
  ]
}
