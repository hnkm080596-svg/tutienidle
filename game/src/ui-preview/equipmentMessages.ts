import { bodyMessages } from './bodyMessages'
import {forgeMessages} from './forgeMessages'
export const equipmentMessages = { vi: {
  forge:forgeMessages.vi.forge,items:forgeMessages.vi.items,
  ...bodyMessages.vi, title: 'Trang Bị', subtitle: 'Linh khí hộ thân · Tiên lộ đồng hành', summary: 'Thuộc Tính Trang Bị', bag: 'Túi Trang Bị', count: '{n} món', all: 'Tất Cả', weapons: 'Vũ Khí', armor: 'Phòng Cụ', accessories: 'Phụ Kiện', sort: 'Sắp Xếp', filter: 'Lọc', enhance: 'Cường Hóa', dissolve: 'Hóa Luyện', attack: 'Tấn công', defense: 'Phòng ngự', critical: 'Bạo kích', spirit: 'Linh lực', hp: 'Khí huyết',
  slots: { kiem: 'Vũ Khí', bao: 'Đạo Bào', quan: 'Đạo Quan', hai: 'Đạo Hài', gioi: 'Linh Giới', chau: 'Linh Châu' },
  names: { kiem: 'Thanh Vân Kiếm', bao: 'Huyền Vân Bào', quan: 'Ngọc Thanh Quan', hai: 'Lưu Vân Hài', gioi: 'Bích Ngọc Giới', chau: 'Tụ Linh Châu' },
  grade: 'Thượng phẩm · Linh khí', level: 'Bậc {n}', description: 'Linh khí lưu chuyển trong từng đường nét, theo người tu hành trên con đường đăng tiên.', notice: 'Bản duyệt UI — thao tác này sẽ được nối logic sau.',
} } as const
