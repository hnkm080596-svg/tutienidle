<script setup lang="ts">
// Beta Phase 4 (mục XIV tài liệu) — thay console.log('Offline:'...) cũ
// trong App.vue's onMounted(). Chỉ hiện Thời gian + Tu vi — hệ thống
// offline hiện tại (core/idle/OfflineProgressSystem.ts) CHỈ tích tu
// vi, không có material/tài nguyên nào khác để hiện thêm (mockup mục
// XIV có "+ Tài nguyên/+ Progress" nhưng đó là ví dụ minh hoạ, không
// phải data thật đang có).
import { formatNumber } from '@/core/format/NumberFormatter'

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
    <div class="offline-summary__panel">
      <h3 class="offline-summary__title">BẾ QUAN KẾT THÚC</h3>

      <div class="offline-summary__row">
        <span class="offline-summary__label">Thời gian</span>
        <span class="offline-summary__value">{{ formatDuration(props.elapsedSeconds) }}</span>
      </div>

      <div class="offline-summary__row">
        <span class="offline-summary__label">+ Linh lực</span>
        <span class="offline-summary__value offline-summary__value--gain">{{ formatNumber(Math.floor(props.cultivation)) }}</span>
      </div>

      <button type="button" class="offline-summary__continue" @click="emit('close')">Tiếp Tục</button>
    </div>
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
  background: rgba(10, 10, 13, 0.72);
}

.offline-summary__panel {
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-md);
  padding: 24px 32px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.offline-summary__title {
  margin: 0 0 6px;
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.06em;
  color: var(--gold-500);
  text-align: center;
}

.offline-summary__row {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.offline-summary__value {
  color: var(--text-primary);
  font-weight: 600;
}

.offline-summary__value--gain {
  color: var(--jade);
}

.offline-summary__continue {
  margin-top: 10px;
  padding: 8px;
  background: var(--gold-500);
  color: var(--gold-ink);
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 700;
  cursor: pointer;
}
</style>
