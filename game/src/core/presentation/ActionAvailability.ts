// Workstream A (gameplay-ui-feedback-responsive-cleanup-plan.md §4.1) —
// view model dùng chung cho mọi action gameplay: preview điều kiện +
// mapping reason code -> locale key (i18n). Core operation vẫn
// trả { ok, reason } thô; lớp Vue dùng actionFailureKey() + t() để dịch.
export interface ActionRequirementLine {
  code: string

  label: string

  current?: number

  required?: number

  met: boolean
}

export interface ActionAvailability {
  allowed: boolean

  requirements: ActionRequirementLine[]
}

// Bảng mapping tập trung cho MỌI reason code hiện có trong EquipmentSystem
// (enhance/washAffixes/refineAffixValues/dissolveInstances) — thêm reason
// mới ở core thì thêm dòng ở đây, không được để lọt codename ra UI.
// Core KHÔNG giữ label vi — chuỗi hiển thị nằm ở locales (vi.json/en.json).
export const ACTION_FAILURE_FALLBACK_KEY = 'actionFailure.fallback'

export const ACTION_FAILURE_UNKNOWN_KEY = 'actionFailure.unknown'

export const ACTION_FAILURE_KEYS: Record<string, string> = {
  not_found: 'actionFailure.not_found',
  missing_refinement_points: 'actionFailure.missing_refinement_points',
  no_forge_uses: 'actionFailure.no_forge_uses',
  missing_tinh_hoa: 'actionFailure.missing_tinh_hoa',
  missing_spirit_stone: 'actionFailure.missing_spirit_stone',
  missing_material: 'actionFailure.missing_material',
  template_not_found: 'actionFailure.template_not_found',
  no_eligible_affix: 'actionFailure.no_eligible_affix',
  no_affixes: 'actionFailure.no_affixes',
  invalid_lock: 'actionFailure.invalid_lock',
  too_many_locks: 'actionFailure.too_many_locks',
  cannot_lock_all: 'actionFailure.cannot_lock_all',
  missing_essence: 'actionFailure.missing_essence',
  empty_selection: 'actionFailure.empty_selection',
  equipped: 'actionFailure.equipped',
  locked: 'actionFailure.locked',
  favorite: 'actionFailure.favorite',
  no_conversion_rule: 'actionFailure.no_conversion_rule',
  invalid_refine_preview: 'actionFailure.invalid_refine_preview',
  invalid_affix_value: 'actionFailure.invalid_affix_value',
  invalid_random_roll: 'actionFailure.invalid_random_roll',
  max_level: 'actionFailure.max_level',
  grade_mismatch: 'actionFailure.grade_mismatch',
}

/** Không để lọt reason thô ra UI người chơi — luôn qua mapping key này.
 *  Trả null khi KHÔNG có reason (caller tự chọn fallback key). */
export function actionFailureKey(reason: string | undefined): string | null {
  if (!reason) {
    return null
  }

  return ACTION_FAILURE_KEYS[reason] ?? ACTION_FAILURE_UNKNOWN_KEY
}

/** Helper build 1 requirement line so component không tự ghép chuỗi. */
export function requirementLine(
  code: string,
  label: string,
  current: number,
  required: number,
): ActionRequirementLine {
  return { code, label, current, required, met: current >= required }
}
