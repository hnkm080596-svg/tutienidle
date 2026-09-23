import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '../stores/player'
import type { MainStatKey } from '../core/stats/StatTypes'
import type { ElementType } from '../core/element/ElementType'
import type { SpellPathRoute } from '../core/phap-tu/PhapTuState'

/**
 * Generic progression actions (attributes, nodes, spell-path selection,
 * specialization). Modifier tu technique/skill khong "tinh" nhu equipment
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

    // P7-M4 - the ONLY role write left in the UI: pick which learned
    // precursor the MORTAL player fights with. Post-path the op rejects
    // (the K3 precursor gate) - way kits own roles from then on.
    setMortalBasicSkill: (skillId: string) =>
      withBump(gameManager.progressionOps.setMortalBasicSkill(player.$state, skillId)),

    // Core Loop Foundation checklist (Muc SKILL) - "behavior-changing
    // node".
    selectSkillSpecialization: (skillId: string, specializationId: string) =>
      withBump(gameManager.progressionOps.selectSkillSpecialization(skillId, specializationId)),

    // Node Tree - GameManager method (unlocksSkillIds can skillTemplates).
    purchaseNode: (nodeId: string) => withBump(gameManager.progressionOps.purchaseNode(nodeId, player.$state)),

    // Node level (plan sec.6.2) - nang node da linh ngo len +1 cap.
    upgradeNode: (nodeId: string) => withBump(gameManager.progressionOps.upgradeNode(nodeId, player.$state)),

    // Phap Tu Reimagined (Task 16) - atomic element+route commit at the
    // element root (INV-13); the blocking modal only collects input.
    selectSpellPathElement: (element: ElementType, route: SpellPathRoute) =>
      withBump(gameManager.progressionOps.selectSpellPathElement(element, route, player.$state)),

    // Route respec (spec P3) - out-of-combat only (op enforces), resets
    // old-route nodes and refunds floor(actualPaid x 0.75).
    switchSpellPathRoute: (route: SpellPathRoute) =>
      withBump(gameManager.progressionOps.switchRoute(route, player.$state)),

    // Reset development mot nhanh (plan sec.6.10) - hoan Cam Ngo da tieu;
    // bump vo dieu kien (reset ve 0 level cung la thay doi state UI).
    devResetBranch: (branchTag: string) => {
      gameManager.progressionOps.devResetBranch(branchTag, player.$state)

      bumpState()

      return true
    },

    // M-F-RESPEC (ruling §14) - FREE Beta respec: reset node dau tu,
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
