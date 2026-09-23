<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import InkWashBackdrop from '@/components/common/InkWashBackdrop.vue'
import SysPanel from '@/components/common/system/SysPanel.vue'
import { authService } from '@/services/auth/AuthServiceFactory'
import { isValidLoginId, isValidPassword, type AuthenticationMode, type AuthSession } from '@/services/auth/AuthService'

const emit = defineEmits<{ authenticated: [session: AuthSession] }>()
const mode = ref<'login' | 'register'>('login')
const loginId = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')

const { t } = useI18n()

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
  void authenticate(mode.value)
}

// UI-003 (Task 2) — arrow-key tab navigation (WCAG tabs pattern).
function switchTab(target: 'login' | 'register') {
  mode.value = target

  document.getElementById(`auth-tab-${target}`)?.focus()
}
</script>

<template>
  <main class="auth-screen" data-testid="auth-screen">
    <InkWashBackdrop left-mountain bamboo seal="small" :bottom-mist="false" />
    <!-- M-UI-OVERHAUL: the auth card is the T2 console - the ink-wash
         backdrop stays as the painted world behind it. -->
    <SysPanel variant="primary" :rim-active="true" class="auth-card">
      <div class="auth-card__seal" aria-hidden="true">仙</div>
      <p class="auth-card__eyebrow">{{ t('onboarding.auth.eyebrow') }}</p>
      <h1>Tiên Hiệp Idle</h1>
      <p class="auth-card__lead">{{ t('onboarding.auth.lead') }}</p>

      <!-- UI-003/004 (Task 2, 2026-09-07) — tabs semantics thật: role="tab"
           + aria-selected + arrow-key navigation; form errors qua
           aria-invalid/aria-describedby + live region announcement. -->
      <!-- sys-tabs rail: two equal columns, the accent underline slides
           via a pure-CSS translateX on the 50%-wide ink element. -->
      <div class="auth-tabs sys-tabs" role="tablist" :aria-label="t('onboarding.auth.eyebrow')">
        <span
          class="sys-tabs__ink"
          aria-hidden="true"
          :style="{ width: '50%', transform: mode === 'register' ? 'translateX(100%)' : 'translateX(0)' }"
        />
        <button
          id="auth-tab-login"
          role="tab"
          type="button"
          :aria-selected="mode === 'login'"
          :tabindex="mode === 'login' ? 0 : -1"
          :class="['sys-tabs__tab', { 'is-active': mode === 'login' }]"
          @click="mode = 'login'"
          @keydown.right.prevent="switchTab('register')"
        >{{ t('onboarding.auth.tabs.login') }}</button>
        <button
          id="auth-tab-register"
          role="tab"
          type="button"
          :aria-selected="mode === 'register'"
          :tabindex="mode === 'register' ? 0 : -1"
          :class="['sys-tabs__tab', { 'is-active': mode === 'register' }]"
          @click="mode = 'register'"
          @keydown.left.prevent="switchTab('login')"
        >{{ t('onboarding.auth.tabs.register') }}</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label for="auth-input-id">
          <span>{{ t('onboarding.auth.labels.loginId') }}</span>
          <input
            id="auth-input-id"
            v-model.trim="loginId"
            autocomplete="username"
            maxlength="20"
            :placeholder="t('onboarding.auth.placeholders.loginId')"
            :aria-invalid="loginId && !validId ? true : undefined"
            :aria-describedby="loginId && !validId ? 'auth-error-id' : undefined"
          />
        </label>
        <p v-if="loginId && !validId" id="auth-error-id" class="auth-form__hint is-error">{{ t('onboarding.auth.errors.invalidId') }}</p>
        <label for="auth-input-password">
          <span>{{ t('onboarding.auth.labels.password') }}</span>
          <input
            id="auth-input-password"
            v-model="password"
            autocomplete="current-password"
            type="password"
            :placeholder="t('onboarding.auth.placeholders.password')"
          />
        </label>
        <!-- UI-004 — submit-level error là live region (screen reader đọc khi hiện). -->
        <p v-if="error" id="auth-error-submit" class="auth-form__hint is-error" role="alert">{{ error }}</p>
        <GameButton class="primary-action" type="submit" variant="system" size="lg" :disabled="!canSubmit" :loading="submitting">
          {{ mode === 'login' ? t('onboarding.auth.submit.login') : t('onboarding.auth.submit.register') }}
        </GameButton>
      </form>

      <div class="auth-divider"><span>{{ t('onboarding.auth.divider') }}</span></div>
      <GameButton class="guest-action" variant="system" accent-var="var(--sys-text-dim)" size="lg" :disabled="submitting" data-testid="auth-guest-button" @click="authenticate('guest')">
        {{ t('onboarding.auth.guest.button') }}
        <small>{{ t('onboarding.auth.guest.note') }}</small>
      </GameButton>
      <p class="auth-card__status"><i /> {{ t('onboarding.auth.status') }}</p>
    </SysPanel>
  </main>
</template>

<style scoped>
.auth-screen { position: relative; width: 100vw; min-height: 100vh; display: grid; place-items: center; overflow: hidden auto; color: var(--paper-text, #211f1a); background: var(--paper-50, #f5f0e4); }
.auth-screen__mist { position: absolute; width: 42vw; height: 42vw; border-radius: 50%; filter: blur(80px); opacity: .1; background: var(--chrome-500); }
.auth-screen__mist--one { left: -18vw; bottom: -22vw; }.auth-screen__mist--two { right: -20vw; top: -24vw; }
.auth-card { position: relative; z-index: 1; isolation: isolate; width: min(390px, calc(100vw - 40px)); box-sizing: border-box; padding: 34px; text-align: center; }
.auth-card__seal { width: 54px; height: 54px; margin: 0 auto 16px; display: grid; place-items: center; border: 1px solid var(--sys-accent, var(--cinnabar, #b54432)); color: var(--sys-accent, var(--cinnabar, #b54432)); font: 700 var(--text-display) var(--sys-font-display, var(--font-display)); transform: rotate(45deg); box-shadow: 0 0 14px color-mix(in srgb, var(--sys-accent, #b54432) 35%, transparent); }.auth-card__seal::first-letter { transform: rotate(-45deg); }
.auth-card__eyebrow { margin: 0; color: var(--sys-accent, var(--mineral-gold, #b79653)); font-size: var(--text-xs); letter-spacing: .28em; }.auth-card h1 { margin: 8px 0 4px; font: 700 var(--text-display-lg) var(--sys-font-display, var(--font-display)); text-transform: uppercase; letter-spacing: .1em; }.auth-card__lead { margin: 0 0 24px; color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50)); font-family: var(--font-display); font-style: italic; }
.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 20px; }.auth-tabs .sys-tabs__tab { min-height: var(--tap-min); }
.auth-form { display: grid; gap: 14px; text-align: left; }.auth-form label { display: grid; gap: 7px; color: var(--sys-text-muted, var(--paper-text-soft, #5e5a50)); font-size: var(--text-xs); letter-spacing: .06em; text-transform: uppercase; font-family: var(--sys-font-display, var(--font-body)); }.auth-form input { box-sizing: border-box; width: 100%; border: 1px solid var(--sys-line-soft, var(--paper-line, rgba(42,41,36,.42))); border-radius: 0; padding: 12px 13px; outline: none; background: var(--sys-bg-0, color-mix(in srgb, var(--paper-50, #f5f0e4) 86%, transparent)); color: var(--sys-text, var(--paper-text, #211f1a)); clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px); }.auth-form input:focus { border-color: var(--sys-accent, var(--brush-600, #5e5a50)); box-shadow: none; }.auth-form__hint { margin: -8px 0 0; font-size: var(--text-xs); }.is-error { color: var(--sys-danger, var(--cinnabar, #b54432)); }
.primary-action { width: 100%; margin-top: 4px; }.auth-divider { display: flex; align-items: center; gap: 10px; margin: 19px 0; color: var(--sys-text-dim, var(--text-muted)); font-size: var(--text-xs); }.auth-divider::before,.auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--sys-line-soft, var(--ink-line)); }.guest-action { width: 100%; }.guest-action :deep(.game-button__label) { display: grid; gap: 4px; justify-items: center; width: 100%; }.guest-action small { color: var(--sys-text-dim, var(--text-muted)); font-weight: 400; text-transform: none; letter-spacing: normal; }.auth-card__status { margin: 20px 0 0; color: var(--sys-text-dim, var(--text-muted)); font-size: var(--text-xs); }.auth-card__status i { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: var(--sys-success, var(--jade)); box-shadow: 0 0 7px var(--sys-success, var(--jade)); }
</style>
