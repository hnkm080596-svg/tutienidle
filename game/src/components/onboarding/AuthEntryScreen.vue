<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import LoginSceneVista from '@/components/scenes/login/LoginSceneVista.vue'
import LoginAmbientStatus from '@/components/scenes/login/LoginAmbientStatus.vue'
import LoginScrollCard from '@/components/scenes/login/LoginScrollCard.vue'
import LoginLogoBlock from '@/components/scenes/login/LoginLogoBlock.vue'
import LoginLocaleChips from '@/components/scenes/login/LoginLocaleChips.vue'
import LoginNoticeLines from '@/components/scenes/login/LoginNoticeLines.vue'
import AuthModeTabs from '@/components/scenes/login/AuthModeTabs.vue'
import AuthCredentialForm from '@/components/scenes/login/AuthCredentialForm.vue'
import LoginUpgradeSection from '@/components/scenes/login/LoginUpgradeSection.vue'
import AuthDivider from '@/components/scenes/login/AuthDivider.vue'
import AuthSecondaryActions from '@/components/scenes/login/AuthSecondaryActions.vue'
import { authService } from '@/services/auth/AuthServiceFactory'
import { isValidLoginId, isValidPassword, type AuthenticationMode, type AuthSession } from '@/services/auth/AuthService'
import { readResumeCandidate, consumeResetNotice, type ResumeCandidate } from '@/composables/resumeSession'

// Scene 01 composition root: owns the auth flow state and composes the
// per-region scene components (game/src/components/scenes/login/) at the
// layout spec's canonical slots. Presentation lives in the children;
// every functional surface below comes from the existing read-models
// (resumeSession / authService / locale composable) - no invented data.
const emit = defineEmits<{ authenticated: [session: AuthSession] }>()
const mode = ref<'login' | 'register'>('login')
const loginId = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')

const { t } = useI18n()

// ui-audit creation-meta - reload forced a full re-login even when a
// session/save was still on disk; offer one-click continue instead.
// B1.8: async now - the first probe hydrates the OS-protected durable
// guest credential (Electron process restart); a failed store surfaces
// as durableError, a recovery notice rather than a silent fresh signup.
const resume = ref<ResumeCandidate | null>(null)
const resumeReady = ref(false)
onMounted(async () => {
  resume.value = await readResumeCandidate()
  resumeReady.value = true
})

// ui-audit creation-meta Low - after a save reset the app reloads onto
// this card; one line of continuity beats silently starting over.
const resetNotice = consumeResetNotice()

// B1.8 - guest-account surfaces: the stored guest session offers an
// upgrade path distinct from the login/register tabs (the separate,
// explicit switch for an existing account). A pending upgrade replays
// its pending-confirm state here.
const storedGuestSession = computed(() =>
  resume.value?.stored && resume.value.session.mode === 'guest' ? resume.value : null,
)

// B1.8 cross-account law: signing into a different account while a guest
// session exists is a blocking conflict state - the submit is held until
// the user explicitly acknowledges the switch. Never a merge/transfer.
const crossAccountAck = ref<(() => void) | null>(null)

function requireAccountSwitchAck(action: () => void) {
  if (storedGuestSession.value) {
    crossAccountAck.value = () => {
      crossAccountAck.value = null
      action()
    }
    return
  }
  action()
}

async function continueSaved() {
  const candidate = resume.value
  if (!candidate || submitting.value) return

  submitting.value = true
  error.value = ''

  if (candidate.stored) {
    // Stored Supabase session: the explicit take-back path - refresh the
    // credential, claim a fresh active game session (a revoked game
    // session never loops here; the user's Continue IS the claim), and
    // replay any pending upgrade finalization.
    const result = await authService.resumeStoredSession()
    if (!result.ok) {
      submitting.value = false
      error.value = result.message
      return
    }
    emit('authenticated', result.session)
    return
  }

  // Synthetic local-save guest session (same shape MockAuthService mints).
  emit('authenticated', candidate.session)
}

const validId = computed(() => isValidLoginId(loginId.value))
const canSubmit = computed(() => validId.value && isValidPassword(password.value) && !submitting.value)

async function authenticate(authenticationMode: AuthenticationMode) {
  if (submitting.value) return
  if (authenticationMode !== 'guest' && !canSubmit.value) return

  submitting.value = true
  error.value = ''
  const result = await authService.authenticate(
    authenticationMode,
    authenticationMode === 'guest' ? undefined : { loginId: loginId.value, password: password.value },
  )

  if (!result.ok) {
    submitting.value = false
    error.value = result.message
    return
  }

  // Keep the busy state until the curtain transition unmounts this screen -
  // the save load and scene swap now run while the auth screen is still
  // displayed, and the spinner is the feedback for that window.
  emit('authenticated', result.session)
}

function submit() {
  if (!canSubmit.value) return
  requireAccountSwitchAck(() => void authenticate(mode.value))
}

/** A NEW guest signup while a stored guest session exists abandons the
 *  old identity - same blocking acknowledgement as an account switch. */
function startGuest() {
  requireAccountSwitchAck(() => void authenticate('guest'))
}
</script>

<template>
  <main class="auth-screen" data-testid="auth-screen" data-hk-scene="login">
    <LoginSceneVista />
    <LoginAmbientStatus />

    <LoginScrollCard>
      <LoginLocaleChips />
      <LoginLogoBlock />
      <LoginNoticeLines :reset-notice="resetNotice" :credential-error="Boolean(resume?.durableError)" />
      <AuthModeTabs v-model="mode" />
      <AuthCredentialForm
        v-model:login-id="loginId"
        v-model:password="password"
        :mode="mode"
        :can-submit="canSubmit"
        :submitting="submitting"
        :error="error"
        @submit="submit"
      />
      <LoginUpgradeSection :resume-ready="resumeReady" :stored-guest-session="storedGuestSession" />
      <AuthDivider />
      <AuthSecondaryActions
        :resume="resume"
        :resume-ready="resumeReady"
        :submitting="submitting"
        @continue="continueSaved"
        @guest="startGuest"
      />
    </LoginScrollCard>

    <!-- B1.8 cross-account acknowledgement: leaving the stored guest
         session is an explicit user choice, never automatic. -->
    <ConfirmModal
      :open="crossAccountAck !== null"
      :title="t('onboarding.auth.crossAccount.title')"
      :message="t('onboarding.auth.crossAccount.body')"
      :confirm-label="t('onboarding.auth.crossAccount.confirm')"
      @confirm="crossAccountAck?.()"
      @cancel="crossAccountAck = null"
    />
  </main>
</template>

<style scoped>
/* Scene 01 spec: vista dominant; auth scroll card right-of-center. */
.auth-screen {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  display: grid;
  justify-items: end;
  align-items: center;
  overflow: hidden auto;
  color: var(--paper-text, #211f1a);
  background: var(--hk-surface-base, #0b0f0d);
}
@media (max-width: 900px) {
  .auth-screen {
    justify-items: center;
  }
}
</style>
