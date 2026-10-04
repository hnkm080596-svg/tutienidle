// Workstream A (gameplay-ui-feedback-responsive-cleanup-plan.md sec4.1) -
// view model dung chung cho moi action gameplay: preview dieu kien +
// mapping reason code -> locale key (i18n). Core operation van
// tra { ok, reason } tho; lop Vue dung actionFailureKey() + t() de dich.
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

// Bang mapping tap trung cho MOI reason code hien co trong EquipmentSystem
// (enhance/washAffixes/refineAffixValues/dissolveInstances) - them reason
// moi o core thi them dong o day, khong duoc de lot codename ra UI.
// Core KHONG giu label vi - chuoi hien thi nam o locales (vi.json/en.json).
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

/** Khong de lot reason tho ra UI nguoi choi - luon qua mapping key nay.
 *  Tra null khi KHONG co reason (caller tu chon fallback key). */
export function actionFailureKey(reason: string | undefined): string | null {
  if (!reason) {
    return null
  }

  return ACTION_FAILURE_KEYS[reason] ?? ACTION_FAILURE_UNKNOWN_KEY
}

/** Helper build 1 requirement line so component khong tu ghep chuoi. */
export function requirementLine(
  code: string,
  label: string,
  current: number,
  required: number,
): ActionRequirementLine {
  return { code, label, current, required, met: current >= required }
}
