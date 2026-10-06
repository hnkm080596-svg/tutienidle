<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import LoginLocaleChips from '@/components/scenes/login/LoginLocaleChips.vue'
import AuthCredentialForm from '@/components/scenes/login/AuthCredentialForm.vue'
import LoginUpgradeSection from '@/components/scenes/login/LoginUpgradeSection.vue'
import LoginOpening from '@/components/scenes/login/LoginOpening.vue'
import LoginSideDrawer from '@/components/scenes/login/LoginSideDrawer.vue'
import LoginSettingsContent from '@/components/scenes/login/LoginSettingsContent.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import '@/assets/tien-hiep-entry.css'
import { authService } from '@/services/auth/AuthServiceFactory'
import { isValidLoginId, isValidPassword, type AuthenticationMode, type AuthSession } from '@/services/auth/AuthService'
import { readResumeCandidate, consumeResetNotice, type ResumeCandidate } from '@/composables/resumeSession'

// Scene 01 composition root: owns auth flow state and composes the
// reference-led scene regions. Presentation lives in the children;
// every functional surface below comes from the existing read-models
// (resumeSession / authService / locale composable) - no invented data.
const emit = defineEmits<{ authenticated: [session: AuthSession] }>()
const mode = ref<'login' | 'register'>('login')
const loginId = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')
const drawer = shallowRef<'auth' | 'settings' | 'exit' | null>(null)
const exited = ref(false)

function confirmExit() {
  drawer.value = null
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    // Electron: window close runs through the quit-flush interceptor, so
    // pending saves flush before the app actually exits.
    window.close()
    return
  }
  exited.value = true
}

function revealAuthentication(nextMode: 'login' | 'register') {
  if (submitting.value) return
  mode.value = nextMode
  error.value = ''
  drawer.value = 'auth'
}

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

function playOrContinue() {
  if (!resumeReady.value || submitting.value) return
  if (resume.value) void continueSaved()
  else startGuest()
}
</script>

<template>
  <main class="auth-screen th-entry-scene" data-testid="auth-screen" data-hk-scene="login">
    <section v-if="exited" class="auth-exited" data-testid="auth-exited">
      <h2>{{ t('onboarding.auth.exit.exited') }}</h2>
      <PcPaperButton data-testid="auth-exit-return" @click="exited = false">{{ t('onboarding.auth.exit.return') }}</PcPaperButton>
    </section>
    <LoginOpening v-else :resume-available="Boolean(resume)" :ready="resumeReady" :busy="submitting" :error="drawer === null ? error : ''"
      @authenticate="revealAuthentication" @play="playOrContinue" @settings="drawer = 'settings'" @exit="drawer = 'exit'" />
    <LoginSideDrawer :open="drawer !== null" :busy="submitting" :title="drawer === 'settings' ? t('paperNav.settings') : drawer === 'exit' ? t('onboarding.auth.exit.title') : t(`onboarding.auth.tabs.${mode}`)" @close="drawer = null">
      <template v-if="drawer === 'auth'">
      <AuthCredentialForm
        v-model:login-id="loginId"
        v-model:password="password"
        :mode="mode"
        :can-submit="canSubmit"
        :submitting="submitting"
        :error="error"
        :reset-notice="resetNotice"
        :credential-error="Boolean(resume?.durableError)"
        @submit="submit"
      />
      <LoginUpgradeSection :resume-ready="resumeReady" :stored-guest-session="storedGuestSession" />
      <LoginLocaleChips />
      </template>
      <LoginSettingsContent v-else-if="drawer === 'settings'" />
      <section v-else-if="drawer === 'exit'" class="auth-exit-confirm">
        <p>{{ t('onboarding.auth.exit.question') }}</p>
        <div class="auth-exit-confirm__actions">
          <PcPaperButton variant="secondary" data-testid="auth-exit-cancel" @click="drawer = null">{{ t('onboarding.auth.exit.cancel') }}</PcPaperButton>
          <PcPaperButton data-testid="auth-exit-confirm" @click="confirmExit">{{ t('onboarding.auth.exit.confirm') }}</PcPaperButton>
        </div>
      </section>
    </LoginSideDrawer>

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
  width: 100%;
  min-height: 100%;
  display: grid;
  justify-items: end;
  align-items: center;
  overflow: hidden auto;
  color: var(--paper-text, #211f1a);
}
.auth-exited { position: absolute; left: 480px; top: 315px; width: 530px; padding: 35px; text-align: center; background: #f5e6c9eb; border: 3px double #aa8645; }
.auth-exited h2 { margin: 0 0 25px; font-size: 28px; }
.auth-exit-confirm p { font-size: 23px; margin: 0 0 18px; }
.auth-exit-confirm__actions { display: flex; gap: 14px; }
.auth-exit-confirm__actions .pc-paper-button { flex: 1; }
</style>
