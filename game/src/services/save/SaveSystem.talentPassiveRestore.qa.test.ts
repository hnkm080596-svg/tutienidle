import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { affixes } from '../../data/equipment/affixes'
import { equipment } from '../../data/equipment/equipment'
import { materials } from '../../data/materials/materials'
import { SKILLS } from '../../data/skill/Skills'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { usePlayerStore } from '../../stores/player'
import { buildGameSave, restoreGameSession } from './SaveSystem'

// QA-2026-09-21 (P7-M4 adversarial sweep) - PRE-EXISTING defect, not
// introduced by M4: every save-reload permanently loses the selected
// combat talent's hidden passive skills. Two layers compound:
//
//   1. restoreGameSession order: player.restoreFromSave ->
//      setActivePlayer -> syncTalentCombatPassive (revoke + re-grant)
//      runs BEFORE saveOps.restoreFromSave -> skillManager.restore(),
//      which REPLACES the whole learned set - wiping the just-granted
//      talent passives.
//   2. restoreSkills' template filter drops 'talent_passive_*' entries
//      anyway: they live in TALENT_PASSIVE_SKILLS, not skillTemplates.
//
// Live evidence (P14 run 2026-09-21): a guest save with
// selectedTalentIds ['can_than'] restored at boot shows no
// talent_passive_* in skills[] - the defensive passive silently never
// applies after any reload.
//
// it.fails pins the defect deterministically; when the ordering/registry
// fix lands this flips green and must be converted to a normal it().
function createRegisteredManager(): GameManager {
  const manager = new GameManager()

  manager.catalogOps.registerMaterials(materials)
  manager.catalogOps.registerEquipment(equipment)
  manager.catalogOps.registerAffixes(affixes)
  manager.catalogOps.registerSkillTemplates(SKILLS)

  return manager
}

describe('Talent combat passives across save restore (QA regression)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it.fails(
    'restores the selected combat talent passives that were live at save time',
    () => {
      // Build a save that honestly captured the live state: can_than
      // selected -> syncTalentCombatPassive granted both hidden passives.
      const source = createRegisteredManager()
      const sourcePlayer = createDefaultPlayer()
      sourcePlayer.selectedTalentIds = ['can_than']
      source.setActivePlayer(sourcePlayer)

      expect(source.skillManager.has('talent_passive_can_than')).toBe(true)
      expect(source.skillManager.has('talent_passive_can_than_phi')).toBe(true)

      const save = buildGameSave(sourcePlayer, source)

      // The save file itself carries the passives - they are real
      // persisted state, not merely derived runtime.
      expect(save.skills.map((skill) => skill.id)).toContain('talent_passive_can_than')

      const store = usePlayerStore()
      const manager = createRegisteredManager()
      const result = restoreGameSession(store, manager, save)

      expect(result.status).toBe('ok')
      expect(store.$state.selectedTalentIds).toEqual(['can_than'])

      // The selected talent's combat passives must still be learned after
      // restore - today skillManager.restore() wipes the earlier sync
      // grant and the template filter drops the file entries.
      expect(manager.skillManager.has('talent_passive_can_than')).toBe(true)
      expect(manager.skillManager.has('talent_passive_can_than_phi')).toBe(true)
    },
  )
})
