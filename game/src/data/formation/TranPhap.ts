// Tran Phap (Formation) content - spec 2026-09-05, standing-slot rework
// 2026-09-07: local pattern space is 3x3 (9 standing slots), mapped onto
// PLAYER_SIDE_REGION absolutes via localCellToAbsolute() in
// FormationPlacement.ts. Each formation carries ONE shared buff - there
// is no per-cell role. All formations are unlocked from the start.
//
// B2 production roster (2026-09-14): the spec's tradeoff guideline is
// "fewer slots = stronger buff", so the ladder runs 1/2/3/5/9 cells.
// Local column 0 is the back rank (far from the enemy side), column 2 is
// the front rank (nearest the divider/enemy region).
export interface TranPhapCell {
  row: number
  column: number
}

export interface TranPhapDefinition {
  id: string
  name: string
  cellPattern: readonly TranPhapCell[]
  buff: { definitionId: string }
  description: string
}

function allLocalCells(): TranPhapCell[] {
  const cells: TranPhapCell[] = []

  for (let row = 0; row <= 2; row++) {
    for (let column = 0; column <= 2; column++) {
      cells.push({ row, column })
    }
  }

  return cells
}

const DOC_HANH_TRAN: TranPhapDefinition = {
  id: 'doc_hanh_tran',
  name: 'Độc Hành Trận',
  cellPattern: [{ row: 1, column: 2 }],
  buff: { definitionId: 'tran_phap_doc_hanh_buff' },
  description:
    'Trận độc hành — chỉ một mình đứng mũi nhọn giữa trận, đổi chỗ trống lấy sức mạnh: +12% công, +12% thủ.',
}

const LUONG_NGHI_TRAN: TranPhapDefinition = {
  id: 'luong_nghi_tran',
  name: 'Lưỡng Nghi Trận',
  cellPattern: [
    { row: 1, column: 0 },
    { row: 1, column: 2 },
  ],
  buff: { definitionId: 'tran_phap_luong_nghi_buff' },
  description:
    'Hai cực tiền-hậu hỗ trợ lẫn nhau — hai chiến viện, +10% công cho cả đội hình.',
}

const TAM_TAI_TRAN: TranPhapDefinition = {
  id: 'tam_tai_tran',
  name: 'Tam Tài Trận',
  cellPattern: [
    { row: 0, column: 0 },
    { row: 1, column: 2 },
    { row: 2, column: 0 },
  ],
  buff: { definitionId: 'tran_phap_tam_tai_buff' },
  description:
    'Tam tài thiên-địa-nhân bày thế mũi nhọn — ba chiến viện, +6% công và +6% tốc độ.',
}

const NGU_HANH_TRAN: TranPhapDefinition = {
  id: 'ngu_hanh_tran',
  name: 'Ngũ Hành Trận',
  cellPattern: [
    { row: 0, column: 0 },
    { row: 0, column: 2 },
    { row: 1, column: 1 },
    { row: 2, column: 0 },
    { row: 2, column: 2 },
  ],
  buff: { definitionId: 'tran_phap_ngu_hanh_buff' },
  description:
    'Ngũ hành tương sinh giữ vững đội hình — năm chiến viện, +4% công và +6% thủ.',
}

const CUU_CUNG_TRAN: TranPhapDefinition = {
  id: 'cuu_cung_tran',
  name: 'Cửu Cung Trận',
  cellPattern: allLocalCells(),
  buff: { definitionId: 'tran_phap_cuu_cung_buff' },
  description:
    'Cửu cung bày đủ chín vị trí — chín chiến viện cùng trận, +2% công và +2% thủ.',
}

export const TRAN_PHAP_FORMATIONS: readonly TranPhapDefinition[] = [
  DOC_HANH_TRAN,
  LUONG_NGHI_TRAN,
  TAM_TAI_TRAN,
  NGU_HANH_TRAN,
  CUU_CUNG_TRAN,
]
