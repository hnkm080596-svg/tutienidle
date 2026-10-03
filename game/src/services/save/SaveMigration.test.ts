// @vitest-environment jsdom
//
// Development-phase save policy (dong-fu-command-wheel-inventory-spirit-
// stone-plan.md sec"Chinh sach migration va an toan ghi de") - auto-
// migrate v42/v43 da retire: MOI version cu hon CURRENT_SAVE_VERSION
// tra ve 'incompatible' va KHONG DUOC phat sinh bat ky write nao vao
// localStorage (khong ghi de save goc, khong tao backup, khong dung
// revision key). Nguoi choi xu ly qua SaveIncompatibleScreen
// (Export/Xoa) thay vi bi migrate am tham.
import { beforeEach, describe, expect, it } from 'vitest'
import { CURRENT_SAVE_VERSION, loadGame } from './SaveSystem'
import { resolveBackupKey, resolveRevisionKey, resolveSaveKey } from './saveKeys'
import { createDefaultPlayer } from '../../core/player/Player'

function writeRawSave(version: number): string {
  const raw = JSON.stringify({
    version,

    player: { name: 'Test', spiritStone: 500 },

    materials: [{ materialId: 'legacy_material', amount: 3 }],
  })

  localStorage.setItem(resolveSaveKey(), raw)

  return raw
}

// Save version hien hanh phai nguyen shape theo validateGameSaveShape -
// fixture toi thieu nhu writeRawSave khong con qua cua load (dung thiet
// ke moi cua save-shape-validation-plan.md).
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

  localStorage.setItem(resolveSaveKey(), raw)

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

      // Save goc KHONG bi ghi de/migrate.
      expect(localStorage.getItem(resolveSaveKey())).toBe(raw)

      // Khong backup/revision nao duoc tao tu duong load.
      expect(localStorage.getItem(resolveBackupKey())).toBeNull()
      expect(localStorage.getItem(resolveRevisionKey())).toBeNull()
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
