import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '@/stores/player'
import {
  buildLoadoutPresentation,
  type CombatSkillPresentationState,
} from '@/core/combat/CombatSkillPresentation'
import { getSkillLoadoutSlotCount, MAX_SKILL_LOADOUT_SLOTS } from '@/core/skill/SkillLoadoutSlots'

// skill-insight-and-auto-combat-hud-plan.md mục 9 + execution policy
// rework (combat-gate-teleport-autocast plan §11.3) — cầu nối reactivity
// DUY NHẤT giữa Vue và CombatSkillPresentation.ts thuần: đọc lại mỗi khi
// stateVersion đổi (App.vue's tick(), CÙNG nhịp mọi HUD combat khác, xem
// CombatStatusBar.vue) — KHÔNG chạy setInterval/rAF riêng. KHÔNG còn
// khái niệm basic attack riêng: mọi slot đọc từ scheduler thống nhất.
export function useCombatSkillPresentation() {
  const gameManager = useGameManager()
  const player = usePlayerStore()
  const { stateVersion } = useStateVersion()

  const unlockedSlotCount = computed(() => {
    stateVersion.value

    return getSkillLoadoutSlotCount(player.realmId)
  })

  const loadout = computed<CombatSkillPresentationState[]>(() => {
    stateVersion.value

    const battle = gameManager.getBattle()

    if (!battle) {
      return []
    }

    return buildLoadoutPresentation(battle, gameManager.skillManager, MAX_SKILL_LOADOUT_SLOTS, unlockedSlotCount.value, player.combatAiStrategy)
  })

  function skillFor(entry: CombatSkillPresentationState) {
    return entry.skillId ? gameManager.skillManager.get(entry.skillId) : undefined
  }

  return { loadout, skillFor }
}
