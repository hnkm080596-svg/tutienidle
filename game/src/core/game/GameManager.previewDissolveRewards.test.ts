import { describe, expect, it } from 'vitest'
import { makeInstance } from '../equipment/EquipmentInstance.fixture'
import { LUYEN_KHI_TINH_HOA_ID } from '../equipment/TinhHoaMaterial'
import { GameManager } from './GameManager'

describe('GameManager.previewDissolveRewards', () => {
  it('aggregates equipment of different grades into one Luyện Khí Tinh Hoa preview', () => {
    const gameManager = new GameManager()

    gameManager.equipmentBag.add(
      makeInstance({ instanceId: 'mortal-hoang', grade: 'cuu_pham', quality: 'hoang' }),
    )
    gameManager.equipmentBag.add(
      makeInstance({ instanceId: 'qi-huyen', grade: 'bat_pham', quality: 'huyen' }),
    )

    expect(gameManager.previewDissolveRewards(['mortal-hoang', 'qi-huyen'])).toEqual([
      {
        materialId: LUYEN_KHI_TINH_HOA_ID,
        minAmount: 3,
        maxAmount: 7,
      },
    ])
  })
})
