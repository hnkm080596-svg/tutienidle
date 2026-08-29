import type { CombatEntity } from '../combat/CombatEntity'
import type { OnHitEffectKind, ProgressionNode } from '../progression/ProgressionNode'

// On-hit kiếm trận (spec 2026-08-29-kiem-the-kiem-y mục 4) — mỗi hit
// của kiếm trận (slot 0) + nuke/zone tick của ult TTKT roll MỖI node
// on-hit đã mua với tỉ lệ độc lập 3% × cấp node (max 15% ở Lv5). Số
// node on-hit HIỆU LỰC bị chặn theo cấp trận (Lưỡng Nghi 2 kiếm = 2
// node đầu, Tam Tài 3 = 3 node... Vô Cực 9 = cả 9).
//
// Dispatch qua callback `dispatch(kind, source, target, swordCount)` —
// engine thật (BattleSystem) map từng kind vào hệ thống sẵn có:
// khiem_khi_dmg → damage component kim; xuat_huyet_dot/tran_tru_cc →
// AilmentSystem; các stat-based kind → BuffSystem/Buff stack. On-hit
// KHÔNG hack damage trực tiếp (spec hard rule — qua modifier pipeline).

/** Thứ tự 9 kind đúng theo cấp trận mở dần (spec mục 4). */
export const ON_HIT_KIND_ORDER: readonly OnHitEffectKind[] = [
  'khiem_khi_dmg',
  'khiem_phong_haste',
  'xuat_huyet_dot',
  'tran_tru_cc',
  'phan_kich_dodge',
  'hap_linh_leech',
  'pha_giap_pen',
  'quang_crit',
  'than_ngu_hanh',
]

/** nodeId của từng kind theo thứ tự (trùng bảng ON_HIT_NODES trong KiemTuNodes.ts). */
const ON_HIT_NODE_IDS: readonly string[] = [
  'onhit_khiem_khi',
  'onhit_khiem_phong',
  'onhit_xuat_huyet',
  'onhit_tran_tru',
  'onhit_phan_kich',
  'onhit_hap_linh',
  'onhit_pha_giap',
  'onhit_quang_crit',
  'onhit_kiem_than',
]

/** Tỉ lệ proc của 1 node theo cấp (3%/level — spec mục 4, max 15%). */
export function onHitChancePercent(nodeId: string, nodeLevel: number): number {
  return nodeLevel > 0 ? Math.min(15, 3 * nodeLevel) : 0
}

export interface OnHitDispatch {
  (kind: OnHitEffectKind, source: CombatEntity, target: CombatEntity, swordCount: number): void
}

/**
 * Roll + dispatch mọi node on-hit đã mua cho 1 hit kiếm trận.
 *
 * @param nodeLevels cấp từng node on-hit (đọc PlayerData.nodeLevels)
 * @param roll hàm random 0..1 (inject được — test deterministic)
 * @param swordCount cấp trận HIỆN TẠI (chặn số node hiệu lực theo số kiếm)
 * @param dispatch callback áp hiệu ứng (engine thật ở BattleSystem)
 */
export function resolveOnHitEffects(
  nodeLevels: Record<string, number>,
  roll: () => number,
  source: CombatEntity,
  target: CombatEntity,
  swordCount: number,
  dispatch: OnHitDispatch,
): void {
  // Số node hiệu lực = số kiếm của trận (2..9), theo đúng thứ tự mở.
  const effectiveCount = Math.max(0, Math.min(9, swordCount))

  for (let index = 0; index < effectiveCount; index++) {
    const kind = ON_HIT_KIND_ORDER[index]!
    const nodeId = ON_HIT_NODE_IDS[index]!
    const level = nodeLevels[nodeId] ?? 0

    if (level <= 0) {
      continue
    }

    const chance = onHitChancePercent(nodeId, level) / 100

    if (roll() < chance) {
      dispatch(kind, source, target, swordCount)
    }
  }
}

/** Helper cho engine đọc node on-hit từ registry (mua theo ProgressionNode). */
export function getOnHitNodeLevelsOf(
  nodes: ProgressionNode[],
  playerNodeLevels: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const node of nodes) {
    if (node.effect.onHitEffect && (playerNodeLevels[node.id] ?? 0) > 0) {
      result[node.id] = playerNodeLevels[node.id] ?? 0
    }
  }
  return result
}
