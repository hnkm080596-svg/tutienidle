import type { ProgressionNode } from '../../core/progression/ProgressionNode'

// Mortal precursor info anchors (2026-10-04, Minh ruling) - the mortal
// skill surface is the three cast-leveled precursors' readable seats,
// NOT a seat bolted onto a way's tree: the trio renders on the shared
// 'tien_than' branch tag which no way declares, so mortals own the view
// and no path stamp applies (infoSkillId keeps every ownership channel
// closed - purchase/upgrade/revoke all reject by definition). The
// colored seat follows the player's mortalBasicSkillId; the two
// unpickable precursors stay locked-looking while remaining readable -
// the detail surface mirrors the live skill (template + core level +
// cast count), the node's own level/effect stay inert.
export const MORTAL_TIEN_THAN_NODES: ProgressionNode[] = [
  {
    id: 'tram_tien_than',
    name: 'Huy Kiếm',
    type: 'major',
    description:
      'Chiêu thức tiền thân - chém đơn giản, không tốn tài nguyên. Tự lên cấp theo số lần xuất chiêu, không thể lĩnh ngộ hay nâng cấp bằng Cảm Ngộ.',
    branchTag: 'tien_than',
    effect: {},
    insightCost: 0,
    maxLevel: 1,
    infoSkillId: 'tram',
  },
  {
    id: 'linh_bao_tien_than',
    name: 'Linh Bạo',
    type: 'major',
    description:
      'Chiêu thức tiền thân của đại đạo pháp tu - tụ linh khí bùng nổ, bỏ qua mọi phòng thủ. Tự lên cấp theo số lần xuất chiêu, không thể lĩnh ngộ hay nâng cấp bằng Cảm Ngộ.',
    branchTag: 'tien_than',
    effect: {},
    insightCost: 0,
    maxLevel: 1,
    infoSkillId: 'linh_bao',
  },
  {
    id: 'huy_quyen_tien_than',
    name: 'Huy Quyền',
    type: 'major',
    description:
      'Chiêu thức tiền thân - một quyền đơn giản, không tốn tài nguyên. Tự lên cấp theo số lần xuất chiêu, không thể lĩnh ngộ hay nâng cấp bằng Cảm Ngộ.',
    branchTag: 'tien_than',
    effect: {},
    insightCost: 0,
    maxLevel: 1,
    infoSkillId: 'huy_quyen',
  },
]
