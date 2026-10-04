import { describe, expect, it } from 'vitest'
import type { SkillPresentationResolved } from '@/core/battle/turn/SkillPresentationFacts'
import { animatedArtFormFor } from '@/presentation/art/CombatPresentationCatalogue'
import { clipImpactMs } from '@/presentation/art/CombatEntityPresentation'
import { hoaCauTiming, sampleHoaCauTimeline, landedHoaCauTargets } from './HoaCauFireballTimeline'

describe('Hỏa Cầu visual timeline', () => {
  it('hands the center from full portal to charge to existing projectile', () => {
    const timing = hoaCauTiming(3687.5)
    expect(timing.portalStartMs).toBe(625)
    expect(timing.chargeStartMs).toBe(1425)
    expect(timing.releaseMs).toBe(3125)
    expect(timing.closeDurationMs).toBe(500)
    expect(sampleHoaCauTimeline(624, 3687.5).portal).toBe('none')
    expect(sampleHoaCauTimeline(625, 3687.5).portal).toBe('open')
    expect(sampleHoaCauTimeline(1424, 3687.5).portal).toBe('open')
    expect(sampleHoaCauTimeline(1425, 3687.5).portal).toBe('active')
    expect(sampleHoaCauTimeline(3124, 3687.5).chargeFrame).toBe(17)
    expect(sampleHoaCauTimeline(3125, 3687.5).chargeFrame).toBeNull()
    expect(sampleHoaCauTimeline(3125, 3687.5).portal).toBe('close')
    expect(sampleHoaCauTimeline(3125, 3687.5).projectileProgress).toBe(0)
    expect(sampleHoaCauTimeline(3625, 3687.5).portal).toBe('none')
    expect(sampleHoaCauTimeline(3687.5, 3687.5).projectileProgress).toBe(1)
  })

  it('scales the phases for a shorter real clip without reversing events', () => {
    const timing = hoaCauTiming(1400)
    expect(timing.chargeStartMs).toBeLessThan(timing.releaseMs)
    expect(timing.releaseMs).toBeLessThan(1400)
    expect(sampleHoaCauTimeline(timing.releaseMs, 1400).projectileProgress).toBe(0)
  })

  it('keeps the full 550 ms charge before the Pháp Tu basic release marker', () => {
    const impact = clipImpactMs(animatedArtFormFor('phap_tu_shared')!.attack!)
    expect(impact).toBe(1312.5)
    const timing = hoaCauTiming(impact)
    expect(timing.portalStartMs).toBeLessThan(timing.chargeStartMs)
    expect(timing.chargeStartMs).toBeLessThan(timing.releaseMs)
    expect(timing.releaseMs).toBeLessThan(impact)
  })

  it('gives Hỏa Cầu its own readable cast and projectile travel without changing shared basic attacks', () => {
    const art = animatedArtFormFor('phap_tu_shared')!
    const fireballClip = art.castClips?.hoa_cau_thuat
    expect(fireballClip).toBeDefined()
    expect(fireballClip?.sheetKey).toBe(art.attack?.sheetKey)
    expect(fireballClip?.framePrefix).toBe(art.attack?.framePrefix)
    expect(fireballClip?.frameSequence?.[5]).toBe(12)
    expect(fireballClip?.frameSequence?.[29]).toBe(12)
    expect(fireballClip?.frameSequence?.[30]).toBe(14)
    expect(clipImpactMs(art.attack!)).toBe(1312.5)
    const timing = hoaCauTiming(clipImpactMs(fireballClip!))
    expect(timing.impactMs).toBe(3687.5)
    expect(timing.chargeDurationMs).toBe(1700)
    expect(timing.releaseMs).toBe(3125)
    expect(timing.travelMs).toBe(562.5)
  })

  it('only emits landed primary hit targets', () => {
    const target = { entityId: 'enemy-1', row: 1, column: 2 }
    const resolved = {
      ref: { sessionId: 1, requestId: 'a', token: 't' }, sealed: true,
      groups: [
        { groupId: 'primary', role: 'primary', outcomes: [
          { kind: 'hit', target, landed: true },
          { kind: 'hit', target, landed: true },
          { kind: 'hit', target: { entityId: 'enemy-2', row: 2, column: 3 }, landed: false },
        ] },
        { groupId: 'combo', role: 'combo', outcomes: [{ kind: 'hit', target: { entityId: 'enemy-3', row: 3, column: 4 }, landed: true }] },
      ],
    } as unknown as SkillPresentationResolved
    expect(landedHoaCauTargets(resolved)).toEqual([target])
  })
})
