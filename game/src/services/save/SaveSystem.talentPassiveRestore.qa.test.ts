import { primeMortalCreationPick } from './GameSave.fixture'
import { getTalentPassiveSkill } from '../../data/skill/TalentPassives'
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
// M-QI-05 - fixed: the canonical learnSkill funnel reads the registered
// template catalog (TALENT_PASSIVE_SKILLS is part of SKILLS), so
// restore-time syncTalentCombatPassive grants the passives again.
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

  it(
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

      primeMortalCreationPick(sourcePlayer, source.skillManager)
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

  it(
    'restore of the identical payload is a true no-op on skill order + passive stacks (F-BX-95)',
    () => {
      // F-BX-95: restoreGameSession -> setActivePlayer ->
      // syncTalentCombatPassive ran an unconditional revoke+re-grant
      // even when every identity guard had already early-returned, so a
      // byte-identical re-restore reordered skillManager (re-grants
      // append at the end) and reset runtime passive stacks.
      const source = createRegisteredManager()
      const sourcePlayer = createDefaultPlayer()
      sourcePlayer.selectedTalentIds = ['can_than']
      source.setActivePlayer(sourcePlayer)
      primeMortalCreationPick(sourcePlayer, source.skillManager)
      const save = buildGameSave(sourcePlayer, source)

      const store = usePlayerStore()
      const manager = createRegisteredManager()
      expect(restoreGameSession(store, manager, save).status).toBe('ok')

      // Diverge the live roster from the save AFTER restore 1: a new
      // entry appends at the end and a held passive accumulates
      // battle-time stacks. A no-op second restore must leave every bit
      // of this intact - order AND runtime stack values.
      const extra = SKILLS.find((skill) => skill.id === 'linh_bao')
      expect(extra).toBeDefined()
      manager.skillManager.add(structuredClone(extra!))
      manager.skillManager.get('talent_passive_can_than')!.passiveModifiers![0]!.stacks = 3

      const idsBefore = manager.skillManager.getAll().map((skill) => skill.id)
      const stacksBefore = manager.skillManager
        .getAll()
        .map((skill) => (skill.passiveModifiers ?? []).map((modifier) => modifier.stacks))

      const identicalPayload = JSON.parse(JSON.stringify(save)) as typeof save
      expect(restoreGameSession(store, manager, identicalPayload).status).toBe('ok')

      expect(manager.skillManager.getAll().map((skill) => skill.id)).toEqual(idsBefore)
      expect(
        manager.skillManager
          .getAll()
          .map((skill) => (skill.passiveModifiers ?? []).map((modifier) => modifier.stacks)),
      ).toEqual(stacksBefore)
    },
  )

  it(
    'the save boundary strips runtime passive stacks; restore re-derives authored state (F-BX-96)',
    () => {
      // F-BX-96: persisted passiveModifier[].stacks froze mid-battle
      // accumulation into saves that restore could never return (the
      // template re-derive owns the field). Intent: stacks are ephemeral
      // in-battle state - resetStacks() runs at every battle entry and
      // the DESIGNED cross-battle carry rides on player
      // .phaGiapCarryStacks - so the field no longer leaves live state.
      const source = createRegisteredManager()
      const sourcePlayer = createDefaultPlayer()
      sourcePlayer.selectedTalentIds = ['pha_giap']
      source.setActivePlayer(sourcePlayer)
      sourcePlayer.phaGiapCarryStacks = 7
      sourcePlayer.phaGiapCarryRealmId = 'mortal'

      const heldPassive = source.skillManager.get('talent_passive_pha_giap')
      expect(heldPassive).toBeDefined()
      for (const modifier of heldPassive!.passiveModifiers ?? []) {
        modifier.stacks = 22
      }

      primeMortalCreationPick(sourcePlayer, source.skillManager)
      const save = buildGameSave(sourcePlayer, source)

      // The persisted entry carries only durable modifier fields.
      const savedPassive = save.skills.find((skill) => skill.id === 'talent_passive_pha_giap')
      expect(savedPassive).toBeDefined()
      expect((savedPassive!.passiveModifiers ?? []).length).toBeGreaterThan(0)
      for (const modifier of savedPassive!.passiveModifiers ?? []) {
        expect(modifier.stacks).toBeUndefined()
      }
      // The strip worked on the detached copy only - live state intact.
      expect(
        (heldPassive!.passiveModifiers ?? []).every((modifier) => modifier.stacks === 22),
      ).toBe(true)

      const store = usePlayerStore()
      const manager = createRegisteredManager()
      expect(restoreGameSession(store, manager, save).status).toBe('ok')

      // Restore re-derives the authored modifier - the banked 22 never
      // comes back through the modifier channel...
      const restored = manager.skillManager.get('talent_passive_pha_giap')
      expect(restored).toBeDefined()
      expect(restored!.passiveModifiers).toEqual(
        getTalentPassiveSkill('talent_passive_pha_giap')!.passiveModifiers,
      )
      // ...while the channel designed to persist stacks survives.
      expect(store.$state.phaGiapCarryStacks).toBe(7)
    },
  )
})
