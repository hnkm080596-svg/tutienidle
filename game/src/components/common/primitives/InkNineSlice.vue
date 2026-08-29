<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import {
  getInkWashUiAsset,
  type InkWashUiAssetId,
} from '@/assets/inkWashUi'

const props = withDefaults(defineProps<{
  assetId: InkWashUiAssetId
  layer?: 'surface' | 'frame'
  opacity?: number
  tintVar?: string
}>(), {
  layer: 'surface',
  opacity: 1,
  tintVar: undefined,
})

const asset = computed(() => getInkWashUiAsset(props.assetId))
const tinted = computed(() => asset.value.tintable && Boolean(props.tintVar))

const style = computed<CSSProperties>(() => {
  const current = asset.value
  const center = current.center === 'fill' ? 'fill' : ''
  const tint = props.tintVar
    ? (props.tintVar.startsWith('--') ? `var(${props.tintVar})` : props.tintVar)
    : 'transparent'

  return {
    '--ink-slice-image': `image-set(url("${current.url1x}") 1x, url("${current.url2x}") 2x)`,
    '--ink-slice-top': String(current.slices.top),
    '--ink-slice-right': String(current.slices.right),
    '--ink-slice-bottom': String(current.slices.bottom),
    '--ink-slice-left': String(current.slices.left),
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
      { 'ink-nine-slice--tinted': tinted },
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
    calc(var(--ink-slice-top) * 1px)
    calc(var(--ink-slice-right) * 1px)
    calc(var(--ink-slice-bottom) * 1px)
    calc(var(--ink-slice-left) * 1px);
  border-image-source: var(--ink-slice-image);
  border-image-slice: var(--ink-slice-border-slice);
  border-image-width:
    calc(var(--ink-slice-top) * 1px)
    calc(var(--ink-slice-right) * 1px)
    calc(var(--ink-slice-bottom) * 1px)
    calc(var(--ink-slice-left) * 1px);
  border-image-repeat: var(--ink-slice-repeat);
}

.ink-nine-slice--tinted::after {
  position: absolute;
  inset:
    calc(var(--ink-slice-top) * -1px)
    calc(var(--ink-slice-right) * -1px)
    calc(var(--ink-slice-bottom) * -1px)
    calc(var(--ink-slice-left) * -1px);
  content: '';
  background: var(--ink-slice-tint);
  pointer-events: none;
  -webkit-mask-box-image-source: var(--ink-slice-image);
  -webkit-mask-box-image-slice: var(--ink-slice-border-slice);
  -webkit-mask-box-image-width:
    calc(var(--ink-slice-top) * 1px)
    calc(var(--ink-slice-right) * 1px)
    calc(var(--ink-slice-bottom) * 1px)
    calc(var(--ink-slice-left) * 1px);
  -webkit-mask-box-image-repeat: var(--ink-slice-repeat);
}
</style>
