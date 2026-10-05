<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { SkillUiNode } from './skillUi'
defineProps<{ node: SkillUiNode; selected: boolean }>()
const emit = defineEmits<{ select: [id: string] }>()
const { t } = useI18n()
const ring = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/orb-frame.png')
const lock = resolveAssetUrl('/assets/ui/huyen-kim/symbols/lock.svg')
</script>
<template>
  <button :class="['skill-node', node.state, { selected, prominent: node.prominent }]" :data-node-id="node.id" :aria-pressed="selected" :aria-label="`${node.name} · ${node.level} · ${t(`skill.state.${node.state}`)}`" @click="emit('select', node.id)">
    <span class="skill-node-disc"><span class="skill-node-core"><img class="skill-node-icon" :src="node.icon" alt=""></span><img class="skill-node-frame" :src="ring" alt=""><span v-if="node.state === 'locked'" class="skill-node-lock"><img :src="lock" alt=""></span><span v-if="node.state === 'learned'" class="skill-node-learned" aria-hidden="true">✓</span></span>
    <span class="skill-node-name">{{ node.name }}</span><small class="skill-node-level">{{ node.level }}</small>
  </button>
</template>
<style scoped>
.skill-node { --node-size:76px; width:150px; display:flex; flex-direction:column; align-items:center; gap:5px; padding:0 2px 3px; border:0; background:none; color:#5b4322; font:14px var(--font-display,Georgia,serif); cursor:pointer; }.skill-node.prominent { --node-size:96px; }
.skill-node-disc { position:relative; display:grid; place-items:center; width:var(--node-size); height:var(--node-size); border-radius:50%; filter:drop-shadow(0 3px 3px #72552944); }.skill-node-core { position:absolute; inset:15%; border-radius:50%; overflow:hidden; background:radial-gradient(circle,#e4cd89,#5d4827); }.skill-node-icon { width:100%; height:100%; object-fit:cover; }.skill-node-frame { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }.skill-node-name { max-width:150px; padding:2px 6px; background:#eee0bedd; border-bottom:1px solid #ab8a4d66; border-radius:3px; line-height:1.2; }.skill-node-level { color:#715d38; font-size:12px; line-height:1.2; padding:1px 8px; background:#e5d4a97d; border-radius:8px; }.skill-node-lock { position:absolute; inset:25%; border-radius:50%; display:grid; place-items:center; background:#eee4c7d9; }.skill-node-lock img { width:25px; height:25px; }.locked .skill-node-core { filter:grayscale(1); opacity:.55; }.locked .skill-node-frame { filter:saturate(.3); }.skill-node-learned { position:absolute; right:1px; bottom:2px; width:19px; height:19px; display:grid; place-items:center; border-radius:50%; background:#335e47; border:1px solid #d9bc71; color:#fff1c8; font-size:12px; }
.selected .skill-node-disc::before { content:''; position:absolute; inset:-5px; border:2px solid #4f9d80; border-radius:50%; box-shadow:0 0 15px #5caa8166; }.skill-node:hover .skill-node-disc { filter:drop-shadow(0 0 7px #b18a36aa); }.skill-node:focus-visible { outline:2px solid #315c47; outline-offset:5px; border-radius:5px; }
</style>
