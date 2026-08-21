<script setup lang="ts">
// Beta Phase 4 (mục XVIII) — Boot → Load Save → Initialize → Home.
// Boot hiện tại HOÀN TOÀN đồng bộ (không await gì) nên màn này chỉ
// hiện trong khoảnh khắc rất ngắn trên thực tế — dựng đúng khung sườn
// cho tài liệu yêu cầu, sẵn sàng nếu sau này có việc bất đồng bộ thật
// (vd load save từ remote) xen vào mà không cần thiết kế lại UI.
</script>

<template>
  <div class="loading-screen">
    <p class="loading-screen__title">TIÊN HIỆP IDLE</p>

    <div class="loading-screen__pulse" />
  </div>
</template>

<style scoped>
.loading-screen {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: var(--ink-950);
}

.loading-screen__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.4rem;
  letter-spacing: 0.12em;
  color: var(--gold-500);
}

.loading-screen__pulse {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--gold-500);
  opacity: 0.7;
  animation: loading-pulse 1.1s ease-in-out infinite;
}

@keyframes loading-pulse {
  0%,
  100% {
    transform: scale(0.8);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}
</style>
