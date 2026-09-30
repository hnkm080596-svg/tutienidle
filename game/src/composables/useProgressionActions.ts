import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '../stores/player'
import type { MainStatKey } from '../core/stats/StatTypes'

/**
 * Generic progression actions (attributes, nodes, specialization). Modifier tu technique/skill khong "tinh" nhu equipment
 * - da duoc gop lai moi tick qua getAggregatedModifiers() (xem tick()
 * trong App.vue), nen cac ghi progression o day chi can bumpState() de
 * UI re-render, khong can dong bo modifiers thu cong nhu
 * useEquipmentActions.
 */
export function useProgressionActions() {
  const gameManager = useGameManager()
  const player = usePlayerStore()
  const { bumpState } = useStateVersion()

  function withBump(ok: boolean): boolean {
    if (ok) {
      bumpState()
    }

    return ok
  }

  return {
    // Tam Phap KHONG con equip/unequip thu cong (PLAN HOAN CHINH muc
    // 5/9 rework, 2026-08-20) - hoan toan theo nghe nghiep da chon qua
    // GameManager.chooseCultivationPath() (P7-M3: canonical grant, 0-or-1
    // holder). Da go 2 wrapper action tuong ung.

    // BETA SCOPE LOCK v2 (phase-2) - the mortal repick surface is gone
    // (the starter pick is a fixed constant, not a choice) and the
    // element commit moved inside commitFiveElementInitiation - no UI
    // seam may write either field directly anymore.

    // Core Loop Foundation checklist (Muc SKILL) - "behavior-changing
    // node".
    selectSkillSpecialization: (skillId: string, specializationId: string) =>
      withBump(gameManager.progressionOps.selectSkillSpecialization(skillId, specializationId, player.$state)),

    // Node Tree - GameManager method (unlocksSkillIds can skillTemplates).
    purchaseNode: (nodeId: string) => withBump(gameManager.progressionOps.purchaseNode(nodeId, player.$state)),

    // Node level (plan sec.6.2) - nang node da linh ngo len +1 cap.
    upgradeNode: (nodeId: string) => withBump(gameManager.progressionOps.upgradeNode(nodeId, player.$state)),

    // Reset development mot nhanh (plan sec.6.10) - hoan Cam Ngo da tieu;
    // bump vo dieu kien (reset ve 0 level cung la thay doi state UI).
    devResetBranch: (branchTag: string) => {
      const refund = gameManager.progressionOps.devResetBranch(branchTag, player.$state)

      if (refund === null) {
        return refund
      }

      bumpState()

      return refund
    },

    // M-F-RESPEC (ruling S14) - FREE Beta respec: reset node dau tu,
    // hoan 100% Cam Ngo thuc tra. Ngoai combat only (op tu reject trong
    // tran); scope.rootId thu hep ve mot nhanh, bo trong = ca cay.
    // Tra ve so Cam Ngo hoan (0 = khong co gi de reset), false = tu choi.
    respecNodeTree: (scope?: { rootId?: string }) => {
      const refund = gameManager.progressionOps.respecNodeTree(player.$state, scope)

      if (refund === null) {
        return false
      }

      bumpState()

      return refund
    },

    // PLAN HOAN CHINH muc 2 - Main Stat allocation, ho diem rieng biet
    // hoan toan voi Skill Point/Node Tree o tren.
    allocateAttributePoint: (stat: MainStatKey) => withBump(gameManager.progressionOps.allocateAttributePoint(player.$state, stat)),
  }
}
