<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { useDialogFocus } from '@/composables/useDialogFocus'
import { i18n } from '@/i18n'
import InkNineSlice from './primitives/InkNineSlice.vue'
import HuyenKimSymbol from './HuyenKimSymbol.vue'
import PaperPanelNavigation from './PaperPanelNavigation.vue'
import { usePaperNavigation } from '@/composables/usePaperNavigation'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

// ImperialScrollScene - the canonical large functional shell of the
// Huyen Kim rebuild (scene-layout-spec shared_shells.imperial_scroll).
// Envelope 92.1vw x 89.3vh ~ design 1540x840 of the 1672x941 canvas;
// rollers ride the envelope edges; paper body reveals center-to-edges
// on open (450-550ms) and reverses on close (300-380ms). Reduced motion
// crossfades only. The shell owns presentation only: a11y dialog
// contract + Esc/scrim close are identical to OverlayPanel.
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  layer?: number
  /** Imperial nav rail (cross-scene seals); scene-local nav uses slots. */
  nav?: boolean
  /** Fidelity contract: scene id lands as data-hk-scene on the host root. */
  scene?: string
}>(), {
  layer: OVERLAY_LAYERS.panel,
  nav: true,
})

const emit = defineEmits<{ close: [] }>()

// The scroll's rail is the same shared paper nav the fidelity surfaces
// render - one canonical id list, one selection target authority, and
// the active item follows whatever surface is currently open (plaque
// opens on a building land on that building's nav tab).
const { items: navItems, navigate: navigateRail, activeId: navActiveId } = usePaperNavigation()
const navLabel = computed(() => i18n.global.t('paperNav.navigation'))

const envelopeRef = ref<HTMLElement | null>(null)
useDialogFocus(envelopeRef, computed(() => props.open), { onEscape: () => emit('close') })

const headingId = useId()
const closeLabel = computed(() => i18n.global.t('panels.common.close'))

const rollerUrl = hkChromeUrl('imperial-scroll-roller')
const plaqueUrl = hkChromeUrl('scroll-title-plaque')
const grainUrl = hkChromeUrl('paper-grain-tile')
const cornerUrl = hkChromeUrl('corner-ornament')
const cloudUrl = hkChromeUrl('cloud-ornament')
</script>

<template>
  <Transition name="hk-scroll">
    <div v-if="open" class="hk-scroll" :style="{ zIndex: layer }" :data-hk-scene="scene" @click.self="emit('close')">
      <div
        ref="envelopeRef"
        class="hk-scroll__envelope"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="headingId"
      >
        <!-- Rollers travel during unfold, so they live OUTSIDE the clip. -->
        <img
          v-if="rollerUrl"
          class="hk-scroll__roller hk-scroll__roller--l"
          :src="rollerUrl"
          alt=""
          aria-hidden="true"
        />
        <img
          v-if="rollerUrl"
          class="hk-scroll__roller hk-scroll__roller--r"
          :src="rollerUrl"
          alt=""
          aria-hidden="true"
        />

        <!-- Paper body + grain + ceremony frame reveal center-to-edges. -->
        <div class="hk-scroll__clip" aria-hidden="true">
          <InkNineSlice chrome-id="imperial-scroll-body" layer="surface" />
          <div
            v-if="grainUrl"
            class="hk-scroll__grain"
            :style="{ backgroundImage: `url(${grainUrl})` }"
          />
          <InkNineSlice chrome-id="frame-xl-ceremony" layer="frame" />
          <template v-if="cornerUrl">
            <img class="hk-scroll__corner hk-scroll__corner--tl" :src="cornerUrl" alt="" />
            <img class="hk-scroll__corner hk-scroll__corner--tr" :src="cornerUrl" alt="" />
            <img class="hk-scroll__corner hk-scroll__corner--bl" :src="cornerUrl" alt="" />
            <img class="hk-scroll__corner hk-scroll__corner--br" :src="cornerUrl" alt="" />
          </template>
          <img v-if="cloudUrl" class="hk-scroll__cloud hk-scroll__cloud--l" :src="cloudUrl" alt="" />
          <img v-if="cloudUrl" class="hk-scroll__cloud hk-scroll__cloud--r" :src="cloudUrl" alt="" />
        </div>

        <!-- Furniture + content fade in once the scroll has unrolled. -->
        <div class="hk-scroll__chrome">
          <div class="hk-scroll__plaque" aria-hidden="false">
            <img v-if="plaqueUrl" :src="plaqueUrl" alt="" aria-hidden="true" />
            <h2 :id="headingId" class="hk-scroll__title">{{ title }}</h2>
          </div>

          <button
            type="button"
            class="hk-scroll__close"
            :aria-label="closeLabel"
            @click="emit('close')"
          >
            <InkNineSlice chrome-id="icon-button-utility" layer="surface" />
            <HuyenKimSymbol name="close" />
          </button>

          <PaperPanelNavigation
            v-if="nav"
            class="hk-scroll__rail"
            :items="navItems"
            :active="navActiveId"
            :label="navLabel"
            :back-label="closeLabel"
            @select="navigateRail"
            @back="emit('close')"
          />

          <div class="hk-scroll__inner">
            <header v-if="$slots.header" class="hk-scroll__header">
              <slot name="header" />
            </header>
            <div class="hk-scroll__main">
              <slot />
            </div>
            <footer v-if="$slots.footer" class="hk-scroll__footer">
              <slot name="footer" />
            </footer>
          </div>

          <!-- Envelope-relative overlay layer (e.g. the scene 04
               chi-tiet drawer, spec anchor envelope-right-overlay):
               children position themselves in cqw/cqh. -->
          <div v-if="$slots.overlay" class="hk-scroll__overlay">
            <slot name="overlay" />
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.hk-scroll {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  /* World stays slightly visible around the decree (spec: envelope is
     ~92% of the stage) - a light scrim, not the old opaque modal wash. */
  background: rgba(6, 8, 12, 0.34);
  backdrop-filter: blur(2px);
}

.hk-scroll__envelope {
  position: relative;
  width: 92.1vw;
  height: 89.3vh;
  outline: none;
  /* Design-fraction geometry lives inside: children express the spec's
     1672x941 coordinates as container-query percentages. */
  container-type: size;
}

/* ---------- furniture ---------- */

.hk-scroll__roller {
  position: absolute;
  top: -1.9cqh;
  height: 103.8cqh;
  width: 6.23cqw;
  min-width: 54px;
  object-fit: fill;
  z-index: 3;
  pointer-events: none;
}
.hk-scroll__roller--l { left: -1.04cqw; }
.hk-scroll__roller--r { right: -1.04cqw; transform: scaleX(-1); }

.hk-scroll__clip {
  position: absolute;
  inset: 0;
  z-index: 1;
  clip-path: inset(0 0 0 0);
}

/* Paper grain rides above the body surface, below the frame art. */
.hk-scroll__grain {
  position: absolute;
  inset: 1.2cqh 2.6cqw;
  background-repeat: repeat;
  background-size: min(13cqw, 220px);
  opacity: 0.34;
  mix-blend-mode: multiply;
  pointer-events: none;
  z-index: 1;
}

.hk-scroll__corner {
  position: absolute;
  width: max(3.4cqw, 40px);
  height: auto;
  pointer-events: none;
  z-index: 3;
}
.hk-scroll__corner--tl { top: 0.6cqh; left: 2.6cqw; }
.hk-scroll__corner--tr { top: 0.6cqh; right: 2.6cqw; transform: scaleX(-1); }
.hk-scroll__corner--bl { bottom: 0.6cqh; left: 2.6cqw; transform: scaleY(-1); }
.hk-scroll__corner--br { bottom: 0.6cqh; right: 2.6cqw; transform: scale(-1); }

/* Faint cloud wisps anchoring the decree to the Son Thuy vista. */
.hk-scroll__cloud {
  position: absolute;
  width: max(15cqw, 190px);
  height: auto;
  opacity: 0.22;
  pointer-events: none;
  z-index: 3;
}
.hk-scroll__cloud--l { top: -3.2cqh; left: 6cqw; }
.hk-scroll__cloud--r { top: -3.6cqh; right: 7cqw; transform: scaleX(-1); }

.hk-scroll__chrome {
  position: absolute;
  inset: 0;
  z-index: 2;
}

.hk-scroll__plaque {
  position: absolute;
  /* Raised + narrowed so the hanging sign clears the header tab row at
     every viewport (its tail previously dipped over the tabs). */
  top: -4.4cqh;
  left: 50%;
  transform: translateX(-50%);
  width: max(19cqw, 150px);
  z-index: 4;
  display: grid;
  pointer-events: none;
}
.hk-scroll__plaque img {
  width: 100%;
  height: auto;
  grid-area: 1 / 1;
}
.hk-scroll__title {
  grid-area: 1 / 1;
  align-self: center;
  justify-self: center;
  margin: 0 0 6%;
  padding: 0;
  color: var(--hk-text-primary, #f2ead8);
  /* Longer scene titles (e.g. the body scene's two-part name) must
     stay inside the painted plaque: nowrap + a smaller floor. */
  white-space: nowrap;
  font: 700 clamp(12px, 1.35cqw, 22px) var(--hk-font-display, var(--font-display, serif));
  letter-spacing: 0.12em;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
  pointer-events: none;
}

.hk-scroll__close {
  position: absolute;
  top: 1.9cqh;
  right: 3.8cqw;
  z-index: 5;
  width: clamp(38px, 3.1cqw, 52px);
  aspect-ratio: 1;
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--hk-text-primary, #f2ead8);
  cursor: pointer;
}
.hk-scroll__close :deep(.hk-symbol) { width: 40%; height: 40%; }
.hk-scroll__close:hover { filter: brightness(1.18); }
.hk-scroll__close:focus-visible { outline: 2px solid var(--hk-gold, #d8b45a); outline-offset: 2px; }

/* Compound selector wins over .paper-navigation's own design-px box:
   inside the scroll the rail fills this cqw/cqh slot instead. */
.hk-scroll__chrome > .hk-scroll__rail {
  position: absolute;
  left: 4.8cqw;
  /* Extended to the frame's usable band so the full canonical set fits
     at design height (11 items ~608px) with no scroll; shorter surfaces
     keep the spec scrollfade below. */
  top: 7cqh;
  bottom: 7cqh;
  height: auto;
  width: max(8.6cqw, 92px);
  z-index: 4;
  border-right: 0;
}
.hk-scroll__rail :deep(.paper-navigation-items) {
  align-items: center;
  /* Tall viewports fit the whole canonical set; shorter ones keep the
     spec scrollfade at the lower edge instead of a visible scrollbar. */
  mask-image: linear-gradient(to bottom, #000 0, #000 90%, transparent 100%);
}

.hk-scroll__inner {
  position: absolute;
  left: 14.4cqw;
  right: 4.8cqw;
  top: 6.5cqh;
  /* Keep content inside the pale paper - the ceremony frame's dark
     bottom band occupies ~10cqh below it. */
  bottom: 10.5cqh;
  display: flex;
  flex-direction: column;
  min-height: 0;
  z-index: 2;
}
.hk-scroll__header {
  flex: 0 0 auto;
  min-height: 0;
  /* The paper art's top curl shadow reaches ~2cqh into the inner
     region - header content starts below it so glyph tops never sit
     on the dark band. */
  padding-top: 4.2cqh;
  margin-bottom: 1.2cqh;
}
.hk-scroll__main {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}
.hk-scroll__footer {
  flex: 0 0 auto;
  min-height: 0;
  margin-top: 1.2cqh;
}

/* Overlay layer: clicks pass through the wrapper; only slotted
   surfaces take input. */
.hk-scroll__overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}
.hk-scroll__overlay > * {
  pointer-events: auto;
}

/* ---------- open / close signature ---------- */

.hk-scroll-enter-active,
/* During leave the scroll is a visual ghost only: pointer-events off so
   crossfaded scenes never eat clicks meant for the entering scroll
   (a scrim hit on the leaver would close the just-opened scene). */
.hk-scroll-leave-active {
  transition: opacity 0.16s ease;
  pointer-events: none;
}
.hk-scroll-enter-from,
.hk-scroll-leave-to { opacity: 0; }

.hk-scroll-enter-active .hk-scroll__clip {
  transition: clip-path 0.5s cubic-bezier(0.22, 0.8, 0.24, 1) 0.08s;
}
.hk-scroll-leave-active .hk-scroll__clip {
  transition: clip-path 0.34s cubic-bezier(0.5, 0, 0.75, 0.4) 0.04s;
}
.hk-scroll-enter-from .hk-scroll__clip,
.hk-scroll-leave-to .hk-scroll__clip {
  clip-path: inset(0 50% 0 50%);
}

.hk-scroll-enter-active .hk-scroll__roller {
  transition: transform 0.5s cubic-bezier(0.3, 0.7, 0.2, 1);
}
.hk-scroll-leave-active .hk-scroll__roller {
  transition: transform 0.34s cubic-bezier(0.5, 0, 0.75, 0.4);
}
.hk-scroll-enter-from .hk-scroll__roller--l,
.hk-scroll-leave-to .hk-scroll__roller--l {
  transform: translateX(48cqw);
}
.hk-scroll-enter-from .hk-scroll__roller--r,
.hk-scroll-leave-to .hk-scroll__roller--r {
  transform: translateX(-48cqw) scaleX(-1);
}

.hk-scroll-enter-active .hk-scroll__chrome {
  transition: opacity 0.28s ease 0.3s;
}
.hk-scroll-leave-active .hk-scroll__chrome {
  transition: opacity 0.14s ease;
}
.hk-scroll-enter-from .hk-scroll__chrome,
.hk-scroll-leave-to .hk-scroll__chrome {
  opacity: 0;
}

/* ---------- responsive + reduced motion ---------- */

@media (max-width: 900px) {
  .hk-scroll__envelope { width: 96vw; height: 92vh; }
  /* Icon-only rail at narrow widths (spec: icon-only 96w at 1366). */
  .hk-scroll__rail { width: max(7cqw, 76px); }
  .hk-scroll__inner { left: 13cqw; }
}

@media (prefers-reduced-motion: reduce) {
  .hk-scroll-enter-active,
  .hk-scroll-leave-active,
  .hk-scroll-enter-active .hk-scroll__clip,
  .hk-scroll-leave-active .hk-scroll__clip,
  .hk-scroll-enter-active .hk-scroll__roller,
  .hk-scroll-leave-active .hk-scroll__roller,
  .hk-scroll-enter-active .hk-scroll__chrome,
  .hk-scroll-leave-active .hk-scroll__chrome {
    transition: opacity 0.15s ease;
  }
  .hk-scroll-enter-from .hk-scroll__clip,
  .hk-scroll-leave-to .hk-scroll__clip {
    clip-path: inset(0 0 0 0);
  }
  .hk-scroll-enter-from .hk-scroll__roller--l,
  .hk-scroll-leave-to .hk-scroll__roller--l {
    transform: translateX(0);
  }
  .hk-scroll-enter-from .hk-scroll__roller--r,
  .hk-scroll-leave-to .hk-scroll__roller--r {
    transform: scaleX(-1);
  }
}
</style>
