<script setup lang="ts">
// Composite scene header — khối ảnh artwork + scrim + caption dùng chung
// cho 4 panel có scene (Khí Đường/Đan Phòng/Linh Tuyền/Địa Giới), thay
// 4 bản tự viết cùng giải phẫu. `scene` map sang cụm --scene-* token
// (deep/accent/text/text-soft/glow); mọi chi tiết còn lại override qua
// CSS var/scoped class tại nơi dùng.
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  asset: string
  scene: 'fire' | 'portal' | 'water'
  /** Chiều cao khối (px) — truyền qua style. */
  height?: number
  /** Vị trí ảnh (object-position). */
  objectPosition?: string
  /** Độ mờ ảnh. */
  imageOpacity?: number
  caption?: string
}>(), {
  height: 150,
  objectPosition: 'center 58%',
  imageOpacity: 0.7,
  caption: undefined,
})

const sceneVars = computed(() => {
  switch (props.scene) {
    case 'fire':
      return {
        '--scene-deep': 'var(--scene-fire-deep)',
        '--scene-accent': 'var(--scene-fire-accent)',
        '--scene-text': 'var(--scene-fire-text)',
        '--scene-text-soft': 'var(--scene-fire-text-soft)',
        '--scene-glow': 'var(--scene-fire-glow)',
      }
    case 'portal':
      return {
        '--scene-deep': 'var(--scene-portal-deep)',
        '--scene-accent': 'var(--scene-portal-accent)',
        '--scene-text': 'var(--scene-portal-text)',
        '--scene-text-soft': 'var(--scene-portal-text-soft)',
        '--scene-glow': 'var(--scene-portal-glow)',
      }
    case 'water':
      return {
        '--scene-deep': 'var(--scene-water-deep)',
        '--scene-accent': 'var(--scene-water-accent)',
        '--scene-text': 'var(--scene-water-text)',
        '--scene-text-soft': 'var(--scene-water-text)',
        '--scene-glow': 'var(--scene-water-accent)',
      }
  }
})
</script>

<script lang="ts">
export default { name: 'SceneHeader' }
</script>

<template>
  <div class="scene-header" :style="{ ...sceneVars, '--scene-header-h': `${height}px` }">
    <img class="scene-header__image" :src="asset" alt="" aria-hidden="true" :style="{ objectPosition, opacity: imageOpacity }" />

    <!-- Scrim đáy — chiều sâu cảnh, dùng chung mọi scene. -->
    <span class="scene-header__scrim" aria-hidden="true" />

    <span v-if="caption" class="scene-header__caption">{{ caption }}</span>

    <!-- Decoration riêng từng panel (forge-fire, vòng portal, orb...) -->
    <slot name="decoration" />

    <!-- Nội dung chồng lên scene (StageSelect dùng row header bên trong) -->
    <slot />
  </div>
</template>

<style scoped>
.scene-header {
  position: relative;
  height: var(--scene-header-h, 150px);
  overflow: hidden;
  background: var(--scene-deep, var(--ink-900));
}

.scene-header__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(1.15) contrast(1.05);
}

.scene-header__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, color-mix(in srgb, var(--scene-deep, var(--ink-950)) 82%, transparent));
  pointer-events: none;
}

.scene-header__caption {
  position: absolute;
  left: 18px;
  bottom: 14px;
  z-index: 1;
  color: var(--scene-text, var(--chrome-100));
  font: 700 var(--text-sm) var(--font-display);
  letter-spacing: .18em;
  text-shadow: 0 2px 6px #000;
}

.scene-header > * {
  min-width: 0;
}
</style>
