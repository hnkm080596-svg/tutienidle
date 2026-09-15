import { describe, expect, it } from 'vitest'
import { GameManager, INTRO_TOTAL_TICKS } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { getOfferableCultivationPaths } from '../player/CultivationPathSystem'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { KIEM_TU_NODES } from '../../data/progression/KiemTuNodes'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { CULTIVATION_PATH_STAT_DOMAINS } from '../stats/StatDomain'
import { ManualClockSource, COMBAT_STEP_SECONDS } from '../battle/turn/CombatClock'
import { defineEnemy } from '../enemy/Enemy'

// Phap Tu Reimagined (Task 7) — phap_tu_an is a first-class
// CultivationPathId offered ONLY inside the initiation ritual, gated by
// live linh_bao cast count (>= lv3 threshold). No Phap Tu element,
// route, or The pool. The persisted record is cultivationPath itself.

const LING_BAO_L3 = CAST_LEVELING_THRESHOLDS.linh_bao!.lv3

function makeManager() {
  const gameManager = new GameManager()
  gameManager.catalogOps.registerSkillTemplates(SKILLS)
  gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
  gameManager.catalogOps.registerProgressionNodes(PHAP_TU_AN_NODES)
  // kiem_tu ritual grants the kiem_tran_luong_nghi node on the kiem_tran
  // route — the round-4 transaction boundary requires it registered.
  gameManager.catalogOps.registerProgressionNodes(KIEM_TU_NODES)
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12
  return { gameManager, player }
}

describe('phap_tu_an — ritual offer gate', () => {
  it('getOfferableCultivationPaths hides phap_tu_an below linh_bao Lv3, shows it at Lv3', () => {
    const { player } = makeManager()

    player.skillCastCounts = { linh_bao: LING_BAO_L3 - 1 }
    expect(getOfferableCultivationPaths(player)).not.toContain('phap_tu_an')

    player.skillCastCounts.linh_bao = LING_BAO_L3
    expect(getOfferableCultivationPaths(player)).toContain('phap_tu_an')
  })

  it('offer includes the base paths regardless of linh_bao', () => {
    const { player } = makeManager()

    player.skillCastCounts = {}

    const offered = getOfferableCultivationPaths(player)
    expect(offered).toContain('phap_tu')
    expect(offered).toContain('kiem_tu')
  })

  it('chooseCultivationPath(phap_tu_an) rejects below Lv3 even though the ritual UI could offer it', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    player.skillCastCounts = { linh_bao: LING_BAO_L3 - 1 }

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('phap_tu_an', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
  })

  it('chooseCultivationPath(phap_tu_an) at Lv3: path set, technique equipped, an kit in slots 0/1, passive learned', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    player.skillCastCounts = { linh_bao: LING_BAO_L3 }

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('phap_tu_an', player)).toBe(true)
    expect(player.cultivationPath).toBe('phap_tu_an')

    // No element/route/The authority — an has none.
    expect(player.phapTu).toEqual({ element: null, route: null })

    // Two actives granted into loadout slots.
    const basic = gameManager.skillManager.get('van_phap_tuy_tam')
    const special = gameManager.skillManager.get('da_phap_lien_tuyen')
    expect(basic?.equipped).toBe(true)
    expect(special?.equipped).toBe(true)

    // Dao passive via the technique's innateSkillId — equipped without slot.
    expect(gameManager.skillManager.has('ngo_dao_hon_don')).toBe(true)
    expect(gameManager.skillManager.get('ngo_dao_hon_don')?.equipped).toBe(true)
  })

  it('post-ritual linh_bao casts never reopen the option (path already set)', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    player.skillCastCounts = { linh_bao: LING_BAO_L3 }
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('phap_tu', player)).toBe(true)

    player.skillCastCounts.linh_bao = LING_BAO_L3 * 2
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('phap_tu_an', player)).toBe(false)
    expect(player.cultivationPath).toBe('phap_tu')
  })

  it('a kiem_tu choice with linh_bao Lv3 is unaffected — offer is only evaluated inside the ritual', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)

    player.skillCastCounts = { linh_bao: LING_BAO_L3, tram: 0 }
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('kiem_tu', player)).toBe(true)
    expect(player.cultivationPath).toBe('kiem_tu')
    expect(player.kiemTu?.mode).toBe('hien')
  })

  it('chooseCultivationPath(phap_tu_an) fails atomically when a kit template is missing — nothing committed', () => {
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

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('phap_tu_an', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.realmId).toBe('mortal')
    expect(gameManager.skillManager.has('van_phap_tuy_tam')).toBe(false)
    expect(gameManager.skillManager.has('ngo_dao_hon_don')).toBe(false)
  })

  it('chooseCultivationPath(phap_tu_an) fails atomically when the innate passive template is missing', () => {
    // Same boundary, different seam: the dao passive arrives via
    // ngo_dao_chan_quyet.innateSkillId — its template must exist too.
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

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('phap_tu_an', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.realmId).toBe('mortal')
  })

  it('phap_tu_an activates the phap_tu stat domain for its kit modifiers', () => {
    // Kit statModifiers are domain:'phap_tu' — the path must claim that
    // domain or every gated stat (maxMp/manaShieldPercent/...) rejects.
    expect(CULTIVATION_PATH_STAT_DOMAINS['phap_tu_an']).toContain('phap_tu')
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
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('phap_tu_an', player)).toBe(true)
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
      'trung_doc',
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
    const hasAilments = battle.enemies[0]!.buffs.getAll().length > 0
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
    // canonical composite pool, repeatCasts, and the phap_tu-domain
    // reaction capability all stamped by production code.
    const participant = battle.players[0]!
    expect(participant.basic?.compositePicks?.pool).toHaveLength(5)
    expect(participant.special?.skill.repeatCasts).toBe(2)
    expect(participant.canInitiateWuxingReactions).toBe(true)
  })
})

describe('phap basic resolution — fail-fast on converter rejection (no static fallback)', () => {
  // Review round-2 (LOW): the PHAP_TU_BASICS static table was a second
  // authority that drifted from authored skills. A converter rejection is
  // an authored-data defect — it must surface loudly at battle build,
  // never silently substitute wrong gameplay.
  function phapTuPlayerReady() {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    player.cultivationPath = 'phap_tu'
    player.phapTu = { element: 'fire', route: 'dot' }
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

  it('phap_tu: a corrupted authored basic throws instead of falling back to the drifted static table', () => {
    const { gameManager, player } = phapTuPlayerReady()

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
    expect(gameManager.realmAdvanceOps.chooseCultivationPath('phap_tu_an', player)).toBe(true)

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('phap_tu: committed element but basic NOT learned → throws instead of generic melee', () => {
    // Review round-3 (MEDIUM): converter rejection throws, but a MISSING
    // required basic silently degraded to GENERIC_PHYSICAL_BASIC —
    // stripping the path's kit. A committed element implies the basic
    // was granted (selectPhapTuElement); absent = corrupt state.
    const { gameManager, player } = phapTuPlayerReady()

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('phap_tu_an: missing van_phap_tuy_tam → throws instead of generic melee', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    // Path state without the ritual grant — required kit skill absent.
    player.cultivationPath = 'phap_tu_an'

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('phap_tu_an: missing da_phap_lien_tuyen → throws instead of silently dropping the special', () => {
    // Review round-4 (MEDIUM): the An kit is a fixed three-skill set —
    // a corrupt save missing the special entered combat with no button.
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    player.cultivationPath = 'phap_tu_an'
    expect(gameManager.progressionOps.learnSkill('van_phap_tuy_tam')).toBe(true)
    expect(gameManager.progressionOps.learnSkill('ngo_dao_hon_don')).toBe(true)

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('phap_tu_an: missing ngo_dao_hon_don → throws instead of silently dropping the dao multicast', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    player.cultivationPath = 'phap_tu_an'
    expect(gameManager.progressionOps.learnSkill('van_phap_tuy_tam')).toBe(true)
    expect(gameManager.progressionOps.learnSkill('da_phap_lien_tuyen')).toBe(true)

    expect(() => gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))).toThrow()
  })

  it('kiem_tu: missing tram still resolves its authored static basic (legitimate fallback)', () => {
    const { gameManager, player } = makeManager()
    gameManager.setActivePlayer(player)
    player.cultivationPath = 'kiem_tu'

    gameManager.startBattleWithPlayer(player, spawnDummy(gameManager))

    expect(gameManager.getTurnBattle()!.players[0]!.basic?.id).toBe('tram')
  })
})
