<script setup lang="ts">
import { computed } from 'vue'
import { useTooltip } from '@/composables/useTooltip'
import { TOOLTIP_BACKDROP_PATH } from '@/core/assets/AssetPaths'

const { content, position } = useTooltip()

// Lệch khỏi con trỏ chuột 1 chút để không che chính element đang hover.
const style = computed(() => ({
  left: `${position.value.x + 16}px`,
  top: `${position.value.y + 16}px`,
}))
</script>

<template>
  <Teleport to="body">
    <Transition name="tooltip-fade">
      <div v-if="content && content.kind === 'technique'" class="tooltip tooltip--technique" :style="style">
        <div class="tooltip__technique-header">
          <img v-if="content.imagePath" class="tooltip__technique-image" :src="content.imagePath" :alt="content.name" />

          <div class="tooltip__technique-heading">
            <p class="tooltip__title">{{ content.name }}</p>
            <p v-if="content.levelLabel || content.elementLabel" class="tooltip__technique-meta">
              {{ content.levelLabel }}<span v-if="content.levelLabel && content.elementLabel"> · </span>{{ content.elementLabel }}
            </p>
          </div>
        </div>

        <p v-if="content.description" class="tooltip__description">{{ content.description }}</p>

        <div v-for="section in content.sections" :key="section.label" class="tooltip__section">
          <p class="tooltip__section-label">{{ section.label }}</p>

          <div v-for="row in section.rows" :key="row.label" class="tooltip__section-row">
            <span>{{ row.label }}</span>
            <span>{{ row.value }}</span>
          </div>
        </div>
      </div>

      <div
        v-else-if="content && (content.kind === 'pill' || content.kind === 'talisman' || content.kind === 'formation')"
        class="tooltip tooltip--graded"
        :style="style"
      >
        <div class="tooltip__technique-header">
          <img v-if="content.imagePath" class="tooltip__technique-image" :src="content.imagePath" :alt="content.name" />

          <div class="tooltip__technique-heading">
            <p class="tooltip__title">{{ content.name }}</p>
            <p class="tooltip__technique-meta">
              {{ content.phamLabel }}<span v-if="content.ownedLabel"> · {{ content.ownedLabel }}</span>
            </p>
          </div>
        </div>

        <p v-if="content.description" class="tooltip__description">{{ content.description }}</p>

        <div v-for="section in content.sections" :key="section.label" class="tooltip__section">
          <p class="tooltip__section-label">{{ section.label }}</p>

          <div v-for="row in section.rows" :key="row.label" class="tooltip__section-row">
            <span>{{ row.label }}</span>
            <span>{{ row.value }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="content && content.kind === 'equipment'" class="tooltip tooltip--graded" :style="style">
        <div class="tooltip__technique-header">
          <img v-if="content.imagePath" class="tooltip__technique-image" :src="content.imagePath" :alt="content.name" />

          <div class="tooltip__technique-heading">
            <p class="tooltip__title">{{ content.name }}</p>
            <p class="tooltip__technique-meta">{{ content.slotLabel }} · {{ content.qualityLabel }} · {{ content.phamLabel }}</p>
          </div>
        </div>

        <p v-if="content.description" class="tooltip__description">{{ content.description }}</p>

        <div v-for="section in content.sections" :key="section.label" class="tooltip__section">
          <p class="tooltip__section-label">{{ section.label }}</p>

          <div v-for="row in section.rows" :key="row.label" class="tooltip__section-row">
            <span>{{ row.label }}</span>
            <span>{{ row.value }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="content && content.kind === 'building'" class="tooltip tooltip--building" :style="style">
        <p class="tooltip__title">{{ content.name }}</p>
        <p v-if="content.functionLabel" class="tooltip__description">{{ content.functionLabel }}</p>
        <p class="tooltip__building-status">{{ content.statusLabel }}</p>
      </div>

      <div v-else-if="content && (content.kind === undefined || content.kind === 'plain')" class="tooltip" :style="style">
        <p v-if="content.title" class="tooltip__title">{{ content.title }}</p>
        <p v-if="content.description" class="tooltip__description">{{ content.description }}</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* TOOLTIP_BACKDROP_PATH (core/assets/AssetPaths.ts) — chưa có file
   ảnh thật thì `background-image` này không load được gì, tự rơi về
   `background-color` phẳng bên dưới (không lỗi hiển thị), nên an toàn
   để tham chiếu ngay từ bây giờ. */
.tooltip {
  position: fixed;
  z-index: 1000;
  max-width: 240px;
  padding: 6px 10px;
  background-color: rgba(15, 15, 20, 0.96);
  background-image: v-bind('`url(${TOOLTIP_BACKDROP_PATH})`');
  background-size: 100% 100%;
  border: 1px solid #444;
  border-radius: 4px;
  color: #eee;
  font-size: 0.75rem;
  pointer-events: none;
}

.tooltip__title {
  margin: 0 0 2px;
  font-weight: bold;
  color: #ffd54f;
}

.tooltip__description {
  margin: 0;
  color: #ccc;
  line-height: 1.3;
}

/* ============================================================
   TECHNIQUE (Tâm Pháp) — mẫu tooltip có cấu trúc đầu tiên, xem
   TechniqueTooltipContent trong useTooltip.ts.
   ============================================================ */

.tooltip--technique,
.tooltip--graded {
  max-width: 300px;
  padding: 10px 12px;
}

.tooltip__technique-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.tooltip__technique-image {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #ffd54f;
  object-fit: cover;
}

.tooltip__technique-heading {
  min-width: 0;
}

.tooltip__technique-meta {
  margin: 0;
  color: #999;
  font-size: 0.68rem;
}

.tooltip__section {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.tooltip__section-label {
  margin: 0 0 3px;
  color: #ffd54f;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tooltip__section-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #ddd;
  line-height: 1.5;
}

.tooltip--building {
  max-width: 220px;
}

.tooltip__building-status {
  margin: 4px 0 0;
  color: var(--jade);
  font-size: 0.68rem;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.12s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>
