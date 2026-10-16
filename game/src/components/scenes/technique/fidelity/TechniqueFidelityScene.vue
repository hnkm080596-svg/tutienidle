<script setup lang="ts">
import GamePanel from '@/components/common/GamePanel.vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import TechniquePaperInfo from './TechniquePaperInfo.vue'
import TechniquePaperArtifact from './TechniquePaperArtifact.vue'
import TechniquePaperUpgrade from './TechniquePaperUpgrade.vue'
import type { TechniqueUiModel } from './techniqueUi'
withDefaults(
  defineProps<{ model: TechniqueUiModel; selected: string; notice: string; preview?: boolean }>(),
  { preview: false },
)
const emit = defineEmits<{ back: []; select: [id: string]; advance: [] }>()
const { t } = useI18n()

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="rail-panel-scene technique-paper-scene" :aria-label="t('technique.title')" @click.self="emit('back')">
    <GamePanel :title="t('technique.title')">
    
    <div class="technique-codex-grid" :class="{ 'is-empty': !model.hasTechnique }">
    <TechniquePaperInfo :model="model" />
    <template v-if="model.hasTechnique">
      <TechniquePaperArtifact :model="model" :selected="selected" @select="emit('select', $event)" />
      <TechniquePaperUpgrade :model="model" :notice="notice" @advance="emit('advance')" />
    </template>
    </div>
    <p v-if="preview" class="technique-preview-label">{{ t('technique.preview') }}</p>
    </GamePanel>
  </section>
</template>
<style scoped>
.technique-paper-scene { position:absolute; inset:0; color:#3c2f1e; font-family:var(--font-display,Georgia,serif); line-height:1.4; }
.technique-paper-scene :deep(*) { box-sizing:border-box; }
.technique-preview-label { position:absolute; left:232px; top:702px; color:#7e6a44; font-size:10px; }
.technique-codex-grid { display:grid; grid-template-columns:minmax(0,.94fr) minmax(0,1.1fr) minmax(0,.95fr); gap:20px; height:100%; min-height:0; }
.technique-codex-grid.is-empty { grid-template-columns:1fr; }
.technique-codex-grid :deep(.technique-info),.technique-codex-grid :deep(.technique-artifact),.technique-codex-grid :deep(.technique-upgrade) { position:relative; inset:auto; width:auto; height:100%; min-height:0; }
.technique-codex-grid :deep(.technique-info) { padding:16px 14px 20px; background:#f7edd9ed; border:1px solid #b79c6455; border-radius:4px; }
.technique-codex-grid :deep(.technique-eyebrow) { margin-bottom:10px; font-size:11px; letter-spacing:.16em; }
.technique-codex-grid :deep(.technique-info h1) { font-size:30px; font-style:normal; line-height:1.3; color:#26483a; margin-bottom:12px; }
.technique-codex-grid :deep(.technique-quality) { border-radius:2px; background:#a98a3b13; letter-spacing:.08em; }
.technique-codex-grid :deep(.technique-description) { font-size:14px; line-height:1.75; margin:16px 0; }
.technique-codex-grid :deep(.technique-section h2) { font-size:17px; }
.technique-codex-grid :deep(.technique-section dl) { font-size:13px; }
.technique-codex-grid :deep(.technique-section dl > div) { align-items:baseline; padding:8px 0; }
.technique-codex-grid :deep(.technique-artifact) { overflow:hidden; border:1px solid #c6aa6b; border-radius:5px; background:radial-gradient(ellipse at 50% 34%,#3d5544,#162c24 65%,#14251f); box-shadow:inset 0 0 0 4px #c7ab6322,0 6px 12px #5d472919; }
.technique-codex-grid :deep(.technique-artifact .technique-book) { left:5%; top:3%; width:90%; height:61%; filter:drop-shadow(0 12px 12px #0007); }
.technique-codex-grid :deep(.technique-orbit) { left:10%; top:8%; width:80%; height:48%; opacity:.65; }
.technique-codex-grid :deep(.technique-track) { left:18px; right:18px; bottom:22px; color:#e5d5ac; }
.technique-codex-grid :deep(.technique-track h2) { font-size:14px; color:#e1cd9a; letter-spacing:.1em; }
.technique-codex-grid :deep(.technique-mastery-label) { color:#d8cba9; font-size:12px; }
.technique-codex-grid :deep(.technique-stage) { color:#b2b89c; font-size:12px; padding:0 2px; }
.technique-codex-grid :deep(.technique-stage-seal) { width:34px; height:34px; font-size:20px; background:#193b2e; color:#d2bf89; border-color:#8d804d; }
.technique-codex-grid :deep(.current .technique-stage-seal) { background:#a4803d; color:#fff1c4; border-color:#e6c57f; }
.technique-codex-grid :deep(.technique-upgrade) { display:flex; flex-direction:column; gap:14px; padding:16px 14px; overflow-y:auto; background:#f7edd9ed; border:1px solid #b79c6455; border-radius:4px; }
.technique-codex-grid :deep(.technique-upgrade h2) { margin:0; font-size:25px; }
.technique-codex-grid :deep(.technique-compare) { padding:16px 10px; border:1px solid #b6975e55; background:#9b7f4310; gap:8px; }
.technique-codex-grid :deep(.technique-compare strong) { font-size:21px; color:#365c43; }
.technique-codex-grid :deep(.technique-upgrade-hint) { margin:0; font-size:13px; line-height:1.7; }
.technique-codex-grid :deep(.technique-upgrade h3) { margin:0; padding-top:12px; font-size:16px; }
.technique-codex-grid :deep(.technique-material) { padding:0; }
.technique-codex-grid :deep(.technique-material p) { font-size:15px; }
.technique-codex-grid :deep(.technique-advance) { position:relative; left:auto; bottom:auto; width:100%; flex:0 0 48px; margin-top:auto; font-size:20px; }
.technique-codex-grid :deep(.technique-notice) { position:relative; inset:auto; width:auto; height:auto; min-height:36px; margin:0; padding:0 2px; font-size:12px; }
</style>
