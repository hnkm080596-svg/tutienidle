// Ban Menh Phap Bao - state runtime CHI song trong 1 Battle, khong
// persist (doc sec11). Snapshot level/grade/path/rotationElements luc
// tran bat dau - doi huong/nang pham/element giua tran chi co hieu
// luc tu tran ke, khop dung thiet ke (GameManager.setArtifactPath()/
// tryUpgradeArtifactGrade() da chan doi giua combat).
import type { ArtifactGrade, ArtifactId, ArtifactPath, ArtifactProgress } from './Artifact'
import type { ElementType } from '../element/ElementType'

export interface ArtifactRuntimeSnapshot {
  artifactId: ArtifactId
  level: number
  grade: ArtifactGrade
  path?: ArtifactPath

  /** Elements the artifact rotates through on activation. When this lane is
   *  ported to the turn engine, derive from player.spellPath.element (a spell
   *  holder has exactly 1 element) - the equippedElements loadout authority
   *  was retired in Task 14. */
  rotationElements: ElementType[]
}

/** Per-target ICD cho nhanh Khong (doc sec8.4) - keyed theo targetId. */
export interface ArtifactTargetControlState {
  /** So hit artifact da trung target nay trong cua so hien tai (Ngu Hanh Phuoc, tang 6). */
  hitsInWindow: number

  windowRemainingSeconds: number

  /** ICD truoc khi duoc phep ap Troi Chan lai len CHINH target nay - chan root-lock. */
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

  /** Con tro vong xoay Ngu Hanh - index vao snapshot.rotationElements (da loc theo NGU_HANH_ROTATION_ORDER). */
  elementCursor: number

  perTargetControl: Record<string, ArtifactTargetControlState>

  lastBattleDamage: number

  // Cong tang 12 "Ngu Hanh Cong Minh" - 2 hanh khac nhau trung CUNG
  // target trong 1 activation giam 10% chu ky KE, toi da 1 lan/activation.
  currentActivationHits: ArtifactActivationHit[]
  crossElementBonusAppliedThisActivation: boolean
  pendingCycleReductionPercent: number

  // Thu tang 12 "Sinh Sinh Bat Tuc" - phat hien ward (do chinh artifact
  // cap o tang 3) VUA vo bang cach so currentWard tick nay voi tick
  // truoc, khong hook vao pipeline ward-break chung (khong doi
  // CombatSystem.resolveActionHit()).
  lastObservedPlayerWard: number
  wardBreakRecoveryCooldownRemainingSeconds: number
}

export function createArtifactRuntime(
  progress: ArtifactProgress,
  rotationElements: ElementType[],
  initialPlayerWard = 0,
): ArtifactRuntime {
  return {
    snapshot: {
      artifactId: progress.artifactId,
      level: progress.realmLevel,
      grade: progress.grade,
      path: progress.selectedPath,
      rotationElements,
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
