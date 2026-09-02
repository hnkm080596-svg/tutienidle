// Bản Mệnh Pháp Bảo (2026-08-27, foundation-artifact-system-plan.md)
// — vật phẩm bản mệnh tự vận hành trong combat (kiểu "subgun"), gắn
// với cultivationPath, KHÔNG có slot trong EquipmentPaperdoll, KHÔNG
// nằm trong bag, không equip/craft/duplicate. Mỗi nhân vật có đúng
// MỘT bản mệnh pháp bảo đã thiết kế sẵn theo nghề — không phải hệ
// thống roll/nhặt tự do.
import type { CultivationPathId } from '../player/CultivationPathKit'

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

// Partial CÓ CHỦ Ý — Kiếm Tu/Thể Tu chưa có definition (doc §10.1),
// không tạo placeholder. Mọi call site phải tra bảng này thay vì
// hardcode 'phap_tu'.
export const ARTIFACT_ID_BY_CULTIVATION_PATH: Partial<Record<CultivationPathId, ArtifactId>> = {
  phap_tu: 'ngu_hanh_chau',
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
