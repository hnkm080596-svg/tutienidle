import { describe, expect, it } from 'vitest'
import { PassiveSystem } from './PassiveSystem'
import { EventBus } from '../events/EventBus'
import { SkillManager } from './SkillManager'
import { SkillSystem } from './SkillSystem'
import { createDefaultPlayer } from '../player/Player'
import { TALENT_PASSIVE_SKILLS } from '@/data/skill/TalentPassives'

// Talent v4 M2 — Pha Giap carry (spec §4.1 row 2, §7): victory banks
// floor(stacks * 0.5) into player.phaGiapCarryStacks (+ the realm the
// bank was earned in); the next battle re-seeds them onto the bound
// passive; a realm change decays the bank to 0.

function makeHarness() {
  const skillManager = new SkillManager()
  const phaGiap = TALENT_PASSIVE_SKILLS.find((s) => s.id === 'talent_passive_pha_giap')!
  // Runtime copy like GameManager's grant path (shallow modifier copies).
  skillManager.add({ ...phaGiap, passiveModifiers: phaGiap.passiveModifiers?.map((m) => ({ ...m })) })

  const skillSystem = new SkillSystem(skillManager)
  const bus = new EventBus()

  return { system: new PassiveSystem(bus, skillManager, skillSystem), skillManager }
}

function playerWithPhaGiap() {
  const player = createDefaultPlayer()
  player.selectedTalentIds = ['pha_giap']
  player.realmId = 'qi_refining'
  return player
}

describe('PassiveSystem — Pha Giap cross-battle carry (M2)', () => {
  it('victory bank: floor(stacks * 0.5) -> phaGiapCarryStacks + realmId', () => {
    const { system, skillManager } = makeHarness()
    const player = playerWithPhaGiap()

    const modifier = skillManager.get('talent_passive_pha_giap')!.passiveModifiers![0]!
    modifier.stacks = 5

    system.bankBattleCarryStacks(player)

    expect(player.phaGiapCarryStacks).toBe(2) // floor(5 * 0.5)
    expect(player.phaGiapCarryRealmId).toBe('qi_refining')
  })

  it('next battle seed: carried stacks restore onto the passive (capped by maxStacks)', () => {
    const { system, skillManager } = makeHarness()
    const player = playerWithPhaGiap()
    player.phaGiapCarryStacks = 3
    player.phaGiapCarryRealmId = 'qi_refining'

    system.resetStacks()
    system.seedBattleCarryStacks(player)

    const modifier = skillManager.get('talent_passive_pha_giap')!.passiveModifiers![0]!
    expect(modifier.stacks).toBe(3)
  })

  it('seed capped by passive maxStacks (carry vuot tran khong gay tran stack)', () => {
    const { system, skillManager } = makeHarness()
    const player = playerWithPhaGiap()
    player.phaGiapCarryStacks = 9
    player.phaGiapCarryRealmId = 'qi_refining'

    system.seedBattleCarryStacks(player)

    const modifier = skillManager.get('talent_passive_pha_giap')!.passiveModifiers![0]!
    expect(modifier.stacks).toBe(5) // maxStacks = 5
  })

  it('realm change decays the bank — vet kiem cu khong theo sang canh gioi moi', () => {
    const { system, skillManager } = makeHarness()
    const player = playerWithPhaGiap()
    player.realmId = 'golden_core' // banked in qi_refining
    player.phaGiapCarryStacks = 3
    player.phaGiapCarryRealmId = 'qi_refining'

    system.seedBattleCarryStacks(player)

    expect(player.phaGiapCarryStacks).toBe(0)
    expect(player.phaGiapCarryRealmId).toBeNull()
    expect(skillManager.get('talent_passive_pha_giap')!.passiveModifiers![0]!.stacks ?? 0).toBe(0)
  })

  it('khong co pha_giap: bank/seed deu no-op', () => {
    const { system, skillManager } = makeHarness()
    const player = createDefaultPlayer()
    player.realmId = 'qi_refining'

    const modifier = skillManager.get('talent_passive_pha_giap')!.passiveModifiers![0]!
    modifier.stacks = 4

    system.bankBattleCarryStacks(player)
    expect(player.phaGiapCarryStacks).toBe(0)

    player.phaGiapCarryStacks = 3
    player.phaGiapCarryRealmId = 'qi_refining'
    system.seedBattleCarryStacks(player)
    expect(modifier.stacks).toBe(4) // untouched
  })
})
