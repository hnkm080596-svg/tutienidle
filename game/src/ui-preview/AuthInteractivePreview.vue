<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SceneDesignCanvas from '@/components/common/SceneDesignCanvas.vue'
import PcPaperButton from '@/components/common/PcPaperButton.vue'
import LoginOpening from '@/components/scenes/login/LoginOpening.vue'
import AuthPreviewDrawer from './AuthPreviewDrawer.vue'
import AuthPreviewSettings from './AuthPreviewSettings.vue'
import LoginSceneVista from '@/components/scenes/login/LoginSceneVista.vue'
import TrialCreationArtPreview from './TrialCreationArtPreview.vue'
import AuthCredentialForm from '@/components/scenes/login/AuthCredentialForm.vue'
import { isValidLoginId, isValidPassword } from '@/services/auth/AuthService'
import type { AppLocale } from '@/composables/locale'
import { pcPaperControlStyles } from '@/presentation/assets/PcPaperControls'
import { resolveAssetUrl } from '@/presentation/assets/AssetBaseUrl'
import '@/assets/pc-paper-scene.css'
import '@/assets/tien-hiep-entry.css'

const { t, locale } = useI18n()
const drawer = ref<'auth' | 'settings' | 'exit' | null>(null)
const displayedDrawer = ref<'auth' | 'settings' | 'exit'>('auth')
watch(drawer, (value) => { if (value !== null) displayedDrawer.value = value })
const exited = ref(false)
const mode = ref<'login' | 'register'>('login')
const loginId = ref('')
const password = ref('')
const saved = ref(false)
const creation = ref(false)
const name = ref('')
const talent = ref(false)
const message = ref('')
const settingsRevision = ref(0)
const preferences = ref({ enabled: true, master: 70, music: 50, sfx: 80, ui: 70, reducedShake: false, uiScale: 1, language: 'vi' as AppLocale })
const canSubmit = computed(() => isValidLoginId(loginId.value) && isValidPassword(password.value))
const style = { ...pcPaperControlStyles(), '--auth-hover-cloud': `url('${resolveAssetUrl('/assets/ui/tien-hiep-2026-10/runtime/cloud-ornament@2x.png')}')` }
function openAuth(target: 'login' | 'register') { mode.value = target; message.value = ''; drawer.value = 'auth' }
function play() { if (saved.value) message.value = t('authPreview.continued'); else creation.value = true }
function reset() { drawer.value = null; exited.value = false; creation.value = false; saved.value = false; message.value = ''; loginId.value = ''; password.value = ''; preferences.value = { enabled: true, master: 70, music: 50, sfx: 80, ui: 70, reducedShake: false, uiScale: 1, language: 'vi' }; locale.value = 'vi'; settingsRevision.value++ }
</script>

<template>
  <SceneDesignCanvas>
    <section class="auth-interactive-preview pc-paper-scene th-entry-scene" :style="style" data-testid="auth-art-preview">
      <LoginSceneVista />
      <div class="pc-paper-scene__frame" />
      <LoginOpening v-if="!creation && !exited" :resume-available="saved" :ready="true" :busy="false" :error="''" @authenticate="openAuth" @play="play" @settings="drawer = 'settings'" />
      <PcPaperButton v-if="!creation && !exited" class="preview-exit-button" variant="secondary" data-testid="opening-exit-button" @click="drawer = 'exit'">{{ t('authPreview.exit') }}</PcPaperButton>
      <AuthPreviewDrawer :open="drawer !== null" :title="displayedDrawer === 'settings' ? t('paperNav.settings') : displayedDrawer === 'exit' ? t('authPreview.exit') : t(`onboarding.auth.tabs.${mode}`)" @close="drawer = null">
        <template v-if="displayedDrawer === 'auth'">
          <span :id="`auth-tab-${mode}`" class="sr-only">{{ t(`onboarding.auth.tabs.${mode}`) }}</span>
          <AuthCredentialForm v-model:login-id="loginId" v-model:password="password" :mode="mode" :can-submit="canSubmit" :submitting="false" :error="''" :reset-notice="false" :credential-error="false" @submit="message = t('authPreview.submitted')" />
          <p v-if="message" class="preview-notice" role="status">{{ message }}</p>
        </template>
        <AuthPreviewSettings v-show="displayedDrawer === 'settings'" :key="settingsRevision" v-model="preferences" />
        <section v-if="displayedDrawer === 'exit'" class="preview-exit-confirm">
          <p>{{ t('authPreview.exitQuestion') }}</p>
          <div class="preview-scale"><PcPaperButton variant="secondary" @click="drawer = null">{{ t('authPreview.cancel') }}</PcPaperButton><PcPaperButton data-testid="preview-exit-confirm" @click="drawer = null; exited = true">{{ t('authPreview.exitConfirm') }}</PcPaperButton></div>
        </section>
      </AuthPreviewDrawer>
      <section v-if="exited" class="preview-exited"><h2>{{ t('authPreview.exited') }}</h2><PcPaperButton @click="exited = false">{{ t('authPreview.returnPreview') }}</PcPaperButton></section>
      <TrialCreationArtPreview v-if="creation" @back="creation = false; message = ''" />
      <p v-if="message && !creation && drawer === null" class="preview-opening-notice" role="status">{{ message }}</p>
      <aside class="preview-controls"><span>{{ t('authPreview.heading') }}</span><label><input v-model="saved" type="checkbox">{{ t('authPreview.saved') }}</label><button @click="reset">{{ t('authPreview.reset') }}</button></aside>
    </section>
  </SceneDesignCanvas>
</template>

<style scoped>
.auth-interactive-preview { position: relative; width: 1440px; height: 810px; overflow: clip; --font-display: var(--pc-font-body); }
.auth-interactive-preview :deep(.login-world-vista) { width: 100%; height: 100%; object-fit: cover; }
.preview-controls { position: absolute; bottom: 18px; left: 20px; z-index: 15; display: flex; gap: 18px; align-items: center; background: #f7ecd8ed; border: 1px solid #ac8a4d; padding: 9px 14px; font-size: 14px; color: #675232; }
.preview-controls label { display: flex; gap: 8px; align-items: center; }
.preview-controls button { border: 1px solid #ad8a4a; background: #ead5ad; padding: 5px 12px; color: #44321c; cursor: pointer; font: inherit; }
.preview-scale { display: flex; gap: 12px; }
.preview-scale button { min-height: 44px; font-size: 18px; }
.preview-exit-button { position: absolute; left: 566px; top: 635px; width: 310px; min-height: 68px; color: #f5e6c6; font: 600 27px var(--pc-font-body); box-shadow: 0 4px 12px #65522c40; }
.preview-exit-confirm p { font-size: 23px; }
.preview-exited { position: absolute; left: 480px; top: 315px; width: 530px; padding: 35px; text-align: center; background: #f5e6c9eb; border: 3px double #aa8645; }
.preview-exited h2 { margin: 0 0 25px; font-size: 28px; }
/* Auth uses the same warm paper and proportion-preserving art as the opening. */
.auth-interactive-preview :deep(.auth-preview-drawer .auth-form) { gap: 20px; padding-top: 10px; }
.auth-interactive-preview :deep(.auth-preview-drawer .auth-field-row .sr-only) { position: static; width: auto; height: auto; padding: 0; margin: 0 0 6px; overflow: visible; clip: auto; white-space: normal; color: #564023; font-size: 18px; }
.auth-interactive-preview :deep(.auth-preview-drawer .auth-field) { border: 1px solid #998b6d; background: linear-gradient(110deg,#32322c,#252620); box-shadow: inset 0 1px 3px #00000020; border-radius: 3px; min-height: 50px; }
.auth-interactive-preview :deep(.auth-preview-drawer .auth-field:focus-within) { border-color: #ba9857; box-shadow: 0 0 0 1px #ba985730; }
.auth-interactive-preview :deep(.auth-preview-drawer .auth-field input) { height: 50px; padding: 10px 44px; font: 17px var(--pc-font-body); color: #1e1912; }
.auth-interactive-preview :deep(.auth-preview-drawer .auth-field input::placeholder) { color: #5f5540; }
.auth-interactive-preview :deep(.auth-preview-drawer .auth-field__icon), .auth-interactive-preview :deep(.auth-preview-drawer .auth-field__reveal) { color: #c9bda2; }
.auth-interactive-preview :deep(.auth-preview-drawer .auth-primary-action::before) { border-image-source: var(--pc-secondary-button); }
.auth-interactive-preview.auth-interactive-preview :deep(.auth-preview-drawer .auth-primary-action) { color: #f4e4c0; min-height: 62px; font-size: 25px; }
.auth-interactive-preview :deep(.auth-preview-drawer .preview-notice) { color: #70512d; }
/* Hover reuses the approved gold button art and transparent cloud ornaments. */
.auth-interactive-preview :deep(.pc-paper-button) { transition: none; }
.auth-interactive-preview :deep(.pc-paper-button::before) { transition: none; }
.auth-interactive-preview :deep(.pc-paper-button::after) { content: ''; position: absolute; inset: 8px 12px; pointer-events: none; opacity: 0; background: var(--auth-hover-cloud) left center / 50px 36px no-repeat, var(--auth-hover-cloud) right center / 50px 36px no-repeat; transition: none; }
.auth-interactive-preview :deep(.pc-paper-button:not(:disabled):is(:hover, :focus-visible)) { color: #3c2810; filter: none; text-shadow: 0 1px #fff0c2; }
.auth-interactive-preview :deep(.pc-paper-button:not(:disabled):is(:hover, :focus-visible)::before) { border-image-source: var(--pc-primary-button); filter: brightness(.92) saturate(.85) drop-shadow(0 0 2px #d9b56a40); }
.auth-interactive-preview :deep(.pc-paper-button:not(:disabled):is(:hover, :focus-visible)::after) { opacity: 0; }
.auth-interactive-preview :deep(.pc-paper-button:not(:disabled):active::before) { filter: brightness(.96) saturate(1.15); }
.auth-interactive-preview :deep(.pc-paper-button--icon::after) { display: none; }
@media (prefers-reduced-motion: reduce) { .auth-interactive-preview :deep(.pc-paper-button), .auth-interactive-preview :deep(.pc-paper-button::before), .auth-interactive-preview :deep(.pc-paper-button::after) { transition: none; } }
.preview-notice { color: #6c5027; line-height: 1.6; font-size: 17px; }
.preview-opening-notice { position: absolute; bottom: 95px; left: 550px; width: 400px; background: #f5e9d0df; padding: 14px; }
</style>


