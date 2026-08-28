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

export interface ShapeIssue {
  path: string

  message: string
}

export interface ShapeValidationResult {
  ok: boolean

  issues: ShapeIssue[]
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

  // lastSavedAt — buildGameSave() LUÔN ghi; thiếu nó khiến offline time
  // tính ra NaN (review 2026-08-28 bug #2). Save hiện hành bắt buộc có.
  if (!isFiniteNumber(player.lastSavedAt)) {
    issues.push({ path: 'player.lastSavedAt', message: 'phải là number hữu hạn' })
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

function validateEquipmentEntries(entries: unknown[], path: string, issues: ShapeIssue[]) {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    // instanceId trùng trong save là vector nhân bản trang bị + double
    // stat modifier (review 2026-08-28 bug #1c) — id phải tồn tại để
    // EquipmentBag dedupe được.
    requireString(entry, 'instanceId', `${path}[${i}]`, issues)
    requireString(entry, 'itemId', `${path}[${i}]`, issues)

    // refreshModifiers (EquipmentSystem.applyModifiers) đọc slot/mainStat/
    // affixes ngay khi boot và calculateEquipmentScale đọc forgePoints —
    // thiếu field nào cũng gây crash TypeError hoặc scale NaN vĩnh viễn,
    // đúng lớp bug v47 mà validator được tạo ra để chặn (review 2026-08-28).
    requireString(entry, 'slot', `${path}[${i}]`, issues)
    requireBoolean(entry, 'equipped', `${path}[${i}]`, issues)

    if (!isObject(entry.mainStat)) {
      issues.push({ path: `${path}[${i}].mainStat`, message: 'phải là object' })
    }

    requireArray(entry, 'affixes', `${path}[${i}]`, issues)
    requireNonNegativeNumber(entry, 'forgePoints', `${path}[${i}]`, issues)
  }
}

/**
 * Phần tử equipmentSlots — EquipmentSlotManager.restore ghi đè mù quáng
 * theo entry.slot; thiếu enhanceLevel thì calculateEquipmentScale nhận
 * undefined → NaN lây sang mọi trang bị đang đeo ở slot đó.
 */
function validateEquipmentSlotEntries(entries: unknown[], path: string, issues: ShapeIssue[]) {
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]

    if (!isObject(entry)) {
      issues.push({ path: `${path}[${i}]`, message: 'phải là object' })

      continue
    }

    requireString(entry, 'slot', `${path}[${i}]`, issues)
    requireNonNegativeNumber(entry, 'enhanceLevel', `${path}[${i}]`, issues)
  }
}

export function validateGameSaveShape(parsed: unknown): ShapeValidationResult {
  const issues: ShapeIssue[] = []

  if (!isObject(parsed)) {
    return { ok: false, issues: [{ path: '', message: 'save không phải object' }] }
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

  if (equipment) {
    validateEquipmentEntries(equipment, 'equipment', issues)
  }

  if (equipmentSlots) {
    validateEquipmentSlotEntries(equipmentSlots, 'equipmentSlots', issues)
  }

  return { ok: issues.length === 0, issues }
}
