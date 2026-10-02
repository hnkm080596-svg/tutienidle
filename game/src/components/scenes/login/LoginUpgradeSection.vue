<script setup lang="ts">
// Scene 01 upgrade-card region (spec: 1048/468/496/~140, conditional -
// guest session only, shell-panel family). B1.8 guest-account surface:
// pending-confirm replay or the upgrade entry, kept apart from the
// login/register tabs (the explicit switch to an existing account).
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GuestUpgradeCard from '@/components/onboarding/GuestUpgradeCard.vue'
import type { ResumeCandidate } from '@/composables/resumeSession'

const props = defineProps<{
  resumeReady: boolean
  storedGuestSession: ResumeCandidate | null
}>()

const { t } = useI18n()
const showUpgrade = ref(false)
</script>

<template>
  <div v-if="resumeReady && props.storedGuestSession" class="login-upgrade" data-hk-region="upgrade-card">
    <GuestUpgradeCard
      v-if="props.storedGuestSession.pendingUpgradeLoginId || showUpgrade"
      :pending-login-id="props.storedGuestSession.pendingUpgradeLoginId"
      @finalized="showUpgrade = false"
    />
    <button
      v-else
      type="button"
      class="login-upgrade__link"
      data-testid="auth-upgrade-link"
      @click="showUpgrade = true"
    >
      {{ t('onboarding.auth.upgradeLink') }}
    </button>
  </div>
</template>

<style scoped>
/* Spec upgrade-card 1048/468/496/~140: anchored inside the card's
   content band (content top = card 120 + 32 pad -> y152; 468-152=316
   design px -> 33.58vh), NOT in-flow - in-flow it landed ~y608 and
   pushed divider/secondary +140 past spec. */
.login-upgrade {
  position: absolute;
  top: 33.58vh;
  left: 0;
  right: 0;
  z-index: 5;
  max-height: 14.88vh;
  overflow: hidden;
  text-align: left;
}
.login-upgrade :deep(.upgrade-card) {
  padding: 10px 12px;
  border: 1px solid var(--paper-line, rgba(42, 41, 36, 0.42));
  border-radius: var(--radius-sm, 2px);
  /* Spec band overlaps the form's tail - the panel must carry its own
     opaque paper surface so the fields beneath never show through. */
  background: var(--paper-100, #efe8d5);
}
.login-upgrade__link {
  display: block;
  margin: 0 auto;
  border: 0;
  background: none;
  padding: 0;
  color: var(--paper-text-muted, #6b6860);
  font-size: var(--text-xs);
  text-decoration: underline;
  cursor: pointer;
}
.login-upgrade__link:hover {
  color: var(--mineral-gold, #b79653);
}
</style>
