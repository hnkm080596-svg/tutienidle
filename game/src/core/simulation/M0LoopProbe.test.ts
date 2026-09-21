// P6-M0 TEMPORARY probe - traces the early-game loop through the real
// systems and dumps findings for the inventory doc. Not a committed
// regression suite; will be replaced by the EarlyGameSession harness.
import { describe, expect, it } from 'vitest'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { SeededCombatRng } from '../battle/runtime/rng/SeededCombatRng'
import { GameManager } from '../game/GameManager'
import { createDefaultPlayer, type PlayerData } from '../player/Player'
import { addCultivation, breakthrough } from '../cultivation/CultivationSystem'
import { getRequiredCultivation } from '../realm/realmSystem'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { THE_TU_NODES } from '../../data/progression/TheTuNodes'
import { THE_TU_AN_NODES } from '../../data/progression/TheTuAnNodes'
import { ENEMIES } from '../../data/enemy/Enemies'
import { STAGES } from '../../data/stage/Stages'

function makeSession(seed: number) {
  const gameManager = new GameManager()
  const clock = new ManualClockSource()
  gameManager.turnBattleOps.setCombatClockSource(clock)
  gameManager.turnBattleOps.setBattleRngFactory(() => new SeededCombatRng(seed))
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(THE_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(THE_TU_AN_NODES)
  gameManager.catalogOps.registerEnemyTemplates(ENEMIES)
  gameManager.catalogOps.registerStages(STAGES)
  return { gameManager, clock }
}

function drive(gm: GameManager, clock: ManualClockSource, cap = 4000): string {
  let i = 0
  while (i++ < cap) {
    const b = gm.getTurnBattle()
    if (!b) return 'no-battle'
    if (b.state === 'victory') return 'victory'
    if (b.state === 'defeat') return 'defeat'
    clock.advance(COMBAT_STEP_SECONDS)
  }
  return 'cap'
}

function dumpBag(gm: GameManager) {
  const bag = gm.materialBag as unknown as Record<string, unknown>
  const items = bag['items'] ?? bag['entries'] ?? bag['stacks']
  if (items instanceof Map) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of items) out[k] = typeof v === 'object' ? (v as Record<string, unknown>)['amount'] ?? v : v
    return out
  }
  return items
}

function snap(p: PlayerData) {
  return {
    realm: `${p.realmId}:${p.realmLevel}`,
    hp: p.baseStats.maxHp,
    skillInsight: p.skillInsight,
    stones: 'n/a',
    cleared: [...p.completedStageIds],
    path: p.cultivationPath ?? null,
    way: p.cultivationWay ?? null,
    nodes: { ...p.nodeLevels },
    attrPts: p.attributePoints,
    spiritStones: (p as unknown as { spiritStone?: number }).spiritStone,
  }
}

describe('P6-M0 loop probe', () => {
  it('traces fresh mortal -> ritual -> qi_refining floor 1', () => {
    const { gameManager: gm, clock } = makeSession(11)
    const player = createDefaultPlayer()

    // --- bootstrap replication (onNewCharacter semantics) ---
    // P7-M3 - no mortal technique grant (tu_linh_quyet retired); the
    // Way grants its canonical art at initiation.
    gm.progressionOps.learnSkill('tram')
    gm.progressionOps.setSkillLoadoutSlot(player, 0, 'tram')
    gm.progressionOps.learnSkill('linh_bao')
    gm.progressionOps.learnSkill('huy_quyen')
    // onCharacterCreated semantics: pinned profile (hap_linh, vit3/str2)
    player.selectedTalentIds = ['hap_linh']
    player.baseStats.strength += 2
    player.baseStats.vitality += 3
    gm.setActivePlayer(player)

    const log: Record<string, unknown> = { boot: snap(player) }

    // --- step 1: mortal floor 1 ---
    const s1 = gm.catalogOps.getStage('mortal_dong_1')
    expect(s1).toBeDefined()
    log['unlock_dong_1'] = gm.catalogOps.isStageUnlocked('mortal_dong_1', player)

    // Loop trace: defeat -> cultivate -> breakthrough -> retry, until win.
    const dong1Attempts: unknown[] = []
    for (let attempt = 0; attempt < 8; attempt++) {
      const started = gm.turnBattleOps.startStage(player, s1!)
      if (!started) { dong1Attempts.push({ attempt, refused: true }); break }
      const outcome = drive(gm, clock)
      dong1Attempts.push({
        attempt, outcome, realm: `${player.realmId}:${player.realmLevel}`,
        insight: player.skillInsight,
      })
      if (outcome === 'victory') break
      // grind step: fill to req + breakthrough once
      const req = getRequiredCultivation(player.realmId, player.realmLevel)
      addCultivation(player, req)
      breakthrough(player)
    }
    log['dong_1_loop'] = dong1Attempts
    log['post_dong_1'] = snap(player)
    log['bag_dump'] = dumpBag(gm)

    // --- step 2: cultivate + minor breakthroughs toward floor gates ---
    const levels: string[] = []
    for (let i = 0; i < 14; i++) {
      const req = getRequiredCultivation(player.realmId, player.realmLevel)
      addCultivation(player, req)
      const ok = breakthrough(player)
      levels.push(`${player.realmId}:${player.realmLevel} bt=${ok}`)
      if (!ok) break
    }
    log['cultivation_path'] = levels

    // --- step 3: mortal floor 2 (realmLevel-gated) ---
    log['unlock_dong_2'] = gm.catalogOps.isStageUnlocked('mortal_dong_2', player)
    if (gm.catalogOps.isStageUnlocked('mortal_dong_2', player)) {
      gm.turnBattleOps.startStage(player, gm.catalogOps.getStage('mortal_dong_2')!)
      log['dong_2_outcome'] = drive(gm, clock)
    }

    // --- step 4: Quan Khi tribulation ---
    const tribOk = gm.startTribulation(player, 'qi_refining')
    log['tribulation_started'] = tribOk
    let guard = 0
    while (gm.tribulationDirector.getState()?.state === 'ongoing' && guard++ < 2000) {
      gm.tickOps.update(1)
      const q = gm.tribulationDirector.getState()!.currentQuestion
      if (q) gm.tribulationDirector.answerQuestion(q.correctAnswerIndex)
    }
    log['tribulation_state'] = gm.tribulationDirector.getState()?.state
    log['tribulation_committed'] = gm.tribulationDirector.getCommittedOutcome()

    // --- step 5: ritual ---
    log['offerable'] = gm.catalogOps ? undefined : undefined
    const ritualOk = gm.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)
    log['ritual'] = ritualOk
    log['post_ritual'] = snap(player)

    // --- step 6: qi_refining floor 1 ---
    log['unlock_qr1'] = gm.catalogOps.isStageUnlocked('qi_refining_forest', player)
    if (log['unlock_qr1']) {
      const ok = gm.turnBattleOps.startStage(player, gm.catalogOps.getStage('qi_refining_forest')!)
      log['qr1_started'] = ok
      log['qr1_outcome'] = ok ? drive(gm, clock) : 'refused'
      log['post_qr1'] = snap(player)
    }

    // --- step 7: insight -> node purchase (orb_dam_1: hien growth root, cost 1) ---
    const beforeInsight = player.skillInsight
    log['purchase_orb_dam_1'] = gm.progressionOps.purchaseNode('orb_dam_1', player)
    log['insight_delta'] = beforeInsight - player.skillInsight
    log['nodes_after'] = Object.keys(player.nodeLevels)

    console.log('PROBE\n' + JSON.stringify(log, null, 2))
    expect(true).toBe(true)
  })
})
