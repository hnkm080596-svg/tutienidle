export const skillMessages = { vi: {
  element: { fire: 'Hỏa', wood: 'Mộc', water: 'Thủy', metal: 'Kim', earth: 'Thổ' },
  skillName: { core: 'Linh Bạo', fire: 'Hỏa Cầu Thuật', wood: 'Độc Chưởng', water: 'Thủy Tiễn Thuật', metal: 'Điểm Kim Thuật', earth: 'Thổ Cầu Thuật' },
  branch: { fire: { a: 'Tụ Diễm', b: 'Tán Diễm', passive: 'Tam Muội Chân Hỏa' }, wood: { a: 'Tụ Độc', b: 'Lan Độc', passive: 'Vạn Mộc Sinh Cơ' }, water: { a: 'Ngưng Liễn', b: 'Đào Lan', passive: 'Thanh Tuyền Dưỡng Linh' }, metal: { a: 'Tụ Phong', b: 'Tán Phong', passive: 'Kim Ý Ngưng Phong' }, earth: { a: 'Tụ Nhán', b: 'Đá Loạn', passive: 'Trọng Nhạc' } },
  future: 'Nhánh mở rộng', description: 'Thông tin kỹ năng được hiển thị tại đây. Nội dung và thông số sẽ lấy từ dữ liệu kỹ năng khi nối logic.', fireDescription: 'Phóng Hỏa Cầu vào mục tiêu, có cơ hội gây Thiêu Đốt.',
  level: 'Cấp kỹ năng', effect: 'Hiệu ứng', effectValue: 'Theo dữ liệu kỹ năng',
  costSample: 'Chi phí: 5 Cảm Ngộ', lockedHint: 'Điều kiện mở nhánh sẽ được cung cấp khi nối logic.', fixtureNote: 'Dữ liệu mẫu để duyệt UI, không phải điều kiện hay cây kỹ năng chính thức.', fixtureInfoOnly: 'Kỹ năng tiền thân — chỉ để xem; tự lên cấp theo số lần xuất chiêu.', upgrade: 'Nâng Cấp', notice: 'Chỉ xem trước UI — chưa học, tăng cấp hay tiêu hao điểm.',
  navNotice: '{name} — chưa có bản duyệt trong màn này.',
  // Display names for the authored fire constellation fixture
  // (SkillConstellationLayouts fire glyph) - mirror the registry names
  // so the preview reads like the real branch.
  fireConst: {
    hoa_linh_ngo: 'Hỏa Linh Ngộ',
    hoa_an_sau: 'Hỏa Ấn Sâu',
    hoa_nhiet_keo: 'Nhiệt Kéo',
    fire_basic_hoa_tu_diem: 'Tụ Diễm',
    hoa_diem_chuan: 'Diễm Chuẩn',
    hoa_diem_tham: 'Diễm Thấm',
    fire_basic_hoa_tan_diem: 'Tán Diễm',
    fire_ailment_mastery: 'Hỏa Chưởng',
    linh_ngo_tam_muoi_chan_hoa: 'Linh Ngộ Hỏa Đặc Biệt',
    linh_bao_tien_than: 'Linh Bạo',
  },
  // Mirrors the production `skill.*` + `dongFu.aria` +
  // `panels.nodeTree.respec.*` keys the fidelity surface resolves.
  skill: {
    title: 'Kỹ Năng', navigation: 'Chức năng', preview: 'BẢN DUYỆT UI · Sơ đồ mẫu, chưa nối gameplay',
    elements: 'Ngũ Hành', tree: 'Linh Mạch Kỹ Năng', levelLabel: 'Cấp', grants: 'Kỹ năng',
    effects: 'Hiệu Ứng', conditions: 'Điều Kiện', noConditions: 'Không có điều kiện bổ sung.',
    state: { learned: 'Đã Lĩnh Ngộ', available: 'Có Thể Lĩnh Ngộ', locked: 'Chưa Đủ Điều Kiện' },
    actionDone: '{name} đã cập nhật.', actionFailed: 'Không thể thực hiện — kiểm tra điều kiện và Cảm Ngộ.',
    constellation: { legendGlyph: 'Nét chữ', legendPrereq: 'Điều kiện', canvas: 'Chòm sao {glyph}' },
  },
  dongFu: { aria: 'Về Động Phủ' },
  panels: { nodeTree: { respec: { button: 'Đặt Lại' } } },
  nav: { realm: 'Cảnh Giới', character: 'Nhân Vật', inventory: 'Túi Đồ', skill: 'Kỹ Năng', technique: 'Tâm Pháp', body: 'Luyện Thể', alchemy: 'Luyện Đan', equipment: 'Trang Bị', exploration: 'Thám Hiểm', quest: 'Nhiệm Vụ', settings: 'Cài Đặt' },
} } as const
