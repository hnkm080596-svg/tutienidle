import type { PlayerData } from '../../core/player/Player'
import type { FoundationType } from '../../core/breakthrough/FoundationType'
import { BODY_REFINEMENT_TIERS } from '../realm/BodyRefinement'
import {
  getBodyRefinementCompletedTiers,
  getOpenedMeridianCount,
} from '../../core/realm/body/BodyProgressionSystem'

// Bac Kien Co (spec dot-pha-loi-kiep sec.4.2, retired great_dao arm per
// 2026-09-23 hidden-perfection-lineage sec.19 census item 4) - dieu kien
// AN, KHONG hien thi truoc; cong bo SAU khi dat. 'great_dao' remains a
// legal KienCoGrade value: a hidden breakthrough into foundation now
// records it via the lineage channel (committed.breakthroughType), so
// the resolver no longer synthesizes it from pre-commit state. UI gate
// cong khai chi bac 'human' (tang 12 + Linh Thach).
export type KienCoGrade = FoundationType

/**
 * The grades resolveKienCoGrade can actually return: 'great_dao' is
 * unreachable here - a hidden breakthrough records it via the lineage
 * channel (committed.breakthroughType), never through pre-commit
 * investment. Difficulty tables key on this narrower set.
 */
export type ResolvableKienCoGrade = Exclude<KienCoGrade, 'great_dao'>

// So duong toi thieu tung bac - Thien can 6/8 (Ky Kinh no longer
// exists - the 9th meridian retired; cua so con lai la 8 duong Bat Mach).
const HEAVEN_MERIDIAN_COUNT = 6

const EARTH_BODY_TIERS = 3
const HEAVEN_BODY_TIERS = BODY_REFINEMENT_TIERS.length // 6

/**
 * Xet bac Kien Co luc bam dot pha (spec sec.2.1 - chi tu dau tu TRUOC
 * kiep, tran kiep khong cong/tru bac). `hasTrucCoDan` = Truc Co Dan
 * co trong tui do luc bam (bac Dia tro len can, KHONG tieu - vat chung).
 * Dieu kien luy tien: bac cao chi xet khi du bac thap.
 */
export function resolveKienCoGrade(
  player: PlayerData,
  hasTrucCoDan: boolean,
): ResolvableKienCoGrade {
  const earthReady = hasTrucCoDan && getBodyRefinementCompletedTiers(player) >= EARTH_BODY_TIERS
  const heavenReady =
    earthReady &&
    getBodyRefinementCompletedTiers(player) >= HEAVEN_BODY_TIERS &&
    getOpenedMeridianCount(player) >= HEAVEN_MERIDIAN_COUNT

  if (heavenReady) {
    return 'heaven'
  }

  if (earthReady) {
    return 'earth'
  }

  return 'human'
}
