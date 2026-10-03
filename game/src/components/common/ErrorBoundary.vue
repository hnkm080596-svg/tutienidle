<script setup lang="ts">
// Beta Phase 4 (Global Error Boundary) - bat loi TRONG render/setup/
// watcher cua cay component con (app.config.errorHandler trong
// main.ts KHONG bat duoc loai loi nay o moi phien ban Vue - can ca 2
// lop de bao phu du). return false chan loi lan tiep len component
// cha (ngan Vue tu crash toan cay), ErrorScreen.vue (mount song song,
// doc cung errorStore) hien overlay full-screen thay vi man trang.
import { onErrorCaptured } from 'vue'
import { useErrorStore } from '@/stores/error'

const errorStore = useErrorStore()

onErrorCaptured(err => {
  errorStore.report(err instanceof Error ? err.message : String(err), {
    error: err,
    code: 'VUE_BOUNDARY',
  })

  return false
})
</script>

<template>
  <slot />
</template>
