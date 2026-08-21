export interface TutorialStep {
  title: string

  body: string
}

// Beta Phase 4 (mục XV tài liệu) — carousel giải thích core loop,
// KHÔNG ép người chơi thực sự bấm đúng nút mới qua bước (xem Context
// trong kế hoạch — Combat/Loot chưa có instrumentation để "biết"
// người chơi vừa làm xong 1 bước). Nội dung THUẦN hướng dẫn cách
// chơi — TUYỆT ĐỐI không nhắc Đại Đạo/Căn Cơ/hidden condition/vượt
// tầng bí mật, đúng "Tutorial dạy cách chơi, không dạy bí mật".
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Chào mừng Đạo Hữu',
    body: 'Con đường tu tiên bắt đầu từ đây. Bấm Menu (hoặc phím Tab) bất cứ lúc nào để mở bảng điều hướng tới các khu vực.',
  },
  {
    title: 'Động Phủ',
    body: 'Nơi tu luyện chính — theo dõi tu vi, cảnh giới, và trang bị Tâm Pháp Tu Luyện. Tu vi tự tích lũy theo thời gian, kể cả khi không chiến đấu.',
  },
  {
    title: 'Đột Phá',
    body: 'Khi tu vi đã đủ, nút ĐỘT PHÁ xuất hiện — bấm để tăng tầng tu vi. Càng lên cao, tu luyện càng cần chuẩn bị kỹ hơn.',
  },
  {
    title: 'Khí Đường',
    body: 'Quản lý trang bị — mặc/tháo, Cường Hóa, Tẩy Luyện và nhiều thao tác khác để trang bị mạnh hơn. Cần nguyên liệu cho mỗi thao tác.',
  },
  {
    title: 'Trang Bị',
    body: 'Trang bị mạnh hơn giúp Chiến Lực tăng, sống sót tốt hơn khi chiến đấu và thám hiểm.',
  },
  {
    title: 'Thám Hiểm',
    body: 'Cử đi thám hiểm để thu thập nguyên liệu theo thời gian — không cần túc trực, quay lại thu hoạch khi hoàn thành.',
  },
  {
    title: 'Chiến Đấu',
    body: 'Bấm CHIẾN ĐẤU ở thanh dưới để vào trận — nhân vật tự động tấn công. Bật AUTO để tự động đánh tiếp khi thắng.',
  },
  {
    title: 'Chiến Lợi Phẩm',
    body: 'Quái vật rơi nguyên liệu, đan dược, trang bị — mọi thứ tự động vào túi đồ, không cần nhặt thủ công. Dùng chúng để chế tạo và nâng cấp.',
  },
  {
    title: 'Bắt Đầu Thôi',
    body: 'Đó là những điều cơ bản. Phần còn lại — hãy để Đạo Hữu tự mình khám phá.',
  },
]
