<script setup lang="ts">
// Bản Mệnh Pháp Bảo — vùng 1 (doc §12.1): artwork/icon, tên, nghề sở
// hữu, identity. Chưa có art asset riêng — dùng khối biểu tượng chữ
// (cùng tinh thần fallback của PlayerPortrait khi thiếu ảnh), không
// chặn phần còn lại của panel.
defineProps<{
  name: string
  cultivationPathLabel: string
  gradeLabel: string
  gradeColorVar?: string
}>()
</script>

<template>
  <div class="artifact-overview">
    <div class="artifact-overview__icon" aria-hidden="true">珠</div>

    <div class="artifact-overview__text">
      <h3 class="artifact-overview__name">{{ name }}</h3>
      <p class="artifact-overview__meta">
        {{ cultivationPathLabel }} · <span :style="gradeColorVar ? { color: gradeColorVar } : undefined">{{ gradeLabel }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.artifact-overview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-bottom: 1px solid var(--sys-line, var(--ink-line));
}

.artifact-overview__icon {
  flex: 0 0 auto;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: radial-gradient(circle, var(--sys-line, var(--chrome-500)), var(--sys-bg-1, var(--ink-900)));
  border: 1px solid var(--sys-line, var(--chrome-500));
  color: var(--sys-text, var(--chrome-100));
  font-size: var(--text-display);
  font-family: var(--sys-font-display, var(--font-display));
  box-shadow: var(--shadow-glow-chrome);
}

.artifact-overview__text {
  min-width: 0;
}

.artifact-overview__name {
  margin: 0;
  font-family: var(--sys-font-display, var(--font-display));
  font-size: var(--text-title);
  font-weight: 700;
  color: var(--sys-text, var(--paper-text));
}

.artifact-overview__meta {
  margin: 2px 0 0;
  color: var(--sys-text-dim, var(--paper-text-muted));
  font-size: var(--text-body);
}
</style>
