import { describe, expect, it } from 'vitest'
import { CULTIVATION_PATH_KITS } from './CultivationPathKit'
import { CULTIVATION_PATH_STAT_DOMAINS, DOMAIN_SOURCE_WHITELIST } from '../stats/StatDomain'

// The Tu Reimagined Task 1 — the_tu (Hien) and the_tu_an (An) are real
// CultivationPathIds with their own kit rows (spec T1/T8). the_tu
// reuses the existing kim_cang_bat_hoai_the technique; the_tu_an gets
// the new ung_the_than_quyet.
describe('CULTIVATION_PATH_KITS — the_tu paths', () => {
  it('the_tu (Hien) resolves with the existing kim_cang_bat_hoai_the technique', () => {
    expect('the_tu' in CULTIVATION_PATH_KITS).toBe(true)

    const kit = CULTIVATION_PATH_KITS['the_tu' as keyof typeof CULTIVATION_PATH_KITS]

    expect(kit?.techniqueId).toBe('kim_cang_bat_hoai_the')
  })

  it('the_tu_an (An) resolves with the new ung_the_than_quyet technique', () => {
    expect('the_tu_an' in CULTIVATION_PATH_KITS).toBe(true)

    const kit = CULTIVATION_PATH_KITS['the_tu_an' as keyof typeof CULTIVATION_PATH_KITS]

    expect(kit?.techniqueId).toBe('ung_the_than_quyet')
  })
})

describe('stat domains — the_tu_an', () => {
  it("CULTIVATION_PATH_STAT_DOMAINS maps the_tu_an to its own domain", () => {
    expect(CULTIVATION_PATH_STAT_DOMAINS['the_tu_an']).toEqual(['the_tu_an'])
    expect(CULTIVATION_PATH_STAT_DOMAINS['the_tu']).toEqual(['the_tu'])
  })

  it('DOMAIN_SOURCE_WHITELIST declares the the_tu / the_tu_an emitter homes', () => {
    const theTuFiles = (DOMAIN_SOURCE_WHITELIST.the_tu ?? []).map((e) => e.file)
    const theTuAnFiles = (DOMAIN_SOURCE_WHITELIST.the_tu_an ?? []).map((e) => e.file)

    expect(theTuFiles).toContain('data/progression/TheTu*')
    expect(theTuFiles).toContain('data/skill/TheTu*')
    expect(theTuFiles).toContain('data/buff/TheTu*')
    expect(theTuAnFiles).toContain('data/progression/TheTuAn*')
    expect(theTuAnFiles).toContain('data/skill/TheTu*')
    expect(theTuAnFiles).toContain('data/buff/TheTu*')
  })
})
