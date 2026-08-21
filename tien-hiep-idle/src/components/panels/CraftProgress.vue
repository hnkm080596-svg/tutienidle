<script setup lang="ts">
defineProps<{
  // 'idle' | 'success' | 'failure': thao tác Khí thực hiện tức thời,
  // không có tiến trình theo thời gian — chỉ báo kết quả lần gần
  // nhất. `progress` (0~1) dùng cho tab còn placeholder (chưa có
  // backend công thức thật nên luôn tĩnh). 'processing' — spec mục
  // 17-19 (Processing lock), trong lúc actionDuration chờ trước khi
  // mutation nền chạy thật (xem EquipmentHallPanel.vue's isProcessing).
  status: 'idle' | 'processing' | 'success' | 'failure'

  progress: number
}>()
</script>

<template>
  <div class="craft-progress">
    <div class="craft-progress__bar">
      <div class="craft-progress__fill" :style="{ width: `${progress * 100}%` }" />
    </div>

    <p v-if="status === 'processing'" class="craft-progress__status">Đang xử lý...</p>
    <p v-else-if="status === 'success'" class="craft-progress__status craft-progress__status--success">Thành công</p>
    <p v-else-if="status === 'failure'" class="craft-progress__status craft-progress__status--failure">Thất bại</p>
  </div>
</template>

<style scoped>
.craft-progress {
  padding: 8px;
}

.craft-progress__bar {
  height: 10px;
  background: #222;
  border-radius: 4px;
  overflow: hidden;
}

.craft-progress__fill {
  height: 100%;
  background: #4caf50;
}

.craft-progress__status {
  margin: 6px 0 0;
  font-size: 0.75rem;
}

.craft-progress__status--success {
  color: #4caf50;
}

.craft-progress__status--failure {
  color: #e53935;
}
</style>
