<script setup lang="ts">
// One constellation node (plan sec.7): rune disc for minors, dao-luan
// for majors, the gold center wheel for the root, always framed by the
// drawn node ring and holding the element icon. Names stay hidden until
// hover/focus/selection so the glyph reads as strokes first; the label
// side can be steered by the layout's labelPlacement.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { SkillUiNode } from '@/components/scenes/skill/fidelity/skillUi'

const props = defineProps<{
  node: SkillUiNode
  selected: boolean
  unlocking: boolean
  labelPlacement?: 'top' | 'right' | 'bottom' | 'left'
}>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()

const ring = resolveAssetUrl('/assets/ui/huyen-kim/scene/skill-v2/node-ring-v1.png')
const passiveRing = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/skill-node-passive-v1.png')
const rune = resolveAssetUrl('/assets/ui/huyen-kim/nodes/rune-node@2x.png')
const daoLuanNode = resolveAssetUrl('/assets/ui/huyen-kim/nodes/dao-luan-node@2x.png')
const daoLuanCenter = resolveAssetUrl('/assets/ui/huyen-kim/nodes/dao-luan-center@2x.png')
const lock = resolveAssetUrl('/assets/ui/huyen-kim/symbols/lock.svg')

const emphasis = computed(() => props.node.emphasis ?? 'normal')
const disc = computed(() =>
  emphasis.value === 'root' ? daoLuanCenter : emphasis.value === 'major' ? daoLuanNode : rune,
)
const placement = computed(() => props.labelPlacement ?? 'bottom')
// Passive branch leaves swap the generic drawn ring for the ornate
// tien-hiep passive frame (same overlay role, distinct silhouette).
const ringArt = computed(() => (props.node.frameKind === 'passive' ? passiveRing : ring))
</script>

<template>
  <button
    :class="[
      'constellation-node',
      node.state,
      `emphasis-${emphasis}`,
      `label-${placement}`,
      { selected, unlocking },
    ]"
    :data-node-id="node.id"
    :aria-pressed="selected"
    :aria-label="`${node.name} · ${node.level} · ${t(`skill.state.${node.state}`)}`"
    @click="emit('select', node.id)"
  >
    <span class="constellation-disc">
      <img class="disc-art" :src="disc" alt="">
      <img class="icon" :src="node.icon" alt="">
      <img class="ring" :src="ringArt" alt="">
      <span v-if="node.state === 'locked'" class="lock"><img :src="lock" alt=""></span>
      <span v-else-if="node.state === 'learned'" class="learned-badge" aria-hidden="true">✓</span>
    </span>
    <span class="constellation-label">
      <span class="name">{{ node.name }}</span>
      <small class="level">{{ node.level }}</small>
    </span>
  </button>
</template>

<style scoped>
/* Sizes come from the plan's contract: 30-34px minors, 42-48px
 * majors/root, and a >=40px hit area - the padding keeps even the
 * 32px discs comfortably tappable. */
.constellation-node {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  z-index: 1;
}
.constellation-node:hover,
.constellation-node:focus-visible,
.constellation-node.selected {
  z-index: 3;
}
.constellation-disc {
  position: relative;
  width: 32px;
  height: 32px;
}
.emphasis-major .constellation-disc {
  width: 46px;
  height: 46px;
}
.emphasis-root .constellation-disc {
  width: 48px;
  height: 48px;
}
.disc-art,
.icon,
.ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.icon {
  inset: 26%;
  width: 48%;
  height: 48%;
}
/* The ornate ring is drawn slightly larger than the disc so its gold
 * inlays hang over the edge like a medal frame. */
.ring {
  inset: -10%;
  width: 120%;
  height: 120%;
}
.learned .constellation-disc {
  filter: drop-shadow(0 0 8px var(--constellation-accent, rgba(216, 180, 95, 0.7)));
}
.available .constellation-disc {
  animation: constellationPulse 2.4s ease-in-out infinite;
}
.locked .disc-art,
.locked .icon {
  filter: grayscale(0.8) brightness(0.5);
}
.locked .ring {
  filter: brightness(0.45);
}
.selected .constellation-disc::after {
  content: '';
  position: absolute;
  inset: -14%;
  border: 2px solid #ffd977;
  border-radius: 50%;
  box-shadow: 0 0 12px rgba(255, 217, 119, 0.55);
}
.constellation-node:focus-visible .constellation-disc::after {
  content: '';
  position: absolute;
  inset: -14%;
  border: 2px dashed #ffe9a3;
  border-radius: 50%;
}
.unlocking .constellation-disc {
  animation: constellationArrive 0.7s 0.55s ease-out backwards;
}
.lock {
  position: absolute;
  inset: 27%;
  border-radius: 50%;
  background: #2a2416;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lock img {
  width: 58%;
  height: 58%;
  opacity: 0.9;
}
.learned-badge {
  position: absolute;
  right: -10%;
  bottom: -8%;
  width: 32%;
  height: 32%;
  min-width: 11px;
  min-height: 11px;
  border-radius: 50%;
  background: #e0bd76;
  color: #3b2a12;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* Labels read on demand only (plan sec.3.4): strokes first, names when
 * hovered, focused or selected. */
.constellation-label {
  position: absolute;
  top: calc(100% - 4px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  white-space: nowrap;
  font-family: var(--font-display, Georgia, serif);
  color: #efe0b8;
  text-shadow: 0 1px 4px rgba(6, 9, 16, 0.9);
  opacity: 0;
  transition: opacity 0.18s ease;
  pointer-events: none;
}
.constellation-node:hover .constellation-label,
.constellation-node:focus .constellation-label,
.constellation-node.selected .constellation-label {
  opacity: 1;
}
.name {
  font-size: 13px;
  font-weight: 700;
}
.level {
  font-size: 10px;
  color: #cdbd93;
}
.label-top .constellation-label {
  top: auto;
  bottom: calc(100% - 4px);
}
.label-left .constellation-label {
  left: auto;
  right: calc(100% + 2px);
  top: 50%;
  transform: translateY(-50%);
  align-items: flex-end;
}
.label-right .constellation-label {
  left: calc(100% + 2px);
  top: 50%;
  transform: translateY(-50%);
  align-items: flex-start;
}
@keyframes constellationPulse {
  0%,
  100% {
    filter: drop-shadow(0 0 3px var(--constellation-accent, rgba(216, 180, 95, 0.5)));
  }
  50% {
    filter: drop-shadow(0 0 9px var(--constellation-accent, rgba(216, 180, 95, 0.85)));
  }
}
@keyframes constellationArrive {
  0% {
    transform: scale(1);
  }
  35% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .constellation-disc {
    animation: none !important;
  }
  .constellation-label {
    transition: none;
  }
}
</style>
