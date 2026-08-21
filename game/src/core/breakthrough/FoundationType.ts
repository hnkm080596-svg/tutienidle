// Căn Cơ (mục 5/17 spec `breakthrough`) — 4 mốc kết quả ẨN mà
// FoundationResolver âm thầm xác định khi người chơi bấm "TRÚC CƠ".
// KHÔNG BAO GIỜ hiển thị làm lựa chọn hay lộ lý do resolve ra mốc nào
// (mục 10 — hard rule "không bao giờ báo sai điều kiện").
export type FoundationType = 'human' | 'earth' | 'heaven' | 'great_dao'

export const FOUNDATION_LABELS: Record<FoundationType, string> = {
  human: 'Nhân Đạo',
  earth: 'Địa Đạo',
  heaven: 'Thiên Đạo',
  great_dao: 'Đại Đạo',
}
