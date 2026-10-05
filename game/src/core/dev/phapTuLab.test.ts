// Phap Tu dev lab - the poke's provisioning contract: every leg must go
// through the real ops seams (commitFiveElementInitiation,
// TribulationOutcomeService.resolveVictory, purchaseNode,
// allocateAttributePoint) so the character it produces is one the real
// game could have produced, and states the ops cannot legally reach are
// refused instead of forged.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { GameManager } from '../game/GameManager'
import { usePlayerStore } from '../../stores/player'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { ALL_PROGRESSION_NODES } from '../../data/progression/ProgressionNodeCatalog'
import { STAGES } from '../../data/stage/Stages'
import { zones } from '../../data/stage/Zones'
import { TINH_THONG_NODE_IDS } from '../../data/progression/PhapTuRealmRewardNodes'
import { registerPhapTuLab, type PhapTuLabDeps } from './phapTuLab'

function makeDeps(gameManager: GameManager): PhapTuLabDeps {
  const player = usePlayerStore()
  return {
    gameManager,
    player,
    getPlayerState: () => player.$state,
    enterStage: vi.fn(async () => true),
    exitCombat: vi.fn(),
    openSkillPanel: vi.fn(),
    setManualInput: vi.fn(),
    refreshUi: vi.fn(),
  }
}

function registerCatalogs(gameManager: GameManager): void {
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(ALL_PROGRESSION_NODES)
  gameManager.catalogOps.registerStages(STAGES)
  gameManager.catalogOps.registerZones(zones)
}

describe('phapTuLab poke', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('provisions a fresh mortal into a Truc Co fire Phap Tu via the real seams', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const deps = makeDeps(gameManager)
    registerCatalogs(gameManager)
    registerPhapTuLab(deps)

    const lab = window.__tutienPhapTuLab!
    const status = lab.setup()

    expect(status.startsWith('ok')).toBe(true)
    expect(player.realmId).toBe('foundation_establishment')
    expect(player.realmLevel).toBe(1)
    expect(player.cultivationPath).toBe('spell')
    expect(player.cultivationWay).toBe('spell_pathway')
    expect(player.spellPath.element).toBe('fire')
    // Full kit through learn seams: starter basic, element basic (root
    // unlock), Truc Co special (keystone purchase).
    expect(gameManager.skillManager.has('linh_bao')).toBe(true)
    expect(gameManager.skillManager.has('hoa_cau_thuat')).toBe(true)
    expect(gameManager.skillManager.has('tam_muoi_chan_hoa')).toBe(true)
    expect(player.nodeLevels.linh_ngo_tam_muoi_chan_hoa).toBe(1)
    expect(player.nodeLevels.hoa_linh_ngo).toBe(1)
    // Realm reward from the real victory pipeline (fire mastery Lv1).
    expect(player.nodeLevels[TINH_THONG_NODE_IDS.fire]).toBe(1)
    // Talent entitlement auto-resolved so the modal never blocks the lab.
    expect(player.pendingTalentEntitlement).toBeUndefined()
    // Attribute leg: 90 granted, plan allocates attunement/vitality/dexterity.
    expect(player.attributePoints).toBe(0)
    expect(player.baseStats.attunement).toBe(41)
    expect(player.baseStats.vitality).toBe(31)
    expect(player.baseStats.dexterity).toBe(21)
    expect(deps.refreshUi).toHaveBeenCalled()
  })

  it('the minted insight carries its totalSkillInsightGained witness (F-A11-3)', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const deps = makeDeps(gameManager)
    registerCatalogs(gameManager)
    registerPhapTuLab(deps)

    window.__tutienPhapTuLab!.setup()

    // The save gate rejects skillInsight > totalSkillInsightGained as a
    // fabricated currency claim - the lab mint must keep the pair in step
    // (150,000 minted, the keystone purchase then spends what it costs).
    expect(player.totalSkillInsightGained).toBe(150_000)
    expect(player.totalSkillInsightGained).toBeGreaterThanOrEqual(player.skillInsight)
  })

  it('re-running setup leaves the provisioned save unchanged', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const deps = makeDeps(gameManager)
    registerCatalogs(gameManager)
    registerPhapTuLab(deps)

    window.__tutienPhapTuLab!.setup()
    const after = {
      attunement: player.baseStats.attunement,
      vitality: player.baseStats.vitality,
      dexterity: player.baseStats.dexterity,
      attributePoints: player.attributePoints,
    }

    const second = window.__tutienPhapTuLab!.setup()
    expect(second.startsWith('ok')).toBe(true)
    expect(player.baseStats.attunement).toBe(after.attunement)
    expect(player.baseStats.vitality).toBe(after.vitality)
    expect(player.baseStats.dexterity).toBe(after.dexterity)
    expect(player.attributePoints).toBe(after.attributePoints)
    // Insight floor restores to the grant ceiling, never accumulates.
    expect(player.skillInsight).toBe(150_000)
  })

  it('keepTalent leaves the breakthrough entitlement modal pending', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const deps = makeDeps(gameManager)
    registerCatalogs(gameManager)
    registerPhapTuLab(deps)

    window.__tutienPhapTuLab!.setup({ keepTalent: true })

    expect(player.pendingTalentEntitlement?.realmId).toBe('foundation_establishment')
  })

  it('battle() fills the clear chain and enters through the injected stage seam', async () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    const deps = makeDeps(gameManager)
    registerCatalogs(gameManager)
    registerPhapTuLab(deps)

    window.__tutienPhapTuLab!.setup()
    const result = await window.__tutienPhapTuLab!.battle('foundation_floor_3')

    expect(result).toBe('entered: foundation_floor_3')
    expect(player.completedStageIds).toContain('foundation_floor_2')
    expect(player.completedStageIds).toContain('foundation_floor_1')
    expect(player.completedStageIds).toContain('qi_refining_abyssal_pool')
    expect(deps.setManualInput).toHaveBeenCalledWith(true)
    expect(deps.enterStage).toHaveBeenCalledWith(
      'thanh_van',
      expect.objectContaining({ id: 'foundation_floor_3' }),
    )
  })

  it('refuses a save already committed to a non-spell path', () => {
    const gameManager = new GameManager()
    const player = usePlayerStore()
    registerCatalogs(gameManager)
    registerPhapTuLab(makeDeps(gameManager))

    player.cultivationPath = 'sword'
    player.cultivationWay = 'sword_pathway'

    expect(window.__tutienPhapTuLab!.setup()).toContain('refused')
    expect(player.realmId).toBe('mortal')
  })

  it('refuses while a battle is running', async () => {
    const gameManager = new GameManager()
    registerCatalogs(gameManager)
    const deps = makeDeps(gameManager)
    registerPhapTuLab(deps)

    vi.spyOn(gameManager, 'getTurnBattle').mockReturnValue({ state: 'fighting' } as never)

    expect(window.__tutienPhapTuLab!.setup()).toBe('refused: in_combat')
    await expect(window.__tutienPhapTuLab!.battle()).resolves.toBe('refused: in_combat')
  })

  it('openConstellation routes through the injected panel opener', () => {
    const gameManager = new GameManager()
    const deps = makeDeps(gameManager)
    registerCatalogs(gameManager)
    registerPhapTuLab(deps)

    expect(window.__tutienPhapTuLab!.openConstellation()).toBe('skill panel opened')
    expect(deps.openSkillPanel).toHaveBeenCalled()
    expect(deps.exitCombat).not.toHaveBeenCalled()
  })

  it('openConstellation leaves an in-progress battle before opening', () => {
    const gameManager = new GameManager()
    const deps = makeDeps(gameManager)
    registerCatalogs(gameManager)
    registerPhapTuLab(deps)

    vi.spyOn(gameManager, 'getTurnBattle').mockReturnValue({ state: 'fighting' } as never)

    expect(window.__tutienPhapTuLab!.openConstellation()).toBe('skill panel opened')
    expect(deps.exitCombat).toHaveBeenCalled()
    expect(deps.openSkillPanel).toHaveBeenCalled()
  })
})
