import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlayerStore } from '../stores/player'
import { GameManager } from '../core/game/GameManager'
import { checkTribulationOutcomeAction, triggerBreakthroughAction } from './useTribulation'
import { getTribulationChapters } from '../data/tribulation/TribulationChapters'
import { asBaseStats } from '../core/stats/StatBlock'
import { CHARACTER_CREATION_TALENTS, getTalentDefinition } from '../data/talent/Talents'
import { pills } from '../data/pill/pills'
import { TECHNIQUES } from '../data/technique/Techniques'
import { SKILLS } from '../data/skill/Skills'
import { MERIDIANS } from '../data/realm/Meridians'
import { makeInstance } from '../core/equipment/EquipmentInstance.fixture'
import { PROFESSION_GRADE_BY_REALM } from '../core/profession/ProfessionGrade'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'

// Snapshot hoan hao Pham Nhan + Pham Nhan Chi Cot (spec dot-pha-loi-kiep
// S4.2/S4.4) - integration qua GameManager + useTribulation that.
function tribulationTotalSeconds(targetRealmId: string): number {
  return getTribulationChapters(targetRealmId)!.reduce((total, chapter) => {
    if (chapter.mind) {
      return total + chapter.mind.questionCount * (chapter.mind.firstQuestionSeconds + chapter.mind.restSecondsBetweenQuestions) + 2
    }
    return total + chapter.tank!.durationSeconds + 2
  }, 0)
}

describe('Snapshot hoàn hảo Phàm Nhân (spec §4.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('chooseCultivationPath khi 5/5 stat 10/10 + 6/6 Luyện Th thể → mortalPerfectionAchieved = true', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = usePlayerStore()
    player.realmLevel = 12
    player.bodyProgression.body_refinement.completedTiers = 6
    player.physiqueGrade = 'bao'
    player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)).toBe(true)
    expect(player.mortalPerfectionAchieved).toBe(true)
  })

  it('thiếu 1 stat (9/10) → false; thiếu 1 tầng Luyện Th thể (5/6) → false', () => {
    // usePlayerStore() trong cung pinia tra CUNG instance - reset path
    // giua 2 case (giu nguyen realm mortal tang 12).
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = usePlayerStore()
    player.realmLevel = 12
    player.bodyProgression.body_refinement.completedTiers = 6
    player.physiqueGrade = 'bao'
    player.baseStats = { ...player.baseStats, strength: 9, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)).toBe(true)
    expect(player.mortalPerfectionAchieved).toBe(false)

    // Reset de chon lai (case 2: du stat nhung Luyen Th the 5/6) -
    // M2: path + way la 1 cap ghi nguyen tu, reset phai xoa ca hai.
    // P7-M3: the technique holder is part of the ritual's atomic
    // contract too - a non-empty holder rejects the re-choice.
    player.cultivationPath = undefined
    player.cultivationWay = undefined
    gameManager.techniqueManager.setActive(null)
    player.realmId = 'mortal'
    player.realmLevel = 12
    player.bodyProgression.body_refinement.completedTiers = 5
    player.baseStats = { ...player.baseStats, strength: 10 }

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)).toBe(true)
    expect(player.mortalPerfectionAchieved).toBe(false)
  })

  it('snapshot chốt tại thời điểm Quán Khí — KHÔNG hồi cứu sau khi vào Luyện Khí', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = usePlayerStore()
    player.realmLevel = 12
    player.bodyProgression.body_refinement.completedTiers = 6
    player.physiqueGrade = 'bao'
    player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }

    gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)
    expect(player.mortalPerfectionAchieved).toBe(true)

    // Sau khi vao Luyen Khi, "hoan hao" khong doi du stat/luyen the doi
    player.bodyProgression.body_refinement.completedTiers = 0
    expect(player.mortalPerfectionAchieved).toBe(true)
  })
})

describe('Phàm Nhân Chi Cốt (spec §4.4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('talent pham_nhan_chi_cot tồn tại, KHÔNG thuộc pool roll (weight 0), effect đảo dấu +75%', () => {
    const talent = getTalentDefinition('pham_nhan_chi_cot')
    expect(talent).toBeDefined()
    const inPool = CHARACTER_CREATION_TALENTS.some((t) => t.id === 'pham_nhan_chi_cot')
    expect(inPool).toBe(false)
    expect(talent!.effects).toEqual([{ kind: 'cultivation_speed', percent: 0.75 }])
  })

  it('thắng kiếp Đại Đạo Trúc Cơ: Phàm Cốt chuyển thành Phàm Nhân Chi Cốt + highestFoundationAchieved = great_dao', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()

    // Dung nhan vat du moi dieu kien Dai Dao
    player.selectedTalentIds = ['pham_cot']
    player.realmLevel = 12
    player.bodyProgression.body_refinement.completedTiers = 6
    player.physiqueGrade = 'bao'
    player.mortalPerfectionAchieved = true
    player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }

    // Quan Khi truoc (vao Luyen Khi)
    gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)
    expect(player.realmId).toBe('qi_refining')

    // Dau tu tiep de du dieu kien Dai Dao o Luyen Khi
    player.realmLevel = 18
    player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
    player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)
    const trucCoDan = gameManager.pillRegistry.get('truc_co_dan')!
    gameManager.pillBag.add(trucCoDan, 1)

    // Stats du tru kiep Dai Dao (x1.85 kho hon) - ARCH-002 (M7): the
    // snapshot resolves internally; patch the RAW base.
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getState()!.grade).toBe('great_dao')

    // Troi het kiep + tra loi dung moi cau
    let guard = 0
    while (gameManager.tribulationDirector.getState()?.state === 'ongoing' && guard++ < 5000) {
      gameManager.tickOps.update(1)
      const q = gameManager.tribulationDirector.getState()!.currentQuestion
      if (q) gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)
    }

    expect(gameManager.tribulationDirector.getState()!.state).toBe('victory')
    checkTribulationOutcomeAction(player, gameManager)

    expect(player.highestFoundationAchieved).toBe('great_dao')
    expect(player.selectedTalentIds).not.toContain('pham_cot')
    expect(player.selectedTalentIds).toContain('pham_nhan_chi_cot')
    expect(player.realmId).toBe('foundation_establishment')
    // M-F-TALENT - the Dai Dao path's ONE result is the evolution: no
    // generic entitlement is minted and the drain is never held.
    expect(player.pendingTalentEntitlement).toBeUndefined()
    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
  })

  it('thua kiếp Đại Đạo: greatDaoOpportunityLost vĩnh viễn + KHÔNG đổi talent; lần xét sau cap Thiên', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()

    player.selectedTalentIds = ['pham_cot']
    player.realmLevel = 12
    player.bodyProgression.body_refinement.completedTiers = 6
    player.physiqueGrade = 'bao'
    player.mortalPerfectionAchieved = true
    player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }
    gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)

    player.realmLevel = 18
    player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
    player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)
    gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)

    // HP thap -> thua kiep dai dao
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 1, defense: 0, hpRegenPerTurn: 0 })

    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getState()!.grade).toBe('great_dao')

    let guard = 0
    while (gameManager.tribulationDirector.getState()?.state === 'ongoing' && guard++ < 5000) {
      gameManager.tickOps.update(1)
      const q = gameManager.tribulationDirector.getState()!.currentQuestion
      if (q) gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)
    }

    expect(gameManager.tribulationDirector.getState()!.state).toBe('defeat')
    checkTribulationOutcomeAction(player, gameManager)

    expect(player.greatDaoOpportunityLost).toBe(true)
    expect(player.selectedTalentIds).toContain('pham_cot') // KHONG doi
    expect(player.realmId).toBe('qi_refining') // KHONG len Truc Co

    // Lan xet sau: cap Thien (resolver test da khoa; o day kiem qua
    // Director). Bo qua cooldown 5 phut bang cach day system time.
    vi.setSystemTime(Date.now() + 6 * 60 * 1000)
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })
    gameManager.pillBag.add(gameManager.pillRegistry.get('truc_co_dan')!, 1)
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)
    expect(gameManager.tribulationDirector.getState()!.grade).toBe('heaven')
  })
})

describe('Đột phá tháo toàn bộ trang bị (rework P5, Task 17)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('victory realm mới → mọi item equipped=false + modifier equipment sync rỗng; slot state GIỮ enhanceLevel', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()

    player.selectedTalentIds = ['pham_cot']
    player.realmLevel = 12
    player.bodyProgression.body_refinement.completedTiers = 6
    player.physiqueGrade = 'bao'
    player.mortalPerfectionAchieved = true
    player.baseStats = { ...player.baseStats, strength: 10, dexterity: 10, intelligence: 10, attunement: 10, vitality: 10 }
    gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player.$state)
    expect(player.realmId).toBe('qi_refining')

    // Mac 1 mon do DUNG pham hien tai (qi_refining -> bat_pham, Task 16 gate).
    const weapon = makeInstance({
      instanceId: 'task17-victory-weapon',
      slot: 'weapon',
      grade: PROFESSION_GRADE_BY_REALM.qi_refining,
      equipped: true,
    })
    gameManager.equipmentBag.add(weapon)
    gameManager.equipmentSlotManager.restore([
      { ...gameManager.equipmentSlotManager.get('weapon'), enhanceLevel: 4, enhanceFailStreak: 2 },
    ])
    gameManager.equipmentSystem.refreshModifiers(
      gameManager.equipmentBag,
      gameManager.equipmentSlotManager,
      gameManager.affixRegistry,
    )
    player.setEquipmentModifiers(gameManager.equipmentOps.getEquipmentModifiers())
    expect(player.modifiers.some((m) => m.sourceType === 'equipment')).toBe(true)

    // Dau tu du dieu kien Truc Co (nhanh heaven, khong can great_dao).
    player.realmLevel = 18
    player.baseStats = { ...player.baseStats, strength: 30, dexterity: 30, intelligence: 30, attunement: 30, vitality: 30 }
    player.bodyProgression.meridian.openedIds = MERIDIANS.map((m) => m.id)

    // ARCH-002 (M7): startTribulation resolves internally - patch the
    // RAW base so the tribulation ghost survives the strikes.
    player.baseStats = asBaseStats({ ...player.baseStats, maxHp: 5_000_000, defense: 50_000, hpRegenPerTurn: 0 })
    expect(gameManager.startTribulation(player.$state, 'foundation_establishment')).toBe(true)

    let guard = 0
    while (gameManager.tribulationDirector.getState()?.state === 'ongoing' && guard++ < 5000) {
      gameManager.tickOps.update(1)
      const q = gameManager.tribulationDirector.getState()!.currentQuestion
      if (q) gameManager.tribulationDirector.answerQuestion(q.correctAnswerIndex)
    }

    expect(gameManager.tribulationDirector.getState()!.state).toBe('victory')
    checkTribulationOutcomeAction(player, gameManager)

    expect(player.realmId).toBe('foundation_establishment')
    expect(weapon.equipped).toBe(false)
    expect(gameManager.equipmentBag.getEquipped()).toHaveLength(0)
    expect(player.modifiers.some((m) => m.sourceType === 'equipment')).toBe(false)

    // Slot state (Cuong Hoa) KHONG bi reset boi unequip-all.
    const slotState = gameManager.equipmentSlotManager.get('weapon')
    expect(slotState.enhanceLevel).toBe(4)
    expect(slotState.enhanceFailStreak).toBe(2)
  })

  it('qi_refining tầng 12 chưa clear Quật 10 → triggerBreakthroughAction trả false, không tạo kiếp', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()

    player.realmId = 'qi_refining'
    player.realmLevel = 12

    expect(triggerBreakthroughAction(player, gameManager)).toBe(false)
    expect(gameManager.tribulationDirector.getState()).toBeNull()
  })

  it('triggerBreakthroughAction auto-unequip TRƯỚC khi vào kiếp', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()

    player.realmId = 'qi_refining'
    player.realmLevel = 12
    player.completedStageIds = ['qi_refining_abyssal_pool']
    player.baseStats.defense = 10_000
    player.baseStats.maxHp = 500_000

    const weapon = makeInstance({
      instanceId: 'trigger-unequip-weapon',
      slot: 'weapon',
      grade: PROFESSION_GRADE_BY_REALM.qi_refining,
      equipped: true,
    })
    gameManager.equipmentBag.add(weapon)
    gameManager.equipmentSystem.refreshModifiers(
      gameManager.equipmentBag,
      gameManager.equipmentSlotManager,
      gameManager.affixRegistry,
    )
    player.setEquipmentModifiers(gameManager.equipmentOps.getEquipmentModifiers())
    expect(player.modifiers.some((m) => m.sourceType === 'equipment')).toBe(true)

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    expect(weapon.equipped).toBe(false)
    expect(gameManager.equipmentBag.getEquipped()).toHaveLength(0)
    // Modifier equipment da sync rong NGAY luc trigger (truoc ca resolveVictory).
    expect(player.modifiers.some((m) => m.sourceType === 'equipment')).toBe(false)
    expect(gameManager.tribulationDirector.getState()).not.toBeNull()
  })

  it('target realm resolve qua getNextRealm — mortal→qi_refining, qi_refining→foundation_establishment', () => {
    // Mission G Task 35 - pin the single-owner swap: the breakthrough
    // target must come from the realm ladder, not a local map.
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()

    player.realmId = 'mortal'
    player.realmLevel = 12

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    expect(gameManager.tribulationDirector.getState()?.targetRealmId).toBe('qi_refining')
  })

  it('M-F-TALENT lock — entitlement pending giữ drain; resolve xong tick sau consume bình thường', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    gameManager.catalogOps.registerPills(pills)
    const player = usePlayerStore()

    player.realmId = 'mortal'
    player.realmLevel = 12
    player.baseStats.defense = 10_000
    player.baseStats.maxHp = 500_000

    expect(triggerBreakthroughAction(player, gameManager)).toBe(true)
    gameManager.tickOps.update(tribulationTotalSeconds('qi_refining'))

    // Victory settles on the seam AND writes the entitlement - the drain
    // is held while the decision record is pending.
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)
    expect(player.pendingTalentEntitlement?.realmId).toBe('qi_refining')
    expect(gameManager.tribulationDirector.getCommittedOutcome()).not.toBeNull()

    // Repeat ticks while pending: still held, still idempotent - the
    // same bound offers, no rebinding, no double-apply.
    const bound = player.pendingTalentEntitlement!
    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)
    expect(player.pendingTalentEntitlement).toEqual(bound)
    expect(gameManager.tribulationDirector.getCommittedOutcome()).not.toBeNull()

    // The mandatory decision resolves - same tick consumes the receipt
    // and drains the run normally.
    expect(gameManager.realmAdvanceOps.resolveTalentEntitlement(player, {
      kind: 'new',
      talentId: bound.offeredTalentIds[0]!,
    })).toBe(true)
    expect(player.selectedTalentIds).toContain(bound.offeredTalentIds[0]!)

    expect(checkTribulationOutcomeAction(player, gameManager)).toBe(true)
    expect(gameManager.tribulationDirector.getCommittedOutcome()).toBeNull()
  })

  it('foundation_establishment+ — canTriggerBreakthrough từ chối, action trả false', () => {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = usePlayerStore()

    player.realmId = 'foundation_establishment'
    player.realmLevel = 18

    expect(triggerBreakthroughAction(player, gameManager)).toBe(false)
    expect(gameManager.tribulationDirector.getState()).toBeNull()
  })
})
