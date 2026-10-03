import { bodyMessages } from './bodyMessages'
import {forgeMessages} from './forgeMessages'
export const equipmentMessages = { vi: {
  forge:forgeMessages.vi.forge,items:forgeMessages.vi.items,
  ...bodyMessages.vi, title: 'Trang Bị', subtitle: 'Linh khí hộ thân · Tiên lộ đồng hành', summary: 'Thuộc Tính Trang Bị', bag: 'Túi Trang Bị', count: '{n} món', all: 'Tất Cả', weapons: 'Vũ Khí', armor: 'Phòng Cụ', accessories: 'Phụ Kiện', sort: 'Sắp Xếp', filter: 'Lọc', enhance: 'Cường Hóa', dissolve: 'Hóa Luyện', attack: 'Tấn công', defense: 'Phòng ngự', critical: 'Bạo kích', spirit: 'Linh lực', hp: 'Khí huyết',
  slots: { kiem: 'Vũ Khí', bao: 'Đạo Bào', quan: 'Đạo Quan', hai: 'Đạo Hài', gioi: 'Linh Giới', chau: 'Linh Châu' },
  names: { kiem: 'Thanh Vân Kiếm', bao: 'Huyền Vân Bào', quan: 'Ngọc Thanh Quan', hai: 'Lưu Vân Hài', gioi: 'Bích Ngọc Giới', chau: 'Tụ Linh Châu' },
  grade: 'Thượng phẩm · Linh khí', level: 'Bậc {n}', description: 'Linh khí lưu chuyển trong từng đường nét, theo người tu hành trên con đường đăng tiên.', notice: 'Bản duyệt UI — thao tác này sẽ được nối logic sau.',
  // Namespaced keys the fidelity scene resolves (mirrors vi.json so the
  // preview never renders raw key paths).
  equipment: {
    title: 'Trang Bị', subtitle: 'Linh khí hộ thân · Tiên lộ đồng hành',
    navigation: 'Chức năng', summary: 'Thuộc Tính Trang Bị',
    bag: 'Túi Trang Bị', sort: 'Sắp Xếp', filter: 'Lọc',
    forgeTitle: 'Khí Đường · Rèn Trang Bị',
    previewStamp: 'BẢN DUYỆT UI · Dữ liệu mẫu, chưa nối gameplay',
    stats: { hp: 'Khí Huyết', attack: 'Công Kích', defense: 'Phòng Ngự' },
    bagTabs: { all: 'Tất Cả', weapons: 'Vũ Khí', armor: 'Phòng Cụ', accessories: 'Phụ Kiện' },
    workspace: { equip: 'Trang Bị', bag: 'Túi Trang Bị' },
  },
  panels: {
    equipmentHall: { tabs: { enhance: 'Cường Hóa', wash: 'Tẩy Luyện', refine: 'Tinh Luyện', dissolve: 'Hóa Luyện', decompose: 'Phân Giải' } },
  },
} } as const
