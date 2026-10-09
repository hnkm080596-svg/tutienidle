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

  // Phap Tu Reimagine (spec 2026-09-26) -- 5 Phap Trang specials
  // (placeholder PNGs to be drawn; unknown files degrade to monogram).
  tam_muoi_chan_hoa: '/assets/skills/tam_muoi_chan_hoa.png',
  thanh_tuyen_duong_linh: '/assets/skills/thanh_tuyen_duong_linh.png',
  van_moc_sinh_co: '/assets/skills/van_moc_sinh_co.png',
  kim_y_ngung_phong: '/assets/skills/kim_y_ngung_phong.png',
  trong_nhac: '/assets/skills/trong_nhac.png',

  // Phap Tu An (Ngo Dao) kit.
  van_phap_tuy_tam: '/assets/skills/van_phap_tuy_tam.png',
  da_phap_lien_tuyen: '/assets/skills/da_phap_lien_tuyen.png',
}

// Hand-drawn node art (Minh's fire set, 2026-10) -- ProgressionNode.id
// -> asset path. Node art outranks the granted-skill icon and the
// element orb on the tree; nodes without an entry fall back to
// grant/element icons. Other elements slot in as their sets land.
export const NODE_ICON_MANIFEST: Record<string, string> = {
  hoa_linh_ngo: '/assets/skills/nodes/ngo-hoa-v1.png',
  hoa_the: '/assets/skills/nodes/tich-diem-v1.png',
  hoa_diem_chuan: '/assets/skills/nodes/dan-hoa-v1.png',
  hoa_an_sau: '/assets/skills/nodes/khac-an-v1.png',
  fire_ailment_mastery: '/assets/skills/nodes/liet-hoa-v1.png',
  hoa_nhiet_keo: '/assets/skills/nodes/du-tan-v1.png',
  hoa_diem_tham: '/assets/skills/nodes/thau-hoa-v1.png',
  // flaming "Ngu" glyph hand-drawn for the fire special (Minh 2026-10)
  linh_ngo_tam_muoi_chan_hoa: '/assets/skills/tam_muoi_chan_hoa.png',
  fire_basic_hoa_tu_diem: '/assets/skills/nodes/tu-diem-v1.png',
  fire_basic_hoa_tan_diem: '/assets/skills/nodes/tan-diem-v1.png',
  tinh_thong_hoa: '/assets/skills/nodes/hoa-dao-tinh-thong-v1.png',
  // Minor nodes reuse the closest-themed drawn art (Minh 2026-10-07:
  // repeats allowed, never the root/skill-seat arts). Ly Hoa chain rides
  // the flame set; the Ho The branch shares the ward-seal art; Ngu *
  // children ride the spare Tam Muoi glyph.
  hoa_diem_uy: '/assets/skills/nodes/dan-hoa-v1.png',
  hoa_hoa_nhan: '/assets/skills/nodes/thau-hoa-v1.png',
  hoa_pha_giap_diem: '/assets/skills/nodes/thau-hoa-v1.png',
  hoa_bao_diem: '/assets/skills/nodes/liet-hoa-v1.png',
  hoa_phe_diem: '/assets/skills/nodes/du-tan-v1.png',
  ho_the_mon: '/assets/skills/nodes/khac-an-v1.png',
  nguyen_kinh: '/assets/skills/nodes/khac-an-v1.png',
  linh_chuong: '/assets/skills/nodes/khac-an-v1.png',
  the_diem_kinh: '/assets/skills/nodes/khac-an-v1.png',
  ngu_hoa: '/assets/skills/nodes/tam-muoi-chan-y-v1.png',
  ngu_viem_tam: '/assets/skills/nodes/tam-muoi-chan-y-v1.png',
  ngu_viem_y: '/assets/skills/nodes/tam-muoi-chan-y-v1.png',
}

export function skillIconPath(iconKey: string | undefined): string | undefined {
  if (!iconKey) {
    return undefined
  }

  return SKILL_ICON_MANIFEST[iconKey]
}
