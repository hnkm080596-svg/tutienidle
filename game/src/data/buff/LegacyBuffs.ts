import type { BuffDefinition } from '@/core/buff2/BuffDefinition'

// buff2 migration (megaplan M4) - mechanical per M1 mapping:
//   stackMode:'stack'   -> stacking{onReapplyStacks:'add', onReapplyDuration:'refresh'}
//   stackMode:'refresh' -> stacking{onReapplyStacks:'keep', onReapplyDuration:'refresh'}
//   duration turn-ticks -> lifetime{clock:'holder_turns', scaling:'ailment_scaled'}
//   duration:Infinity   -> lifetime{clock:'permanent', scaling:'fixed'}
//   dot                 -> periodic[{type:'damage', timing:'holder_turn_end',
//                            scaling:'dynamic', stackScaling:'multiply',
//                            damageProfile:'legacy_dot', canCrit:false,
//                            canMiss:false, hitCount:1}] (+tags armor_ignore)
//   cc/statModifier/onHitProc/dotRecovery -> controls/statModifiers/capabilities
//   polarity:'debuff' combat statuses -> kind:'ailment' + resistance 'ailment'

export const LEGACY_BUFFS: BuffDefinition[] = [
  // Phap Tu (Tho Tu, 2026-08-15) - Thach Giap Tran (special skill,
  // xem data/skill/Skills.ts) tu buff wardMax tam thoi len ban than,
  // tai dung effect 'buff' co san (zero plumbing moi).
  // The Tu Reimagined (spec 2026-09-15 T12): generic thorns stat retired -
  // the thorns leg is gone, wardMax remains the buff's payload.
  {
    id: 'thach_giap_buff',
    name: 'Thạch Giáp',
    description:
      'Linh khí Thổ ngưng thành 1 lớp khiên đá tạm thời, tăng Hộ Thuẫn tối đa.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 6, scaling: 'ailment_scaled' },
    statModifiers: [{ stat: 'wardMax', flat: 40 }],
    dispellable: false,
  },

  // --- Canonical Ngu Hanh seals (canonical-seals/reaction megaplan S1,
  // 2026-09-19) -- the five elemental ailments are THE canonical reaction
  // seals: one semantic representation per element, keyed by
  // ElementalStateRegistry. Locked: duration 3 holder turns, maxStacks 5
  // add/refresh, per_source, ailment resistance. `tran_an` is a pure
  // stacking setup state -- spec sec.5 defines no standalone mechanics
  // (the legacy -30% evasionRate + on-hit choang proc are retired, not
  // preserved). Orphaned old-reaction products (doc_the/ngung_lo/
  // khai_son/hoai_tu/dung_nham/huyet_doc) are deleted with the migration
  // -- zero producers remained.
  {
    id: 'hoa_an',
    element: 'fire',
    name: 'Hỏa Ấn',
    description: 'Ấn ký Hỏa ngấm vào mục tiêu — mỗi tầng đốt cháy theo sức mạnh nguyên tố.',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'hoa_an.dot',
        type: 'damage',
        element: 'fire',
        damageProfile: 'legacy_dot',
        coefficient: 0.15,
        scaling: 'dynamic',
        timing: 'holder_turn_end',
        stackScaling: 'multiply',
        canCrit: false,
        canMiss: false,
        hitCount: 1,
      },
    ],
    dispellable: true,
  },

  {
    id: 'doc_can',
    element: 'wood',
    name: 'Độc Căn',
    description: 'Độc khí Mộc rễ sâu — mỗi tầng gặm nhấm theo sức mạnh nguyên tố.',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'doc_can.dot',
        type: 'damage',
        element: 'wood',
        damageProfile: 'legacy_dot',
        coefficient: 0.2,
        scaling: 'dynamic',
        timing: 'holder_turn_end',
        stackScaling: 'multiply',
        canCrit: false,
        canMiss: false,
        hitCount: 1,
      },
    ],
    dispellable: true,
  },

  {
    id: 'liet_thuong',
    element: 'metal',
    name: 'Liệt Thương',
    description: 'Vết thương Kim rạch mở — mỗi tầng rỉ máu theo sức mạnh nguyên tố.',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'liet_thuong.dot',
        type: 'damage',
        element: 'metal',
        damageProfile: 'legacy_dot',
        coefficient: 0.2,
        scaling: 'dynamic',
        timing: 'holder_turn_end',
        stackScaling: 'multiply',
        canCrit: false,
        canMiss: false,
        hitCount: 1,
      },
    ],
    dispellable: true,
  },

  {
    id: 'han_tuc',
    element: 'water',
    name: 'Hàn Tức',
    description: 'Hàn khí Thủy thấm vào tứ chi — mỗi tầng đông lạnh theo sức mạnh nguyên tố.',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'han_tuc.dot',
        type: 'damage',
        element: 'water',
        damageProfile: 'legacy_dot',
        coefficient: 0.25,
        scaling: 'dynamic',
        timing: 'holder_turn_end',
        stackScaling: 'multiply',
        canCrit: false,
        canMiss: false,
        hitCount: 1,
      },
    ],
    dispellable: true,
  },

  // tran_an -- PURE stacking setup state (reaction-system spec sec.5):
  // no standalone mechanics, feeds reactions only.
  {
    id: 'tran_an',
    element: 'earth',
    name: 'Trấn Ấn',
    description: 'Ấn ký Thổ trấn giữ mục tiêu — chồng tầng chờ phản ứng nguyên tố.',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    dispellable: true,
  },

  // Plans/EarthPath muc VI - "Troi Chan": Root.
  {
    id: 'troi_chan',
    element: 'earth',
    name: 'Trói Chân',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 2.5, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    controls: [{ type: 'root' }],
    dispellable: true,
  },



  {
    id: 'choang',
    name: 'Choáng',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 1.5, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    controls: [{ type: 'stun' }],
    dispellable: true,
  },

  {
    id: 'dong_bang',
    name: 'Đóng Băng',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 2, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    controls: [{ type: 'freeze' }],
    dispellable: true,
  },

  // Phap Tu (Thuy Tu, 2026-08-15) - giu Lam Cham LIEN TUC du
  // convertsAfterContinuousTurns thi tu chuyen thanh Dong Bang (the
  // legacy registry converter already normalized seconds->turns at
  // load - the field is authored as turns directly now).
  {
    id: 'lam_cham',
    name: 'Làm Chậm',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 4, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    statModifiers: [{ stat: 'speed', percent: -0.3 }],
    convertsToId: 'dong_bang',
    convertsAfterContinuousTurns: 2,
    dispellable: true,
  },

  // Han Khi (Chill) - STACK toi 5 lan thi tu chuyen thanh Dong Bang.
  {
    id: 'han_khi',
    name: 'Hàn Khí',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 3, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    statModifiers: [{ stat: 'speed', percent: -0.06 }],
    convertsToId: 'dong_bang',
    convertsAtStackCap: true,
    dispellable: true,
  },

  // Cuong Bao (Haste).
  {
    id: 'cuong_bao',
    name: 'Cuồng Bạo',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 5, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    statModifiers: [{ stat: 'speed', percent: 0.25 }],
    dispellable: true,
  },

  // Suy Nhuoc (Frailty) - debuff phong ngu.
  {
    id: 'suy_nhuoc',
    name: 'Suy Nhược',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 5, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    statModifiers: [{ stat: 'defense', percent: -0.25 }],
    dispellable: true,
  },

  // Uy Ap (Dread) - debuff sat thuong gay ra.
  {
    id: 'uy_ap',
    name: 'Uy Áp',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 5, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    statModifiers: [{ stat: 'might', percent: -0.2 }],
    dispellable: true,
  },

  // Giap Ran (Phap Tu Kim Tu, 2026-08-15) - tru THANG metalResistance
  // (flat, khong phai percent).
  {
    id: 'giap_ran',
    name: 'Giáp Rạn',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 5, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    statModifiers: [{ stat: 'metalResistance', flat: -15 }],
    dispellable: true,
  },

  // Van Kiem Vu (Kiem Tu, 2026-08-15) - "mua kiem 9 giay toan man hinh,
  // bo qua 10%-90% giap/khang theo canh gioi" - armorIgnorePercentByRealm
  // -> periodic tags 'armor_ignore_by_realm' (request forward-carrier).
  {
    id: 'van_kiem_vu',
    name: 'Vạn Kiếm Vũ',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 9, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'van_kiem_vu.dot',
        type: 'damage',
        element: 'metal',
        damageProfile: 'legacy_dot',
        coefficient: 2,
        scaling: 'dynamic',
        timing: 'holder_turn_end',
        stackScaling: 'multiply',
        canCrit: false,
        canMiss: false,
        hitCount: 1,
        tags: ['armor_ignore_by_realm'],
      },
    ],
    dispellable: true,
  },
]
