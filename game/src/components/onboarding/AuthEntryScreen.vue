<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import InkWashBackdrop from '@/components/common/InkWashBackdrop.vue'
import InkNineSlice from '@/components/common/primitives/InkNineSlice.vue'
import { authService } from '@/services/auth/AuthServiceFactory'
import { isValidLoginId, isValidPassword, type AuthenticationMode } from '@/services/auth/AuthService'

const emit = defineEmits<{ authenticated: [mode: AuthenticationMode] }>()
const mode = ref<'login' | 'register'>('login')
const loginId = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')

const { t } = useI18n({ useScope: 'local' })

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
  submitting.value = false

  if (!result.ok) {
    error.value = result.message
    return
  }

  emit('authenticated', authenticationMode)
}

function submit() {
  if (!canSubmit.value) return
  void authenticate(mode.value)
}
</script>

<template>
  <main class="auth-screen" data-testid="auth-screen">
    <InkWashBackdrop left-mountain bamboo seal="small" :bottom-mist="false" />
    <section class="auth-card">
      <InkNineSlice asset-id="surface-xl-paper-scroll" layer="surface" />
      <InkNineSlice asset-id="frame-xl-ceremony" layer="frame" />
      <div class="auth-card__seal">仙</div>
      <p class="auth-card__eyebrow">{{ t('onboarding.auth.eyebrow') }}</p>
      <h1>Tiên Hiệp Idle</h1>
      <p class="auth-card__lead">{{ t('onboarding.auth.lead') }}</p>

      <div class="auth-tabs" role="tablist">
        <button :class="{ active: mode === 'login' }" type="button" @click="mode = 'login'">{{ t('onboarding.auth.tabs.login') }}</button>
        <button :class="{ active: mode === 'register' }" type="button" @click="mode = 'register'">{{ t('onboarding.auth.tabs.register') }}</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          <span>{{ t('onboarding.auth.labels.loginId') }}</span>
          <input v-model.trim="loginId" autocomplete="username" maxlength="20" :placeholder="t('onboarding.auth.placeholders.loginId')" />
        </label>
        <p v-if="loginId && !validId" class="auth-form__hint is-error">{{ t('onboarding.auth.errors.invalidId') }}</p>
        <label>
          <span>{{ t('onboarding.auth.labels.password') }}</span>
          <input v-model="password" autocomplete="current-password" type="password" :placeholder="t('onboarding.auth.placeholders.password')" />
        </label>
        <p v-if="error" class="auth-form__hint is-error">{{ error }}</p>
        <GameButton class="primary-action" type="submit" variant="primary" size="lg" :disabled="!canSubmit" :loading="submitting">
          {{ mode === 'login' ? t('onboarding.auth.submit.login') : t('onboarding.auth.submit.register') }}
        </GameButton>
      </form>

      <div class="auth-divider"><span>{{ t('onboarding.auth.divider') }}</span></div>
      <GameButton class="guest-action" variant="ghost" size="lg" :disabled="submitting" data-testid="auth-guest-button" @click="authenticate('guest')">
        {{ t('onboarding.auth.guest.button') }}
        <small>{{ t('onboarding.auth.guest.note') }}</small>
      </GameButton>
      <p class="auth-card__status"><i /> {{ t('onboarding.auth.status') }}</p>
    </section>
  </main>
</template>

<style scoped>
.auth-screen { position: relative; width: 100vw; min-height: 100vh; display: grid; place-items: center; overflow: hidden auto; color: var(--paper-text, #211f1a); background: var(--paper-50, #f5f0e4); }
.auth-screen::before { content: ''; position: absolute; inset: 0; opacity: .1; background-image: linear-gradient(color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(circle, #000, transparent 72%); }
.auth-screen__mist { position: absolute; width: 42vw; height: 42vw; border-radius: 50%; filter: blur(80px); opacity: .1; background: var(--chrome-500); }
.auth-screen__mist--one { left: -18vw; bottom: -22vw; }.auth-screen__mist--two { right: -20vw; top: -24vw; }
.auth-card { position: relative; z-index: 1; isolation: isolate; width: min(390px, calc(100vw - 40px)); box-sizing: border-box; padding: 34px; border-radius: 0; background: transparent; box-shadow: none; text-align: center; }
.auth-card > :not(.ink-nine-slice) { position: relative; z-index: 3; }
.auth-card__seal { width: 54px; height: 54px; margin: 0 auto 16px; display: grid; place-items: center; border: 1px solid var(--cinnabar, #b54432); color: var(--cinnabar, #b54432); font: 700 var(--text-display) var(--font-display); transform: rotate(45deg); }.auth-card__seal::first-letter { transform: rotate(-45deg); }
.auth-card__eyebrow { margin: 0; color: var(--mineral-gold, #b79653); font-size: var(--text-xs); letter-spacing: .28em; }.auth-card h1 { margin: 8px 0 4px; font: 700 var(--text-display-lg) var(--font-display); }.auth-card__lead { margin: 0 0 24px; color: var(--paper-text-soft, #5e5a50); font-family: var(--font-display); font-style: italic; }
.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--ink-line); margin-bottom: 20px; }.auth-tabs button { border: 0; padding: 10px; min-height: var(--tap-min); background: none; color: var(--text-muted); cursor: pointer; }.auth-tabs button.active { color: var(--paper-text, #211f1a); border-bottom: 2px solid var(--cinnabar, #b54432); }
.auth-form { display: grid; gap: 14px; text-align: left; }.auth-form label { display: grid; gap: 7px; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); }.auth-form input { box-sizing: border-box; width: 100%; border: 1px solid var(--paper-line, rgba(42,41,36,.42)); border-radius: 2px; padding: 12px 13px; outline: none; background: color-mix(in srgb, var(--paper-50, #f5f0e4) 86%, transparent); color: var(--paper-text, #211f1a); }.auth-form input:focus { border-color: var(--brush-600, #5e5a50); box-shadow: none; }.auth-form__hint { margin: -8px 0 0; font-size: var(--text-xs); }.is-error { color: var(--cinnabar, #b54432); }
.primary-action { width: 100%; margin-top: 4px; }.auth-divider { display: flex; align-items: center; gap: 10px; margin: 19px 0; color: var(--text-muted); font-size: var(--text-xs); }.auth-divider::before,.auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--ink-line); }.guest-action { width: 100%; }.guest-action :deep(.game-button__label) { display: grid; gap: 4px; justify-items: center; width: 100%; }.guest-action small { color: var(--text-muted); font-weight: 400; }.auth-card__status { margin: 20px 0 0; color: var(--text-muted); font-size: var(--text-xs); }.auth-card__status i { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: var(--jade); box-shadow: 0 0 7px var(--jade); }
</style>
