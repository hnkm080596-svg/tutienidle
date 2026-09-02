// Workstream A (gameplay-ui-feedback-responsive-cleanup-plan.md §4.1) —
// view model dùng chung cho mọi action gameplay: preview điều kiện +
// mapping reason code -> thông báo tiếng Việt cụ thể. Core operation vẫn
// trả { ok, reason } thô; lớp Vue dùng actionFailureLabel() để dịch.
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

// Bảng dịch tập trung cho MỌI reason code hiện có trong EquipmentSystem
// (enhance/washAffixes/refineAffixValues/dissolveInstances) — thêm reason
// mới ở core thì thêm dòng ở đây, không được để lọt codename ra UI.
const ACTION_FAILURE_LABELS: Record<string, string> = {
  not_found: 'Không tìm thấy trang bị đã chọn.',
  missing_refinement_points: 'Không đủ Điểm Rèn của món đồ.',
  no_forge_uses: 'Món đồ đã hết lượt Rèn.',
  missing_tinh_hoa: 'Không đủ Luyện Khí Tinh Hoa.',
  missing_spirit_stone: 'Không đủ Linh Thạch.',
  missing_material: 'Không đủ nguyên liệu.',
  template_not_found: 'Dữ liệu trang bị không hợp lệ.',
  no_eligible_affix: 'Món đồ không có dòng phụ phù hợp để thao tác.',
  no_affixes: 'Món đồ chưa có dòng phụ nào.',
  invalid_lock: 'Lựa chọn khóa dòng không hợp lệ.',
  too_many_locks: 'Đã khóa quá nhiều dòng — chừa lại ít nhất một dòng không khóa.',
  cannot_lock_all: 'Không thể khóa toàn bộ dòng phụ.',
  missing_essence: 'Không đủ Tinh Hoa cho thao tác này.',
  empty_selection: 'Chưa chọn món đồ nào.',
  equipped: 'Không thể thao tác trên trang bị đang mặc.',
  locked: 'Trang bị đang bị khóa.',
  favorite: 'Trang bị đang được đánh dấu yêu thích.',
  no_conversion_rule: 'Không có quy tắc chuyển đổi cho món đồ này.',
  invalid_refine_preview: 'Kết quả Tinh Luyện đã cũ hoặc không hợp lệ — hãy xem trước lại.',
  invalid_affix_value: 'Giá trị dòng phụ không hợp lệ — không thể Tinh Luyện.',
  invalid_random_roll: 'Kết quả ngẫu nhiên không hợp lệ — Tinh Luyện chưa tiêu hao tài nguyên.',
  max_level: 'Đã đạt cấp tối đa.',
}

/** Không để lọt reason thô ra UI người chơi — luôn qua bảng dịch này. */
export function actionFailureLabel(reason: string | undefined): string {
  if (!reason) {
    return 'Thao tác thất bại.'
  }

  return ACTION_FAILURE_LABELS[reason] ?? 'Thao tác thất bại vì điều kiện chưa đủ.'
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
