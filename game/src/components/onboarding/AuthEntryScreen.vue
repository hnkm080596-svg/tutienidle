<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import HuyenKimParallaxStack from '@/components/common/HuyenKimParallaxStack.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import GuestUpgradeCard from './GuestUpgradeCard.vue'
import { authService } from '@/services/auth/AuthServiceFactory'
import { isValidLoginId, isValidPassword, type AuthenticationMode, type AuthSession } from '@/services/auth/AuthService'
import { LOCALE_OPTIONS, saveLocale } from '@/composables/locale'
import { readResumeCandidate, consumeResetNotice, type ResumeCandidate } from '@/composables/resumeSession'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const emit = defineEmits<{ authenticated: [session: AuthSession] }>()
const mode = ref<'login' | 'register'>('login')
const loginId = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')

const { t, locale } = useI18n()
const dividerOrnamentUrl = hkChromeUrl('divider-ornament')

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
const showUpgrade = ref(false)
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

// UI-003 (Task 2) — arrow-key tab navigation (WCAG tabs pattern).
function switchTab(target: 'login' | 'register') {
  mode.value = target

  document.getElementById(`auth-tab-${target}`)?.focus()
}
</script>

<template>
  <main class="auth-screen" data-testid="auth-screen" data-hk-scene="login">
    <HuyenKimParallaxStack stack="auth-creation" />
    <section class="auth-card" data-hk-region="auth-card">
      <InkNineSlice chrome-id="surface-xl-scroll" layer="surface" />
      <InkNineSlice chrome-id="frame-xl-ceremony" layer="frame" />
      <div class="auth-card__seal">仙</div>
      <!-- Language switch is reachable BEFORE auth: same chips idiom as
           SettingsPanel; persists via composables/locale. -->
      <div class="auth-locale" :aria-label="t('onboarding.auth.language')">
        <button
          v-for="option in LOCALE_OPTIONS"
          :key="option"
          type="button"
          class="auth-locale__option"
          :class="{ active: locale === option }"
          :data-testid="`auth-locale-${option}`"
          @click="saveLocale(option)"
        >
{{ t(`panels.settings.language.names.${option}`) }}
</button>
      </div>

      <p class="auth-card__eyebrow">{{ t('onboarding.auth.eyebrow') }}</p>
      <h1>Tiên Hiệp Idle</h1>
      <p v-if="resetNotice" class="auth-card__notice">{{ t('onboarding.auth.saveCleared') }}</p>

      <!-- UI-003/004 (Task 2, 2026-09-07) — tabs semantics thật: role="tab"
           + aria-selected + arrow-key navigation; form errors qua
           aria-invalid/aria-describedby + live region announcement. -->
      <!-- B1.8 - durable guest recovery error: the OS-protected credential
           exists but could not be read; sign-in stays available but the
           store failure is surfaced, never silently bypassed. -->
      <p v-if="resume?.durableError" class="auth-card__notice is-error" role="alert" data-testid="auth-credential-error">
        {{ t('onboarding.auth.credentialError') }}
      </p>

      <GameButton
        v-if="resumeReady && resume"
        class="continue-action"
        variant="primary"
        size="lg"
        :disabled="submitting"
        :loading="submitting"
        data-testid="auth-continue-button"
        @click="continueSaved"
      >
        {{ resume.name ? t('onboarding.auth.continue', { name: resume.name }) : t('onboarding.auth.continueNoName') }}
      </GameButton>

      <!-- B1.8 guest-account surface: pending-confirm replay or the
           upgrade entry - kept apart from the login/register tabs, which
           are the separate explicit switch to an existing account. -->
      <GuestUpgradeCard
        v-if="resumeReady && (storedGuestSession?.pendingUpgradeLoginId || showUpgrade)"
        :pending-login-id="storedGuestSession?.pendingUpgradeLoginId"
        @finalized="showUpgrade = false"
      />
      <button
        v-else-if="resumeReady && storedGuestSession"
        type="button"
        class="auth-card__upgrade-link"
        data-testid="auth-upgrade-link"
        @click="showUpgrade = true"
      >
{{ t('onboarding.auth.upgradeLink') }}
</button>

      <div class="auth-tabs" role="tablist" :aria-label="t('onboarding.auth.eyebrow')">
        <button
          id="auth-tab-login"
          role="tab"
          type="button"
          :aria-selected="mode === 'login'"
          :tabindex="mode === 'login' ? 0 : -1"
          :class="{ active: mode === 'login' }"
          @click="mode = 'login'"
          @keydown.right.prevent="switchTab('register')"
        >
{{ t('onboarding.auth.tabs.login') }}
</button>
        <button
          id="auth-tab-register"
          role="tab"
          type="button"
          :aria-selected="mode === 'register'"
          :tabindex="mode === 'register' ? 0 : -1"
          :class="{ active: mode === 'register' }"
          @click="mode = 'register'"
          @keydown.left.prevent="switchTab('login')"
        >
{{ t('onboarding.auth.tabs.register') }}
</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label for="auth-input-id">
          <span>{{ t('onboarding.auth.labels.loginId') }}</span>
          <span class="auth-field">
            <InkNineSlice chrome-id="text-field" layer="surface" />
            <input
              id="auth-input-id"
              v-model.trim="loginId"
              autocomplete="username"
              maxlength="20"
              :placeholder="t('onboarding.auth.placeholders.loginId')"
              :aria-invalid="loginId && !validId ? true : undefined"
              :aria-describedby="loginId && !validId ? 'auth-error-id' : undefined"
            />
          </span>
        </label>
        <p v-if="loginId && !validId" id="auth-error-id" class="auth-form__hint is-error">{{ t('onboarding.auth.errors.invalidId') }}</p>
        <label for="auth-input-password">
          <span>{{ t('onboarding.auth.labels.password') }}</span>
          <span class="auth-field">
            <InkNineSlice chrome-id="text-field" layer="surface" />
            <input
              id="auth-input-password"
              v-model="password"
              autocomplete="current-password"
              type="password"
              :placeholder="t('onboarding.auth.placeholders.password')"
            />
          </span>
        </label>
        <!-- UI-004 — submit-level error là live region (screen reader đọc khi hiện). -->
        <p v-if="error" id="auth-error-submit" class="auth-form__hint is-error" role="alert">{{ error }}</p>
        <GameButton class="primary-action" type="submit" variant="primary" size="lg" :disabled="!canSubmit" :loading="submitting" data-hk-region="primary-action">
          {{ mode === 'login' ? t('onboarding.auth.submit.login') : t('onboarding.auth.submit.register') }}
        </GameButton>
      </form>

      <div class="auth-divider">
        <img v-if="dividerOrnamentUrl" :src="dividerOrnamentUrl" alt="" aria-hidden="true" />
        <span>{{ t('onboarding.auth.divider') }}</span>
      </div>
      <GameButton class="guest-action" variant="ghost" size="lg" :disabled="submitting" data-testid="auth-guest-button" data-hk-region="guest-action" @click="startGuest">
        {{ t('onboarding.auth.guest.button') }}
        <small>{{ t('onboarding.auth.guest.note') }}</small>
      </GameButton>
    </section>
    <!-- Server-status indicator is ambient dev info, not card content:
         it sits on the vista corner outside the scroll. -->
    <p class="auth-status"><i /> {{ t('onboarding.auth.status') }}</p>

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
/* Scene 01 spec: vista dominant; auth scroll card right-of-center.
   Design 1672x941: card x=1016 w=560 h=700 -> 5.7% right margin,
   ~33.5% width, ~74% height centered. Recenters at <=1400px. */
.auth-screen { position: relative; width: 100vw; min-height: 100vh; display: grid; justify-items: end; align-items: center; overflow: hidden auto; color: var(--paper-text, #211f1a); background: var(--paper-50, #f5f0e4); }
.auth-screen::before { content: ''; position: absolute; inset: 0; z-index: 1; opacity: .1; background-image: linear-gradient(color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(circle, #000, transparent 72%); }
.auth-screen__mist { position: absolute; width: 42vw; height: 42vw; border-radius: 50%; filter: blur(80px); opacity: .1; background: var(--chrome-500); }
.auth-screen__mist--one { left: -18vw; bottom: -22vw; }.auth-screen__mist--two { right: -20vw; top: -24vw; }
/* surface-xl-scroll's frame occupies ~12% of each side and ~15% top/
   bottom at this size; padding keeps all interactive content inside the
   paper's inner safe area. */
.auth-card { position: relative; z-index: 1; isolation: isolate; width: clamp(430px, 33.5vw, 560px); max-height: 88vh; margin-right: clamp(20px, 5.7vw, 96px); box-sizing: border-box; padding: clamp(50px, 7.6vh, 80px) clamp(64px, 6vw, 88px); border-radius: 0; background: transparent; box-shadow: none; text-align: center; overflow-y: auto; scrollbar-width: none; }
.auth-card::-webkit-scrollbar { display: none; }
@media (max-width: 900px) {
  .auth-screen { justify-items: center; }
  .auth-card { margin-right: 0; width: min(560px, calc(100vw - 40px)); }
}
.auth-card > :not(.ink-nine-slice) { position: relative; z-index: 3; }
.auth-card__seal { width: 38px; height: 38px; margin: 0 auto 6px; display: grid; place-items: center; border: 1px solid var(--cinnabar, #b54432); color: var(--cinnabar, #b54432); font: 700 var(--text-md) var(--font-display); transform: rotate(45deg); }.auth-card__seal::first-letter { transform: rotate(-45deg); }
.auth-card__eyebrow { margin: 0; color: var(--mineral-gold, #b79653); font-size: var(--text-xs); letter-spacing: .28em; }.auth-card h1 { margin: 4px 0 8px; font: 700 var(--text-panel-title) var(--font-display); }
.auth-locale { display: flex; justify-content: flex-end; gap: 6px; margin-bottom: 8px; }.auth-locale__option { min-height: 32px; padding: 4px 10px; border: 1px solid var(--paper-line, rgba(42,41,36,.42)); border-radius: var(--radius-sm, 2px); background: transparent; color: var(--paper-text-muted, #6b6860); font-size: var(--text-xs); letter-spacing: .08em; cursor: pointer; }.auth-locale__option.active { border-color: var(--mineral-gold, #b79653); color: var(--paper-text, #211f1a); }.auth-locale__option:hover { border-color: var(--mineral-gold, #b79653); }
.continue-action { width: 100%; margin-bottom: 16px; }
.auth-card__notice { margin: 8px 0 14px; padding: 6px 10px; border: 1px solid var(--paper-line, rgba(42,41,36,.42)); border-radius: var(--radius-sm, 2px); color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); }
.auth-card__notice.is-error { border-color: var(--cinnabar, #b54432); color: var(--cinnabar, #b54432); }
.auth-card__upgrade-link { margin: 0 0 16px; border: 0; background: none; padding: 0; color: var(--paper-text-muted, #6b6860); font-size: var(--text-xs); text-decoration: underline; cursor: pointer; }
.auth-card__upgrade-link:hover { color: var(--mineral-gold, #b79653); }
.auth-card :deep(.upgrade-card) { margin: 0 0 16px; padding: 10px 12px; border: 1px solid var(--paper-line, rgba(42,41,36,.42)); border-radius: var(--radius-sm, 2px); }
.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--ink-line); margin-bottom: 14px; }.auth-tabs button { border: 0; padding: 8px 10px; min-height: var(--tap-min); background: none; color: var(--text-muted); cursor: pointer; }.auth-tabs button.active { color: var(--paper-text, #211f1a); border-bottom: 2px solid var(--cinnabar, #b54432); }
.auth-form { display: grid; gap: 8px; text-align: left; }.auth-form label { display: grid; gap: 4px; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); }
/* text-field chrome: the PNG field background owns the box; the input
   itself stays transparent. */
.auth-field { position: relative; display: block; isolation: isolate; }
.auth-field .ink-nine-slice { z-index: 0; }
.auth-form input { position: relative; z-index: 1; box-sizing: border-box; width: 100%; border: 0; border-radius: 2px; padding: 10px 16px; outline: none; background: transparent; color: var(--hk-text-primary, #ede6d6); }
.auth-form input::placeholder { color: color-mix(in srgb, var(--hk-text-primary, #ede6d6) 42%, transparent); }
.auth-form input:focus { box-shadow: 0 0 0 2px color-mix(in srgb, var(--hk-gold, #c99a4a) 45%, transparent); }.auth-form__hint { margin: -8px 0 0; font-size: var(--text-xs); }.is-error { color: var(--cinnabar, #b54432); }
.primary-action { width: 100%; margin-top: 2px; }.auth-divider { position: relative; display: grid; place-items: center; margin: 10px 0; color: var(--text-muted); font-size: var(--text-xs); }.auth-divider img { position: absolute; inset: 50% 0 auto; width: 100%; height: 14px; transform: translateY(-50%); object-fit: fill; opacity: .9; pointer-events: none; }.auth-divider span { position: relative; padding: 0 10px; background: var(--paper-50, #f5f0e4); }.guest-action { width: 100%; }.guest-action :deep(.game-button__label) { display: grid; gap: 2px; justify-items: center; width: 100%; }.guest-action small { color: var(--text-muted); font-weight: 400; }.auth-status { position: absolute; left: 14px; bottom: 12px; z-index: 1; margin: 0; color: var(--hk-text-primary, #ede6d6); font-size: var(--text-xs); opacity: .75; text-shadow: 0 1px 3px rgba(0,0,0,.6); }.auth-status i { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: var(--jade); box-shadow: 0 0 7px var(--jade); }
</style>
