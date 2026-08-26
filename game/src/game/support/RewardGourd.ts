// RewardGourd (player-body-anchor-reward-gourd-plan §6/§7) — hợp đồng +
// các hàm thuần cho collector hồ lô: vị trí safe-area, anchor miệng và
// quỹ đạo hút Bézier. Vẽ placeholder (Graphics) nằm ở CombatScene dùng
// đúng các hằng số/anchor từ module này để sau này thay art thật chỉ cần
// đổi texture + normalized mouth anchor.

import type { BattleRewardParticleEvent } from '@/core/battle/BattleEvents'

/** Anchor hút chuẩn hoá trên ảnh hồ lô — MIỆNG hồ lô. */
export const GOURD_MOUTH_ANCHOR = { x: 0.5, y: 0.14 } as const

/** Kích thước HIỂN THỊ px trên battlefield (plan §8: đọc tốt 48–64px). */
export const GOURD_PLACEHOLDER_SIZE = { w: 52, h: 64 } as const

/**
 * Art thật (plan §8) — PNG RGBA trong suốt, hồ lô chibi mặc họa tông
 * ngọc sẫm/đồng cổ/dây đỏ. Mount giữ nguyên collector API: chỉ đổi
 * texture + kích thước hiển thị; normalized mouth anchor KHÔNG đổi.
 */
export const GOURD_TEXTURE_KEY = 'reward-gourd-v1'

export const GOURD_TEXTURE_URL = '/assets/ui/combat/reward-gourd-v1.png'

/** Lề tối thiểu tới mép trái và tới đường inset dưới. */
export const GOURD_SAFE_MARGIN_PX = 18

export interface GourdPlacementInput {
  /** Chiều cao canvas hiện hành. */
  canvasHeight: number

  /**
   * Bottom inset đã đo của Event Bar + Control Bar — gourd nằm NGAY phía
   * trên đường này (plan §6.2).
   */
  bottomInset: number
}

export interface GourdPlacement {
  /** Điểm neo đáy-giữa placeholder. */
  baseX: number

  baseY: number

  width: number

  height: number
}

/**
 * Vị trí góc TRÁI DƯỚI battlefield an toàn: neo theo canvas + bottom
 * inset, KHÔNG theo grid Player. Pure để test được resize math.
 */
export function computeGourdPlacement(input: GourdPlacementInput): GourdPlacement {
  const { w: width, h: height } = GOURD_PLACEHOLDER_SIZE

  return {
    baseX: GOURD_SAFE_MARGIN_PX + width / 2,

    baseY: Math.max(
      height,

      input.canvasHeight - input.bottomInset - GOURD_SAFE_MARGIN_PX,
    ),

    width,

    height,
  }
}

/** Screen point của miệng hồ lô từ placement hiện hành. */
export function resolveGourdMouth(placement: GourdPlacement): { x: number; y: number } {
  return {
    x: placement.baseX,

    y: placement.baseY - placement.height * (1 - GOURD_MOUTH_ANCHOR.y),
  }
}

/** Độ vồng cung Bézier theo loại thưởng (giữ màu riêng, plan §7.3). */
function arcHeightFor(kind: BattleRewardParticleEvent['kind']): number {
  switch (kind) {
    case 'insight':
      return 96

    case 'item':
      return 64

    default:
      return 40
  }
}

export interface RewardStreamPoint {
  x: number

  y: number
}

/**
 * Điểm điều khiển Bézier cho 1 mote — tính LIVE từ end hiện hành nên
 * resize giữa animation hoặc Player teleport đều không lệch đích.
 */
export function resolveRewardControlPoint(
  start: RewardStreamPoint,

  kind: BattleRewardParticleEvent['kind'],
): (end: RewardStreamPoint) => RewardStreamPoint {
  return (end) => ({
    x: (start.x + end.x) / 2,

    y:
      Math.min(start.y, end.y) -
      Math.max(arcHeightFor(kind), Math.abs(end.x - start.x) * 0.16),
  })
}

/**
 * Tiến độ chuyển động của 1 mote trên tham số tween t ∈ [0,1] tuyến
 * tính: tăng tốc nửa sau (quad-in) — cảm giác "bị hút" về miệng.
 */
export function easeRewardProgress(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))

  return clamped * clamped
}

/**
 * Xoáy nhỏ đoạn cuối (plan §7.3): offset vuông góc với hướng bay, biên
 * độ tắt dần khi tới miệng.
 */
export function rewardSwirlOffset(
  p: number,

  seed: number,
): { x: number; y: number } {
  const amplitude = 10 * (1 - p) * p * 4 // peak ~p=0.5, về 0 ở hai đầu

  // Tránh -0 ở hai đầu quỹ đạo — mote phải chui THẲNG vào miệng.
  if (amplitude <= 0) {
    return { x: 0, y: 0 }
  }

  const angle = seed * Math.PI * 2 + p * Math.PI * 3

  return {
    x: Math.cos(angle) * amplitude,

    y: Math.sin(angle) * amplitude * 0.6,
  }
}

/** Scale mote co lại khi tiến gần miệng (từ 1 về 0.35). */
export function rewardMoteScale(p: number): number {
  return 1 - 0.65 * easeRewardProgress(p)
}
