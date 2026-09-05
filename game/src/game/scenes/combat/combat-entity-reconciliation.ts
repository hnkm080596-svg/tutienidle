// Combat Art Pipeline Task 5 (2026-09-05) — logic thuần (không Phaser) quyết
// định sprite nào cần TẠO/CẬP NHẬT/XÓA khi CombatScene nhận
// 'turn_battle_entity_snapshot' (thay thế bridge 'positions' đã chết cho
// turn-based combat, xem TurnActionPresentationEvents.ts). Tách riêng khỏi
// CombatScene để test được mà không cần dựng Phaser — CombatScene chỉ còn
// là lớp mỏng gọi getOrCreateSprite()/destroyEntitySprite() theo action trả
// về từ đây (giữ nguyên tinh thần reconcileEnemySprites() cũ, tổng quát hoá
// cho cả player lẫn enemy).
import type { TurnBattleEntityVisualState } from '@/core/battle/turn/TurnActionPresentationEvents'

export type CombatantSpriteReconciliationAction =
  | { type: 'create'; state: TurnBattleEntityVisualState }
  | { type: 'update'; state: TurnBattleEntityVisualState }
  | { type: 'remove'; id: string }

/**
 * So sánh danh sách id sprite ĐÃ BIẾT (từ lần snapshot trước) với danh sách
 * state MỚI NHẤT để quyết định action cho từng sprite:
 * - id chưa từng biết → 'create'.
 * - id đã biết, còn `alive` → 'update' (đồng bộ vị trí/thanh máu).
 * - id đã biết nhưng `alive: false` → 'remove' (Task 9 sẽ thay bằng animation
 *   chết trước khi xóa; task này xóa ngay theo đúng cách enemy-death hiện có).
 * - id đã biết nhưng KHÔNG còn xuất hiện trong snapshot mới (vd. companion bị
 *   đổi giữa trận) → 'remove' ngay, dù không có state để trả kèm.
 */
export function planCombatantSpriteReconciliation(
  knownIds: ReadonlySet<string>,
  states: readonly TurnBattleEntityVisualState[],
): CombatantSpriteReconciliationAction[] {
  const actions: CombatantSpriteReconciliationAction[] = []
  const incomingIds = new Set<string>()

  for (const state of states) {
    incomingIds.add(state.id)

    if (!knownIds.has(state.id)) {
      actions.push({ type: 'create', state })
      continue
    }

    if (!state.alive) {
      actions.push({ type: 'remove', id: state.id })
      continue
    }

    actions.push({ type: 'update', state })
  }

  for (const id of knownIds) {
    if (!incomingIds.has(id)) {
      actions.push({ type: 'remove', id })
    }
  }

  return actions
}
