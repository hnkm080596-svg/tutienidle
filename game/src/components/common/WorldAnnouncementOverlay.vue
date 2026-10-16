<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useWorldAnnouncementStore } from '@/stores/worldAnnouncement'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import OrnateDialog from '@/components/common/art/OrnateDialog.vue'
import OrnateDivider from '@/components/common/art/OrnateDivider.vue'

const store = useWorldAnnouncementStore()

// Typewriter effect - reveals one character per tick rather than CSS steps()
// so Vietnamese diacritics with variable glyph widths advance smoothly.
const TYPE_INTERVAL_MS = 28

const displayedBody = ref('')

let typeTimer: ReturnType<typeof setInterval> | undefined

function stopTyping() {
  if (typeTimer) {
    clearInterval(typeTimer)

    typeTimer = undefined
  }
}

watch(
  () => store.active,
  content => {
    stopTyping()

    displayedBody.value = ''

    if (!content) {
      return
    }

    const full = content.body

    let index = 0

    typeTimer = setInterval(() => {
      index++

      displayedBody.value = full.slice(0, index)

      if (index >= full.length) {
        stopTyping()
      }
    }, TYPE_INTERVAL_MS)
  },
)

// The overlay is ambient and takes no focus - Escape must listen at
// document level (add/remove symmetric across the component lifecycle).
function onEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && store.active) {
    store.hide()
  }
}

document.addEventListener('keydown', onEscapeKey)

onBeforeUnmount(() => {
  stopTyping()

  document.removeEventListener('keydown', onEscapeKey)
})
</script>

<template>
  <Transition name="world-announcement-fade">
    <div
      v-if="store.active"
      class="world-announcement"
      role="alert"
      aria-live="assertive"
      :style="{ zIndex: OVERLAY_LAYERS.announcement }"
      @click="store.hide()"
    >
      <OrnateDialog
        class="world-announcement__content"
        :title="store.active.title"
        badge="info"
        show-close
        width="min(520px, 92vw)"
        @close="store.hide()"
      >
        <OrnateDivider />
        <p class="world-announcement__body">{{ displayedBody }}</p>
      </OrnateDialog>
    </div>
  </Transition>
</template>

<style scoped>
.world-announcement {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim-heavy);
  cursor: pointer;
}

.world-announcement__content {
  flex: none;
}

.world-announcement__content :deep(.ornate-dialog__badge) {
  height: 15cqh;
  margin-top: 0.6%;
}

.world-announcement__body {
  margin: 1cqh 0 0;
  padding: 0 2cqw;
  font-family: var(--font-body);
  font-size: min(3cqh, 17px);
  line-height: 1.65;
  color: var(--paper-text, #302719);
  text-align: center;
  min-height: 3.3em;
}

.world-announcement-fade-enter-active,
.world-announcement-fade-leave-active {
  transition: opacity 0.35s ease;
}

.world-announcement-fade-enter-from,
.world-announcement-fade-leave-to {
  opacity: 0;
}
</style>
