// Căn Cơ (mục 5/17 spec `breakthrough`) — các mốc kết quả của cấp đột
// phá. Thiết kế hiện tại (2026-08-27) mới mở mốc baseline 'human'
// (Nhân Đạo ở mốc 12 tầng); các mốc ẩn khác sẽ được thiết kế sau.
// KHÔNG BAO GIỜ hiển thị làm lựa chọn hay lộ lý do resolve ra mốc nào
// (mục 10 — hard rule "không bao giờ báo sai điều kiện").
export type FoundationType = 'human' | 'earth' | 'heaven' | 'great_dao'

export const FOUNDATION_LABELS: Record<FoundationType, string> = {
  human: 'Nhân Đạo',
  earth: 'Địa Đạo',
  heaven: 'Thiên Đạo',
  great_dao: 'Đại Đạo',
}
