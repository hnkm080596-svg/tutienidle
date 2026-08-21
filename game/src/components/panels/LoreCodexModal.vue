<script setup lang="ts">
// Home Hub Phase 2 — bản modal PERSISTENT-CLICK của Tooltip.vue (vốn
// chỉ hiện khi hover, biến mất ngay khi rời chuột) — dùng cho Tàng
// Kinh Các's Lore tab (Phase 7): người chơi bấm vào 1 lore item, đọc
// trọn mô tả, tự đóng khi bấm ra ngoài/nút đóng, KHÔNG tự ẩn theo
// chuột như Tooltip. Style nhất quán NavMenuOverlay.vue.
defineProps<{
  content: { title: string; description: string } | null
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="lore-modal-fade">
      <div v-if="content" class="lore-modal" @click.self="emit('close')">
        <div class="lore-modal__panel">
          <h3 class="lore-modal__title">{{ content.title }}</h3>

          <p class="lore-modal__description">{{ content.description }}</p>

          <button type="button" class="lore-modal__close" @click="emit('close')">Đóng</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lore-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 13, 0.72);
  z-index: 60;
}

.lore-modal__panel {
  background: var(--ink-900);
  border: 1px solid var(--gold-500);
  box-shadow: var(--shadow-panel);
  border-radius: var(--radius-md);
  padding: 24px 28px;
  min-width: 340px;
  max-width: 480px;
}

.lore-modal__title {
  margin: 0 0 12px;
  font-family: var(--font-display);
  font-size: 1.05rem;
  color: var(--gold-500);
  text-align: center;
}

.lore-modal__description {
  margin: 0 0 20px;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-line;
}

.lore-modal__close {
  display: block;
  margin: 0 auto;
  padding: 6px 24px;
  background: var(--ink-800);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.8rem;
  cursor: pointer;
}

.lore-modal__close:hover {
  border-color: var(--gold-500);
  color: var(--gold-500);
}

.lore-modal-fade-enter-active,
.lore-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.lore-modal-fade-enter-from,
.lore-modal-fade-leave-to {
  opacity: 0;
}
</style>
