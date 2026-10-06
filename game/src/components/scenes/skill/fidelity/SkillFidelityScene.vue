<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import SkillConstellationPanel from '@/components/panels/skill-constellation/SkillConstellationPanel.vue'
import SkillPaperTree from './SkillPaperTree.vue'
import SkillPaperDetails from './SkillPaperDetails.vue'
import { ELEMENT_COLOR_VARS } from '@/core/element/ElementLabels'
import type { SkillConstellationLayout } from '@/data/progression/SkillConstellationLayouts'
import type { SkillUiNode, SkillUiEdge, SkillUiElement } from './skillUi'
const props = withDefaults(
  defineProps<{
    nodes: readonly SkillUiNode[]
    edges: readonly SkillUiEdge[]
    elements: readonly SkillUiElement[]
    element: string
    selected: SkillUiNode | null
    notice: string
    /** Way/pathway identity line under the title. */
    identity: string
    /** Insight balance rendered beside the respec entry. */
    insightLabel: string
    respecDisabled: boolean
    /** Natural square layout size + zoom-to-fit for the graph. */
    graphSize?: number
    graphFit?: number
    preview?: boolean
    /** Authored glyph layout for the selected element; when set the
     *  constellation panel replaces the radial tree. */
    constellation?: SkillConstellationLayout | null
    /** Node id mid-unlock animation (dash travel + arrival pulse). */
    unlocking?: string
  }>(),
  { preview: false, graphSize: 710, graphFit: 1, constellation: null, unlocking: '' },
)

// Accent comes from the element tokens - the plan forbids per-glyph
// hardcoded palettes.
const constellationAccent = computed(
  () => (ELEMENT_COLOR_VARS as Record<string, string>)[props.element] ?? '',
)
const emit = defineEmits<{ back: []; select: [id: string]; element: [id: string]; upgrade: [id: string]; respec: [] }>()
const { t } = useI18n()
const paper = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/source/shared-paper-page-v1.png')

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="skill-paper-scene" :aria-label="t('skill.title')" @click.self="emit('back')">
    <div class="skill-sheet" :style="{ backgroundImage: `url('${paper}')` }" aria-hidden="true" />
    <header class="skill-head"><h1>{{ t('skill.title') }}</h1><p>{{ identity }}</p></header>
    <SkillConstellationPanel
      v-if="constellation"
      :layout="constellation"
      :nodes="nodes"
      :edges="edges"
      :selected="selected?.id ?? ''"
      :unlocking="unlocking"
      :accent="constellationAccent"
      @select="emit('select', $event)"
    />
    <SkillPaperTree v-else :nodes="nodes" :edges="edges" :selected="selected?.id ?? ''" :size="graphSize" :fit="graphFit" @select="emit('select', $event)" />
    <SkillPaperDetails :node="selected" :notice="notice" @upgrade="emit('upgrade', $event)" />
    <footer class="skill-foot">
      <span class="skill-insight">{{ insightLabel }}</span>
      <button type="button" class="skill-respec" :disabled="respecDisabled" @click="emit('respec')">{{ t('panels.nodeTree.respec.button') }}</button>
    </footer>
    <p v-if="preview" class="skill-preview-label">{{ t('skill.preview') }}</p>
  </section>
</template>
<style scoped>
.skill-paper-scene { position:absolute; inset:0; pointer-events:auto; font-family:var(--font-display,Georgia,serif); color:#3c2f1e; line-height:1.3; }.skill-paper-scene :deep(*) { box-sizing:border-box; }.skill-sheet { position:absolute; left:345px; top:101px; width:1065px; height:608px; background-color:#f2e4c8; background-size:cover; background-position:center; border:3px double #b28a43; }
.skill-head { position:absolute; left:372px; top:123px; width:1011px; height:61px; border-bottom:1px solid #b28a43; display:flex; align-items:flex-start; justify-content:flex-start; padding-left:54px; }.skill-head h1 { margin:0; }
.skill-head p { position:absolute; right:0; top:50%; transform:translateY(-50%); font-size:15px; color:#8a713c; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.skill-foot { position:absolute; left:375px; top:655px; width:600px; display:flex; align-items:center; gap:18px; }.skill-insight { font-size:15px; color:#5d4c2e; }.skill-respec { background:none; border:1px solid #a5834a; border-radius:5px; padding:4px 12px; color:#71572c; font:13px var(--font-display,Georgia,serif); cursor:pointer; }.skill-respec:hover:not(:disabled) { background:#e6d5a8; }.skill-respec:disabled { opacity:.45; cursor:default; }
.skill-preview-label { position:absolute; left:560px; top:719px; margin:0; color:#7f6a42; font-size:10px; }
</style>
