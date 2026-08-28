<script setup lang="ts">
// Beta Phase 4 (mục XIV tài liệu) — thay console.log('Offline:'...) cũ
// trong App.vue's onMounted(). Chỉ hiện Thời gian + Tu vi — hệ thống
// offline hiện tại (core/idle/OfflineProgressSystem.ts) CHỈ tích tu
// vi, không có material/tài nguyên nào khác để hiện thêm (mockup mục
// XIV có "+ Tài nguyên/+ Progress" nhưng đó là ví dụ minh hoạ, không
// phải data thật đang có).
import { formatNumber } from '@/core/format/NumberFormatter'
import GamePanel from './GamePanel.vue'
import GameButton from './GameButton.vue'
import StatRow from './primitives/StatRow.vue'

const props = defineProps<{
  elapsedSeconds: number

  cultivation: number
}>()

const emit = defineEmits<{ close: [] }>()

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours === 0) {
    return `${minutes}p`
  }

  return `${hours}h ${minutes}p`
}
</script>

<template>
  <div class="offline-summary">
    <GamePanel class="offline-summary__panel" variant="ornate" padding="sm">
      <h3 class="offline-summary__title">BẾ QUAN KẾT THÚC</h3>

      <ul class="offline-summary__rows">
        <StatRow label="Thời gian">{{ formatDuration(props.elapsedSeconds) }}</StatRow>

        <!-- Chỉ Thời gian + Tu vi — core/idle/OfflineProgressSystem.ts
             CHỈ tính cultivationPerSecond * elapsedSeconds, không có
             nguồn thu offline nào khác trong game logic hiện tại. Mở
             rộng OfflineSummaryData (stores/offlineSummary.ts) + thêm
             row tương ứng nếu sau này OfflineProgressSystem có nguồn
             thu mới. -->
        <StatRow label="+ Linh lực" tone="positive">{{ formatNumber(Math.floor(props.cultivation)) }}</StatRow>
      </ul>

      <GameButton class="offline-summary__continue" @click="emit('close')">Tiếp Tục</GameButton>
    </GamePanel>
  </div>
</template>

<style scoped>
.offline-summary {
  position: absolute;
  inset: 0;
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim);
}

/* Selector lặp class để thắng specificity của GamePanel.vue's
   `.game-panel { height: 100% }` — modal card này phải co theo nội
   dung, không được kéo full-height của backdrop. */
.offline-summary__panel.offline-summary__panel {
  height: auto;
  min-width: min(320px, 92vw);
  gap: 10px;
}

.offline-summary__title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: var(--text-title);
  letter-spacing: 0.06em;
  color: var(--chrome-100);
  text-align: center;
}

.offline-summary__rows {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: var(--font-body);
  font-size: var(--text-body);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.offline-summary__rows .stat-row__value {
  font-weight: 600;
}

.offline-summary__continue {
  margin-top: 10px;
}
</style>
