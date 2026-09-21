import { describe, expect, it } from 'vitest'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { SPELL_KIT_IDS, SKILLS } from '../skill/Skills'
import { TECHNIQUES } from '../technique/Techniques'
import { PHAP_TU_ULTIMATE_IDS } from '../skill/PhapTuUltimates'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { aggregateNodeStatModifiers } from '../../core/progression/NodeSystem'
import type { ElementType } from '../../core/element/ElementType'

// Phap Tu Reimagined (2026-09-15 plan, Task 6) — the new tree replaces
// the old unlocksElement/keystoneReaction/reaction_path architecture:
// 5 mutex element roots committed atomically by selectSpellPathElement,
// growth + unlock + The lanes + route-tagged specialization nodes.

const ELEMENT_ROOT_IDS: Record<ElementType, string> = {
  fire: 'hoa_linh_ngo',
  water: 'thuy_linh_ngo',
  wood: 'moc_linh_ngo',
  metal: 'kim_linh_ngo',
  earth: 'tho_linh_ngo',
}

const ELEMENTS = Object.keys(ELEMENT_ROOT_IDS) as ElementType[]

function node(id: string) {
  return PHAP_TU_NODES.find((entry) => entry.id === id)
}

function elementNodes(element: ElementType) {
  return PHAP_TU_NODES.filter((entry) => entry.elementTag === element)
}

describe('PhapTuNodes reimagined — element roots', () => {
  it('co dung 5 element root, moi root mutex 4 root con lai', () => {
    for (const element of ELEMENTS) {
      const root = node(ELEMENT_ROOT_IDS[element])

      expect(root, ELEMENT_ROOT_IDS[element]).toBeDefined()
      expect(root?.role).toBe('root')
      expect(root?.elementTag).toBe(element)

      const excludes = (root?.prerequisites ?? [])
        .filter((p) => p.kind === 'excludesNode')
        .map((p) => (p.kind === 'excludesNode' ? p.nodeId : ''))

      for (const other of ELEMENTS) {
        if (other !== element) {
          expect(excludes).toContain(ELEMENT_ROOT_IDS[other])
        }
      }
    }
  })

  it('moi root unlock dung basic cua kit, khong root nao unlocksElement', () => {
    for (const element of ELEMENTS) {
      const root = node(ELEMENT_ROOT_IDS[element])

      expect(root?.effect.unlocksSkillIds).toEqual([SPELL_KIT_IDS[element][0]])
      expect('unlocksElement' in (root?.effect ?? {})).toBe(false)
    }
  })

  it('khong node nao trong cay con unlocksElement', () => {
    for (const entry of PHAP_TU_NODES) {
      expect('unlocksElement' in entry.effect, entry.id).toBe(false)
    }
  })
})

describe('PhapTuNodes reimagined — per-element branch', () => {
  it('moi element co: power growth, ailment growth, damage growth, special unlock, phap tuong unlock, tu the, truong the', () => {
    for (const element of ELEMENTS) {
      const [basic, special] = SPELL_KIT_IDS[element]
      const godUlt = PHAP_TU_ULTIMATE_IDS[element]
      const rootId = ELEMENT_ROOT_IDS[element]

      const specialNode = node(`linh_ngo_${special}`)
      const ultNode = node(`linh_ngo_${godUlt}`)
      const tuThe = node(`tu_the_${element}`)
      const truongThe = node(`truong_the_${element}`)

      expect(node(`minor_${element}_intensity`)?.elementTag).toBe(element)
      expect(node(`${element}_ailment_mastery`)?.elementTag).toBe(element)
      expect(node(`${element}_damage_mastery`)?.elementTag).toBe(element)

      // The realm-gated special unlock grants the kit's remaining slots
      // together (special + chain-E ult) — spec §3.3 needs the ult's
      // base form castable WITHOUT the phap-tuong node.
      expect(specialNode?.effect.unlocksSkillIds).toEqual([special, SPELL_KIT_IDS[element][2]])
      expect(specialNode?.prerequisites).toContainEqual({ kind: 'node', nodeId: rootId })

      expect(ultNode?.effect.unlocksSkillIds).toEqual([godUlt])
      expect(ultNode?.prerequisites).toContainEqual({ kind: 'node', nodeId: `linh_ngo_${special}` })

      expect(tuThe?.elementTag).toBe(element)
      const gainSkills = (tuThe?.effect.turnSkillResourceModifiers ?? []).map((m) => m.skillId)
      expect(gainSkills).toContain(basic)
      expect(gainSkills).toContain(special)

      expect(truongThe?.elementTag).toBe(element)
      expect(truongThe?.routeTag).toBe('no')
      expect(truongThe?.effect.theCapPerLevel).toBeGreaterThan(0)
    }
  })

  it('moi element co dung 3 node routeTag dot va 4 node routeTag no (3 spec + truong_the)', () => {
    for (const element of ELEMENTS) {
      const branch = elementNodes(element)
      const dot = branch.filter((entry) => entry.routeTag === 'dot')
      const no = branch.filter((entry) => entry.routeTag === 'no')

      expect(dot.map((entry) => entry.id).sort(), element).toEqual([
        `${element}_dot_chance`,
        `${element}_dot_duration`,
        `${element}_dot_potency`,
      ])

      expect(no.map((entry) => entry.id).sort(), element).toEqual(
        [
          `${element}_no_crit`,
          `${element}_no_critdmg`,
          `${element}_no_damage`,
          `truong_the_${element}`,
        ].sort(),
      )
    }
  })

  it('INV-19: node khong routeTag khong duoc prerequisite vao node routeTag', () => {
    const routeTagged = new Set(
      PHAP_TU_NODES.filter((entry) => entry.routeTag !== undefined).map((entry) => entry.id),
    )

    for (const entry of PHAP_TU_NODES) {
      if (entry.routeTag !== undefined) {
        continue
      }

      for (const prereq of entry.prerequisites ?? []) {
        if (prereq.kind === 'node') {
          expect(routeTagged.has(prereq.nodeId), `${entry.id} -> ${prereq.nodeId}`).toBe(false)
        }
        if (prereq.kind === 'nodeCount') {
          for (const id of prereq.nodeIds) {
            expect(routeTagged.has(id), `${entry.id} -> ${id}`).toBe(false)
          }
        }
      }
    }
  })

  it('khong con legacy ids: lap_dao_thuan, reaction_path_unlock, the_man, selectsSpecialization', () => {
    for (const entry of PHAP_TU_NODES) {
      expect(entry.id).not.toContain('lap_dao_thuan')
      expect(entry.id).not.toContain('reaction_path_unlock')
      expect(entry.id).not.toContain('the_man')
      expect(entry.effect.selectsSpecialization, entry.id).toBeUndefined()
    }
  })
})

describe('PhapTuNodes reimagined — element authority', () => {
  function phapTuManager() {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    return { gameManager, player }
  }

  it('purchaseNode() public reject ca 5 element root', () => {
    const { gameManager, player } = phapTuManager()

    for (const element of ELEMENTS) {
      expect(
        gameManager.progressionOps.purchaseNode(ELEMENT_ROOT_IDS[element], player),
        ELEMENT_ROOT_IDS[element],
      ).toBe(false)
      expect(player.nodeLevels[ELEMENT_ROOT_IDS[element]]).toBeUndefined()
    }
  })

  it('selectSpellPathElement commit atomic: root lv1 + basic learned + spellPath {element, route}', () => {
    const { gameManager, player } = phapTuManager()

    expect(gameManager.progressionOps.selectSpellPathElement('water', 'no', player)).toBe(true)

    expect(player.spellPath).toEqual({ element: 'water', route: 'no' })
    expect(player.nodeLevels['thuy_linh_ngo']).toBe(1)
    expect(gameManager.skillManager.has('thuy_tien_thuat')).toBe(true)
  })

  it('selectSpellPathElement reject khi khong phai spell, khi da chon, khi route sai', () => {
    const { gameManager, player } = phapTuManager()

    player.cultivationPath = 'sword'
    expect(gameManager.progressionOps.selectSpellPathElement('fire', 'dot', player)).toBe(false)
    expect(player.spellPath).toEqual({ element: null, route: null })

    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'
    expect(
      gameManager.progressionOps.selectSpellPathElement('fire', 'invalid' as 'dot', player),
    ).toBe(false)
    expect(player.spellPath).toEqual({ element: null, route: null })

    expect(gameManager.progressionOps.selectSpellPathElement('fire', 'dot', player)).toBe(true)
    expect(gameManager.progressionOps.selectSpellPathElement('water', 'no', player)).toBe(false)
    expect(player.spellPath).toEqual({ element: 'fire', route: 'dot' })
    expect(player.nodeLevels['thuy_linh_ngo']).toBeUndefined()
  })

  it('selectSpellPathElement fails atomically when the root unlock skill template is missing', () => {
    // Review round-4 (atomicity): the root was purchased and {element,
    // route} committed even when learnSkill() could not succeed —
    // leaving an element committed without its basic. Verify the whole
    // selection fails BEFORE any mutation.
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(
      SKILLS.filter((skill) => skill.id !== 'hoa_cau_thuat'),
    )
    gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
    const player = createDefaultPlayer()
    player.cultivationPath = 'spell'
    player.cultivationWay = 'spell_pathway'

    expect(gameManager.progressionOps.selectSpellPathElement('fire', 'dot', player)).toBe(false)
    expect(player.spellPath).toEqual({ element: null, route: null })
    expect(player.nodeLevels['hoa_linh_ngo']).toBeUndefined()
  })

  it('chooseCultivationPath(spell) KHONG auto-chon Fire: spellPath null/null, hoa_cau_thuat chua learn', () => {
    const { gameManager, player } = phapTuManager()
    player.cultivationPath = undefined
    player.cultivationWay = undefined
    player.realmId = 'mortal'
    player.realmLevel = 12

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player)).toBe(true)
    expect(player.cultivationPath).toBe('spell')
    expect(player.spellPath).toEqual({ element: null, route: null })
    expect(player.nodeLevels['hoa_linh_ngo']).toBeUndefined()
    expect(gameManager.skillManager.has('hoa_cau_thuat')).toBe(false)
  })

  it('elementTag gate: node element khac khong aggregate/purchase duoc', () => {
    const { gameManager, player } = phapTuManager()

    gameManager.progressionOps.selectSpellPathElement('fire', 'dot', player)

    player.skillInsight = 100
    player.nodeLevels['thuy_dot_chance'] = 3

    const mods = aggregateNodeStatModifiers({ getAll: () => PHAP_TU_NODES }, player)
    const gained = mods
      .filter((m) => m.stat === 'elementApplicationPercent')
      .reduce((sum, m) => sum + (m.flat ?? 0), 0)
    expect(gained).toBe(0)

    expect(gameManager.progressionOps.purchaseNode('thuy_dot_chance', player)).toBe(false)
  })
})
