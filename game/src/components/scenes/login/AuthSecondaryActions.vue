<script setup lang="ts">
// Scene 01 secondary-actions region (spec: 1048/644/496/120, gap 12,
// button-standard family). Ref pair: "Tiep Tuc" (clock glyph) +
// "Choi Khach" (lotus glyph). Visibility: resume only when a saved
// session exists; guest always present.
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import type { ResumeCandidate } from '@/composables/resumeSession'

defineProps<{
  resume: ResumeCandidate | null
  resumeReady: boolean
  submitting: boolean
}>()

const emit = defineEmits<{ continue: []; guest: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="auth-secondary" data-hk-region="secondary-actions">
    <GameButton
      v-if="resumeReady && resume"
      class="auth-secondary__action"
      variant="secondary"
      size="md"
      :disabled="submitting"
      :loading="submitting"
      data-testid="auth-continue-button"
      @click="emit('continue')"
    >
      <span class="auth-secondary__icon art-needed" data-art-id="login-icon-clock" aria-hidden="true" />
      {{ resume.name ? t('onboarding.auth.continue', { name: resume.name }) : t('onboarding.auth.continueNoName') }}
    </GameButton>
    <GameButton
      class="auth-secondary__action"
      variant="secondary"
      size="md"
      :disabled="submitting"
      data-testid="auth-guest-button"
      data-hk-region="guest-action"
      @click="emit('guest')"
    >
      <span class="auth-secondary__icon auth-secondary__icon--lotus art-needed" data-art-id="login-icon-lotus" aria-hidden="true" />
      <span class="auth-secondary__label">
        {{ t('onboarding.auth.guest.button') }}
        <small>{{ t('onboarding.auth.guest.note') }}</small>
      </span>
    </GameButton>
  </div>
</template>

<style scoped>
/* Ref pair: two equal ornate buttons side by side. */
.auth-secondary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.auth-secondary__action {
  width: 100%;
  min-height: 44px;
}
.auth-secondary__label {
  position: relative;
  z-index: 3;
  display: grid;
  gap: 2px;
  justify-items: center;
}
.auth-secondary__label small {
  color: var(--hk-text-secondary, #b8ae97);
  font-weight: 400;
}
/* One-button row (no resume candidate): guest spans the region. */
.auth-secondary__action:only-child {
  grid-column: 1 / -1;
}

/* TEMP ART (art-needed) - icon-set gaps. */
.art-needed {
  outline: 1px dashed color-mix(in srgb, #b99a55 65%, transparent);
  outline-offset: -1px;
}
.auth-secondary__icon {
  position: relative;
  z-index: 3;
  display: inline-block;
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
}
/* Clock glyph: gold ring + hands. */
.auth-secondary__icon:not(.auth-secondary__icon--lotus) {
  border: 1.5px solid #b99a55;
  border-radius: 50%;
}
.auth-secondary__icon:not(.auth-secondary__icon--lotus)::before,
.auth-secondary__icon:not(.auth-secondary__icon--lotus)::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  background: #b99a55;
  transform-origin: left center;
}
.auth-secondary__icon:not(.auth-secondary__icon--lotus)::before {
  width: 1.5px;
  height: 5px;
  transform: translate(-50%, -100%);
}
.auth-secondary__icon:not(.auth-secondary__icon--lotus)::after {
  width: 4px;
  height: 1.5px;
  transform: translateY(-50%) rotate(-35deg);
}
/* Lotus glyph: three jade petals. */
.auth-secondary__icon--lotus {
  background:
    radial-gradient(45% 60% at 50% 68%, #315f55 60%, transparent 62%),
    radial-gradient(45% 60% at 22% 78%, #315f55 60%, transparent 62%),
    radial-gradient(45% 60% at 78% 78%, #315f55 60%, transparent 62%);
  filter: drop-shadow(0 0 3px rgba(63, 166, 139, 0.45));
}
</style>
