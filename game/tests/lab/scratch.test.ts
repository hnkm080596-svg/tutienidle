import { describe, expect, it } from 'vitest'
import { createLab } from './harness'
import {
  SPIRIT_STONE_MATERIAL,
  SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
  SPIRIT_STONE_THUONG_PHAM_MATERIAL,
} from '@/core/material/SpiritStoneMaterial'

// Scratch experiment file - edit freely. Run with: npm run lab
// Personal experiments you don't want committed belong in tests/lab/local/
// (gitignored) - same API, files named *.test.ts are picked up by vitest.

describe('lab examples', () => {
  it('dummy battle: combat clock drives a real fight', () => {
    const lab = createLab()
    lab.startStage()

    lab.combat(60)

    const battle = lab.battle
    expect(battle?.state).toBe('fighting')
    const enemy = battle?.enemies[0]
    expect(enemy?.entity.currentHp).toBeLessThan(enemy?.entity.maxHp ?? 0)
    console.log(lab.snapshot())
  })

  it('cheat.oneHitKill: real damage pipeline ends the stage', () => {
    const lab = createLab()
    lab.startStage()
    lab.cheat.oneHitKill()

    lab.combat(60)

    expect(lab.battle?.state).toBe('victory')
    console.log(lab.snapshot())
  })

  it('cheat.addSpiritStones: lands in materialBag by realm tier', () => {
    const lab = createLab()
    // Spirit stones are materials - register just the 3 tier constants
    // (or call lab.useRealData() for the full catalog).
    lab.manager.catalogOps.registerMaterials([
      SPIRIT_STONE_MATERIAL,
      SPIRIT_STONE_TRUNG_PHAM_MATERIAL,
      SPIRIT_STONE_THUONG_PHAM_MATERIAL,
    ])

    const grant = lab.cheat.addSpiritStones(1000)

    expect(grant).toEqual({ stored: 1000, overflow: 0 })
    expect(lab.manager.materialBag.getAmount('spirit_stone_ha_pham')).toBe(1000)
  })

  it('lab.tick: world clock advances without a battle', () => {
    const lab = createLab()

    lab.tick(30)

    // The world tick drives production/quests/timed systems; a fresh
    // player simply stays put. This example exists to show the API.
    expect(lab.battle).toBeNull()
    console.log(lab.snapshot())
  })
})
