<script setup lang="ts">
import { ref, watch } from 'vue'
import { useWorldAnnouncementStore } from '@/stores/worldAnnouncement'

const store = useWorldAnnouncementStore()

// Hiệu ứng typewriter — gõ từng ký tự thay vì CSS steps() (chữ có
// dấu tiếng Việt độ rộng không đều, JS interval an toàn hơn CSS
// width-reveal theo số ký tự cố định).
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
</script>

<template>
  <Transition name="world-announcement-fade">
    <div v-if="store.active" class="world-announcement" @click="store.hide()">
      <div class="world-announcement__content">
        <h2 class="world-announcement__title">{{ store.active.title }}</h2>

        <p class="world-announcement__body">{{ displayedBody }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.world-announcement {
  /* KHÔNG dùng position:fixed — component này KHÔNG Teleport, render
     thẳng trong .game-root nên absolute để phủ đúng vùng container
     game, không neo theo viewport trình duyệt thật. */
  position: absolute;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--scrim-heavy);
  cursor: pointer;
}

.world-announcement__content {
  max-width: 640px;
  padding: 0 32px;
  text-align: center;
}

.world-announcement__title {
  margin: 0 0 16px;
  font-family: var(--font-display);
  font-size: var(--text-display-lg);
  letter-spacing: 0.08em;
  color: var(--chrome-100);
  text-shadow: 0 0 24px color-mix(in srgb, var(--chrome-100) 50%, transparent);
}

.world-announcement__body {
  margin: 0;
  min-height: 1.6em;
  font-family: var(--font-body);
  font-size: var(--text-lg);
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-line;
}

.world-announcement-fade-enter-active,
.world-announcement-fade-leave-active {
  transition: opacity 0.3s ease;
}

.world-announcement-fade-enter-from,
.world-announcement-fade-leave-to {
  opacity: 0;
}
</style>
