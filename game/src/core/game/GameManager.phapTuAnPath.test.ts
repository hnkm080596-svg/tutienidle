import { describe, expect, it } from 'vitest'
import { GameManager, INTRO_TOTAL_TICKS } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import {
  listOfferableWays,
  resolveActiveWayStatDomains,
} from '../player/CultivationPathSystem'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { freshSwordPathState } from '../kiem-tu/KiemTuState'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { defineEnemy } from '../enemy/Enemy'

// Phap Tu Reimagined (Task 7) + Cultivation Path Framework M7 — the
// hidden Phap Tu variant is the 'hidden_spell_pathway' WAY under path 'spell',
// offered ONLY inside the initiation ritual, gated by live linh_bao
// cast count (>= lv3 threshold). No element, route, or The pool. The
// persisted record is the (cultivationPath, cultivationWay) pair.

const ngoDaoOffer = (player: Parameters<typeof listOfferableWays>[0]) =>
  listOfferableWays(player).find(
    (offer) => offer.pathId === 'spell' && offer.wayId === 'hidden_spell_pathway',
  )

const LING_BAO_L3 = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

function makeManager() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
  // sword ritual grants the kiem_tran_luong_nghi node on the kiem_tran
  // route — the round-4 transaction boundary requires it registered.
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  return { gameManager, player }
}

describe('ngo_dao way — ritual offer gate', () => {
  it('listOfferableWays marks ngo_dao ineligible below linh_bao Lv3, eligible at Lv3', () => {
    const { player } = makeManager()

    player.skillCastCounts = { linh_bao: LING_BAO_L3 - 1 }
    expect(ngoDaoOffer(player)?.eligible).toBe(false)

    player.skillCastCounts.linh_bao = LING_BAO_L3
    expect(ngoDaoOffer(player)?.eligible).toBe(true)
  })

  it('the ungated ways stay eligible regardless of linh_bao', () => {
    const { player } = makeManager()

    player.skillCastCounts = {}

    const offered = listOfferableWays(player).filter((offer) => offer.eligible)
    expect(offered.some((o) => o.pathId === 'spell' && o.wayId === 'spell_pathway')).toBe(true)
    expect(offered.some((o) => o.pathId === 'sword' && o.wayId === 'sword_pathway')).toBe(true)
  })

  it('chooseCultivationPath(spell, ngo_dao) rejects below Lv3 even though the ritual UI could offer it', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    player.skillCastCounts = { linh_bao: LING_BAO_L3 - 1 }

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
  })

  it('chooseCultivationPath(spell, ngo_dao) at Lv3: base path id + way set, technique equipped, an kit in slots 0/1, passive learned', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    player.skillCastCounts = { linh_bao: LING_BAO_L3 }

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player)).toBe(true)
    expect(player.cultivationPath).toBe('spell')
    expect(player.cultivationWay).toBe('hidden_spell_pathway')

    // No element/route/The authority — an has none.
    expect(player.spellPath).toEqual({ element: null, route: null })

    // Two actives granted into loadout slots.
    const basic = gameManager.skillManager.get('van_phap_tuy_tam')
    const special = gameManager.skillManager.get('da_phap_lien_tuyen')
    expect(basic?.equipped).toBe(true)
    expect(special?.equipped).toBe(true)

    // Dao passive via the way's passiveSkillIds (P7-M2 - was the
    // technique's innateSkillId) - equipped without slot.
    expect(gameManager.skillManager.has('ngo_dao_hon_don')).toBe(true)
    expect(gameManager.skillManager.get('ngo_dao_hon_don')?.equipped).toBe(true)
  })

  it('chooseCultivationPath rejects a way that belongs to another path — zero mutation', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    // 'sword_pathway' is a real way of sword, never of spell.
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'sword_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.realmId).toBe('mortal')
    expect(gameManager.techniqueManager.getEquipped()).toBeUndefined()
  })

  it('post-ritual linh_bao casts never reopen the option (path already set)', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    player.skillCastCounts = { linh_bao: LING_BAO_L3 }
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player)).toBe(true)
    expect(player.cultivationWay).toBe('spell_pathway')

    player.skillCastCounts.linh_bao = LING_BAO_L3 * 2
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBe('spell')
    expect(player.cultivationWay).toBe('spell_pathway')
  })

  it('a sword choice with linh_bao Lv3 is unaffected — offer is only evaluated inside the ritual', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    player.skillCastCounts = { linh_bao: LING_BAO_L3, tram: 0 }
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('sword', 'sword_pathway', player)).toBe(true)
    expect(player.cultivationPath).toBe('sword')
    expect(player.cultivationWay).toBe('sword_pathway')
    // M6 — way membership is the discriminator (swordPath.mode retired);
    // the ritual still creates the canonical way-agnostic slice.
    expect(player.swordPath).toEqual(freshSwordPathState())
  })

  it('chooseCultivationPath(spell, ngo_dao) fails atomically when a kit template is missing — nothing committed', () => {
    // Review round-4 (atomicity): cultivationPath was written BEFORE the
    // grants were verified — a missing template left the path committed
    // with a partial kit. The whole choice must fail instead.
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(
      SKILLS.filter((skill) => skill.id !== 'da_phap_lien_tuyen'),
    )
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    gameManager.setActivePlayer(player)
    player.skillCastCounts = { linh_bao: LING_BAO_L3 }

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.realmId).toBe('mortal')
    expect(gameManager.skillManager.has('van_phap_tuy_tam')).toBe(false)
    expect(gameManager.skillManager.has('ngo_dao_hon_don')).toBe(false)
  })

  it('chooseCultivationPath(spell, ngo_dao) fails atomically when the passive template is missing', () => {
    // Same boundary, different seam: the dao passive arrives via
    // hidden_spell_pathway.passiveSkillIds - its template must exist too.
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(
      SKILLS.filter((skill) => skill.id !== 'ngo_dao_hon_don'),
    )
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    gameManager.setActivePlayer(player)
    player.skillCastCounts = { linh_bao: LING_BAO_L3 }

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.cultivationWay).toBeUndefined()
    expect(player.realmId).toBe('mortal')
  })

  it('ngo_dao way owns the spell stat domain for its kit modifiers', () => {
    // Kit statModifiers are domain:'spell' — the way must claim that
    // domain or every gated stat (maxMp/manaShieldPercent/...) rejects.
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    player.skillCastCounts = { linh_bao: LING_BAO_L3 }
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player)).toBe(true)

    expect(resolveActiveWayStatDomains(player)).toEqual(['spell'])
  })
})

// P14 review fix (HIGH-1 + integration gap) — the An composite pool must
// be the CANONICAL Skill -> TurnSkillDefinition conversion of the five
// authored basics, not a hand-duplicated static table. The static pool
// had already drifted: authored doc_chuong is ailment-only (0 direct
// damage) while the duplicate gave wood an elemental hit, and none of
// the five carried authored manaScalingRatio/attributeScaling. These
// tests drive the REAL production path — ritual -> startBattleWithPlayer
// -> resolved participant — the same chain the browser pass crashed on.
describe('phap_tu_an — battle build resolves the canonical element pool', () => {
  function anPlayerReady() {
    const { gameManager, player } = makeManager()
    const combatSource = new ManualClockSource()
    gameManager.setCombatClockSource(combatSource)
    gameManager.setActivePlayer(player)
    player.skillCastCounts = { linh_bao: LING_BAO_L3 }
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player)).toBe(true)
    return { gameManager, player, combatSource }
  }

  function spawnDummy(gameManager: GameManager) {
    const enemy = defineEnemy({
      id: 'an_dummy',
      name: 'An Dummy',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1_000_000,
        might: 0,
        attackSpeed: 1,
        criticalRate: 0,
        criticalDamage: 1.5,
        armor: 0,
        evasionRate: 0, // deterministic hits — see actionPlayback harness note
      },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
    return enemy
  }

  it('basic composite pool = authored basics through the canonical converter (wood deals NO direct damage)', () => {
    const { gameManager, player } = anPlayerReady()

    gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))

    const pool = gameManager.getTurnBattle()!.players[0]!.basic!.compositePicks!.pool

    // Five authored basics, converted — ids are the authored skill ids.
    expect(pool.map((entry) => entry.id).sort()).toEqual(
      ['diem_kim_thuat', 'doc_chuong', 'hoa_cau_thuat', 'tho_cau_thuat', 'thuy_tien_thuat'].sort(),
    )

    // The drift bug: authored doc_chuong is 0 direct damage + guaranteed
    // Trung Doc. The converted pool entry must carry no damage payload.
    const wood = pool.find((entry) => entry.id === 'doc_chuong')!
    expect(wood.damage).toBeUndefined()
    expect(wood.appliesAilment?.buffDefinitionId ?? wood.appliesAilments?.[0]?.buffDefinitionId).toBe(
      'doc_can',
    )

    // Authored scaling survives conversion — hoa_cau_thuat carries
    // manaScalingRatio + attunement attributeScaling.
    const fire = pool.find((entry) => entry.id === 'hoa_cau_thuat')!
    expect(fire.damage?.scaling?.manaScalingRatio).toBe(0.001)
    expect(fire.damage?.scaling?.attributeScaling).toEqual([
      { attributes: ['attunement'], ratioPerPoint: 0.004 },
    ])
  })

  it('special composite pool uses the same canonical basics (repeatCasts preserved)', () => {
    const { gameManager, player } = anPlayerReady()

    gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))

    const special = gameManager.getTurnBattle()!.players[0]!.special!.skill
    expect(special.id).toBe('da_phap_lien_tuyen')
    expect(special.repeatCasts).toBe(2)
    expect(special.compositePicks!.pool.map((entry) => entry.id)).toContain('doc_chuong')
  })

  it('a real An battle progresses past startup and lands the picked payloads', () => {
    const { gameManager, player, combatSource } = anPlayerReady()

    gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))

    // intro + countdown to fighting, then let turns resolve.
    for (let i = 0; i < INTRO_TOTAL_TICKS + 30 + 300; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const battle = gameManager.getTurnBattle()!
    expect(battle.state === 'fighting' || battle.state === 'victory').toBe(true)
    expect(battle.totalTurnsElapsed ?? 0).toBeGreaterThan(0)

    // Every pick produces a visible effect: fire/water/metal/earth carry
    // authored damage, wood always applies trung_doc (chance 1).
    const enemy = battle.enemies[0]!.entity
    const tookDamage = enemy.currentHp < enemy.maxHp
    const hasAilments = gameManager.getBattleBuffs(battle.enemies[0]!.entity.id).length > 0
    expect(tookDamage || hasAilments).toBe(true)
  })

  it('full production path: ritual -> startStage -> wave spawn -> resolved actions (review QA gap)', () => {
    // The browser pass crashed exactly here: unit tests built battles
    // directly, so the chooseCultivationPath -> stage -> spawn ->
    // composite-resolution chain was never exercised headlessly.
    const { gameManager, player, combatSource } = anPlayerReady()

    gameManager.catalogOps.registerEnemyTemplates([spawnDummy(gameManager)])
    gameManager.catalogOps.registerStages([
      {
        id: 'an_stage',
        name: 'An Stage',
        description: '',
        floor: 1,
        enemyPool: [{ enemyId: 'an_dummy', weight: 1 }],
        totalEnemyCount: 1,
        waves: [1],
        spawnIntervalSeconds: 0,
      },
    ])

    const stage = gameManager.catalogOps.getStage('an_stage')!
    expect(gameManager.turnBattleOps.startStage(player, stage, false)).toBe(true)

    // intro + countdown + spawn telegraph + several resolved turns.
    for (let i = 0; i < INTRO_TOTAL_TICKS + 300 + 600; i++) {
      combatSource.advance(COMBAT_STEP_SECONDS)
    }

    const battle = gameManager.getTurnBattle()!
    expect(battle.state === 'fighting' || battle.state === 'victory').toBe(true)
    expect(battle.totalTurnsElapsed ?? 0).toBeGreaterThan(0)

    // The participant was built through the REAL adapter chain —
    // canonical composite pool and repeatCasts stamped by production code.
    const participant = battle.players[0]!
    expect(participant.basic?.compositePicks?.pool).toHaveLength(5)
    expect(participant.special?.skill.repeatCasts).toBe(2)
  })
})

describe('phap basic resolution — fail-fast on converter rejection (no static fallback)', () => {
  // Review round-2 (LOW): the SPELL_BASICS static table was a second
  // authority that drifted from authored skills. A converter rejection is
  // an authored-data defect — it must surface loudly at battle build,
  // never silently substitute wrong gameplay.
  function spellPathPlayerReady() {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    player.spellPath = { element: 'fire', route: 'dot' }
    return { gameManager, player }
  }

  function spawnDummy(gameManager: GameManager) {
    return defineEnemy({
      id: 'fallback_probe',
      name: 'Fallback Probe',
      level: 1,
      realmId: 'mortal',
      lane: 'ground',
      statsInput: {
        maxHp: 1_000_000, might: 0, attackSpeed: 1,
        criticalRate: 0, criticalDamage: 1.5, armor: 0, evasionRate: 0,
      },
      rewards: { techniqueInsight: 0, spiritStone: 0 },
    })
  }

  it('spell: a corrupted authored basic throws instead of falling back to the drifted static table', () => {
    const { gameManager, player } = spellPathPlayerReady()

    const authored = SKILLS.find((skill) => skill.id === 'hoa_cau_thuat')!
    gameManager.catalogOps.registerSkillTemplates([{ ...authored, effects: [] }])
    expect(gameManager.progressionOps.learnSkill('hoa_cau_thuat')).toBe(true)

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('phap_tu_an: a corrupted kit skill throws instead of degrading to generic melee', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    player.skillCastCounts = { linh_bao: LING_BAO_L3 }

    // The kit is granted from the template registry at the ritual — the
    // corrupted template must be in place BEFORE the grant.
    const authored = SKILLS.find((skill) => skill.id === 'van_phap_tuy_tam')!
    gameManager.catalogOps.registerSkillTemplates([{ ...authored, effects: [] }])
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'hidden_spell_pathway', player)).toBe(true)

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('spell: committed element but basic NOT learned → throws instead of generic melee', () => {
    // Review round-3 (MEDIUM): converter rejection throws, but a MISSING
    // required basic silently degraded to GENERIC_PHYSICAL_BASIC —
    // stripping the path's kit. A committed element implies the basic
    // was granted (selectSpellPathElement); absent = corrupt state.
    const { gameManager, player } = spellPathPlayerReady()

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('phap_tu_an: missing van_phap_tuy_tam → throws instead of generic melee', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    // Path state without the ritual grant — required kit skill absent.
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('phap_tu_an: missing da_phap_lien_tuyen → throws instead of silently dropping the special', () => {
    // Review round-4 (MEDIUM): the An kit is a fixed three-skill set —
    // a corrupt save missing the special entered combat with no button.
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'
    expect(gameManager.progressionOps.learnSkill('van_phap_tuy_tam')).toBe(true)
    expect(gameManager.progressionOps.learnSkill('ngo_dao_hon_don')).toBe(true)

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('phap_tu_an: missing ngo_dao_hon_don → throws instead of silently dropping the dao multicast', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    player.cultivationPath = 'spell'
    player.cultivationWay = 'hidden_spell_pathway'
    expect(gameManager.progressionOps.learnSkill('van_phap_tuy_tam')).toBe(true)
    expect(gameManager.progressionOps.learnSkill('da_phap_lien_tuyen')).toBe(true)

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('sword: missing tram still resolves its authored static basic (legitimate fallback)', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    player.cultivationPath = 'sword'

    gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))

    expect(gameManager.getTurnBattle()!.players[0]!.basic?.id).toBe('tram')
  })
})
