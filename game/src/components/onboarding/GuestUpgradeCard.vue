<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GameButton from '@/components/common/GameButton.vue'
import { authService } from '@/services/auth/AuthServiceFactory'
import { isValidLoginId, isValidPassword } from '@/services/auth/AuthService'
import { readSupabaseSession, storeSupabaseSession } from '@/services/supabase/SupabaseSession'

// B1.8/EXT-09 guest -> registered surface: same-uuid upgrade with the
// authoritative pending-confirm state machine. The card owns the whole
// flow - link form (email only), pending-confirm re-check, post-finalize
// password step, done - so the auth card and the settings account
// section expose identical behavior. The password is collected AFTER
// finalize and only used for the updateUser call - never persisted.
const props = defineProps<{ pendingLoginId?: string }>()
const emit = defineEmits<{ finalized: [] }>()

const { t } = useI18n()

const loginId = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref('')
// 'form' collects the new login id; 'pending' mirrors a recorded
// pending-confirm marker; 'password' binds the credential after the
// server's finalize verdict; 'done' is the completed upgrade.
const view = ref<'form' | 'pending' | 'password' | 'done'>(props.pendingLoginId ? 'pending' : 'form')
const pendingId = ref<string | undefined>(props.pendingLoginId)

const validId = computed(() => isValidLoginId(loginId.value))
const canSubmitId = computed(() => validId.value && !submitting.value)
const canSubmitPassword = computed(() => isValidPassword(password.value) && !submitting.value)

async function submitUpgrade() {
  if (!canSubmitId.value) return
  submitting.value = true
  error.value = ''

  const result = await authService.upgradeGuest({ loginId: loginId.value })
  submitting.value = false

  if (!result.ok) {
    error.value = result.message
    return
  }
  if (result.status === 'pending-confirm') {
    pendingId.value = loginId.value.toLowerCase()
    view.value = 'pending'
    return
  }
  // FINALIZED: the linked email is confirmed - move to the password step.
  view.value = 'password'
}

/** Re-check the authoritative finalize verdict for a recorded pending
 *  upgrade (the resumable path - interrupted upgrades land here too). */
async function recheckFinalize() {
  if (submitting.value) return
  submitting.value = true
  error.value = ''

  const result = await authService.finalizeUpgrade()
  submitting.value = false

  if (!result.ok) {
    error.value = result.message
    return
  }
  if (result.status === 'pending-confirm') return
  view.value = 'password'
}

/** Post-finalize password set on the email-bound session. Only once this
 *  lands does the session flip to registered - the durable guest
 *  credential is retired by completeUpgrade itself. */
async function submitPassword() {
  if (!canSubmitPassword.value) return
  submitting.value = true
  error.value = ''

  const result = await authService.completeUpgrade({ password: password.value })
  submitting.value = false
  password.value = ''

  if (!result.ok) {
    error.value = result.message
    return
  }
  view.value = 'done'
  emit('finalized')
}

/** Abandon the recorded pending marker and pick a different identity.
 *  The pending link itself stays server-side; only the local replay
 *  marker is dropped so a different updateUser call can proceed. */
function switchIdentity() {
  const stored = readSupabaseSession()
  if (stored?.pendingUpgrade) {
    storeSupabaseSession({ ...stored, pendingUpgrade: undefined })
  }
  pendingId.value = undefined
  loginId.value = ''
  password.value = ''
  error.value = ''
  view.value = 'form'
}
</script>

<template>
  <div class="upgrade-card" data-testid="guest-upgrade-card">
    <template v-if="view === 'form'">
      <p class="upgrade-card__hint">{{ t('account.upgrade.hint') }}</p>
      <form class="upgrade-card__form" @submit.prevent="submitUpgrade">
        <input
          v-model.trim="loginId"
          class="upgrade-card__input"
          autocomplete="username"
          maxlength="20"
          :placeholder="t('onboarding.auth.placeholders.loginId')"
          :aria-invalid="loginId && !validId ? true : undefined"
          data-testid="upgrade-input-id"
        />
        <p v-if="error" class="upgrade-card__error" role="alert">{{ error }}</p>
        <GameButton variant="secondary" type="submit" :disabled="!canSubmitId" :loading="submitting" data-testid="upgrade-submit">
          {{ t('account.upgrade.submit') }}
        </GameButton>
      </form>
    </template>

    <template v-else-if="view === 'pending'">
      <p class="upgrade-card__hint">
        {{ t('account.upgrade.pendingBody', { id: pendingId ?? '' }) }}
      </p>
      <p v-if="error" class="upgrade-card__error" role="alert">{{ error }}</p>
      <div class="upgrade-card__row">
        <GameButton variant="secondary" :loading="submitting" data-testid="upgrade-recheck" @click="recheckFinalize">
          {{ t('account.upgrade.pendingCheck') }}
        </GameButton>
        <button type="button" class="upgrade-card__link" data-testid="upgrade-switch-id" @click="switchIdentity">
          {{ t('account.upgrade.pendingSwitch') }}
        </button>
      </div>
    </template>

    <template v-else-if="view === 'password'">
      <p class="upgrade-card__hint">{{ t('account.upgrade.passwordBody', { id: pendingId ?? '' }) }}</p>
      <form class="upgrade-card__form" @submit.prevent="submitPassword">
        <input
          v-model="password"
          class="upgrade-card__input"
          autocomplete="new-password"
          type="password"
          :placeholder="t('onboarding.auth.placeholders.password')"
          :aria-invalid="password && !isValidPassword(password) ? true : undefined"
          data-testid="upgrade-input-password"
        />
        <p v-if="error" class="upgrade-card__error" role="alert">{{ error }}</p>
        <GameButton variant="secondary" type="submit" :disabled="!canSubmitPassword" :loading="submitting" data-testid="upgrade-password-submit">
          {{ t('account.upgrade.passwordSubmit') }}
        </GameButton>
      </form>
    </template>

    <template v-else>
      <p class="upgrade-card__done" data-testid="upgrade-done">{{ t('account.upgrade.done') }}</p>
    </template>
  </div>
</template>

<style scoped>
.upgrade-card { display: grid; gap: 10px; text-align: left; }
.upgrade-card__hint { margin: 0; color: var(--paper-text-soft, #5e5a50); font-size: var(--text-xs); line-height: 1.5; }
.upgrade-card__form { display: grid; gap: 10px; }
.upgrade-card__input { box-sizing: border-box; width: 100%; border: 1px solid var(--paper-line, rgba(42,41,36,.42)); border-radius: 2px; padding: 10px 12px; outline: none; background: color-mix(in srgb, var(--paper-50, #f5f0e4) 86%, transparent); color: var(--paper-text, #211f1a); font-size: var(--text-sm); }
.upgrade-card__input:focus { border-color: var(--brush-600, #5e5a50); }
.upgrade-card__error { margin: 0; color: var(--cinnabar, #b54432); font-size: var(--text-xs); }
.upgrade-card__row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.upgrade-card__link { border: 0; background: none; padding: 4px 0; color: var(--paper-text-muted, #6b6860); font-size: var(--text-xs); text-decoration: underline; cursor: pointer; }
.upgrade-card__done { margin: 0; color: var(--jade-dark, #2f6b4f); font-size: var(--text-sm); }
</style>
