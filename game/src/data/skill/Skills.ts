import type { Skill } from '../../core/skill/Skill'
import type { ElementType } from '../../core/element/ElementType'
import { CORE_SKILLS } from './CoreSkills'
import { KIEM_TRAN_SKILLS } from './KiemTranSkills'
import { PASSIVE_SKILLS } from './PassiveSkills'
import { PHAP_TU_SKILLS } from './PhapTuChainSkills'

export const SKILLS: Skill[] = [
  ...CORE_SKILLS,

  // 9 skill Kiem Tran (chieu tran) — generated tu KIEM_TRAN_SKILLS
  // (table-driven tu TRAN_SEQUENCE trong KiemTuNodes.ts).
  ...KIEM_TRAN_SKILLS,
  ...PASSIVE_SKILLS,
  ...PHAP_TU_SKILLS,
]

// Phap Tu Reimagined — the normal Phap Tu kit: [basic, special,
// ultimate] per element. The selected element's kit is what route
// profiles scope to (the GameManager provider checks membership here),
// what resolvePlayerSpecialUltimate resolves, and what the element
// root node unlocks.
export const PHAP_TU_KIT_IDS: Record<ElementType, readonly [string, string, string]> = {
  fire: ['hoa_cau_thuat', 'tam_muoi_chan_hoa', 'hoa_ha_cuu_thien'],
  water: ['thuy_tien_thuat', 'thanh_tuyen_duong_linh', 'bac_hai_cuong_lan'],
  wood: ['doc_chuong', 'cau_mang_can_tri', 'doc_vien_bao_can'],
  metal: ['diem_kim_thuat', 'kim_lang_toan_phong', 'kim_luan_tran_ap'],
  earth: ['tho_cau_thuat', 'dia_tru_thua_thien', 'cuu_tru_dia_lao'],
}
