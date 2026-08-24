<script setup lang="ts">
import { computed, ref } from 'vue'
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
        <button class="primary-action" :disabled="!canSubmit" type="submit">
          {{ submitting ? 'Đang kết nối…' : mode === 'login' ? 'Vào động phủ' : 'Lập đạo danh' }}
        </button>
      </form>

      <div class="auth-divider"><span>hoặc</span></div>
      <button class="guest-action" :disabled="submitting" type="button" @click="authenticate('guest')">
        Chơi ngay
        <small>Tiến trình khách dừng tại Trúc Cơ</small>
      </button>
      <p class="auth-card__status"><i /> Máy chủ thử nghiệm · UI prototype</p>
    </section>
  </main>
</template>

<style scoped>
.auth-screen { position: relative; width: 100vw; height: 100vh; display: grid; place-items: center; overflow: hidden; background: radial-gradient(circle at 50% 18%, #28231a 0, #111116 38%, #08080b 78%); }
.auth-screen::before { content: ''; position: absolute; inset: 0; opacity: .1; background-image: linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(circle, #000, transparent 72%); }
.auth-screen__mist { position: absolute; width: 42vw; height: 42vw; border-radius: 50%; filter: blur(80px); opacity: .1; background: var(--gold-500); }
.auth-screen__mist--one { left: -18vw; bottom: -22vw; }.auth-screen__mist--two { right: -20vw; top: -24vw; }
.auth-card { z-index: 1; width: min(390px, calc(100vw - 40px)); box-sizing: border-box; padding: 34px; border: 1px solid rgba(255,213,79,.26); border-radius: 16px; background: linear-gradient(145deg, rgba(27,27,34,.96), rgba(12,12,16,.98)); box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 1px rgba(255,255,255,.03); text-align: center; }
.auth-card__seal { width: 54px; height: 54px; margin: 0 auto 16px; display: grid; place-items: center; border: 1px solid var(--gold-500); color: var(--gold-500); font: 700 27px var(--font-display); transform: rotate(45deg); }.auth-card__seal::first-letter { transform: rotate(-45deg); }
.auth-card__eyebrow { margin: 0; color: var(--gold-500); font-size: 10px; letter-spacing: .28em; }.auth-card h1 { margin: 8px 0 4px; font: 700 34px var(--font-display); }.auth-card__lead { margin: 0 0 24px; color: var(--text-secondary); font-family: var(--font-display); font-style: italic; }
.auth-tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--ink-line); margin-bottom: 20px; }.auth-tabs button { border: 0; padding: 10px; background: none; color: var(--text-muted); cursor: pointer; }.auth-tabs button.active { color: var(--gold-300); border-bottom: 2px solid var(--gold-500); }
.auth-form { display: grid; gap: 14px; text-align: left; }.auth-form label { display: grid; gap: 7px; color: var(--text-secondary); font-size: 12px; }.auth-form input { box-sizing: border-box; width: 100%; border: 1px solid var(--ink-line); border-radius: 6px; padding: 12px 13px; outline: none; background: #0d0d12; color: var(--text-primary); }.auth-form input:focus { border-color: var(--gold-700); box-shadow: 0 0 0 3px rgba(255,179,0,.08); }.auth-form__hint { margin: -8px 0 0; font-size: 11px; }.is-error { color: var(--crimson); }
.primary-action,.guest-action { border-radius: 6px; cursor: pointer; font-family: var(--font-body); }.primary-action { margin-top: 4px; border: 1px solid var(--gold-500); padding: 12px; background: var(--gold-500); color: var(--gold-ink); font-weight: 700; }.primary-action:disabled { opacity: .38; cursor: not-allowed; }.auth-divider { display: flex; align-items: center; gap: 10px; margin: 19px 0; color: var(--text-muted); font-size: 11px; }.auth-divider::before,.auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--ink-line); }.guest-action { width: 100%; display: grid; gap: 4px; padding: 10px; border: 1px solid var(--ink-line); background: transparent; color: var(--text-primary); }.guest-action:hover { border-color: var(--gold-700); }.guest-action small { color: var(--text-muted); }.auth-card__status { margin: 20px 0 0; color: var(--text-muted); font-size: 10px; }.auth-card__status i { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: var(--jade); box-shadow: 0 0 7px var(--jade); }
</style>
