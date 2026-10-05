<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import PaperPanelNavigation, { type PaperNavigationItem } from '@/components/common/PaperPanelNavigation.vue'
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
    navigation: readonly PaperNavigationItem[]
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
const emit = defineEmits<{ navigate: [id: string]; back: []; select: [id: string]; element: [id: string]; upgrade: [id: string]; respec: [] }>()
const { t } = useI18n()
const paper = resolveAssetUrl('/assets/ui/huyen-kim/scene/character-v2/paper-nine-slice.png')

// Same dialog contract ImperialScrollScene carried: Escape closes, focus
// and pointer interaction stay inside the open surface.
const rootRef = ref<HTMLElement | null>(null)
useDialogFocus(rootRef, () => true, { onEscape: () => emit('back') })
</script>
<template>
  <section ref="rootRef" class="skill-paper-scene" :aria-label="t('skill.title')" @click.self="emit('back')">
    <div class="skill-paper" :style="{ borderImageSource: `url('${paper}')` }" aria-hidden="true" />
    <PaperPanelNavigation :items="navigation" active="skill" :label="t('skill.navigation')" :back-label="t('dongFu.aria')" @select="emit('navigate', $event)" @back="emit('back')" />
    <header class="skill-heading"><h1>{{ t('skill.title') }}</h1><p>{{ identity }}</p></header>
    <div v-if="elements.length" class="skill-elements" role="group" :aria-label="t('skill.elements')"><button v-for="entry in elements" :key="entry.id" :class="{ active: entry.id === element }" :aria-pressed="entry.id === element" @click="emit('element', entry.id)"><img :src="entry.icon" alt=""><span>{{ entry.label }}</span></button></div>
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
    <footer class="skill-meta">
      <span class="skill-insight">{{ insightLabel }}</span>
      <button type="button" class="skill-respec" :disabled="respecDisabled" @click="emit('respec')">{{ t('panels.nodeTree.respec.button') }}</button>
    </footer>
    <p v-if="preview" class="skill-preview-label">{{ t('skill.preview') }}</p>
  </section>
</template>
<style scoped>
.skill-paper-scene { position:absolute; inset:0; pointer-events:auto; font-family:var(--font-display,Georgia,serif); color:#3c2f1e; line-height:1.3; }.skill-paper-scene :deep(*) { box-sizing:border-box; }.skill-paper { position:absolute; left:94px; top:123px; width:1334px; height:633px; border:0 solid transparent; border-image-slice:300 fill; border-image-width:83px; border-image-repeat:stretch; filter:drop-shadow(0 12px 15px #0009); }
.skill-heading { position:absolute; left:235px; top:177px; max-width:235px; }.skill-heading h1 { font-size:34px; font-style:italic; font-weight:500; margin:0 0 9px; }
/* The way-identity subtitle is one line - a second wrapped line used to
   clip against the vista box, now it ellipsizes inside the 235px lane. */
.skill-heading p { font-size:15px; color:#8a713c; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.skill-elements { position:absolute; left:485px; top:185px; width:447px; display:flex; justify-content:space-between; }.skill-elements button { display:flex; flex-direction:column; align-items:center; gap:5px; width:70px; background:none; border:0; color:#786342; font:14px var(--font-display,Georgia,serif); cursor:pointer; }.skill-elements img { width:36px; height:36px; border:2px solid #b59a5a; border-radius:50%; object-fit:cover; }.skill-elements .active img { outline:2px solid #31644e; outline-offset:3px; }.skill-elements button:focus-visible { outline:2px solid #315c47; }
.skill-meta { position:absolute; left:235px; top:700px; display:flex; align-items:center; gap:18px; }.skill-insight { font-size:15px; color:#5d4c2e; }.skill-respec { background:none; border:1px solid #a5834a; border-radius:5px; padding:4px 12px; color:#71572c; font:13px var(--font-display,Georgia,serif); cursor:pointer; }.skill-respec:hover:not(:disabled) { background:#e6d5a8; }.skill-respec:disabled { opacity:.45; cursor:default; }
.skill-preview-label { position:absolute; left:560px; top:719px; margin:0; color:#7f6a42; font-size:10px; }
</style>
