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

    <!-- M-UI-OVERHAUL: boot pulse -> rotating marker diamond (transform-only). -->
    <div class="loading-screen__pulse sys-marker" />
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
  gap: 26px;
  background: var(--sys-bg-0, var(--ink-950));
}

.loading-screen__title {
  margin: 0;
  font-family: var(--sys-font-display, var(--font-display));
  font-size: var(--text-display);
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--sys-accent, var(--gold-300));
  text-shadow: 0 0 18px color-mix(in srgb, var(--sys-accent, #ffd54f) 45%, transparent);
}

.loading-screen__pulse {
  width: 14px;
  height: 14px;
  background: var(--sys-accent, var(--mineral-gold));
  transform: rotate(45deg);
  opacity: 0.8;
  animation: loading-pulse 1.1s ease-in-out infinite;
}

@keyframes loading-pulse {
  0%,
  100% {
    transform: rotate(45deg) scale(0.8);
    opacity: 0.4;
  }
  50% {
    transform: rotate(45deg) scale(1.15);
    opacity: 1;
  }
}

/* UI-006 (Task 4, 2026-09-07) — reduced motion: pulse đứng yên. */
@media (prefers-reduced-motion: reduce) {
  .loading-screen__pulse {
    animation: none;
  }
}
</style>
