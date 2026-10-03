// Combat Art Pipeline Task 5 (2026-09-05) - logic thuan (khong Phaser) quyet
// dinh sprite nao can TAO/CAP NHAT/XOA khi CombatScene nhan
// 'turn_battle_entity_snapshot' (thay the bridge 'positions' da chet cho
// turn-based combat, xem TurnActionPresentationEvents.ts). Tach rieng khoi
// CombatScene de test duoc ma khong can dung Phaser - CombatScene chi con
// la lop mong goi getOrCreateSprite()/destroyEntitySprite() theo action tra
// ve tu day (giu nguyen tinh than reconcileEnemySprites() cu, tong quat hoa
// cho ca player lan enemy).
import type { TurnBattleEntityVisualState } from '@/core/battle/turn/TurnActionPresentationEvents'

export type CombatantSpriteReconciliationAction =
  | { type: 'create'; state: TurnBattleEntityVisualState }
  | { type: 'update'; state: TurnBattleEntityVisualState }
  | { type: 'remove'; id: string }

/**
 * So sanh danh sach id sprite DA BIET (tu lan snapshot truoc) voi danh sach
 * state MOI NHAT de quyet dinh action cho tung sprite:
 * - id chua tung biet:
 *   - con `alive` -> 'create'.
 *   - da `alive: false` ngay tu lan dau thay (chet-truoc-khi-thay, vd. entity
 *     bi one-shot cung fixed step no xuat hien) -> KHONG action gi ca (Fix
 *     round 1, Minor 1). Khong tao sprite chi de xoa ngay tick sau - truoc
 *     ban fix nay, id nay lot qua nhanh 'create' roi bi 'remove' o tick ke,
 *     gay flash mot frame.
 * - id da biet, con `alive` -> 'update' (dong bo vi tri/thanh mau).
 * - id da biet nhung `alive: false` -> 'remove'. Ham THUAN nay chi tra action,
 *   KHONG tu xoa gi - caller (CombatScene.reconcileCombatantSprites(), Task 9
 *   2026-09-05) di qua beginDeathSequence() de phat animation '-death' va
 *   hoan destroy that toi khi animation/tween xong, thay vi xoa ngay.
 * - id da biet nhung KHONG con xuat hien trong snapshot moi (vd. companion bi
 *   doi giua tran) -> 'remove' ngay, du khong co state de tra kem.
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
      if (!state.alive) {
        continue
      }

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
