<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { useTribulation } from '@/composables/useTribulation'
import { getNextRealm } from '@/core/realm/realmSystem'
import { formatNumber } from '@/core/format/NumberFormatter'
import { SPIRIT_STONE_MATERIAL_ID } from '@/core/material/SpiritStoneMaterial'
import OverlayPanel from '@/components/common/OverlayPanel.vue'
import GameButton from '@/components/common/GameButton.vue'

// Spec dot-pha-loi-kiep §6.3 — Đột Phá Lệnh đã DỠ: panel chỉ còn xác
// nhận Linh Thạch trực tiếp (trừ khi bấm Độ Kiếp, không qua token).
// Điều kiện bậc ẩn KHÔNG BAO GIỜ liệt kê (chính sách phơi bày 3 tầng:
// Nhân công khai qua gate tầng 12, Địa/Thiên chỉ flavor hint bên dưới,
// Đại Đạo ẩn hoàn toàn).
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const store = useBreakthroughRequirementStore()
const { triggerFoundationBreakthrough, triggerRealmBreakthrough } = useTribulation()

const targetRealm = computed(() => {
  stateVersion.value

  return getNextRealm(player.realmId)
})

const spiritStoneCost = computed(() =>
  targetRealm.value ? gameManager.getTribulationSpiritStoneCost(targetRealm.value.id) : 0,
)

const ownedSpiritStones = computed(() => {
  stateVersion.value

  return gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)
})

const hasEnoughStones = computed(() => ownedSpiritStones.value >= spiritStoneCost.value)

const cooldownSeconds = computed(() => {
  stateVersion.value
  return gameManager.getTribulationCooldownSeconds()
})

function confirmBreakthrough() {
  if (!targetRealm.value || !hasEnoughStones.value || cooldownSeconds.value > 0) {
    return
  }

  const success = targetRealm.value.id === 'foundation_establishment'
    ? triggerFoundationBreakthrough()
    : triggerRealmBreakthrough(targetRealm.value.id)

  if (success) {
    store.close()

    bumpState()
  }
}
</script>

<template>
  <OverlayPanel
    :open="store.isOpen && Boolean(targetRealm)"
    :title="`Đột Phá ${targetRealm?.name ?? ''}`"
    width="min(420px, 94vw)"
    @close="store.close()"
  >
    <div v-if="targetRealm" class="breakthrough-requirement__panel">
      <p class="breakthrough-requirement__hint">Thiên lôi đã giăng kín — chỉ thiếu lòng quyết.</p>

      <div class="breakthrough-requirement__slot" :class="{ 'breakthrough-requirement__slot--ready': hasEnoughStones }">
        <span>Linh Thạch</span>
        <span class="breakthrough-requirement__slot-amount">{{ formatNumber(ownedSpiritStones) }} / {{ formatNumber(spiritStoneCost) }}</span>
      </div>

      <div class="breakthrough-requirement__flavor">
        <p>Tương truyền người có Trúc Cơ Đan tại thân, căn cốt lại vững...</p>
        <p>...kinh mạch thông suốt, thiên kiếp cũng phải nhường ba phần.</p>
      </div>

      <p class="breakthrough-requirement__warning">Đột phá sẽ tháo toàn bộ trang bị (yêu cầu trang bị ngang phẩm mới)</p>

      <div class="breakthrough-requirement__actions">
        <GameButton class="breakthrough-requirement__cancel" variant="ghost" size="sm" @click="store.close()">Đóng</GameButton>

        <GameButton
          class="breakthrough-requirement__confirm"
          size="sm"
          :disabled="!hasEnoughStones || cooldownSeconds > 0"
          @click="confirmBreakthrough"
        >
          Độ Kiếp
        </GameButton>
      </div>
    </div>
  </OverlayPanel>
</template>

<style scoped>
.breakthrough-requirement__panel {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.breakthrough-requirement__hint {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--paper-text-soft);
  text-align: center;
}

.breakthrough-requirement__slot {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 10px 14px;
  border: 1px solid var(--ink-700);
  border-radius: var(--radius-sm);
  font-size: var(--text-body);
  color: var(--paper-text);
}

.breakthrough-requirement__slot--ready {
  border-color: var(--jade);
  color: var(--jade);
}

.breakthrough-requirement__flavor {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 14px;
  border: 1px dashed var(--ink-line-soft);
  border-radius: var(--radius-sm);
}

.breakthrough-requirement__flavor p {
  margin: 0;
  font-size: var(--text-xs);
  font-style: italic;
  color: var(--paper-text-muted);
}

.breakthrough-requirement__warning {
  margin: 0;
  padding: 8px 12px;
  font-size: var(--text-xs);
  text-align: center;
  color: var(--danger, #c0392b);
  border: 1px dashed currentColor;
  border-radius: var(--radius-sm);
}

.breakthrough-requirement__actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.breakthrough-requirement__cancel,
.breakthrough-requirement__confirm {
  flex: 1;
  padding: 8px;
}

.breakthrough-requirement__confirm:disabled {
  opacity: 0.5;
}
</style>
