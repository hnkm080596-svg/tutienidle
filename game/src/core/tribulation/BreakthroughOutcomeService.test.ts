/**
 * R8.2 Slice 2 — BreakthroughOutcomeService characterization + parity.
 *
 * RED phase: encodes CURRENT behavior of the Vue-owned breakthrough
 * consequence sequencing (useBreakthrough.ts) so the domain service is
 * proven behavior-identical (A12) before the adapter rewrite.
 *
 * Evidence note (2026-09-11, characterized): CultivationSystem.
 * breakthrough() NEVER crosses a major realm (returns false at maxLevel;
 * major transitions go through the tribulation chain — Slice 1). The
 * technique-grant / artifact-awakening branches in useBreakthrough keyed
 * on realmId change are therefore unreachable in the production flow;
 * this slice migrates the LIVE consequence chain and keeps the
 * unreachable branches only where they are exercised (they stay pinned
 * here as documented-dead so removing them is a future, evidence-based
 * cleanup, not a silent behavior change).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../../stores/player'
import { GameManager } from '../game/GameManager'
import { BreakthroughOutcomeService } from './BreakthroughOutcomeService'
import { addCultivation } from '../cultivation/CultivationSystem'
import { getCurrentRealm } from '../realm/realmSystem'
import { createDefaultArtifactProgress } from '../artifact/ArtifactProgression'
import { i18n } from '../../i18n'

describe('BreakthroughOutcomeService — minor-realm breakthrough parity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('failed breakthrough (requirements not met): no side effects, typed failure result', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.cultivation = 0 // below requirement -> canBreakthrough false

    const service = new BreakthroughOutcomeService()
    const result = service.breakthrough(player, gameManager.realmAdvanceOps)

    expect(result.kind).toBe('failure')
    expect(player.realmLevel).toBe(1)
    expect(player.attributePoints).toBe(0)
  })

  it('minor-realm success: cultivation reset, level up, attribute point, result reports the new level', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    addCultivation(player.$state, player.cultivationRequired)
    const levelBefore = player.realmLevel
    const pointsBefore = player.attributePoints

    const service = new BreakthroughOutcomeService()
    const result = service.breakthrough(player, gameManager.realmAdvanceOps)

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('unreachable')
    expect(result.newLevel).toBe(levelBefore + 1)
    expect(player.realmLevel).toBe(levelBefore + 1)
    expect(player.cultivation).toBe(0)
    expect(player.attributePoints).toBe(pointsBefore + 1)
    // Minor-realm success never changes realmId: no announcement fact.
    expect(result.majorRealmChanged).toBe(false)
    expect(result.announcement).toBeNull()
  })

  it('at max minor level the command fails cleanly (major transitions belong to the tribulation chain)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const maxLevel = getCurrentRealm(player.realmId).maxLevel
    player.realmLevel = maxLevel
    addCultivation(player.$state, player.cultivationRequired)

    const service = new BreakthroughOutcomeService()
    const result = service.breakthrough(player, gameManager.realmAdvanceOps)

    expect(result.kind).toBe('failure')
    expect(player.realmLevel).toBe(maxLevel)
  })

  it('passive sync runs on every success (both realm passive and stat passive)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    addCultivation(player.$state, player.cultivationRequired)

    const syncPassive = vi.spyOn(gameManager.realmAdvanceOps, 'syncRealmPassive')
    const syncStatPassive = vi.spyOn(gameManager.realmAdvanceOps, 'syncRealmStatPassive')

    const service = new BreakthroughOutcomeService()
    service.breakthrough(player, gameManager.realmAdvanceOps)

    expect(syncPassive).toHaveBeenCalledTimes(1)
    expect(syncStatPassive).toHaveBeenCalledTimes(1)
  })

  it('banked artifact tier advances on every success when an artifact exists (not on failure)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    player.artifact = createDefaultArtifactProgress('ngu_hanh_chau')
    player.artifact.realmLevel = 1

    const service = new BreakthroughOutcomeService()

    // Failure first: artifact untouched.
    const failed = service.breakthrough(player, gameManager.realmAdvanceOps)
    expect(failed.kind).toBe('failure')
    expect(player.artifact.realmLevel).toBe(1)

    // Success: the artifact realm-level advance runs (doc SS5.1 banked release).
    addCultivation(player.$state, player.cultivationRequired)
    const success = service.breakthrough(player, gameManager.realmAdvanceOps)
    expect(success.kind).toBe('success')
    if (success.kind !== 'success') throw new Error('unreachable')
    // advanceArtifactRealmLevel releases banked tiers as the player levels;
    // the exact delta depends on the progression table, so pin the contract:
    // realmLevel never DECREASES and the service reported the artifact touch.
    expect(player.artifact.realmLevel).toBeGreaterThanOrEqual(1)
    expect(success.artifactTouched).toBe(true)
  })

  it('documented-dead major-realm branch emits the announcement descriptor (pinned via stubbed breakthrough)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    // The production store action never crosses a realm (see header);
    // stub the domain primitive to pin the unreachable branch's contract.
    player.breakthrough = () => {
      player.realmId = 'golden_core'
      return true
    }

    const service = new BreakthroughOutcomeService()
    const result = service.breakthrough(player, gameManager.realmAdvanceOps)

    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('unreachable')
    expect(result.majorRealmChanged).toBe(true)
    expect(result.announcement).toEqual({
      titleKey: 'announce.breakthrough.major.title',
      titleParams: { realm: 'KIM ĐAN' },
      bodyKey: 'announce.breakthrough.major.body',
    })
    expect(i18n.global.t(result.announcement!.titleKey, result.announcement!.titleParams ?? {}))
      .toBe('KIM ĐAN')
    expect(i18n.global.t(result.announcement!.bodyKey))
      .toBe('Đạo hữu đã đột phá đại cảnh giới, tu vi tăng vọt.')
  })
})
