<script setup lang="ts">
// Beta Phase 4 (Global Error Boundary) — bắt lỗi TRONG render/setup/
// watcher của cây component con (app.config.errorHandler trong
// main.ts KHÔNG bắt được loại lỗi này ở mọi phiên bản Vue — cần cả 2
// lớp để bao phủ đủ). return false chặn lỗi lan tiếp lên component
// cha (ngăn Vue tự crash toàn cây), ErrorScreen.vue (mount song song,
// đọc cùng errorStore) hiện overlay full-screen thay vì màn trắng.
import { onErrorCaptured } from 'vue'
import { useErrorStore } from '@/stores/error'

const errorStore = useErrorStore()

onErrorCaptured(err => {
  errorStore.report(err instanceof Error ? err.message : String(err))

  return false
})
</script>

<template>
  <slot />
</template>
