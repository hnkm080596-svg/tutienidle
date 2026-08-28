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
import type { KiemTuRoute } from '@/core/player/Player'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import GameButton from '@/components/common/GameButton.vue'
import { isBattleInProgress } from '@/core/battle/BattleTypes'

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

// Gate Bạt Kiếm — review fix (Important): GameManager.setKiemTuRoute()
// thực ra chặn bằng getNodeLevel('bat_kiem_thuc', player) >= 1 (keystone
// ĐÃ MUA trong cây công pháp, Task 6), KHÔNG phải ngưỡng skillCastCounts/
// skillLevels['tram'] >= 9999/3 — ngưỡng đó chỉ là điều kiện MỞ node gốc
// `bat_kiem_an` (xem KiemTuNodes.ts), một bước SỚM HƠN trong chuỗi mua
// bat_kiem_an -> minor_bat_kiem_uy -> bat_kiem_thuc. Đọc nhầm mốc này khiến
// nút "Bạt Kiếm" render enabled trong lúc setKiemTuRoute() vẫn âm thầm
// trả false (chưa mua đủ cây). Dùng ĐÚNG hàm gate thật để không lệch.
const isBatKiemUnlocked = computed(() => {
  stateVersion.value

  return gameManager.getNodeLevel('bat_kiem_thuc', player.$state) >= 1
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
        <GameButton
          v-for="kit in availablePaths"
          :key="kit.id"
          class="quan-khi-panel__choice"
          variant="danger"
          size="sm"
          :disabled="cooldownSeconds > 0"
          @click="choosePath(kit.id)"
        >
          Bước Vào {{ kit.name }}
        </GameButton>
      </div>
    </div>

    <!-- Kiếm Tu tự lực (task-7-brief.md §2) — chọn đường SONG SONG,
         đổi được nhiều lần ngoài combat (khác lựa chọn nghề ở trên). -->
    <div v-if="isKiemTu" class="quan-khi-panel__card">
      <p class="quan-khi-panel__hint">Chọn đường Kiếm Tu — đổi được ngoài trận, không cần xác nhận.</p>

      <div class="quan-khi-panel__choices">
        <GameButton
          class="quan-khi-panel__choice"
          variant="danger"
          size="sm"
          :class="{ 'is-selected': currentKiemTuRoute === 'kiem_tran' }"
          :disabled="!canChangeRoute && currentKiemTuRoute !== 'kiem_tran'"
          @click="selectKiemTuRoute('kiem_tran')"
        >
          Kiếm Trận
        </GameButton>

        <GameButton
          v-if="isBatKiemUnlocked"
          class="quan-khi-panel__choice"
          variant="danger"
          size="sm"
          :class="{ 'is-selected': currentKiemTuRoute === 'bat_kiem' }"
          :disabled="!canChangeRoute && currentKiemTuRoute !== 'bat_kiem'"
          @click="selectKiemTuRoute('bat_kiem')"
        >
          Bạt Kiếm
        </GameButton>
      </div>

      <p v-if="!canChangeRoute" class="quan-khi-panel__warning">
        Không thể đổi đường trong combat — sẽ áp dụng từ trận kế.
      </p>

      <p v-else-if="!isBatKiemUnlocked" class="quan-khi-panel__warning">
        Bạt Kiếm mở khi đã tu luyện Trảm đạt tầng 3 + 9999 lần thi triển VÀ đã mua trọn Bạt Kiếm Thức trong cây công pháp.
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
  /* Nghi thức chọn con đường vĩnh viễn — giữ crimson gradient chủ đích
     (signaling quyết định không hoàn tác), đè lên variant danger phẳng. */
  background: linear-gradient(180deg, var(--crimson), var(--ink-800));
  border: 1px solid var(--chrome-500);
  color: var(--text-primary);
}

.quan-khi-panel__choice.is-selected {
  border-color: var(--jade);
  background: linear-gradient(180deg, var(--jade), var(--ink-800));
  box-shadow: 0 0 10px -3px var(--jade);
}

.quan-khi-panel__choice:disabled {
  opacity: 0.6;
}

.quan-khi-panel__warning {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--gold-500);
}
</style>
