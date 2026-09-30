<script setup lang="ts">
// BETA-FINAL PR12 / spec B6 - the non-blocking update surface: a slim
// banner over the game when a verified candidate exists or a check/
// download failed retryably. It only renders the sanitized UpdateState
// projection and only calls the allowlisted actions - nothing here can
// reach a feed URL, path or publisher.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActiveUpdates } from '@/composables/useUpdates'
import GameButton from '@/components/common/GameButton.vue'

const { t } = useI18n()
const updates = useActiveUpdates()

const state = computed(() => updates?.state.value ?? null)
const phase = computed(() => state.value?.phase ?? null)

// 'Later' hides the banner for the CURRENT steady phase only: a new phase
// transition (candidate downloaded, a newer check) re-shows it.
const dismissedPhase = ref<string | null>(null)
watch(phase, (next) => {
  if (next !== dismissedPhase.value) dismissedPhase.value = null
})
const dismissed = computed(() => dismissedPhase.value !== null && dismissedPhase.value === phase.value)

const progressPercent = computed(() => Math.round(state.value?.progress?.percent ?? 0))

const visible = computed(() => {
  if (state.value === null || dismissed.value) return false
  switch (phase.value) {
    case 'available':
    case 'downloading':
    case 'downloaded':
    case 'installing':
      return true
    case 'error':
      return state.value?.error?.retryable === true
    default:
      return false
  }
})

const notes = computed(() => state.value?.candidate?.releaseNotes ?? null)

function retry() {
  // A candidate retained across a retryable failure retries the download;
  // no candidate means the failure came from the check itself.
  if (state.value?.candidate !== undefined) updates?.download()
  else updates?.check()
}
</script>

<template>
  <div v-if="visible" class="update-banner" role="status" data-testid="update-banner">
    <template v-if="phase === 'downloading'">
      <span class="update-banner__text">
        {{ t('updates.downloading', { percent: progressPercent }) }}
      </span>
      <div class="update-banner__bar" aria-hidden="true">
        <div class="update-banner__bar-fill" :style="{ width: `${progressPercent}%` }" />
      </div>
      <GameButton size="sm" variant="ghost" @click="updates?.cancelDownload()">{{ t('updates.cancel') }}</GameButton>
    </template>

    <template v-else-if="phase === 'downloaded'">
      <span class="update-banner__text">
        {{ t('updates.ready', { version: state?.candidate?.version }) }}
      </span>
      <GameButton size="sm" variant="primary" @click="updates?.install()">
        {{ t('updates.install') }}
      </GameButton>
      <GameButton size="sm" variant="secondary" @click="dismissedPhase = 'downloaded'">{{ t('updates.later') }}</GameButton>
    </template>

    <template v-else-if="phase === 'installing'">
      <span class="update-banner__text">{{ t('updates.installing') }}</span>
    </template>

    <template v-else-if="phase === 'error'">
      <span class="update-banner__text update-banner__text--error">
        {{ t('updates.failed') }}
      </span>
      <GameButton size="sm" variant="secondary" @click="retry">{{ t('updates.retry') }}</GameButton>
      <GameButton size="sm" variant="ghost" @click="dismissedPhase = 'error'">{{ t('updates.later') }}</GameButton>
    </template>

    <template v-else>
      <span class="update-banner__text">
        {{ t('updates.available', { version: state?.candidate?.version }) }}
      </span>
      <details v-if="notes" class="update-banner__notes">
        <summary>{{ t('updates.notes') }}</summary>
        <p>{{ notes }}</p>
      </details>
      <GameButton size="sm" variant="primary" @click="updates?.download()">
        {{ t('updates.download') }}
      </GameButton>
      <GameButton size="sm" variant="secondary" @click="dismissedPhase = 'available'">{{ t('updates.later') }}</GameButton>
    </template>
  </div>
</template>

<style scoped>
.update-banner {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: min(560px, 92vw);
  padding: 8px 14px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-md);
  background: var(--paper-50);
  color: var(--paper-text);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  z-index: 60;
}

.update-banner__text {
  font-size: var(--text-sm);
}

.update-banner__text--error {
  color: var(--crimson);
}

.update-banner__bar {
  flex: 0 0 140px;
  height: 6px;
  border-radius: 3px;
  background: var(--paper-200);
  overflow: hidden;
}

.update-banner__bar-fill {
  height: 100%;
  background: var(--jade, #2f9e44);
  transition: width 0.2s ease;
}

.update-banner__notes {
  font-size: var(--text-xs);
  color: var(--paper-text-soft);
}

.update-banner__notes p {
  max-height: 120px;
  overflow: auto;
  margin: 6px 0 0;
  white-space: pre-wrap;
}
</style>
