import { bodyMessages } from './bodyMessages'
export const alchemyMessages = { vi: {
  ...bodyMessages.vi,
  pills: { tu_linh_dan: 'Tụ Linh Đan', thoi_the_dan: 'Thối Thể Đan', hoi_xuan_dan: 'Hồi Xuân Đan', hoi_linh_dan: 'Hồi Linh Đan', duong_than_dan: 'Dưỡng Thần Đan', to_cot_dan: 'Tố Cốt Đan' },
  herbs: { tu_linh_thao: 'Tụ Linh Thảo', thoi_the_thao: 'Thối Thể Thảo', hoi_xuan_thao: 'Hồi Xuân Thảo', hoi_linh_thao: 'Hồi Linh Thảo', duong_than_thao: 'Dưỡng Thần Thảo', to_cot_thao: 'Tố Cốt Thảo' },
  age: { decade: 'Thập niên', century: 'Bách niên' }, grade: 'Đan phương · Bậc {n}', herbName: '{name} · {age}',
  descriptions: { tu_linh_dan: 'Linh đan ngưng tụ tinh hoa dược thảo, hỗ trợ người tu hành bồi dưỡng linh khí.', thoi_the_dan: 'Tinh luyện dược lực để bồi dưỡng căn cơ và rèn luyện thân thể.', hoi_xuan_dan: 'Dược hương thanh dịu, dùng để điều dưỡng khí huyết.', hoi_linh_dan: 'Đan dược chứa linh khí thuần hòa, hỗ trợ khôi phục linh lực.', duong_than_dan: 'Dược lực ôn hòa, giúp tĩnh tâm và dưỡng thần.', to_cot_dan: 'Tinh hoa dược thảo được luyện thành đan, dùng để bồi dưỡng gân cốt.' },
  fuel: 'Nhiên liệu', fuelValue: 'Linh Mộc · 25 / 5', stone: 'Tiêu hao linh thạch', durationValue: '00:30:00',
  outcomeValue: '{name} · Chắc chắn 1 viên',
  notice: 'Chỉ duyệt UI — chưa luyện đan hoặc tiêu hao nguyên liệu.', cancelNotice: 'Chỉ duyệt UI — chưa hủy công việc hay hoàn nguyên liệu.',
  // Mirrors the production `alchemy.*` + `dongFu.aria` keys the fidelity
  // surface resolves.
  alchemy: {
    title: 'Luyện Đan', subtitle: 'Luyện linh thảo · Kết linh đan', navigation: 'Chức năng',
    previewStamp: 'BẢN DUYỆT UI · Dữ liệu mẫu, chưa nối gameplay',
    recipe: 'Danh Sách Đan Phương', cauldron: 'Đan Lô', selectedHerb: 'Dược thảo đã chọn',
    herb: 'Chọn Dược Thảo', preview: 'Xem Trước Thành Phẩm', durationLabel: 'Thời gian luyện',
    startBrewing: 'Bắt Đầu Luyện Đan', queueTitle: 'Hàng Chờ Luyện Đan', cancelJob: 'Hủy công việc',
    emptySlot: 'Ô luyện đang trống', emptyRecipes: 'Chưa có đan phương nào.',
    emptyDetail: 'Chọn đan phương để xem chi tiết.', placeIngredients: 'Đặt nguyên liệu vào đan lô',
  },
  dongFu: { aria: 'Về Động Phủ' },
} } as const
