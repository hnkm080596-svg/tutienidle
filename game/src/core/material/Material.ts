import type { ProfessionMaterialMeta } from '../profession/ProfessionMaterial'
import type { SourceType } from './SourceType'
import type { ElementType } from '../element/ElementType'

// "tunghematandsuch" pass (2026-08-14) - them 'wood' (Linh Moc, che
// Phu) va 'byproduct' (Bui Cot/Tinh Luyen Cot, phe lieu tu Luyen
// Khi/Cuong Hoa) - 2 nhom moi hoan toan, chua co category nao khop.
export type MaterialCategory =
  'herb' | 'wood' | 'ore' | 'monster_core' | 'spirit_stone' | 'essence' | 'byproduct' | 'other'

/**
 * "tunghematandsuch" pass (muc 3) - co y giu TOI GIAN
 * (name/category/years/element/sourceType/description), KHONG them
 * Rarity/Quality/Grade/Purity/Potential - tranh lap lai chong cheo
 * Quality+Rarity+pham chat+nien dai ma tai lieu canh bao. `grade:
 * number` cu da XOA (confirmed khong noi nao trong code doc field
 * nay, thuan authoring - khong mat logic gi). Tai lieu con de xuat
 * `BaseValue` (gia tri kinh te) nhung game CHUA co he thong vendor/
 * pricing nao tieu thu no - bo qua field nay, tranh lap lai loi
 * "material chet" (field khong ai doc) da rut kinh nghiem o luot
 * naming-principles truoc.
 */
export interface Material {
  id: string

  name: string

  category: MaterialCategory

  // "Nien dai" (tai lieu muc 1-2, 6-7) - truc suc manh cua nguyen lieu
  // tu nhien (Linh Thao/Linh Moc/Linh Thiet), KHONG phai 1 loai
  // Quality rieng - quyet dinh TRAN pham cap toi da ma 1 cong thuc
  // dung nguyen lieu nay co the dat toi (xem data/alchemy/alchemyRecipes.ts).
  // Khong khai = khong ap dung truc nien dai (material Yeu Tai/phe
  // lieu/currency dac thu khac).
  years?: number

  element?: ElementType

  // Nguon CHINH cua material nay (MASTER SPEC Muc II-V) - xem
  // SourceType.ts's ghi chu: nhan phan loai, khong phai rang buoc
  // cung chi nguon do moi duoc roi.
  sourceType: SourceType

  description?: string

  // Metadata nghe (2026-08-24, resource-professions-rework plan sec4.1) -
  // optional nen save/legacy material khong co van load binh thuong;
  // consumer moi (catalog/reward/recipe/validator) bat buoc material co
  // meta day du.
  profession?: ProfessionMaterialMeta

  // PNG icon cua template; khong nam trong save stack nen co the bo sung
  // dan ma khong can migration.
  icon?: string

  // Tran stack rieng (plan Workstream F) - undefined = MAX_STACK_AMOUNT
  // chung. Linh Thach dat MAX_SAFE_INTEGER vi chi phi Dot Pha scale toi
  // hang ty; MaterialBag.add() doc field nay luc clamp.
  stackLimit?: number

  // M-F-CEILING - realm this material's breakthrough prepares for (e.g.
  // the Truc Co gate inputs tag 'foundation_establishment'). Breakthrough-
  // scoped acquisition routes consult isBreakthroughAcquisitionEnabled()
  // from ReleasePolicy; untagged materials are never release-suppressed.
  // Optional, so save/legacy material without the field loads unchanged.
  breakthroughRealmId?: string

  // M-F-ARTIFACT-DEFER - the DOMAIN whose unlock realm gates delivery of
  // this material (the artifact domain today). Authored via the shared
  // domain declaration (ARTIFACT_UNLOCK_REALM_ID), never a realm literal;
  // domain-scoped routes consult isDomainScopedAcquisitionEnabled() which
  // composes window + player-reach, so a below-unlock player gets nothing
  // even once the unlock realm ships. Untagged materials are never
  // domain-suppressed. Optional, same save/load convention as above.
  domainUnlockRealmId?: string
}
