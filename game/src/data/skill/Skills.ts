import type { Skill } from '../../core/skill/Skill'
import type { ElementType } from '../../core/element/ElementType'
import { CORE_SKILLS } from './CoreSkills'
import { PASSIVE_SKILLS } from './PassiveSkills'
import { PHAP_TU_SKILLS } from './PhapTuChainSkills'
import { PHAP_TU_ROUTE_SKILLS } from './PhapTuRouteSkills'

export const SKILLS: Skill[] = [
  ...CORE_SKILLS,
  ...PASSIVE_SKILLS,
  ...PHAP_TU_SKILLS,
  ...PHAP_TU_ROUTE_SKILLS,
]

// Phap Tu Reimagined — the normal Phap Tu kit: [basic, special,
// ultimate] per element. The selected element's kit is what route
// profiles scope to (the GameManager provider checks membership here),
// what resolvePlayerSpecialUltimate resolves, and what the element
// root node unlocks.
export const SPELL_KIT_IDS: Record<ElementType, readonly [string, string, string]> = {
  fire: ['hoa_cau_thuat', 'tam_muoi_chan_hoa', 'hoa_ha_cuu_thien'],
  water: ['thuy_tien_thuat', 'thanh_tuyen_duong_linh', 'bac_hai_cuong_lan'],
  wood: ['doc_chuong', 'cau_mang_can_tri', 'doc_vien_bao_can'],
  metal: ['diem_kim_thuat', 'kim_lang_toan_phong', 'kim_luan_tran_ap'],
  earth: ['tho_cau_thuat', 'dia_tru_thua_thien', 'cuu_tru_dia_lao'],
}

// Phap Tu route skills (spec 2026-09-17 Hoa An sec.62) -- learnable
// element skills OUTSIDE the [basic, special, ultimate] kit slots but
// INSIDE the route-profile scope: the GameManager provider unions this
// list with SPELL_KIT_IDS so route factors (application chance,
// stack bonus, direct multiplier) apply to seal applications they
// author. Only Hoa exists today -- the other elements fill in as their
// route kits are authored.
export const SPELL_ROUTE_SKILL_IDS: Record<ElementType, readonly string[]> = {
  fire: ['dan_hoa_quyet', 'xich_viem_xuyen_tam', 'phan_thien_hoa_vuc', 'cuu_tieu_viem_bao'],
  water: [],
  wood: [],
  metal: [],
  earth: [],
}
