<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useBreakthroughRequirementStore } from '@/stores/breakthroughRequirement'
import { useTribulation } from '@/composables/useTribulation'
import { getNextRealm } from '@/core/realm/realmSystem'
import { BREAKTHROUGH_REQUIREMENTS } from '@/core/breakthrough/BreakthroughRequirement'
import { formatNumber } from '@/core/format/NumberFormatter'
import OverlayPanel from '@/components/common/OverlayPanel.vue'

// Đột Phá tổng quát (2026-08-16) — "con đường bình thường" của Đột
// Phá: panel giữa màn hình hiện TRƯỚC khi vào Độ Kiếp, hiện đúng 1
// slot vật phẩm yêu cầu (xem core/breakthrough/BreakthroughRequirement.ts)
// + nút luyện thẳng bằng Linh Thạch nếu thiếu. KHÔNG đụng gì tới cơ
// chế Căn Cơ ẨN (FoundationResolver.ts) — panel này chỉ là 1 cổng MỚI
// đứng TRƯỚC bước resolveFoundation()/startTribulation() sẵn có, hệ ẩn
// vẫn tự chạy y hệt cũ ngay khi bấm "Đột Phá" ở dưới.
const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()
const store = useBreakthroughRequirementStore()
const { triggerFoundationBreakthrough, triggerRealmBreakthrough } = useTribulation()

const targetRealm = computed(() => {
  stateVersion.value

  return getNextRealm(player.realmId)
})

const requirement = computed(() =>
  targetRealm.value ? BREAKTHROUGH_REQUIREMENTS[targetRealm.value.id] : undefined,
)

const materialName = computed(() =>
  requirement.value && gameManager.materialRegistry.has(requirement.value.materialId)
    ? gameManager.materialRegistry.get(requirement.value.materialId).name
    : '',
)

const owned = computed(() => {
  stateVersion.value

  return requirement.value ? gameManager.materialBag.getAmount(requirement.value.materialId) : 0
})

const hasEnoughItem = computed(() => owned.value >= 1)
const cooldownSeconds = computed(() => {
  stateVersion.value
  return gameManager.getTribulationCooldownSeconds()
})

const canCraft = computed(() =>
  requirement.value ? gameManager.canCraftBreakthroughToken(targetRealm.value!.id, player.$state) : false,
)

function craft() {
  if (!targetRealm.value) {
    return
  }

  if (gameManager.craftBreakthroughToken(targetRealm.value.id, player.$state)) {
    bumpState()
  }
}

function confirmBreakthrough() {
  if (!targetRealm.value || !hasEnoughItem.value || cooldownSeconds.value > 0) {
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
    :open="store.isOpen && Boolean(targetRealm && requirement)"
    :title="`Đột Phá ${targetRealm?.name ?? ''}`"
    width="min(420px, 94vw)"
    @close="store.close()"
  >
    <div v-if="targetRealm && requirement" class="breakthrough-requirement__panel">
      <p class="breakthrough-requirement__hint">Cần đủ vật phẩm dưới đây trước khi Độ Kiếp.</p>

      <div class="breakthrough-requirement__slot" :class="{ 'breakthrough-requirement__slot--ready': hasEnoughItem }">
        <span class="breakthrough-requirement__slot-name">{{ materialName }}</span>
        <span class="breakthrough-requirement__slot-amount">{{ owned }}/1</span>
      </div>

      <button
        v-if="!hasEnoughItem"
        type="button"
        class="breakthrough-requirement__craft"
        :disabled="!canCraft"
        @click="craft"
      >
        Luyện ({{ formatNumber(requirement.spiritStoneCost) }} Linh Thạch)
      </button>

      <div class="breakthrough-requirement__actions">
        <button type="button" class="breakthrough-requirement__cancel" @click="store.close()">Đóng</button>

        <button
          type="button"
          class="breakthrough-requirement__confirm"
          :disabled="!hasEnoughItem || cooldownSeconds > 0"
          @click="confirmBreakthrough"
        >
          Độ Kiếp
        </button>
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
  font-size: 0.8rem;
  color: var(--text-secondary);
  text-align: center;
}

.breakthrough-requirement__slot {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 10px 14px;
  border: 1px solid var(--ink-700);
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  color: var(--text-primary);
}

.breakthrough-requirement__slot--ready {
  border-color: var(--jade);
  color: var(--jade);
}

.breakthrough-requirement__craft {
  padding: 8px;
  background: var(--ink-800);
  color: var(--text-primary);
  border: 1px solid var(--ink-700);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.breakthrough-requirement__craft:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
}

.breakthrough-requirement__cancel {
  background: var(--ink-800);
  color: var(--text-secondary);
}

.breakthrough-requirement__confirm {
  background: var(--gold-500);
  color: var(--gold-ink);
}

.breakthrough-requirement__confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
