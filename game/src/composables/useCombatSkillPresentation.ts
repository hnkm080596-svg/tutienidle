import { computed, ref } from 'vue'
import { useGameManager, useStateVersion } from './useGameState'
import { usePlayerStore } from '@/stores/player'
import {
  buildLoadoutPresentation,
  type CombatSkillPresentationState,
} from '@/core/combat/CombatSkillPresentation'
import { getSkillLoadoutSlotCount, MAX_SKILL_LOADOUT_SLOTS } from '@/core/skill/SkillLoadoutSlots'

// Task 7 (2026-08-28, kiem-tu-tu-luc plan) — nhịp tụ lực Bạt Kiếm
// (3-9s) do KiemTuCombatHud.vue's slider (6A-T7: ControlBar đã xóa) điều khiển; ref module-scope
// (chung 1 instance toàn app, giống mọi composable singleton khác ở
// đây) để KiemTuCombatHud.vue đọc lại đúng số đang áp dụng mà không cần
// thêm field Player.ts/store — cố ý KHÔNG PERSIST (dev-phase, "không
// nhớ, mặc định 3 mỗi trận" — xem task-7-brief.md). CombatControlBar
// tự set lại 3 mỗi lần mount (mỗi trận) VÀ gọi BattleSystem.
// setChannelTickSeconds() lại — override bên BattleSystem không tự
// reset giữa các trận (channelTickSecondsOverrides sống suốt vòng đời
// GameManager), nên UI phải chủ động đồng bộ lại thay vì tin baseline.
export const batKiemTickSeconds = ref(3)

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

  // Task 7 — Bạt Kiếm KHÔNG dùng cadence policy attack_speed/attack_
  // speed_cast (execution 'channel', xem CombatSkillPresentation.ts's
  // cadencePolicyOf) nên buildLoadoutPresentation() không tự tính
  // cadenceRemaining/Total cho slot này — đọc thẳng CombatEntity.
  // tuLucActive/tuLucElapsed (Task 3) + batKiemTickSeconds (nhịp UI
  // đang áp dụng) để KiemTuCombatHud.vue tự vẽ progress riêng.
  const tuLucState = computed(() => {
    stateVersion.value

    if (player.kiemTuRoute !== 'bat_kiem') {
      return undefined
    }

    const battle = gameManager.getBattle()

    if (!battle) {
      return undefined
    }

    return {
      active: battle.player.tuLucActive,
      elapsed: battle.player.tuLucElapsed,
      tickSeconds: batKiemTickSeconds.value,
    }
  })

  return { loadout, skillFor, tuLucState }
}
