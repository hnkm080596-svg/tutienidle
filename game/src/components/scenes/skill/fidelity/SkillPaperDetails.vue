<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import type { SkillUiNode } from './skillUi'
defineProps<{ node: SkillUiNode | null; notice: string }>()
const emit = defineEmits<{ upgrade: [id: string] }>()
const { t } = useI18n()
const paperFrame = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')
</script>
<template>
  <aside class="skill-detail-card">
    <div class="skill-card-frame" :style="{ borderImageSource: `url('${paperFrame}')` }" aria-hidden="true" />
    <header v-if="node"><img :src="node.icon" alt=""><div><h2>{{ node.name }}</h2><p>{{ node.level }} · {{ t(`skill.state.${node.state}`) }}</p></div></header>
    <div class="skill-detail-body">
      <template v-if="node">
        <dl class="skill-primary">
          <div><dt>{{ t('skill.level') }}</dt><dd>{{ node.level }}</dd></div>
          <div v-if="node.experience !== ''"><dt>{{ t('skill.experience') }}</dt><dd>{{ node.experience }}</dd></div>
        </dl>
        <template v-if="node.stats.length"><h3>{{ t('skill.stats') }}</h3><dl><div v-for="row in node.stats" :key="row.id"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl></template>
        <h3>{{ t('skill.conditions') }}</h3>
        <p v-for="(line, i) in node.conditions" :key="i" class="skill-condition">{{ line }}</p>
        <p v-if="!node.conditions.length" class="skill-condition">{{ t('skill.noConditions') }}</p>
        <p class="skill-description skill-description--footer">{{ node.description }}</p>
      </template>
      <p v-else class="skill-description">{{ t('panels.skillPath.nodeInspector.empty') }}</p>
    </div>
    <div v-if="node && (node.costLabel || node.actionHint || node.actionLabel)" class="skill-actions">
      <p v-if="node.costLabel" class="skill-cost">{{ node.costLabel }}</p>
      <p v-if="node.actionHint" class="skill-action-hint">{{ node.actionHint }}</p>
      <button v-if="node.actionLabel" class="skill-upgrade" :disabled="node.actionDisabled" @click="emit('upgrade', node.id)">{{ node.actionLabel }}</button>
    </div>
    <p class="skill-notice" role="status" aria-live="polite">{{ notice }}</p>
  </aside>
</template>
<style scoped>
.skill-detail-card { position:absolute; left:985px; top:198px; width:400px; height:487px; padding:25px 26px 13px; isolation:isolate; display:flex; flex-direction:column; color:#f0dfbb; }
.skill-card-frame { position:absolute; inset:0; z-index:-1; pointer-events:none; border:15px solid transparent; border-image-slice:90 fill; border-image-width:15px; border-image-repeat:stretch; }
.skill-detail-card header { flex:none; display:flex; align-items:center; gap:14px; min-height:76px; padding-bottom:16px; border-bottom:1px solid #9d8049; }
header img { width:61px; height:61px; border:3px double #a6813a; border-radius:50%; object-fit:cover; }
.skill-detail-card h2 { margin:0 0 9px; font-size:25px; line-height:1.2; font-weight:500; color:#f3e0b5; }header p { margin:0; color:#b3a077; font-size:14px; }
.skill-detail-body { min-height:0; flex:1; overflow-y:auto; overflow-x:hidden; scrollbar-width:none; padding-right:5px; }
.skill-detail-body::-webkit-scrollbar { display:none; }
.skill-description { font-size:16px; line-height:1.7; color:#d8c49a; margin:20px 0; }.skill-description--footer { margin:22px 0 0; padding-top:13px; border-top:1px solid #8a713c55; }.skill-primary { margin-top:14px; }h3 { margin:22px 0 12px; padding-top:13px; border-top:1px solid #8a713c55; font-size:20px; font-weight:500; color:#f0d9a0; }
dl { margin:0; font-size:15px; }dl > div { display:flex; justify-content:space-between; gap:14px; padding:9px 0; border-bottom:1px solid #8a713c33; }dt { color:#cbb585; }dd { margin:0; color:#f0d9a0; text-align:right; }
.skill-condition { font-size:15px; line-height:1.6; margin:0 0 6px; color:#b3a077; }
.skill-actions { flex:none; padding-top:14px; border-top:1px solid #8a713c55; }
.skill-cost { font-size:15px; margin:0 0 6px; color:#e0b665; font-weight:500; }
.skill-action-hint { color:#8c7956; font-size:11px; line-height:1.5; margin:0 0 8px; }
.skill-upgrade { flex:none; width:100%; height:47px; font:23px var(--font-display,Georgia,serif); cursor:pointer; }.skill-upgrade:hover { filter:brightness(1.12); }.skill-upgrade:focus-visible { outline:2px solid #315b43; outline-offset:3px; }.skill-upgrade:disabled { cursor:default; filter:grayscale(.55) opacity(.75); }
.skill-notice { flex:none; width:100%; height:34px; padding-top:7px; font-size:11px; line-height:14px; color:#b3a077; }.skill-notice:empty { display:none; }
</style>
