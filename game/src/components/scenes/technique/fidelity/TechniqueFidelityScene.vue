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
.technique-codex-grid :deep(.technique-info) { padding:18px 16px 20px; }
.technique-codex-grid :deep(.technique-info.game-card--titled) { padding:38px 16px 20px; }
.technique-codex-grid :deep(.technique-description) { font-size:14px; line-height:1.75; margin:6px 0 14px; }
.technique-codex-grid :deep(.technique-section h2) { font-size:17px; }
.technique-codex-grid :deep(.technique-section dl) { font-size:13px; }
.technique-codex-grid :deep(.technique-section dl > div) { align-items:baseline; padding:8px 0; }
.technique-codex-grid :deep(.technique-artifact) { overflow:hidden; background:#f4e7ce; border:18px solid transparent; border-image:url('/assets/ui/tien-hiep-2026-10/realm/active-card-frame-v1.svg') 24 / 18px stretch; box-shadow:0 2px 5px #53351630; color:#241708; }
.technique-codex-grid :deep(.technique-slot-wrap) { top:2%; width:min(88%, 296px); }
.technique-codex-grid :deep(.technique-track) { left:12px; right:12px; bottom:10px; color:#241708; }
.technique-codex-grid :deep(.technique-track h2) { font-size:14px; color:#3b2810; letter-spacing:.1em; }
.technique-codex-grid :deep(.technique-mastery-label) { color:#3b2810; font-size:12px; }
.technique-codex-grid :deep(.technique-stage) { font-size:12px; padding:0 2px; }
.technique-codex-grid :deep(.technique-upgrade) { display:flex; flex-direction:column; gap:14px; padding:18px 16px; overflow-y:auto; }
.technique-codex-grid :deep(.technique-compare) { padding:14px 10px; border:1px solid #b6975e55; background:#19261e88; border-radius:4px; gap:16px; }
.technique-codex-grid :deep(.technique-compare strong) { font-size:21px; color:#a3d793; }
.technique-codex-grid :deep(.technique-upgrade h3) { margin:0; padding-top:12px; font-size:16px; }
.technique-codex-grid :deep(.technique-material) { padding:0; }
.technique-codex-grid :deep(.technique-material p) { font-size:15px; }
.technique-codex-grid :deep(.technique-advance.game-action-button) { position:relative; left:auto; bottom:auto; width:240px; height:calc(240px * 324 / 1225); min-height:46px; flex:none; margin:auto auto 0; font-size:21px; }
.technique-codex-grid :deep(.technique-notice) { position:relative; inset:auto; width:auto; height:auto; min-height:24px; margin:0; padding:0 2px; font-size:12px; text-align:center; }
</style>
