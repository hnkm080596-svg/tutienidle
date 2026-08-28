<script setup lang="ts">
import { computed } from 'vue'
import { useGameManager, useStateVersion } from '@/composables/useGameState'
import { useUiStore } from '@/stores/ui'

// Combat UI Redesign mục 5 — chỉ tên Địa Giới/Màn + tiến độ quái, KHÔNG
// có nút back (không có cơ chế "rút lui" giữa trận, xem mục 23 — không
// state nào khác ngoài Play/Pause) hay Settings (chưa có chỗ mở
// SettingsPanel hợp lý trong lúc Combat Scene chiếm toàn màn hình,
// tránh dựng nửa vời — xem CLAUDE.md "không tạo tính năng nửa vời").
const gameManager = useGameManager()
const { stateVersion } = useStateVersion()
const ui = useUiStore()

const stage = computed(() => ui.selectedStageId ? gameManager.getStage(ui.selectedStageId) : undefined)

const zoneName = computed(() => {
  if (!ui.selectedZoneId) {
    return ''
  }

  return gameManager.zoneRegistry.has(ui.selectedZoneId) ? gameManager.zoneRegistry.get(ui.selectedZoneId).name : ''
})

const progress = computed(() => {
  stateVersion.value

  return gameManager.getStageProgress()
})
</script>

<template>
  <div class="combat-top-bar">
    <span class="combat-top-bar__title">{{ zoneName }}<template v-if="stage"> • {{ stage.name }}</template></span>

    <span v-if="progress" class="combat-top-bar__progress">{{ progress.spawned }} / {{ progress.total }} quái</span>
  </div>
</template>

<style scoped>
.combat-top-bar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: color-mix(in srgb, var(--ink-950) 70%, transparent);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--ink-line-soft);
  font-family: var(--font-body);
  pointer-events: auto;
}

.combat-top-bar__title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-body);
  color: var(--chrome-100);
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.combat-top-bar__progress {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
</style>
