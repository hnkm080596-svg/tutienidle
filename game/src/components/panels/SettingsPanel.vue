<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { useGameManager } from '@/composables/useGameState'
import { useNotificationStore } from '@/stores/notification'
import { exportSaveToFile, getRawSave, importSaveRaw, SAVE_RESET_REQUEST_EVENT } from '@/services/save/SaveSystem'
import { validateRecoveryData } from '@/services/save/recoveryApi'
import { cloudSaveCoordinator } from '@/services/cloudSave/CloudSaveServiceFactory'
import { observeAuthoritySaveResult } from '@/composables/useOnlineAuthority'
import { loadUiScale, saveUiScale } from '@/composables/uiScale'
import { saveLocale, type AppLocale } from '@/composables/locale'
import { useActiveUpdates } from '@/composables/useUpdates'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import FeedbackDialog from '@/components/common/FeedbackDialog.vue'
import GuestAbandonDialog from '@/components/panels/GuestAbandonDialog.vue'
import SettingsNavRail from '@/components/scenes/settings/SettingsNavRail.vue'
import SettingsSaveSection from '@/components/scenes/settings/SettingsSaveSection.vue'
import SettingsUiScaleSection from '@/components/scenes/settings/SettingsUiScaleSection.vue'
import SettingsLanguageSection from '@/components/scenes/settings/SettingsLanguageSection.vue'
import SettingsAudioSection from '@/components/scenes/settings/SettingsAudioSection.vue'
import SettingsFeedbackSection from '@/components/scenes/settings/SettingsFeedbackSection.vue'
import SettingsAccountSection from '@/components/scenes/settings/SettingsAccountSection.vue'
import SettingsUpdateSection from '@/components/scenes/settings/SettingsUpdateSection.vue'
import SettingsBuildSection from '@/components/scenes/settings/SettingsBuildSection.vue'
import { readSupabaseSession } from '@/services/supabase/SupabaseSession'
import { requestSessionLogout } from '@/composables/useSessionAccount'
import { hkChromeUrl } from '@/ui/huyenKimChrome'

const player = usePlayerStore()
const gameManager = useGameManager()
const notification = useNotificationStore()
const { t, locale } = useI18n()

// B1.9a - under the remote authority the panel's recovery actions keep
// different semantics: manual import validates/exports the file instead
// of overwriting (no client-side path can replace the cloud row), reset
// clears the local cache so the authoritative load restores from cloud,
// and export stamps its provenance + revision onto the filename.
const remoteAuthoritative = cloudSaveCoordinator.capability === 'remote-authoritative'

// Thay window.confirm() native - modal xac nhan dong bo hoa bang
// pending-action: mo ConfirmModal, hanh dong that chi chay khi
// resolvePendingConfirm() (nut "Xac Nhan") duoc goi.
const pendingConfirm = ref<null | { title: string; message: string; danger: boolean; onConfirm: () => void }>(null)

function requestConfirm(title: string, message: string, onConfirm: () => void, danger = false) {
  pendingConfirm.value = { title, message, danger, onConfirm }
}

function resolvePendingConfirm() {
  pendingConfirm.value?.onConfirm()
  pendingConfirm.value = null
}

function cancelPendingConfirm() {
  pendingConfirm.value = null
}

// WS8 - co chu giao dien (chi scale semantic tokens, khong zoom canvas).
const uiScale = ref<number>(loadUiScale())

function handleUiScale(scale: number) {
  uiScale.value = scale
  saveUiScale(scale)
}

function handleLocale(next: AppLocale) {
  saveLocale(next)
}

const lastSavedLabel = ref('')

// BETA-FINAL PR12 - the bound update surface (null on web builds; the
// section hides itself then). Renders the sanitized UpdateState only.
const updates = useActiveUpdates()
const updateState = computed(() => updates?.state.value ?? null)
const updatePhase = computed(() => updateState.value?.phase ?? null)
const updateProgressPercent = computed(() => Math.round(updateState.value?.progress?.percent ?? 0))

// BETA-FINAL PR13 / spec B7 - feedback intake lives here as a normal
// settings surface; the dialog itself owns draft/idempotency/result state.
const feedbackOpen = ref(false)

// Luu thu cong phai await va kiem tra ket qua - truoc day toast
// "Da luu tien trinh" hien ca khi writeGameSave fail (quota), nguoi
// choi tuong tien trinh da an toan roi dong tab mat trang.
async function handleSave() {
  const result = await player.save(gameManager)

  // B1-D: every save outcome reports to the admission authority (remote
  // mode only - the call is a no-op when no remote session is bound).
  observeAuthoritySaveResult(result)

  if (result.status === 'ok') {
    lastSavedLabel.value = new Date().toLocaleTimeString('vi-VN')

    notification.push('save', t('panels.settings.notifications.saved'))
  } else {
    lastSavedLabel.value = t('panels.settings.notifications.saveFailedShort')

    // Audit fix 2026-08-31 - kind 'error' (do) dong nhat App.vue autosave
    // fail; kind 'save' (xanh nhat) lam nguoi choi bo qua mat nguy co.
    notification.push('error', t('panels.settings.notifications.saveFailed'))
  }
}

function handleLoad() {
  // GameManager.restoreFromSave() cong don (materials/pills/talismans/
  // equipment dung .add(), khong clear truoc) - goi lai giua phien
  // dang chay se NHAN DOI tai nguyen thay vi thay the. Reload tai
  // dung dung luong onMounted() (da dung) thay vi phai viet clear()
  // cho tung Manager - rui ro thap hon nhieu.
  requestConfirm(
    t('panels.settings.confirm.reloadTitle'),
    t('panels.settings.confirm.reloadBody'),
    () => window.location.reload(),
  )
}

// Xuat save hien tai - save() truoc de file tai ve phan anh dung
// tien trinh tai thoi diem bam, khong phai lan save gan nhat.
async function handleExport() {
  // PHAI await - writeGameSave chay trong microtask (cloudSaveCoordinator
  // -> LocalCloudSaveService.save deu async); doc localStorage ngay sau loi
  // goi sync se lay save 15s cu (bug audit 2026-08-31).
  const result = await player.save(gameManager)

  observeAuthoritySaveResult(result)

  if (result.status !== 'ok') {
    notification.push('error', t('panels.settings.notifications.exportFailed'))
    return
  }

  // B1-C: remote mode exports the server-ACKed envelope (payload +
  // revision bound as one identity); local mode's slot is the same
  // facade. getRawSave stays as a legacy fallback only.
  const cached = await cloudSaveCoordinator.readCachedSave()
  const raw = cached?.raw ?? getRawSave()

  if (raw) {
    exportSaveToFile(
      raw,
      remoteAuthoritative
        ? { source: 'cloud', revision: cached?.revision ?? cloudSaveCoordinator.getRevision() }
        : { source: 'local', revision: cached?.revision ?? cloudSaveCoordinator.getRevision() },
    )
  }
}

function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  input.value = ''

  if (!file) {
    return
  }

  requestConfirm(
    t('panels.settings.confirm.importTitle'),
    remoteAuthoritative
      ? t('panels.settings.confirm.importBodyRemote')
      : t('panels.settings.confirm.importBody'),
    () => {
      const reader = new FileReader()

      reader.onload = () => {
        const rawText = String(reader.result)

        if (remoteAuthoritative) {
          // Remote mode: validate the recovery file only. A consumable
          // payload is exported back normalized (identified by source +
          // revision); the cloud row and the local cache stay untouched.
          const validation = validateRecoveryData(rawText)

          if (validation.status === 'valid') {
            exportSaveToFile(validation.normalizedRaw, { source: 'recovery-import' })
            notification.push('save', t('panels.settings.notifications.importValidatedRemote'))
          } else {
            notification.push('error', t('panels.settings.errors.invalidSaveFile'))
          }

          return
        }

        const ok = importSaveRaw(rawText)

        if (ok) {
          window.location.reload()
        } else {
          // UI-007 (Task 5) - window.alert native -> toast store (in-game
          // feedback, tu bien mat, khong chan luong; giu import input
          // reset de retry ngay).
          notification.push('error', t('panels.settings.errors.invalidSaveFile'))
        }
      }

      reader.readAsText(file)
    },
  )
}

function handleReset() {
  requestConfirm(
    remoteAuthoritative
      ? t('panels.settings.confirm.resetCloudTitle')
      : t('panels.settings.confirm.resetTitle'),
    remoteAuthoritative
      ? t('panels.settings.confirm.resetCloudBody')
      : t('panels.settings.confirm.resetBody'),
    // App phai dung interval/pagehide autosave TRUOC khi xoa; neu panel tu
    // reload, pagehide ghi lai chinh save vua xoa.
    () => window.dispatchEvent(new Event(SAVE_RESET_REQUEST_EVENT)),
    true,
  )
}

// B1.8/B1.9 - account surface (remote mode only): the guest -> registered
// upgrade card with its pending-confirm state, and the ordered logout.
// The ordered legs live in useSessionAccount; the return-to-auth teardown
// is bound by App.vue, so a successful requestSessionLogout unmounts this
// panel with the rest of the game tree.
const storedAccount = ref(remoteAuthoritative ? readSupabaseSession() : null)
const accountIsGuest = computed(() => !storedAccount.value || storedAccount.value.mode === 'guest')
const pendingUpgradeLoginId = computed(() => storedAccount.value?.pendingUpgrade?.loginId)
const showAccountUpgrade = ref(!!pendingUpgradeLoginId.value)

/** A finalize inside the panel flips account_kind; re-read the session so
 *  the account surface (note text, logout path) stops treating the now-
 *  registered account as a guest. */
function refreshStoredAccount() {
  storedAccount.value = remoteAuthoritative ? readSupabaseSession() : null
}

// 'abandon' = guest sole-credential warning (multi-action dialog);
// 'unsynced' = flush failed, offer retry or explicit unsynced abandon.
// Registered logout reuses the shared requestConfirm chrome.
const logoutDialog = ref<'none' | 'abandon' | 'unsynced'>('none')
const logoutBusy = ref(false)

function startLogout() {
  refreshStoredAccount()
  if (accountIsGuest.value) {
    logoutDialog.value = 'abandon'
    return
  }
  requestConfirm(
    t('panels.settings.confirm.logoutTitle'),
    t('panels.settings.confirm.logoutBody'),
    () => void runLogout(),
    true,
  )
}

async function runLogout(acknowledgeUnsynced = false) {
  if (logoutBusy.value) return
  logoutBusy.value = true

  const result = await requestSessionLogout({ acknowledgeUnsynced })

  logoutBusy.value = false
  if (result.status === 'done') {
    // The bound teardown already routed to auth; drop the dialog state so
    // a remount of this panel never sees a stale modal.
    logoutDialog.value = 'none'
    return
  }

  // flush-blocked: pending writes could not reach the cloud - the spec's
  // retry / explicit-unsynced-abandon fork.
  logoutDialog.value = 'unsynced'
}

function onAbandonUpgrade() {
  logoutDialog.value = 'none'
  showAccountUpgrade.value = true
}

function onAbandonExport() {
  void handleExport()
}

// Huyen Kim scene 17: left seal nav + right workspace. Sections map to
// real surfaces only - reserved categories (Graphics Quality etc.)
// render nothing. Account/Update hide themselves with their data.
type SettingsSection = 'general' | 'display' | 'audio' | 'account' | 'update' | 'support'
const activeSection = ref<SettingsSection>('general')

function onSelectSection(id: string) {
  activeSection.value = id as SettingsSection
}
const navSections = computed(() => {
  const list: Array<{ id: SettingsSection; label: string }> = [
    { id: 'general', label: t('panels.settings.sections.save') },
    { id: 'display', label: t('panels.settings.sections.display') },
    { id: 'audio', label: t('panels.settings.sections.audio') },
  ]
  if (remoteAuthoritative) {
    list.push({ id: 'account', label: t('panels.settings.sections.account') })
  }
  if (updateState.value !== null && updatePhase.value !== 'unsupported') {
    list.push({ id: 'update', label: t('panels.settings.update.title') })
  }
  list.push({ id: 'support', label: t('panels.settings.sections.support') })
  return list
})
// Scene 17 grammar: audio/ui sliders wear the slider-track + slider-thumb
// chrome when the PNGs are ready; the native range keeps working as fallback.
const sliderTrackUrl = hkChromeUrl('slider-track')
const sliderThumbUrl = hkChromeUrl('slider-thumb')
const sliderChromeStyle = computed<Record<string, string> | undefined>(() =>
  sliderTrackUrl && sliderThumbUrl
    ? {
        '--hk-slider-track': `url("${sliderTrackUrl}")`,
        '--hk-slider-thumb': `url("${sliderThumbUrl}")`,
      }
    : undefined,
)
</script>

<template>
  <div class="settings-panel" :class="{ 'has-hk-slider': Boolean(sliderChromeStyle) }" :style="sliderChromeStyle">
    <!-- Scene 17: left vertical seal navigation. -->
    <SettingsNavRail
      :sections="navSections"
      :active-id="activeSection"
      :label="t('panels.settings.sections.navAria')"
      @select="onSelectSection"
    />

    <!-- Right workspace: the active category only. -->
    <div class="settings-panel__workspace scrollfade">
      <SettingsSaveSection
        v-if="activeSection === 'general'"
        :remote-authoritative="remoteAuthoritative"
        @save="handleSave"
        @load="handleLoad"
        @export="handleExport"
        @import-file="handleImportFile"
        @reset="handleReset"
      />

      <template v-if="activeSection === 'display'">
        <SettingsUiScaleSection :ui-scale="uiScale" @select="handleUiScale" />
        <SettingsLanguageSection :locale="(locale as AppLocale)" @select="handleLocale" />
      </template>

      <SettingsAudioSection v-if="activeSection === 'audio'" />

      <SettingsFeedbackSection v-if="activeSection === 'support'" @open="feedbackOpen = true" />

      <SettingsAccountSection
        v-if="remoteAuthoritative && activeSection === 'account'"
        v-model:show-upgrade="showAccountUpgrade"
        :account-is-guest="accountIsGuest"
        :pending-upgrade-login-id="pendingUpgradeLoginId"
        :logout-busy="logoutBusy"
        @logout="startLogout"
        @finalized="refreshStoredAccount"
      />

      <SettingsUpdateSection
        v-if="activeSection === 'update' && updateState !== null && updatePhase !== 'unsupported'"
        :current-version="updateState.currentVersion"
        :phase="updatePhase"
        :candidate-version="updateState.candidate?.version"
        :progress-percent="updateProgressPercent"
        @download="updates?.download()"
        @cancel="updates?.cancelDownload()"
        @install="updates?.install()"
        @check="updates?.check()"
      />

      <SettingsBuildSection v-if="activeSection === 'support'" />
    </div>

    <p v-if="lastSavedLabel" class="settings-panel__hint">{{ t('panels.settings.hints.savedAt', { time: lastSavedLabel }) }}</p>

    <FeedbackDialog :open="feedbackOpen" @close="feedbackOpen = false" />

    <ConfirmModal
      :open="pendingConfirm !== null"
      :title="pendingConfirm?.title ?? ''"
      :message="pendingConfirm?.message ?? ''"
      :danger="pendingConfirm?.danger ?? false"
      @confirm="resolvePendingConfirm"
      @cancel="cancelPendingConfirm"
    />

    <!-- B1.9 - guest-abandon: explains sole-credential loss, offers
         upgrade / export / cancel before the destructive choice. -->
    <GuestAbandonDialog
      :open="logoutDialog === 'abandon'"
      :busy="logoutBusy"
      @upgrade="onAbandonUpgrade"
      @export="onAbandonExport"
      @abandon="void runLogout()"
      @cancel="logoutDialog = 'none'"
    />

    <!-- B1.9 - flush failed: retry the ordered logout or take the
         explicit unsynced-progress acknowledgement. -->
    <ConfirmModal
      :open="logoutDialog === 'unsynced'"
      :title="t('panels.settings.confirm.logoutUnsyncedTitle')"
      :message="t('panels.settings.confirm.logoutUnsyncedBody')"
      :confirm-label="t('panels.settings.confirm.logoutUnsyncedConfirm')"
      danger
      @confirm="void runLogout(true)"
      @cancel="logoutDialog = 'none'"
    />
  </div>
</template>

<style scoped>
/* Scene 17: left seal nav | right workspace (imperial scroll content). */
.settings-panel {
  height: 100%;
  width: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(140px, 190px) minmax(0, 1fr);
  gap: 16px;
  padding: 6px 2px;
  color: var(--paper-text);
  font-size: var(--text-body);
}

.settings-panel__workspace {
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 8px;
}

@container (max-width: 760px) {
  .settings-panel { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
  .settings-panel :deep(.settings-panel__nav) { flex-direction: row; flex-wrap: wrap; }
}

.settings-panel__hint {
  color: var(--jade);
  margin: 8px 0 0;
}
</style>
