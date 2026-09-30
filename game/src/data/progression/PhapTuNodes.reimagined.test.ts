import { describe, expect, it } from 'vitest'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { SPELL_KIT_IDS, SKILLS } from '../skill/Skills'
import { TECHNIQUES } from '../technique/Techniques'
import { GameManager } from '../../core/game/GameManager'
import { createDefaultPlayer } from '../../core/player/Player'
import { aggregateNodeStatModifiers } from '../../core/progression/NodeSystem'
import type { ElementType } from '../../core/element/ElementType'
import { SKILL_CORE_NODES } from '@/data/progression/SkillCoreNodes'
import { CAST_LEVELING_THRESHOLDS } from '../../core/skill/CastLeveling'

// Phap Tu Reimagine (2026-09-26 spec sec.1.4) - tree shape test for the
// reworked branch: 5 mutex element roots committed atomically by
// selectSpellPathElement(element) (no route arg, no unlocksElement),
// per-element ailment mastery growth, and the linh_ngo_<special>
// foundation_establishment unlock granting [specialId] +
// linhLucHoTheCap. Retired content pinned absent: generic-stat growths,
// The lanes, routeTag nodes, god-ult unlock, the_thuc_tinh.

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
  it('moi element co: root, ailment mastery, linh_ngo_<special> @foundation_establishment', () => {
    for (const element of ELEMENTS) {
      const [, specialId] = SPELL_KIT_IDS[element]
      const rootId = ELEMENT_ROOT_IDS[element]

      const mastery = node(`${element}_ailment_mastery`)
      expect(mastery?.elementTag).toBe(element)
      expect(mastery?.role).toBe('growth')
      expect(mastery?.prerequisites).toContainEqual({ kind: 'node', nodeId: rootId })

      const specialNode = node(`linh_ngo_${specialId}`)
      expect(specialNode, `linh_ngo_${specialId}`).toBeDefined()
      expect(specialNode?.role).toBe('keystone')
      expect(specialNode?.elementTag).toBe(element)
      expect(specialNode?.effect.unlocksSkillIds).toEqual([specialId])
      expect(specialNode?.prerequisites).toContainEqual({ kind: 'node', nodeId: rootId })
      expect(specialNode?.prerequisites).toContainEqual({
        kind: 'realm',
        realmId: 'foundation_establishment',
      })

      // Linh Luc Ho The cap granted on the same node (spec sec.1.4).
      const hoThe = (specialNode?.effect.statModifiers ?? []).find(
        (modifier) => modifier.stat === 'linhLucHoTheCap',
      )
      expect(hoThe, `linh_ngo_${specialId} linhLucHoTheCap`).toBeDefined()
      expect(hoThe?.flat).toBeCloseTo(0.25)
      expect(hoThe?.domain).toBe('spell')
    }
  })

  it('khong node nao con routeTag', () => {
    for (const entry of PHAP_TU_NODES) {
      expect('routeTag' in entry, entry.id).toBe(false)
    }
  })

  it('khong con retired ids: The lanes, route lanes, generic-stat growths, god-ult, the_thuc_tinh', () => {
    const ids = new Set(PHAP_TU_NODES.map((entry) => entry.id))

    for (const element of ELEMENTS) {
      expect(ids.has(`tu_the_${element}`)).toBe(false)
      expect(ids.has(`truong_the_${element}`)).toBe(false)
      expect(ids.has(`minor_${element}_intensity`)).toBe(false)
      expect(ids.has(`${element}_damage_mastery`)).toBe(false)
      for (const suffix of ['dot_potency', 'dot_duration', 'dot_chance', 'no_crit', 'no_critdmg', 'no_damage']) {
        expect(ids.has(`${element}_${suffix}`)).toBe(false)
      }
    }
    expect(ids.has('the_thuc_tinh')).toBe(false)
    for (const entry of PHAP_TU_NODES) {
      expect(entry.id).not.toContain('lap_dao_thuan')
      expect(entry.id).not.toContain('reaction_path_unlock')
      expect(entry.id).not.toContain('the_man')
    }
  })

  it('khong node nao con banned generic-stat channels', () => {
    const BANNED = new Set([
      'skillDamagePercent',
      'criticalRate',
      'criticalDamage',
      'finalDamagePercent',
      'firePower',
      'waterPower',
      'woodPower',
      'metalPower',
      'earthPower',
      'might',
      'defense',
      'hp',
    ])

    for (const entry of PHAP_TU_NODES) {
      for (const modifier of entry.effect.statModifiers ?? []) {
        expect(BANNED.has(modifier.stat), `${entry.id} -> ${modifier.stat}`).toBe(false)
      }
    }
  })

  it('moi selectSpecialization node la 1 trong 10 basic-lane capstones', () => {
    const BASIC_CAPSTONES = new Set([
      'fire_basic_hoa_tu_diem',
      'fire_basic_hoa_tan_diem',
      'water_basic_thuy_ngan_lien',
      'water_basic_thuy_dao_lan',
      'wood_basic_moc_tu_doc',
      'wood_basic_moc_lan_doc',
      'metal_basic_kim_tu_phong',
      'metal_basic_kim_tan_phong',
      'earth_basic_tho_tu_nhan',
      'earth_basic_tho_bang_loa',
    ])

    for (const entry of PHAP_TU_NODES) {
      if (entry.effect.selectsSpecialization !== undefined) {
        expect(BASIC_CAPSTONES.has(entry.id), entry.id).toBe(true)
      }
    }
  })
})

describe('PhapTuNodes reimagined — element authority', () => {
  // BETA SCOPE LOCK v2 (phase-2): the element commits ONLY inside the
  // atomic commitFiveElementInitiation transaction - a mortal ritual
  // player carries no path until the op lands, so this fixture builds
  // the pre-ritual mortal and each test drives the real op.
  function mortalManager() {
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(SKILLS)
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    return { gameManager, player }
  }

  function commitInitiation(gameManager: GameManager, player: ReturnType<typeof createDefaultPlayer>, element: ElementType) {
    player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 }
    const result = gameManager.realmAdvanceOps.commitFiveElementInitiation(element, player)
    if (!result.ok) {
      throw new Error(`initiation failed: ${result.reason}`)
    }
    return player
  }

  it('purchaseNode() public reject ca 5 element root - chi qua initiation transaction', () => {
    const { gameManager, player } = mortalManager()
    commitInitiation(gameManager, player, 'fire')

    for (const element of ELEMENTS) {
      expect(
        gameManager.progressionOps.purchaseNode(ELEMENT_ROOT_IDS[element], player),
        ELEMENT_ROOT_IDS[element],
      ).toBe(false)
      // The committed element's root came from the transaction itself;
      // every other root stays unowned - no ordinary purchase path.
      expect(player.nodeLevels[ELEMENT_ROOT_IDS[element]]).toBe(
        element === 'fire' ? 1 : undefined,
      )
    }
  })

  it('commitFiveElementInitiation commit atomic: path + way + root lv1 + basic learned + element + realm', () => {
    const { gameManager, player } = mortalManager()
    commitInitiation(gameManager, player, 'water')

    expect(player.cultivationPath).toBe('spell')
    expect(player.cultivationWay).toBe('spell_pathway')
    expect(player.spellPath).toEqual({ element: 'water' })
    expect(player.nodeLevels['thuy_linh_ngo']).toBe(1)
    expect(gameManager.skillManager.has('thuy_tien_thuat')).toBe(true)
    expect(player.realmId).toBe('qi_refining')
  })

  it('element khong re-commit duoc: selectSpellPathElement chi song trong initiation transaction', () => {
    const { gameManager, player } = mortalManager()
    commitInitiation(gameManager, player, 'fire')

    // Post-initiation direct call fails closed - the op is mortal-only
    // and the element is already committed.
    expect(gameManager.progressionOps.selectSpellPathElement('water', player)).toBe(false)
    expect(player.spellPath).toEqual({ element: 'fire' })
    expect(player.nodeLevels['thuy_linh_ngo']).toBeUndefined()
  })

  it('commitFiveElementInitiation fails atomically when the root unlock skill template is missing', () => {
    // Atomicity: a missing kit template must fail the WHOLE initiation
    // in preflight - no path, no root, no element, no realm commit.
    const gameManager = new GameManager()
    gameManager.catalogOps.registerSkillTemplates(
      SKILLS.filter((skill) => skill.id !== 'hoa_cau_thuat'),
    )
    gameManager.catalogOps.registerTechniqueTemplates(TECHNIQUES)
    gameManager.catalogOps.registerProgressionNodes(PHAP_TU_NODES)
    gameManager.catalogOps.registerProgressionNodes(SKILL_CORE_NODES)
    const player = createDefaultPlayer()
    player.realmId = 'mortal'
    player.realmLevel = 12
    player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 }
    const before = JSON.stringify(player)

    expect(gameManager.realmAdvanceOps.commitFiveElementInitiation('fire', player)).toEqual({
      ok: false,
      reason: 'missing_kit_skill',
    })
    expect(JSON.stringify(player)).toBe(before)
  })

  it('chooseCultivationPath KHONG the commit spell_pathway - element way chi vao qua initiation', () => {
    const { gameManager, player } = mortalManager()
    player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 }

    expect(gameManager.realmAdvanceOps.chooseCultivationPath('spell', 'spell_pathway', player)).toBe(false)
    expect(player.cultivationPath).toBeUndefined()
    expect(player.spellPath).toEqual({ element: null })
  })

  it('elementTag gate: node element khac khong aggregate/purchase duoc', () => {
    const { gameManager, player } = mortalManager()
    commitInitiation(gameManager, player, 'fire')

    player.skillInsight = 100
    player.nodeLevels['water_ailment_mastery'] = 3

    const mods = aggregateNodeStatModifiers({ getAll: () => PHAP_TU_NODES }, player)
    const gained = mods
      .filter((m) => m.stat === 'ailmentPotencyPercent')
      .reduce((sum, m) => sum + (m.flat ?? 0), 0)
    expect(gained).toBe(0)

    expect(gameManager.progressionOps.purchaseNode('water_ailment_mastery', player)).toBe(false)
  })
})
