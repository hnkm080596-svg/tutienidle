// BETA-FINAL PR13 / spec B7 - feedback draft contract tests.
import { describe, expect, it } from 'vitest'
import {
  FEEDBACK_LIMITS,
  feedbackDraftBytes,
  serializeFeedbackReport,
  validateFeedbackDraft,
  type FeedbackDraftInput,
} from './FeedbackDraft'
import type { BuildIdentity } from '../build/BuildIdentity'
import type { DiagnosticEvent } from '../diagnostics/DiagnosticEvent'

const BUILD: BuildIdentity = {
  productName: 'tutienidle',
  appVersion: '0.0.0',
  buildId: 'beta-test-build',
  gitSha: 'abc1234',
  saveSchemaVersion: 87,
  backendEnvironment: 'staging',
  releaseChannel: 'beta',
  builtAtUtc: '2026-09-30T00:00:00Z',
}

function validInput(overrides: Partial<FeedbackDraftInput> = {}): FeedbackDraftInput {
  return {
    category: 'bug',
    description: 'The merge gate stays open after defeat.',
    build: BUILD,
    ...overrides,
  }
}

function event(index: number): DiagnosticEvent {
  return {
    source: 'renderer',
    severity: 'error',
    category: 'lifecycle',
    code: `EV_${index}`,
    message: `event ${index}`,
    seq: index,
    atUtc: '2026-09-30T00:00:00Z',
  }
}

describe('validateFeedbackDraft', () => {
  it('accepts a minimal draft and trims free text', () => {
    const result = validateFeedbackDraft(validInput({ description: '  padded  ' }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.draft.description).toBe('padded')
      expect(result.draft.steps).toBeUndefined()
      expect(result.draft.diagnostics).toBeUndefined()
    }
  })

  it('rejects empty description and unknown categories', () => {
    expect(validateFeedbackDraft(validInput({ description: '   ' })).ok).toBe(false)
    expect(validateFeedbackDraft(validInput({ category: 'spam' })).ok).toBe(false)
    const bad = validateFeedbackDraft(validInput({ description: '' }))
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.code).toBe('empty-description')
  })

  it('rejects oversized fields and oversized reports', () => {
    const huge = 'x'.repeat(FEEDBACK_LIMITS.maxDescriptionChars + 1)
    expect(validateFeedbackDraft(validInput({ description: huge })).ok).toBe(false)
    const steps = 'y'.repeat(FEEDBACK_LIMITS.maxStepsChars + 1)
    expect(validateFeedbackDraft(validInput({ steps })).ok).toBe(false)
    const contact = 'z'.repeat(FEEDBACK_LIMITS.maxContactChars + 1)
    expect(validateFeedbackDraft(validInput({ contact })).ok).toBe(false)
    const route = 'r'.repeat(FEEDBACK_LIMITS.maxRouteChars + 1)
    expect(validateFeedbackDraft(validInput({ route })).ok).toBe(false)
  })

  it('enforces context key/value bounds', () => {
    expect(
      validateFeedbackDraft(validInput({ context: { 'bad key!': 1 } })).ok,
    ).toBe(false)
    expect(
      validateFeedbackDraft(
        validInput({ context: { nested: { deep: true } as unknown as string } }),
      ).ok,
    ).toBe(false)
    const tooMany = Object.fromEntries(
      Array.from({ length: FEEDBACK_LIMITS.maxContextKeys + 1 }, (_, i) => [`k${i}`, i]),
    )
    expect(validateFeedbackDraft(validInput({ context: tooMany })).ok).toBe(false)
  })

  it('enforces diagnostic count and byte caps', () => {
    const events = Array.from({ length: FEEDBACK_LIMITS.maxDiagnosticsEvents + 1 }, (_, i) => event(i))
    expect(validateFeedbackDraft(validInput({ diagnostics: events })).ok).toBe(false)
    const fat = { ...event(0), details: { blob: 'x'.repeat(FEEDBACK_LIMITS.maxDiagnosticEventBytes) } }
    expect(validateFeedbackDraft(validInput({ diagnostics: [fat] })).ok).toBe(false)
  })

  it('scrubs secrets and paths from free-text fields', () => {
    const result = validateFeedbackDraft(
      validInput({
        description: 'token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c at C:\\Users\\me\\save.json',
        contact: 'reach me at user@example.com',
      }),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.draft.description).not.toContain('eyJzdWIiOiIxMjM0NTY3ODkwIn0')
      expect(result.draft.description).not.toContain('C:\\Users\\me\\save.json')
      // Contact intentionally keeps emails - it is how the player leaves a
      // reply channel; tokens/paths are still scrubbed there.
      expect(result.draft.contact).toContain('user@example.com')
    }
  })
})

describe('serializeFeedbackReport + feedbackDraftBytes', () => {
  it('serializes the exact wire shape the RPC expects', () => {
    const validation = validateFeedbackDraft(
      validInput({ steps: 'step', contact: 'c', route: 'home', context: { saveRevision: 3 } }),
    )
    expect(validation.ok).toBe(true)
    if (!validation.ok) return
    const report = serializeFeedbackReport(validation.draft)
    expect(report.category).toBe('bug')
    expect(report.description).toBe('The merge gate stays open after defeat.')
    expect(report.clientBuild).toEqual({
      productName: 'tutienidle',
      appVersion: '0.0.0',
      buildId: 'beta-test-build',
      gitSha: 'abc1234',
      saveSchemaVersion: 87,
      backendEnvironment: 'staging',
      releaseChannel: 'beta',
      builtAtUtc: '2026-09-30T00:00:00Z',
    })
    expect(report.context).toEqual({ saveRevision: 3 })
    expect(feedbackDraftBytes(validation.draft)).toBe(
      new TextEncoder().encode(JSON.stringify(report)).length,
    )
  })

  it('documents the measured fixture the interim limits were sized on', () => {
    // EXT-06 measurement fixture: a maximal realistic report - full-length
    // description + steps and 50 typical redacted events - must stay under
    // the report byte ceiling with margin.
    const validation = validateFeedbackDraft(
      validInput({
        description: 'd'.repeat(FEEDBACK_LIMITS.maxDescriptionChars),
        steps: 's'.repeat(FEEDBACK_LIMITS.maxStepsChars),
        contact: 'c'.repeat(FEEDBACK_LIMITS.maxContactChars),
        route: 'r'.repeat(20),
        diagnostics: Array.from({ length: FEEDBACK_LIMITS.maxDiagnosticsEvents }, (_, i) => event(i)),
      }),
    )
    expect(validation.ok).toBe(true)
    if (validation.ok) {
      const bytes = feedbackDraftBytes(validation.draft)
      // Measured: a maximal realistic fixture lands around 11.5KB - inside
      // the 48KB interim ceiling with room for stack-heavier events.
      expect(bytes).toBeGreaterThan(10 * 1024)
      expect(bytes).toBeLessThan(FEEDBACK_LIMITS.maxReportBytes)
    }
  })
})
