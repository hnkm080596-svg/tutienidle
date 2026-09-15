import type { KiemPhoCombo } from '../../core/kiem-tu/KiemPhoSystem'

// Kiem Tu Reimagined Task 5 (spec 2026-09-15 §4.3) — the 37-combo
// table, verbatim locked patterns. Shorthand in comments: Đ=orb_dam,
// C=orb_chem, B=orb_bo, H=orb_hat, Q=orb_quet (doc notation only).
//
// Suffix-free (K10): the matcher is a TAIL matcher, so no shorter
// pattern may equal the last-k of a longer one — enforced by
// KiemPhoCombos.test.ts. The three corrected len-4s end in H/Q because
// any X-A-A-Y tail can only stay free when Y is a late-unlock orb.
//
// Effects: spec §11 defers full effect authoring to a content pass —
// every entry carries a length-tier scaffold damage multiplier (len3
// 2.5, len4 4.0, len5 7.0) plus its REQUIRED unique presetId (K11: the
// payload is the only discovery signal).

const D = 'orb_dam'
const C = 'orb_chem'
const B = 'orb_bo'
const H = 'orb_hat'
const Q = 'orb_quet'

function combo(
  id: string,
  name: string,
  pattern: KiemPhoCombo['pattern'],
  damageMultiplier: number,
): KiemPhoCombo {
  return {
    id,
    name,
    pattern,
    presetId: `kiem_combo_${id}` as KiemPhoCombo['presetId'],
    damage: { multiplier: damageMultiplier },
  }
}

const L3 = 2.5
const L4 = 4.0
const L5 = 7.0

export const KIEM_PHO_COMBOS: KiemPhoCombo[] = [
  // ---- Length 3 (15) ----
  combo('tam_thich', 'Tam Thích', [D, D, D], L3),
  combo('tam_tram', 'Tam Trảm', [C, C, C], L3),
  combo('tam_phach', 'Tam Phách', [B, B, B], L3),
  combo('tam_lieu', 'Tam Liêu', [H, H, H], L3),
  combo('tam_tao', 'Tam Tảo', [Q, Q, Q], L3),
  combo('nhi_thich_nhat_tram', 'Nhị Thích Nhất Trảm', [D, D, C], L3),
  combo('nhi_thich_nhat_phach', 'Nhị Thích Nhất Phách', [D, D, B], L3),
  combo('nhi_tram_nhat_thich', 'Nhị Trảm Nhất Thích', [C, C, D], L3),
  combo('nhi_tram_nhat_phach', 'Nhị Trảm Nhất Phách', [C, C, B], L3),
  combo('nhi_phach_nhat_thich', 'Nhị Phách Nhất Thích', [B, B, D], L3),
  combo('nhi_lieu_nhat_thich', 'Nhị Liêu Nhất Thích', [H, H, D], L3),
  combo('nhi_tao_nhat_thich', 'Nhị Tảo Nhất Thích', [Q, Q, D], L3),
  combo('thich_tram_thich', 'Thích Trảm Thích', [D, C, D], L3),
  combo('tram_thich_tram', 'Trảm Thích Trảm', [C, D, C], L3),
  combo('phach_thich_phach', 'Phách Thích Phách', [B, D, B], L3),

  // ---- Length 4 (12) ----
  combo('thich_tram_phach_thich', 'Thích Trảm Phách Thích', [D, C, B, D], L4),
  combo('tram_phach_thich_tram', 'Trảm Phách Thích Trảm', [C, B, D, C], L4),
  combo('phach_tram_thich_phach', 'Phách Trảm Thích Phách', [B, C, D, B], L4),
  combo('lieu_tram_thich_lieu', 'Liêu Trảm Thích Liêu', [H, C, D, H], L4),
  combo('tao_tram_thich_tao', 'Tảo Trảm Thích Tảo', [Q, C, D, Q], L4),
  combo('thich_lieu_tram_thich', 'Thích Liêu Trảm Thích', [D, H, C, D], L4),
  combo('thich_tao_tram_thich', 'Thích Tảo Trảm Thích', [D, Q, C, D], L4),
  combo('tram_lieu_phach_tram', 'Trảm Liêu Phách Trảm', [C, H, B, C], L4),
  combo('phach_lieu_tram_phach', 'Phách Liêu Trảm Phách', [B, H, C, B], L4),
  // Suffix-free corrections (spec §4.3 note): X-A-A-Y tails end in H/Q.
  combo('thich_tram_tram_lieu', 'Thích Trảm Trảm Liêu', [D, C, C, H], L4),
  combo('tram_thich_thich_lieu', 'Trảm Thích Thích Liêu', [C, D, D, H], L4),
  combo('phach_thich_thich_tao', 'Phách Thích Thích Tảo', [B, D, D, Q], L4),

  // ---- Length 5 (10) ----
  combo('ngu_hanh_kiem', 'Ngũ Hành Kiếm', [D, C, B, H, Q], L5),
  combo('ngu_hanh_nghich_chuyen', 'Ngũ Hành Nghịch Chuyển', [Q, H, B, C, D], L5),
  combo('thich_tram_tram_phach_thich', 'Thích Trảm Trảm Phách Thích', [D, C, C, B, D], L5),
  combo('tram_thich_phach_tram_phach', 'Trảm Thích Phách Trảm Phách', [C, D, B, C, B], L5),
  combo('phach_tram_thich_lieu_tao', 'Phách Trảm Thích Liêu Tảo', [B, C, D, H, Q], L5),
  combo('thich_lieu_phach_tram_tao', 'Thích Liêu Phách Trảm Tảo', [D, H, B, C, Q], L5),
  combo('tao_tram_thich_phach_lieu', 'Tảo Trảm Thích Phách Liêu', [Q, C, D, B, H], L5),
  combo('tram_phach_lieu_tao_thich', 'Trảm Phách Liêu Tảo Thích', [C, B, H, Q, D], L5),
  combo('phach_lieu_tao_thich_tram', 'Phách Liêu Tảo Thích Trảm', [B, H, Q, D, C], L5),
  combo('lieu_tao_thich_tram_phach', 'Liêu Tảo Thích Trảm Phách', [H, Q, D, C, B], L5),
]
