<script setup lang="ts">
// Quán Khí (2026-08-20, Realm Passive & Pressure follow-up) — tách
// path-choices ("Bước Vào Pháp Tu/Kiếm Tu") ra khỏi CharacterPanel.vue
// thành overlay riêng, cùng pattern SkillPathPanel.vue/TechniquePanel.vue.
// Mở qua nút "Quán Khí" bên cạnh Đột Phá (CharacterPanel.vue's
// .character-panel__breakthrough) khi player.realmLevel >= 12 ở Phàm
// Nhân (xem QUAN_KHI_UNLOCK_LEVEL ở đó) — panel này KHÔNG tự kiểm tra
// lại điều kiện, chỉ tự đóng ngay sau khi chọn xong (component gọi nó
// đã gate rồi).
import { computed, ref } from 'vue'
import { useUiStore } from '@/stores/ui'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useWorldAnnouncementStore } from '@/stores/worldAnnouncement'
import { CULTIVATION_PATH_KITS } from '@/core/player/CultivationPathKit'
import type { CultivationPathId } from '@/core/player/CultivationPathKit'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import { isBattleInProgress } from '@/core/battle/BattleTypes'

type KiemTuRoute = 'kiem_tran' | 'bat_kiem'

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

// Thay window.confirm() native — modal xác nhận đồng bộ hoá qua state
// (giữ nguyên yêu cầu "lựa chọn KHÔNG thể đổi lại" bằng modal riêng
// thay vì browser confirm() mặc định).
const pendingPathId = ref<CultivationPathId | null>(null)

const pendingPathName = computed(() => (pendingPathId.value ? CULTIVATION_PATH_KITS[pendingPathId.value].name : ''))

function choosePath(pathId: CultivationPathId) {
  pendingPathId.value = pathId
}

function cancelChoosePath() {
  pendingPathId.value = null
}

function confirmChoosePath() {
  const pathId = pendingPathId.value

  pendingPathId.value = null

  if (!pathId) {
    return
  }

  const kit = CULTIVATION_PATH_KITS[pathId]

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

// Kiếm Tu tự lực (2026-08-28, task-7-brief.md §2) — 2 nút chọn đường
// SONG SONG, khác hẳn availablePaths ở trên (đó là lựa chọn nghề MỘT
// LẦN, KHÔNG đổi lại được — xem ConfirmModal). Đây đổi được nhiều lần
// ngoài combat, cùng pattern reversible ArtifactPathCards.vue/
// ArtifactPanel.vue's onSelectPath (setArtifactPath) — KHÔNG dùng
// window.confirm/ConfirmModal.
const isKiemTu = computed(() => {
  stateVersion.value

  return player.cultivationPath === 'kiem_tu'
})

const currentKiemTuRoute = computed<KiemTuRoute>(() => {
  stateVersion.value

  return player.kiemTuRoute ?? 'kiem_tran'
})

// Gate Bạt Kiếm (Task 2): skillCastCounts/skillLevels là mirror của
// tổng exp/level skill 'tram' (Trảm — kỹ năng Kiếm Trận), giữ đồng bộ
// bởi SkillSystem's cast-count sink — KHÔNG đọc lại skillManager trực
// tiếp ở panel này, cùng nguồn dữ liệu GameManager.setKiemTuRoute() đọc.
const isBatKiemUnlocked = computed(() => {
  stateVersion.value

  return (player.skillCastCounts?.tram ?? 0) >= 9999 && (player.skillLevels?.tram ?? 0) >= 3
})

const canChangeRoute = computed(() => {
  stateVersion.value

  return !isBattleInProgress(gameManager.getBattle()?.state)
})

function selectKiemTuRoute(route: KiemTuRoute) {
  if (gameManager.setKiemTuRoute(player.$state, route)) {
    bumpState()
  }
}
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'quan_khi'" title="Quán Khí" width="min(480px, 90vw)" @close="close">
    <div v-if="!player.cultivationPath" class="quan-khi-panel__card">
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

    <!-- Kiếm Tu tự lực (task-7-brief.md §2) — chọn đường SONG SONG,
         đổi được nhiều lần ngoài combat (khác lựa chọn nghề ở trên). -->
    <div v-if="isKiemTu" class="quan-khi-panel__card">
      <p class="quan-khi-panel__hint">Chọn đường Kiếm Tu — đổi được ngoài trận, không cần xác nhận.</p>

      <div class="quan-khi-panel__choices">
        <button
          type="button"
          class="quan-khi-panel__choice"
          :class="{ 'is-selected': currentKiemTuRoute === 'kiem_tran' }"
          :disabled="!canChangeRoute && currentKiemTuRoute !== 'kiem_tran'"
          @click="selectKiemTuRoute('kiem_tran')"
        >
          Kiếm Trận
        </button>

        <button
          v-if="isBatKiemUnlocked"
          type="button"
          class="quan-khi-panel__choice"
          :class="{ 'is-selected': currentKiemTuRoute === 'bat_kiem' }"
          :disabled="!canChangeRoute && currentKiemTuRoute !== 'bat_kiem'"
          @click="selectKiemTuRoute('bat_kiem')"
        >
          Bạt Kiếm
        </button>
      </div>

      <p v-if="!canChangeRoute" class="quan-khi-panel__warning">
        Không thể đổi đường trong combat — sẽ áp dụng từ trận kế.
      </p>

      <p v-else-if="!isBatKiemUnlocked" class="quan-khi-panel__warning">
        Bạt Kiếm mở khi Trảm đạt tầng 3 và đã thi triển đủ 9999 lần.
      </p>
    </div>

    <ConfirmModal
      :open="pendingPathId !== null"
      title="Xác Nhận Con Đường"
      :message="`Bước vào ${pendingPathName}? Lựa chọn này KHÔNG thể đổi lại.`"
      danger
      @confirm="confirmChoosePath"
      @cancel="cancelChoosePath"
    />
  </OverlayPanel>
</template>

<style scoped>
.quan-khi-panel__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 24px;
  font-family: var(--font-body);
  color: var(--text-primary);
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

.quan-khi-panel__choice.is-selected {
  border-color: var(--jade);
  background: linear-gradient(180deg, var(--jade), var(--ink-800));
  box-shadow: 0 0 10px -3px var(--jade);
}

.quan-khi-panel__choice:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.quan-khi-panel__warning {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--gold-500);
}
</style>
