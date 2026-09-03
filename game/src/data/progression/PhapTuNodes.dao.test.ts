import { describe, expect, it } from 'vitest'
import { PHAP_TU_NODES } from './PhapTuNodes'
import { CHAIN_SKILL_IDS } from '../skill/Skills'
import { ELEMENT_ORDER } from '../../core/element/ElementLabels'
import { getRealmIndex } from '../../core/realm/realmSystem'
import type { NodePrerequisite, ProgressionNode } from '../../core/progression/ProgressionNode'

// Spec 2026-09-03 phap-tu-thuan-he §5 (Task 11) — nhánh Thuần: mỗi hành
// 11 node cũ (giữ nguyên — N4 KHÔNG xoá keystone) + 13 node mới:
// lap_dao_thuan (1) + unlock B/C/D/E (4) + biến thể C1/C2/D1/D2 (4) +
// ult (1) + Tụ Thế/Trường Thế/Thế Mãn (3). Cộng gate chung
// phap_tu_lap_dao (1) và placeholder excludes phap_tu_lap_dao_da_phap (1).
// Tổng cây = 5×11 cũ + 5×13 mới + 2 chung = 121 node.

const ELEMENTS = [...ELEMENT_ORDER]

const SKILL_A: Record<string, string> = {
  fire: 'hoa_cau_thuat',
  water: 'thuy_tien_thuat',
  wood: 'doc_chuong',
  metal: 'diem_kim_thuat',
  earth: 'tho_cau_thuat',
}

// Tên skill B–E theo hành (thứ tự chuỗi, bỏ A) — dùng dựng id node.
function chainSkillIds(el: string): string[] {
  return [...CHAIN_SKILL_IDS[el as (typeof ELEMENT_ORDER)[number]]].slice(1)
}

function nodeById(id: string): ProgressionNode | undefined {
  return PHAP_TU_NODES.find((n) => n.id === id)
}

function realmPrereq(node: ProgressionNode): string | undefined {
  const realm = (node.prerequisites ?? []).find((p) => p.kind === 'realm')

  return realm?.kind === 'realm' ? realm.realmId : undefined
}

function excludes(node: ProgressionNode): string[] {
  return (node.prerequisites ?? [])
    .filter((p): p is Extract<NodePrerequisite, { kind: 'excludesNode' }> => p.kind === 'excludesNode')
    .map((p) => p.nodeId)
}

function nodePrereqs(node: ProgressionNode): string[] {
  return (node.prerequisites ?? [])
    .filter((p): p is Extract<NodePrerequisite, { kind: 'node' }> => p.kind === 'node')
    .map((p) => p.nodeId)
}

describe('PhapTuNodes — gate Lập Đạo chung + placeholder Đa Pháp', () => {
  it('phap_tu_lap_dao: major, gate Trúc Cơ, cost 0, branchTag lap_dao', () => {
    const node = nodeById('phap_tu_lap_dao')

    expect(node).toBeDefined()
    expect(node!.type).toBe('major')
    expect(node!.insightCost).toBe(0)
    expect(node!.branchTag).toBe('lap_dao')
    expect(realmPrereq(node!)).toBe('foundation_establishment')
  })

  it('phap_tu_lap_dao_da_phap tồn tại CHỈ làm đích excludesNode (placeholder Đa Pháp)', () => {
    const node = nodeById('phap_tu_lap_dao_da_phap')

    expect(node).toBeDefined()
    expect(node!.insightCost).toBe(0)
  })
})

describe('PhapTuNodes — nhánh Thuần per-hành (spec §5)', () => {
  for (const el of ELEMENTS) {
    describe(`hành ${el}`, () => {
      const [bId, cId, dId, eId] = chainSkillIds(el)
      const lapDaoId = `lap_dao_thuan_${el}`
      const unlockB = `linh_ngo_${bId}`
      const unlockC = `linh_ngo_${cId}`
      const unlockD = `linh_ngo_${dId}`
      const unlockE = `linh_ngo_${eId}`

      it('đủ 13 node MỚI branchTag thuan_<el> (cộng 4 node cũ = 17/hành theo spec §5.1)', () => {
        const nodes = PHAP_TU_NODES.filter((n) => n.branchTag === `thuan_${el}`)

        expect(nodes).toHaveLength(13)
      })

      it('lap_dao_thuan: major cost 2, prereq gate chung, excludes 4 Thuần khác + da_phap', () => {
        const node = nodeById(lapDaoId)

        expect(node).toBeDefined()
        expect(node!.type).toBe('major')
        expect(node!.insightCost).toBe(2)
        expect(nodePrereqs(node!)).toContain('phap_tu_lap_dao')

        const otherThuan = ELEMENTS.filter((other) => other !== el).map((other) => `lap_dao_thuan_${other}`)

        for (const other of otherThuan) {
          expect(excludes(node!), `${lapDaoId} phải excludes ${other}`).toContain(other)
        }

        expect(excludes(node!)).toContain('phap_tu_lap_dao_da_phap')
      })

      it('4 node unlock B/C/D/E: major keystone cost 2, unlocksSkillIds đúng skill, chain prereq đúng thứ tự', () => {
        const b = nodeById(unlockB)!
        const c = nodeById(unlockC)!
        const d = nodeById(unlockD)!
        const e = nodeById(unlockE)!

        for (const [node, skillId] of [[b, bId], [c, cId], [d, dId], [e, eId]] as const) {
          expect(node, `thiếu node ${skillId}`).toBeDefined()
          expect(node.type).toBe('major')
          expect(node.role).toBe('keystone')
          expect(node.insightCost).toBe(2)
          expect(node.effect.unlocksSkillIds).toEqual([skillId])
        }

        expect(nodePrereqs(b)).toContain(lapDaoId)
        expect(nodePrereqs(c)).toContain(unlockB)
        expect(nodePrereqs(d)).toContain(unlockC)
        expect(nodePrereqs(e)).toContain(unlockD)
      })

      it('realm gate C/D/E khớp REALM_SLOT_TABLE (golden_core / soul_transformation / tribulation)', () => {
        expect(realmPrereq(nodeById(unlockC)!)).toBe('golden_core')
        expect(realmPrereq(nodeById(unlockD)!)).toBe('soul_transformation')
        expect(realmPrereq(nodeById(unlockE)!)).toBe('tribulation')

        // "mua được là lắp được": slot mở đúng từ cảnh giới gate.
        const slotTable: Record<string, number> = {
          mortal: 1,
          qi_refining: 2,
          foundation_establishment: 2,
          golden_core: 3,
          nascent_soul: 3,
          soul_transformation: 4,
          void_refinement: 4,
          body_integration: 4,
          mahayana: 4,
          tribulation: 5,
        }

        for (const [node, slotNeeded] of [
          [nodeById(unlockC)!, 3],
          [nodeById(unlockD)!, 4],
          [nodeById(unlockE)!, 5],
        ] as const) {
          const gate = realmPrereq(node)!

          expect(slotTable[gate], `${node.id}: slot ở ${gate}`).toBe(slotNeeded)

          // Mọi cảnh giới DƯỚI gate phải chưa đủ slot.
          for (const [realmId, slots] of Object.entries(slotTable)) {
            if (getRealmIndex(realmId) < getRealmIndex(gate)) {
              expect(slots, `${node.id}: ${realmId} phải < ${slotNeeded}`).toBeLessThan(slotNeeded)
            }
          }
        }
      })

      it('node ult: major, prereq B node, unlocks đúng ult id của hành', async () => {
        const { PHAP_TU_ULTIMATE_IDS } = await import('../../core/battle/UltimateSystem')
        const node = nodeById(`linh_ngo_${PHAP_TU_ULTIMATE_IDS[el as (typeof ELEMENT_ORDER)[number]]}`)

        expect(node).toBeDefined()
        expect(node!.type).toBe('major')
        expect(node!.effect.unlocksSkillIds).toEqual([
          PHAP_TU_ULTIMATE_IDS[el as (typeof ELEMENT_ORDER)[number]],
        ])
        expect(nodePrereqs(node!)).toContain(unlockB)
      })

      it('biến thể C/D: minor specialization cost 2, selectsSpecialization trỏ specialization TỒN TẠI trong skill data, excludes nhau', async () => {
        const { SKILLS } = await import('../skill/Skills')

        const cSkill = SKILLS.find((s) => s.id === cId)!
        const dSkill = SKILLS.find((s) => s.id === dId)!

        expect(cSkill.specializations?.map((s) => s.id)).toHaveLength(2)
        expect(dSkill.specializations?.map((s) => s.id)).toHaveLength(2)

        const variantNodes = PHAP_TU_NODES.filter(
          (n) => n.branchTag === `thuan_${el}` && n.effect.selectsSpecialization,
        )

        expect(variantNodes).toHaveLength(4)

        for (const node of variantNodes) {
          expect(node.type).toBe('minor')
          expect(node.role).toBe('specialization')
          expect(node.insightCost).toBe(2)

          const sel = node.effect.selectsSpecialization!
          const skill = SKILLS.find((s) => s.id === sel.skillId)

          expect(skill, `${node.id}: skill ${sel.skillId} không tồn tại`).toBeDefined()
          expect(
            skill!.specializations?.some((s) => s.id === sel.specializationId),
            `${node.id}: specialization ${sel.specializationId} không có trong ${sel.skillId}`,
          ).toBe(true)
        }

        // C1 excludes C2 và ngược lại; D1 excludes D2 và ngược lại.
        const cNodes = variantNodes.filter((n) => n.effect.selectsSpecialization!.skillId === cId)
        const dNodes = variantNodes.filter((n) => n.effect.selectsSpecialization!.skillId === dId)

        expect(cNodes).toHaveLength(2)
        expect(dNodes).toHaveLength(2)

        expect(excludes(cNodes[0]!)).toContain(cNodes[1]!.id)
        expect(excludes(cNodes[1]!)).toContain(cNodes[0]!.id)
        expect(excludes(dNodes[0]!)).toContain(dNodes[1]!.id)
        expect(excludes(dNodes[1]!)).toContain(dNodes[0]!.id)

        // prereq: biến thể C sau node C, biến thể D sau node D.
        for (const node of cNodes) {
          expect(nodePrereqs(node)).toContain(unlockC)
        }

        for (const node of dNodes) {
          expect(nodePrereqs(node)).toContain(unlockD)
        }
      })

      it('node Thế: Tụ Thế (5 cấp +1/link), Trường Thế (5 cấp +4 trần), Thế Mãn (1 cấp) — skillModifiers lên skill A, chain prereq đúng', () => {
        const tuThe = nodeById(`tu_the_${el}`)!
        const truongThe = nodeById(`truong_the_${el}`)!
        const theMan = nodeById(`the_man_${el}`)!

        expect(tuThe.role).toBe('growth')
        expect(tuThe.maxLevel).toBe(5)
        expect(tuThe.upgradeCost).toEqual({ base: 1, perLevel: 2 })
        expect(tuThe.effect.skillModifiers).toEqual([
          { skillId: SKILL_A[el], statModifiers: [{ stat: 'theGainPerLinkBonus', flat: 1, perLevelFlat: 1 }] },
        ])
        expect(nodePrereqs(tuThe)).toContain(lapDaoId)

        expect(truongThe.role).toBe('growth')
        expect(truongThe.maxLevel).toBe(5)
        expect(truongThe.upgradeCost).toEqual({ base: 1, perLevel: 2 })
        expect(truongThe.effect.skillModifiers).toEqual([
          { skillId: SKILL_A[el], statModifiers: [{ stat: 'theMaxBonus', flat: 4, perLevelFlat: 4 }] },
        ])
        expect(nodePrereqs(truongThe)).toContain(`tu_the_${el}`)

        expect(theMan.role).toBe('growth')
        expect(theMan.maxLevel).toBeUndefined()
        expect(theMan.effect.unlocksSkillIds).toEqual([`the_man_${el}`])
        expect(nodePrereqs(theMan)).toContain(`truong_the_${el}`)
      })
    })
  }

  it('KHÔNG xoá keystone cũ (N4): 10 node Trúc Cơ cũ vẫn còn', () => {
    const oldKeystones = [
      'hoa_truc_co_dan_hoa', 'hoa_truc_co_tu_hoa',
      'moc_truc_co_doc_dan', 'moc_truc_co_doc_can',
      'thuy_truc_co_dan_luu', 'thuy_truc_co_tu_thuy',
      'kim_truc_co_huyet_dan', 'kim_truc_co_kim_the',
      'tho_truc_co_dinh_tho', 'tho_truc_co_tho_the',
    ]

    for (const id of oldKeystones) {
      expect(nodeById(id), `keystone cũ ${id} bị xoá`).toBeDefined()
    }
  })

  it('mọi id node là duy nhất', () => {
    const ids = PHAP_TU_NODES.map((n) => n.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('mọi prerequisite kind node/excludesNode trỏ tới node TỒN TẠI', () => {
    const ids = new Set(PHAP_TU_NODES.map((n) => n.id))

    for (const node of PHAP_TU_NODES) {
      for (const prereq of node.prerequisites ?? []) {
        if (prereq.kind === 'node' || prereq.kind === 'excludesNode') {
          expect(ids.has(prereq.nodeId), `${node.id} trỏ tới node không tồn tại: ${prereq.nodeId}`).toBe(true)
        }
      }
    }
  })

  it('tổng cây = 121 node (5×11 cũ + 5×13 Thuần + 2 chung)', () => {
    expect(PHAP_TU_NODES).toHaveLength(121)
  })
})
