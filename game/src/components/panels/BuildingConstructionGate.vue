<script setup lang="ts">
// BUILDing spec mục 2/5 — mỗi panel Tứ Nghệ (Đan Phòng/Trận Đài/Phù
// Viện/Khí Đường) giờ đi qua đúng 1 BuildingInstance thật: CHƯA xây
// thì chặn hẳn Function UI, hiện màn Construction (tái dùng
// BuildingSystem.canBuild/build); ĐÃ xây thì hiện header Lv.X + Nâng
// Cấp, rồi mới tới nội dung thật qua <slot /> — click Building (nav
// entry) vẫn mở THẲNG panel như cũ, gate này chỉ quyết định BÊN TRONG
// panel render gì (không thêm màn hình trung gian nào ngoài panel).
// Thám Hiểm rework — build() thêm window.confirm() (y/n mở khoá) TRƯỚC
// khi trừ nguyên liệu, cùng pattern HomeBuildingIcons.vue's
// BuildingDetailPopover.vue (2 nơi build Building giờ đều xác nhận).
import { computed, onMounted, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { formatNumber } from '@/core/format/NumberFormatter'
import { isTestModeUnlockAll } from '@/core/dev/DevMode'
import GameButton from '@/components/common/GameButton.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const props = defineProps<{ buildingId: string }>()

const player = usePlayerStore()
const gameManager = useGameManager()
const { stateVersion, bumpState } = useStateVersion()

const template = computed(() => gameManager.buildingRegistry.get(props.buildingId))

const instance = computed(() => {
  stateVersion.value

  return gameManager.buildingManager.getByBuildingId(props.buildingId)
})

// Cờ test (2026-08-20) — tự cấp instance MIỄN PHÍ thay vì hiện màn
// Construction, cùng pattern App.vue's grant khởi tạo cho
// teleport_array/gathering_outpost (add THẲNG qua buildingManager, bỏ
// qua canBuild/cost). Làm ở đây (thay vì fake `instance` trong template)
// để nội dung thật phía sau gate (Lv.X/Nâng Cấp/<slot>) đọc 1 instance
// THẬT, không cần né null-check riêng.
onMounted(() => {
  if (isTestModeUnlockAll() && !instance.value) {
    gameManager.buildingManager.add({
      instanceId: crypto.randomUUID(),
      buildingId: props.buildingId,
      level: 1,
      lastCollectedAt: Date.now() / 1000,
    })

    bumpState()
  }
})

const buildCost = computed(() => template.value.upgradeCost[0] ?? [])

const canBuild = computed(() =>
  gameManager.buildingSystem.canBuild(
    props.buildingId,
    gameManager.buildingRegistry,
    gameManager.buildingManager,
    player.$state,
    gameManager.materialBag,
  ),
)

function materialLabel(materialId: string): string {
  return gameManager.materialRegistry.has(materialId) ? gameManager.materialRegistry.get(materialId).name : materialId
}

// UI-007 (Task 5, 2026-09-07) — window.confirm() native → ConfirmModal
// dùng chung (in-game modal, keyboard + focus trap, hủy các luồng native
// còn sót). Modal xác nhận hiện khi bấm Xây; confirm mới trừ tài nguyên.
const confirmOpen = ref(false)

function requestBuild() {
  confirmOpen.value = true
}

function build() {
  confirmOpen.value = false

  if (gameManager.buildBuilding(props.buildingId, player.$state)) {
    bumpState()
  }
}

</script>

<template>
  <div class="construction-gate">
    <div v-if="!instance" class="construction-gate__locked">
      <div class="construction-gate__icon">{{ template.name.charAt(0) }}</div>

      <h3 class="construction-gate__name">{{ template.name }}</h3>

      <p class="construction-gate__description">{{ template.description }}</p>

      <p class="construction-gate__cost">
        Cần: {{ buildCost.map(c => `${materialLabel(c.materialId)} x${formatNumber(c.amount)}`).join(', ') || 'Miễn phí' }}
      </p>

      <GameButton class="construction-gate__build" size="sm" :disabled="!canBuild" @click="requestBuild">
        Xây Dựng
      </GameButton>
    </div>

    <div v-else class="construction-gate__content">
      <slot />
    </div>

    <!-- UI-007 — xác nhận xây qua ConfirmModal dùng chung (thay window.confirm).
         Đặt NGOÀI cặp v-if/v-else để không phá adjacency của chúng. -->
    <ConfirmModal
      :open="confirmOpen"
      :title="`Xây ${template.name}?`"
      :message="`Sẽ tốn ${buildCost.map(c => `${materialLabel(c.materialId)} x${formatNumber(c.amount)}`).join(', ') || 'miễn phí'}.`"
      :confirm-label="'Xây Dựng'"
      @confirm="build"
      @cancel="confirmOpen = false"
    />
  </div>
</template>

<style scoped>
.construction-gate {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.construction-gate__locked {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: var(--paper-text);
  font-family: var(--font-body);
}

.construction-gate__icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--chrome-500);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  color: var(--paper-text);
  font-size: var(--text-title);
}

.construction-gate__name {
  margin: 4px 0 0;
  font-family: var(--font-display);
  color: var(--paper-text);
  font-size: var(--text-lg);
}

.construction-gate__description {
  margin: 0;
  color: var(--paper-text-soft);
  font-size: var(--text-sm);
  max-width: 280px;
}

.construction-gate__cost {
  margin: 4px 0 0;
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.construction-gate__build {
  margin-top: 10px;
  padding: 8px 20px;
}

.construction-gate__content {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
