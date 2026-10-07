export const skillMessages = { vi: {
  element: { fire: 'Hỏa', wood: 'Mộc', water: 'Thủy', metal: 'Kim', earth: 'Thổ' },
  skillName: { core: 'Linh Bạo', fire: 'Ly Hỏa Thuật', wood: 'Độc Chưởng', water: 'Thủy Tiễn Thuật', metal: 'Điểm Kim Thuật', earth: 'Thổ Cầu Thuật' },
  branch: { fire: { a: 'Tụ Diễm', b: 'Tán Diễm', passive: 'Ngự Diễm' }, wood: { a: 'Tụ Độc', b: 'Lan Độc', passive: 'Vạn Mộc Sinh Cơ' }, water: { a: 'Ngưng Liễn', b: 'Đào Lan', passive: 'Thanh Tuyền Dưỡng Linh' }, metal: { a: 'Tụ Phong', b: 'Tán Phong', passive: 'Kim Ý Ngưng Phong' }, earth: { a: 'Tụ Nhán', b: 'Đá Loạn', passive: 'Trọng Nhạc' } },
  future: 'Nhánh mở rộng', description: 'Thông tin kỹ năng được hiển thị tại đây. Nội dung và thông số sẽ lấy từ dữ liệu kỹ năng khi nối logic.', fireDescription: 'Phóng đoàn Ly Hỏa vào mục tiêu, có cơ hội gây Hỏa Ấn.',
  level: 'Cấp kỹ năng', effect: 'Hiệu ứng', effectValue: 'Theo dữ liệu kỹ năng',
  costSample: 'Chi phí: 5 Cảm Ngộ', lockedHint: 'Điều kiện mở nhánh sẽ được cung cấp khi nối logic.', fixtureNote: 'Dữ liệu mẫu để duyệt UI, không phải điều kiện hay cây kỹ năng chính thức.', upgrade: 'Nâng Cấp', notice: 'Chỉ xem trước UI — chưa học, tăng cấp hay tiêu hao điểm.',
  navNotice: '{name} — chưa có bản duyệt trong màn này.',
  // Display names for the authored fire constellation fixture
  // (SkillConstellationLayouts fire glyph) - mirror the registry names
  // so the preview reads like the real branch.
  fireConst: {
    hoa_linh_ngo: 'Hỏa Chủng',
    hoa_an_sau: 'Khắc Ấn',
    hoa_nhiet_keo: 'Dư Tẫn',
    fire_basic_hoa_tu_diem: 'Tụ Diễm',
    hoa_diem_chuan: 'Dẫn Hỏa',
    hoa_diem_tham: 'Thấu Hỏa',
    fire_basic_hoa_tan_diem: 'Tán Diễm',
    fire_ailment_mastery: 'Liệt Hỏa',
    linh_ngo_tam_muoi_chan_hoa: 'Tam Muội Chân Ý',
    // Fire rulings 2026-10-06 - Ly Hoa hit chain + Tam Muoi trades +
    // solo mana branch (mirror PhapTuBasicNodes.buildFire).
    hoa_diem_uy: 'Diễm Uy',
    hoa_hoa_nhan: 'Hỏa Nhãn',
    hoa_pha_giap_diem: 'Phá Giáp Diễm',
    hoa_bao_diem: 'Bạo Diễm',
    hoa_phe_diem: 'Phệ Diễm',
    ngu_hoa: 'Ngự Hỏa',
    ngu_viem_tam: 'Ngự Viêm Tâm',
    ngu_viem_y: 'Ngự Viêm Ý',
    ho_the: 'Hộ Thể',
    nguyen_kinh: 'Nguyên Kính',
    linh_chuong: 'Linh Chướng',
    the_diem_kinh: 'Thể Diễm Kính',
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
  nav: { realm: 'Cảnh Giới', character: 'Tu Sĩ', inventory: 'Túi Đồ', skill: 'Kỹ Năng', technique: 'Tâm Pháp', body: 'Luyện Thể', alchemy: 'Luyện Đan', equipment: 'Trang Bị', exploration: 'Thám Hiểm', quest: 'Nhiệm Vụ', settings: 'Cài Đặt' },
} } as const
