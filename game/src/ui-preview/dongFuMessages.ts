export const messages = {
  vi: {
    preview: 'BẢN DUYỆT UI', sample: 'Dữ liệu mẫu · chưa nối gameplay',
    notice: '{name} — đã chọn trong bản UI',
    identity: 'Thanh Vân', realmName: 'Luyện Khí · Tầng 11', progress: '125.600 / 130.000',
    currency: { stone: 'Linh thạch', gold: 'Vàng', crystal: 'Tinh thạch' },
    action: { realm: 'Cảnh Giới', skill: 'Kỹ Năng', body: 'Luyện Thể', alchemy: 'Luyện Đan', exploration: 'Thám Hiểm', equipment: 'Trang Bị', inventory: 'Túi Đồ', character: 'Tu Sĩ', technique: 'Tâm Pháp', feedback: 'Góp Ý', settings: 'Cài Đặt' },
    building: { chi_hien_quan: 'Chiêu Hiền Quán', equipment_hall: 'Khí Đường', pill_room: 'Đan Phòng', teleport_array: 'Truyền Tống Trận', gathering_outpost: 'Khai Vật Đường', vendor: 'Ký Bảo Các' },
    cultivating: 'Tĩnh tâm tu luyện',
    opportunity: { realm: 'Cảnh giới', alchemy: 'Luyện đan', technique: 'Tâm pháp', production: 'Khai thác', quest: 'Nhiệm vụ' },
    detail: { realm: 'Theo dõi tiến trình tu luyện', alchemy: 'Quản lý các lò đan', technique: 'Xem công pháp đang tu', production: 'Quản lý Khai Vật Đường', quest: 'Theo dõi hành trình' },
    go: 'Đến',
    journey: 'Hành trình tu tiên', questName: 'Khởi đầu tiên lộ', questHint: 'Mở bảng nhiệm vụ',
    // Production keys the shared fidelity components resolve - the
    // preview messages shadow them so the standalone page renders.
    dongFu: {
      aria: 'Động Phủ',
      toggleWheel: 'Ẩn / hiện vòng chức năng',
      buildingHint: 'Chạm để xem',
      sceneTitle: 'THANH VÂN ĐỘNG THIÊN',
      sceneSubtitle: 'Một niệm thanh tĩnh · Vạn pháp quy nguyên',
      view: 'Xem',
    },
    home: {
      thienCo: {
        title: 'Thiên Cơ Bảng', collapse: 'Thu gọn Thiên Cơ Bảng', expand: 'Mở Thiên Cơ Bảng',
        empty: 'Đạo tâm an nhiên — chưa có việc gấp.',
      },
      questTracker: { aria: 'Nhiệm vụ đang theo dõi: {name}' },
    },
  },
} as const
