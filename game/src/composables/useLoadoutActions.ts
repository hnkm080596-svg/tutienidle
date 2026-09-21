import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '../stores/player'
import type { MainStatKey } from '../core/stats/StatTypes'
import type { ElementType } from '../core/element/ElementType'
import type { SpellPathRoute } from '../core/phap-tu/PhapTuState'

/**
 * Modifier từ technique/skill không "tĩnh" như equipment — đã được
 * gộp lại mỗi tick qua getAggregatedModifiers() (xem tick() trong
 * App.vue), nên equip/unequip ở đây chỉ cần bumpState() để UI re-render
 * đúng slot, không cần đồng bộ modifiers thủ công như useEquipmentActions.
 */
export function useLoadoutActions() {
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
    // Tâm Pháp KHÔNG còn equip/unequip thủ công (PLAN HOÀN CHỈNH mục
    // 5/9 rework, 2026-08-20) — hoàn toàn theo nghề nghiệp đã chọn qua
    // GameManager.chooseCultivationPath(), gọi thẳng equipTechnique()/
    // GameManager không qua đây nữa. Đã gỡ 2 wrapper action tương ứng.

    unequipSkill: (skillId: string) => withBump(gameManager.progressionOps.unequipSkill(skillId)),

    // PLAN HOÀN CHỈNH mục 8/12 — thay hẳn equipSkill(skillId) cũ (theo
    // category cố định). skillId null = dọn trống slot đó.
    setSkillLoadoutSlot: (slotIndex: number, skillId: string | null) =>
      withBump(gameManager.progressionOps.setSkillLoadoutSlot(player.$state, slotIndex, skillId)),

    // Core Loop Foundation checklist (Mục SKILL) — "behavior-changing
    // node".
    selectSkillSpecialization: (skillId: string, specializationId: string) =>
      withBump(gameManager.progressionOps.selectSkillSpecialization(skillId, specializationId)),

    // Node Tree — GameManager method (unlocksSkillIds cần skillTemplates).
    purchaseNode: (nodeId: string) => withBump(gameManager.progressionOps.purchaseNode(nodeId, player.$state)),

    // Node level (plan §6.2) — nâng node đã lĩnh ngộ lên +1 cấp.
    upgradeNode: (nodeId: string) => withBump(gameManager.progressionOps.upgradeNode(nodeId, player.$state)),

    // Phap Tu Reimagined (Task 16) — atomic element+route commit at the
    // element root (INV-13); the blocking modal only collects input.
    selectSpellPathElement: (element: ElementType, route: SpellPathRoute) =>
      withBump(gameManager.progressionOps.selectSpellPathElement(element, route, player.$state)),

    // Route respec (spec P3) — out-of-combat only (op enforces), resets
    // old-route nodes and refunds floor(actualPaid x 0.75).
    switchSpellPathRoute: (route: SpellPathRoute) =>
      withBump(gameManager.progressionOps.switchRoute(route, player.$state)),

    // Reset development một nhánh (plan §6.10) — hoàn Cảm Ngộ đã tiêu;
    // bump vô điều kiện (reset về 0 level cũng là thay đổi state UI).
    devResetBranch: (branchTag: string) => {
      gameManager.progressionOps.devResetBranch(branchTag, player.$state)

      bumpState()

      return true
    },

    // PLAN HOÀN CHỈNH mục 2 — Main Stat allocation, hồ điểm riêng biệt
    // hoàn toàn với Skill Point/Node Tree ở trên.
    allocateAttributePoint: (stat: MainStatKey) => withBump(gameManager.progressionOps.allocateAttributePoint(player.$state, stat)),
  }
}
