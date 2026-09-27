// TEMP probe: can qi_refining_forest be cleared post-ritual with grind?
import { describe, expect, it } from 'vitest'
import { EarlyGameSession } from './EarlyGameSession'
import { getRequiredCultivation } from '../../realm/realmSystem'

const PINNED = {
  name: 'probe',
  talentIds: ['hap_linh'],
  mortalBasicSkillId: 'tram',
}

describe('qr probe', () => {
  it('post-ritual floor attempts', () => {
    const s = new EarlyGameSession({ seed: 11, profile: PINNED })
    const grind = () => {
      const req = getRequiredCultivation(s.player.realmId, s.player.realmLevel)
      s.cultivate(req / s.player.cultivationPerSecond + 1)
      return s.breakthroughIfReady()
    }
    s.runStage('mortal_dong_1')
    while (s.player.realmLevel < 12) grind()
    // Real loop: farm the mortal floors for gear/insight before the push.
    for (let i = 0; i < 10; i++) s.runStage('mortal_dong_2')
    const equipped = s.equipAll()
    s.runTribulation('qi_refining')
    s.performRitual('sword', 'sword_pathway')
    const tinhHoa = (s.gameManager.materialBag as unknown as { getAmount?: (id: string) => number })
      .getAmount?.('tinh_hoa_pham_the')
    console.log('FARM', JSON.stringify({
      equipped, bagSize: s.gameManager.equipmentBag.getAll().length,
      bagItems: s.gameManager.equipmentBag.getAll().map((i) => i.itemId),
      tinhHoa,
      insight: s.player.skillInsight, attrPts: s.player.attributePoints,
    }))
    console.log('LOADOUT', JSON.stringify({
      castCounts: s.player.skillCastCounts,
      learned: (s.gameManager as unknown as { skillManager: { learned?: unknown } })
        .skillManager?.learned,
      stats: { might: s.player.baseStats.might, maxHp: s.player.baseStats.maxHp },
    }))

    // inspect one battle's entity state directly
    s.runStage('qi_refining_forest')
    const battle = s.gameManager.getTurnBattle()
    console.log('BATTLE', JSON.stringify({
      state: battle?.state,
      player: battle?.players[0]?.entity && {
        hp: battle.players[0].entity.currentHp,
        might: battle.players[0].entity.stats.might,
        skills: (battle.players[0].entity as unknown as { skills?: unknown[] }).skills?.map?.(
          (sk: unknown) => (sk as { id?: string }).id,
        ),
      },
      enemies: battle?.enemies.map((e) => ({
        id: e.entity.id, hp: e.entity.currentHp, alive: e.entity.alive,
      })),
    }))

    const log: unknown[] = []
    for (let i = 0; i < 20; i++) {
      const outcome = s.runStage('qi_refining_forest')
      log.push({
        i, outcome, lvl: s.player.realmLevel,
        insight: s.player.skillInsight,
        nodes: { ...s.player.nodeLevels },
        casts: { ...s.player.skillCastCounts },
        might: s.player.baseStats.might,
        hp: s.player.baseStats.maxHp,
      })
      if (outcome === 'victory') break
      // spend insight on kiem_pho nodes + allocate all attribute points
      for (const id of ['thich_can']) {
        s.purchaseNode(id)
      }
      while (s.player.attributePoints > 0) {
        if (!s.allocateAttribute('strength')) break
      }
      grind()
    }
    console.log('QR\n' + JSON.stringify(log, null, 1))
    expect(log.length).toBeGreaterThan(0)
  })
})
