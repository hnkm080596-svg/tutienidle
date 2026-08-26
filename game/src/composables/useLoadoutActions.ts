import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '../stores/player'
import type { ElementType } from '../core/element/ElementType'
import type { MainStatKey } from '../core/stats/StatTypes'

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

    unequipSkill: (skillId: string) => withBump(gameManager.unequipSkill(skillId)),

    // PLAN HOÀN CHỈNH mục 8/12 — thay hẳn equipSkill(skillId) cũ (theo
    // category cố định). skillId null = dọn trống slot đó.
    setSkillLoadoutSlot: (slotIndex: number, skillId: string | null) =>
      withBump(gameManager.setSkillLoadoutSlot(player.$state, slotIndex, skillId)),

    // Core Loop Foundation checklist (Mục SKILL) — "behavior-changing
    // node".
    selectSkillSpecialization: (skillId: string, specializationId: string) =>
      withBump(gameManager.selectSkillSpecialization(skillId, specializationId)),

    // Pháp Tu Redesign (magicpath) — Element Loadout là action CỦA
    // Pinia store (pure PlayerData, không cần registry — xem
    // core/element/ElementLoadout.ts), khác equipSkill/equipTechnique
    // (GameManager method).
    equipElement: (element: ElementType) => withBump(player.equipElement(element)),

    unequipElement: (element: ElementType) => withBump(player.unequipElement(element)),

    // Node Tree — GameManager method (unlocksSkillIds cần skillTemplates).
    purchaseNode: (nodeId: string) => withBump(gameManager.purchaseNode(nodeId, player.$state)),

    // Node level (plan §6.2) — nâng node đã lĩnh ngộ lên +1 cấp.
    upgradeNode: (nodeId: string) => withBump(gameManager.upgradeNode(nodeId, player.$state)),

    // Reset development một nhánh (plan §6.10) — hoàn Cảm Ngộ đã tiêu;
    // bump vô điều kiện (reset về 0 level cũng là thay đổi state UI).
    devResetBranch: (branchTag: string) => {
      gameManager.devResetBranch(branchTag, player.$state)

      bumpState()

      return true
    },

    // PLAN HOÀN CHỈNH mục 2 — Main Stat allocation, hồ điểm riêng biệt
    // hoàn toàn với Skill Point/Node Tree ở trên.
    allocateAttributePoint: (stat: MainStatKey) => withBump(gameManager.allocateAttributePoint(player.$state, stat)),
  }
}
