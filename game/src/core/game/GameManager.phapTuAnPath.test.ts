import { describe, expect, it } from 'vitest'
import { GameManager } from './GameManager'
import { createDefaultPlayer } from '../player/Player'
import { getOfferableCultivationPaths } from '../player/CultivationPathSystem'
import { SKILLS } from '../../data/skill/Skills'
import { TECHNIQUES } from '../../data/technique/Techniques'
import { PHAP_TU_NODES } from '../../data/progression/PhapTuNodes'
import { PHAP_TU_AN_NODES } from '../../data/progression/PhapTuAnNodes'
import { CAST_LEVELING_THRESHOLDS } from '../skill/SkillSystem'
import { CULTIVATION_PATH_STAT_DOMAINS } from '../stats/StatDomain'

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
    expect(player.kiemTuRoute).toBe('kiem_tran')
  })

  it('phap_tu_an activates the phap_tu stat domain for its kit modifiers', () => {
    // Kit statModifiers are domain:'phap_tu' — the path must claim that
    // domain or every gated stat (maxMp/manaShieldPercent/...) rejects.
    expect(CULTIVATION_PATH_STAT_DOMAINS['phap_tu_an']).toContain('phap_tu')
  })
})
