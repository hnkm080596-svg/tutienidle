// M3 (spec 2026-09-03 talent catalog v4 §4.2) — production talent wiring
// qua GameManager ops layer: Bach Luyen Thanh Khi (equipment) va Hoa Hau
// Thong Than (alchemy cost). Unit-level seams da cover o
// EnhanceSlotLevel/AlchemySystem/PillSystem.profession tests.
// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { materials } from '../../data/materials/materials'
import { SPIRIT_STONE_MATERIAL_ID } from '../material/SpiritStoneMaterial'

function setup(talentIds: string[] = []) {
  const gameManager = new GameManager()
  const player = createDefaultPlayer()

  player.selectedTalentIds = talentIds
  gameManager.setActivePlayer(player)
  gameManager.catalogOps.registerMaterials(materials)

  for (const material of materials) {
    gameManager.materialBag.add(material, 1000)
  }

  return { gameManager, player }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GameManager — Bach Luyen Thanh Khi wiring (M3)', () => {
  it('co talent → enhanceSlot khong bao gio fail du random xau + preview x3', () => {
    const { gameManager, player } = setup(['bach_luyen_thanh_khi'])

    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    // Preview sync policy tu activePlayer: gia goc (catalog) x3.
    const baseline = setup().gameManager.equipmentOps.getEnhanceSpiritStoneCost('weapon', player.realmId)
    expect(baseline).toBeGreaterThan(0)
    expect(gameManager.equipmentOps.getEnhanceSpiritStoneCost('weapon', player.realmId)).toBe(baseline * 3)

    const before = gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)

    // L2 rate 96 — 0.999 se fail voi nguoi thuong; talent bao dam.
    gameManager.equipmentOps.enhanceSlot('weapon', player) // L0 -> L1 (rate 100)
    const result = gameManager.equipmentOps.enhanceSlot('weapon', player) // L1 -> L2 (rate 96)

    expect(result.ok).toBe(true)
    expect(gameManager.equipmentSlotManager.get('weapon').enhanceLevel).toBe(2)
    // Hai lan x gia x3.
    expect(before - gameManager.materialBag.getAmount(SPIRIT_STONE_MATERIAL_ID)).toBe(baseline * 3 * 2)
  })

  it('khong talent → preview gia goc + fail theo rate giu nguyen', () => {
    const { gameManager, player } = setup()

    vi.spyOn(Math, 'random').mockReturnValue(0.999)

    expect(gameManager.equipmentOps.getEnhanceSpiritStoneCost('weapon', player.realmId)).toBeGreaterThan(0)

    gameManager.equipmentOps.enhanceSlot('weapon', player) // L0 -> L1
    const result = gameManager.equipmentOps.enhanceSlot('weapon', player) // L1 -> L2 rate 96 fail

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('enhance_failed')
    expect(gameManager.equipmentSlotManager.get('weapon').enhanceLevel).toBe(1)
  })
})
