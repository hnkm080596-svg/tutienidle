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
   Paper surfaces — DARK MODE (2026-08-31). Chuyển từ giấy dó sáng sang
   mực đậm + vignette vàng nhạt để đồng bộ theme.css surface-*.
   ============================================================ */
.ink-nine-slice--surface-m-paper {
  background:
    var(--surface-grain) 0 0 / 160px 160px repeat,
    radial-gradient(120% 140% at 18% -10%, rgba(212, 165, 87, 0.10), transparent 55%),
    linear-gradient(175deg, var(--surface-700) 0%, var(--surface-800) 62%, var(--surface-900) 100%);
  box-shadow:
    inset 0 0 0 1px var(--ink-slice-tint, var(--surface-line)),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.ink-nine-slice--surface-l-ink-data {
  background:
    radial-gradient(140% 120% at 50% -20%, rgba(212, 165, 87, 0.08), transparent 60%),
    linear-gradient(175deg, var(--surface-800) 0%, var(--surface-900) 100%);
  box-shadow: inset 0 0 0 1px var(--ink-slice-tint, var(--surface-line));
}

.ink-nine-slice--surface-xl-paper-scroll {
  background:
    var(--surface-grain) 0 0 / 180px 180px repeat,
    linear-gradient(var(--surface-600), var(--surface-600)) top / 100% 5px no-repeat,
    linear-gradient(var(--surface-600), var(--surface-600)) bottom / 100% 5px no-repeat,
    radial-gradient(140% 90% at 50% 0%, rgba(212, 165, 87, 0.10), transparent 60%),
    linear-gradient(175deg, var(--surface-700) 0%, var(--surface-800) 55%, var(--surface-900) 100%);
  box-shadow:
    inset 0 0 0 1px var(--ink-slice-tint, var(--surface-line)),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

/* ============================================================
   Ink-brush frames — viền mực, tâm trong suốt (KHÔNG lấp nền), vẽ trên
   surface nhưng dưới nội dung (z-index qua layer="frame").
   DARK MODE: viền mặc định chuyển từ --brush-600 (nâu ấm) sang
   --chrome-500 (ngà lạnh) để hài hòa với nền mực; vàng ở ring-ceremony
   giữ nguyên (đó là dấu hiệu "nghi lễ", không thuộc về ink-brush).
   ============================================================ */
.ink-nine-slice--frame-xs-ink-line {
  box-shadow: inset 0 0 0 var(--ink-slice-ring-w, 1.5px) var(--ink-slice-tint, var(--chrome-500));
}

.ink-nine-slice--frame-s-slot {
  box-shadow:
    inset 0 0 0 var(--ink-slice-ring-w, 1px) var(--ink-slice-tint, var(--surface-line)),
    inset 0 0 0 3px rgba(0, 0, 0, 0.32);
}

.ink-nine-slice--frame-m-seal-corner {
  box-shadow: inset 0 0 0 var(--ink-slice-ring-w, 1.5px) var(--ink-slice-tint, var(--chrome-500));
}

.ink-nine-slice--frame-l-landscape {
  box-shadow:
    0 0 0 1px var(--ink-slice-tint, var(--surface-500)),
    inset 0 0 0 var(--ink-slice-ring-w, 5px) transparent,
    inset 0 0 0 calc(var(--ink-slice-ring-w, 5px) + 1px) var(--ink-slice-tint, var(--chrome-500));
}

.ink-nine-slice--frame-xl-ceremony {
  box-shadow:
    0 0 0 1px var(--ink-slice-tint, var(--frame-outer)),
    inset 0 0 0 var(--ink-slice-ring-w, 3px) transparent,
    inset 0 0 0 calc(var(--ink-slice-ring-w, 3px) + 1px) var(--ink-slice-tint, var(--frame-inner));
}

/* ============================================================
   Button skins — layer="surface" (không có surface riêng cho nút, nên
   phải tự lấp nền), trừ ghost dùng frame-xs-ink-line (viền không nền).
   DARK MODE: primary đổi từ gradient giấy sáng sang gradient mực nâng;
   ink/secondary giữ ý niệm (đậm hơn, cùng họ surface-*).
   ============================================================ */
.ink-nine-slice--button-s-paper {
  background: linear-gradient(180deg, var(--surface-600), var(--surface-800));
  box-shadow:
    inset 0 0 0 1px var(--ink-slice-tint, var(--chrome-500)),
    inset 0 1px 0 rgba(255, 255, 255, 0.10),
    inset 0 -2px 3px rgba(0, 0, 0, 0.35);
}

.ink-nine-slice--button-s-ink {
  background: linear-gradient(180deg, var(--surface-700), var(--surface-900));
  box-shadow:
    inset 0 0 0 1px var(--ink-slice-tint, var(--chrome-500)),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
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
