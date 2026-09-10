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
      <div class="transition-overlay__spinner" />
      <span class="transition-overlay__loading-text">{{ t('loading') }}</span>
    </div>

    <!-- Error shell (reachable while locked) -->
    <div
      v-if="error || phase === 'failed'"
      ref="errorCardRef"
      class="transition-overlay__error"
    >
      <div class="transition-overlay__error-card">
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
  z-index: 1000;
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
  background: var(--ink-950, #0a0c10);
  transition: transform 0.4s ease-in-out;
  will-change: transform;
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
  gap: 12px;
  z-index: 10;
  color: var(--chrome-100, #e2e8f0);
}

.transition-overlay__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--gold-300, #ffd54f);
  border-radius: 50%;
  animation: transition-spin 0.8s linear infinite;
}

@keyframes transition-spin {
  to {
    transform: rotate(360deg);
  }
}

.transition-overlay__loading-text {
  font-family: var(--font-body, serif);
  font-size: var(--text-sm, 14px);
  letter-spacing: 0.08em;
}

.transition-overlay__error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  background: rgba(0, 0, 0, 0.65);
}

.transition-overlay__error-card {
  box-sizing: border-box;
  padding: 24px 32px;
  background: var(--ink-900, #141820);
  border: 1px solid var(--crimson, #c94b4b);
  border-radius: 8px;
  max-width: min(400px, 90vw);
  text-align: center;
}

.transition-overlay__error-title {
  margin: 0 0 10px;
  color: var(--crimson, #ff6b6b);
  font-family: var(--font-display, serif);
  font-size: var(--text-md, 18px);
}

.transition-overlay__error-message {
  margin: 0 0 18px;
  color: var(--text-secondary, #cbd5e1);
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
  border-radius: 4px;
  font-size: var(--text-sm, 14px);
  cursor: pointer;
}

.transition-overlay__btn--primary {
  background: var(--gold-400, #d4a72c);
  color: #000;
  border: none;
}

.transition-overlay__btn--secondary {
  background: transparent;
  color: var(--text-secondary, #cbd5e1);
  border: 1px solid rgba(255, 255, 255, 0.25);
}
</style>
