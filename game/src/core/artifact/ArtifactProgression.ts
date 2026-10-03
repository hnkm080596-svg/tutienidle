// Ham thuan cho progression Ban Menh Phap Bao (doc sec5) - khong dung
// Battle/PlayerData truc tiep, chi nhan/tra state de test de va tai
// dung duoc o ca BattleLootSystem (EXP combat) lan breakthrough hook
// (bank-to-cap catch-up). Mirror phong cach ham thuan cua
// core/artifact/ArtifactRuntime.ts.
import type { Enemy } from '../enemy/Enemy'
import type { ArtifactGrade, ArtifactId, ArtifactProgress } from './Artifact'
import { ARTIFACT_GRADE_ORDER, isArtifactGrade, isArtifactPath, resolveExpectedArtifactId } from './Artifact'
import type { PlayerData } from '../player/Player'
import { getRealmIndex } from '../realm/realmSystem'
import { isRealmAvailable } from '../realm/ReleasePolicy'
import type { MaterialBag } from '../material/MaterialBag'
import { ARTIFACT_UNLOCK_REALM_ID } from './ArtifactDomain'
import { isBetaFeature } from '../betaScope'

export const DOAN_BAO_THACH_MATERIAL_ID = 'doan_bao_thach'

/** Tran content MVP (doc sec5.1) - Truc Co tang 18, chua thiet ke dot pha len Kim Dan. */
export const ARTIFACT_MAX_DESIGNED_LEVEL = 18

export type ArtifactExpStatus = 'training' | 'capped_by_player' | 'content_ceiling'

/** He so hieu qua tong theo pham (doc sec5.3) - nhan damage/buff/control magnitude. */
const ARTIFACT_GRADE_MULTIPLIER: Record<ArtifactGrade, number> = {
  pham: 1.0,
  linh: 1.12,
  dia: 1.26,
  thien: 1.42,
  tien: 1.6,
}

/** So Doan Bao Thach de len pham KE TIEP - undefined o 'tien' (khong len nua). */
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

/** `required(level) = round(20 x level^1.35)` - doc sec5.2, dung cho simulation balance. */
export function getArtifactExpRequired(level: number): number {
  return Math.round(20 * Math.pow(Math.max(1, level), 1.35))
}

/**
 * `base = max(1, floor(techniqueMastery x 0.25))`, elite x2, boss x5
 * (doc sec. 5.2). He so 0.25 (giam tu 0.5, balance 2026-08-28) co y keo dai
 * thoi gian luyen phap bao: artifact phai CHU DONG farm moi theo kip
 * tran nhan vat, khong mac dinh luon dinh tran. Khong yeu cau artifact
 * ket lieu hoac da gay damage; ham nay chi doc reward da resolve san
 * tren `enemy` (elite/boss variant da ghi de `rewards` luc spawn, xem
 * applyEnemyTags (tinh_anh tag)/createBossVariant), khong tu phan biet tier theo
 * field khac.
 */
export function getArtifactExperienceReward(enemy: Pick<Enemy, 'rewards' | 'isElite' | 'isBoss'>): number {
  const base = Math.max(1, Math.floor(enemy.rewards.techniqueMastery * 0.25))

  if (enemy.isBoss) {
    return base * 5
  }

  if (enemy.isElite) {
    return base * 2
  }

  return base
}

// M-F-ARTIFACT-DEFER: realmId here is the artifact's OWN progression
// band (the TC ladder design), NOT the player's unlock realm - the
// awakened record always starts on the authored TC band even though
// the domain defers to Kim Dan+.
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
 * Cong EXP va tu tang tang KHONG ton material, tuan tu tung tang mot,
 * chi toi dung `playerRealmLevel` (doc sec5.1 "khong the tang neu tang
 * ke cao hon nguoi choi"). Khi da cham tran, EXP du chi bank toi dung
 * requirement ke roi dung - khong bank nhieu tang, khong tran.
 *
 * Goi lai voi `amount = 0` sau khi player vua dot pha (tieu hoac dai
 * canh gioi, `playerRealmLevel` moi) chinh la cach "giai phong" EXP da
 * bank o tran cu - neu artifact dang dung dung o cap (experience ===
 * required cua tang do), vong lap ben duoi tu tang DUNG mot tang roi
 * reset EXP ve 0, khop doc sec5.1 "artifact co thanh day lap tuc tang
 * dung mot tang roi EXP ve 0" - khong can ham rieng, tranh 2 noi giu
 * cung 1 logic de lech nhau.
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
 * 3 trang thai EXP bar (doc sec12.1): dang luyen / day cho chu nhan / dat
 * tran content - dung cho ArtifactExperienceBar.vue. So sanh tran
 * player qua getRealmIndex (khong string/level compare thang, an toan
 * neu player da vuot qua foundation_establishment).
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

/** Semantic wrapper cho call site breakthrough - xem docstring applyArtifactExperience. */
export function advanceArtifactRealmLevel(progress: ArtifactProgress, playerRealmLevel: number): void {
  applyArtifactExperience(progress, 0, playerRealmLevel)
}

// M-F-CEILING - the artifact domain's realm gate, composed with release
// policy the same way CompanionAvailability/FormationPlacement compose
// theirs (C2C-9 simple rule): NO grandfathering beyond the ceiling - a
// persisted save whose realm is unavailable hides the domain even though
// ARTIFACT_UNLOCK_REALM_ID sits in-window. M-F-ARTIFACT-DEFER (Ruling
// sections 2/52): the domain defers to Kim Dan+ - the constant itself lives in
// the leaf module ./ArtifactDomain (re-exported here so consumers keep
// this import site); the deferral note and the cycle rationale sit there.
// Under real policy the predicate is false for every realm; the
// open-window positive lives in ReleasePolicy.artifactDeferred.test.ts.
export { ARTIFACT_UNLOCK_REALM_ID } from './ArtifactDomain'

export function isArtifactDomainUnlocked(realmId: string): boolean {
  // BETA SCOPE LOCK v2 sec.14 - the artifact domain is scope-hidden in
  // beta; the predicate stays the single seam so exp grants, the wheel
  // slot, and the awaken gate all close together.
  return (
    isBetaFeature('artifact') &&
    isRealmAvailable(ARTIFACT_UNLOCK_REALM_ID) &&
    isRealmAvailable(realmId) &&
    getRealmIndex(realmId) >= getRealmIndex(ARTIFACT_UNLOCK_REALM_ID)
  )
}

/**
 * Normalize invariant (doc S10.2) - called inside restoreFromSave()
 * AFTER the Object.assign() blind-copy. Never throws: every invalid
 * state self-heals to the nearest valid value, no boot crash.
 *
 * - `artifactId` must match the current path; on mismatch it is
 *   dropped (and re-awakened when the gate is met).
 * - Paths with no definition (Kiem Tu/The Tu, or none chosen) always
 *   end `undefined`; no stale state is kept.
 * - Gate met (Kim Dan+, M-F-ARTIFACT-DEFER) but state missing ->
 *   create default (awaken at boot).
 * - Grade/path off-enum -> fallback 'pham'/undefined.
 * - Realm/tier never exceeds the player; EXP is finite, non-negative,
 *   capped at the next requirement (getRealmIndex compare, never a
 *   raw string compare).
 */
export function normalizeArtifactProgress(player: PlayerData): void {
  const expectedArtifactId = resolveExpectedArtifactId(player)

  // C2C-12 boundary: the domain gate controls AWAKENING only. A persisted
  // artifact whose artifactId still matches the path is NEVER removed
  // because its realm became release-unavailable - the single-check
  // invariant forbids restore from destroying ownership data. Access is
  // disabled at the domain seam instead: isArtifactDomainUnlocked gates
  // the wheel slot, EXP feed (BattleLootSystem.grantArtifactExperience)
  // and progression UI for a beyond-ceiling save.
  const meetsAwakenGate = isArtifactDomainUnlocked(player.realmId)

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
 * Nang pham - transaction check-tru-cap nhat (doc sec5.3): khong mutate
 * gi khi thieu da (MaterialBag.remove() da tu no-op neu khong du,
 * khong can tu check-roi-remove 2 buoc tach roi), khong that bai,
 * khong giam pham, cap o 'tien' (getNextArtifactGrade() tra undefined
 * -> no-op, khong loi). "Chi lam ngoai combat" enforce o GameManager
 * (caller), khong phai o day - ham nay khong biet gi ve Battle.
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
