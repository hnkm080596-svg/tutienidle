export const techniqueMessages = { vi: {
  name: 'Vạn Kiếm Quyết', quality: 'Huyền Phẩm', description: 'Lấy tâm ngự kiếm, lấy khí dưỡng thần. Kiếm ý hội tụ, từng bước lĩnh ngộ đạo pháp.',
  combat: 'Chiến Đấu', system: 'Hệ', systemValue: 'Kiếm Tu', might: 'Sức mạnh', defense: 'Phòng ngự', mana: 'Linh lực tối đa',
  rank: 'Cảnh 1 · Tầng 7 / 18', stage: { entry: 'Sơ Nhập', minor: 'Tiểu Thành', major: 'Đại Thành', complete: 'Viên Mãn' },
  currentGrade: 'Phẩm 1', nextGrade: 'Phẩm 2', material: 'Linh Thạch', materialNote: 'Tên và số lượng là dữ liệu mẫu để duyệt bố cục.',
  notice: 'Chỉ xem trước UI — chưa nâng cảnh hay tiêu hao nguyên liệu.', navNotice: '{name} — chưa có bản duyệt trong màn này.', selection: 'Đang xem: {name}. Không thay đổi tiến trình tu luyện.',
  // Mirrors the production `technique.*` + `dongFu.aria` keys the
  // fidelity components resolve through i18n.
  technique: {
    title: 'Tâm Pháp', navigation: 'Chức năng', preview: 'BẢN DUYỆT UI · Dữ liệu mẫu, chưa nối gameplay',
    active: 'TÂM PHÁP ĐANG TU LUYỆN', artifact: 'Bí kíp tâm pháp',
    artifactAlt: 'Bí kíp mở với nét mực và đường linh khí vàng',
    temporaryArt: 'Minh họa tạm · Có thể thay theo tâm pháp',
    training: 'Tiến Cảnh Tâm Pháp', mastery: 'Độ thuần thục',
    advance: 'Nâng Cảnh', current: 'Hiện tại', target: 'Kế tiếp',
    upgradeHint: 'Tiếp nối con đường tu luyện, mở cảnh tiếp theo của tâm pháp.',
    materials: 'Nguyên Liệu Cần',
    stageNotice: 'Đang xem: {name}. Không thay đổi tiến trình tu luyện.',
    advanceNotice: 'Tâm pháp đã lên {grade}.',
  },
  dongFu: { aria: 'Về Động Phủ' },
  nav: { realm: 'Cảnh Giới', character: 'Nhân Vật', inventory: 'Túi Đồ', skill: 'Kỹ Năng', technique: 'Tâm Pháp', body: 'Luyện Thể', alchemy: 'Luyện Đan', equipment: 'Trang Bị', exploration: 'Thám Hiểm' },
} } as const
