<script setup lang="ts">
// Tàng Kinh Các (Home Hub Phase 7) — 2 tab con: Công Pháp (catalog
// đã/chưa học) và Lore (manh mối đã nhặt được, xem mục V/XV.6 tài
// liệu beta — "Không leak Đại Đạo").
import TechniqueCodex from './scripture/TechniqueCodex.vue'
import LoreCodex from './scripture/LoreCodex.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="scripture-pavilion">
    <div class="scripture-pavilion__nav">
      <button
        type="button"
        :class="{ 'is-active': ui.scripturePavilionTab === 'technique' }"
        @click="ui.setScripturePavilionTab('technique')"
      >
        Công Pháp
      </button>

      <button
        type="button"
        :class="{ 'is-active': ui.scripturePavilionTab === 'lore' }"
        @click="ui.setScripturePavilionTab('lore')"
      >
        Lore
      </button>
    </div>

    <div class="scripture-pavilion__body">
      <TechniqueCodex v-if="ui.scripturePavilionTab === 'technique'" />

      <LoreCodex v-else />
    </div>
  </div>
</template>

<style scoped>
.scripture-pavilion {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-family: var(--font-body);
}

/* UI redesign Step 21 (visual consistency pass) — chip vuông/gọn,
   cùng ngôn ngữ với BagGrid.vue/LoadoutManager.vue thay vì underline
   riêng của panel này. */
.scripture-pavilion__nav {
  flex: 0 0 auto;
  display: flex;
  gap: 4px;
  padding: 6px 8px 0;
}

.scripture-pavilion__nav button {
  flex: 1;
  padding: 4px 0;
  min-height: var(--tap-min);
  font-size: var(--text-sm);
  background: var(--ink-800);
  color: var(--text-secondary);
  border: 1px solid var(--ink-line-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
}

.scripture-pavilion__nav button.is-active {
  border-color: var(--chrome-300);
  color: var(--chrome-100);
}

.scripture-pavilion__body {
  flex: 1;
  min-height: 0;
}
</style>
