// Bản Mệnh Pháp Bảo — state runtime CHỈ sống trong 1 Battle, không
// persist (doc §11). Snapshot level/grade/path/equippedElements lúc
// trận bắt đầu — đổi hướng/nâng phẩm/loadout giữa trận chỉ có hiệu
// lực từ trận kế, khớp đúng thiết kế (GameManager.setArtifactPath()/
// tryUpgradeArtifactGrade() đã chặn đổi giữa combat).
import type { ArtifactGrade, ArtifactId, ArtifactPath, ArtifactProgress } from './Artifact'
import type { ElementType } from '../element/ElementType'

export interface ArtifactRuntimeSnapshot {
  artifactId: ArtifactId
  level: number
  grade: ArtifactGrade
  path?: ArtifactPath

  /** Chỉ Ngũ Hành (wood/fire/earth/metal/water) đã unlock+equip lúc trận bắt đầu. */
  equippedElements: ElementType[]
}

/** Per-target ICD cho nhánh Khống (doc §8.4) — keyed theo targetId. */
export interface ArtifactTargetControlState {
  /** Số hit artifact đã trúng target này trong cửa sổ hiện tại (Ngũ Hành Phược, tầng 6). */
  hitsInWindow: number

  windowRemainingSeconds: number

  /** ICD trước khi được phép áp Trói Chân lại lên CHÍNH target này — chặn root-lock. */
  reapplyCooldownRemainingSeconds: number
}

interface ArtifactActivationHit {
  targetId: string
  element: ElementType
}

export interface ArtifactRuntime {
  snapshot: ArtifactRuntimeSnapshot

  activationTimer: number

  activationCount: number

  /** Con trỏ vòng xoay Ngũ Hành — index vào snapshot.equippedElements (đã lọc theo NGU_HANH_ROTATION_ORDER). */
  elementCursor: number

  perTargetControl: Record<string, ArtifactTargetControlState>

  lastBattleDamage: number

  // Công tầng 12 "Ngũ Hành Cộng Minh" — 2 hành khác nhau trúng CÙNG
  // target trong 1 activation giảm 10% chu kỳ KẾ, tối đa 1 lần/activation.
  currentActivationHits: ArtifactActivationHit[]
  crossElementBonusAppliedThisActivation: boolean
  pendingCycleReductionPercent: number

  // Thủ tầng 12 "Sinh Sinh Bất Tức" — phát hiện ward (do chính artifact
  // cấp ở tầng 3) VỪA vỡ bằng cách so currentWard tick này với tick
  // trước, không hook vào pipeline ward-break chung (không đổi
  // CombatSystem.resolveActionHit()).
  lastObservedPlayerWard: number
  wardBreakRecoveryCooldownRemainingSeconds: number
}

export function createArtifactRuntime(
  progress: ArtifactProgress,
  equippedElements: ElementType[],
  initialPlayerWard = 0,
): ArtifactRuntime {
  return {
    snapshot: {
      artifactId: progress.artifactId,
      level: progress.realmLevel,
      grade: progress.grade,
      path: progress.selectedPath,
      equippedElements,
    },
    activationTimer: 0,
    activationCount: 0,
    elementCursor: 0,
    perTargetControl: {},
    lastBattleDamage: 0,
    currentActivationHits: [],
    crossElementBonusAppliedThisActivation: false,
    pendingCycleReductionPercent: 0,
    lastObservedPlayerWard: initialPlayerWard,
    wardBreakRecoveryCooldownRemainingSeconds: 0,
  }
}
