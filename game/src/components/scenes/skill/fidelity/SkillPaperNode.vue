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
</script>
<template>
  <button :class="['skill-node', `skill-node--${kind}`, node.state, { selected }]" :data-node-id="node.id" :aria-pressed="selected" :aria-label="`${node.name} · ${node.level} · ${t(`skill.state.${node.state}`)}`" @click="emit('select', node.id)">
    <span class="skill-node-disc"><img class="skill-node-icon" :src="node.icon" alt=""><img class="skill-node-frame" :src="frame" alt=""><span v-if="node.state === 'locked'" class="skill-node-lock"><img :src="lock" alt=""></span><span v-if="node.state === 'learned'" class="skill-node-learned" aria-hidden="true">✓</span></span>
    <span class="skill-node-name">{{ node.name }}</span><small class="skill-node-level">{{ node.level }}</small>
  </button>
</template>
<style scoped>
.skill-node { --node-size:60px; width:150px; display:flex; flex-direction:column; align-items:center; gap:5px; padding:0 2px 3px; border:0; background:none; color:#372719; font:14px var(--font-display,Georgia,serif); cursor:pointer; }
.skill-node--parent { --node-size:78px; }
.skill-node-disc { position:relative; display:grid; place-items:center; width:var(--node-size); height:var(--node-size); }
.skill-node-disc::before { content:''; position:absolute; inset:16%; border-radius:50%; background:#1c231e; }
.skill-node-icon { position:absolute; width:58%; height:58%; object-fit:contain; border-radius:50%; }
.skill-node-frame { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; pointer-events:none; transition:filter 150ms ease,transform 150ms ease; filter:drop-shadow(0 3px 3px #72552944); }
.skill-node-name { max-width:150px; padding:2px 6px; background:#eee0bedd; border-bottom:1px solid #ab8a4d66; border-radius:3px; line-height:1.2; }
.skill-node-level { color:#715d38; font-size:12px; line-height:1.2; padding:1px 8px; background:#e5d4a97d; border-radius:8px; }
.skill-node-lock { position:absolute; inset:25%; border-radius:50%; display:grid; place-items:center; background:#eee4c7d9; }
.skill-node-lock img { width:25px; height:25px; }
.locked .skill-node-icon { filter:grayscale(1); opacity:.55; }
.locked .skill-node-frame { filter:saturate(.3); }
.skill-node-learned { position:absolute; right:1px; bottom:2px; width:19px; height:19px; display:grid; place-items:center; border-radius:50%; background:#335e47; border:1px solid #d9bc71; color:#fff1c8; font-size:12px; }
.selected .skill-node-frame { filter:brightness(1.2) drop-shadow(0 0 5px #ffd17a) drop-shadow(0 0 8px #d4983d70); }
.skill-node:not(.locked):hover .skill-node-frame { filter:brightness(1.15) drop-shadow(0 0 3px #d8ab55); transform:scale(1.035); }
.skill-node:not(.locked):active .skill-node-disc { transform:scale(.96); }
.skill-node:focus-visible { outline:2px solid #315c47; outline-offset:5px; border-radius:5px; }
@media (prefers-reduced-motion:reduce) { .skill-node-frame { transition:none; } }
</style>
