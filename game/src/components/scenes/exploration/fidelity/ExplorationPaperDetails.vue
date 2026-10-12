<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import SlotView from '@/components/common/SlotView.vue'
import type { ExplorationPaperModel, ExplorationDetail } from './explorationUi'
const props = defineProps<{ model: ExplorationPaperModel; stage: ExplorationDetail | null; notice: string }>()
const emit = defineEmits<{ mode: [id: string]; openBuild: []; start: [] }>()
const { t } = useI18n()
const card = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/character-card-nine-slice-v2.png')
const ctaArt = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png')
// Mode chips wear the Trang Bi op-tab nine-slice buttons (Minh
// 2026-10-12): secondary art idle, primary art on the armed chip.
const btnSecondary = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/button-secondary-v1.png')
const btnPrimary = resolveAssetUrl('/assets/ui/tien-hiep-2026-10/controls/button-primary-v1.png')

// Minh 2026-10-12: the 4 battle modes collapse into one dropdown -
// closed face is the nine-slice button, open list sits on the dark
// card skin. Closes on pick or outside pointerdown.
const modeOpen = ref(false)
const currentModeLabel = computed(() => props.stage?.modes.find((chip) => chip.active)?.label ?? '')
// Minh: the list only offers the OTHER modes - the armed one is the
// toggle face itself, saving a row.
const otherModes = computed(() => props.stage?.modes.filter((chip) => !chip.active) ?? [])
function pickMode(id: string, disabled: boolean) {
  if (disabled) return
  emit('mode', id)
  modeOpen.value = false
}
function onDocPointerDown(event: PointerEvent) {
  if (!(event.target as HTMLElement | null)?.closest?.('.mode-dropdown')) modeOpen.value = false
}
if (typeof document !== 'undefined') document.addEventListener('pointerdown', onDocPointerDown)
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointerDown))
</script>
<template>
  <aside class="exploration-details" :style="{ borderImageSource: `url('${card}')` }">
    <template v-if="stage">
      <h2 class="stage-title">{{ stage.title }}</h2>
      <div class="details-body">
        <p v-if="stage.disabledLabel" class="disabled-line">{{ stage.disabledLabel }}</p>
        <h3 class="section-heading">{{ t('exploration.rewards') }}</h3>
        <div class="rewards"><div v-for="(reward, index) in stage.rewards" :key="index" class="reward"><SlotView :item="reward" :icon="reward.icon" :label="reward.label" :variant="reward.variant ?? 'item'" :accessible-label="[reward.label, reward.amount].filter(Boolean).join(' ')" :tooltip="reward.tooltip" show-label /><strong>{{ reward.amount }}</strong></div></div>
      </div>
      <!-- Mode picker stays under the rewards (Minh 2026-10-12); the
           list opens UPWARD over the rewards body so it never
           overflows the card bottom. The armed-farm banner is gone on
           his call - the Dong Fu AutoFarmIndicator keeps stop duty. -->
      <div class="mode-block"><div class="mode-dropdown" :style="{ '--equipment-btn-secondary': `url('${btnSecondary}')`, '--equipment-btn-primary': `url('${btnPrimary}')` }"><button type="button" class="mode-toggle" :aria-expanded="modeOpen" aria-haspopup="listbox" :aria-label="t('exploration.modes')" @click="modeOpen = !modeOpen"><span>{{ currentModeLabel }}</span><span class="mode-caret" aria-hidden="true">▴</span></button><ul v-if="modeOpen" class="mode-list" role="listbox"><li v-for="chip in otherModes" :key="chip.id" role="option" :aria-selected="chip.active" :aria-disabled="chip.disabled"><button type="button" class="mode-option" :class="{ active: chip.active }" :disabled="chip.disabled" :data-mode="chip.id" @click="pickMode(chip.id, chip.disabled)">{{ chip.label }}</button></li></ul></div></div>
      <div class="start-row" :style="{ '--equipment-btn-secondary': `url('${btnSecondary}')` }"><button type="button" class="build-link" @click="emit('openBuild')">{{ stage.buildLabel }}</button><button class="challenge" type="button" :disabled="stage.startDisabled" data-testid="stage-start-button" :style="{ backgroundImage: `url('${ctaArt}')` }" @click="emit('start')">{{ stage.startLabel }}</button></div>
    </template>
    <template v-else><h2 class="stage-title">{{ model.title }}</h2><p class="empty-line">{{ t('exploration.empty') }}</p></template>
    <p class="notice" role="status">{{ notice }}</p>
  </aside>
</template>
<style scoped>
/* Son Ha Do home-panel inspector: the dark character-card nine-slice
   with light text (same frame the preview stamps on every panel's
   detail rail) - all canonical rows keep their order and meaning. */
/* #app ancestor + doubled class beats the global tien-hiep-ui
   paper-skin overrides (:is(#app,body) .exploration-details +
   ::before/::after cream fill + frame). */
:is(#app,body) .exploration-details.exploration-details { position:relative; min-height:0; border:14px solid transparent; border-image-slice:160; border-image-width:14px; border-image-repeat:stretch; clip-path:inset(4.7px 1.8px 5.3px 1.9px round 5px); box-sizing:border-box; padding:10px 12px 8px; display:flex; flex-direction:column; gap:4px; color:#efdfb9; background:linear-gradient(#000000d9,#000000d9) border-box 2px 5px/calc(100% - 4px) calc(100% - 10px) no-repeat; }
:is(#app,body) .exploration-details.exploration-details::before,
:is(#app,body) .exploration-details.exploration-details::after { display:none; content:none; }
.stage-title { margin:0; text-align:center; font-size:21px; font-weight:500; color:#f4e4c0; }
.details-body { flex:1; min-height:0; overflow:auto; scrollbar-width:thin; }
.disabled-line { font-size:12px; color:#d98d6a; margin:5px 0; text-align:center; }
.section-heading { margin:12px 0 6px; border-block:1px solid #ab8a4b66; padding:6px 0; font-size:15px; font-weight:600; text-align:center; color:#f0dcae; }
.rewards { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; padding-top:4px; }
.reward { flex:0 0 auto; width:52px; text-align:center; font-size:10px; }
.reward .slot-view { width:100%; }
.reward strong { display:block; margin-top:2px; font-weight:500; font-size:12px; color:#c4d9a8; }
.mode-block { flex:0 0 auto; margin-top:6px; }
/* Mode dropdown (Minh 2026-10-12): closed face = nine-slice secondary
   button art like the Trang Bi tabs; open list options keep the same
   art (secondary idle / primary armed). */
.mode-dropdown { position:relative; width:78%; margin-inline:auto; }
.mode-toggle { position:relative; isolation:isolate; display:flex; justify-content:center; align-items:center; width:100%; padding:5px 12px 7px; border:0; background:transparent; color:#f4e4c0; font:700 13px var(--pc-font-body, var(--font-display, Georgia, serif)); cursor:pointer; }
.mode-toggle::before { content:''; position:absolute; inset:0 -2px; z-index:-1; border:9px solid transparent; border-image:var(--equipment-btn-secondary) 60 fill stretch; pointer-events:none; }
.mode-toggle:hover::before { filter:brightness(1.1); }
.mode-caret { position:absolute; right:12px; font-size:11px; opacity:.8; }
.mode-list { position:absolute; bottom:calc(100% + 2px); left:0; right:0; margin:0; padding:4px; list-style:none; display:grid; gap:4px; background:transparent; border:0; z-index:6; }
/* Each option keeps the same 9-slice button art (Minh: 'giu art') -
   secondary idle, primary on the armed one. */
.mode-option { position:relative; isolation:isolate; display:block; width:100%; padding:4px 10px 6px; border:0; background:transparent; color:#f4e4c0; font:700 13px var(--pc-font-body, var(--font-display, Georgia, serif)); text-align:center; cursor:pointer; white-space:nowrap; }
.mode-option::before { content:''; position:absolute; inset:0 -2px; z-index:-1; border:9px solid transparent; border-image:var(--equipment-btn-secondary) 60 fill stretch; pointer-events:none; }
.mode-option.active { color:#2f2415; text-shadow:0 1px #fff7; }
.mode-option.active::before { border-image-source:var(--equipment-btn-primary); }
.mode-option:not(:disabled):hover::before { filter:brightness(1.1); }
.mode-option.active:not(:disabled):hover { color:#1d1408; }
.mode-option.active:not(:disabled):hover::before { filter:brightness(1.06); }
.mode-option:disabled { opacity:.45; cursor:default; }

/* Start row anchors to the card's bottom edge (Minh: the button's box
   kisses the detail card's lower rim) - the rewards body above it
   absorbs the leftover height. */
.start-row { display:flex; flex-direction:column; gap:6px; margin-top:auto; order:10; transform:translateY(13px); }
/* Chinh Build matches the mode toggle's footprint (Minh: same size). */
.build-link { position:relative; isolation:isolate; align-self:center; width:78%; padding:5px 12px 7px; border:0; background:transparent; color:#f4e4c0; font:700 13px var(--pc-font-body, var(--font-display, Georgia, serif)); text-align:center; cursor:pointer; white-space:nowrap; }
.build-link::before { content:''; position:absolute; inset:0 -2px; z-index:-1; border:9px solid transparent; border-image:var(--equipment-btn-secondary) 60 fill stretch; pointer-events:none; }
.build-link:hover::before { filter:brightness(1.1); }
/* The global '.exploration-details .challenge' rule stamps dark text
   for the pale --th-art-button-primary art; this surface mounts the
   dark equipment-filter plaque instead, so the label returns to cream
   (doubled class + :is(#app,body) matches that rule's specificity). */
:is(#app,body) .exploration-details.exploration-details .challenge { min-height:58px; border:0; background:transparent center/100% 100% no-repeat; color:#efdcb6; font:700 24px var(--font-display,Georgia,serif); cursor:pointer; }
.challenge:hover:not(:disabled) { filter:brightness(1.12); }
.challenge:disabled { opacity:.55; cursor:default; }
.challenge:focus-visible { outline:2px solid #d8b56a; outline-offset:2px; }
.empty-line { margin-top:16px; font-size:13px; color:#b99f6d; font-style:italic; text-align:center; }
.notice { min-height:0; flex:0 0 auto; max-height:30px; margin:4px 0 0; text-align:center; color:#c9a96f; font-size:11px; line-height:1.3; overflow:auto; }
</style>
