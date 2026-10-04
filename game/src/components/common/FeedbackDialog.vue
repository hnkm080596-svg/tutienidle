<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { i18n } from '@/i18n'
import OverlayPanel from './OverlayPanel.vue'
import GameButton from './GameButton.vue'
import Chip from './primitives/Chip.vue'
import InkNineSlice from './primitives/InkNineSlice.vue'
import { OVERLAY_LAYERS } from '@/core/presentation/OverlayLayers'
import { BUILD_IDENTITY } from '@/shared/build/BuildIdentity'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_LIMITS,
  feedbackDraftBytes,
  serializeFeedbackReport,
  validateFeedbackDraft,
  type FeedbackCategory,
  type FeedbackContext,
  type FeedbackDraftInput,
} from '@/shared/feedback/FeedbackDraft'
import {
  getFeedbackService,
  getFeedbackProviders,
  newFeedbackIdempotencyKey,
  type FeedbackSubmitResult,
} from '@/services/feedback/FeedbackService'
import { getDiagnosticRecorder } from '@/services/diagnostics/DiagnosticRecorder'
import type { DiagnosticEvent } from '@/shared/diagnostics/DiagnosticEvent'

// BETA-FINAL PR13 / spec B7 - beta feedback intake dialog.
//
// Contract with the player: what you see in the preview is what is sent;
// attached diagnostics are the recorder's already-redacted events and only
// ship behind an explicit opt-in checkbox; a failed submit keeps the draft
// (fields + the minted idempotency key persist in sessionStorage so a retry
// after close/reload still dedupes server-side); local export always works
// - no auth or network needed - so the report never dies with a dead
// session. On success the stable server report id is shown + copyable.
//
// i18n.global.t (not useI18n): dialog tests mount through a bare createApp
// without installing the plugin (same convention as ConfirmModal).

const props = withDefaults(defineProps<{
  open: boolean
  /** Overlay z-index; raised when the dialog opens above the app-error
   *  surface (which itself sits at OVERLAY_LAYERS.appError). */
  layer?: number
  /** Prefilled description for callers that know why the dialog opened
   *  (e.g. the error screen passes the error message). A stored draft
   *  always wins over this hint. */
  initialDescription?: string
}>(), {
  layer: OVERLAY_LAYERS.modal,
  initialDescription: '',
})

const emit = defineEmits<{ close: [] }>()

const DRAFT_STORAGE_KEY = 'tien-hiep-idle-feedback-draft'

interface StoredFeedbackDraft {
  category: string
  description: string
  steps: string
  contact: string
  attachDiagnostics: boolean
  idempotencyKey: string
  /** Fingerprint of the report content the key was minted for. */
  idempotencyFingerprint: string
}

const category = ref<FeedbackCategory>('bug')
const description = ref('')
const steps = ref('')
const contact = ref('')
const attachDiagnostics = ref(false)
// The idempotency key is bound to the exact report content it was minted
// for: an identical retry dedupes server-side, but an edited draft is a
// different report and needs a fresh key or the server correctly rejects
// it as FEEDBACK_IDEMPOTENCY_REUSED.
const idempotencyKey = ref(newFeedbackIdempotencyKey())
const idempotencyFingerprint = ref('')
const submitting = ref(false)
const result = ref<FeedbackSubmitResult | null>(null)
const fieldError = ref<string>('')
const exported = ref(false)
const copied = ref(false)

const recorder = getDiagnosticRecorder()
const diagnosticEvents = computed<readonly DiagnosticEvent[]>(() => recorder?.events ?? [])
// The ring holds up to 200 events but a report caps at maxDiagnosticsEvents
// / maxDiagnosticsBytes - so the attachment keeps the NEWEST events that
// fit, oldest dropping first (same policy as the diagnostics bundle
// export). Attaching the whole ring would make validation unfixable for
// the user whenever the buffer exceeds the caps.
const attachEvents = computed<readonly DiagnosticEvent[]>(() => {
  const events = diagnosticEvents.value
  const picked: DiagnosticEvent[] = []
  const encoder = new TextEncoder()
  let bytes = 2 // '[]'
  for (let i = events.length - 1; i >= 0 && picked.length < FEEDBACK_LIMITS.maxDiagnosticsEvents; i--) {
    const event = events[i]!
    const size = encoder.encode(JSON.stringify(event)).length + (picked.length > 0 ? 1 : 0)
    if (bytes + size > FEEDBACK_LIMITS.maxDiagnosticsBytes) break
    bytes += size
    picked.push(event)
  }
  return picked.reverse()
})
const diagnosticCount = computed(() => attachEvents.value.length)
const diagnosticReportId = computed(() => recorder?.reportId ?? '')

function resetFields() {
  category.value = 'bug'
  description.value = ''
  steps.value = ''
  contact.value = ''
  attachDiagnostics.value = false
}

function restoreDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY)
    // No stored draft means a fresh report - clear any leftover field
    // values (e.g. the text of a report that was just accepted).
    if (!raw) {
      resetFields()
      return
    }
    const stored = JSON.parse(raw) as Partial<StoredFeedbackDraft>
    if (typeof stored.category === 'string' && (FEEDBACK_CATEGORIES as readonly string[]).includes(stored.category)) {
      category.value = stored.category as FeedbackCategory
    }
    description.value = typeof stored.description === 'string' ? stored.description : ''
    steps.value = typeof stored.steps === 'string' ? stored.steps : ''
    contact.value = typeof stored.contact === 'string' ? stored.contact : ''
    attachDiagnostics.value = stored.attachDiagnostics === true
    if (typeof stored.idempotencyKey === 'string' && stored.idempotencyKey.length > 0) {
      idempotencyKey.value = stored.idempotencyKey
      idempotencyFingerprint.value = typeof stored.idempotencyFingerprint === 'string'
        ? stored.idempotencyFingerprint
        : ''
    }
  } catch {
    // A corrupt stored draft never blocks the form - it just restarts empty.
    resetFields()
  }
}

function persistDraft() {
  try {
    const stored: StoredFeedbackDraft = {
      category: category.value,
      description: description.value,
      steps: steps.value,
      contact: contact.value,
      attachDiagnostics: attachDiagnostics.value,
      idempotencyKey: idempotencyKey.value,
      idempotencyFingerprint: idempotencyFingerprint.value,
    }
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Storage-denied still leaves the live form intact; only the
    // close/reopen restore path is lost.
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    /* see persistDraft */
  }
}

watch(
  () => props.open,
  (open, wasOpen) => {
    if (open && !wasOpen) {
      restoreDraft()
      if (description.value === '' && props.initialDescription !== '') {
        description.value = props.initialDescription
      }
      result.value = null
      fieldError.value = ''
      exported.value = false
      copied.value = false
    }
  },
  // immediate: a dialog mounted already-open still restores a stored draft.
  { immediate: true },
)

watch([category, description, steps, contact, attachDiagnostics], () => {
  if (result.value?.status !== 'accepted') persistDraft()
})

// Providers are caller-supplied late-bindings; a throwing provider must not
// take the form down with it - context fields are optional by contract.
function safeProvide<T>(provider: (() => T | undefined) | undefined): T | undefined {
  try {
    return provider?.()
  } catch {
    return undefined
  }
}

// The coarse gameplay context is built fresh at submit/export time so the
// preview and the wire always agree on what is being sent.
function buildContext(): FeedbackContext {
  const providers = getFeedbackProviders()
  const context: Record<string, string | number | boolean | null> = {}
  const revision = safeProvide(providers.saveRevision)
  if (revision !== undefined) context.saveRevision = revision
  context.saveSchemaVersion = BUILD_IDENTITY.saveSchemaVersion
  if (diagnosticReportId.value) context.diagnosticReportId = diagnosticReportId.value
  return context
}

// A function, not a computed: route/context are non-reactive reads, so a
// memoized computed would snapshot them at open time and a submit after a
// route change would carry stale coordinates. Called fresh at submit and
// export; the preview below wraps it only for the byte estimate.
function buildDraftInput(): FeedbackDraftInput {
  return {
    category: category.value,
    description: description.value,
    steps: steps.value,
    contact: contact.value,
    route: safeProvide(getFeedbackProviders().route),
    context: buildContext(),
    diagnostics: attachDiagnostics.value ? [...attachEvents.value] : undefined,
    build: BUILD_IDENTITY,
  }
}

const previewDraft = computed(() => {
  const validation = validateFeedbackDraft(buildDraftInput())
  return validation.ok ? validation.draft : null
})

const previewBytes = computed(() => (previewDraft.value ? feedbackDraftBytes(previewDraft.value) : 0))

const previewEvents = computed(() => attachEvents.value.slice(0, 8))

function eventLine(event: DiagnosticEvent): string {
  return `[${event.severity}] ${event.category}/${event.code} ${event.message}`
}

const canSubmit = computed(() => !submitting.value && description.value.trim().length > 0)

/** Returns the key for this exact report content, minting a fresh one when
 *  the content changed since the key was created. Identical content keeps
 *  the key, so a retry of the same report dedupes to the same reportId. */
function keyFor(reportJson: string): string {
  if (idempotencyFingerprint.value !== reportJson) {
    idempotencyKey.value = newFeedbackIdempotencyKey()
    idempotencyFingerprint.value = reportJson
  }
  return idempotencyKey.value
}

async function onSubmit() {
  if (submitting.value) return
  fieldError.value = ''
  result.value = null

  const validation = validateFeedbackDraft(buildDraftInput())
  if (!validation.ok) {
    fieldError.value = validation.detail
    return
  }

  const service = getFeedbackService()
  if (!service) {
    result.value = { status: 'unavailable', code: 'SERVICE_UNBOUND', retryable: false }
    return
  }

  submitting.value = true
  try {
    const key = keyFor(JSON.stringify(serializeFeedbackReport(validation.draft)))
    const outcome = await service.submit(validation.draft, key)
    result.value = outcome
    if (outcome.status === 'accepted') {
      clearDraft()
      idempotencyKey.value = newFeedbackIdempotencyKey()
      idempotencyFingerprint.value = ''
    } else {
      // Failure path: the draft (and its key) persist for retry/export.
      persistDraft()
    }
  } catch {
    result.value = { status: 'unavailable', code: 'NETWORK_UNAVAILABLE', retryable: true }
    persistDraft()
  } finally {
    submitting.value = false
  }
}

/** Local export: the exact wire payload plus draft metadata - always
 *  available, never needs auth or network. */
function onExport() {
  const input = buildDraftInput()
  const validation = validateFeedbackDraft({
    ...input,
    description: description.value.trim() || '-',
  })
  const payload = {
    formatVersion: 1,
    exportedAtUtc: new Date().toISOString(),
    idempotencyKey: idempotencyKey.value,
    report: validation.ok ? { ...input, ...validation.draft } : input,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `feedback-${idempotencyKey.value.slice(0, 8)}-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
  exported.value = true
}

async function copyReportId() {
  if (result.value?.status !== 'accepted') return
  try {
    await navigator.clipboard.writeText(result.value.reportId)
    copied.value = true
  } catch {
    copied.value = false
  }
}

function onClose() {
  if (submitting.value) return
  emit('close')
}

const statusMessage = computed(() => {
  const r = result.value
  if (!r) return ''
  switch (r.status) {
    case 'invalid':
      return i18n.global.t('betaFeedback.status.invalid', { detail: r.detail ?? r.code })
    case 'rate-limited':
      return i18n.global.t('betaFeedback.status.rateLimited', {
        seconds: r.retryAfterSeconds ?? '?',
      })
    case 'unavailable':
      return i18n.global.t('betaFeedback.status.unavailable')
    case 'session-revoked':
      return i18n.global.t('betaFeedback.status.sessionRevoked')
    default:
      return ''
  }
})

const title = computed(() => i18n.global.t('betaFeedback.title'))
</script>

<template>
  <Teleport to="body">
    <OverlayPanel
      :open="open"
      :title="title"
      variant="paper"
      width="min(660px, 94vw)"
      height="min(760px, 92vh)"
      :layer="props.layer"
      data-testid="feedback-dialog"
      @close="onClose"
    >
      <div class="feedback-dialog">
        <!-- Success state: stable server report id replaces the form. -->
        <div v-if="result?.status === 'accepted'" class="feedback-dialog__success" data-testid="feedback-success">
          <p class="feedback-dialog__success-title">{{ i18n.global.t('betaFeedback.status.accepted') }}</p>
          <p class="feedback-dialog__report-id" data-testid="feedback-report-id">{{ result.reportId }}</p>
          <div class="feedback-dialog__success-actions">
            <GameButton variant="secondary" size="sm" data-testid="feedback-copy-id" @click="copyReportId">
              {{ copied ? i18n.global.t('betaFeedback.actions.copied') : i18n.global.t('betaFeedback.actions.copyId') }}
            </GameButton>
            <GameButton variant="primary" size="sm" data-testid="feedback-done" @click="emit('close')">
              {{ i18n.global.t('panels.common.close') }}
            </GameButton>
          </div>
          <p class="feedback-dialog__hint">{{ i18n.global.t('betaFeedback.hints.reportId') }}</p>
        </div>

        <template v-else>
          <p class="feedback-dialog__intro">{{ i18n.global.t('betaFeedback.intro') }}</p>

          <div class="feedback-dialog__field">
            <span class="feedback-dialog__label" id="feedback-category-label">{{ i18n.global.t('betaFeedback.fields.category') }}</span>
            <div class="feedback-dialog__categories" role="radiogroup" aria-labelledby="feedback-category-label">
              <Chip
                v-for="option in FEEDBACK_CATEGORIES"
                :key="option"
                role="radio"
                :aria-checked="category === option"
                :active="category === option"
                :data-testid="`feedback-category-${option}`"
                @click="category = option"
              >
                {{ i18n.global.t(`betaFeedback.categories.${option}`) }}
              </Chip>
            </div>
          </div>

          <div class="feedback-dialog__field">
            <label class="feedback-dialog__label" for="feedback-description">
              {{ i18n.global.t('betaFeedback.fields.description') }}
            </label>
            <div class="feedback-dialog__field-frame">
              <InkNineSlice chrome-id="text-field" layer="surface" />
              <textarea
                id="feedback-description"
                v-model="description"
                class="feedback-dialog__textarea"
                data-testid="feedback-description"
                rows="5"
                :maxlength="FEEDBACK_LIMITS.maxDescriptionChars * 2"
                :placeholder="i18n.global.t('betaFeedback.placeholders.description')"
                :aria-describedby="fieldError ? 'feedback-error' : 'feedback-description-hint'"
              />
            </div>
            <div class="feedback-dialog__meta">
              <small id="feedback-description-hint" class="feedback-dialog__hint">
                {{ i18n.global.t('betaFeedback.hints.redaction') }}
              </small>
              <small class="feedback-dialog__counter">{{ description.length }}/{{ FEEDBACK_LIMITS.maxDescriptionChars }}</small>
            </div>
          </div>

          <div class="feedback-dialog__field">
            <label class="feedback-dialog__label" for="feedback-steps">
              {{ i18n.global.t('betaFeedback.fields.steps') }}
            </label>
            <div class="feedback-dialog__field-frame">
              <InkNineSlice chrome-id="text-field" layer="surface" />
              <textarea
                id="feedback-steps"
                v-model="steps"
                class="feedback-dialog__textarea"
                data-testid="feedback-steps"
                rows="3"
                :maxlength="FEEDBACK_LIMITS.maxStepsChars * 2"
                :placeholder="i18n.global.t('betaFeedback.placeholders.steps')"
              />
            </div>
          </div>

          <div class="feedback-dialog__field">
            <label class="feedback-dialog__label" for="feedback-contact">
              {{ i18n.global.t('betaFeedback.fields.contact') }}
            </label>
            <div class="feedback-dialog__field-frame">
              <InkNineSlice chrome-id="text-field" layer="surface" />
              <input
                id="feedback-contact"
                v-model="contact"
                class="feedback-dialog__input"
                data-testid="feedback-contact"
                type="text"
                :maxlength="FEEDBACK_LIMITS.maxContactChars * 2"
                :placeholder="i18n.global.t('betaFeedback.placeholders.contact')"
              />
            </div>
          </div>

          <div class="feedback-dialog__attach">
            <label class="feedback-dialog__attach-label" for="feedback-attach">
              <input
                id="feedback-attach"
                v-model="attachDiagnostics"
                type="checkbox"
                data-testid="feedback-attach"
                :disabled="diagnosticCount === 0"
              />
              {{ i18n.global.t('betaFeedback.attach.label', { count: diagnosticCount }) }}
            </label>
            <p class="feedback-dialog__hint">
              {{ i18n.global.t('betaFeedback.attach.hint') }}
              <template v-if="diagnosticEvents.length > attachEvents.length">
                {{ i18n.global.t('betaFeedback.attach.truncated', { count: attachEvents.length }) }}
              </template>
            </p>
            <ul v-if="attachDiagnostics && diagnosticCount > 0" class="feedback-dialog__events" data-testid="feedback-events-preview">
              <li v-for="event in previewEvents" :key="event.seq">{{ eventLine(event) }}</li>
              <li v-if="diagnosticCount > previewEvents.length" class="feedback-dialog__events-more">
                {{ i18n.global.t('betaFeedback.attach.more', { count: diagnosticCount - previewEvents.length }) }}
              </li>
            </ul>
          </div>

          <dl class="feedback-dialog__summary" data-testid="feedback-summary">
            <div class="feedback-dialog__summary-row">
              <dt>{{ i18n.global.t('betaFeedback.summary.build') }}</dt>
              <dd>{{ BUILD_IDENTITY.buildId }} ({{ BUILD_IDENTITY.appVersion }})</dd>
            </div>
            <div class="feedback-dialog__summary-row">
              <dt>{{ i18n.global.t('betaFeedback.summary.environment') }}</dt>
              <dd>{{ BUILD_IDENTITY.backendEnvironment }} / {{ BUILD_IDENTITY.releaseChannel }}</dd>
            </div>
            <div class="feedback-dialog__summary-row">
              <dt>{{ i18n.global.t('betaFeedback.summary.size') }}</dt>
              <dd data-testid="feedback-payload-size">{{ Math.ceil(previewBytes / 1024) }} KB</dd>
            </div>
          </dl>

          <p v-if="fieldError" id="feedback-error" class="feedback-dialog__error" role="alert" data-testid="feedback-field-error">
            {{ fieldError }}
          </p>
          <p v-else-if="statusMessage" class="feedback-dialog__error" role="alert" data-testid="feedback-status">
            {{ statusMessage }}
          </p>

          <div class="feedback-dialog__actions">
            <GameButton class="ghost-on-paper" variant="ghost" size="sm" data-testid="feedback-export" @click="onExport">
              {{ exported ? i18n.global.t('betaFeedback.actions.exported') : i18n.global.t('betaFeedback.actions.export') }}
            </GameButton>
            <GameButton
              variant="primary"
              size="sm"
              :disabled="!canSubmit"
              :loading="submitting"
              data-testid="feedback-submit"
              @click="onSubmit"
            >
              {{ i18n.global.t('betaFeedback.actions.submit') }}
            </GameButton>
          </div>
        </template>
      </div>
    </OverlayPanel>
  </Teleport>
</template>

<style scoped>
.feedback-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px;
  color: var(--paper-text);
  font-size: var(--text-sm);
  min-height: 0;
  overflow-y: auto;
}

.feedback-dialog__intro {
  margin: 0;
  color: var(--paper-text-soft);
}

.feedback-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.feedback-dialog__label {
  font-weight: 600;
  color: var(--paper-text);
  font-size: var(--text-sm);
}

.feedback-dialog__categories {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* The drawn text-field chrome owns the field shell (dark metal - the
   small-chrome rule); the input itself stays transparent on top of it
   and keeps light text for the dark field. */
.feedback-dialog__field-frame {
  position: relative;
}

.feedback-dialog__textarea,
.feedback-dialog__input {
  position: relative;
  z-index: 3;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 0;
  background: transparent;
  color: var(--hk-text-primary, #ede6d6);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  line-height: 1.5;
  resize: vertical;
}

.feedback-dialog__textarea::placeholder,
.feedback-dialog__input::placeholder {
  color: var(--hk-text-muted, #7a7260);
}

.feedback-dialog__textarea:focus-visible,
.feedback-dialog__input:focus-visible {
  outline: 2px solid var(--mineral-gold);
  outline-offset: 1px;
}

.feedback-dialog__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.feedback-dialog__hint {
  margin: 0;
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
}

.feedback-dialog__counter {
  color: var(--paper-text-soft);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.feedback-dialog__attach {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border: 1px dashed var(--paper-line);
  border-radius: var(--radius-sm);
}

.feedback-dialog__attach-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  cursor: pointer;
}

.feedback-dialog__events {
  margin: 4px 0 0;
  padding: 6px 8px;
  max-height: 120px;
  overflow-y: auto;
  list-style: none;
  background: color-mix(in srgb, var(--ink-800) 88%, transparent);
  color: var(--surface-text);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
  line-height: 1.5;
}

.feedback-dialog__events li {
  overflow-wrap: anywhere;
}

.feedback-dialog__events-more {
  color: var(--jade);
}

.feedback-dialog__summary {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--text-xs);
}

.feedback-dialog__summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.feedback-dialog__summary-row dt {
  color: var(--paper-text-soft);
}

.feedback-dialog__summary-row dd {
  margin: 0;
  color: var(--paper-text);
  font-family: var(--font-mono, monospace);
  text-align: right;
  overflow-wrap: anywhere;
}

.feedback-dialog__error {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--crimson);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--crimson) 12%, transparent);
  color: var(--crimson);
  font-size: var(--text-sm);
}

.feedback-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}

.feedback-dialog__success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 28px 12px;
  text-align: center;
}

.feedback-dialog__success-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-md);
  color: var(--jade);
}

.feedback-dialog__report-id {
  margin: 0;
  padding: 8px 14px;
  border: 1px solid var(--paper-line);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono, monospace);
  font-size: var(--text-sm);
  overflow-wrap: anywhere;
  user-select: all;
}
</style>
