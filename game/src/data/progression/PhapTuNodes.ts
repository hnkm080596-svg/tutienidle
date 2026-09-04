import type { ElementType } from '../../core/element/ElementType'
import type {
  NodeEffect,
  NodePrerequisite,
  ProgressionNode,
  SkillModifier,
} from '../../core/progression/ProgressionNode'
import type { StatModifier } from '../../core/stats/StatCalculator'
import { CHAIN_SKILL_IDS, SKILLS } from '../skill/Skills'
import { PHAP_TU_ULTIMATE_IDS } from '../../core/battle/UltimateSystem'

// Pháp Tu Node Tree — REWORK theo combat-skill-flow-element-power-dot-plan.md
// §6.3-§6.7 (2026-08-26): mỗi hành dùng CÙNG một bộ khung, giữ identity/
// tên gọi của cây cũ nhưng đổi vai trò/cấp độ:
//
//   Root Lĩnh Ngộ (1 cấp, unlocksSkillIds)
//   ├── Power nền (10 cấp, +2 Element Power/cấp, cost 1,1,1,2,2,2,3,3,3,4)
//   ├── Nhịp thi triển (5 cấp, cost 1,1,2,2,3)
//   ├── Cơ chế đặc trưng (5 cấp, cost 1,1,2,2,3)
//   └── Trúc Cơ: 2 Keystone loại trừ nhau (mỗi cái 1 cấp, cost 2)
//       ├── Nhánh Reaction: 2 specialization (5 cấp mỗi node)
//       └── Nhánh Pure:     2–3 specialization (5 cấp mỗi node)
//
// Nguyên tắc (§6.8): node KHÔNG còn push modifier vĩnh viễn lúc mua —
// mọi hiệu lực suy ra từ (registry, nodeLevels) qua aggregator trong
// NodeSystem.ts; level đóng vai trò stack (base + perLevel × (level−1)).
// Cost data-driven qua upgradeCost {base, perLevel} — KHÔNG hard-code
// theo element ở logic.

const FOUNDATION = { kind: 'realm', realmId: 'foundation_establishment' } as const

interface GrowthSpec {
  id: string

  name: string

  description: string

  /** statModifiers (character stats) hoặc skillModifiers (skill runtime). */
  effect: NodeEffect
}

interface KeystoneSpec {
  id: string

  name: string

  description: string

  effect: NodeEffect
}

interface SpecializationSpec extends GrowthSpec {}

interface BranchSpec {
  tag: string

  rootId: string

  rootName: string

  rootDescription: string

  rootCost: number

  rootSkillIds: string[]

  power: { id: string; name: string; stat: `${ElementType}Power` }

  cadence: GrowthSpec

  mechanic: GrowthSpec

  keystoneReaction: KeystoneSpec

  keystonePure: KeystoneSpec

  reactionSpecs: SpecializationSpec[]

  pureSpecs: SpecializationSpec[]
}

function stat(
  nodeId: string,

  statKey: string,

  flat?: number,

  perLevelFlat?: number,
): StatModifier {
  return {
    id: `node:${nodeId}:${statKey}`,

    sourceId: nodeId,

    sourceType: 'talent',

    stat: statKey as StatModifier['stat'],

    ...(flat !== undefined ? { flat } : {}),

    ...(perLevelFlat !== undefined ? { perLevelFlat } : {}),
  }
}

function skillMod(skillId: string, modifiers: SkillModifier[]) {
  return [{ skillId, statModifiers: modifiers }]
}

function buildBranch(spec: BranchSpec): ProgressionNode[] {
  const nodes: ProgressionNode[] = []

  // ── Root ──
  nodes.push({
    id: spec.rootId,

    name: spec.rootName,

    description: spec.rootDescription,

    type: 'major',

    role: 'root',

    insightCost: spec.rootCost,

    effect: { unlocksSkillIds: spec.rootSkillIds },

    branchTag: spec.tag,
  })

  // ── Power nền (10 cấp, +2/cấp) ──
  nodes.push({
    id: spec.power.id,

    name: spec.power.name,

    description: `+2 ${powerLabel(spec.power.stat)} mỗi cấp (cấp 10 = +20).`,

    type: 'minor',

    role: 'growth',

    insightCost: 1,

    maxLevel: 10,

    upgradeCost: { base: 1, perLevel: 3 },

    prerequisites: [{ kind: 'node', nodeId: spec.rootId }],

    effect: {
      statModifiers: [stat(spec.power.id, spec.power.stat, 2, 2)],
    },

    branchTag: spec.tag,
  })

  // ── Growth (nhịp + cơ chế, 5 cấp, dãy 1,1,2,2,3) ──
  for (const growth of [spec.cadence, spec.mechanic]) {
    nodes.push({
      id: growth.id,

      name: growth.name,

      description: growth.description,

      type: 'minor',

      role: 'growth',

      insightCost: 1,

      maxLevel: 5,

      upgradeCost: { base: 1, perLevel: 2 },

      prerequisites: [{ kind: 'node', nodeId: spec.rootId }],

      effect: growth.effect,

      branchTag: spec.tag,
    })
  }

  // ── Keystone Trúc Cơ (loại trừ nhau, 1 cấp) ──
  for (const [keystone, opposite] of [
    [spec.keystoneReaction, spec.keystonePure],

    [spec.keystonePure, spec.keystoneReaction],
  ] as const) {
    nodes.push({
      id: keystone.id,

      name: keystone.name,

      description: keystone.description,

      type: 'major',

      role: 'keystone',

      insightCost: 2,

      prerequisites: [
        { kind: 'node', nodeId: spec.rootId },

        { kind: 'node', nodeId: spec.power.id },

        FOUNDATION,

        { kind: 'excludesNode', nodeId: opposite.id },
      ],

      effect: keystone.effect,

      branchTag: spec.tag,
    })
  }

  // ── Specialization (chỉ sau keystone cha, 5 cấp) ──
  for (const entry of [
    ...spec.reactionSpecs.map((item) => ({ item, parent: spec.keystoneReaction.id })),

    ...spec.pureSpecs.map((item) => ({ item, parent: spec.keystonePure.id })),
  ]) {
    nodes.push({
      id: entry.item.id,

      name: entry.item.name,

      description: entry.item.description,

      type: 'minor',

      role: 'specialization',

      insightCost: 1,

      maxLevel: 5,

      upgradeCost: { base: 1, perLevel: 2 },

      prerequisites: [{ kind: 'node', nodeId: entry.parent }],

      effect: entry.item.effect,

      branchTag: spec.tag,
    })

    // Future Systems Task 2 (2026-09-04) — node ĐẦU TIÊN của nhánh
    // specialization Reaction mở khoá luôn Reaction Path ẩn (special +
    // ultimate `phap_tu_reaction_*`, Task 4) — nhánh Reaction giờ là
    // lối vào hidden path thay vì chỉ buff stat. Chỉ node specialization
    // Reaction ĐẦU TIÊN mang unlock (các node sau giữ vai trò stat buff).
    if (entry.parent === spec.keystoneReaction.id && entry.item === spec.reactionSpecs[0]) {
      nodes.push({
        id: `reaction_path_unlock_${spec.tag}`,

        name: 'Lĩnh Ngộ Đa Hành Cộng Minh',

        description:
          'Thuần hóa phản ứng giữa các hành — mở khoá Reaction Path ẩn: special triệu hồi 2 hành ngẫu nhiên cộng minh, ultimate tự thân cường hóa dmg phản ứng (Future Systems §3).',

        type: 'major',

        role: 'keystone',

        insightCost: 2,

        prerequisites: [{ kind: 'node', nodeId: spec.keystoneReaction.id }],

        effect: {
          unlocksSkillIds: [
            'phap_tu_reaction_special',
            'phap_tu_reaction_ultimate',
          ],
        },

        branchTag: spec.tag,
      })
    }
  }

  return nodes
}

function powerLabel(statKey: string): string {
  switch (statKey) {
    case 'firePower':
      return 'Hỏa Lực'

    case 'woodPower':
      return 'Mộc Lực'

    case 'waterPower':
      return 'Thủy Lực'

    case 'metalPower':
      return 'Kim Lực'

    default:
      return 'Thổ Lực'
  }
}

// ====================================================================
// Pháp Tu Thuần Hệ (spec 2026-09-03 §5, Task 11) — factory nhánh Thuần
// per-hành (13 node): Lập Đạo Thuần (mutex 4 Thuần khác + Đa Pháp),
// unlock B/C/D/E (id `linh_ngo_<skill id>` — N2b, realm gate C=Kim Đan
// /D=Hóa Thần/E=Độ Kiếp khớp REALM_SLOT_TABLE), biến thể C1/C2 +
// D1/D2 (selectsSpecialization E-8 + excludesNode đối diện), ult
// (prereq B — N5), Tụ Thế/Trường Thế/Thế Mãn (skillModifiers lên skill
// A — E-7). Số liệu §4: Tụ Thế +1/link/cấp (cấp 5: link 15, finisher
// 25), Trường Thế +4 trần/cấp (cấp 5: 120), Thế Mãn 1 cấp.
// ====================================================================

const THUAN_REALM_GATE: Record<'c' | 'd' | 'e', string> = {
  c: 'golden_core',
  d: 'soul_transformation',
  e: 'tribulation',
}

interface ThuanVariantSpec {
  nodeId: string

  name: string

  description: string

  specializationId: string
}

interface ThuanChainSpec {
  /** Skill id B–E theo thứ tự chuỗi (CHAIN_SKILL_IDS, bỏ A). */
  skillId: string

  /** Tên hiển thị node unlock ("Lĩnh ngộ <tên skill>"). */
  unlockName: string

  realmGate?: string

  /** 2 biến thể (chỉ C/D). */
  variants?: [ThuanVariantSpec, ThuanVariantSpec]
}

function thuanUnlockName(skillId: string): string {
  const skillName = SKILL_NAMES_BY_ID[skillId]

  if (!skillName) {
    throw new Error(`PhapTuNodes: skill ${skillId} không có trong SKILLS (mất tên node unlock)`)
  }

  return `Lĩnh ngộ ${skillName}`
}

function buildThuanBranch(element: ElementType): ProgressionNode[] {
  // Future Systems Task 1 (2026-09-04) — chuỗi 3 skill/hành: [basic, special,
  // ultimate]. basic = root có sẵn (không node unlock); 2 node unlock cho
  // special (realm gate Kim Đan) + ultimate (Độ Kiếp); biến thể gắn special
  // (C cũ). Node ult riêng (PHAP_TU_ULTIMATE_IDS) giữ nguyên prereq special.
  const chain = CHAIN_SKILL_IDS[element]
  const [, specialId, ultimateId] = chain
  const skillA = chain[0] as string
  const tag = `thuan_${element}`
  const lapDaoId = `lap_dao_thuan_${element}`
  const ultId = PHAP_TU_ULTIMATE_IDS[element as keyof typeof PHAP_TU_ULTIMATE_IDS]

  const otherThuan = (Object.keys(CHAIN_SKILL_IDS) as ElementType[])
    .filter((other) => other !== element)
    .map((other) => `lap_dao_thuan_${other}`)

  const nodes: ProgressionNode[] = []

  // ── Lập Đạo Thuần (major, cost 2, mutex mọi nhánh khác) ──
  nodes.push({
    id: lapDaoId,
    name: `Lập Đạo Thuần (${powerLabel(`${element}Power` as `${ElementType}Power`).replace(' Lực', '')})`,
    description:
      'Chọn một hành duy nhất mà đi tới tận cùng — các đạo Thuần hành khác và Đa Pháp bị đóng.',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [
      { kind: 'node', nodeId: 'phap_tu_lap_dao' },
      ...otherThuan.map((nodeId): NodePrerequisite => ({ kind: 'excludesNode', nodeId })),
      { kind: 'excludesNode', nodeId: 'phap_tu_lap_dao_da_phap' },
    ],
    effect: {},
    branchTag: tag,
  })

  // ── 2 node unlock special/ultimate + biến thể special ──
  const chainSpecs: ThuanChainSpec[] = [
    {
      skillId: specialId,
      unlockName: thuanUnlockName(specialId),
      realmGate: THUAN_REALM_GATE.c,
      variants: THUAN_VARIANTS[element].c,
    },
    { skillId: ultimateId, unlockName: thuanUnlockName(ultimateId), realmGate: THUAN_REALM_GATE.e },
  ]

  for (const [index, spec] of chainSpecs.entries()) {
    const unlockNodeId = `linh_ngo_${spec.skillId}`
    const prereqs: NodePrerequisite[] = [{ kind: 'node', nodeId: lapDaoId }]

    if (index > 0) {
      const previous = chainSpecs[index - 1]!

      prereqs.push({ kind: 'node', nodeId: `linh_ngo_${previous.skillId}` })
    }

    if (spec.realmGate) {
      prereqs.push({ kind: 'realm', realmId: spec.realmGate })
    }

    nodes.push({
      id: unlockNodeId,
      name: spec.unlockName,
      description: `Lĩnh ngộ ${SKILL_NAMES_BY_ID[spec.skillId]} — mở khoá kỹ năng chuỗi.`,
      type: 'major',
      role: 'keystone',
      insightCost: 2,
      prerequisites: prereqs,
      effect: { unlocksSkillIds: [spec.skillId] },
      branchTag: tag,
    })

    if (spec.variants) {
      const [v1, v2] = spec.variants

      for (const [self, opposite] of [[v1, v2], [v2, v1]] as const) {
        nodes.push({
          id: self.nodeId,
          name: self.name,
          description: self.description,
          type: 'minor',
          role: 'specialization',
          insightCost: 2,
          prerequisites: [
            { kind: 'node', nodeId: unlockNodeId },
            { kind: 'excludesNode', nodeId: opposite.nodeId },
          ],
          effect: {
            selectsSpecialization: { skillId: spec.skillId, specializationId: self.specializationId },
          },
          branchTag: tag,
        })
      }
    }
  }

  // ── Node ult (major, prereq special — N5: Thế có đầu ra sớm) ──
  nodes.push({
    id: `linh_ngo_${ultId}`,
    name: `Lĩnh ngộ ${SKILL_NAMES_BY_ID[ultId]}`,
    description: 'Đạo sắc ngưng tụ thành pháp tướng — mở Ultimate của hành (đốt toàn bộ Thế).',
    type: 'major',
    role: 'keystone',
    insightCost: 2,
    prerequisites: [{ kind: 'node', nodeId: `linh_ngo_${specialId}` }],
    effect: { unlocksSkillIds: [ultId] },
    branchTag: tag,
  })

  // ── Thế: Tụ Thế (5) → Trường Thế (5) → Thế Mãn (1) ──
  nodes.push({
    id: `tu_the_${element}`,
    name: 'Tụ Thế',
    description: '+1 Thế mỗi link chuỗi mỗi cấp (cấp 5: link 15, finisher 25).',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: lapDaoId }],
    effect: {
      skillModifiers: skillMod(skillA, [
        { stat: 'theGainPerLinkBonus', flat: 1, perLevelFlat: 1 },
      ]),
    },
    branchTag: tag,
  })

  nodes.push({
    id: `truong_the_${element}`,
    name: 'Trường Thế',
    description: '+4 trần Thế mỗi cấp (cấp 5: 120) — ult chậm hơn nhưng Thế Mãn kéo dài hơn.',
    type: 'minor',
    role: 'growth',
    insightCost: 1,
    maxLevel: 5,
    upgradeCost: { base: 1, perLevel: 2 },
    prerequisites: [{ kind: 'node', nodeId: `tu_the_${element}` }],
    effect: {
      skillModifiers: skillMod(skillA, [
        { stat: 'theMaxBonus', flat: 4, perLevelFlat: 4 },
      ]),
    },
    branchTag: tag,
  })

  nodes.push({
    id: `the_man_${element}`,
    name: 'Thế Mãn',
    description: THE_MAN_DESCRIPTION[element],
    type: 'minor',
    role: 'growth',
    insightCost: 2,
    prerequisites: [{ kind: 'node', nodeId: `truong_the_${element}` }],
    // Engine (E-7) ÁP/GỠ buff the_man_<el> theo trạng thái Thế đầy —
    // unlocksSkillIds chỉ để UI hiển thị "nội dung mở khoá" (buff là
    // data/buff, không phải skill; xem TheResourceSystem.updateTheManBuff).
    effect: { unlocksSkillIds: [`the_man_${element}`] },
    branchTag: tag,
  })

  return nodes
}

// Tên hiển thị skill (node unlock/ult) — tra từ data skill, KHÔNG
// hard-code trùng (nguồn sự thật tên là Skills.ts).
const SKILL_NAMES_BY_ID: Record<string, string> = Object.fromEntries(
  SKILLS.map((skill) => [skill.id, skill.name]),
)

// Biến thể C/D per-hành (spec §2) — nodeId đặt theo tên biến thể (N2b,
// bỏ dấu), specializationId KHỚP id trong Skills.ts specializations.
const THUAN_VARIANTS: Record<
  ElementType,
  { c: [ThuanVariantSpec, ThuanVariantSpec]; d: [ThuanVariantSpec, ThuanVariantSpec] }
> = {
  fire: {
    c: [
      {
        nodeId: 'tam_muoi_tu_diem',
        name: 'Tam Muội · Tụ Diễm',
        description: 'Ba ngọn lửa tụ một điểm — đắp 2 tầng Bỏng mỗi cast.',
        specializationId: 'tam_muoi_tu_diem',
      },
      {
        nodeId: 'tam_muoi_tan_diem',
        name: 'Tam Muội · Tán Diễm',
        description: 'Lửa tán thành vùng — Bỏng phủ mọi mục tiêu xung quanh.',
        specializationId: 'tam_muoi_tan_diem',
      },
    ],
    d: [
      {
        nodeId: 'dan_no_liet_bao',
        name: 'Dẫn Nộ · Liệt Bạo',
        description: 'Nộ hỏa bùng nổ — mỗi tầng Bỏng nổ 50 (burst tối đa).',
        specializationId: 'dan_no_liet_bao',
      },
      {
        nodeId: 'dan_no_du_hoa',
        name: 'Dẫn Nộ · Dư Hỏa',
        description: 'Kích nổ xong còn than hồng — giữ 1 tầng Bỏng để lặp chuỗi nhanh.',
        specializationId: 'dan_no_du_hoa',
      },
    ],
  },
  water: {
    c: [
      {
        nodeId: 'duong_linh_tuyen',
        name: 'Dưỡng Linh · Tuyền',
        description: 'Mạch suối dồi dào — hồi Pháp Lực mạnh và lâu hơn (+12, 8s).',
        specializationId: 'duong_linh_tuyen',
      },
      {
        nodeId: 'duong_linh_bang_giap',
        name: 'Dưỡng Linh · Băng Giáp',
        description: 'Nước đóng băng giáp — Thủy thiên về phòng thủ.',
        specializationId: 'duong_linh_bang_giap',
      },
    ],
    d: [
      {
        nodeId: 'thon_no_cam_tuc',
        name: 'Thôn Nộ · Cấm Túc',
        description: 'Nước xiềng chặt chân — trói 100%, bỏ hấp thụ.',
        specializationId: 'thon_no_cam_tuc',
      },
      {
        nodeId: 'thon_no_hap_luu',
        name: 'Thôn Nộ · Hấp Lưu',
        description: 'Dòng hút xoáy sâu — leech mạnh hơn, lâu hơn.',
        specializationId: 'thon_no_hap_luu',
      },
    ],
  },
  wood: {
    c: [
      {
        nodeId: 'can_tri_cam_bo',
        name: 'Căn Trì · Cấm Bộ',
        description: 'Rễ xiết chặt — root bản dài 4s, 100%.',
        specializationId: 'can_tri_cam_bo',
      },
      {
        nodeId: 'can_tri_tham_doc',
        name: 'Căn Trì · Thâm Độc',
        description: 'Độc ngấm tận rễ — bỏ root, đắp +2 tầng Trúng Độc.',
        specializationId: 'can_tri_tham_doc',
      },
    ],
    d: [
      {
        nodeId: 'lan_doc_quang',
        name: 'Lan Độc · Quảng',
        description: 'Độc bay khắp chiến trường — all_lanes, spread 50%.',
        specializationId: 'lan_doc_quang',
      },
      {
        nodeId: 'lan_doc_tham',
        name: 'Lan Độc · Thâm',
        description: 'Độc ngấm thấu xương — spread 100% + refresh nguồn.',
        specializationId: 'lan_doc_tham',
      },
    ],
  },
  metal: {
    c: [
      {
        nodeId: 'kim_lang_toan_vuc',
        name: 'Kim Lang · Toàn Vực',
        description: 'Vụn thép phủ trọn một vùng.',
        specializationId: 'kim_lang_toan_vuc',
      },
      {
        nodeId: 'kim_lang_xuyen_liet',
        name: 'Kim Lang · Xuyên Liệt',
        description: 'Lưỡi bão xuyên thẳng một hàng.',
        specializationId: 'kim_lang_xuyen_liet',
      },
    ],
    d: [
      {
        nodeId: 'cong_huong_tich_huyet',
        name: 'Cộng Hưởng · Tích Huyết',
        description: 'Tiếng chuông dồn máu — Xuất Huyết +3 tầng.',
        specializationId: 'cong_huong_tich_huyet',
      },
      {
        nodeId: 'cong_huong_chan_huyet',
        name: 'Cộng Hưởng · Chấn Huyết',
        description: 'Chuông chấn đến choáng váng — +1 tầng, 30% Choáng.',
        specializationId: 'cong_huong_chan_huyet',
      },
    ],
  },
  earth: {
    c: [
      {
        nodeId: 'dia_tru_bich',
        name: 'Địa Trụ · Bích',
        description: 'Tường đất vững chãi — khiên thuần nuôi E nổ to.',
        specializationId: 'dia_tru_bich',
      },
      {
        nodeId: 'dia_tru_thu',
        name: 'Địa Trụ · Thứ',
        description: 'Đất hóa gai nhọn — phản đòn.',
        specializationId: 'dia_tru_thu',
      },
    ],
    d: [
      {
        nodeId: 'chan_dia_tran',
        name: 'Chấn Địa · Trấn',
        description: 'Trấn xuống đúng một điểm — dmg 1.7, choáng 70%.',
        specializationId: 'chan_dia_tran',
      },
      {
        nodeId: 'chan_dia_quang',
        name: 'Chấn Địa · Quảng',
        description: 'Động đất lan rộng — area rộng, choáng 25%.',
        specializationId: 'chan_dia_quang',
      },
    ],
  },
}

// Hiệu lực Thế Mãn per-hành (spec §4 bảng).
const THE_MAN_DESCRIPTION: Record<ElementType, string> = {
  fire: 'Khi Thế đầy: +15% potency ailment.',
  water: 'Khi Thế đầy: +6 Pháp Lực hồi mỗi giây.',
  wood: 'Khi Thế đầy: +20% thời gian hiệu lực ailment.',
  metal: 'Khi Thế đầy: +8% chí mạng.',
  earth: 'Khi Thế đầy: +10% phòng thủ.',
}

export const PHAP_TU_NODES: ProgressionNode[] = [
  ...buildBranch({
    tag: 'fire',

    rootId: 'hoa_linh_ngo',

    rootName: 'Hỏa Cầu Thuật',

    rootDescription:
      'Học Hỏa Cầu Thuật — root của Hỏa skill tree, luôn có sẵn miễn phí lúc chọn Pháp Tu.',

    rootCost: 0,

    rootSkillIds: ['hoa_cau_thuat'],

    power: { id: 'minor_fire_intensity', name: 'Hỏa Linh', stat: 'firePower' },

    cadence: {
      id: 'minor_fire_haste',

      name: 'Tật Hỏa',

      description: '+3% Tốc Độ Niệm mỗi cấp.',

      effect: { statModifiers: [stat('minor_fire_haste', 'speed', 3, 3)] },
    },

    mechanic: {
      id: 'minor_fire_burn',

      name: 'Xích Viêm',

      description: '+4% Sát Thương Thiêu Đốt (ailment potency) mỗi cấp.',

      effect: { statModifiers: [stat('minor_fire_burn', 'ailmentPotencyPercent', 0.04, 0.04)] },
    },

    keystoneReaction: {
      id: 'hoa_truc_co_dan_hoa',

      name: 'Dẫn Hỏa',

      description:
        '+15% Tỉ Lệ Áp Nguyên Tố (Thiêu Đốt) của Hỏa Cầu Thuật — mở khoá nhánh Minor Reaction.',

      effect: {
        statModifiers: [stat('hoa_truc_co_dan_hoa', 'elementApplicationPercent', 0.15)],
      },
    },

    keystonePure: {
      id: 'hoa_truc_co_tu_hoa',

      name: 'Tụ Hỏa',

      description:
        'Mỗi lần dùng Hỏa Cầu Thuật tích 1 Hỏa Thế — mở khoá nhánh Minor Pure (keystone đối diện bị khoá).',

      effect: { skillModifiers: skillMod('hoa_cau_thuat', [{ stat: 'hoaTheGainPerCast', flat: 1 }]) },
    },

    reactionSpecs: [
      {
        id: 'minor_fire_application',

        name: 'Hỏa Nguyên',

        description: '+2% Tỉ Lệ Áp Nguyên Tố mỗi cấp.',

        effect: { statModifiers: [stat('minor_fire_application', 'elementApplicationPercent', 0.02, 0.02)] },
      },

      {
        id: 'minor_fire_reaction_effect',

        name: 'Cộng Minh',

        description: '+5% Sát Thương Phản Ứng Nguyên Tố mỗi cấp.',

        effect: { statModifiers: [stat('minor_fire_reaction_effect', 'reactionEffectPercent', 0.05, 0.05)] },
      },
    ],

    pureSpecs: [
      {
        id: 'minor_fire_heart',

        name: 'Hỏa Tâm',

        description: '+3 Hỏa Lực mỗi cấp.',

        effect: { statModifiers: [stat('minor_fire_heart', 'firePower', 3, 3)] },
      },

      {
        id: 'minor_fire_channeling',

        name: 'Hỏa Mạch',

        description: '+2% Hỏa Thế tích mỗi lượt mỗi cấp (cấp 5 = +10%).',

        effect: {
          skillModifiers: skillMod('hoa_cau_thuat', [
            { stat: 'hoaTheGainPerCast', flat: 0.02, perLevelFlat: 0.02 },
          ]),
        },
      },

      {
        id: 'minor_fire_retention',

        name: 'Tụ Viêm',

        description: 'Hỏa Thế giảm chậm hơn 2% mỗi cấp (cấp 5 = 10%).',

        effect: {
          skillModifiers: skillMod('hoa_cau_thuat', [
            { stat: 'hoaTheDecayReductionPercent', flat: 0.02, perLevelFlat: 0.02 },
          ]),
        },
      },
    ],
  }),

  ...buildBranch({
    tag: 'wood',

    rootId: 'moc_linh_ngo',

    rootName: 'Độc Chưởng',

    rootDescription:
      'Học Độc Chưởng — root của Mộc skill tree, mở khoá toàn bộ Node Tree Mộc (Luyện Khí + Trúc Cơ).',

    rootCost: 2,

    rootSkillIds: ['doc_chuong'],

    power: { id: 'minor_wood_intensity', name: 'Độc Nguyên', stat: 'woodPower' },

    cadence: {
      id: 'minor_wood_threshold',

      name: 'Độc Mạch',

      description: '+3% Tốc Độ Niệm mỗi cấp.',

      effect: { statModifiers: [stat('minor_wood_threshold', 'speed', 3, 3)] },
    },

    mechanic: {
      id: 'minor_wood_duration',

      name: 'Độc Tức',

      description: '+4% Thời Gian Hiệu Lực Độc mỗi cấp.',

      effect: { statModifiers: [stat('minor_wood_duration', 'ailmentDurationPercent', 0.04, 0.04)] },
    },

    keystoneReaction: {
      id: 'moc_truc_co_doc_dan',

      name: 'Độc Dẫn',

      description:
        '+15% Sát Thương Phản Ứng Nguyên Tố — mở khoá nhánh Reaction (Độc Viêm...).',

      effect: {
        statModifiers: [stat('moc_truc_co_doc_dan', 'reactionEffectPercent', 0.15)],
      },
    },

    keystonePure: {
      id: 'moc_truc_co_doc_can',

      name: 'Mộc Thế',

      description:
        'Độc Căn tối đa +1 tầng — mở khoá nhánh Pure Mộc Thế (keystone đối diện bị khoá).',

      effect: { skillModifiers: skillMod('doc_chuong', [{ stat: 'poisonRootMaxStacks', flat: 1 }]) },
    },

    reactionSpecs: [
      {
        id: 'minor_wood_reaction_effect',

        name: 'Cộng Độc',

        description: '+5% Sát Thương Phản Ứng mỗi cấp.',

        effect: { statModifiers: [stat('minor_wood_reaction_effect', 'reactionEffectPercent', 0.05, 0.05)] },
      },

      {
        id: 'minor_wood_potency',

        name: 'Độc Thực',

        description: '+3% Sát Thương Độc (potency) mỗi cấp.',

        effect: { statModifiers: [stat('minor_wood_potency', 'ailmentPotencyPercent', 0.03, 0.03)] },
      },
    ],

    pureSpecs: [
      {
        id: 'minor_wood_heart',

        name: 'Độc Linh',

        description: '+3 Mộc Lực mỗi cấp.',

        effect: { statModifiers: [stat('minor_wood_heart', 'woodPower', 3, 3)] },
      },

      {
        id: 'minor_wood_channeling',

        name: 'Độc Uyển',

        description: 'Độc Căn tối đa +1 tầng ở cấp 1, +3 tầng ở cấp 5.',

        effect: {
          skillModifiers: skillMod('doc_chuong', [
            { stat: 'poisonRootMaxStacks', flat: 1, perLevelFlat: 0.5 },
          ]),
        },
      },

      {
        id: 'minor_wood_duration_chung',

        name: 'Độc Trưởng',

        description: '+3% Thời Gian Độc mỗi cấp.',

        effect: { statModifiers: [stat('minor_wood_duration_chung', 'ailmentDurationPercent', 0.03, 0.03)] },
      },
    ],
  }),

  ...buildBranch({
    tag: 'water',

    rootId: 'thuy_linh_ngo',

    rootName: 'Thủy Tiễn Thuật',

    rootDescription:
      'Học Thủy Tiễn Thuật — root của Thủy skill tree, mở khoá toàn bộ Node Tree Thủy.',

    rootCost: 2,

    rootSkillIds: ['thuy_tien_thuat'],

    power: { id: 'minor_water_intensity', name: 'Thủy Linh', stat: 'waterPower' },

    cadence: {
      id: 'minor_water_haste',

      name: 'Thủy Tốc',

      description: '+3% Tốc Độ Niệm mỗi cấp.',

      effect: { statModifiers: [stat('minor_water_haste', 'speed', 3, 3)] },
    },

    mechanic: {
      id: 'minor_water_cast_speed',

      name: 'Lưu Tốc',

      description: '+2% Giảm Cooldown kỹ năng mỗi cấp.',

      effect: { statModifiers: [stat('minor_water_cast_speed', 'speed', 2, 2)] },
    },

    keystoneReaction: {
      id: 'thuy_truc_co_dan_luu',

      name: 'Dẫn Lưu',

      description:
        '+15% Tỉ Lệ Áp Nguyên Tố — mở khoá nhánh Reaction Thủy (Dẫn Lưu).',

      effect: {
        statModifiers: [stat('thuy_truc_co_dan_luu', 'elementApplicationPercent', 0.15)],
      },
    },

    keystonePure: {
      id: 'thuy_truc_co_tu_thuy',

      name: 'Tụ Thủy',

      description:
        'Thủy Thế +5% — mở khoá nhánh Pure Tụ Thủy (keystone đối diện bị khoá).',

      effect: { skillModifiers: skillMod('thuy_tien_thuat', [{ stat: 'thuyThePercent', flat: 0.05 }]) },
    },

    reactionSpecs: [
      {
        id: 'minor_water_application',

        name: 'Thủy Dẫn',

        description: '+2% Tỉ Lệ Áp Nguyên Tố mỗi cấp.',

        effect: { statModifiers: [stat('minor_water_application', 'elementApplicationPercent', 0.02, 0.02)] },
      },

      {
        id: 'minor_water_reaction_effect',

        name: 'Cộng Lưu',

        description: '+5% Sát Thương Phản Ứng mỗi cấp.',

        effect: { statModifiers: [stat('minor_water_reaction_effect', 'reactionEffectPercent', 0.05, 0.05)] },
      },
    ],

    pureSpecs: [
      {
        id: 'minor_water_heart',

        name: 'Thủy Nguyên',

        description: '+3 Thủy Lực mỗi cấp.',

        effect: { statModifiers: [stat('minor_water_heart', 'waterPower', 3, 3)] },
      },

      {
        id: 'minor_water_channeling',

        name: 'Thủy Mạch',

        description: '+1% Thủy Thế mỗi cấp.',

        effect: {
          skillModifiers: skillMod('thuy_tien_thuat', [
            { stat: 'thuyThePercent', flat: 0.01, perLevelFlat: 0.01 },
          ]),
        },
      },

      {
        id: 'minor_water_softness',

        name: 'Nhuyễn Lưu',

        description: '+1% Thủy Thế mỗi cấp.',

        effect: {
          skillModifiers: skillMod('thuy_tien_thuat', [
            { stat: 'thuyThePercent', flat: 0.01, perLevelFlat: 0.01 },
          ]),
        },
      },
    ],
  }),

  ...buildBranch({
    tag: 'metal',

    rootId: 'kim_linh_ngo',

    rootName: 'Điểm Kim Thuật',

    rootDescription:
      'Học Điểm Kim Thuật — root của Kim skill tree, mở khoá toàn bộ Node Tree Kim.',

    rootCost: 2,

    rootSkillIds: ['diem_kim_thuat'],

    power: { id: 'minor_metal_intensity', name: 'Kim Khí', stat: 'metalPower' },

    cadence: {
      id: 'minor_metal_burst',

      name: 'Huyết Bạo',

      description: '+3% Tốc Độ Niệm mỗi cấp.',

      effect: { statModifiers: [stat('minor_metal_burst', 'speed', 3, 3)] },
    },

    mechanic: {
      id: 'minor_metal_bleed_damage',

      name: 'Huyết Ấn',

      description: '+4% Sát Thương Chảy Máu (potency) mỗi cấp.',

      effect: { statModifiers: [stat('minor_metal_bleed_damage', 'ailmentPotencyPercent', 0.04, 0.04)] },
    },

    keystoneReaction: {
      id: 'kim_truc_co_huyet_dan',

      name: 'Huyết Dẫn',

      description:
        '+15% Sát Thương Phản Ứng — mở khoá nhánh Reaction Kim (Huyết Dẫn).',

      effect: {
        statModifiers: [stat('kim_truc_co_huyet_dan', 'reactionEffectPercent', 0.15)],
      },
    },

    keystonePure: {
      id: 'kim_truc_co_kim_the',

      name: 'Kim Thế',

      description:
        'Mỗi lần Xuất Huyết áp thành công tích 1 Kim Thế (tối đa +1 tầng) — mở khoá nhánh Pure Kim Thế (keystone đối diện bị khoá).',

      effect: {
        skillModifiers: skillMod('diem_kim_thuat', [
          { stat: 'kimTheGainPerProc', flat: 1 },

          { stat: 'kimTheMaxStacksBonus', flat: 1 },
        ]),
      },
    },

    reactionSpecs: [
      {
        id: 'minor_metal_application',

        name: 'Điểm Huyệt',

        description: '+2% Tỉ Lệ Áp Nguyên Tố mỗi cấp.',

        effect: { statModifiers: [stat('minor_metal_application', 'elementApplicationPercent', 0.02, 0.02)] },
      },

      {
        id: 'minor_metal_reaction_effect',

        name: 'Cộng Huyết',

        description: '+5% Sát Thương Phản Ứng mỗi cấp.',

        effect: { statModifiers: [stat('minor_metal_reaction_effect', 'reactionEffectPercent', 0.05, 0.05)] },
      },
    ],

    pureSpecs: [
      {
        id: 'minor_metal_channeling',

        name: 'Kim Uyển',

        description: 'Kim Thế tối đa +1 tầng ở cấp 1, +3 tầng ở cấp 5.',

        effect: {
          skillModifiers: skillMod('diem_kim_thuat', [
            { stat: 'kimTheMaxStacksBonus', flat: 1, perLevelFlat: 0.5 },
          ]),
        },
      },

      {
        id: 'minor_metal_shatter',

        name: 'Huyết Phá',

        description:
          'Mỗi lần Xuất Huyết áp thành công tích 1 Huyết Phá — chạm ngưỡng nổ 1 cục burst (mỗi cấp +0.5% Xuyên DOT RES mỗi tầng Kim Thế).',

        effect: {
          skillModifiers: skillMod('diem_kim_thuat', [
            { stat: 'kimTheDotResistancePenetrationPercentPerStack', flat: 0.005, perLevelFlat: 0.005 },

            { stat: 'huyetPhaGainPerProc', flat: 1 },

            { stat: 'huyetPhaBurstDamage', flat: 60 },
          ]),
        },
      },

      {
        id: 'minor_metal_heart',

        name: 'Kim Tâm',

        description: '+3 Kim Lực mỗi cấp.',

        effect: { statModifiers: [stat('minor_metal_heart', 'metalPower', 3, 3)] },
      },
    ],
  }),

  ...buildBranch({
    tag: 'earth',

    rootId: 'tho_linh_ngo',

    rootName: 'Thổ Cầu Thuật',

    rootDescription:
      'Học Thổ Cầu Thuật — root của Thổ skill tree, mở khoá toàn bộ Node Tree Thổ.',

    rootCost: 2,

    rootSkillIds: ['tho_cau_thuat'],

    power: { id: 'minor_earth_intensity', name: 'Thổ Nguyên', stat: 'earthPower' },

    cadence: {
      id: 'minor_earth_haste',

      name: 'Thổ Tốc',

      description: '+3% Tốc Độ Niệm mỗi cấp.',

      effect: { statModifiers: [stat('minor_earth_haste', 'speed', 3, 3)] },
    },

    mechanic: {
      id: 'minor_earth_impact',

      name: 'Chấn Lực',

      description: '+2% Sát Thương Kỹ Năng mỗi cấp.',

      effect: {
        skillModifiers: skillMod('tho_cau_thuat', [
          { stat: 'skillImpactPercent', flat: 0.02, perLevelFlat: 0.02 },
        ]),
      },
    },

    keystoneReaction: {
      id: 'tho_truc_co_dinh_tho',

      name: 'Định Thổ',

      description:
        '+15% Sát Thương Phản Ứng — mở khoá nhánh Reaction Thổ (Định Thổ).',

      effect: {
        statModifiers: [stat('tho_truc_co_dinh_tho', 'reactionEffectPercent', 0.15)],
      },
    },

    keystonePure: {
      id: 'tho_truc_co_tho_the',

      name: 'Thổ Thế',

      description:
        'Mỗi lần thi triển Thổ Cầu Thuật tích 1 Thổ Thế, +5% Sát Thương Kỹ Năng — mở khoá nhánh Pure Thổ Thế (keystone đối diện bị khoá).',

      effect: {
        skillModifiers: skillMod('tho_cau_thuat', [
          { stat: 'thoTheGainPerCast', flat: 1 },

          { stat: 'skillImpactPercent', flat: 0.05 },
        ]),
      },
    },

    reactionSpecs: [
      {
        id: 'minor_earth_reaction_effect',

        name: 'Định Lực',

        description: '+5% Sát Thương Phản Ứng mỗi cấp.',

        effect: { statModifiers: [stat('minor_earth_reaction_effect', 'reactionEffectPercent', 0.05, 0.05)] },
      },

      {
        id: 'minor_earth_knockback',

        name: 'Trọng Thạch',

        description: '+2% Sát Thương Kỹ Năng mỗi cấp.',

        effect: { statModifiers: [stat('minor_earth_knockback', 'skillDamagePercent', 0.02, 0.02)] },
      },
    ],

    pureSpecs: [
      {
        id: 'minor_earth_aoe',

        name: 'Chấn Vực',

        description:
          'Bán kính AOE Thổ +1 ô ở cấp 1, +2 ô ở cấp 5 (data làm tròn xuống).',

        effect: {
          skillModifiers: skillMod('tho_cau_thuat', [
            { stat: 'earthAoeRadius', flat: 1, perLevelFlat: 0.25 },
          ]),
        },
      },

      {
        id: 'minor_earth_heart',

        name: 'Thổ Tâm',

        description: '+3 Thổ Lực mỗi cấp.',

        effect: { statModifiers: [stat('minor_earth_heart', 'earthPower', 3, 3)] },
      },
    ],
  }),

  // ==================================================================
  // Pháp Tu Thuần Hệ (spec 2026-09-03 §5, Task 11) — nhánh Thuần: gate
  // Lập Đạo chung → Lập Đạo Thuần per-hành (loại trừ đa pháp) → unlock
  // B/C/D/E (realm gate khớp REALM_SLOT_TABLE: C=golden_core,
  // D=soul_transformation, E=tribulation) → biến thể C/D (2 chọn 1,
  // selectsSpecialization E-8) → ult (prereq B — N5) → Thế (Tụ/Trường/
  // Mãn). 13 node mới × 5 hành + 2 node chung = 67. Keystone Trúc Cơ
  // CŨ KHÔNG xoá (N4 — dọn riêng sau Đa Pháp).
  // ==================================================================

  // Cổng chung mọi nhánh Đạo — gate Trúc Cơ, cost 0 (spec §5.1).
  {
    id: 'phap_tu_lap_dao',
    name: 'Lập Đạo',
    description:
      'Đứng trên Trúc Cơ, nhìn khắp Ngũ Hành mà lập đạo — cổng chung cho nhánh Thuần lẫn Đa Pháp.',
    type: 'major',
    role: 'keystone',
    insightCost: 0,
    prerequisites: [FOUNDATION],
    effect: {},
    branchTag: 'lap_dao',
  },

  // Placeholder ĐA PHÁP — chỉ khai để lap_dao_thuan_* trỏ excludesNode
  // tới; nội dung nhánh Đa Pháp theo plan cha Task 11 phần còn lại.
  {
    id: 'phap_tu_lap_dao_da_phap',
    name: 'Lập Đạo · Đa Pháp',
    description: 'Đạo của kẻ thu phục nhiều hành — nội dung khai sau (plan cha).',
    type: 'major',
    role: 'keystone',
    insightCost: 0,
    prerequisites: [FOUNDATION],
    effect: {},
    branchTag: 'da_phap',
  },

  ...buildThuanBranch('fire'),
  ...buildThuanBranch('water'),
  ...buildThuanBranch('wood'),
  ...buildThuanBranch('metal'),
  ...buildThuanBranch('earth'),
]
