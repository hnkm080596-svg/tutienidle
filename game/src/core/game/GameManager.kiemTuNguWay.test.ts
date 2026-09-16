import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import {
  applyPathChoice,
  listOfferableWays,
} from '../player/CultivationPathSystem'
import { freshKiemTuState } from '../kiem-tu/KiemTuState'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'

// Cultivation Path Framework M6 — the ngu way is entered through the
// Initiation Ritual itself, gated by the way's offerGate
// (requiresSkillLevel tram Lv3 — the exact port of the retired
// kiem_tu_an node's skillCastCount level gate, reading the skillLevels
// mirror). There is no flip node any more: the commit is FREE (no
// insight cost) and PERMANENT (the authority rejects any second
// choice), and requiredWay — not a purchased root — isolates the hien
// orb branches from the ngu subtree.

function makeManager() {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)

  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12

  return { gameManager, player }
}

function mortalAtRitual(tramLevel: number) {
  const { gameManager, player } = makeManager()
  player.skillLevels = { tram: tramLevel }
  player.skillCastCounts = { tram: tramLevel >= 3 ? 10_000 : 9_000 }
  player.skillInsight = 500

  gameManager.setActivePlayer(player)
  gameManager.progressionOps.learnSkill('tram')

  return { gameManager, player }
}

const nguOffer = (player: ReturnType<typeof createDefaultPlayer>) =>
  listOfferableWays(player).find(
    offer => offer.pathId === 'kiem_tu' && offer.wayId === 'ngu',
  )

describe('kiem_tu ngu way — ritual offer gate (tram Lv3)', () => {
  it('listOfferableWays lists ngu ineligible below tram Lv3 (locked card + reason), eligible at Lv3', () => {
    const locked = mortalAtRitual(2)
    const lockedOffer = nguOffer(locked.player)

    // Gated ways stay listed so the UI renders the sealed card.
    expect(lockedOffer).toBeDefined()
    expect(lockedOffer!.eligible).toBe(false)
    expect(lockedOffer!.reason).toBe('requires tram Lv3')

    // The ungated hien way is unaffected by the tram gate.
    const hienOffer = listOfferableWays(locked.player).find(
      offer => offer.pathId === 'kiem_tu' && offer.wayId === 'hien',
    )
    expect(hienOffer!.eligible).toBe(true)

    const ready = mortalAtRitual(3)
    const readyOffer = nguOffer(ready.player)
    expect(readyOffer!.eligible).toBe(true)
    expect(readyOffer!.reason).toBeUndefined()
  })

  it('applyPathChoice rejects ngu below Lv3 — zero mutation', () => {
    const { player } = mortalAtRitual(2)

    const result = applyPathChoice(player, 'kiem_tu', 'ngu')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.kiemTu).toBeUndefined()
  })

  it('chooseCultivationPath(kiem_tu, ngu) rejects below Lv3 even though the ritual lists the card', () => {
    const { gameManager, player } = mortalAtRitual(2)

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', 'ngu', player),
    ).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.realmId).toBe('mortal')
  })

  it('at Lv3 the ritual commits cultivationPath kiem_tu + cultivationWay ngu and grants the way kit', () => {
    const { gameManager, player } = mortalAtRitual(3)

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', 'ngu', player),
    ).toBe(true)

    // ngu never had a hidden path id — both kiem ways persist
    // 'kiem_tu'; cultivationWay is the discriminator.
    expect(player.cultivationPath).toBe('kiem_tu')
    expect(player.cultivationWay).toBe('ngu')

    // The way-agnostic slice is created at commit; van_kiem_quyet is
    // the way's signature technique (learned AND equipped).
    expect(player.kiemTu).toEqual(freshKiemTuState())
    expect(gameManager.techniqueManager.has('van_kiem_quyet')).toBe(true)
    expect(gameManager.techniqueManager.getEquipped()?.id).toBe('van_kiem_quyet')

    // The ritual is the mortal -> qi_refining breakthrough.
    expect(player.realmId).toBe('qi_refining')
    expect(player.realmLevel).toBe(1)
  })

  it('the commit is free — no insight cost (no node purchase happens at all)', () => {
    const { gameManager, player } = mortalAtRitual(3)
    const insightBefore = player.skillInsight

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', 'ngu', player),
    ).toBe(true)

    expect(player.skillInsight).toBe(insightBefore)
    expect(player.purchasedNodeIds).toEqual([])
  })

  it('permanent: a second way choice is rejected by both the authority and the ritual', () => {
    const { gameManager, player } = mortalAtRitual(3)

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', 'ngu', player),
    ).toBe(true)

    // The authority fails closed on any second choice — even the
    // always-offered hien way cannot reopen the ritual.
    expect(applyPathChoice(player, 'kiem_tu', 'hien').ok).toBe(false)
    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', 'hien', player),
    ).toBe(false)

    expect(player.cultivationPath).toBe('kiem_tu')
    expect(player.cultivationWay).toBe('ngu')
  })
})

describe('kiem_tu ngu way — subtree isolation', () => {
  function committed(way: 'hien' | 'ngu', tramLevel = 3) {
    const { gameManager, player } = mortalAtRitual(tramLevel)

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', way, player),
    ).toBe(true)
    // The ritual lands the player at qi_refining Lv1 — enough insight
    // for the cheap test nodes below.
    player.skillInsight = 100

    return { gameManager, player }
  }

  it('ngu nodes are purchasable only on the ngu way', () => {
    const ngu = committed('ngu')

    // ngu_kiem_sac carries no prereq besides the way/path stamps — the
    // way gate alone decides.
    expect(
      ngu.gameManager.progressionOps.canPurchaseNode('ngu_kiem_sac', ngu.player),
    ).toBe(true)
    expect(
      ngu.gameManager.progressionOps.purchaseNode('ngu_kiem_sac', ngu.player),
    ).toBe(true)
    expect(ngu.player.nodeLevels['ngu_kiem_sac']).toBe(1)

    const hien = committed('hien')
    expect(
      hien.gameManager.progressionOps.canPurchaseNode('ngu_kiem_sac', hien.player),
    ).toBe(false)
    expect(
      hien.gameManager.progressionOps.purchaseNode('ngu_kiem_sac', hien.player),
    ).toBe(false)
    expect(hien.player.nodeLevels['ngu_kiem_sac']).toBeUndefined()
  })

  it('hien orb nodes are unpurchasable on the ngu way (inert trap prevented)', () => {
    const ngu = committed('ngu')

    // orb_dam_1's only other gate is realm qi_refining — the ritual
    // leaves the player there, so requiredWay alone blocks the buy.
    expect(
      ngu.gameManager.progressionOps.canPurchaseNode('orb_dam_1', ngu.player),
    ).toBe(false)
    expect(
      ngu.gameManager.progressionOps.purchaseNode('orb_dam_1', ngu.player),
    ).toBe(false)
    expect(ngu.player.nodeLevels['orb_dam_1']).toBeUndefined()

    // ...and the same node buys normally for a hien player at the
    // same realm — the isolation runs both directions, not a blanket
    // kiem-node lock.
    const hien = committed('hien')
    expect(
      hien.gameManager.progressionOps.purchaseNode('orb_dam_1', hien.player),
    ).toBe(true)
  })

  it('non-kiem-tu players cannot purchase ngu nodes at any way', () => {
    const { gameManager, player } = committed('ngu')
    player.cultivationPath = 'phap_tu' // corrupt save shape — path gate still holds

    expect(
      gameManager.progressionOps.canPurchaseNode('ngu_kiem_sac', player),
    ).toBe(false)
    expect(
      gameManager.progressionOps.purchaseNode('ngu_kiem_sac', player),
    ).toBe(false)
  })

  it('devResetBranch refunds ngu nodes normally — the non-refundable flip-node exception is gone', () => {
    const { gameManager, player } = committed('ngu')
    const insightBefore = player.skillInsight

    // Two cheap ngu buys: ngu_kiem_sac (cost 1) + cuu_cung_kham
    // (cost 2; realm qi_refining + kiemDaoBelowCap both pass post-ritual).
    expect(gameManager.progressionOps.purchaseNode('ngu_kiem_sac', player)).toBe(true)
    expect(gameManager.progressionOps.purchaseNode('cuu_cung_kham', player)).toBe(true)
    expect(player.skillInsight).toBe(insightBefore - 3)

    const refund = gameManager.progressionOps.devResetBranch('ngu_kiem', player)

    expect(refund).toBe(3)
    expect(player.skillInsight).toBe(insightBefore)
    expect(player.nodeLevels['ngu_kiem_sac']).toBeUndefined()
    expect(player.nodeLevels['cuu_cung_kham']).toBeUndefined()
    expect(player.purchasedNodeIds).toEqual([])

    // The way itself is never refunded away — resetting the branch is
    // a node operation, not a path operation.
    expect(player.cultivationWay).toBe('ngu')
    expect(player.kiemTu).toBeDefined()
  })
})
