/**
 * R14 / R9 (AR-21) guard — paid random results require a domain-owned
 * capability (ticket) and the commit path can never trust caller-supplied
 * outcomes.
 *
 * The runtime contract already exists (R9):
 *  - previewWashAffixes() pays the cost, rolls, and stores the result in a
 *    single domain-owned pending slot, returning only a ticketId.
 *  - commitWashAffixes() CONSUMES the ticket on every attempt and applies
 *    the domain-held affixes — never caller data.
 *  - getWashPreviewAffixes() hands the UI a display copy.
 *  - The refine pending preview is EquipmentSystem instance state.
 *
 * Behavioral coverage lives in GameManager.r9qa.test.ts /
 * EquipmentWash.pending.test.ts. This STATIC guard pins the contract so a
 * refactor cannot silently weaken it (e.g. moving slot writes into an
 * adapter, letting commit skip the consume, or handing out the live
 * affixes array).
 *
 * Regression class: a paid preview result that presentation can invent,
 * replay, or mutate — the exact failure mode AR-21 / QA-R9-001 fixed.
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { readTs, srcCorpus, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()
const WASH_FILE = join(GAME_ROOT, 'src/core/equipment/EquipmentWash.ts')
const SRC_DIR = join(GAME_ROOT, 'src')

/** Strip line + block comments so identifiers in comments can't trip the scan. */
function uncommented(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/\/\/[^\n]*/g, '')
}

/** Slice a top-level `export function name(` body to its closing `}` at column 0. */
function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature)
  expect(start, `${signature} definition not found`).toBeGreaterThanOrEqual(0)

  const rest = source.slice(start)
  const end = rest.search(/\n\}/)
  expect(end, `${signature} body end not found`).toBeGreaterThan(0)

  return rest.slice(0, end)
}

describe('R14/R9 — paid random result requires domain-owned capability', () => {
  const washSource = readTs(WASH_FILE)

  it('washPendingSlot is written only inside EquipmentWash.ts (domain owner)', { timeout: SCAN_TIMEOUT }, () => {
    const offenders: string[] = []

    for (const file of srcCorpus(SRC_DIR)) {
      if (file.fromSrc === 'core/equipment/EquipmentWash.ts') continue
      if (file.path.endsWith('.test.ts')) continue

      const text = uncommented(file.text)

      if (/washPendingSlot\.(set|nextTicketId)\s*\(/.test(text)) {
        offenders.push(file.fromSrc)
      }
    }

    expect(offenders, 'files writing the wash pending slot outside the domain owner').toEqual([])
  })

  it('commitWashAffixes consumes the ticket before validating it (every attempt spends the capability)', () => {
    const body = functionBody(uncommented(washSource), 'export function commitWashAffixes(')

    const consume = body.search(/washPendingSlot\.set\(null\)/)
    const validate = body.search(/pending\.ticketId\s*!==\s*ticketId/)

    expect(consume, 'commit must clear the pending slot').toBeGreaterThanOrEqual(0)
    expect(validate, 'commit must validate ticketId identity').toBeGreaterThanOrEqual(0)
    expect(consume < validate, 'consume must precede validation — a failed commit still spends the ticket').toBe(true)
  })

  it('commitWashAffixes applies the domain-held roll, never caller-supplied affixes', () => {
    const body = functionBody(uncommented(washSource), 'export function commitWashAffixes(')

    expect(
      /instance\.affixes\s*=\s*pending\.affixes/.test(body),
      'commit must apply pending.affixes (domain-held), not a parameter',
    ).toBe(true)
    // The signature must take a ticketId, not an affix payload.
    expect(/affixes\s*:/.test(body.split(')')[0]!), 'commit signature must not accept caller affixes').toBe(false)
  })

  it('previewWashAffixes pays the cost (rollWashAffixes) before issuing the ticket', () => {
    const body = functionBody(uncommented(washSource), 'export function previewWashAffixes(')

    const roll = body.search(/rollWashAffixes\(/)
    const ticket = body.search(/washPendingSlot\.set\(/)

    expect(roll, 'preview must roll through rollWashAffixes (which pays cost)').toBeGreaterThanOrEqual(0)
    expect(ticket, 'preview must store the result in the pending slot').toBeGreaterThanOrEqual(0)
    expect(roll < ticket, 'cost must be paid before the ticket is issued').toBe(true)
  })

  it('getWashPreviewAffixes returns a display copy, not the live affixes array', () => {
    const body = functionBody(uncommented(washSource), 'export function getWashPreviewAffixes(')

    expect(
      /pending\.affixes\.map\(/.test(body),
      'preview read must clone affixes — handing out the live array lets the UI mutate domain state',
    ).toBe(true)
    expect(
      /return\s*\{\s*affixes:\s*pending\.affixes\s*\}/.test(body),
      'preview read must not return pending.affixes verbatim',
    ).toBe(false)
  })

  it('the refine pending preview stays EquipmentSystem instance state', { timeout: SCAN_TIMEOUT }, () => {
    const offenders: string[] = []

    for (const file of srcCorpus(SRC_DIR)) {
      if (file.fromSrc === 'core/equipment/EquipmentSystem.ts') continue
      if (file.path.endsWith('.test.ts')) continue

      if (/\bpendingRefinePreview\b/.test(uncommented(file.text))) {
        offenders.push(file.fromSrc)
      }
    }

    expect(offenders, 'files touching pendingRefinePreview outside EquipmentSystem').toEqual([])
  })

  it('EquipmentWash domain functions have a single production importer (EquipmentSystem)', { timeout: SCAN_TIMEOUT }, () => {
    const importers: string[] = []

    for (const file of srcCorpus(SRC_DIR)) {
      if (file.path.endsWith('.test.ts')) continue
      if (file.fromSrc === 'core/equipment/EquipmentWash.ts') continue

      if (/from\s+['"][^'"]*EquipmentWash['"]/.test(uncommented(file.text))) {
        importers.push(file.fromSrc)
      }
    }

    expect(
      importers,
      'paid-wash domain functions must stay behind the EquipmentSystem owner — adapters call the manager surface',
    ).toEqual(['core/equipment/EquipmentSystem.ts'])
  })
})
