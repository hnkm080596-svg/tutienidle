<script setup lang="ts">
// Tàng Kinh Các (Home Hub Phase 7) — 2 tab con: Công Pháp (catalog
// đã/chưa học) và Lore (manh mối đã nhặt được, xem mục V/XV.6 tài
// liệu beta — "Không leak Đại Đạo").
import TechniqueCodex from './scripture/TechniqueCodex.vue'
import LoreCodex from './scripture/LoreCodex.vue'
import TabBar from '@/components/common/TabBar.vue'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const tabs = [
  { id: 'technique', label: 'Công Pháp' },
  { id: 'lore', label: 'Lore' },
]
</script>

<template>
  <div class="scripture-pavilion">
    <div class="scripture-pavilion__nav">
      <TabBar
        :tabs="tabs"
        :model-value="ui.scripturePavilionTab"
        layout="row"
        @update:model-value="ui.setScripturePavilionTab($event as 'technique' | 'lore')"
      />
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

.scripture-pavilion__nav {
  flex: 0 0 auto;
  padding: 6px 8px 0;
}

.scripture-pavilion__body {
  flex: 1;
  min-height: 0;
}
</style>
