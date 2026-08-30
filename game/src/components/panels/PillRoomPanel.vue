<script setup lang="ts">
// Đan Phòng (2026-08-25) — Luyện Đan qua AlchemyView. Túi Đan ĐÃ BỎ khỏi
// đây (2026-08-30, bug report: trùng lặp với tab "Đan Dược" của Hành
// Trang, tốn nửa chiều cao panel gây phải cuộn) — xem đan đã luyện trong
// Hành Trang, không xem lại ở đây.
import AlchemyView from './AlchemyView.vue'
</script>

<template>
  <div class="pill-room">
    <AlchemyView class="pill-room__crafting" />
  </div>
</template>

<style scoped>
.pill-room {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.pill-room__crafting {
  flex: 1;
  min-height: 0;
}
</style>
