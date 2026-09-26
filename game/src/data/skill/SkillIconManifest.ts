// Three-path design (2026-09-25, sec.5.1) -- iconKey -> asset path
// manifest. Placeholder PNGs live at /assets/skills/<key>.png and are
// deliberately replaceable by the user's own art later; an unknown or
// missing key degrades to the slot monogram (SlotView 404 fallback).

export const SKILL_ICON_MANIFEST: Record<string, string> = {
  // Mortal precursor cast-leveled skills.
  tram: '/assets/skills/tram.png',
  linh_bao: '/assets/skills/linh_bao.png',
  huy_quyen: '/assets/skills/huy_quyen.png',

  // 5 Phap Tu element basics.
  hoa_cau_thuat: '/assets/skills/hoa_cau_thuat.png',
  thuy_tien_thuat: '/assets/skills/thuy_tien_thuat.png',
  doc_chuong: '/assets/skills/doc_chuong.png',
  diem_kim_thuat: '/assets/skills/diem_kim_thuat.png',
  tho_cau_thuat: '/assets/skills/tho_cau_thuat.png',

  // Phap Tu An (Ngo Dao) kit.
  van_phap_tuy_tam: '/assets/skills/van_phap_tuy_tam.png',
  da_phap_lien_tuyen: '/assets/skills/da_phap_lien_tuyen.png',
}

export function skillIconPath(iconKey: string | undefined): string | undefined {
  if (!iconKey) {
    return undefined
  }

  return SKILL_ICON_MANIFEST[iconKey]
}
