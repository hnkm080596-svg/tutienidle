<script setup lang="ts">
// Quán Khí (2026-08-20, Realm Passive & Pressure follow-up) — tách
// path-choices ("Bước Vào Pháp Tu/Kiếm Tu") ra khỏi CharacterPanel.vue
// thành overlay riêng, cùng pattern SkillPathPanel.vue/TechniquePanel.vue.
// Mở qua nút "Quán Khí" bên cạnh Đột Phá (CharacterPanel.vue's
// .character-panel__breakthrough) khi player.realmLevel >= 12 ở Phàm
// Nhân (xem QUAN_KHI_UNLOCK_LEVEL ở đó) — panel này KHÔNG tự kiểm tra
// lại điều kiện, chỉ tự đóng ngay sau khi chọn xong (component gọi nó
// đã gate rồi).
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useWorldAnnouncementStore } from '@/stores/worldAnnouncement'
import { CULTIVATION_PATH_KITS } from '@/core/player/CultivationPathKit'
import type { CultivationPathId } from '@/core/player/CultivationPathKit'

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const cooldownSeconds = computed(() => {
  stateVersion.value
  return gameManager.getTribulationCooldownSeconds()
})

// Liệt kê TẤT CẢ path trong CULTIVATION_PATH_KITS thay vì hardcode 1 —
// thêm path mới (Thủy/Kim/Thổ Tu sau này) chỉ cần thêm entry vào
// CultivationPathKit.ts, KHÔNG cần sửa file này (đúng nguyên bản trước
// khi dời từ CharacterPanel.vue).
const availablePaths = computed(() => Object.values(CULTIVATION_PATH_KITS))

function choosePath(pathId: CultivationPathId) {
  const kit = CULTIVATION_PATH_KITS[pathId]

  const confirmed = window.confirm(`Bước vào ${kit.name}? Lựa chọn này KHÔNG thể đổi lại.`)

  if (!confirmed) {
    return
  }

  const realmIdBefore = player.realmId
  if (gameManager.chooseCultivationPath(pathId, player.$state)) {
    bumpState()

    // Nghi Lễ Nhập Môn — chọn path VỪA LÀ hành động đột phá Phàm Nhân
    // -> Luyện Khí (xem GameManager.chooseCultivationPath()), xứng đáng
    // 1 world announcement giống mọi lần đổi đại cảnh giới khác.
    if (realmIdBefore === 'mortal' && player.realmId !== 'mortal') {
      useWorldAnnouncementStore().show(
        'LỄ NHẬP MÔN',
        `Đạo hữu đã từ bỏ thân phận phàm nhân, chính thức bước vào ${kit.name}.`,
      )
    }

    close()
  }
}

function close() {
  ui.closeHomeOverlays()
}
</script>

<template>
  <div v-if="ui.standalonePanel === 'quan_khi'" class="quan-khi-panel" @click.self="close">
    <div class="quan-khi-panel__card">
      <div class="quan-khi-panel__header">
        <h3 class="quan-khi-panel__title">Quán Khí</h3>

        <button type="button" class="quan-khi-panel__close" @click="close">✕</button>
      </div>

      <p class="quan-khi-panel__hint">Chọn con đường tu luyện — quyết định này KHÔNG thể đổi lại.</p>

      <div class="quan-khi-panel__choices">
        <button
          v-for="kit in availablePaths"
          :key="kit.id"
          type="button"
          class="quan-khi-panel__choice"
          :disabled="cooldownSeconds > 0"
          @click="choosePath(kit.id)"
        >
          Bước Vào {{ kit.name }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quan-khi-panel {
  position: absolute;
  inset: 0;
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 13, 0.72);
}

.quan-khi-panel__card {
  width: min(480px, 90%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 24px;
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  color: var(--text-primary);
}

.quan-khi-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quan-khi-panel__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  color: var(--gold-500);
}

.quan-khi-panel__close {
  width: 24px;
  height: 24px;
  padding: 0;
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.quan-khi-panel__hint {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.quan-khi-panel__choices {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quan-khi-panel__choice {
  display: block;
  width: 100%;
  padding: 10px;
  background: linear-gradient(180deg, var(--crimson), var(--ink-800));
  color: var(--text-primary);
  border: 1px solid var(--gold-500);
  border-radius: var(--radius-sm);
  font-weight: 700;
  font-size: 0.78rem;
  cursor: pointer;
}
</style>
