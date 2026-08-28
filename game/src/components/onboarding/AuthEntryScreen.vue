<script setup lang="ts">
import { computed, ref } from 'vue'
import GameButton from '@/components/common/GameButton.vue'
import { authService } from '@/services/auth/AuthServiceFactory'
import { isValidLoginId, isValidPassword, type AuthenticationMode } from '@/services/auth/AuthService'

const emit = defineEmits<{ authenticated: [mode: AuthenticationMode] }>()
const mode = ref<'login' | 'register'>('login')
const loginId = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')

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
  <main class="auth-screen">
    <div class="auth-screen__mist auth-screen__mist--one" />
    <div class="auth-screen__mist auth-screen__mist--two" />
    <section class="auth-card">
      <span class="ornate-frame" aria-hidden="true" />
      <div class="auth-card__seal">仙</div>
      <p class="auth-card__eyebrow">NHẤT NIỆM NHẬP ĐẠO</p>
      <h1>Tiên Hiệp Idle</h1>
      <p class="auth-card__lead">Một đời phàm tục, một niệm cầu tiên.</p>

      <div class="auth-tabs" role="tablist">
        <button :class="{ active: mode === 'login' }" type="button" @click="mode = 'login'">Đăng nhập</button>
        <button :class="{ active: mode === 'register' }" type="button" @click="mode = 'register'">Đăng ký</button>
      </div>

      <form class="auth-form" @submit.prevent="submit">
        <label>
          <span>ID đạo hữu</span>
          <input v-model.trim="loginId" autocomplete="username" maxlength="20" placeholder="4–20 ký tự Latin, số hoặc _" />
        </label>
        <p v-if="loginId && !validId" class="auth-form__hint is-error">ID chưa đúng định dạng.</p>
        <label>
          <span>Mật khẩu</span>
          <input v-model="password" autocomplete="current-password" type="password" placeholder="Tối thiểu 6 ký tự" />
        </label>
        <p v-if="error" class="auth-form__hint is-error">{{ error }}</p>
        <GameButton class="primary-action" type="submit" variant="primary" size="lg" :disabled="!canSubmit" :loading="submitting">
          {{ mode === 'login' ? 'Vào động phủ' : 'Lập đạo danh' }}
        </GameButton>
      </form>

      <div class="auth-divider"><span>hoặc</span></div>
      <GameButton class="guest-action" variant="ghost" size="lg" :disabled="submitting" @click="authenticate('guest')">
        Chơi ngay
        <small>Tiến trình khách dừng tại Trúc Cơ</small>
      </GameButton>
      <p class="auth-card__status"><i /> Máy chủ thử nghiệm · UI prototype</p>
    </section>
  </main>
</template>

<style scoped>
.auth-screen { position: relative; width: 100vw; min-height: 100vh; display: grid; place-items: center; overflow: hidden auto; background: radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--chrome-700) 8%, var(--ink-950)) 0, var(--ink-900) 38%, var(--ink-950) 78%); }
.auth-screen::before { content: ''; position: absolute; inset: 0; opacity: .1; background-image: linear-gradient(color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text-primary) 7%, transparent) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(circle, #000, transparent 72%); }
.auth-screen__mist { position: absolute; width: 42vw; height: 42vw; border-radius: 50%; filter: blur(80px); opacity: .1; background: var(--chrome-500); }
.auth-screen__mist--one { left: -18vw; bottom: -22vw; }.auth-screen__mist--two { right: -20vw; top: -24vw; }
.auth-card { position: relative; z-index: 1; width: min(390px, calc(100vw - 40px)); box-sizing: border-box; padding: 34px; border-radius: var(--radius-md); background: linear-gradient(160deg, var(--ink-950), var(--ink-800)); box-shadow: var(--shadow-panel), 0 30px 80px rgba(0,0,0,.55), inset 0 1px rgba(255,255,255,.03); text-align: center; }
.auth-card__seal { width: 54px; height: 54px; margin: 0 auto 16px; display: grid; place-items: center; border: 1px solid var(--chrome-100); color: var(--chrome-100); font: 700 var(--text-display) var(--font-display); transform: rotate(45deg); }.auth-card__seal::first-letter { transform: rotate(-45deg); }
.auth-card__eyebrow { margin: 0; color: var(--chrome-500); font-size: var(--text-xs); letter-spacing: .28em; }.auth-card h1 { margin: 8px 0 4px; font: 700 var(--text-display-lg) var(--font-display); }.auth-card__lead { margin: 0 0 24px; color: var(--text-secondary); font-family: var(--font-display); font-style: italic; }
.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--ink-line); margin-bottom: 20px; }.auth-tabs button { border: 0; padding: 10px; min-height: var(--tap-min); background: none; color: var(--text-muted); cursor: pointer; }.auth-tabs button.active { color: var(--chrome-100); border-bottom: 2px solid var(--chrome-500); }
.auth-form { display: grid; gap: 14px; text-align: left; }.auth-form label { display: grid; gap: 7px; color: var(--text-secondary); font-size: var(--text-xs); }.auth-form input { box-sizing: border-box; width: 100%; border: 1px solid var(--ink-line); border-radius: 6px; padding: 12px 13px; outline: none; background: var(--ink-950); color: var(--text-primary); }.auth-form input:focus { border-color: var(--chrome-300); box-shadow: 0 0 0 3px color-mix(in srgb, var(--chrome-300) 8%, transparent); }.auth-form__hint { margin: -8px 0 0; font-size: var(--text-xs); }.is-error { color: var(--crimson); }
.primary-action { width: 100%; margin-top: 4px; }.auth-divider { display: flex; align-items: center; gap: 10px; margin: 19px 0; color: var(--text-muted); font-size: var(--text-xs); }.auth-divider::before,.auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--ink-line); }.guest-action { width: 100%; }.guest-action :deep(.game-button__label) { display: grid; gap: 4px; justify-items: center; width: 100%; }.guest-action small { color: var(--text-muted); font-weight: 400; }.auth-card__status { margin: 20px 0 0; color: var(--text-muted); font-size: var(--text-xs); }.auth-card__status i { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: var(--jade); box-shadow: 0 0 7px var(--jade); }
</style>
