import { computed } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '@/stores/player'
import { useUiStore } from '@/stores/ui'
import {
  buildBasicAttackPresentation,
  buildLoadoutPresentation,
  type BasicAttackPresentationState,
  type CombatSkillPresentationState,
} from '@/core/combat/CombatSkillPresentation'
import { getSkillLoadoutSlotCount, MAX_SKILL_LOADOUT_SLOTS } from '@/core/skill/SkillLoadoutSlots'

// skill-insight-and-auto-combat-hud-plan.md mục 9 — cầu nối reactivity
// DUY NHẤT giữa Vue và CombatSkillPresentation.ts thuần: đọc lại mỗi
// khi stateVersion đổi (App.vue's tick(), CÙNG nhịp mọi HUD combat
// khác, xem CombatStatusBar.vue) — KHÔNG chạy setInterval/rAF riêng
// (rAF resync CHỈ cho hiển thị mượt, xem composables/useBasicAttackCadence.ts).
export function useCombatSkillPresentation() {
  const gameManager = useGameManager()
  const player = usePlayerStore()
  const ui = useUiStore()
  const { stateVersion } = useStateVersion()

  const basicAttack = computed<BasicAttackPresentationState | null>(() => {
    stateVersion.value

    const battle = gameManager.getBattle()

    if (!battle) {
      return null
    }

    const presentation = buildBasicAttackPresentation(battle, gameManager.skillManager)

    if (!presentation) {
      return null
    }

    // electron-combat-timing-smoothing-plan.md mục 10 — pause là khái
    // niệm THUẦN Vue (ui.isPaused, xem App.vue's tick()), core Battle
    // không biết gì về nó — AND thêm ở tầng composable này, không đưa
    // ngược vào buildBasicAttackPresentation() (phải giữ pure/không phụ
    // thuộc Pinia).
    return { ...presentation, isAdvancing: presentation.isAdvancing && !ui.isPaused }
  })

  const basicAttackSkill = computed(() => {
    stateVersion.value

    return gameManager.skillManager.getBasicAttackSkill()
  })

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

    return buildLoadoutPresentation(battle, gameManager.skillManager, MAX_SKILL_LOADOUT_SLOTS, unlockedSlotCount.value)
  })

  function skillFor(entry: CombatSkillPresentationState) {
    return entry.skillId ? gameManager.skillManager.get(entry.skillId) : undefined
  }

  return { basicAttack, basicAttackSkill, loadout, skillFor }
}
