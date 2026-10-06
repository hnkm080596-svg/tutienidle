<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { SkillUiNode } from './skillUi'
const props = defineProps<{ node: SkillUiNode; selected: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
// G3 frame set (tien-hiep controls/skill-node-{kind}-v1.png): the layout
// hub (depth 0) gets the parent frame, every other node the sub frame.
const kind = computed(() => (props.node.prominent ? 'parent' : 'sub'))
const frame = computed(() =>
  resolveAssetUrl(`/assets/ui/tien-hiep-2026-10/controls/skill-node-${kind.value}-v1.png`),
)
const lock = resolveAssetUrl('/assets/ui/huyen-kim/symbols/lock.svg')
const ring = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-brush-circle-v1.png')
</script>
<template>
  <button :class="['skill-node', `skill-node--${kind}`, node.state, { selected }]" :data-node-id="node.id" :aria-pressed="selected" :aria-label="`${node.name} · ${node.level} · ${t(`skill.state.${node.state}`)}`" @click="emit('select', node.id)">
    <span class="skill-node-disc"><img class="skill-node-icon" :src="node.icon" alt=""><img class="skill-node-frame" :src="frame" alt=""><img v-if="selected" class="skill-node-ring" :src="ring" alt=""><span v-if="node.state === 'locked'" class="skill-node-lock"><img :src="lock" alt=""></span></span>
  </button>
</template>
<style scoped>
.skill-node { --node-size:60px; width:var(--node-size); height:var(--node-size); display:grid; place-items:center; padding:0; border:0; background:none; color:#372719; font:14px var(--font-display,Georgia,serif); cursor:pointer; }
.skill-node--parent { --node-size:78px; }
.skill-node-disc { position:relative; display:grid; place-items:center; width:var(--node-size); height:var(--node-size); }
.skill-node-disc::before { content:''; position:absolute; inset:16%; border-radius:50%; background:#1c231e; }
.skill-node-icon { position:absolute; width:58%; height:58%; object-fit:contain; border-radius:50%; }
.skill-node-frame { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none; transition:filter 150ms ease,transform 150ms ease; filter:drop-shadow(0 3px 3px #72552944); }
.skill-node-ring { position:absolute; inset:-21%; width:142%; height:142%; object-fit:contain; pointer-events:none; filter:drop-shadow(0 0 6px #ffd17a99); }
.skill-node-lock { position:absolute; inset:0; display:grid; place-items:center; pointer-events:none; }
.skill-node-lock img { width:42%; height:42%; filter:drop-shadow(0 2px 4px rgba(0,0,0,.7)); }
.skill-node:not(.learned) .skill-node-icon { filter:grayscale(1) brightness(.6); opacity:.6; }
.skill-node:not(.learned) .skill-node-frame { filter:saturate(.35) brightness(.7); }
.skill-node.locked .skill-node-icon { filter:grayscale(1) brightness(.45); opacity:.45; }
.skill-node.locked .skill-node-frame { filter:saturate(.2) brightness(.55); }
.skill-node:not(.locked):hover .skill-node-disc { transform:scale(1.06); }
.skill-node:not(.locked):hover .skill-node-frame { filter:brightness(1.3) drop-shadow(0 0 5px #ffd17a) drop-shadow(0 0 8px #d4983d70); }
.skill-node:not(.learned):not(.locked):hover .skill-node-icon { filter:grayscale(.8) brightness(.8); opacity:.75; }
.skill-node:not(.locked):active .skill-node-disc { transform:scale(.96); }
.skill-node:focus-visible { outline:2px solid #315c47; outline-offset:5px; border-radius:5px; }
@media (prefers-reduced-motion:reduce) { .skill-node-frame { transition:none; } }
</style>
