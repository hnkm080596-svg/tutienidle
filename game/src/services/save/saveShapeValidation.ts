// Shape validation cho save (save-shape-validation-plan.md, Phase 0) —
// pure function, không dependency runtime, thu hẹp dần từ unknown,
// KHÔNG dùng any. Chỉ kiểm tra SỰ HIỆN DIỆN và KIỂU của field bắt buộc;
// KHÔNG kiểm tra giá trị gameplay (balance thuộc hệ thống load từng phần).
//
// Quy ước: khi thêm field BẮT BUỘC mới vào GameSave/PlayerData, task thêm
// field phải cập nhật validator này + SaveRoundTrip.test.ts trong cùng
// thay đổi (round-trip test sẽ đỏ nếu buildGameSave() thiếu field mà
// validator đòi, và ngược lại).
import { CURRENT_SAVE_VERSION } from './saveVersion'
import { REALMS } from '../../data/realms/realm'
import { COMPANIONS } from '../../data/companion/Companions'
import { MAX_CONSTELLATION_RANK } from '../../core/companion/CompanionProgression'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '../../core/item/ItemQuality'
import { isProfessionGrade } from '../../core/profession/ProfessionGrade'
import { isHerbAge } from '../../core/production/ProductionTypes'
import { createBaseStats } from '../../core/stats/StatBlock'
import { EQUIPMENT_SLOTS } from '../../core/equipment/EquipmentSlotState'
import { KIEM_PHO_ORB_IDS } from '../../core/kiem-tu/KiemTuState'
import { CULTIVATION_PATH_MODULES, type CultivationPathId } from '../../core/player/CultivationPathKit'
import { isPhapTuNguHanh } from '../../core/phap-tu/PhapTuPath'
import { COMBAT_AI_STRATEGIES } from '../../core/battle/CombatAiStrategy'
import { FOUNDATION_LABELS } from '../../core/breakthrough/FoundationType'
import { isArtifactGrade, isArtifactPath } from '../../core/artifact/Artifact'

const STAT_TYPES = new Set<string>(Object.keys(createBaseStats()))

const STAT_MODIFIER_NUMERIC_FIELDS = [
  'flat',
  'percent',
  'multiplier',
  'stacks',
  'maxStacks',
  'perLevelFlat',
  'perLevelPercent',
] as const

export interface ShapeIssue {
  path: string

  message: string
}

export type ShapeValidationResult =
  | {
      ok: true

      issues: []

      /** Bản save đã bỏ equipment legacy và điền default optional an toàn. */
      normalizedSave: unknown

      /** Cầu nối cho UI báo số equipment legacy đã bỏ khi load. */
      discardedEquipmentCount: number
    }
  | {
      ok: false

      issues: ShapeIssue[]

      discardedEquipmentCount: number
    }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isItemQuality(value: unknown): value is ItemQuality {
  return typeof value === 'string' && ITEM_QUALITY_ORDER.some((quality) => quality === value)
}

function isEquipmentSlot(value: unknown): boolean {
  return typeof value === 'string' && EQUIPMENT_SLOTS.some((slot) => slot === value)
}

/** Field bắt buộc kiểu array — trả về array nếu hợp lệ để kiểm tra phần tử. */
function requireArray(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
): unknown[] | undefined {
  const value = target[key]

  if (!Array.isArray(value)) {
    issues.push({ path: `${path}.${key}`, message: 'phải là array' })

    return undefined
  }

  return value
}

/** Field optional — chỉ kiểm kiểu khi hiện diện (không bắt buộc có mặt). */
function optionalArray(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
): unknown[] | undefined {
  const value = target[key]

  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    issues.push({ path: `${path}.${key}`, message: 'phải là array hoặc vắng mặt' })

    return undefined
  }

  return value
}

function requireString(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
) {
  if (typeof target[key] !== 'string') {
    issues.push({ path: `${path}.${key}`, message: 'phải là string' })
  }
}

function requireBoolean(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
) {
  if (typeof target[key] !== 'boolean') {
    issues.push({ path: `${path}.${key}`, message: 'phải là boolean' })
  }
}

function requireNonNegativeNumber(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
) {
  if (!isNonNegativeFiniteNumber(target[key])) {
    issues.push({ path: `${path}.${key}`, message: 'phải là number hữu hạn >= 0' })
  }
}

function validatePlayer(player: unknown, issues: ShapeIssue[]) {
  if (!isObject(player)) {
    issues.push({ path: 'player', message: 'phải là object' })

    return
  }

  requireString(player, 'name', 'player', issues)
  requireString(player, 'realmId', 'player', issues)

  // Audit fix 2026-08-31 — realmId rác từng pass shape check (chỉ kiểm
  // string) rồi crash boot ở getCurrentRealm() throw (white-screen).
  if (
    typeof player.realmId === 'string' &&
    !REALMS.some((realm) => realm.id === player.realmId)
  ) {
    issues.push({
      path: 'player.realmId',
      message: `không tồn tại trong danh sách cảnh giới: ${player.realmId}`,
    })
  }

  // realmLevel >= 1 — nền của mọi tính toán progression; NaN/âm ở đây
  // lây sang cultivation curve.
  if (!isFiniteNumber(player.realmLevel) || player.realmLevel < 1) {
    issues.push({ path: 'player.realmLevel', message: 'phải là number hữu hạn >= 1' })
  }

  // cultivation/cultivationPerSecond — thiếu cultivationPerSecond từng gây
  // NaN vĩnh viễn cho cultivation qua calculateOfflineProgress (review
  // 2026-08-28 bug #2).
  requireNonNegativeNumber(player, 'cultivation', 'player', issues)
  requireNonNegativeNumber(player, 'cultivationPerSecond', 'player', issues)

  // Mission A review — the player record/array fields below were
  // container-only until now: baseStats.might = 'huge' passed the
  // boundary, slipped through the key whitelist (keys only, not
  // values), and spread NaN through every stat computation.
  if (!isObject(player.baseStats)) {
    issues.push({ path: 'player.baseStats', message: 'phải là object' })
  } else {
    for (const [statKey, statValue] of Object.entries(player.baseStats)) {
      if (!isFiniteNumber(statValue)) {
        issues.push({
          path: `player.baseStats.${statKey}`,
          message: 'phải là số hữu hạn',
        })
      }
    }
  }

  const playerModifiers = requireArray(player, 'modifiers', 'player', issues)

  if (playerModifiers) {
    validateStatModifierEntries(playerModifiers, 'player.modifiers', issues)
  }

  const externalModifiers = requireArray(player, 'externalModifiers', 'player', issues)

  if (externalModifiers) {
    validateStatModifierEntries(externalModifiers, 'player.externalModifiers', issues)
  }

  const selectedTalentIds = requireArray(player, 'selectedTalentIds', 'player', issues)

  if (selectedTalentIds) {
    validateStringEntries(selectedTalentIds, 'player.selectedTalentIds', issues)
  }

  requireBoolean(player, 'hasSeenTutorial', 'player', issues)
  requireNonNegativeNumber(player, 'autoWorkerCapacity', 'player', issues)
  requireNonNegativeNumber(player, 'totalCultivationGained', 'player', issues)
  requireNonNegativeNumber(player, 'bossKillCount', 'player', issues)
  requireNonNegativeNumber(player, 'skillInsight', 'player', issues)
  requireNonNegativeNumber(player, 'totalSkillInsightGained', 'player', issues)
  requireNonNegativeNumber(player, 'cultivationInsightAccumulator', 'player', issues)
  requireNonNegativeNumber(player, 'attributePoints', 'player', issues)
  requireNonNegativeNumber(player, 'bodyRefinementCompletedTiers', 'player', issues)
  requireNonNegativeNumber(player, 'bodyRefinementCurrentTierProgress', 'player', issues)
  requireNonNegativeNumber(player, 'breakthroughGrade', 'player', issues)

  const purchasedNodeIds = requireArray(player, 'purchasedNodeIds', 'player', issues)

  if (purchasedNodeIds) {
    validateStringEntries(purchasedNodeIds, 'player.purchasedNodeIds', issues)
  }

  const completedStageIds = requireArray(player, 'completedStageIds', 'player', issues)

  if (completedStageIds) {
    validateStringEntries(completedStageIds, 'player.completedStageIds', issues)
  }

  const perfectClearStageIds = requireArray(player, 'perfectClearStageIds', 'player', issues)

  if (perfectClearStageIds) {
    validateStringEntries(perfectClearStageIds, 'player.perfectClearStageIds', issues)
  }

  const grantedRealmPassiveIds = requireArray(player, 'grantedRealmPassiveIds', 'player', issues)

  if (grantedRealmPassiveIds) {
    validateStringEntries(grantedRealmPassiveIds, 'player.grantedRealmPassiveIds', issues)
  }

  // persistentTimedEffects — expiresAtMs is the absolute authority
  // (see PersistentTimedEffect.ts): a NaN deadline never expires.
  const timedEffects = requireArray(player, 'persistentTimedEffects', 'player', issues)

  if (timedEffects) {
    for (let i = 0; i < timedEffects.length; i += 1) {
      const effect = timedEffects[i]
      const effectPath = `player.persistentTimedEffects[${i}]`

      if (!isObject(effect)) {
        issues.push({ path: effectPath, message: 'phải là object' })
        continue
      }

      requireNonEmptyString(effect, 'id', effectPath, issues)
      requireNonEmptyString(effect, 'sourceItemId', effectPath, issues)

      if (!isFiniteNumber(effect.appliedAtMs)) {
        issues.push({ path: `${effectPath}.appliedAtMs`, message: 'phải là số hữu hạn' })
      }
      if (!isFiniteNumber(effect.expiresAtMs)) {
        issues.push({ path: `${effectPath}.expiresAtMs`, message: 'phải là số hữu hạn' })
      }

      const effectModifiers = requireArray(effect, 'modifiers', effectPath, issues)

      if (effectModifiers) {
        validateStatModifierEntries(effectModifiers, `${effectPath}.modifiers`, issues)
      }
    }
  }

  if (
    player.highestFoundationAchieved !== undefined &&
    (typeof player.highestFoundationAchieved !== 'string' ||
      !Object.prototype.hasOwnProperty.call(FOUNDATION_LABELS, player.highestFoundationAchieved))
  ) {
    issues.push({
      path: 'player.highestFoundationAchieved',
      message: 'phải là FoundationType hợp lệ hoặc vắng mặt',
    })
  }

  if (!COMBAT_AI_STRATEGIES.some((strategy) => strategy === player.combatAiStrategy)) {
    issues.push({ path: 'player.combatAiStrategy', message: 'phải thuộc COMBAT_AI_STRATEGIES' })
  }

  // skillLevels/skillCastCounts are optional records — NaN/negative
  // values leak into skill XP/UI the same way nodeLevels did.
  for (const recordKey of ['skillLevels', 'skillCastCounts'] as const) {
    const record = player[recordKey]

    if (record === undefined) {
      continue
    }

    if (!isObject(record)) {
      issues.push({ path: `player.${recordKey}`, message: 'phải là object hoặc vắng mặt' })
      continue
    }

    for (const [skillId, value] of Object.entries(record)) {
      if (!isNonNegativeFiniteNumber(value)) {
        issues.push({
          path: `player.${recordKey}.${skillId}`,
          message: 'phải là số hữu hạn >= 0',
        })
      }
    }
  }

  // artifact optional (ArtifactProgress) — a malformed grade/experience
  // makes ArtifactPanel index ARTIFACT_GRADE_ORDER → -1 / NaN exp bar.
  if (player.artifact !== undefined) {
    if (!isObject(player.artifact)) {
      issues.push({ path: 'player.artifact', message: 'phải là object hoặc vắng mặt' })
    } else {
      requireNonEmptyString(player.artifact, 'artifactId', 'player.artifact', issues)
      requireNonEmptyString(player.artifact, 'realmId', 'player.artifact', issues)

      if (!isFiniteNumber(player.artifact.realmLevel) || player.artifact.realmLevel < 1) {
        issues.push({ path: 'player.artifact.realmLevel', message: 'phải là số hữu hạn >= 1' })
      }

      requireNonNegativeNumber(player.artifact, 'experience', 'player.artifact', issues)

      if (!isArtifactGrade(player.artifact.grade)) {
        issues.push({ path: 'player.artifact.grade', message: 'phải là ArtifactGrade hợp lệ' })
      }

      if (
        player.artifact.selectedPath !== undefined &&
        !isArtifactPath(player.artifact.selectedPath)
      ) {
        issues.push({
          path: 'player.artifact.selectedPath',
          message: 'phải là ArtifactPath hoặc vắng mặt',
        })
      }
    }
  }

  // nodeLevels — field từng gây crash boot v47 (SaveSystem.ts comment v47).
  if (!isObject(player.nodeLevels)) {
    issues.push({ path: 'player.nodeLevels', message: 'phải là object' })
  } else {
    for (const [nodeId, level] of Object.entries(player.nodeLevels)) {
      if (!isNonNegativeFiniteNumber(level)) {
        issues.push({
          path: `player.nodeLevels.${nodeId}`,
          message: 'phải là số hữu hạn >= 0',
        })
      }
    }
  }

  // Cultivation Path Framework (v66) — cultivationPath must be one of
  // the 3 BASE ids (the CULTIVATION_PATH_MODULES keys). M7 removed the
  // legacy _an ids from the union, so a save carrying one fails this
  // enum check and is rejected — dev-phase policy, no migration.
  // cultivationWay is an optional PathWayId content string — shape-check
  // the type only; catalog membership belongs to the path authority,
  // not the save boundary.
  if (
    player.cultivationPath !== undefined &&
    (typeof player.cultivationPath !== 'string' ||
      !Object.prototype.hasOwnProperty.call(CULTIVATION_PATH_MODULES, player.cultivationPath))
  ) {
    issues.push({
      path: 'player.cultivationPath',
      message: 'phải là 1 trong 3 cultivation path id hợp lệ hoặc vắng mặt',
    })
  }

  if (player.cultivationWay !== undefined && typeof player.cultivationWay !== 'string') {
    issues.push({ path: 'player.cultivationWay', message: 'phải là string hoặc vắng mặt' })
  }

  // Pair coherence (review cycle, I1) — applyPathChoice writes the
  // (path, way) pair + path slice atomically and the ritual advances
  // realmId in the same commit, so the save boundary rejects every
  // incoherent shape instead of loading a permanently soft-locked
  // player: both-set-or-neither, the way must be owned by its path
  // module, a mortal can never carry the pair, and 'kiem_tu' requires
  // its kiemTu slice (provider attach + NguKiemDao reads assume it).
  const hasPath = player.cultivationPath !== undefined
  const hasWay = player.cultivationWay !== undefined

  if (hasPath !== hasWay) {
    issues.push({
      path: 'player.cultivationWay',
      message: 'cultivationPath và cultivationWay phải cùng vắng mặt hoặc cùng set (commit nguyên tử)',
    })
  } else if (
    hasPath &&
    typeof player.cultivationPath === 'string' &&
    Object.prototype.hasOwnProperty.call(CULTIVATION_PATH_MODULES, player.cultivationPath) &&
    typeof player.cultivationWay === 'string' &&
    !Object.prototype.hasOwnProperty.call(
      CULTIVATION_PATH_MODULES[player.cultivationPath as CultivationPathId].ways,
      player.cultivationWay,
    )
  ) {
    issues.push({
      path: 'player.cultivationWay',
      message: `way '${player.cultivationWay}' không thuộc path '${player.cultivationPath}'`,
    })
  }

  if (player.realmId === 'mortal' && hasPath) {
    issues.push({
      path: 'player.cultivationPath',
      message: 'không thể set khi realmId là mortal (nghi lễ thăng cảnh trong cùng commit)',
    })
  }

  if (player.cultivationPath === 'kiem_tu' && player.kiemTu === undefined) {
    issues.push({
      path: 'player.kiemTu',
      message: "bắt buộc khi cultivationPath là 'kiem_tu' (applyPathChoice tạo slice nguyên tử)",
    })
  }

  // Phap Tu Reimagined — required PlayerData.phapTu: { element, route },
  // both nullable until the atomic pick; a missing/garbage object would
  // crash selectPhapTuElement/resolveRouteProfile reads downstream.
  if (!isObject(player.phapTu)) {
    issues.push({ path: 'player.phapTu', message: 'phải là object' })
  } else {
    if (
      player.phapTu.element !== null &&
      !['wood', 'fire', 'earth', 'metal', 'water'].includes(player.phapTu.element as string)
    ) {
      issues.push({ path: 'player.phapTu.element', message: 'phải là ElementType hoặc null' })
    }
    if (
      player.phapTu.route !== null &&
      player.phapTu.route !== 'dot' &&
      player.phapTu.route !== 'no'
    ) {
      issues.push({ path: 'player.phapTu.route', message: "phải là 'dot' | 'no' | null" })
    }

    // Atomic-pair invariant: writers commit {element, route} together
    // (selectPhapTuElement), so a half-set pair is always corrupt — and
    // only the ngu_hanh way owns the state at all (ngo_dao, kiem_tu,
    // mortal must stay {null, null} or route stats leak cross-path).
    const hasElement = player.phapTu.element !== null
    const hasRoute = player.phapTu.route !== null
    if (hasElement !== hasRoute) {
      issues.push({
        path: 'player.phapTu',
        message: 'element và route phải cùng null hoặc cùng đã chọn (commit nguyên tử)',
      })
    } else if (hasElement && !isPhapTuNguHanh(player)) {
      // Cultivation Path Framework (M4/M8): element/route ownership is
      // ngu_hanh-only — the module predicate owns the membership rule,
      // so ('phap_tu','ngo_dao') and any way-less pair reject element
      // ownership.
      issues.push({
        path: 'player.phapTu',
        message: "element/route chỉ thuộc way 'ngu_hanh' của path 'phap_tu'",
      })
    }
  }

  // Talent v4 M2 (v61) — 5 field mới: ngân tu vi tràn (Hải Nạp), tầng
  // Lôi Kiếp, ledger mua node miễn phí (Vấn Đạo), tầng Phá Giáp mang
  // sang trận sau + cảnh giới lúc bank.
  requireNonNegativeNumber(player, 'cultivationOvercharge', 'player', issues)
  requireNonNegativeNumber(player, 'tribulationBonusStacks', 'player', issues)
  if (!isObject(player.nodeFreePurchaseRecord)) {
    issues.push({ path: 'player.nodeFreePurchaseRecord', message: 'phải là object' })
  } else {
    for (const [nodeId, count] of Object.entries(player.nodeFreePurchaseRecord)) {
      if (!isNonNegativeFiniteNumber(count)) {
        issues.push({
          path: `player.nodeFreePurchaseRecord.${nodeId}`,
          message: 'phải là số hữu hạn >= 0',
        })
      }
    }
  }
  requireNonNegativeNumber(player, 'phaGiapCarryStacks', 'player', issues)
  if (player.phaGiapCarryRealmId !== null && typeof player.phaGiapCarryRealmId !== 'string') {
    issues.push({ path: 'player.phaGiapCarryRealmId', message: 'phải là string hoặc null' })
  }

  // Kiem Tu Reimagined (v62) — kiemTu is optional (absent for non-kiem
  // players) but a malformed present copy silently degraded hien combat
  // (empty preset -> nextOrb NaN). Shape-check when present: preset
  // 1-9 catalog-member OrbIds, non-negative numerics, and the ngu
  // invariants (count >= 1, base >= 1) since no legit writer emits
  // lower. M6: the mode union check is gone — cultivationWay carries
  // the hien/ngu distinction.
  if (player.kiemTu !== undefined) {
    if (!isObject(player.kiemTu)) {
      issues.push({ path: 'player.kiemTu', message: 'phải là object hoặc vắng mặt' })
    } else {
      const kiemTu = player.kiemTu

      // M6 retired kiemTu.mode — a save still carrying it predates the
      // way model (or was hand-edited); reject rather than persist the
      // dead key forever.
      if ('mode' in kiemTu) {
        issues.push({ path: 'player.kiemTu.mode', message: 'field đã bị retire từ v66 (cultivationWay thay thế)' })
      }

      const preset = kiemTu.preset

      if (!Array.isArray(preset) || preset.length < 1 || preset.length > 9) {
        issues.push({ path: 'player.kiemTu.preset', message: 'phải là array 1-9 phần tử' })
      } else {
        for (const orbId of preset) {
          if (!KIEM_PHO_ORB_IDS.some((id) => id === orbId)) {
            issues.push({
              path: 'player.kiemTu.preset',
              message: `orb id không hợp lệ: ${String(orbId)}`,
            })

            break
          }
        }
      }

      requireNonNegativeNumber(kiemTu, 'kiemY', 'player.kiemTu', issues)

      if (!isFiniteNumber(kiemTu.kiemDaoCount) || kiemTu.kiemDaoCount < 1) {
        issues.push({ path: 'player.kiemTu.kiemDaoCount', message: 'phải là number hữu hạn >= 1' })
      }

      if (!isFiniteNumber(kiemTu.kiemDaoBase) || kiemTu.kiemDaoBase < 1) {
        issues.push({ path: 'player.kiemTu.kiemDaoBase', message: 'phải là number hữu hạn >= 1' })
      }
    }
  }

  // Spec dot-pha-loi-kiep §6.1 — 4 field v54 (Bát Mạch, cửa sổ quái ẩn,
  // snapshot hoàn hảo, mất vĩnh viễn Đại Đào).
  const openedMeridianIds = requireArray(player, 'openedMeridianIds', 'player', issues)

  if (openedMeridianIds) {
    validateStringEntries(openedMeridianIds, 'player.openedMeridianIds', issues)
  }

  requireNonNegativeNumber(player, 'luyenKhiKillsSinceBeast', 'player', issues)
  if (typeof player.mortalPerfectionAchieved !== 'boolean') {
    issues.push({ path: 'player.mortalPerfectionAchieved', message: 'phải là boolean' })
  }
  if (typeof player.greatDaoOpportunityLost !== 'boolean') {
    issues.push({ path: 'player.greatDaoOpportunityLost', message: 'phải là boolean' })
  }

  // lastSavedAt — buildGameSave() LUÔN ghi; thiếu nó khiến offline time
  // tính ra NaN (review 2026-08-28 bug #2). Save hiện hành bắt buộc có.
  if (!isFiniteNumber(player.lastSavedAt)) {
    issues.push({ path: 'player.lastSavedAt', message: 'phải là number hữu hạn' })
  }

  // v60 companion gacha - pity counter and Duyen Phan currency. A NaN
  // here would poison every later pull/exchange result.
  requireNonNegativeNumber(player, 'companionPullsSinceRare', 'player', issues)
  requireNonNegativeNumber(player, 'duyenPhan', 'player', issues)

  const companions = requireArray(player, 'companions', 'player', issues)

  if (companions) {
    validateCompanionEntries(companions, 'player.companions', issues)
  }

  // C1 triage (2026-09-14) — 3 corrupt-save residuals closed save-side:
  // perfectClearSeconds feeds auto-farm cycleSeconds (a missing/non-object
  // field crashes the tick's index read; junk values are additionally
  // guarded at consumption by isValidCycleSeconds).
  if (!isObject(player.perfectClearSeconds)) {
    issues.push({ path: 'player.perfectClearSeconds', message: 'phải là object' })
  } else {
    for (const [stageId, seconds] of Object.entries(player.perfectClearSeconds)) {
      if (!isFiniteNumber(seconds) || seconds <= 0) {
        issues.push({
          path: `player.perfectClearSeconds.${stageId}`,
          message: 'phải là số hữu hạn > 0',
        })
      }
    }
  }

  // autoFarmStage: null | { stageId, lastCheckedMs }. A malformed entry
  // previously slipped through shape validation; lastCheckedMs is only
  // shape-checked here — the unbounded catch-up a small-positive value
  // used to cause is bounded in tickAutoFarm's elapsed clamp instead.
  if (player.autoFarmStage !== null) {
    if (!isObject(player.autoFarmStage)) {
      issues.push({ path: 'player.autoFarmStage', message: 'phải là object hoặc null' })
    } else {
      requireNonEmptyString(player.autoFarmStage, 'stageId', 'player.autoFarmStage', issues)
      requireNonNegativeNumber(player.autoFarmStage, 'lastCheckedMs', 'player.autoFarmStage', issues)
    }
  }

  // formationLoadout: null | { formationId, assignments[] }. The write
  // path validates content (commitFormationLoadout); here shape-only —
  // resolvePartyFormation() maps .assignments blindly, so a malformed
  // object crashes battle construction.
  if (player.formationLoadout !== null) {
    if (!isObject(player.formationLoadout)) {
      issues.push({ path: 'player.formationLoadout', message: 'phải là object hoặc null' })
    } else {
      requireNonEmptyString(player.formationLoadout, 'formationId', 'player.formationLoadout', issues)
      const assignments = requireArray(player.formationLoadout, 'assignments', 'player.formationLoadout', issues)

      if (assignments) {
        for (let i = 0; i < assignments.length; i += 1) {
          const assignment = assignments[i]
          const assignmentPath = `player.formationLoadout.assignments[${i}]`

          if (!isObject(assignment)) {
            issues.push({ path: assignmentPath, message: 'phải là object' })
            continue
          }

          requireNonEmptyString(assignment, 'combatantId', assignmentPath, issues)

          if (!isFiniteNumber(assignment.row) || !Number.isInteger(assignment.row)) {
            issues.push({ path: `${assignmentPath}.row`, message: 'phải là số nguyên hữu hạn' })
          }

          if (!isFiniteNumber(assignment.column) || !Number.isInteger(assignment.column)) {
            issues.push({ path: `${assignmentPath}.column`, message: 'phải là số nguyên hữu hạn' })
          }
        }
      }
    }
  }
}

/**
 * CompanionInstance entries (v60 schema). realmLevel is REJECTED when
 * outside 1..realm.maxLevel - malformed progression data must fail loud
 * like the rest of this validator, not be silently clamped.
 */
function validateCompanionEntries(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
) {
  // Domain invariant: 1 instance per definitionId, and instanceId is the
  // identity key every consumer first-matches on (findIndex). A duplicated
  // id in a corrupted save loads state consumers treat as impossible -
  // same dedupe rationale as the equipment instanceId check below.
  const seenInstanceIds = new Set<string>()
  const seenDefinitionIds = new Set<string>()

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const entryPath = `${path}[${i}]`

    if (!isObject(entry)) {
      issues.push({ path: entryPath, message: 'phải là object' })

      continue
    }

    requireNonEmptyString(entry, 'instanceId', entryPath, issues)
    requireNonEmptyString(entry, 'definitionId', entryPath, issues)

    if (typeof entry.instanceId === 'string' && entry.instanceId.trim().length > 0) {
      if (seenInstanceIds.has(entry.instanceId)) {
        issues.push({ path: `${entryPath}.instanceId`, message: 'bị trùng với companion entry khác' })
      } else {
        seenInstanceIds.add(entry.instanceId)
      }
    }

    if (typeof entry.definitionId === 'string' && entry.definitionId.trim().length > 0) {
      if (seenDefinitionIds.has(entry.definitionId)) {
        issues.push({ path: `${entryPath}.definitionId`, message: 'bị trùng với companion entry khác' })
      } else {
        seenDefinitionIds.add(entry.definitionId)
      }

      // An owned companion whose definitionId is absent from the roster
      // loads as permanently inert dead state (every consumer silently
      // skips it) - fail loud like an unknown realmId.
      if (!COMPANIONS.some((definition) => definition.id === entry.definitionId)) {
        issues.push({
          path: `${entryPath}.definitionId`,
          message: 'không tồn tại trong roster companion',
        })
      }
    }

    const realm =
      typeof entry.realmId === 'string'
        ? REALMS.find((candidate) => candidate.id === entry.realmId)
        : undefined

    if (!realm) {
      issues.push({
        path: `${entryPath}.realmId`,
        message: 'không tồn tại trong danh sách cảnh giới',
      })
    }

    if (
      !isFiniteNumber(entry.realmLevel) ||
      !Number.isInteger(entry.realmLevel) ||
      entry.realmLevel < 1 ||
      (realm !== undefined && entry.realmLevel > realm.maxLevel)
    ) {
      issues.push({
        path: `${entryPath}.realmLevel`,
        message: 'phải là số nguyên trong khoảng 1..maxLevel của cảnh giới',
      })
    }

    requireNonNegativeNumber(entry, 'exp', entryPath, issues)

    if (
      !isFiniteNumber(entry.constellationRank) ||
      !Number.isInteger(entry.constellationRank) ||
      entry.constellationRank < 0 ||
      entry.constellationRank > MAX_CONSTELLATION_RANK
    ) {
      issues.push({
        path: `${entryPath}.constellationRank`,
        message: `phải là số nguyên 0..${MAX_CONSTELLATION_RANK}`,
      })
    }
  }
}

/** Kiểm tra phần tử của stack save (materials/pills) — id string + amount number >= 0. */
function validateStackEntries(
  entries: unknown[],
  idKey: string,
  path: string,
  issues: ShapeIssue[],
) {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    requireString(entry, idKey, `${path}[${i}]`, issues)
    requireNonNegativeNumber(entry, 'amount', `${path}[${i}]`, issues)
  }
}

function validateIdEntries(entries: unknown[], path: string, issues: ShapeIssue[]) {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    requireString(entry, 'id', `${path}[${i}]`, issues)
  }
}

// Mission A1 — deep per-slice validation. QuestManager.restore spreads
// state.active blindly, so a malformed element must fail the boundary
// instead of crashing restore (quest `active:"x"` -> TypeError).
function validateQuestSave(value: unknown, path: string, issues: ShapeIssue[]): void {
  if (!isObject(value)) {
    issues.push({ path, message: 'phải là object hoặc vắng mặt' })

    return
  }

  const active = value.active

  if (!Array.isArray(active)) {
    issues.push({ path: `${path}.active`, message: 'phải là array' })
  } else {
    for (let i = 0; i < active.length; i += 1) {
      const entry = active[i]

      if (
        !isObject(entry) ||
        typeof entry.questId !== 'string' ||
        !isNonNegativeFiniteNumber(entry.progress) ||
        typeof entry.claimed !== 'boolean'
      ) {
        issues.push({ path: `${path}.active[${i}]`, message: 'quest progress sai shape' })
      }
    }
  }

  if (
    !Array.isArray(value.completedOnceIds) ||
    !value.completedOnceIds.every((id) => typeof id === 'string')
  ) {
    issues.push({ path: `${path}.completedOnceIds`, message: 'phải là string[]' })
  }

  if (!isNonNegativeFiniteNumber(value.lastDailyResetAtMs)) {
    issues.push({ path: `${path}.lastDailyResetAtMs`, message: 'phải là số hữu hạn không âm' })
  }
}

// Mission A1 — BuildingSystem reads level/lastCollectedAt directly for
// stored-amount math; a non-numeric level used to pass the gate and
// produce NaN rates. Shape-only: maxLevel bounds stay with the building
// catalog (this file does not check gameplay values).
function validateBuildingsSave(entries: unknown[], path: string, issues: ShapeIssue[]): void {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (
      !isObject(entry) ||
      typeof entry.instanceId !== 'string' ||
      typeof entry.buildingId !== 'string' ||
      !Number.isInteger(entry.level) ||
      (entry.level as number) < 1 ||
      !isNonNegativeFiniteNumber(entry.lastCollectedAt)
    ) {
      issues.push({ path: `${path}[${i}]`, message: 'building sai shape' })
    }
  }
}

// Mission A1 — ProductionCycle: every timestamp/seed feeds settle/tick
// math; a non-finite completesAtMs used to pass the gate and run one
// cycle per tick forever.
function validateProductionCycleSave(
  value: unknown,
  path: string,
  issues: ShapeIssue[],
): void {
  if (
    !isObject(value) ||
    typeof value.cycleId !== 'string' ||
    typeof value.siteId !== 'string' ||
    typeof value.collectionRealmId !== 'string' ||
    !isFiniteNumber(value.siteLevelAtStart) ||
    !isFiniteNumber(value.rewardTableVersion) ||
    !isFiniteNumber(value.rollSeed) ||
    !isFiniteNumber(value.startedAtMs) ||
    !isFiniteNumber(value.completesAtMs)
  ) {
    issues.push({ path, message: 'production cycle sai shape' })
  }
}

function validateProductionSitesSave(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
): void {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const entryPath = `${path}[${i}]`

    if (
      !isObject(entry) ||
      typeof entry.siteId !== 'string' ||
      !Number.isInteger(entry.level) ||
      (entry.level as number) < 1 ||
      typeof entry.autoRestart !== 'boolean'
    ) {
      issues.push({ path: entryPath, message: 'production site sai shape' })

      continue
    }

    if (
      entry.assignedWorkers !== undefined &&
      (!Number.isInteger(entry.assignedWorkers) || (entry.assignedWorkers as number) < 0)
    ) {
      issues.push({ path: `${entryPath}.assignedWorkers`, message: 'phải là int không âm' })
    }

    // Mission D (spec D3): `activeCycle` was removed from the state
    // shape (workers-as-fuel; workerCycles is the only cycle kind).
    // A stale `activeCycle` key in an old-shaped payload is tolerated
    // here and whitelisted out at restoreStates — it is NOT validated or
    // rejected (dev phase, no migration).

    if (entry.workerCycles !== undefined) {
      if (!Array.isArray(entry.workerCycles)) {
        issues.push({ path: `${entryPath}.workerCycles`, message: 'phải là array' })
      } else {
        for (let j = 0; j < entry.workerCycles.length; j += 1) {
          validateProductionCycleSave(
            entry.workerCycles[j],
            `${entryPath}.workerCycles[${j}]`,
            issues,
          )

          if (
            isObject(entry.workerCycles[j]) &&
            (entry.workerCycles[j] as Record<string, unknown>).siteId !== undefined &&
            (entry.workerCycles[j] as Record<string, unknown>).siteId !== entry.siteId
          ) {
            issues.push({
              path: `${entryPath}.workerCycles[${j}].siteId`,
              message: 'phải khớp siteId của site cha',
            })
          }
        }
      }
    }
  }
}

// Mission A1 — AlchemySystem.restoreJobs feeds these into settle/tick;
// a missing id or non-finite deadline must fail the boundary.
function validateAlchemyJobsSave(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
): void {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (
      !isObject(entry) ||
      typeof entry.jobId !== 'string' ||
      typeof entry.recipeId !== 'string' ||
      typeof entry.pillId !== 'string' ||
      typeof entry.herbMaterialId !== 'string' ||
      !isFiniteNumber(entry.startedAtMs) ||
      !isFiniteNumber(entry.completesAtMs) ||
      !isFiniteNumber(entry.roomLevelAtStart)
    ) {
      issues.push({ path: `${path}[${i}]`, message: 'alchemy job sai shape' })
    }
  }
}

interface EquipmentEntriesValidation {
  normalizedEntries: unknown[]

  discardedCount: number
}

function requireNonEmptyString(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: ShapeIssue[],
) {
  const value = target[key]

  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ path: `${path}.${key}`, message: 'phải là string không rỗng' })
  }
}

function validateStringEntries(entries: unknown[], path: string, issues: ShapeIssue[]) {
  for (let i = 0; i < entries.length; i += 1) {
    if (typeof entries[i] !== 'string') {
      issues.push({ path: `${path}[${i}]`, message: 'phải là string' })
    }
  }
}

// StatModifier element check — `stat` only needs to be a non-empty
// string, NOT a STAT_TYPES member: the boundary accepts the shape and
// restore drops modifiers whose key is not a current StatType
// (dev-stage rule: drop, never translate).
function validateStatModifierEntries(entries: unknown[], path: string, issues: ShapeIssue[]) {
  for (let i = 0; i < entries.length; i += 1) {
    const modifier = entries[i]
    const modifierPath = `${path}[${i}]`

    if (!isObject(modifier)) {
      issues.push({ path: modifierPath, message: 'phải là object' })
      continue
    }

    requireNonEmptyString(modifier, 'id', modifierPath, issues)
    requireNonEmptyString(modifier, 'sourceId', modifierPath, issues)
    requireNonEmptyString(modifier, 'sourceType', modifierPath, issues)
    requireNonEmptyString(modifier, 'stat', modifierPath, issues)

    for (const field of STAT_MODIFIER_NUMERIC_FIELDS) {
      if (modifier[field] !== undefined && !isFiniteNumber(modifier[field])) {
        issues.push({
          path: `${modifierPath}.${field}`,
          message: 'phải là số hữu hạn hoặc vắng mặt',
        })
      }
    }
  }
}

function validateEquipmentEntries(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
): EquipmentEntriesValidation {
  const normalizedEntries: unknown[] = []
  let discardedCount = 0

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    // Development build không migrate item schema cũ. Chỉ riêng entry
    // legacy có realmId/rarity được bỏ có chủ đích; phần save
    // còn lại vẫn nạp được. Kiểm tra marker TRƯỚC các field
    // schema mới để entry cũ không bị biến thành lỗi toàn save.
    if ('realmId' in entry || 'rarity' in entry) {
      discardedCount += 1
      continue
    }

    normalizedEntries.push(entry)

    // instanceId trùng trong save là vector nhân bản trang bị + double
    // stat modifier (review 2026-08-28 bug #1c) — id phải tồn tại để
    // EquipmentBag dedupe được.
    requireString(entry, 'instanceId', `${path}[${i}]`, issues)
    requireString(entry, 'itemId', `${path}[${i}]`, issues)

    // refreshModifiers (EquipmentSystem.applyModifiers) đọc trực tiếp các
    // field này khi boot. Thiếu/sai shape sẽ gây TypeError hoặc NaN
    // lan sang modifier, nên entry schema hiện hành phải fail toàn save.
    if (!isEquipmentSlot(entry.slot)) {
      issues.push({
        path: `${path}[${i}].slot`,
        message: 'phải thuộc EQUIPMENT_SLOTS',
      })
    }
    requireBoolean(entry, 'equipped', `${path}[${i}]`, issues)

    if (!isProfessionGrade(entry.grade)) {
      issues.push({
        path: `${path}[${i}].grade`,
        message: 'phải là ProfessionGrade hợp lệ',
      })
    }

    if (!isItemQuality(entry.quality)) {
      issues.push({
        path: `${path}[${i}].quality`,
        message: 'phải thuộc ITEM_QUALITY_ORDER',
      })
    }

    if (!isObject(entry.mainStat)) {
      issues.push({ path: `${path}[${i}].mainStat`, message: 'phải là object' })
    } else {
      const mainStatPath = `${path}[${i}].mainStat`

      requireNonEmptyString(entry.mainStat, 'id', mainStatPath, issues)
      requireNonEmptyString(entry.mainStat, 'sourceId', mainStatPath, issues)

      if (entry.mainStat.sourceType !== 'equipment') {
        issues.push({
          path: `${mainStatPath}.sourceType`,
          message: 'phải là equipment',
        })
      }

      if (
        typeof entry.mainStat.stat !== 'string' ||
        !STAT_TYPES.has(entry.mainStat.stat)
      ) {
        issues.push({
          path: `${mainStatPath}.stat`,
          message: 'phải là StatType hợp lệ',
        })
      }

      if (entry.mainStat.tag !== undefined && typeof entry.mainStat.tag !== 'string') {
        issues.push({ path: `${mainStatPath}.tag`, message: 'phải là string hoặc vắng mặt' })
      }

      for (const field of STAT_MODIFIER_NUMERIC_FIELDS) {
        if (entry.mainStat[field] !== undefined && !isFiniteNumber(entry.mainStat[field])) {
          issues.push({
            path: `${mainStatPath}.${field}`,
            message: 'phải là số hữu hạn hoặc vắng mặt',
          })
        }
      }
    }

    const equipmentAffixes = requireArray(entry, 'affixes', `${path}[${i}]`, issues)

    if (equipmentAffixes) {
      for (let affixIndex = 0; affixIndex < equipmentAffixes.length; affixIndex += 1) {
        const affix = equipmentAffixes[affixIndex]
        const affixPath = `${path}[${i}].affixes[${affixIndex}]`

        if (!isObject(affix)) {
          issues.push({ path: affixPath, message: 'phải là object' })
          continue
        }
        requireNonEmptyString(affix, 'affixId', affixPath, issues)

        if (!isFiniteNumber(affix.tier) || !Number.isInteger(affix.tier) || affix.tier <= 0) {
          issues.push({
            path: `${affixPath}.tier`,
            message: 'phải là số nguyên dương hữu hạn',
          })
        }

        if (!isFiniteNumber(affix.value)) {
          issues.push({ path: `${affixPath}.value`, message: 'phải là số hữu hạn' })
        }
      }
    }

    requireNonNegativeNumber(entry, 'forgeUsesTotal', `${path}[${i}]`, issues)
    requireNonNegativeNumber(entry, 'forgeUsesRemaining', `${path}[${i}]`, issues)

    if (
      isNonNegativeFiniteNumber(entry.forgeUsesTotal) &&
      isNonNegativeFiniteNumber(entry.forgeUsesRemaining) &&
      entry.forgeUsesRemaining > entry.forgeUsesTotal
    ) {
      issues.push({
        path: `${path}[${i}].forgeUsesRemaining`,
        message: 'không được vượt forgeUsesTotal',
      })
    }
  }

  return { normalizedEntries, discardedCount }
}

/**
 * Phần tử equipmentSlots — EquipmentSlotManager.restore ghi đè mù quáng
 * theo entry.slot; thiếu enhanceLevel thì calculateEquipmentScale nhận
 * undefined → NaN lây sang mọi trang bị đang đeo ở slot đó.
 */
function validateEquipmentSlotEntries(
  entries: unknown[],
  path: string,
  issues: ShapeIssue[],
): unknown[] {
  const normalizedEntries: unknown[] = []

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    if (!isEquipmentSlot(entry.slot)) {
      issues.push({
        path: `${path}[${i}].slot`,
        message: 'phải thuộc EQUIPMENT_SLOTS',
      })
    }
    requireNonNegativeNumber(entry, 'enhanceLevel', `${path}[${i}]`, issues)

    if (entry.enhanceFailStreak !== undefined) {
      requireNonNegativeNumber(entry, 'enhanceFailStreak', `${path}[${i}]`, issues)
    }

    normalizedEntries.push(
      entry.enhanceFailStreak === undefined
        ? { ...entry, enhanceFailStreak: 0 }
        : entry,
    )
  }

  return normalizedEntries
}

export function validateGameSaveShape(parsed: unknown): ShapeValidationResult {
  const issues: ShapeIssue[] = []

  if (!isObject(parsed)) {
    return {
      ok: false,
      issues: [{ path: '', message: 'save không phải object' }],
      discardedEquipmentCount: 0,
    }
  }

  if (parsed.version !== CURRENT_SAVE_VERSION) {
    issues.push({
      path: 'version',
      message: `version phải là ${CURRENT_SAVE_VERSION}`,
    })
  }

  validatePlayer(parsed.player, issues)

  const techniques = requireArray(parsed, 'techniques', '', issues)
  const skills = requireArray(parsed, 'skills', '', issues)
  const materials = requireArray(parsed, 'materials', '', issues)
  const equipment = requireArray(parsed, 'equipment', '', issues)
  const pills = requireArray(parsed, 'pills', '', issues)

  const talismans = requireArray(parsed, 'talismans', '', issues)
  const formations = requireArray(parsed, 'formations', '', issues)

  const buildings = requireArray(parsed, 'buildings', '', issues)

  const equipmentSlots = requireArray(parsed, 'equipmentSlots', '', issues)

  // Field optional của GameSave — chỉ kiểm kiểu khi hiện diện, rồi
  // deep-check từng phần tử (Mission A1).
  const productionSites = optionalArray(parsed, 'productionSites', '', issues)
  const alchemyJobs = optionalArray(parsed, 'alchemyJobs', '', issues)

  if (productionSites) {
    validateProductionSitesSave(productionSites, 'productionSites', issues)
  }

  if (alchemyJobs) {
    validateAlchemyJobsSave(alchemyJobs, 'alchemyJobs', issues)
  }

  // Mission A1 — deep element checks: a present-but-malformed slice must
  // fail the boundary before restore trusts the declared TS shape.
  if (parsed.quests !== undefined) {
    validateQuestSave(parsed.quests, '.quests', issues)
  }

  // R7 (AR-08) - decompose slice is optional; when present it must be
  // an object with a non-negative finite workers number (restore
  // re-clamps; malformed input is rejected instead of crashing boot).
  // Mission A1 extends it: nextCycleAt/started plus enum membership for
  // the two filters (a bad deadline is a per-tick runaway).
  if (parsed.decompose !== undefined) {
    if (!isObject(parsed.decompose)) {
      issues.push({ path: '.decompose', message: 'phải là object hoặc vắng mặt' })
    } else {
      const decompose = parsed.decompose as Record<string, unknown>
      const settings = decompose.settings

      if (!isObject(settings)) {
        issues.push({ path: '.decompose.settings', message: 'phải là object' })
      } else {
        if (!isNonNegativeFiniteNumber(settings.workers)) {
          issues.push({ path: '.decompose.settings.workers', message: 'phải là số hữu hạn không âm' })
        }

        if (settings.gradeFilter !== 'all' && !isProfessionGrade(settings.gradeFilter)) {
          issues.push({ path: '.decompose.settings.gradeFilter', message: 'phải là ProfessionGrade hoặc all' })
        }

        if (settings.ageFilter !== 'all' && !isHerbAge(settings.ageFilter)) {
          issues.push({ path: '.decompose.settings.ageFilter', message: 'phải là HerbAge hoặc all' })
        }
      }

      if (!isNonNegativeFiniteNumber(decompose.nextCycleAt)) {
        issues.push({ path: '.decompose.nextCycleAt', message: 'phải là số hữu hạn không âm' })
      }

      if (typeof decompose.started !== 'boolean') {
        issues.push({ path: '.decompose.started', message: 'phải là boolean' })
      }
    }
  }

  if (techniques) {
    validateIdEntries(techniques, 'techniques', issues)
  }

  if (skills) {
    validateIdEntries(skills, 'skills', issues)
  }

  if (buildings) {
    validateBuildingsSave(buildings, 'buildings', issues)
  }

  if (materials) {
    validateStackEntries(materials, 'materialId', 'materials', issues)
  }

  if (pills) {
    validateStackEntries(pills, 'pillId', 'pills', issues)
  }

  // Mission A1 — Phù/Trận bags are retired (serializer always emits []),
  // but a present malformed element must still fail the trust boundary.
  if (talismans) {
    validateStackEntries(talismans, 'talismanId', 'talismans', issues)
  }

  if (formations) {
    validateStackEntries(formations, 'formationId', 'formations', issues)
  }

  const equipmentValidation = equipment
    ? validateEquipmentEntries(equipment, 'equipment', issues)
    : undefined
  const normalizedEquipmentSlots = equipmentSlots
    ? validateEquipmentSlotEntries(equipmentSlots, 'equipmentSlots', issues)
    : undefined
  const discardedEquipmentCount = equipmentValidation?.discardedCount ?? 0

  if (issues.length > 0) {
    return { ok: false, issues, discardedEquipmentCount }
  }

  return {
    ok: true,
    issues: [],
    normalizedSave: {
      ...parsed,
      equipment: equipmentValidation?.normalizedEntries ?? [],
      equipmentSlots: normalizedEquipmentSlots ?? [],
    },
    discardedEquipmentCount,
  }
}
