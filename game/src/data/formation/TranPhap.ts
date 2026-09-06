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

// Hỗn Độn Trận (2026-09-06, visual test tooling) — TEST-ONLY: mở toàn bộ
// 36 ô của lưới cục bộ 6x6, dùng để test panel/wiring khi chưa có nội
// dung Trận Pháp thật. Xoá khi có formation thật đầu tiên thay thế vai
// trò "stress-test mọi ô" này.
function allLocalCells(): TranPhapCell[] {
  const cells: TranPhapCell[] = []

  for (let row = 0; row <= 5; row++) {
    for (let column = 0; column <= 5; column++) {
      cells.push({ row, column })
    }
  }

  return cells
}

const HON_DON_TRAN: TranPhapDefinition = {
  id: 'hon_don_tran',
  name: 'Hỗn Độn Trận',
  cellPattern: allLocalCells(),
  buff: { definitionId: 'hon_don_tran_test_buff' },
  description: 'TEST-ONLY — mở toàn bộ 36 ô để kiểm tra wiring đội hình.',
}

export const TRAN_PHAP_FORMATIONS: readonly TranPhapDefinition[] = [HON_DON_TRAN]
