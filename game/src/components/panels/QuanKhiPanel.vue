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
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n({ useScope: 'local' })

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
        t('panels.quanKhi.world.ceremonyTitle'),
        t('panels.quanKhi.world.ceremonyBody', { name: kit.name }),
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

// Kiếm Thế / Kiếm Ý (spec 2026-08-29-kiem-the-kiem-y mục 1) — route
// chốt VĨNH VIỄN ngay lúc chọn path (tram Lv3 → Bạt Kiếm, chưa → Kiếm
// Trận). KHÔNG còn UI đổi đường — khối chọn route cũ đã dỡ, chỉ hiển
// thị đường đã chốt + giải thích điều kiện.
const currentKiemTuRoute = computed<KiemTuRoute>(() => {
  stateVersion.value

  return player.kiemTuRoute ?? 'kiem_tran'
})

const routeNameDisplay = computed(() =>
  currentKiemTuRoute.value === 'bat_kiem'
    ? t('panels.quanKhi.routeNames.batKiem')
    : t('panels.quanKhi.routeNames.kiemTran'),
)
</script>

<template>
  <OverlayPanel :open="ui.standalonePanel === 'quan_khi'" :title="t('panels.quanKhi.title')" width="min(480px, 90vw)" @close="close">
    <div v-if="!player.cultivationPath" class="quan-khi-panel__card">
      <p class="quan-khi-panel__hint">{{ t('panels.quanKhi.sections.pathSelection.hint') }}</p>

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
          {{ t('panels.quanKhi.actions.enterPath', { name: kit.name }) }}
        </GameButton>
      </div>
    </div>

    <!-- Kiếm Thế / Kiếm Ý (spec 2026-08-29) — route đã chốt vĩnh viễn
         lúc chọn path, hiển thị thông tin thay vì UI đổi đường cũ. Bọc
         card thật (2026-08-30 frontend-design pass: trước đây chỉ là 2
         đoạn văn trần, không có khung nào tách khỏi overlay chrome). -->
    <div v-if="isKiemTu" class="quan-khi-panel__card">
      <div class="quan-khi-panel__route-card">
        <p class="quan-khi-panel__hint">
          {{ t('panels.quanKhi.sections.kiemTuRoute.hintPrefix') }} <strong class="quan-khi-panel__route-name">{{ routeNameDisplay }}</strong>{{ t('panels.quanKhi.sections.kiemTuRoute.hintSuffix') }}
        </p>
        <p class="quan-khi-panel__warning">
          {{ currentKiemTuRoute === 'bat_kiem'
            ? t('panels.quanKhi.sections.kiemTuRoute.batKiemDescription')
            : t('panels.quanKhi.sections.kiemTuRoute.kiemTranDescription') }}
        </p>
      </div>
    </div>

    <ConfirmModal
      :open="pendingPathId !== null"
      :title="t('panels.quanKhi.messages.confirmPathTitle')"
      :message="t('panels.quanKhi.messages.confirmPathBody', { name: pendingPathName })"
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
  color: var(--paper-text);
}

/* Câu duy nhất trước 1 quyết định vĩnh viễn — xứng đáng cỡ chữ lớn hơn
   text-sm mặc định (2026-08-30 frontend-design pass). */
.quan-khi-panel__hint {
  margin: 0;
  font-size: var(--text-md);
  color: var(--paper-text-muted);
}

.quan-khi-panel__route-name {
  color: var(--chrome-100);
}

/* Khối "đường đã chốt" — card thật thay vì văn bản trần (2026-08-30). */
.quan-khi-panel__route-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: var(--ink-800);
  border: 1px solid var(--chrome-500);
  border-radius: var(--radius-md);
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

/* Đoạn giải thích thật sự — trước đây nhỏ HƠN dòng hint phía trên nó dù
   là nội dung payoff chính (2026-08-30 frontend-design pass). */
.quan-khi-panel__warning {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--gold-500);
}
</style>
