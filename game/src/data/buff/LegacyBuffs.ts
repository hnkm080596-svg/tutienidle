import type { BuffDefinition } from '@/core/buff2/BuffDefinition'

// buff2 migration (megaplan M4) — mechanical per M1 mapping:
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
  // Pháp Tu (Thổ Tu, 2026-08-15) — Thạch Giáp Trận (special skill,
  // xem data/skill/Skills.ts) tự buff wardMax tạm thời lên bản thân,
  // tái dùng effect 'buff' có sẵn (zero plumbing mới).
  // The Tu Reimagined (spec 2026-09-15 T12): generic thorns stat retired —
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

  // Thổ Tu ("Độc Thế" reaction, Thổ+Mộc, Plans/EarthPath mục VII,
  // 2026-08-21) — KHÔNG có `duration` (permanent, xem BuffSystem.
  // update()'s `remainingTime === undefined` guard — Buff này KHÔNG tự
  // hết hạn, chỉ tích/giữ nguyên tới hết trận) — port thành
  // `duration: Infinity` (xem BuffSystem.test.ts's "buff gần như vĩnh
  // viễn"). `percent` nhân với `stacks` ở StatCalculator.runPipeline() —
  // đúng "+5%/tầng, tối đa 5 tầng = +25%". Plans/magicpathgeneral Phase
  // 7/8 (2026-08-21) — đổi tên hiển thị "Độc Thế" -> "Độc Căn" (id GIỮ
  // NGUYÊN 'doc_the', xem ElementReaction.ts's `appliesBuffId:
  // 'doc_the'`): plan định nghĩa rõ "Độc Căn" LÀ Reaction Reward Buff
  // cấp cho CASTER khi Mộc+Thổ reaction thành công (buff NÀY, đúng y
  // hệt), còn "Mộc Thế" là Pure Buff riêng của Mộc (xem
  // data/progression/PhapTuNodes.ts's WOOD_TRUC_CO_PURE) — 2 tên trước
  // đây bị đảo ngược. Phase 11 — "+2% HP Recovery từ Poison Damage"/tầng
  // (từng bị hoãn ở EarthPath vì DoT tick chưa resolve được entity
  // NGUỒN). stat-system-reimagined Task 4 (D18): the bespoke
  // poisonRecoveryPercent stat retired; the heal is now an authored
  // 'dot_recovery' capability on this buff — CombatSystem.applyDotDamage()
  // reads it via dotRecoveryTriggers() (A8: generic grant, no
  // content-ID check), the recovered HP scales with the receiver's
  // healingEffectivenessPercent.
  {
    id: 'doc_the',
    name: 'Độc Căn',
    description:
      'Độc trên mục tiêu chuyển hóa thành sức mạnh của bản thân — mỗi tầng tăng Sát Thương Độc + hồi máu từ Trúng Độc, tối đa 5 tầng.',
    kind: 'buff',
    polarity: 'buff',
    element: 'wood',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'permanent', scaling: 'fixed' },
    statModifiers: [{ stat: 'ailmentPotencyPercent', percent: 0.05 }],
    capabilities: [
      {
        id: 'doc_the.dot_recovery',
        type: 'dot_recovery',
        payload: { element: 'wood', healPercent: 0.02 },
      },
    ],
    dispellable: false,
  },

  // Spec 2026-08-30-phap-tu-dao-sac §4 — 2 buff nguồn của 2 reaction
  // sinh mới (Ngưng Lộ Kim+Thủy / Khai Sơn Thổ+Kim), mirror pattern
  // doc_the (stack + refresh, modifiers % hoặc flat).
  {
    id: 'ngung_lo',
    name: 'Ngưng Lộ',
    description: 'Sương ngưng trên thép hóa dòng suối tinh khiết — hồi Pháp Lực nhanh hơn.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 6, scaling: 'ailment_scaled' },
    statModifiers: [
      // Task 3 (D17): MP pool stat — declare the phap_tu credential so
      // the Task-7 domain gate keeps accepting this grant.
      { stat: 'manaRegenPerTurn', flat: 5, domain: 'phap_tu' },
    ],
    dispellable: false,
  },
  {
    id: 'khai_son',
    name: 'Khai Sơn',
    description: 'Mỏ kim loại lộ ra từ núi bật gốc — thân thể cứng như quặng.',
    kind: 'buff',
    polarity: 'buff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 3, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 6, scaling: 'ailment_scaled' },
    statModifiers: [{ stat: 'defense', percent: 0.08 }],
    dispellable: false,
  },

  // --- Ported from data/ailment/ailments.ts (Task 7, Unified Buff
  // System, 2026-09-01) — field-for-field, no balance changes. ---

  // Pháp Tu Thuần Hệ (spec 2026-09-03 §2.1/§7, N1 đã duyệt) — `bong`
  // ĐỔI refresh → stack max 5, dpsRatio 0.3 → 0.15/tầng: "chồng Thiêu
  // Đốt" của chuỗi Hỏa (A/B/C đắp, D kích nổ ×stack) mới có nghĩa.
  // 1 tầng yếu hơn bản cũ, 5 tầng = 0.75 mạnh hơn. Ảnh hưởng Bạo Viêm/
  // Hỏa Cầu cũ — chấp nhận theo N1 (dev phase, không migration).
  {
    id: 'bong',
    element: 'fire',
    name: 'Bỏng',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 4, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'bong.dot',
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

  // Plans/PoisonPath mục 5 (2026-08-21) — chốt số liệu baseline: duration
  // 6->5, dpsRatio 0.15->0.2 ("Poison Damage: 20% Skill Power/tick").
  {
    id: 'trung_doc',
    element: 'wood',
    name: 'Trúng Độc',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 5, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'trung_doc.dot',
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

  // Pháp Tu (Kim Tu, 2026-08-15) — element 'metal' (đổi từ 'physical').
  // Plans/KimPath mục 3 (2026-08-21) — maxStacks 3->5.
  {
    id: 'chay_mau',
    element: 'metal',
    name: 'Chảy Máu',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 5, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 5, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'chay_mau.dot',
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
    id: 'te_cong',
    element: 'water',
    name: 'Tê Cóng',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 4, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'te_cong.dot',
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

  {
    id: 'hoai_tu',
    element: 'earth',
    name: 'Hoại Tử',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 4, onReapplyStacks: 'add', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 8, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'hoai_tu.dot',
        type: 'damage',
        element: 'earth',
        damageProfile: 'legacy_dot',
        coefficient: 0.1,
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

  // Thổ Tu — Thạch Hóa: 'modifier' (-30% evasionRate) + on-hit-proc
  // (50% cơ hội áp 'choang' mỗi đòn đánh trúng) — CẢ HAI cùng 1
  // definition, port thành statModifier + 'on_hit_proc' capability
  // (CombatProcSystem owns the roll at the hit seam).
  {
    id: 'thach_hoa',
    element: 'earth',
    name: 'Thạch Hóa',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 4, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    statModifiers: [{ stat: 'evasionRate', percent: -0.3 }],
    capabilities: [
      {
        id: 'thach_hoa.on_hit',
        type: 'on_hit_proc',
        payload: { chance: 0.5, appliesBuffId: 'choang' },
      },
    ],
    dispellable: true,
  },

  // Plans/EarthPath mục VI — "Trói Chân": Root.
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

  // Plans/EarthPath mục V — "Dung Nham".
  {
    id: 'dung_nham',
    element: 'fire',
    name: 'Dung Nham',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 4, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'dung_nham.dot',
        type: 'damage',
        element: 'fire',
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

  // Plans/KimPath mục 6 (2026-08-21) — "Huyết Độc": hợp nhất Trúng
  // Độc + Chảy Máu.
  {
    id: 'huyet_doc',
    element: 'metal',
    name: 'Huyết Độc',
    kind: 'ailment',
    polarity: 'debuff',
    instanceScope: 'per_source',
    stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' },
    lifetime: { clock: 'holder_turns', duration: 5, scaling: 'ailment_scaled' },
    application: { resistance: 'ailment' },
    periodic: [
      {
        id: 'huyet_doc.dot',
        type: 'damage',
        element: 'metal',
        damageProfile: 'legacy_dot',
        coefficient: 0.3,
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

  // Pháp Tu (Thủy Tu, 2026-08-15) — giữ Làm Chậm LIÊN TỤC đủ
  // convertsAfterContinuousTurns thì tự chuyển thành Đóng Băng (the
  // legacy registry converter already normalized seconds->turns at
  // load — the field is authored as turns directly now).
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

  // Hàn Khí (Chill) — STACK tới 5 lần thì tự chuyển thành Đóng Băng.
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

  // Cuồng Bạo (Haste).
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

  // Suy Nhược (Frailty) — debuff phòng ngự.
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

  // Uy Áp (Dread) — debuff sát thương gây ra.
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

  // Giáp Rạn (Pháp Tu Kim Tu, 2026-08-15) — trừ THẲNG metalResistance
  // (flat, không phải percent).
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

  // Vạn Kiếm Vũ (Kiếm Tu, 2026-08-15) — "mưa kiếm 9 giây toàn màn hình,
  // bỏ qua 10%-90% giáp/kháng theo cảnh giới" — armorIgnorePercentByRealm
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
