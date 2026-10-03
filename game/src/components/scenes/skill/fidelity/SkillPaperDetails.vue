<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { SkillUiNode } from './skillUi'
defineProps<{ node: SkillUiNode | null; notice: string }>()
const emit = defineEmits<{ upgrade: [id: string] }>()
const { t } = useI18n()
const paperFrame = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')
</script>
<template>
  <aside class="skill-paper-details">
    <div class="skill-info-frame" :style="{ borderImageSource: `url('${paperFrame}')` }" aria-hidden="true" />
    <header v-if="node"><img :src="node.icon" alt=""><div><h2>{{ node.name }}</h2><p>{{ node.level }} · {{ t(`skill.state.${node.state}`) }}</p></div></header>
    <div class="skill-detail-body">
      <template v-if="node">
        <p class="skill-description">{{ node.description }}</p>
        <template v-if="node.rows.length"><h3>{{ t('skill.effects') }}</h3><dl><div v-for="row in node.rows" :key="row.id"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl></template>
        <h3>{{ t('skill.conditions') }}</h3>
        <p v-for="(line, i) in node.conditions" :key="i" class="skill-condition">{{ line }}</p>
        <p v-if="!node.conditions.length" class="skill-condition">{{ t('skill.noConditions') }}</p>
        <p v-if="node.costLabel" class="skill-condition skill-cost">{{ node.costLabel }}</p>
        <p v-if="node.actionHint" class="skill-action-hint">{{ node.actionHint }}</p>
      </template>
      <p v-else class="skill-description">{{ t('panels.skillPath.nodeInspector.empty') }}</p>
    </div>
    <button v-if="node?.actionLabel" class="skill-upgrade" :disabled="node.actionDisabled" @click="emit('upgrade', node.id)">{{ node.actionLabel }}</button>
    <p class="skill-notice" role="status" aria-live="polite">{{ notice }}</p>
  </aside>
</template>
<style scoped>
.skill-paper-details { position:absolute; left:967px; top:153px; width:422px; height:578px; padding:25px 26px 13px; isolation:isolate; display:flex; flex-direction:column; }
.skill-info-frame { position:absolute; inset:0; z-index:-1; pointer-events:none; border:0 solid transparent; border-image-slice:300 fill; border-image-width:35px; border-image-repeat:stretch; filter:drop-shadow(0 3px 4px #79613a30); }
.skill-paper-details::after { content:''; position:absolute; inset:13px; z-index:-1; border:1px solid #b89a5650; pointer-events:none; }
.skill-paper-details header { flex:none; display:flex; align-items:center; gap:14px; min-height:76px; padding-bottom:16px; border-bottom:1px solid #ad8a49; }
header img { width:61px; height:61px; border:3px double #a6813a; border-radius:50%; object-fit:cover; }
.skill-paper-details h2 { margin:0 0 9px; font-size:25px; line-height:1.2; font-weight:500; }header p { margin:0; color:#786344; font-size:14px; }
.skill-detail-body { min-height:0; flex:1; overflow:auto; scrollbar-width:thin; scrollbar-color:#aa8c48 transparent; padding-right:5px; }
.skill-description { font-size:16px; line-height:1.7; color:#6d5c40; margin:20px 0; }h3 { margin:22px 0 12px; padding-top:13px; border-top:1px solid #aa8c4855; font-size:20px; font-weight:500; }
dl { margin:0; font-size:15px; }dl > div { display:flex; justify-content:space-between; gap:14px; padding:9px 0; border-bottom:1px solid #aa8c4822; }dd { margin:0; color:#3c6d52; text-align:right; }
.skill-condition { font-size:15px; line-height:1.6; margin:0 0 6px; }.skill-cost { color:#71572c; font-weight:500; }
.skill-action-hint { color:#8c7956; font-size:11px; line-height:1.5; }
.skill-upgrade { flex:none; width:100%; height:47px; margin-top:15px; border:3px double #b79a4b; border-radius:6px; background:linear-gradient(100deg,#194e3e,#32735b,#194e3e); color:#fff0c8; font:23px var(--font-display,Georgia,serif); cursor:pointer; }.skill-upgrade:hover { filter:brightness(1.12); }.skill-upgrade:focus-visible { outline:2px solid #315b43; outline-offset:3px; }.skill-upgrade:disabled { cursor:default; filter:grayscale(.55) opacity(.75); }
.skill-notice { flex:none; width:100%; height:34px; padding-top:7px; font-size:11px; line-height:14px; color:#715c39; }
</style>
