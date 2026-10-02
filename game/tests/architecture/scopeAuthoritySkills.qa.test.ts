// Scope-authority blind audit probes - second wave (independent
// adversarial pass, pin a7d12edf). Every test asserts the SECURE
// expectation: a persisted claim no authored writer could produce must
// be rejected by validateGameSaveShape / restore, and whatever is
// admitted must not mint a live effect. A FAILING test is the finding;
// passing mint-asserts inside it are the deterministic evidence.
// ASCII comments only.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { affixes } from '@/data/equipment/affixes'
import { equipment } from '@/data/equipment/equipment'
import { materials } from '@/data/materials/materials'
import { TECHNIQUES } from '@/data/technique/Techniques'
import { SKILLS } from '@/data/skill/Skills'
import { ALL_PROGRESSION_NODES } from '@/data/progression/ProgressionNodeCatalog'
import { ENEMIES } from '@/data/enemy/Enemies'
import { STAGES } from '@/data/stage/Stages'
import { zones } from '@/data/stage/Zones'
import { pills } from '@/data/pill/pills'
import { buffs } from '@/data/buff/buffs'
import { talismans } from '@/data/talisman/talismans'
import { formations } from '@/data/formation/formations'
import { alchemyRecipes } from '@/data/alchemy/alchemyRecipes'
import { buildings } from '@/data/building/buildings'
import { QUESTS } from '@/data/quest/quests'
import { GameManager } from '@/core/game/GameManager'
import { createDefaultPlayer } from '@/core/player/Player'
import { usePlayerStore } from '@/stores/player'
import { withMortalCreationPick } from '@/services/save/GameSave.fixture'
import { restoreGameSession } from '@/services/save/SaveSystem'
import { validateGameSaveShape } from '@/services/save/saveShapeValidation'
import { CURRENT_SAVE_VERSION } from '@/services/save/SaveSystem'
import { getPrecursorFlatDamageBonus } from '@/core/skill/SkillSystem'
import { getCastLeveledSkillLevel } from '@/core/skill/CastLeveling'
import type { GameSave } from '@/services/save/saveTypes'

function createRegisteredManager(): GameManager {
  const manager = new GameManager()
  const catalog = manager.catalogOps
  catalog.registerMaterials(materials)
  catalog.registerSkillTemplates(SKILLS)
  catalog.registerTechniqueTemplates(TECHNIQUES)
  catalog.registerEnemyTemplates(ENEMIES)
  catalog.registerStages(STAGES)
  catalog.registerZones(zones)
  catalog.registerEquipment(equipment)
  catalog.registerAffixes(affixes)
  catalog.registerPills(pills)
  catalog.registerBuffs(buffs)
  catalog.registerTalismans(talismans)
  catalog.registerFormations(formations)
  catalog.registerAlchemyRecipes(alchemyRecipes)
  catalog.registerBuildings(buildings)
  catalog.registerProgressionNodes(ALL_PROGRESSION_NODES)
  catalog.registerQuests(QUESTS)
  return manager
}

// Legal mortal save: default player + the three-channel creation pick
// (mortalBasicSkillId + skills[] learned entry + core_linh_bao grant).
function mortalSave(): GameSave {
  const save: GameSave = {
    version: CURRENT_SAVE_VERSION,
    player: createDefaultPlayer(),
    techniques: [],
    skills: [],
    materials: [],
    equipment: [],
    pills: [],
    talismans: [],
    formations: [],
    buildings: [],
    equipmentSlots: [],
  }
  return withMortalCreationPick(save)
}

function restoreSave(save: GameSave) {
  const player = usePlayerStore()
  const manager = createRegisteredManager()
  const result = restoreGameSession(player, manager, save)
  return { player, manager, result }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.spyOn(Date, 'now').mockReturnValue(1_725_160_000_000)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ------------------------------------------------------------------
// F-SKILLS-TXP-1: skills[].totalExperience has NO shape check - the
// entry validator (validateSkillEntries) requires only `id`, and the
// restore copies the field verbatim onto the template clone
// (GameManagerSaveRestore ~L219). Yet the same value is a LIVE input:
//   - getPrecursorFlatDamageBonus(totalExperience) = floor(t/10)
//     mints unbounded flat damage on the three precursor actives
//     (tram/linh_bao/huy_quyen - linh_bao IS the beta starter);
//   - getCastLeveledSkillLevel mints skill LEVELS from it (>=10000
//     casts -> Lv3 -> hidden-path offer gates read the same mirror);
//   - the writer's own mirror player.skillCastCounts[id] is updated in
//     the SAME statement that increments totalExperience
//     (SkillSystem ~L323+L336 -> GameManager.setCastCountSink), so an
//     honest save can never carry totalExperience > 0 with an absent
//     or divergent mirror - the validator checks neither shape nor
//     the one-writer coherence invariant it enforces everywhere else
//     (skillInsight<=totalSkillInsightGained, picked nodes mirrors...).
// ------------------------------------------------------------------
describe('F-SKILLS-TXP-1: forged skills[].totalExperience mints precursor damage', () => {
  it('rejects totalExperience with an absent skillCastCounts mirror', () => {
    const save = mortalSave()
    const linhBao = save.skills.find((entry) => entry.id === 'linh_bao')!
    // 1M casts = +100k flat damage on the beta starter. No writer can
    // emit this without the mirror row the sink writes in the same
    // statement - and the mirror itself stays forge-free below.
    ;(linhBao as { totalExperience?: number }).totalExperience = 1_000_000

    // mint evidence: validation currently ADMITS the forged field and
    // restore lands it verbatim on the live skill object.
    const { manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')
    const restored = manager.skillManager.get('linh_bao')!
    expect(restored.totalExperience).toBe(1_000_000)
    expect(getPrecursorFlatDamageBonus(restored.totalExperience!)).toBe(100_000)

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('rejects totalExperience ABOVE the skillCastCounts mirror', () => {
    const save = mortalSave()
    const linhBao = save.skills.find((entry) => entry.id === 'linh_bao')!
    ;(linhBao as { totalExperience?: number }).totalExperience = 1_000_000
    // The sink writes both in the same statement and the mirror only
    // grows (unlearn leaves stale counts, relearn restarts the entry)
    // - so tExp > mirror is fabricated by construction.
    save.player.skillCastCounts = { linh_bao: 42 }

    expect(validateGameSaveShape(save).ok).toBe(false)
  })

  it('rejects a non-numeric totalExperience (string coerces into damage)', () => {
    const save = mortalSave()
    const linhBao = save.skills.find((entry) => entry.id === 'linh_bao')!
    // No type check at all: Math.max(0, '999999') coerces to 999999,
    // so even a STRING-typed field mints +99999 flat damage.
    ;(linhBao as unknown as { totalExperience: unknown }).totalExperience = '999999'

    const { manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')
    const restored = manager.skillManager.get('linh_bao')!
    expect(getPrecursorFlatDamageBonus(restored.totalExperience as number)).toBe(99_999)

    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

// ------------------------------------------------------------------
// F-SKILLS-TXP-2: cast-level mint from the same unvalidated field.
// getCastLeveledSkillLevel('linh_bao', t>=10000) -> 3: the writer only
// reaches Lv3 after ten thousand real casts; the forged value claims
// the level (and its downstream offer/prereq consequences) for free.
// ------------------------------------------------------------------
describe('F-SKILLS-TXP-2: forged totalExperience mints cast-level 3', () => {
  it('rejects a Lv3-claiming totalExperience the mirror does not confirm', () => {
    const save = mortalSave()
    const linhBao = save.skills.find((entry) => entry.id === 'linh_bao')!
    ;(linhBao as { totalExperience?: number }).totalExperience = 10_000

    expect(getCastLeveledSkillLevel('linh_bao', 10_000)).toBe(3)
    expect(validateGameSaveShape(save).ok).toBe(false)
  })
})

// ------------------------------------------------------------------
// HOLDS: the coherent sibling claim still loads - a small, mirrored
// totalExperience is exactly what the writer emits after 7 casts.
// ------------------------------------------------------------------
describe('HOLDS: coherent skill counters keep loading', () => {
  it('accepts totalExperience equal to the skillCastCounts mirror', () => {
    const save = mortalSave()
    const linhBao = save.skills.find((entry) => entry.id === 'linh_bao')!
    ;(linhBao as { totalExperience?: number }).totalExperience = 7
    ;(linhBao as { experience?: number }).experience = 7
    save.player.skillCastCounts = { linh_bao: 7 }

    expect(validateGameSaveShape(save).ok).toBe(true)

    const { manager, result } = restoreSave(save)
    expect(result.status).toBe('ok')
    expect(manager.skillManager.get('linh_bao')?.totalExperience).toBe(7)
  })

  it('accepts totalExperience below the mirror (relearn keeps stale cast history)', () => {
    const save = mortalSave()
    const linhBao = save.skills.find((entry) => entry.id === 'linh_bao')!
    // Unlearn keeps the mirror (SkillSystem.ts:292), relearn restarts
    // the entry counter at 0 - tExp < mirror is the honest relearned
    // shape and must stay loadable.
    ;(linhBao as { totalExperience?: number }).totalExperience = 3
    save.player.skillCastCounts = { linh_bao: 1_000 }

    expect(validateGameSaveShape(save).ok).toBe(true)
  })

  it('accepts a mirror row for a skill absent from skills[] (unlearned)', () => {
    const save = mortalSave()
    save.player.skillCastCounts = { linh_bao: 7, tram: 50 }

    expect(validateGameSaveShape(save).ok).toBe(true)
  })
})
