// Trận Pháp (Formation) content — spec 2026-09-05.
// Mỗi trận pháp có một cellPattern cố định (không gian cục bộ 6x6),
// được map lên PLAYER_SIDE_REGION tuyệt đối qua localCellToAbsolute()
// trong FormationPlacement.ts (Task 18). Mỗi trận pháp chỉ có MỘT buff
// đồng nhất áp dụng chung, không có vai trò riêng theo từng ô. Tất cả
// trận pháp đều mở sẵn từ đầu, không có điều kiện unlock.
// File này chỉ ship cơ chế (types + mảng nội dung rỗng); nội dung
// roster/buff thực tế là công việc content riêng, làm ở task sau.
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

export const TRAN_PHAP_FORMATIONS: readonly TranPhapDefinition[] = []
