// Bản Mệnh Pháp Bảo (2026-08-27, foundation-artifact-system-plan.md)
// — vật phẩm bản mệnh tự vận hành trong combat (kiểu "subgun"), gắn
// với cultivationPath, KHÔNG có slot trong EquipmentPaperdoll, KHÔNG
// nằm trong bag, không equip/craft/duplicate. Mỗi nhân vật có đúng
// MỘT bản mệnh pháp bảo đã thiết kế sẵn theo nghề — không phải hệ
// thống roll/nhặt tự do.
import type { CultivationPathId, PathWayRead } from '../player/CultivationPathKit'
import { getActiveWayDefinition } from '../player/CultivationPathKit'

export type ArtifactId = 'ngu_hanh_chau'

/** Công/Thủ/Khống (doc §7.1) — chỉ MỘT hướng active tại một thời điểm. */
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

/** Phàm → Tiên (doc §5.3) — KHÔNG tái sử dụng EquipmentQuality. */
export type ArtifactGrade = 'pham' | 'linh' | 'dia' | 'thien' | 'tien'

export const ARTIFACT_GRADE_ORDER: readonly ArtifactGrade[] = ['pham', 'linh', 'dia', 'thien', 'tien']

export function isArtifactGrade(value: unknown): value is ArtifactGrade {
  return typeof value === 'string' && (ARTIFACT_GRADE_ORDER as readonly string[]).includes(value)
}

// Terminology align (2026-09-02, user schema chốt): pháp bảo 5 bậc này
// là trục CHẤT — nhãn "Phàm Chất→Tiên Chất" (trước gọi "Phẩm"). Trục
// Phẩm (cảnh giới tương quan) của pháp bảo hiện chưa có trục riêng —
// thêm sau nếu design cần. Type/values giữ nguyên, chỉ label text.
export const ARTIFACT_GRADE_LABELS: Record<ArtifactGrade, string> = {
  pham: 'Phàm Chất',
  linh: 'Linh Chất',
  dia: 'Địa Chất',
  thien: 'Thiên Chất',
  tien: 'Tiên Chất',
}

export interface ArtifactMilestone {
  /** Tầng artifact mở khoá milestone này (1/3/6/12/18, doc §7.2). */
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
// ngu_hanh grants ngu_hanh_chau at foundation_establishment via
// realmRewards while ngo_dao — same base path id — deliberately has
// none. Deriving from the active way's realmRewards keeps the way
// definition the single authority; a corrupt/way-less pair resolves
// no artifact (fail-closed), and Kiếm Tu/Thể Tu keep no placeholder
// (doc §10.1). Mọi call site phải đi qua resolver này thay vì
// hardcode 'phap_tu'.
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
 * State cấp player — KHÔNG dùng array inventory vì mỗi nhân vật chỉ
 * có một bản mệnh (doc §10.2). Scope MVP dừng ở Trúc Cơ tầng 18 nên
 * `realmId` hiện luôn là 'foundation_establishment'; field vẫn giữ
 * dạng string (không literal) để mở path lên Kim Đan sau này không
 * phải đổi shape.
 */
export interface ArtifactProgress {
  artifactId: ArtifactId

  realmId: string

  realmLevel: number

  experience: number

  grade: ArtifactGrade

  selectedPath?: ArtifactPath
}
