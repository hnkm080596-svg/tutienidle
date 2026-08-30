<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import type { InkWashUiAssetId } from '@/assets/inkWashUi'

// Pure-CSS "ink & paper" chrome (2026-08-30) — asset PNG ink-wash gốc bị
// ẩn vĩnh viễn (không quan tâm khôi phục), nên component này không còn
// đọc inkWashUi.ts nữa: mỗi assetId map thẳng sang 1 class vẽ bằng
// gradient/box-shadow/pseudo-element bên dưới. Giữ NGUYÊN prop API cũ
// (assetId/layer/opacity/tintVar/thickness) nên GamePanel/GameButton/
// OverlayPanel/Chip/Tooltip/... không cần sửa gì.
const props = withDefaults(defineProps<{
  assetId: InkWashUiAssetId
  layer?: 'surface' | 'frame'
  opacity?: number
  tintVar?: string
  /** Override bề dày viền vẽ (px) khi khung chuẩn quá dày cho chỗ nhỏ. */
  thickness?: number
}>(), {
  layer: 'surface',
  opacity: 1,
  tintVar: undefined,
  thickness: undefined,
})

const resolvedTint = computed(() => (
  props.tintVar
    ? (props.tintVar.startsWith('--') ? `var(${props.tintVar})` : props.tintVar)
    : undefined
))

const style = computed<CSSProperties>(() => {
  const vars: CSSProperties = {
    '--ink-slice-layer': props.layer === 'frame' ? '2' : '1',
    opacity: String(props.opacity),
    pointerEvents: 'none',
  }
  if (resolvedTint.value) {
    ;(vars as Record<string, string>)['--ink-slice-tint'] = resolvedTint.value
  }
  if (props.thickness !== undefined) {
    ;(vars as Record<string, string>)['--ink-slice-ring-w'] = `${props.thickness}px`
  }
  return vars
})
</script>

<template>
  <span
    class="ink-nine-slice"
    :class="[
      `ink-nine-slice--${layer}`,
      `ink-nine-slice--${assetId}`,
      { 'ink-nine-slice--tinted': Boolean(resolvedTint) },
    ]"
    :data-ink-slice="assetId"
    aria-hidden="true"
    :style="style"
  />
</template>

<style scoped>
.ink-nine-slice {
  position: absolute;
  inset: 0;
  z-index: var(--ink-slice-layer);
  box-sizing: border-box;
  border-radius: inherit;
}

/* ============================================================
   Paper surfaces — lớp nền "giấy dó", lấp toàn bộ khung (center: fill).
   Vân giấy dùng chung --paper-grain (theme.css), rất nhạt, đặt làm lớp
   background trên cùng để tránh cảm giác gradient nhựa phẳng.
   ============================================================ */
.ink-nine-slice--surface-m-paper {
  background:
    var(--paper-grain) 0 0 / 160px 160px repeat,
    radial-gradient(120% 140% at 18% -10%, rgba(255, 255, 255, 0.32), transparent 55%),
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 62%, var(--paper-200) 100%);
  box-shadow:
    inset 0 0 0 1px var(--ink-slice-tint, rgba(42, 41, 36, 0.16)),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.ink-nine-slice--surface-l-ink-data {
  background:
    radial-gradient(140% 120% at 50% -20%, rgba(190, 200, 255, 0.06), transparent 60%),
    linear-gradient(175deg, var(--ink-800) 0%, var(--ink-900) 100%);
  box-shadow: inset 0 0 0 1px var(--ink-slice-tint, var(--ink-line-soft));
}

.ink-nine-slice--surface-xl-paper-scroll {
  background:
    var(--paper-grain) 0 0 / 180px 180px repeat,
    linear-gradient(var(--brush-800), var(--brush-800)) top / 100% 5px no-repeat,
    linear-gradient(var(--brush-800), var(--brush-800)) bottom / 100% 5px no-repeat,
    radial-gradient(140% 90% at 50% 0%, rgba(255, 255, 255, 0.28), transparent 60%),
    linear-gradient(175deg, var(--paper-50) 0%, var(--paper-100) 55%, var(--paper-200) 100%);
  box-shadow:
    inset 0 0 0 1px var(--ink-slice-tint, rgba(42, 41, 36, 0.18)),
    inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

/* ============================================================
   Ink-brush frames — viền mực, tâm trong suốt (KHÔNG lấp nền), vẽ trên
   surface nhưng dưới nội dung (z-index qua layer="frame").
   ============================================================ */
.ink-nine-slice--frame-xs-ink-line {
  box-shadow: inset 0 0 0 var(--ink-slice-ring-w, 1.5px) var(--ink-slice-tint, var(--brush-600));
}

.ink-nine-slice--frame-s-slot {
  box-shadow:
    inset 0 0 0 var(--ink-slice-ring-w, 1px) var(--ink-slice-tint, var(--ink-line)),
    inset 0 0 0 3px rgba(0, 0, 0, 0.16);
}

.ink-nine-slice--frame-m-seal-corner {
  box-shadow: inset 0 0 0 var(--ink-slice-ring-w, 1.5px) var(--ink-slice-tint, var(--brush-600));
}

.ink-nine-slice--frame-m-seal-corner::after {
  content: '印';
  position: absolute;
  top: -6px;
  right: 8px;
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  background: var(--cinnabar);
  color: var(--paper-50);
  font: 700 9px/1 var(--font-display);
  border-radius: 3px;
  box-shadow: 0 0 0 1px var(--brush-950), 0 2px 4px rgba(0, 0, 0, 0.4);
  transform: rotate(-4deg);
}

.ink-nine-slice--frame-l-landscape {
  box-shadow:
    0 0 0 1px var(--ink-slice-tint, var(--brush-800)),
    inset 0 0 0 var(--ink-slice-ring-w, 5px) transparent,
    inset 0 0 0 calc(var(--ink-slice-ring-w, 5px) + 1px) var(--ink-slice-tint, var(--brush-600));
}

.ink-nine-slice--frame-xl-ceremony {
  box-shadow:
    0 0 0 1px var(--ink-slice-tint, var(--frame-outer)),
    inset 0 0 0 var(--ink-slice-ring-w, 3px) transparent,
    inset 0 0 0 calc(var(--ink-slice-ring-w, 3px) + 1px) var(--ink-slice-tint, var(--frame-inner));
}

.ink-nine-slice--frame-xl-ceremony::before,
.ink-nine-slice--frame-xl-ceremony::after {
  content: '印';
  position: absolute;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  background: var(--cinnabar);
  color: var(--paper-50);
  font: 700 13px/1 var(--font-display);
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--ink-slice-tint, var(--frame-corner)), 0 3px 8px rgba(0, 0, 0, 0.45);
}

.ink-nine-slice--frame-xl-ceremony::before {
  top: 12px;
  left: 12px;
  transform: rotate(-6deg);
}

.ink-nine-slice--frame-xl-ceremony::after {
  bottom: 12px;
  right: 12px;
  transform: rotate(4deg);
}

/* ============================================================
   Button skins — layer="surface" (không có surface riêng cho nút, nên
   phải tự lấp nền), trừ ghost dùng frame-xs-ink-line (viền không nền).
   ============================================================ */
.ink-nine-slice--button-s-paper {
  background: linear-gradient(180deg, var(--paper-50), var(--paper-200));
  box-shadow:
    inset 0 0 0 1px var(--ink-slice-tint, var(--brush-600)),
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 -2px 3px rgba(0, 0, 0, 0.08);
}

.ink-nine-slice--button-s-ink {
  background: linear-gradient(180deg, var(--brush-800), var(--ink-900));
  box-shadow:
    inset 0 0 0 1px var(--ink-slice-tint, var(--brush-600)),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.ink-nine-slice--button-s-seal {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--ink-slice-tint, var(--cinnabar)) 88%, white 12%),
    var(--ink-slice-tint, var(--cinnabar))
  );
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--ink-slice-tint, var(--cinnabar)) 55%, black 45%),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
</style>
