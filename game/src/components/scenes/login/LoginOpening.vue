<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import LoginLogoBlock from './LoginLogoBlock.vue'
defineProps<{ resumeAvailable: boolean; ready: boolean; busy: boolean; error: string }>()
const emit = defineEmits<{ authenticate: [mode: 'login' | 'register']; play: []; settings: []; exit: [] }>()
const { t } = useI18n()
</script>

<template>
  <section class="login-opening" data-testid="login-opening">
    <LoginLogoBlock />
    <nav class="login-opening__actions" :aria-label="t('onboarding.auth.eyebrow')">
      <PcPaperButton variant="secondary" data-testid="opening-login-button" :disabled="busy" @click="emit('authenticate', 'login')">{{ t('onboarding.auth.tabs.login') }}</PcPaperButton>
      <PcPaperButton variant="secondary" data-testid="opening-register-button" :disabled="busy" @click="emit('authenticate', 'register')">{{ t('onboarding.auth.createAccount') }}</PcPaperButton>
      <PcPaperButton variant="secondary" :data-testid="resumeAvailable ? 'auth-continue-button' : 'auth-guest-button'" :disabled="busy || !ready" :aria-busy="busy" @click="emit('play')">{{ resumeAvailable ? t('onboarding.auth.continueNoName') : t('onboarding.auth.guest.button') }}</PcPaperButton>
      <PcPaperButton variant="secondary" data-testid="opening-settings-button" :disabled="busy" @click="emit('settings')">{{ t('paperNav.settings') }}</PcPaperButton>
      <PcPaperButton variant="secondary" data-testid="opening-exit-button" :disabled="busy" @click="emit('exit')">{{ t('onboarding.auth.exit.title') }}</PcPaperButton>
      <p v-if="error" class="login-opening__error" role="alert">{{ error }}</p>
    </nav>
  </section>
</template>

<style scoped>
.login-opening { position: absolute; inset: 0; display: grid; align-content: start; justify-items: center; padding: 62px 96px; }
.login-opening :deep(.login-logo) { width: 560px; }
/* z-index above .login-drawer-layer (10): nav buttons stay clickable while a
   drawer is open, so switching tabs swaps drawer content in place instead of
   hitting the scrim (close -> reopen). */
/* gap 17px -> 2px is part of the owner ruling (same 2026-10-10 message:
   "cho cac nut gan nhau h" - pull the menu buttons closer together); the
   box-shadow on these buttons was dropped under the same ruling (no
   transparent frame around the pill art). */
.login-opening__actions { position: absolute; left: 566px; top: 295px; width: 310px; display: grid; gap: 2px; z-index: 11; }
.login-opening__actions .pc-paper-button { width: 100%; min-height: 68px; color: #f5e6c6; font: 600 27px var(--font-display, Georgia, serif); }
/* Owner ruling 2026-10-10: the menu buttons wear the in-game enhance
   button's art (equipment-filter-* pill) - art-only swap, the paper
   nine-slice border-image is replaced, logic untouched.
   #app anchor (1,2,1): tien-hiep-entry.css re-arms border-image-source on
   :is(#app,body) .th-entry-scene .pc-paper-button:hover::before at (1,1,1). */
#app .login-opening__actions .pc-paper-button::before { border: 0; border-image: none; background: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-normal-v2.png') center / 100% 100% no-repeat; }
/* Hover takes the clean gold pill (equipment-filter-selected) - the
   stock hover art bakes a black smoke fill over the label, which read
   as a dark blob covering the text on this bright backdrop. */
/* QA fixpoint 2026-10-10: #app anchor needed here too - the entry
   recipe's (1,4,0) hover color would otherwise shadow this rule. */
#app .login-opening__actions .pc-paper-button:not(:disabled):is(:hover, :focus-visible) { color: #30210e; }
/* --secondary + filter:none: the entry recipe (1,4,1) still arms a
   brightness/saturate/drop-shadow filter on hover - kill it so the art
   reads identical to the in-game pill (QA fixpoint 2026-10-10). */
#app .login-opening__actions .pc-paper-button--secondary:not(:disabled):is(:hover, :focus-visible)::before { border-image: none; background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-selected-v2.png'); filter: none; }
#app .login-opening__actions .pc-paper-button--secondary:not(:disabled):active::before { border-image: none; background-image: url('/assets/ui/tien-hiep-2026-10/controls/equipment-filter-pressed-v2.png'); filter: none; }
.login-opening__actions .pc-paper-button:focus-visible { outline: 3px solid #836126; outline-offset: 5px; }
.login-opening__actions .pc-paper-button:disabled { opacity: .6; cursor: wait; }
.login-opening__error { color: #983a23; background: #f5ead6e6; padding: 10px; margin: 0; font-size: 17px; }
</style>
