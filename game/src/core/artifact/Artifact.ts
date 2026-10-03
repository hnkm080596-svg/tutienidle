// Ban Menh Phap Bao (2026-08-27, foundation-artifact-system-plan.md)
// - vat pham ban menh tu van hanh trong combat (kieu "subgun"), gan
// voi cultivationPath, KHONG co slot trong EquipmentPaperdoll, KHONG
// nam trong bag, khong equip/craft/duplicate. Moi nhan vat co dung
// MOT ban menh phap bao da thiet ke san theo nghe - khong phai he
// thong roll/nhat tu do.
import type { CultivationPathId, PathWayRead } from '../player/CultivationPathKit'
import { getActiveWayDefinition } from '../player/CultivationPathKit'

export type ArtifactId = 'ngu_hanh_chau'

/** Cong/Thu/Khong (doc sec7.1) - chi MOT huong active tai mot thoi diem. */
export type ArtifactPath = 'attack' | 'defense' | 'control'

export const ARTIFACT_PATH_ORDER: readonly ArtifactPath[] = ['attack', 'defense', 'control']

export function isArtifactPath(value: unknown): value is ArtifactPath {
  return typeof value === 'string' && (ARTIFACT_PATH_ORDER as readonly string[]).includes(value)
}

export const ARTIFACT_PATH_LABELS: Record<ArtifactPath, string> = {
  attack: 'Công',
  defense: 'Thủ',
  control: 'Khống',
}

/** Pham -> Tien (doc sec5.3) - KHONG tai su dung EquipmentQuality. */
export type ArtifactGrade = 'pham' | 'linh' | 'dia' | 'thien' | 'tien'

export const ARTIFACT_GRADE_ORDER: readonly ArtifactGrade[] = ['pham', 'linh', 'dia', 'thien', 'tien']

export function isArtifactGrade(value: unknown): value is ArtifactGrade {
  return typeof value === 'string' && (ARTIFACT_GRADE_ORDER as readonly string[]).includes(value)
}

// Terminology align (2026-09-02, user schema chot): phap bao 5 bac nay
// la truc CHAT - nhan "Pham Chat->Tien Chat" (truoc goi "Pham"). Truc
// Pham (canh gioi tuong quan) cua phap bao hien chua co truc rieng -
// them sau neu design can. Type/values giu nguyen, chi label text.
export const ARTIFACT_GRADE_LABELS: Record<ArtifactGrade, string> = {
  pham: 'Phàm Chất',
  linh: 'Linh Chất',
  dia: 'Địa Chất',
  thien: 'Thiên Chất',
  tien: 'Tiên Chất',
}

export interface ArtifactMilestone {
  /** Tang artifact mo khoa milestone nay (1/3/6/12/18, doc sec7.2). */
  level: number

  name: string

  description: string
}

export interface ArtifactPathDefinition {
  path: ArtifactPath

  name: string

  milestones: ArtifactMilestone[]
}

export interface ArtifactDefinition {
  id: ArtifactId

  name: string

  cultivationPathId: CultivationPathId

  unlockRealmId: string

  paths: Record<ArtifactPath, ArtifactPathDefinition>
}

// The artifact a player's path entitles them to is WAY-owned content:
// spell_pathway grants ngu_hanh_chau at the artifact-domain unlock
// realm (ARTIFACT_UNLOCK_REALM_ID = Kim Dan after M-F-ARTIFACT-DEFER's
// ruling: Truc Co artifact scope is superseded) via realmRewards while
// hidden_spell_pathway - same base path id - deliberately has
// none. Deriving from the active way's realmRewards keeps the way
// definition the single authority; a corrupt/way-less pair resolves
// no artifact (fail-closed), and Kiem Tu/The Tu keep no placeholder
// (doc sec10.1). Moi call site phai di qua resolver nay thay vi
// hardcode 'spell'. The resolver itself stays domain-gate-agnostic
// (CEILING seam): it resolves what the way ENTITLES, never whether the
// domain is live - access gating is ReleasePolicy's and
// isArtifactDomainUnlocked's job.
export function resolveExpectedArtifactId(player: PathWayRead): ArtifactId | undefined {
  const way = getActiveWayDefinition(player)

  if (!way?.realmRewards) {
    return undefined
  }

  for (const reward of Object.values(way.realmRewards)) {
    if (reward.artifactId !== undefined) {
      return reward.artifactId
    }
  }

  return undefined
}

/**
 * Player-side state - no inventory array because each character owns
 * exactly one artifact (doc S10.2). `realmId` tracks the artifact's OWN
 * progression band - initialized to 'foundation_establishment' at
 * creation (TC ladder design, doc S5.x) regardless of the player's
 * unlock realm; field stays `string` (no literal) so the Kim Dan
 * surface needs no shape change. The P7-era claim 'Scope MVP dung o
 * Truc Co tang 18' is SUPERSEDED by M-F-ARTIFACT-DEFER: the artifact
 * domain defers to ARTIFACT_UNLOCK_REALM_ID (Kim Dan+).
 */
export interface ArtifactProgress {
  artifactId: ArtifactId

  realmId: string

  realmLevel: number

  experience: number

  grade: ArtifactGrade

  selectedPath?: ArtifactPath
}
