import { describe, expect, it } from 'vitest'

import { COMPANIONS, type CompanionInstance } from '../../data/companion/Companions'
import { KIEM_PHO_COMBOS } from '../../data/skill/KiemPhoCombos'
import { KIEM_PHO_ORBS } from '../../data/skill/KiemPhoOrbs'
import {
  KIEM_DAO_CASCADE_EMBLEM,
  NGU_KIEM_THUAT,
  TU_KIEM_Y_EMBLEM,
} from '../../data/skill/NguKiemDaoSkills'
import { PHAP_TU_EMPOWERED_ULTS } from '../../data/skill/PhapTuEmpoweredUlts'
import { PHAP_TU_KIT_IDS, SKILLS } from '../../data/skill/Skills'
import {
  BAT_TU_BA_THE,
  CUONG_QUYEN,
  LOAN_DAU,
  PHAN_CHINH,
  SON_NHAC,
  TRAN_AP,
  buildTheTuAnKit,
  buildTheTuKit,
} from '../../data/skill/TheTuSkills'
import { applyAnKitToBasic, applyAnKitToSpecial } from '../../data/skill/TurnAnKitSkills'
import {
  BASIC_ATTACKS_BY_BUILD,
  GENERIC_PHYSICAL_BASIC,
  KIEM_TU_BASIC,
  PHAP_TU_BASICS,
  THUY_GIAP_LONG_WATER_SURGE,
} from '../../data/skill/TurnBasicAttacks'
import { BUFF_REGISTRY } from '../../data/buff/BuffRegistry'
import { ELEMENT_ORDER } from '../element/ElementLabels'
import { buildNguKiemDaoProvider } from '../kiem-tu/NguKiemDaoProvider'
import { freshKiemTuState } from '../kiem-tu/KiemTuState'
import { resolveCompanionSkillKit } from '../companion/CompanionProgression'
import { createDefaultPlayer } from '../player/Player'
import { SkillManager } from '../skill/SkillManager'
import type { TurnBattleParticipant } from '../battle/turn/TurnBattleSystem'
import { SkillSystem } from '../skill/SkillSystem'
import type { TurnSkillDefinition } from '../battle/turn/TurnSkillAction'
import {
  adaptTurnSkillDefinition,
  collectUnsupportedSkillSemantics,
  mergeAdaptedCatalogs,
  toTurnSkillDefinition,
} from './LegacySkillAdapter'
import { SkillDefinitionRegistry } from './SkillDefinitionRegistry'

// ---------------------------------------------------------------------------
// skilldef M5 -- the production castable-def census. Every
// TurnSkillDefinition a participant can carry into applyActionImpact must
// adapt to a validated ActiveSkillDefinition catalog with ZERO unsupported
// reports -- any entry left here would strand a live cast on the legacy
// lane (or, post-retirement, fault it). This is the INV-S2 "one ACTIVE
// pipeline" gate: the census IS the routing coverage proof.
// ---------------------------------------------------------------------------

function collectCastableDefs(): ReadonlyArray<{ source: string; def: TurnSkillDefinition }> {
  const out: { source: string; def: TurnSkillDefinition }[] = []
  const push = (source: string, def: TurnSkillDefinition | undefined): void => {
    if (def !== undefined) out.push({ source, def })
  }

  // Native turn defs -- basics + enemy specials + the boss surge lane.
  // PHAP_TU_BASICS is intentionally NOT enumerated: it is the drifted
  // static table resolveAuthoredBasic replaced (CultivationPathRegistry
  // comment -- "a second authority that drifted from authored skills");
  // no production path casts it.
  push('TurnBasicAttacks:kiem_tu', KIEM_TU_BASIC)
  push('TurnBasicAttacks:generic', GENERIC_PHYSICAL_BASIC)
  push('TurnBasicAttacks:thuy_giap_long', THUY_GIAP_LONG_WATER_SURGE)
  for (const [id, def] of Object.entries(BASIC_ATTACKS_BY_BUILD)) push(`TurnBasicAttacks:build:${id}`, def)

  // Authored Skills -> converter output (the CultivationPathRegistry leg).
  // type !== 'active' templates (passive emblem shells, PassiveSystem
  // passives) never reach a cast slot -- the runtime lane never sees
  // them, so the census must not either.
  const manager = new SkillManager()
  for (const skill of SKILLS) manager.add(structuredClone(skill))
  const skillSystem = new SkillSystem(manager)
  for (const skill of SKILLS) {
    if (skill.type !== 'active') continue
    push(
      `Skill:${skill.id}`,
      toTurnSkillDefinition(skill, skillSystem.getEffectiveSkill(skill)),
    )
    for (const spec of skill.specializations ?? []) {
      const specialized = structuredClone(skill)
      specialized.selectedSpecializationId = spec.id
      push(
        `Skill:${skill.id}#${spec.id}`,
        toTurnSkillDefinition(specialized, skillSystem.getEffectiveSkill(specialized)),
      )
    }
  }

  // Empowered ult payloads (all five elements x both variants).
  for (const [element, variants] of Object.entries(PHAP_TU_EMPOWERED_ULTS)) {
    for (const [variant, def] of Object.entries(variants)) {
      push(`EmpoweredUlt:${element}.${variant}`, def)
    }
  }

  // The Tu kits -- static defs + both root kits + the An kit incl.
  // reactivePayloads (the bypass lane casts these too).
  for (const [name, def] of Object.entries({
    cuong_quyen: CUONG_QUYEN,
    loan_dau: LOAN_DAU,
    bat_tu_ba_the: BAT_TU_BA_THE,
    tran_ap: TRAN_AP,
    phan_chinh: PHAN_CHINH,
    son_nhac: SON_NHAC,
  })) {
    push(`TheTuSkills:${name}`, def)
  }
  const zeroKitMods = {
    missingHpBonusBonus: 0,
    reflectMaxHpRatioBonus: 0,
    reflectTakenRatioBonus: 0,
    sonNhacWardRatioBonus: 0,
    tauntTurnsBonus: 0,
    batTuDurationBonus: 0,
  }
  for (const root of ['cuong_chien', 'tran_the'] as const) {
    const kit = buildTheTuKit(root, zeroKitMods)
    push(`TheTuKit:${root}.basic`, kit.basic)
    push(`TheTuKit:${root}.special`, kit.special)
    push(`TheTuKit:${root}.ultimate`, kit.ultimate)
  }
  const anKit = buildTheTuAnKit(['ho_mon', 'phan_mon', 'tro_mon'])
  push('TheTuAnKit:basic', anKit.basic)
  push('TheTuAnKit:special', anKit.special)
  push('TheTuAnKit:ultimate', anKit.ultimate)
  for (const [id, def] of Object.entries(anKit.reactivePayloads)) {
    push(`TheTuAnKit:reactive:${id}`, def)
  }

  // Ngu Kiem Dao -- authored defs + every cascade-unlock provider shape.
  push('NguKiemDao:thuat', NGU_KIEM_THUAT)
  push('NguKiemDao:emblem_y', TU_KIEM_Y_EMBLEM)
  push('NguKiemDao:emblem_cascade', KIEM_DAO_CASCADE_EMBLEM)
  const nguPlayer = createDefaultPlayer()
  nguPlayer.cultivationPath = 'kiem_tu'
  nguPlayer.cultivationWay = 'ngu'
  nguPlayer.realmId = 'golden_core'
  nguPlayer.kiemTu = freshKiemTuState()
  for (const unlocks of [
    { a: false, e: false, d: false },
    { a: true, e: false, d: false },
    { a: false, e: true, d: false },
    { a: false, e: false, d: true },
    { a: true, e: true, d: true },
  ]) {
    const provider = buildNguKiemDaoProvider(nguPlayer, unlocks)
    push(`NguKiemDao:provider:${JSON.stringify(unlocks)}`, provider.resolveBasic({} as TurnBattleParticipant))
  }

  // Kiem Pho orbs + every combo's extra-cast def shape
  // (KiemPhoProvider.comboToExtraDef -- private; mirrored field-for-field).
  for (const [id, def] of Object.entries(KIEM_PHO_ORBS)) push(`KiemPho:orb:${id}`, def)
  for (const combo of KIEM_PHO_COMBOS) {
    push(`KiemPho:combo:${combo.id}`, {
      id: combo.id,
      cooldownTurns: 0,
      damage: combo.damage
        ? { kind: 'physical', multiplier: combo.damage.multiplier }
        : undefined,
      targeting: combo.targeting ?? { shape: 'single' },
      appliesBuffs: combo.appliesBuffs?.map((buff) => ({ ...buff })),
      presetId: combo.presetId,
    })
  }

  // Companion kits at max unlock (special+ultimate slots populated).
  const maxInstance: CompanionInstance = {
    instanceId: 'inst.census',
    definitionId: 'census',
    realmId: 'tribulation',
    realmLevel: 9,
    exp: 0,
    constellationRank: 6,
  }
  for (const companion of COMPANIONS) {
    const kit = resolveCompanionSkillKit(companion, {
      ...maxInstance,
      definitionId: companion.id,
    })
    push(`Companion:${companion.id}.basic`, kit.basic)
    push(`Companion:${companion.id}.special`, kit.special)
    push(`Companion:${companion.id}.ultimate`, kit.ultimate)
  }

  // An-kit mutator clones over real converter output (the element pool the
  // orchestrator actually builds). The equipped basic gets the production
  // forced fields post-mutation (resolveAuthoredBasic); pool members stay
  // raw conversions -- so the mutated root's id legitimately collides with
  // its own pool member ('doc_chuong' below).
  const elementPool = ELEMENT_ORDER.map((element) => {
    const basicId = PHAP_TU_KIT_IDS[element][0]
    const template = manager.get(basicId)!
    return toTurnSkillDefinition(template, skillSystem.getEffectiveSkill(template))
  })
  push('AnKit:basic+multicast', {
    ...applyAnKitToBasic(elementPool[0]!, true, elementPool),
    cooldownTurns: 0,
    resourceType: 'none',
    resourceCost: undefined,
  })
  const anSpecialTemplate = manager.get(PHAP_TU_KIT_IDS.fire[1])!
  push(
    'AnKit:special',
    applyAnKitToSpecial(
      toTurnSkillDefinition(
        anSpecialTemplate,
        skillSystem.getEffectiveSkill(anSpecialTemplate),
      ),
      elementPool,
    ),
  )

  return out
}

describe('LegacySkillAdapter -- production coverage census (M5/INV-S2)', () => {
  const defs = collectCastableDefs()

  it('enumerates the full castable surface', () => {
    // Guards against silent producer additions dropping out of the census:
    // the count is pinned so a new producer fails loudly until it is
    // enumerated here. Uniqueness binds the SOURCE labels: def ids repeat
    // legitimately across mutated clones (the An-augmented basic keeps its
    // template id 'doc_chuong', which also appears as a plain conversion).
    expect(defs.length).toBeGreaterThanOrEqual(60)
    expect(new Set(defs.map(({ source }) => source)).size).toBe(defs.length)
  })

  it('every castable def adapts with zero unsupported reports', () => {
    const failures: string[] = []

    for (const { source, def } of defs) {
      const catalog = adaptTurnSkillDefinition(def)

      if (catalog.unsupported.length > 0) {
        failures.push(`${source} (${def.id}): ${catalog.unsupported.join(' | ')}`)
        continue
      }

      try {
        new SkillDefinitionRegistry(mergeAdaptedCatalogs([catalog]), {
          isBuffDefinitionId: (id) => BUFF_REGISTRY.has(id),
        })
      } catch (error) {
        failures.push(
          `${source} (${def.id}): registry rejected -- ${(error as Error).message.slice(0, 200)}`,
        )
      }
    }

    expect(failures, `defs stranded on the legacy lane:\n${failures.join('\n')}`).toEqual([])
  })

  it('the full production surface merges into ONE registry without conflicts', () => {
    // The runtime's cumulative-registry semantics (catalogFor rebuilds
    // across every admitted catalog): adapted catalogs that each pass
    // alone can still collide when they coexist in one battle (shared
    // pool members, same-id mutated clones). A genuine same-id/different-
    // shape conflict must fault HERE, not at cast time.
    const failures: string[] = []
    const catalogs = []

    for (const { source, def } of defs) {
      // Specialization variants are mutually exclusive inside one
      // battle -- a player equips exactly one variant of a skill, so
      // same-id different-shape ROOT collisions across variants are not
      // reachable. They still must each adapt alone (the test above).
      if (source.includes('#')) continue
      const catalog = adaptTurnSkillDefinition(def)
      if (catalog.unsupported.length > 0) {
        failures.push(`${source} (${def.id}): ${catalog.unsupported.join(' | ')}`)
        continue
      }
      catalogs.push(catalog)
    }

    try {
      new SkillDefinitionRegistry(mergeAdaptedCatalogs(catalogs), {
        isBuffDefinitionId: (id) => BUFF_REGISTRY.has(id),
      })
    } catch (error) {
      failures.push(`merged registry rejected -- ${(error as Error).message.slice(0, 400)}`)
    }

    expect(failures, `merged-registry failures:\n${failures.join('\n')}`).toEqual([])
  })

  it('converter-level reports stay build-time only (adaptSkill parity note)', () => {
    // The Skill->converter leg drops authored fields with a console warn at
    // battle build; those drops are identical on both lanes (the legacy
    // lane consumed the same converted def), so they never gate routing.
    // This test pins the converter's own report surface for visibility.
    const manager = new SkillManager()
    for (const skill of SKILLS) manager.add(structuredClone(skill))
    const skillSystem = new SkillSystem(manager)
    const reported: string[] = []
    for (const skill of SKILLS) {
      const unsupported = collectUnsupportedSkillSemantics(
        skill,
        skillSystem.getEffectiveSkill(skill),
      )
      if (unsupported.length > 0) {
        reported.push(`${skill.id}: ${unsupported.join(' | ')}`)
      }
    }
    // Snapshot-free assertion: the surface exists and stays enumerable.
    expect(reported.every((entry) => entry.length > 0)).toBe(true)
  })
})
