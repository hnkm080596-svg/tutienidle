<script setup lang="ts">
// Beta Phase 4 (mục XIV tài liệu) — thay console.log('Offline:'...) cũ
// trong App.vue's onMounted(). Chỉ hiện Thời gian + Tu vi — hệ thống
// offline hiện tại (core/idle/OfflineProgressSystem.ts) CHỈ tích tu
// vi, không có material/tài nguyên nào khác để hiện thêm (mockup mục
// XIV có "+ Tài nguyên/+ Progress" nhưng đó là ví dụ minh hoạ, không
// phải data thật đang có).
import { formatNumber } from '@/core/format/NumberFormatter'
import GameButton from './GameButton.vue'
import StatRow from './primitives/StatRow.vue'
import InkNineSlice from './primitives/InkNineSlice.vue'

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
    <section class="offline-summary__panel">
      <InkNineSlice asset-id="surface-m-paper" layer="surface" />
      <InkNineSlice asset-id="frame-m-seal-corner" layer="frame" :thickness="18" />

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
    </section>
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

/* M-tier InkNineSlice (surface-m-paper + frame-m-seal-corner) thay
   cho GamePanel ornate (frame-xl-ceremony, slice 80px) — khung XL vẽ
   đè lên nội dung ở card nhỏ 320px vì băng khung 80px mỗi bên không
   còn chỗ cho padding hợp lý. thickness="18" (thay vì slice gốc 32px)
   thu nhỏ mực vẽ lại — 32px nguyên bản quá dày với card 320-420px,
   nuốt gần hết cạnh thành 1 dải đen. Padding nới thêm để chữ lùi hẳn
   vào trong, không còn sát viền mực. */
.offline-summary__panel {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: min(320px, 92vw);
  padding: 44px 40px;
  color: var(--paper-text, #211f1a);
  font-family: var(--font-body);
}

.offline-summary__panel > :not(.ink-nine-slice) {
  position: relative;
  z-index: 3;
}

.offline-summary__title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: var(--text-title);
  letter-spacing: 0.06em;
  color: var(--paper-text, #211f1a);
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
