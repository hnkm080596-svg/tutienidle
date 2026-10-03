export const bodyMessages = { vi: {
  chapter:{refinement:'Luyện Thể',meridian:'Bát Mạch',cycle:'Chu Thiên'}, chapterHint:{refinement:'Cường hóa thân thể',meridian:'Khai thông kinh mạch',cycle:'Vận chuyển chân khí'},
  tier:'Tầng {n}', vessel:'Mạch {n}', milestone:'Mốc {n}', unitTitle:'{chapter} · {unit}', description:'Rèn luyện thân thể, bồi dưỡng kinh mạch. Thông tin và lợi ích của mốc được hiển thị tại đây.',
  hp:'Khí huyết', might:'Sức mạnh', defense:'Phòng ngự', invest:'Tu Luyện',
  resource:{refinement:'Tinh Hoa Phàm Thể',meridian:'Thông Mạch Đan',cycle:'Tinh Hoa Pháp Thể'},
  lockedHint:'Điều kiện mở mốc sẽ được cung cấp khi nối logic.',
  notice:'Chỉ xem trước UI — chưa tu luyện hay tiêu hao nguyên liệu.', navNotice:'{name} — chưa có bản duyệt trong màn này.',
  // Mirrors the production `body.*` + `dongFu.aria` keys the fidelity
  // surface resolves.
  body:{
    title:'Luyện Thể', navigation:'Chức năng', chapters:'Các chương đạo thể', units:'Các mốc tu luyện',
    progress:'Tiến độ', gains:'Thông Tin Mốc', material:'Nguyên Liệu Cần',
    noGains:'Không có hiệu ứng bổ sung.', noCost:'Không tốn nguyên liệu.', empty:'Chưa có mốc nào.',
    state:{done:'Đã Đạt',current:'Hiện Tại',locked:'Chưa Mở'},
    investDone:'Tu luyện thành công.', investUnavailable:'Chưa đủ điều kiện tu luyện.',
    preview:'BẢN DUYỆT UI · Dữ liệu mẫu, chưa nối gameplay',
  },
  dongFu:{aria:'Về Động Phủ'},
  nav:{realm:'Cảnh Giới',character:'Nhân Vật',inventory:'Túi Đồ',skill:'Kỹ Năng',technique:'Tâm Pháp',body:'Luyện Thể',alchemy:'Luyện Đan',equipment:'Trang Bị',exploration:'Thám Hiểm',quest:'Nhiệm Vụ',settings:'Cài Đặt'},
} } as const
