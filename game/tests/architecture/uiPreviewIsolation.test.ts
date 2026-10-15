import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const GAME_ROOT = process.cwd()
const SRC_ROOT = join(GAME_ROOT, 'src')

function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...collectSourceFiles(full))
    } else if (/\.(ts|vue|js|css)$/.test(entry)) {
      results.push(full)
    }
  }
  return results
}

describe('UI Preview Isolation & Dead Code Pruning (Slice 3.1)', () => {
  it('forbids production source files outside src/ui-preview from importing ui-preview', () => {
    const files = collectSourceFiles(SRC_ROOT)
    const violations: string[] = []

    for (const file of files) {
      const rel = relative(SRC_ROOT, file).replace(/\\/g, '/')
      if (rel.startsWith('ui-preview/')) continue
      if (rel.endsWith('.test.ts') || rel.endsWith('.spec.ts')) continue

      const content = readFileSync(file, 'utf-8')
      if (/(?:from|import)\s+['"][^'"]*ui-preview\b/.test(content)) {
        violations.push(rel)
      }
    }

    expect(violations).toEqual([])
  })

  it('pins removal of dead UI components, orphan stylesheets, and legacy duplicates', () => {
    const deletedPaths = [
      'src/components/panels/CharacterPanel.vue',
      'src/components/panels/CharacterDetailCard.vue',
      'src/components/panels/BagGrid.vue',
      'src/components/common/TabBar.vue',
      'src/components/common/ImperialScrollScene.vue',
      'src/components/common/PcPaperScene.vue',
      'src/components/common/PcPaperSceneActions.vue',
      'src/components/common/PaperPanelNavigation.vue',
      'src/components/game/CurrencyHud.vue',
      'src/components/game/AutoFarmIndicator.vue',
      'src/components/scenes/dong-fu/hud/DongFuResourcePill.vue',
      'src/components/scenes/character/CharacterScene.vue',
      'src/components/scenes/creation/art-needed.css',
      'src/components/scenes/creation/CreationSceneLayout.vue',
      'src/components/scenes/creation/CreationScrollShell.vue',
      'src/components/scenes/creation/TalentCard.vue',
      'src/components/scenes/realm/legacy/RealmActionBlock.vue',
      'src/components/scenes/realm/legacy/RealmAscentMap.vue',
      'src/components/scenes/realm/legacy/realmUiLegacy.ts',
      'src/composables/usePaperNavigation.ts',
      'src/assets/pc-paper-auxiliary-production.css',
      'src/assets/tien-hiep-collections.css',
      'src/assets/tien-hiep-forge.css',
      'src/assets/tien-hiep-outcomes.css',
      'src/assets/tien-hiep-progression.css',
    ]

    const stillPresent = deletedPaths.filter((p) => existsSync(join(GAME_ROOT, p)))
    expect(stillPresent).toEqual([])
  })

  it('keeps preview-only fidelity scenes inside src/ui-preview/scenes and out of src/components/scenes', () => {
    const movedFromComponents = [
      'src/components/scenes/combat/fidelity/CombatFidelityScene.vue',
      'src/components/scenes/victory/fidelity/VictoryFidelityScene.vue',
      'src/components/scenes/defeat/fidelity/DefeatFidelityScene.vue',
      'src/components/scenes/tribulation/fidelity/TribulationFidelityScene.vue',
      'src/components/scenes/dong-fu/fidelity/DongFuFidelityScene.vue',
      'src/components/scenes/dong-fu/fidelity/DongFuVista.vue',
      'src/components/scenes/equipment/fidelity/ForgeFidelityScene.vue',
      'src/components/scenes/equipment/fidelity/ForgeFidelityWorkspace.vue',
      'src/components/scenes/equipment/fidelity/ForgeBatchBag.vue',
      'src/components/scenes/inventory/fidelity/InventoryFidelityDetail.vue',
      'src/components/scenes/quest/fidelity/QuestFidelityDetail.vue',
    ]

    const stillInComponents = movedFromComponents.filter((p) => existsSync(join(GAME_ROOT, p)))
    expect(stillInComponents).toEqual([])

    const expectedInPreview = [
      'src/ui-preview/scenes/combat/fidelity/CombatFidelityScene.vue',
      'src/ui-preview/scenes/victory/fidelity/VictoryFidelityScene.vue',
      'src/ui-preview/scenes/defeat/fidelity/DefeatFidelityScene.vue',
      'src/ui-preview/scenes/tribulation/fidelity/TribulationFidelityScene.vue',
      'src/ui-preview/scenes/dong-fu/fidelity/DongFuFidelityScene.vue',
      'src/ui-preview/scenes/dong-fu/fidelity/DongFuVista.vue',
      'src/ui-preview/scenes/equipment/fidelity/ForgeFidelityScene.vue',
      'src/ui-preview/scenes/equipment/fidelity/ForgeFidelityWorkspace.vue',
      'src/ui-preview/scenes/equipment/fidelity/ForgeBatchBag.vue',
      'src/ui-preview/scenes/inventory/fidelity/InventoryFidelityDetail.vue',
      'src/ui-preview/scenes/quest/fidelity/QuestFidelityDetail.vue',
    ]

    const missingInPreview = expectedInPreview.filter((p) => !existsSync(join(GAME_ROOT, p)))
    expect(missingInPreview).toEqual([])
  })
})
