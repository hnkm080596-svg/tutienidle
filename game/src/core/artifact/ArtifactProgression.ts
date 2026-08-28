// Hàm thuần cho progression Bản Mệnh Pháp Bảo (doc §5) — không đụng
// Battle/PlayerData trực tiếp, chỉ nhận/trả state để test dễ và tái
// dùng được ở cả BattleLootSystem (EXP combat) lẫn breakthrough hook
// (bank-to-cap catch-up). Mirror phong cách hàm thuần của
// core/reward/StageDropRules.ts và core/element/ElementLoadout.ts.
import type { Enemy } from '../enemy/Enemy'
import type { ArtifactGrade, ArtifactId, ArtifactProgress } from './Artifact'
import { ARTIFACT_GRADE_ORDER, ARTIFACT_ID_BY_CULTIVATION_PATH, isArtifactGrade, isArtifactPath } from './Artifact'
import type { PlayerData } from '../player/Player'
import { getRealmIndex } from '../realm/realmSystem'
import type { MaterialBag } from '../material/MaterialBag'

export const DOAN_BAO_THACH_MATERIAL_ID = 'doan_bao_thach'

/** Trần content MVP (doc §5.1) — Trúc Cơ tầng 18, chưa thiết kế đột phá lên Kim Đan. */
export const ARTIFACT_MAX_DESIGNED_LEVEL = 18

export type ArtifactExpStatus = 'training' | 'capped_by_player' | 'content_ceiling'

/** Hệ số hiệu quả tổng theo phẩm (doc §5.3) — nhân damage/buff/control magnitude. */
const ARTIFACT_GRADE_MULTIPLIER: Record<ArtifactGrade, number> = {
  pham: 1.0,
  linh: 1.12,
  dia: 1.26,
  thien: 1.42,
  tien: 1.6,
}

/** Số Đoán Bảo Thạch để lên phẩm KẾ TIẾP — undefined ở 'tien' (không lên nữa). */
const ARTIFACT_GRADE_UPGRADE_COST: Record<ArtifactGrade, number | undefined> = {
  pham: 10,
  linh: 25,
  dia: 60,
  thien: 150,
  tien: undefined,
}

export function getArtifactGradeMultiplier(grade: ArtifactGrade): number {
  return ARTIFACT_GRADE_MULTIPLIER[grade]
}

export function getArtifactGradeUpgradeCost(grade: ArtifactGrade): number | undefined {
  return ARTIFACT_GRADE_UPGRADE_COST[grade]
}

export function getNextArtifactGrade(grade: ArtifactGrade): ArtifactGrade | undefined {
  return ARTIFACT_GRADE_ORDER[ARTIFACT_GRADE_ORDER.indexOf(grade) + 1]
}

/** `required(level) = round(20 × level^1.35)` — doc §5.2, dùng cho simulation balance. */
export function getArtifactExpRequired(level: number): number {
  return Math.round(20 * Math.pow(Math.max(1, level), 1.35))
}

/**
 * `base = max(1, floor(techniqueInsight × 0.25))`, elite ×2, boss ×5
 * (doc §5.2). Hệ số 0.25 (giảm từ 0.5, balance 2026-08-28) cố ý kéo dài
 * thời gian luyện pháp bảo: artifact phải CHỦ ĐỘNG farm mới theo kịp
 * trần nhân vật, không mặc định luôn dính trần. Không yêu cầu artifact
 * kết liễu hoặc đã gây damage; hàm này chỉ đọc reward đã resolve sẵn
 * trên `enemy` (elite/boss variant đã ghi đè `rewards` lúc spawn, xem
 * createEliteVariant/createBossVariant), không tự phân biệt tier theo
 * field khác.
 */
export function getArtifactExperienceReward(enemy: Pick<Enemy, 'rewards' | 'isElite' | 'isBoss'>): number {
  const base = Math.max(1, Math.floor(enemy.rewards.techniqueInsight * 0.25))

  if (enemy.isBoss) {
    return base * 5
  }

  if (enemy.isElite) {
    return base * 2
  }

  return base
}

export function createDefaultArtifactProgress(artifactId: ArtifactId): ArtifactProgress {
  return {
    artifactId,
    realmId: 'foundation_establishment',
    realmLevel: 1,
    experience: 0,
    grade: 'pham',
    selectedPath: undefined,
  }
}

/**
 * Cộng EXP và tự tăng tầng KHÔNG tốn material, tuần tự từng tầng một,
 * chỉ tới đúng `playerRealmLevel` (doc §5.1 "không thể tăng nếu tầng
 * kế cao hơn người chơi"). Khi đã chạm trần, EXP dư chỉ bank tới đúng
 * requirement kế rồi dừng — không bank nhiều tầng, không tràn.
 *
 * Gọi lại với `amount = 0` sau khi player vừa đột phá (tiểu hoặc đại
 * cảnh giới, `playerRealmLevel` mới) chính là cách "giải phóng" EXP đã
 * bank ở trần cũ — nếu artifact đang đứng đúng ở cap (experience ===
 * required của tầng đó), vòng lặp bên dưới tự tăng ĐÚNG một tầng rồi
 * reset EXP về 0, khớp doc §5.1 "artifact có thanh đầy lập tức tăng
 * đúng một tầng rồi EXP về 0" — không cần hàm riêng, tránh 2 nơi giữ
 * cùng 1 logic dễ lệch nhau.
 */
export function applyArtifactExperience(
  progress: ArtifactProgress,
  amount: number,
  playerRealmLevel: number,
): void {
  if (amount > 0) {
    progress.experience += amount
  }

  while (progress.realmLevel < playerRealmLevel) {
    const required = getArtifactExpRequired(progress.realmLevel)

    if (progress.experience < required) {
      break
    }

    progress.experience -= required
    progress.realmLevel += 1
  }

  const cappedRequired = getArtifactExpRequired(progress.realmLevel)
  progress.experience = Math.min(progress.experience, cappedRequired)
}

/**
 * 3 trạng thái EXP bar (doc §12.1): đang luyện / đầy chờ chủ nhân / đạt
 * trần content — dùng cho ArtifactExperienceBar.vue. So sánh trần
 * player qua getRealmIndex (không string/level compare thẳng, an toàn
 * nếu player đã vượt qua foundation_establishment).
 */
export function getArtifactExpStatus(
  artifactRealmLevel: number,
  playerRealmId: string,
  playerRealmLevel: number,
): ArtifactExpStatus {
  if (artifactRealmLevel >= ARTIFACT_MAX_DESIGNED_LEVEL) {
    return 'content_ceiling'
  }

  const playerIndex = getRealmIndex(playerRealmId)
  const foundationIndex = getRealmIndex('foundation_establishment')

  const atPlayerCeiling =
    playerIndex > foundationIndex || (playerIndex === foundationIndex && artifactRealmLevel >= playerRealmLevel)

  return atPlayerCeiling ? 'capped_by_player' : 'training'
}

/** Semantic wrapper cho call site breakthrough — xem docstring applyArtifactExperience. */
export function advanceArtifactRealmLevel(progress: ArtifactProgress, playerRealmLevel: number): void {
  applyArtifactExperience(progress, 0, playerRealmLevel)
}

/**
 * Normalize invariant (doc §10.2) — gọi trong restoreFromSave() SAU
 * Object.assign() blind-copy. Không throw: mọi state sai đều tự sửa
 * về giá trị hợp lệ gần nhất, không crash boot.
 *
 * - `artifactId` phải khớp nghề hiện tại; sai thì bỏ (và tái thức
 *   tỉnh nếu đủ gate).
 * - Nghề chưa có definition (Kiếm Tu/Thể Tu, hoặc chưa chọn nghề) ->
 *   luôn `undefined`, không giữ state cũ nào.
 * - Đã đủ Trúc Cơ nhưng thiếu state -> tạo default (thức tỉnh lúc boot).
 * - Grade/path sai enum -> fallback 'pham'/undefined.
 * - Realm/tầng không vượt player; EXP hữu hạn, không âm, không vượt
 *   requirement kế (dùng getRealmIndex, KHÔNG string-compare).
 */
export function normalizeArtifactProgress(player: PlayerData): void {
  const expectedArtifactId = player.cultivationPath
    ? ARTIFACT_ID_BY_CULTIVATION_PATH[player.cultivationPath]
    : undefined

  const meetsAwakenGate = getRealmIndex(player.realmId) >= getRealmIndex('foundation_establishment')

  if (!expectedArtifactId) {
    player.artifact = undefined
    return
  }

  if (!player.artifact || player.artifact.artifactId !== expectedArtifactId) {
    player.artifact = meetsAwakenGate ? createDefaultArtifactProgress(expectedArtifactId) : undefined
    return
  }

  if (!isArtifactGrade(player.artifact.grade)) {
    player.artifact.grade = 'pham'
  }

  if (player.artifact.selectedPath !== undefined && !isArtifactPath(player.artifact.selectedPath)) {
    player.artifact.selectedPath = undefined
  }

  const playerIndex = getRealmIndex(player.realmId)
  const artifactIndex = getRealmIndex(player.artifact.realmId)

  if (
    artifactIndex > playerIndex ||
    (artifactIndex === playerIndex && player.artifact.realmLevel > player.realmLevel)
  ) {
    player.artifact.realmLevel = player.realmLevel
  }

  if (!Number.isFinite(player.artifact.experience) || player.artifact.experience < 0) {
    player.artifact.experience = 0
  }

  const required = getArtifactExpRequired(player.artifact.realmLevel)
  player.artifact.experience = Math.min(player.artifact.experience, required)
}

/**
 * Nâng phẩm — transaction check-trừ-cập nhật (doc §5.3): không mutate
 * gì khi thiếu đá (MaterialBag.remove() đã tự no-op nếu không đủ,
 * không cần tự check-rồi-remove 2 bước tách rời), không thất bại,
 * không giảm phẩm, cap ở 'tien' (getNextArtifactGrade() trả undefined
 * -> no-op, không lỗi). "Chỉ làm ngoài combat" enforce ở GameManager
 * (caller), không phải ở đây — hàm này không biết gì về Battle.
 */
export function tryUpgradeArtifactGrade(
  progress: ArtifactProgress,
  materialBag: Pick<MaterialBag, 'remove'>,
): boolean {
  const nextGrade = getNextArtifactGrade(progress.grade)
  const cost = getArtifactGradeUpgradeCost(progress.grade)

  if (!nextGrade || cost === undefined) {
    return false
  }

  if (!materialBag.remove(DOAN_BAO_THACH_MATERIAL_ID, cost)) {
    return false
  }

  progress.grade = nextGrade

  return true
}
