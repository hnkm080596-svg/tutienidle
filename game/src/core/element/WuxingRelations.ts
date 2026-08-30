import type { ElementType } from './ElementType'

// Spec 2026-08-30-phap-tu-dao-sac §3.4 — bảng quan hệ sinh/khắc ngũ
// hành, nguồn sự thật DUY NHẤT cho: (1) Luân Chuyển/Chế Khắc adjacency
// của Đa Pháp (core/battle/AdjacencySystem), (2) relation metadata
// reaction (§4), (3) UI ngôi sao 5 cánh (cạnh ngoài = sinh, đường
// chéo = khắc). 5 hành = vòng khép kín: đỉnh cuối sinh về đỉnh đầu.

export type WuxingRelation = 'sinh' | 'khac' | 'none'

// Mộc→Hỏa→Thổ→Kim→Thủy→(về Mộc)
export const SINH_CYCLE: readonly ElementType[] = ['wood', 'fire', 'earth', 'metal', 'water']

// Mộc⇄Thổ, Thổ⇄Thủy, Thủy⇄Hỏa, Hỏa⇄Kim, Kim⇄Mộc — mỗi cặp là 2 đỉnh
// cách nhau 1 đỉnh trên SINH_CYCLE (i và i+2 mod 5), đối xứng 2 chiều.
const KHAC_PAIRS: ReadonlyArray<readonly [ElementType, ElementType]> = [
  ['wood', 'earth'],
  ['earth', 'water'],
  ['water', 'fire'],
  ['fire', 'metal'],
  ['metal', 'wood'],
]

/** Quan hệ ĐƠN HƯỚNG theo chiều "from sinh/khắc to": from sinh to nếu
 * to đứng ngay sau from trên SINH_CYCLE; khắc nếu là cặp chéo (đối
 * xứng); cùng hành hoặc còn lại → 'none'. Sinh KHÔNG đối xứng (Mộc
 * sinh Hỏa nhưng Hỏa không sinh Mộc) — đúng ngữ nghĩa Chế Khắc chỉ
 * tính chiều "skill sau" (spec §3.3: B khắc A thì đòn B được cường hóa). */
export function wuxingRelation(from: ElementType, to: ElementType): WuxingRelation {
  if (from === to) {
    return 'none'
  }

  if (SINH_CYCLE[(SINH_CYCLE.indexOf(from) + 1) % SINH_CYCLE.length] === to) {
    return 'sinh'
  }

  return KHAC_PAIRS.some(([a, b]) => (a === from && b === to) || (a === to && b === from))
    ? 'khac'
    : 'none'
}

/** Loadout là vòng sinh khép kín khi đúng 5 slot và mỗi slot sinh
 * slot kế (slot cuối sinh về slot đầu) — điều kiện tầng Luân Chuyển
 * (spec §3.2: hoàn tất 1 vòng quay đủ chu trình). */
export function isSinhCycle(loadout: ElementType[]): boolean {
  if (loadout.length !== SINH_CYCLE.length) {
    return false
  }

  for (let i = 0; i < loadout.length; i++) {
    const next = loadout[(i + 1) % loadout.length]!

    if (wuxingRelation(loadout[i]!, next) !== 'sinh') {
      return false
    }
  }

  return true
}
