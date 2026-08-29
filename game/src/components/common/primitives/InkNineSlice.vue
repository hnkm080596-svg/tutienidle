<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import {
  getInkWashUiAsset,
  type InkWashUiAssetId,
} from '@/assets/inkWashUi'

// DEBUG TOGGLE (tạm thời) — set false để ẩn toàn bộ ảnh PNG ink-wash
// trên MỌI surface/frame cùng lúc (1 chỗ, không cần sửa từng file),
// chỉ còn viền dashed màu để thấy rõ hộp/footprint thật của từng
// layer khi rà lại chồng lấn/kích thước. Set lại true để bật ảnh.
const SHOW_INK_ASSETS = false

const props = withDefaults(defineProps<{
  assetId: InkWashUiAssetId
  layer?: 'surface' | 'frame'
  opacity?: number
  tintVar?: string
  /** Rendered border thickness in px — độc lập với slice pixel gốc của
   * asset (border-image-slice giữ nguyên, chỉ border-image-width đổi),
   * dùng khi frame tiêu chuẩn (vd M-tier 32px) quá dày cho card nhỏ. */
  thickness?: number
}>(), {
  layer: 'surface',
  opacity: 1,
  tintVar: undefined,
  thickness: undefined,
})

const asset = computed(() => getInkWashUiAsset(props.assetId))
const tinted = computed(() => SHOW_INK_ASSETS && asset.value.tintable && Boolean(props.tintVar))

const style = computed<CSSProperties>(() => {
  const current = asset.value
  const center = current.center === 'fill' ? 'fill' : ''
  const tint = props.tintVar
    ? (props.tintVar.startsWith('--') ? `var(${props.tintVar})` : props.tintVar)
    : 'transparent'

  const width = props.thickness

  return {
    '--ink-slice-image': `image-set(url("${current.url1x}") 1x, url("${current.url2x}") 2x)`,
    '--ink-slice-top': String(current.slices.top),
    '--ink-slice-right': String(current.slices.right),
    '--ink-slice-bottom': String(current.slices.bottom),
    '--ink-slice-left': String(current.slices.left),
    '--ink-slice-width-top': String(width ?? current.slices.top),
    '--ink-slice-width-right': String(width ?? current.slices.right),
    '--ink-slice-width-bottom': String(width ?? current.slices.bottom),
    '--ink-slice-width-left': String(width ?? current.slices.left),
    '--ink-slice-center': center,
    '--ink-slice-border-slice': [
      current.slices.top,
      current.slices.right,
      current.slices.bottom,
      current.slices.left,
      center,
    ].filter(String).join(' '),
    '--ink-slice-repeat': current.edgeMode === 'tile' ? 'round' : 'stretch',
    '--ink-slice-layer': props.layer === 'frame' ? '2' : '1',
    '--ink-slice-tint': tint,
    opacity: String(props.opacity),
    pointerEvents: 'none',
  } as CSSProperties
})
</script>

<template>
  <span
    class="ink-nine-slice"
    :class="[
      `ink-nine-slice--${layer}`,
      { 'ink-nine-slice--tinted': tinted, 'ink-nine-slice--debug': !SHOW_INK_ASSETS },
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
  border-style: solid;
  border-color: transparent;
  border-width:
    calc(var(--ink-slice-width-top) * 1px)
    calc(var(--ink-slice-width-right) * 1px)
    calc(var(--ink-slice-width-bottom) * 1px)
    calc(var(--ink-slice-width-left) * 1px);
  border-image-source: var(--ink-slice-image);
  border-image-slice: var(--ink-slice-border-slice);
  border-image-width:
    calc(var(--ink-slice-width-top) * 1px)
    calc(var(--ink-slice-width-right) * 1px)
    calc(var(--ink-slice-width-bottom) * 1px)
    calc(var(--ink-slice-width-left) * 1px);
  border-image-repeat: var(--ink-slice-repeat);
}

/* DEBUG TOGGLE (tạm thời, xem SHOW_INK_ASSETS ở <script>) — thay
   border-image thật bằng viền dashed để rà footprint/chồng lấn của
   từng layer mà không bị ảnh PNG che. Giữ nguyên border-width (từ
   --ink-slice-width-*) nên kích thước khung vẫn đúng như lúc bật ảnh. */
.ink-nine-slice--debug {
  border-image-source: none;
  border-style: dashed;
}

.ink-nine-slice--debug.ink-nine-slice--surface {
  border-color: rgba(80, 160, 255, 0.6);
  background: rgba(80, 160, 255, 0.08);
}

.ink-nine-slice--debug.ink-nine-slice--frame {
  border-color: rgba(255, 140, 40, 0.75);
}

.ink-nine-slice--tinted::after {
  position: absolute;
  inset:
    calc(var(--ink-slice-width-top) * -1px)
    calc(var(--ink-slice-width-right) * -1px)
    calc(var(--ink-slice-width-bottom) * -1px)
    calc(var(--ink-slice-width-left) * -1px);
  content: '';
  background: var(--ink-slice-tint);
  pointer-events: none;
  -webkit-mask-box-image-source: var(--ink-slice-image);
  -webkit-mask-box-image-slice: var(--ink-slice-border-slice);
  -webkit-mask-box-image-width:
    calc(var(--ink-slice-width-top) * 1px)
    calc(var(--ink-slice-width-right) * 1px)
    calc(var(--ink-slice-width-bottom) * 1px)
    calc(var(--ink-slice-width-left) * 1px);
  -webkit-mask-box-image-repeat: var(--ink-slice-repeat);
}
</style>
