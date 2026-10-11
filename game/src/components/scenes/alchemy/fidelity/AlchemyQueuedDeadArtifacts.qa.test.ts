// QA R4 attack repro (blind wave 4) - FINDING R4-ALCH-1 (LOW).
//
// Attack vector: the job-card label fix made EVERY card render
// `job-card--brewing` + t('alchemy.brewing') unconditionally
// (AlchemyFidelityScene.vue:210, :213). Domain truth holds - every
// restored job is genuinely in-flight (all orders brew in parallel,
// dormant families filtered upstream in AlchemySurface.vue:238-239),
// so the label itself is honest.
//
// But the change orphaned the sequential-model artifacts it replaced:
//   - dead CSS rules `.job-card--queued { opacity: .55 }` (:300) and
//     `.job-card--queued .job-card__state` (:306) - no class binding or
//     template branch can ever emit 'job-card--queued' again.
//   - dead locale key `alchemy.queued` in BOTH catalogs
//     (en.json:1602, vi.json:1602) - the 'Cho #N' state label has no
//     remaining t() consumer.
//
// Honest-flow reachability: these bytes ship in every build and every
// locale bundle; they are dead weight that reads as a live queued
// state and will mislead the next reader.
//
// Repro: the scene source must not reference 'job-card--queued' and
// the production catalogs must not carry 'alchemy.queued'.
// Deterministic - static source/catalog check. FAIL on current HEAD.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import vi from '@/locales/vi.json'

type Dict = Record<string, unknown>
const alchemyEn = (en as Dict).alchemy as Dict
const alchemyVi = (vi as Dict).alchemy as Dict

const sceneSource = readFileSync(
  new URL('./AlchemyFidelityScene.vue', import.meta.url),
  'utf8',
)

describe('R4-ALCH-1 - no dead queued-state artifacts remain after all-cards-brewing', () => {
  it('AlchemyFidelityScene.vue carries no job-card--queued references', () => {
    expect(sceneSource).not.toContain('job-card--queued')
  })

  it('en.json drops the orphaned alchemy.queued key', () => {
    expect(alchemyEn['queued']).toBeUndefined()
  })

  it('vi.json drops the orphaned alchemy.queued key', () => {
    expect(alchemyVi['queued']).toBeUndefined()
  })
})
