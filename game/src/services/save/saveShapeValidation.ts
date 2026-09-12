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
import { MAX_CONSTELLATION_RANK } from '../../core/companion/CompanionProgression'
import { ITEM_QUALITY_ORDER, type ItemQuality } from '../../core/item/ItemQuality'
import { isProfessionGrade } from '../../core/profession/ProfessionGrade'
import { createBaseStats } from '../../core/stats/StatBlock'
import { EQUIPMENT_SLOTS } from '../../core/equipment/EquipmentSlotState'

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

  if (!isObject(player.baseStats)) {
    issues.push({ path: 'player.baseStats', message: 'phải là object' })
  }

  requireArray(player, 'modifiers', 'player', issues)
  requireArray(player, 'selectedTalentIds', 'player', issues)

  // nodeLevels — field từng gây crash boot v47 (SaveSystem.ts comment v47).
  if (!isObject(player.nodeLevels)) {
    issues.push({ path: 'player.nodeLevels', message: 'phải là object' })
  }

  // Spec dot-pha-loi-kiep §6.1 — 4 field v54 (Bát Mạch, cửa sổ quái ẩn,
  // snapshot hoàn hảo, mất vĩnh viễn Đại Đào).
  requireArray(player, 'openedMeridianIds', 'player', issues)
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

  requireArray(parsed, 'talismans', '', issues)
  requireArray(parsed, 'formations', '', issues)
  requireArray(parsed, 'buildings', '', issues)

  const equipmentSlots = requireArray(parsed, 'equipmentSlots', '', issues)

  // Field optional của GameSave — chỉ kiểm kiểu khi hiện diện.
  optionalArray(parsed, 'productionSites', '', issues)
  optionalArray(parsed, 'alchemyJobs', '', issues)

  if (parsed.quests !== undefined && !isObject(parsed.quests)) {
    issues.push({ path: '.quests', message: 'phải là object hoặc vắng mặt' })
  }

  // R7 (AR-08) - decompose slice is optional; when present it must be
  // an object with a non-negative finite workers number (restore
  // re-clamps; malformed input is rejected instead of crashing boot).
  if (parsed.decompose !== undefined) {
    if (!isObject(parsed.decompose)) {
      issues.push({ path: '.decompose', message: 'phải là object hoặc vắng mặt' })
    } else {
      const decompose = parsed.decompose as Record<string, unknown>
      const settings = decompose.settings

      if (!isObject(settings) || !Number.isFinite((settings as { workers?: unknown }).workers)) {
        issues.push({ path: '.decompose.settings.workers', message: 'phải là số hữu hạn' })
      } else if ((settings as { workers: number }).workers < 0) {
        issues.push({ path: '.decompose.settings.workers', message: 'không được âm' })
      }
    }
  }

  if (techniques) {
    validateIdEntries(techniques, 'techniques', issues)
  }

  if (skills) {
    validateIdEntries(skills, 'skills', issues)
  }

  if (materials) {
    validateStackEntries(materials, 'materialId', 'materials', issues)
  }

  if (pills) {
    validateStackEntries(pills, 'pillId', 'pills', issues)
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
