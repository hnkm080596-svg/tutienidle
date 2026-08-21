import type { Equipment } from '../equipment/Equipment'
import type { Pill } from '../pill/Pill'
import type { Talisman } from '../talisman/Talisman'
import type { Material } from '../material/Material'

/**
 * Wrapper hợp nhất 4 loại item của game dưới một type duy nhất,
 * dùng cho ItemRegistry.get()/getAll(). Không gộp field của 4
 * interface gốc vào một base chung: Equipment/Pill/Talisman/Material
 * đã có shape ổn định riêng (Material.category ví dụ đang mang
 * nghĩa khác — herb/ore/...), gộp field sẽ phải sửa lại các file đó
 * ngoài phạm vi hệ thống Item.
 */
export type Item =
  | { category: 'equipment'; item: Equipment }
  | { category: 'pill'; item: Pill }
  | { category: 'talisman'; item: Talisman }
  | { category: 'material'; item: Material }
