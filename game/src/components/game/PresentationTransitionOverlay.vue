<script setup lang="ts">
/**
 * PresentationTransitionOverlay (AstraDoctrine Law A10, AGENTS.md P17).
 * Implements CurtainPort for GamePresentationCoordinator.
 *
 * Invariant:
 * - Two panels animate closing and opening.
 * - Resolves only once both panels complete their transition (ignoring bubbled child events).
 * - Reduced motion resolves immediately on nextTick after state application.
 * - AbortSignal cleans up event listeners and rejects.
 * - While locked, disables pointer events and intercepts keyboard events from activating elements underneath.
 * - Error controls remain reachable while gameplay is locked.
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CoordinatorError, Phase } from '@/presentation/PresentationContracts'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'

const props = withDefaults(
  defineProps<{
    phase?: Phase
    isLocked?: boolean
    error?: CoordinatorError | null
    canReturnHome?: boolean
  }>(),
  {
    phase: 'idle',
    isLocked: false,
    error: null,
    canReturnHome: true,
  },
)

const emit = defineEmits<{
  retry: []
  back: []
}>()

const { t } = useI18n({
  messages: {
    vi: {
      loading: 'Đang tải...',
      errorTitle: 'Không thể chuyển cảnh',
      retry: 'Thử lại',
      back: 'Quay lại',
    },
    en: {
      loading: 'Loading...',
      errorTitle: 'Transition Failed',
      retry: 'Retry',
      back: 'Back',
    },
  },
})

const leftPanelRef = ref<HTMLElement | null>(null)
const rightPanelRef = ref<HTMLElement | null>(null)
const errorCardRef = ref<HTMLElement | null>(null)
const curtainState = ref<'opened' | 'closing' | 'closed' | 'opening'>('opened')

let lastActiveElement: HTMLElement | null = null

function checkReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function animateCurtain(state: 'closing' | 'opening', signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new Error('Curtain animation aborted'))
  }

  if (checkReducedMotion()) {
    curtainState.value = state === 'closing' ? 'closed' : 'opened'
    return nextTick()
  }

  const settled = state === 'closing' ? 'closed' : 'opened'

  if (curtainState.value === settled) {
    return nextTick()
  }

  return new Promise<void>((resolve, reject) => {
    let leftDone = false
    let rightDone = false
    let safetyTimeout: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      if (safetyTimeout !== undefined) {
        clearTimeout(safetyTimeout)
      }
      signal?.removeEventListener('abort', onAbort)
      leftPanelRef.value?.removeEventListener('transitionend', onLeftEnd)
      rightPanelRef.value?.removeEventListener('transitionend', onRightEnd)
    }

    const onAbort = () => {
      cleanup()
      reject(new Error('Curtain animation aborted'))
    }

    const checkComplete = () => {
      if (leftDone && rightDone) {
        cleanup()
        curtainState.value = state === 'closing' ? 'closed' : 'opened'
        resolve()
      }
    }

    const onLeftEnd = (event: TransitionEvent) => {
      if (event.target !== leftPanelRef.value) return
      leftDone = true
      checkComplete()
    }

    const onRightEnd = (event: TransitionEvent) => {
      if (event.target !== rightPanelRef.value) return
      rightDone = true
      checkComplete()
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    leftPanelRef.value?.addEventListener('transitionend', onLeftEnd)
    rightPanelRef.value?.addEventListener('transitionend', onRightEnd)

    // Safety fallback in case transitionend does not fire in headless/test environments
    safetyTimeout = setTimeout(() => {
      cleanup()
      curtainState.value = state === 'closing' ? 'closed' : 'opened'
      resolve()
    }, 600)

    curtainState.value = state
  })
}

async function close(_id: number, signal: AbortSignal): Promise<void> {
  if (document.activeElement instanceof HTMLElement) {
    lastActiveElement = document.activeElement
  }
  await animateCurtain('closing', signal)
}

async function open(_id: number, signal: AbortSignal): Promise<void> {
  await animateCurtain('opening', signal)
  if (lastActiveElement && document.contains(lastActiveElement)) {
    lastActiveElement.focus()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.isLocked && curtainState.value === 'opened' && !props.error) {
    return
  }

  // If error modal is visible and event is inside it, allow it
  if (props.error && errorCardRef.value?.contains(event.target as Node)) {
    return
  }

  // Intercept all keyboard events from activating elements underneath
  event.preventDefault()
  event.stopPropagation()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown, true)
})

defineExpose({
  close,
  open,
  curtainState,
})
</script>

<template>
  <div
    class="presentation-overlay"
    :style="{ zIndex: OVERLAY_LAYERS.curtain }"
    :class="{
      'is-locked': isLocked || curtainState !== 'opened' || error !== null,
      'is-curtain-closed': curtainState === 'closed' || curtainState === 'closing',
    }"
    :data-phase="phase"
    :data-curtain="curtainState"
    data-testid="presentation-overlay"
    :aria-busy="isLocked"
    role="status"
    aria-live="polite"
  >
    <!-- Left and right curtain panels -->
    <div
      ref="leftPanelRef"
      class="curtain-panel curtain-panel--left"
      :class="`is-${curtainState}`"
    />
    <div
      ref="rightPanelRef"
      class="curtain-panel curtain-panel--right"
      :class="`is-${curtainState}`"
    />

    <!-- Visible loading indicator (shows during loading/activating) -->
    <div
      v-if="(phase === 'loading' || phase === 'activating' || phase === 'awaiting-ready') && !error"
      class="transition-overlay__loading"
    >
      <div class="transition-overlay__spinner sys-marker" />
      <span class="transition-overlay__loading-text">{{ t('loading') }}</span>
    </div>

    <!-- Error shell (reachable while locked) - T2 sys console, danger domain. -->
    <div
      v-if="error || phase === 'failed'"
      ref="errorCardRef"
      class="transition-overlay__error"
    >
      <div class="transition-overlay__error-card sys-surface sys-chamfer sys-corners sys-domain--danger">
        <h3 class="transition-overlay__error-title">{{ t('errorTitle') }}</h3>
        <p class="transition-overlay__error-message">{{ error?.message ?? '' }}</p>
        <div class="transition-overlay__error-actions">
          <button
            type="button"
            class="transition-overlay__btn transition-overlay__btn--primary"
            data-testid="presentation-retry-button"
            @click="emit('retry')"
          >
            {{ t('retry') }}
          </button>
          <button
            v-if="canReturnHome"
            type="button"
            class="transition-overlay__btn transition-overlay__btn--secondary"
            data-testid="presentation-back-button"
            @click="emit('back')"
          >
            {{ t('back') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.presentation-overlay {
  position: fixed;
  inset: 0;
  /* z-index comes from OVERLAY_LAYERS.curtain (inline style) — the curtain
     is the TOPMOST app layer: while closed it must cover every other
     panel, including modals, toasts, the save gate and the error screen. */
  pointer-events: none;
  overflow: hidden;
}

.presentation-overlay.is-locked {
  pointer-events: auto;
}

.curtain-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  background: var(--sys-bg-0, var(--ink-950, #0a0c10));
  transition: transform 0.4s ease-in-out;
  will-change: transform;
}

/* M-UI-OVERHAUL: the closing edges carry a lit hairline + faint scanlines so
   the covered screen reads as a system veil, not a black wipe. Transform-only
   motion (the .4s transform transition above is the sole animated property). */
.curtain-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.4s ease-in-out;
  background:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.028) 0 1px, transparent 1px 4px),
    linear-gradient(180deg, transparent, color-mix(in srgb, var(--sys-cyan, #57d8ff) 5%, transparent) 55%, transparent);
}

.curtain-panel--left::after { border-right: 1px solid color-mix(in srgb, var(--sys-cyan, #57d8ff) 55%, transparent); }
.curtain-panel--right::after { border-left: 1px solid color-mix(in srgb, var(--sys-cyan, #57d8ff) 55%, transparent); }

.curtain-panel.is-closing::after,
.curtain-panel.is-closed::after {
  opacity: 1;
}

.curtain-panel--left {
  left: 0;
  transform: translateX(-100%);
}

.curtain-panel--right {
  right: 0;
  transform: translateX(100%);
}

.curtain-panel--left.is-closing,
.curtain-panel--left.is-closed {
  transform: translateX(0);
}

.curtain-panel--right.is-closing,
.curtain-panel--right.is-closed {
  transform: translateX(0);
}

.curtain-panel--left.is-opening,
.curtain-panel--left.is-opened {
  transform: translateX(-100%);
}

.curtain-panel--right.is-opening,
.curtain-panel--right.is-opened {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .curtain-panel {
    transition: none !important;
  }
}

.transition-overlay__loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  z-index: 10;
  color: var(--sys-text-muted, var(--chrome-100, #e2e8f0));
}

.transition-overlay__spinner {
  width: 14px;
  height: 14px;
  background: var(--sys-accent, var(--gold-300, #ffd54f));
  animation: transition-spin 0.9s cubic-bezier(.6,.05,.4,.95) infinite;
}

@keyframes transition-spin {
  to {
    transform: rotate(360deg);
  }
}

.transition-overlay__loading-text {
  font-family: var(--sys-font-display, var(--font-body, serif));
  font-size: var(--text-sm, 14px);
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.transition-overlay__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  background: var(--sys-veil, rgba(0, 0, 0, 0.65));
}

.transition-overlay__error-card {
  box-sizing: border-box;
  padding: 24px 32px;
  max-width: min(400px, 90vw);
  text-align: center;
  color: var(--sys-text, var(--text-secondary, #cbd5e1));
}

.transition-overlay__error-title {
  margin: 0 0 10px;
  color: var(--sys-accent, var(--crimson, #ff6b6b));
  font-family: var(--sys-font-display, var(--font-display, serif));
  font-size: var(--text-md, 18px);
  letter-spacing: .1em;
  text-transform: uppercase;
}

.transition-overlay__error-message {
  margin: 0 0 18px;
  color: var(--sys-text-muted, var(--text-secondary, #cbd5e1));
  font-size: var(--text-sm, 14px);
  word-break: break-word;
}

.transition-overlay__error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.transition-overlay__btn {
  padding: 8px 16px;
  border-radius: 0;
  font-size: var(--text-sm, 14px);
  font-family: var(--sys-font-display, var(--font-body));
  letter-spacing: .08em;
  text-transform: uppercase;
  cursor: pointer;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.transition-overlay__btn--primary {
  background: color-mix(in srgb, var(--sys-accent, var(--gold-400, #d4a72c)) 22%, transparent);
  color: var(--sys-text, #fff);
  border: 1px solid var(--sys-accent, var(--gold-400, #d4a72c));
}

.transition-overlay__btn--secondary {
  background: transparent;
  color: var(--sys-text-muted, var(--text-secondary, #cbd5e1));
  border: 1px solid var(--sys-line-soft, rgba(255, 255, 255, 0.25));
}
</style>
