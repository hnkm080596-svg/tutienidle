import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '../stores/player'
import type { MainStatKey } from '../core/stats/StatTypes'
import type { ElementType } from '../core/element/ElementType'

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
      withBump(gameManager.progressionOps.selectSkillSpecialization(skillId, specializationId, player.$state)),

    // Node Tree - GameManager method (unlocksSkillIds can skillTemplates).
    purchaseNode: (nodeId: string) => withBump(gameManager.progressionOps.purchaseNode(nodeId, player.$state)),

    // Node level (plan sec.6.2) - nang node da linh ngo len +1 cap.
    upgradeNode: (nodeId: string) => withBump(gameManager.progressionOps.upgradeNode(nodeId, player.$state)),

    // Phap Tu Reimagine (spec D5) -- element-only commit at the element
    // root; routes are retired, no pick modal.
    selectSpellPathElement: (element: ElementType) =>
      withBump(gameManager.progressionOps.selectSpellPathElement(element, player.$state)),

    // Reset development mot nhanh (plan sec.6.10) - hoan Cam Ngo da tieu;
    // ngoai combat only (op tu reject trong tran), tra false khi bi tu choi.
    devResetBranch: (branchTag: string) => {
      // null = tu choi trong tran (out-of-combat gate, giong respec).
      const refund = gameManager.progressionOps.devResetBranch(branchTag, player.$state)

      if (refund === null) {
        return false
      }

      bumpState()

      return true
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
