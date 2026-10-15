import { beforeEach, describe, expect, it } from 'vitest'
import { buildSandboxPreset } from './sandboxPresets'
import { isSaveAcceptable, staticSaveAcceptanceCatalogs } from '../save/saveAcceptance'
import { validateGameSaveShape } from '../save/saveShapeValidation'
import { lockBetaWaysForTests } from '@/core/game/__fixtures__/betaWaysUnlock'

beforeEach(() => lockBetaWaysForTests())

describe('sandbox presets use real progression owners', () => {
  for (const preset of ['mortal', 'spell'] as const) {
    it(`${preset} survives the normal save boundary`, () => {
      const save = buildSandboxPreset(preset)
      expect(validateGameSaveShape(save).ok).toBe(true)
      expect(isSaveAcceptable(save, staticSaveAcceptanceCatalogs())).toBe(true)
      expect(save.player.realmId).toBe(preset === 'mortal' ? 'mortal' : 'qi_refining')
      expect(save.player.cultivationPath).toBe(preset === 'mortal' ? undefined : preset)
      expect(save.buildings.length).toBeGreaterThan(0)
      expect(save.materials.find((stack) => stack.materialId === 'material_spirit_wood_decade')?.amount).toBe(15)
    })
  }
  it('refuses the body preset under the actual release gate', () => {
    expect(() => buildSandboxPreset('body')).toThrow('outside the release scope')
  })
})
