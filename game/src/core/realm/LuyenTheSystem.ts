import type { PlayerData } from '../player/Player'
import type { StatModifier } from '../stats/StatCalculator'
import { LUYEN_THE_TIERS } from '../../data/realm/LuyenThe'

const TOTAL_TIERS = LUYEN_THE_TIERS.length

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getTierCap(tierIndex: number): number {
  return LUYEN_THE_TIERS[tierIndex]?.cap ?? 0
}

/**
 * Tầng ĐANG DỞ (0-based, thuần theo THỨ TỰ hoàn thành) — undefined khi
 * đã hoàn thành cả 6 tầng (không còn gì để đầu tư tiếp, xem
 * LuyenThePanel.vue's read-only state). KHÔNG xét requiredTang — tầng
 * trả về có thể vẫn đang khoá theo cảnh giới, xem isActiveTierUnlocked().
 */
export function getActiveTierIndex(player: PlayerData): number | undefined {
  return player.luyenTheCompletedTiers < TOTAL_TIERS ? player.luyenTheCompletedTiers : undefined
}

/**
 * Tầng ĐANG DỞ đã đủ điều kiện Phàm Nhân tầng để đầu tư chưa (2026-08-20
 * — mỗi tầng Luyện Thể còn gate thêm theo requiredTang, xem
 * data/realm/LuyenThe.ts). true nếu không còn tầng nào để đầu tư (đã
 * hoàn thành cả 6) — không có gì để khoá.
 */
export function isActiveTierUnlocked(player: PlayerData): boolean {
  const activeTierIndex = getActiveTierIndex(player)

  if (activeTierIndex === undefined) {
    return true
  }

  return player.realmLevel >= (LUYEN_THE_TIERS[activeTierIndex]?.requiredTang ?? 0)
}

function modifierId(tierId: string, stat: string): string {
  return `luyen-the:${tierId}:${stat}`
}

/**
 * Rebuild TOÀN BỘ modifier Luyện Thể (mọi tầng đã hoàn thành, đầy đủ
 * percentAtFullTier + tầng đang dở, scale tuyến tính theo progress/cap)
 * — gọi lại mỗi lần investTinhHoa() để giữ player.modifiers đúng với
 * state hiện tại, cùng cách usePill() merge permanent stat theo id.
 */
function buildTierModifiers(player: PlayerData): StatModifier[] {
  const modifiers: StatModifier[] = []

  LUYEN_THE_TIERS.forEach((tier, index) => {
    let ratio = 0

    if (index < player.luyenTheCompletedTiers) {
      ratio = 1
    } else if (index === player.luyenTheCompletedTiers) {
      ratio = clamp(player.luyenTheCurrentTierProgress / tier.cap, 0, 1)
    }

    if (ratio <= 0) {
      return
    }

    for (const stat of tier.stats) {
      modifiers.push({
        id: modifierId(tier.id, stat),
        sourceId: tier.id,
        sourceType: 'realm',
        stat,
        percent: tier.percentAtFullTier * ratio,
      })
    }
  })

  return modifiers
}

function applyTierModifiers(player: PlayerData) {
  const rebuilt = buildTierModifiers(player)

  player.modifiers = player.modifiers.filter(modifier => !modifier.id.startsWith('luyen-the:'))

  player.modifiers.push(...rebuilt)
}

/**
 * Đầu tư Tinh Hoa Phàm Thể (đang cầm trong túi) vào tầng ĐANG DỞ —
 * tiêu tối đa `availableAmount`, KHÔNG vượt quá phần còn thiếu của
 * tầng hiện tại (dư thì giữ lại trong túi cho lượt đầu tư sau, không
 * tự động tràn sang tầng kế). Trả về số Tinh Hoa THẬT SỰ đã tiêu (để
 * GameManager.investLuyenThe() trừ đúng số lượng khỏi materialBag).
 */
export function investTinhHoa(player: PlayerData, availableAmount: number): number {
  const activeTierIndex = getActiveTierIndex(player)

  if (activeTierIndex === undefined || availableAmount <= 0) {
    return 0
  }

  // requiredTang gate (2026-08-20) — chưa đạt tầng yêu cầu thì KHÔNG
  // được đầu tư dù đã làm đầy tầng trước, xem data/realm/LuyenThe.ts.
  if (!isActiveTierUnlocked(player)) {
    return 0
  }

  const cap = getTierCap(activeTierIndex)
  const remaining = cap - player.luyenTheCurrentTierProgress
  const consumed = Math.min(availableAmount, remaining)

  player.luyenTheCurrentTierProgress += consumed

  if (player.luyenTheCurrentTierProgress >= cap) {
    player.luyenTheCompletedTiers += 1
    player.luyenTheCurrentTierProgress = 0
  }

  applyTierModifiers(player)

  return consumed
}

/**
 * Bậc Nhập Đạo (1-6) — chốt lúc Lễ Nhập Môn (xem
 * GameManager.chooseCultivationPath()) từ số tầng ĐÃ HOÀN THÀNH. Đột
 * phá sớm dù chưa hoàn thành tầng nào vẫn hợp lệ (mục V tài liệu —
 * "người chơi không bắt buộc hoàn thành cả 6 tầng"), tối thiểu grade 1.
 */
export function computeBreakthroughGrade(player: PlayerData): number {
  return clamp(player.luyenTheCompletedTiers, 1, TOTAL_TIERS)
}
