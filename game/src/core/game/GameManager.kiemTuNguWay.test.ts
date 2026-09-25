import { describe, expect, it } from 'vitest'
import { ManualClockSource } from '../battle/turn/CombatClock'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import {
  applyPathChoice,
  listOfferableWays,
} from '../player/CultivationPathSystem'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Cultivation Path Framework M6 -- the ngu way is entered through the
// Initiation Ritual itself, gated by the way's offerGate
// (requiresSkillLevel tram Lv3 -- the exact port of the retired
// kiem_tu_an node's skillCastCount level gate, reading the canonical
// mirror). There is no flip node any more: the commit is FREE (no
// insight cost) and PERMANENT (the authority rejects any second
// choice), and requiredWay -- not a purchased root -- isolates the hien
// orb branches from the ngu subtree.

function makeManager() {
  const gameManager = new GameManager()
  gameManager.setCombatClockSource(new ManualClockSource())
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)

  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12

  return { gameManager, player }
}

function mortalAtRitual(tramLevel: number) {
  const { gameManager, player } = makeManager()
  player.nodeLevels.core_tram = tramLevel
  player.skillCastCounts = { tram: tramLevel >= 3 ? 10_000 : 9_000 }
  player.skillInsight = 500

  gameManager.setActivePlayer(player)
  gameManager.progressionOps.learnSkill('tram', player)

  return { gameManager, player }
}

const nguOffer = (player: ReturnType<typeof createDefaultPlayer>) =>
  listOfferableWays(player).find(
    offer => offer.pathId === 'sword' && offer.wayId === 'hidden_sword_pathway',
  )

describe('sword ngu way — ritual offer gate (tram Lv3)', () => {
  it('listOfferableWays lists ngu ineligible below tram Lv3 (locked card + reason), eligible at Lv3', () => {
    const locked = mortalAtRitual(2)
    const lockedOffer = nguOffer(locked.player)

    // Gated ways stay listed with eligible:false + reason -- the UI
    // layer decides presentation (QuanKhiPanel shows eligible only).
    expect(lockedOffer).toBeDefined()
    expect(lockedOffer!.eligible).toBe(false)
    expect(lockedOffer!.reason).toBe('requires tram Lv3')

    // The ungated hien way is unaffected by the tram gate.
    const hienOffer = listOfferableWays(locked.player).find(
      offer => offer.pathId === 'sword' && offer.wayId === 'sword_pathway',
    )
    expect(hienOffer!.eligible).toBe(true)

    const ready = mortalAtRitual(3)
    const readyOffer = nguOffer(ready.player)
    expect(readyOffer!.eligible).toBe(true)
    expect(readyOffer!.reason).toBeUndefined()
  })

  it('applyPathChoice rejects ngu below Lv3 — zero mutation', () => {
    const { player } = mortalAtRitual(2)

    const result = applyPathChoice(player, 'sword', 'hidden_sword_pathway')

    expect(result.ok).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.swordPath).toBeUndefined()
  })

  it('chooseCultivationPath(sword, ngu) rejects below Lv3 even though the ritual lists the card', () => {
    const { gameManager, player } = mortalAtRitual(2)

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'hidden_sword_pathway', player),
    ).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.realmId).toBe('mortal')
  })

  it('at Lv3 the ritual commits cultivationPath sword + cultivationWay ngu and grants the way kit', () => {
    const { gameManager, player } = mortalAtRitual(3)

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'hidden_sword_pathway', player),
    ).toBe(true)

    // ngu never had a hidden path id -- both kiem ways persist
    // 'sword'; cultivationWay is the discriminator.
    expect(player.cultivationPath).toBe('sword')
    expect(player.cultivationWay).toBe('hidden_sword_pathway')

    // The way-agnostic slice is created at commit; van_kiem_quyet is
    // the way's signature technique (learned AND equipped).
    expect(player.swordPath).toEqual(freshSwordPathState())
    expect(gameManager.techniqueManager.getActive()?.id).toBe('myriad_swords_art')

    // The ritual is the mortal -> qi_refining breakthrough.
    expect(player.realmId).toBe('qi_refining')
    expect(player.realmLevel).toBe(1)
  })

  it('the commit is free — no insight cost (no node purchase happens at all)', () => {
    const { gameManager, player } = mortalAtRitual(3)
    const insightBefore = player.skillInsight

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'hidden_sword_pathway', player),
    ).toBe(true)

    expect(player.skillInsight).toBe(insightBefore)
    // M-QI-05 + Ngu Kiem Beta - owned ids are granted entries, not
    // Insight purchases: learnSkill tram -> core_tram; way.coreSkillIds
    // -> core_ngu_kiem_thuat; way.grantedNodeIds -> ngu_kiem_khoi.
    // insightBefore is untouched above (grants cost nothing).
    expect(player.purchasedNodeIds).toEqual(['core_tram', 'core_ngu_kiem_thuat', 'ngu_kiem_khoi'])
    expect(player.nodeLevels['ngu_kiem_khoi']).toBe(1)
  })

  it('permanent: a second way choice is rejected by both the authority and the ritual', () => {
    const { gameManager, player } = mortalAtRitual(3)

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'hidden_sword_pathway', player),
    ).toBe(true)

    // The authority fails closed on any second choice -- even the
    // always-offered hien way cannot reopen the ritual.
    expect(applyPathChoice(player, 'sword', 'sword_pathway').ok).toBe(false)
    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player),
    ).toBe(false)

    expect(player.cultivationPath).toBe('sword')
    expect(player.cultivationWay).toBe('hidden_sword_pathway')
  })
})

describe('sword ngu way — subtree isolation', () => {
  function committed(way: 'sword_pathway' | 'hidden_sword_pathway', tramLevel = 3) {
    const { gameManager, player } = mortalAtRitual(tramLevel)

    expect(
      gameManager.realmAdvanceOps.chooseCultivationPath('sword', way, player),
    ).toBe(true)
    // The ritual lands the player at qi_refining Lv1 -- enough insight
    // for the cheap test nodes below.
    player.skillInsight = 100

    return { gameManager, player }
  }

  it('ngu nodes are purchasable only on the ngu way', () => {
    const ngu = committed('hidden_sword_pathway')

    // Post-ritual Khoi is granted; Lien's remaining gates are realm +
    // the Khoi node -- bump the realm so only the way gate can decide.
    ngu.player.realmId = 'foundation_establishment'
    expect(
      ngu.gameManager.progressionOps.canPurchaseNode('ngu_kiem_lien', ngu.player),
    ).toBe(true)
    expect(
      ngu.gameManager.progressionOps.purchaseNode('ngu_kiem_lien', ngu.player),
    ).toBe(true)
    expect(ngu.player.nodeLevels['ngu_kiem_lien']).toBe(1)

    const hien = committed('sword_pathway')
    hien.player.realmId = 'foundation_establishment'
    hien.player.nodeLevels['ngu_kiem_khoi'] = 1 // corrupt save -- way gate still holds
    expect(
      hien.gameManager.progressionOps.canPurchaseNode('ngu_kiem_lien', hien.player),
    ).toBe(false)
    expect(
      hien.gameManager.progressionOps.purchaseNode('ngu_kiem_lien', hien.player),
    ).toBe(false)
    expect(hien.player.nodeLevels['ngu_kiem_lien']).toBeUndefined()
  })

  it('hien orb nodes are unpurchasable on the ngu way (inert trap prevented)', () => {
    const ngu = committed('hidden_sword_pathway')

    // orb_dam_1's only other gate is realm qi_refining -- the ritual
    // leaves the player there, so requiredWay alone blocks the buy.
    expect(
      ngu.gameManager.progressionOps.canPurchaseNode('orb_dam_1', ngu.player),
    ).toBe(false)
    expect(
      ngu.gameManager.progressionOps.purchaseNode('orb_dam_1', ngu.player),
    ).toBe(false)
    expect(ngu.player.nodeLevels['orb_dam_1']).toBeUndefined()

    // ...and the same node buys normally for a hien player at the
    // same realm -- the isolation runs both directions, not a blanket
    // kiem-node lock.
    const hien = committed('sword_pathway')
    expect(
      hien.gameManager.progressionOps.purchaseNode('orb_dam_1', hien.player),
    ).toBe(true)
  })

  it('non-kiem-tu players cannot purchase ngu nodes at any way', () => {
    const { gameManager, player } = committed('hidden_sword_pathway')
    player.cultivationPath = 'spell' // corrupt save shape -- path gate still holds
    player.realmId = 'foundation_establishment'

    expect(
      gameManager.progressionOps.canPurchaseNode('ngu_kiem_lien', player),
    ).toBe(false)
    expect(
      gameManager.progressionOps.purchaseNode('ngu_kiem_lien', player),
    ).toBe(false)
  })

  it('devResetBranch strips the whole ngu branch — granted Khoi included (dev tool contract)', () => {
    const { gameManager, player } = committed('hidden_sword_pathway')

    // The ritual grant writes through the ownership seam: Khoi sits in
    // nodeLevels + purchasedNodeIds before any buy.
    expect(player.nodeLevels['ngu_kiem_khoi']).toBe(1)
    expect(player.purchasedNodeIds).toContain('ngu_kiem_khoi')

    player.realmId = 'foundation_establishment'
    const insightBefore = player.skillInsight
    expect(gameManager.progressionOps.purchaseNode('ngu_kiem_lien', player)).toBe(true)
    expect(player.skillInsight).toBe(insightBefore - 3)

    const refund = gameManager.progressionOps.devResetBranch('ngu_kiem', player)

    expect(refund).toBe(3)
    expect(player.skillInsight).toBe(insightBefore)
    expect(player.nodeLevels['ngu_kiem_lien']).toBeUndefined()
    // Deliberate: the dev tool resets the WHOLE branch -- even the
    // granted Khoi node goes (player-facing respec preserves it via
    // RESPEC_PRESERVED_NODE_IDS instead).
    expect(player.nodeLevels['ngu_kiem_khoi']).toBeUndefined()
    expect(player.purchasedNodeIds).toEqual(['core_tram', 'core_ngu_kiem_thuat'])

    // The way itself is never refunded away -- resetting the branch is
    // a node operation, not a path operation.
    expect(player.cultivationWay).toBe('hidden_sword_pathway')
    expect(player.swordPath).toBeDefined()
  })
})
