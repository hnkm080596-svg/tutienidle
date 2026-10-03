// RewardGourd (player-body-anchor-reward-gourd-plan sec6/sec7) - hop dong +
// cac ham thuan cho collector ho lo: vi tri safe-area, anchor mieng va
// quy dao hut Bezier. Ve placeholder (Graphics) nam o CombatScene dung
// dung cac hang so/anchor tu module nay de sau nay thay art that chi can
// doi texture + normalized mouth anchor.

import type { BattleRewardParticleEvent } from '@/core/battle/BattleEvents'

/** Anchor hut chuan hoa tren anh ho lo - MIENG ho lo. */
export const GOURD_MOUTH_ANCHOR = { x: 0.5, y: 0.14 } as const

/** Kich thuoc HIEN THI px tren battlefield (plan sec8: doc tot 48-64px). */
export const GOURD_PLACEHOLDER_SIZE = { w: 52, h: 64 } as const

/**
 * Art that (plan sec8) - PNG RGBA trong suot, ho lo chibi mac hoa tong
 * ngoc sam/dong co/day do. Mount giu nguyen collector API: chi doi
 * texture + kich thuoc hien thi; normalized mouth anchor KHONG doi.
 */
export const GOURD_TEXTURE_KEY = 'reward-gourd-v1'

export const GOURD_TEXTURE_URL = '/assets/ui/combat/reward-gourd-v1.png'

/** Le toi thieu toi mep trai va toi duong inset duoi. */
export const GOURD_SAFE_MARGIN_PX = 18

export interface GourdPlacementInput {
  /** Chieu cao canvas hien hanh. */
  canvasHeight: number

  /**
   * Bottom inset da do cua Event Bar + Control Bar - gourd nam NGAY phia
   * tren duong nay (plan sec6.2).
   */
  bottomInset: number
}

export interface GourdPlacement {
  /** Diem neo day-giua placeholder. */
  baseX: number

  baseY: number

  width: number

  height: number
}

/**
 * Vi tri goc TRAI DUOI battlefield an toan: neo theo canvas + bottom
 * inset, KHONG theo grid Player. Pure de test duoc resize math.
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

/** Screen point cua mieng ho lo tu placement hien hanh. */
export function resolveGourdMouth(placement: GourdPlacement): { x: number; y: number } {
  return {
    x: placement.baseX,

    y: placement.baseY - placement.height * (1 - GOURD_MOUTH_ANCHOR.y),
  }
}

/** Do vong cung Bezier theo loai thuong (giu mau rieng, plan sec7.3). */
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
 * Diem dieu khien Bezier cho 1 mote - tinh LIVE tu end hien hanh nen
 * resize giua animation hoac Player teleport deu khong lech dich.
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
 * Tien do chuyen dong cua 1 mote tren tham so tween t in [0,1] tuyen
 * tinh: tang toc nua sau (quad-in) - cam giac "bi hut" ve mieng.
 */
export function easeRewardProgress(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))

  return clamped * clamped
}

/**
 * Xoay nho doan cuoi (plan sec7.3): offset vuong goc voi huong bay, bien
 * do tat dan khi toi mieng.
 */
export function rewardSwirlOffset(
  p: number,

  seed: number,
): { x: number; y: number } {
  const amplitude = 10 * (1 - p) * p * 4 // peak ~p=0.5, ve 0 o hai dau

  // Tranh -0 o hai dau quy dao - mote phai chui THANG vao mieng.
  if (amplitude <= 0) {
    return { x: 0, y: 0 }
  }

  const angle = seed * Math.PI * 2 + p * Math.PI * 3

  return {
    x: Math.cos(angle) * amplitude,

    y: Math.sin(angle) * amplitude * 0.6,
  }
}

/** Scale mote co lai khi tien gan mieng (tu 1 ve 0.35). */
export function rewardMoteScale(p: number): number {
  return 1 - 0.65 * easeRewardProgress(p)
}
