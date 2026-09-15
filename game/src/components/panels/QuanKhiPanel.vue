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
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import GameButton from '@/components/common/GameButton.vue'
import { isBattleInProgress } from '@/core/battle/BattleTypes'
import { KIEM_PHO_ORBS, ORB_UNLOCK_REALM } from '@/data/skill/KiemPhoOrbs'
import type { OrbId } from '@/core/kiem-tu/KiemTuState'
import { turnSkillDisplayMetaOf } from '@/data/skill/TurnSkillDisplayMeta'
import { getRealmIndex } from '@/core/realm/realmSystem'
import { REALMS } from '@/data/realms/realm'

const { t } = useI18n()

const ui = useUiStore()
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const cooldownSeconds = computed(() => {
  stateVersion.value
  return gameManager.tribulationDirector.getCooldownSeconds()
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
  if (gameManager.realmAdvanceOps.chooseCultivationPath(pathId, player.$state)) {
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

// Kiem Tu specialization card below — shown only after the player has
// chosen the kiem_tu path (read-only display; the hien -> ngu
// conversion lives on the kiem_tu_an node, not in this panel).
const isKiemTu = computed(() => {
  stateVersion.value

  return player.cultivationPath === 'kiem_tu'
})

// Kiem Tu Reimagined (spec 2026-09-15) — hien/ngu specialization mode
// is canonical on PlayerData.kiemTu. 'hien' (Kiem Pho) is the visible
// spec every Kiem Tu starts as; 'ngu' (Ngu Kiem Dao) appears only
// after the hidden kiem_tu_an conversion, so displaying it here never
// spoils a path the player has not unlocked.
const kiemTuMode = computed(() => {
  stateVersion.value

  return player.kiemTu?.mode ?? 'hien'
})

const specNameDisplay = computed(() =>
  kiemTuMode.value === 'ngu'
    ? t('panels.quanKhi.specNames.nguKiemDao')
    : t('panels.quanKhi.specNames.kiemPho'),
)

// Kiem Tu Reimagined (spec §11) — out-of-combat Kiem Pho preset editor.
// Direct-op editing: every click goes through setKiemPhoPreset() so
// PlayerData stays the single source of truth — no draft copy to sync.
const orbPalette = Object.keys(KIEM_PHO_ORBS) as OrbId[]

const realmIndex = computed(() => {
  stateVersion.value

  return getRealmIndex(player.realmId)
})

const presetOrbs = computed<OrbId[]>(() => {
  stateVersion.value

  return player.kiemTu?.preset ?? []
})

const presetBattleLocked = computed(() => {
  stateVersion.value

  return isBattleInProgress(gameManager.getTurnBattle()?.state)
})

function orbLabel(orbId: OrbId): string {
  return turnSkillDisplayMetaOf(orbId)?.name ?? orbId
}

function orbTooltip(orbId: OrbId): string {
  return turnSkillDisplayMetaOf(orbId)?.description ?? ''
}

function isOrbUnlocked(orbId: OrbId): boolean {
  return ORB_UNLOCK_REALM[orbId] <= realmIndex.value
}

function orbUnlockRealmName(orbId: OrbId): string {
  return REALMS[ORB_UNLOCK_REALM[orbId]]?.name ?? ''
}

function appendOrb(orbId: OrbId) {
  if (presetBattleLocked.value || !isOrbUnlocked(orbId) || presetOrbs.value.length >= 9) {
    return
  }

  if (gameManager.progressionOps.setKiemPhoPreset(player.$state, [...presetOrbs.value, orbId])) {
    bumpState()
  }
}

function removeOrbAt(index: number) {
  if (presetBattleLocked.value || presetOrbs.value.length <= 1) {
    return
  }

  const next = presetOrbs.value.filter((_, slotIndex) => slotIndex !== index)

  if (gameManager.progressionOps.setKiemPhoPreset(player.$state, next)) {
    bumpState()
  }
}
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

    <!-- Kiem Tu Reimagined (spec 2026-09-15) — shows the active
         specialization (Kiem Pho / Ngu Kiem Dao) read from
         player.kiemTu.mode. -->
    <div v-if="isKiemTu" class="quan-khi-panel__card">
      <div class="quan-khi-panel__route-card">
        <p class="quan-khi-panel__hint">
          {{ t('panels.quanKhi.sections.kiemTuSpec.hintPrefix') }} <strong class="quan-khi-panel__route-name">{{ specNameDisplay }}</strong>{{ t('panels.quanKhi.sections.kiemTuSpec.hintSuffix') }}
        </p>
        <p class="quan-khi-panel__warning">
          {{ kiemTuMode === 'ngu'
            ? t('panels.quanKhi.sections.kiemTuSpec.nguDescription')
            : t('panels.quanKhi.sections.kiemTuSpec.hienDescription') }}
        </p>
      </div>
    </div>

    <!-- Kiem Pho preset editor — hien only (ngu never reads preset).
         Strip = current persisted sequence, palette = realm-unlocked
         orbs; both write through setKiemPhoPreset(). -->
    <div v-if="isKiemTu && kiemTuMode === 'hien'" class="quan-khi-panel__card">
      <div class="quan-khi-panel__route-card">
        <p class="quan-khi-panel__hint">{{ t('panels.quanKhi.sections.kiemPhoPreset.title') }}</p>
        <p class="quan-khi-panel__hint">{{ t('panels.quanKhi.sections.kiemPhoPreset.hint') }}</p>
        <p v-if="presetBattleLocked" class="quan-khi-panel__warning">
          {{ t('panels.quanKhi.sections.kiemPhoPreset.battleLocked') }}
        </p>

        <div class="quan-khi-panel__preset-strip" role="listbox" :aria-label="t('panels.quanKhi.sections.kiemPhoPreset.title')">
          <button
            v-for="(orbId, index) in presetOrbs"
            :key="`${index}-${orbId}`"
            type="button"
            class="quan-khi-panel__preset-slot"
            :disabled="presetBattleLocked || presetOrbs.length <= 1"
            :aria-label="t('panels.quanKhi.sections.kiemPhoPreset.removeAria', { name: orbLabel(orbId) })"
            @click="removeOrbAt(index)"
          >
            {{ orbLabel(orbId) }}
          </button>
          <span
            v-for="empty in 9 - presetOrbs.length"
            :key="`empty-${empty}`"
            class="quan-khi-panel__preset-slot quan-khi-panel__preset-slot--empty"
          ></span>
        </div>

        <div class="quan-khi-panel__preset-palette">
          <button
            v-for="orbId in orbPalette"
            :key="orbId"
            type="button"
            class="quan-khi-panel__preset-orb"
            :class="{ 'is-locked': !isOrbUnlocked(orbId) }"
            :disabled="presetBattleLocked || !isOrbUnlocked(orbId) || presetOrbs.length >= 9"
            :title="isOrbUnlocked(orbId) ? orbTooltip(orbId) : t('panels.quanKhi.sections.kiemPhoPreset.lockedHint', { realm: orbUnlockRealmName(orbId) })"
            :aria-label="t('panels.quanKhi.sections.kiemPhoPreset.appendAria', { name: orbLabel(orbId) })"
            @click="appendOrb(orbId)"
          >
            {{ orbLabel(orbId) }}
          </button>
        </div>
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

/* Kiem Pho preset editor — strip mirrors the HUD preset readout;
   palette buttons mirror the manual orb picker. */
.quan-khi-panel__preset-strip {
  display: flex;
  gap: 4px;
}

.quan-khi-panel__preset-slot {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: var(--text-xs);
  background: var(--ink-700);
  border: 1px solid var(--chrome-500);
  border-radius: var(--radius-sm);
  color: var(--paper-text);
  cursor: pointer;
}

.quan-khi-panel__preset-slot--empty {
  border-style: dashed;
  opacity: 0.35;
  cursor: default;
}

.quan-khi-panel__preset-slot:disabled {
  cursor: default;
  opacity: 0.6;
}

.quan-khi-panel__preset-palette {
  display: flex;
  gap: 6px;
}

.quan-khi-panel__preset-orb {
  flex: 1;
  padding: 8px 4px;
  font-size: var(--text-sm);
  background: linear-gradient(180deg, var(--ink-700), var(--ink-800));
  border: 1px solid var(--chrome-500);
  border-radius: var(--radius-sm);
  color: var(--paper-text);
  cursor: pointer;
}

.quan-khi-panel__preset-orb:not(:disabled):hover {
  border-color: var(--jade);
}

.quan-khi-panel__preset-orb.is-locked {
  opacity: 0.45;
}

.quan-khi-panel__preset-orb:disabled {
  cursor: default;
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
