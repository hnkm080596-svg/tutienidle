/**
 * R14.5 guard (R8.2 outcome ownership) - the progression fields AR-10
 * flagged are written ONLY by the domain outcome services (slices 1-3,
 * merged 2026-09-11). Vue/stores/components must never write them again.
 *
 * Regression class: Mission 0 AR-10 verbatim - "consequential progression
 * outcome remains in Vue" (a Vue composable wrote the lineage-closure
 * record while the domain BreakthroughGrades read it). If a future
 * change adds a second writer anywhere under src/ outside the
 * allowlist, this guard fails the suite before review can miss it.
 *
 * Field retarget (2026-09-24 hidden lineage): the retired token
 * greatDaoOpportunityLost is replaced by lineageActive - the live
 * one-way latch closeHiddenLineage owns in HiddenLineage.ts.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { listProductionTs, readTs, SCAN_TIMEOUT } from './helpers/scanTs'

const GAME_ROOT = process.cwd()

/** The only production files allowed to write these fields. */
const OWNERS: Record<string, string[]> = {
  lineageActive: ['src/core/realm/hidden/HiddenLineage.ts'],
  highestFoundationAchieved: ['src/core/tribulation/TribulationOutcomeService.ts'],
}

/** Object-literal property declarations (e.g. Player.ts defaults) are not writes. */
const WRITE_RE = /\.(lineageActive|highestFoundationAchieved)\s*[+\-]?=[^=]/

function listVueAndTs(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listVueAndTs(full))
    } else if ((entry.endsWith('.ts') || entry.endsWith('.vue')) && !entry.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('R14.5 — R8.2 outcome fields are domain-owned', () => {
  it('lineageActive / highestFoundationAchieved are written only by the domain owners', { timeout: SCAN_TIMEOUT }, () => {
    const offenders: string[] = []
    // Scan the whole src tree (production only; tests are allowed fixtures).
    for (const file of listProductionTs(join(GAME_ROOT, 'src'))) {
      const rel = relative(GAME_ROOT, file).replaceAll('\\', '/')
      if (rel.endsWith('.d.ts')) continue
      const source = readTs(file)
      let m: RegExpExecArray | null
      const re = new RegExp(WRITE_RE.source, 'g')
      while ((m = re.exec(source)) !== null) {
        const field = m[1]!
        if (OWNERS[field]?.includes(rel)) continue
        offenders.push(`${rel} writes .${field}`)
      }
    }
    // .vue files cannot be plain production ts but may still bind writes.
    for (const file of listVueAndTs(join(GAME_ROOT, 'src'))) {
      if (!file.endsWith('.vue')) continue
      const rel = relative(GAME_ROOT, file).replaceAll('\\', '/')
      const source = readTs(file)
      let m: RegExpExecArray | null
      const re = new RegExp(WRITE_RE.source, 'g')
      while ((m = re.exec(source)) !== null) {
        offenders.push(`${rel} writes .${m[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the adapters stay presentation-only: zero player-state writes remain', () => {
    const adapterFields =
      /\.(realmId|realmLevel|cultivation|highestFoundationAchieved|lineageActive|selectedTalentIds|artifact)\s*[+\-]?=[^=]/
    for (const adapter of [
      'src/composables/useTribulation.ts',
      'src/composables/useBreakthrough.ts',
    ]) {
      const source = readTs(join(GAME_ROOT, adapter))
      const hit = source.match(adapterFields)
      expect(hit, `${adapter} must not write player state (R8.2) — found ${hit?.[0]}`).toBeNull()
    }
  })
})
