import type { Equipment } from '../equipment/Equipment'
import type { Pill } from '../pill/Pill'
import type { Talisman } from '../talisman/Talisman'
import type { Material } from '../material/Material'

/**
 * Wrapper hop nhat 4 loai item cua game duoi mot type duy nhat,
 * dung cho ItemRegistry.get()/getAll(). Khong gop field cua 4
 * interface goc vao mot base chung: Equipment/Pill/Talisman/Material
 * da co shape on dinh rieng (Material.category vi du dang mang
 * nghia khac - herb/ore/...), gop field se phai sua lai cac file do
 * ngoai pham vi he thong Item.
 */
export type Item =
  | { category: 'equipment'; item: Equipment }
  | { category: 'pill'; item: Pill }
  | { category: 'talisman'; item: Talisman }
  | { category: 'material'; item: Material }
