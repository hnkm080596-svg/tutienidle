// @vitest-environment jsdom
//
// Development-phase save policy (dong-fu-command-wheel-inventory-spirit-
// stone-plan.md §"Chính sách migration và an toàn ghi đè") — auto-
// migrate v42/v43 đã retire: MỌI version cũ hơn CURRENT_SAVE_VERSION
// trả về 'incompatible' và KHÔNG ĐƯỢC phát sinh bất kỳ write nào vào
// localStorage (không ghi đè save gốc, không tạo backup, không đụng
// revision key). Người chơi xử lý qua SaveIncompatibleScreen
// (Export/Xoá) thay vì bị migrate âm thầm.
import { beforeEach, describe, expect, it } from 'vitest'
import { CURRENT_SAVE_VERSION, loadGame } from './SaveSystem'
import { createDefaultPlayer } from '../../core/player/Player'

function writeRawSave(version: number): string {
  const raw = JSON.stringify({
    version,

    player: { name: 'Test', spiritStone: 500 },

    materials: [{ materialId: 'legacy_material', amount: 3 }],
  })

  localStorage.setItem('tien-hiep-idle-save', raw)

  return raw
}

// Save version hiện hành phải nguyên shape theo validateGameSaveShape —
// fixture tối thiểu như writeRawSave không còn qua cửa load (đúng thiết
// kế mới của save-shape-validation-plan.md).
function writeValidCurrentSave(): string {
  const raw = JSON.stringify({
    version: CURRENT_SAVE_VERSION,

    player: { ...createDefaultPlayer(), name: 'Test' },

    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  })

  localStorage.setItem('tien-hiep-idle-save', raw)

  return raw
}

describe('loadGame — retirement của auto-migration (v42–v46)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  for (const version of [42, 43, 44, 45, 46, 54]) {
    it(`version ${version} → incompatible, KHÔNG write nào phát sinh`, () => {
      const raw = writeRawSave(version)

      const outcome = loadGame()

      expect(outcome).toEqual({ status: 'incompatible', foundVersion: version, raw })

      // Save gốc KHÔNG bị ghi đè/migrate.
      expect(localStorage.getItem('tien-hiep-idle-save')).toBe(raw)

      // Không backup/revision nào được tạo từ đường load.
      expect(localStorage.getItem('tien-hiep-idle-save-backup')).toBeNull()
      expect(localStorage.getItem('tien-hiep-idle-save-revision')).toBeNull()
    })
  }

  it(`version ${CURRENT_SAVE_VERSION} → ok giữ nguyên save`, () => {
    const raw = writeValidCurrentSave()

    const outcome = loadGame()

    expect(outcome.status).toBe('ok')

    if (outcome.status === 'ok') {
      expect(outcome.save.player.name).toBe('Test')
      expect(outcome.save.version).toBe(CURRENT_SAVE_VERSION)
    }
  })
})
