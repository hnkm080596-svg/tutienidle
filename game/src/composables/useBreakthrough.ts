import { usePlayerStore } from '../stores/player'
import { useGameManager } from './useGameState'
import { useWorldAnnouncementStore } from '../stores/worldAnnouncement'
import { getCurrentRealm } from '../core/realm/realmSystem'
import type { GameManager } from '../core/game/GameManager'

/**
 * Trước đây logic này nằm cứng trong App.vue (nút Đột Phá cũ đã bị
 * gỡ khỏi template từ Đợt 1) — tách ra composable để dùng lại ở
 * BreakthroughButton.vue mà không phải viết lại.
 *
 * Mỗi lần phá cảnh giới (tiểu HOẶC đại): realm passive tự sync
 * (GameManager.syncRealmPassive()) VÀ 3 skill chủ động đang trang bị
 * tự nâng level theo realmLevel (GameManager.syncSkillLevelToRealm()).
 * Pháp Tu Redesign (magicpath, 2026-08-18) — Tâm Pháp không còn tự áp
 * hiệu ứng đột phá nào nữa (breakthroughEffect đã xoá, Tâm Pháp không
 * còn cộng chỉ số dưới bất kỳ hình thức nào).
 *
 * `gameManagerOverride` (Auto Đột Phá, 2026-08-20) — App.vue's tick()
 * gọi thẳng useBreakthrough() nhưng KHÔNG phải cây con của chính nó
 * (App.vue là nơi provide() GameManager, useGameManager() inject bên
 * trong sẽ throw nếu tự gọi trên chính App.vue) — truyền thẳng instance
 * gameManager cục bộ đã có sẵn để bỏ qua inject. Mọi caller khác (vd
 * CharacterPanel.vue) không truyền gì, giữ nguyên hành vi inject cũ.
 */
export function useBreakthrough(gameManagerOverride?: GameManager) {
  const player = usePlayerStore()
  const gameManager = gameManagerOverride ?? useGameManager()
  const worldAnnouncement = useWorldAnnouncementStore()

  function breakthrough(): boolean {
    const realmIdBefore = player.realmId

    const success = player.breakthrough()

    if (!success) {
      return false
    }

    // Có thể vừa đột phá sang đại cảnh giới mới — idempotent nên gọi
    // luôn sau mọi lần đột phá thành công, không cần tự so sánh
    // realmId trước/sau.
    gameManager.syncRealmPassive(player.$state)
    gameManager.syncRealmStatPassive(player.$state)

    if (player.realmId !== realmIdBefore) {
      // Beta Phase 4 (World Announcement) — đại cảnh giới đổi là 1
      // "milestone" theo mục XIII tài liệu (khác Đột Phá Trúc Cơ, đã
      // có world announcement riêng qua Độ Kiếp, xem useTribulation.ts).
      worldAnnouncement.show(
        getCurrentRealm(player.realmId).name.toUpperCase(),
        'Đạo hữu đã đột phá đại cảnh giới, tu vi tăng vọt.',
      )
    }

    return true
  }

  return { breakthrough }
}
