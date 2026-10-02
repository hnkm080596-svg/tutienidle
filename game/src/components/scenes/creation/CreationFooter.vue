<script setup lang="ts">
// Scene 02 footer — draft summary line, ceremonial finish CTA on
// button-ceremonial chrome, gold flourishes flanking it, and the
// post-submit error line (region footer 988/780/564/60).
import GameButton from '@/components/common/GameButton.vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  ready: boolean
  creating: boolean
  summary: string
  error: string
}>()

const emit = defineEmits<{ finish: [] }>()
const { t } = useI18n()
</script>

<template>
  <footer class="creation-footer" data-hk-region="footer">
    <p v-if="error" class="creation-footer__error">{{ error }}</p>
    <p v-if="ready" class="creation-footer__summary" data-testid="creation-summary">{{ summary }}</p>
    <div class="creation-footer__cta">
      <span
        class="creation-footer__flourish creation-footer__flourish--left art-needed"
        data-art-id="creation-cta-flourish"
        aria-hidden="true"
      />
      <GameButton
        variant="primary"
        size="lg"
        :disabled="!ready || creating"
        data-testid="creation-finish"
        data-hk-region="primary-action"
        @click="emit('finish')"
      >
        {{ creating ? t('onboarding.creation.creating') : t('onboarding.creation.finish') }}
      </GameButton>
      <span
        class="creation-footer__flourish creation-footer__flourish--right art-needed"
        data-art-id="creation-cta-flourish"
        aria-hidden="true"
      />
    </div>
  </footer>
</template>

<style scoped>
.creation-footer {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: auto;
  padding-top: clamp(4px, 0.8vh, 8px);
}

.creation-footer__error {
  margin: 0;
  color: var(--hk-cinnabar, #b54432);
  text-align: center;
  font-size: var(--text-xs);
}

.creation-footer__summary {
  margin: 0;
  color: var(--hk-text-secondary, #b8ae97);
  font-size: var(--text-xs);
}

.creation-footer__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
}

/* Gold leaf/lotus flourish flanking the CTA plaque in the ref. */
.creation-footer__flourish {
  width: clamp(30px, 4vw, 46px);
  height: 14px;
  background:
    radial-gradient(60% 100% at 100% 50%, rgba(185, 154, 85, 0.9), transparent 72%),
    linear-gradient(90deg, transparent, #b99a55);
  clip-path: polygon(0 50%, 30% 18%, 66% 0, 100% 50%, 66% 100%, 30% 82%);
  opacity: 0.85;
}

.creation-footer__flourish--right {
  transform: scaleX(-1);
}
</style>
