import type { PillType } from './PillTypes'
import type { PillEffect } from './PillEffect'
import type { ItemGrade } from '../item/ItemGrade'
import type { ProfessionGrade } from '../profession/ProfessionGrade'

export interface Pill {
  id: string

  name: string

  description?: string

  // Path anh minh hoa - khai NGAY TREN data item (2026-08-15), xem
  // ghi chu tuong tu trong core/technique/Technique.ts.
  icon?: string

  type: PillType

  // Naming-principles pass (2026-08-14) - thay `grade: number` cu,
  // dung CHUNG thang Ngu Pham voi Equipment/Talisman/Formation (xem
  // core/item/Pham.ts) - Pham o day la driver THAT (khong phai nhan
  // suy ra), quyet dinh truc tiep do manh effect. Ten ghep dong
  // (2026-08-15) - `name` ben tren KHONG chua tien to Pham, ghep dong
  // luc hien thi tu field nay (xem composeItemGradeNameSegments()).
  grade: ItemGrade

  // Nghe Dan moi (2026-08-24, resource-professions-rework sec5.1): realm
  // + pham nghe theo canh gioi. Pill CO realmId bi gate DUNG canh gioi
  // khi dung (wrong_realm - plan sec5.2); legacy pill khong co field nay
  // giu hanh vi cu.
  realmId?: string

  // M-F-CEILING - realm this pill's breakthrough prepares for (e.g. Truc
  // Co Dan tags 'foundation_establishment'). Breakthrough-scoped
  // acquisition routes consult isBreakthroughAcquisitionEnabled() from
  // ReleasePolicy; `realmId` above stays the usage gate, and untagged
  // pills are never release-suppressed.
  breakthroughRealmId?: string

  professionGrade?: ProfessionGrade

  effects: PillEffect[]

  /**
   * M10 (ARCH-008) - retired family (Hoi Xuan Dan): the item still resolves
   * for bag display / old saves, but consumption is rejected explicitly
   * (usePillDetailed -> 'retired'). Never silently inert.
   */
  retired?: boolean
}
