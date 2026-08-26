import type { AilmentTemplate } from '@/core/ailment/AilmentRegistry'

// 6 DoT (1 mỗi hành + Vật Lý) + 3 CC — số liệu khởi điểm hợp lý, cần
// tinh chỉnh qua playtest, không phải số chốt cứng.
export const ailments: AilmentTemplate[] = [
  {
    id: 'bong',
    name: 'Bỏng',
    category: 'dot',
    duration: 4,
    stackMode: 'refresh',
    element: 'fire',
    dpsRatio: 0.3,
  },
  // Plans/PoisonPath mục 5 (2026-08-21) — chốt số liệu baseline: duration
  // 6->5, dpsRatio 0.15->0.2 ("Poison Damage: 20% Skill Power/tick").
  {
    id: 'trung_doc',
    name: 'Trúng Độc',
    category: 'dot',
    duration: 5,
    stackMode: 'stack',
    maxStacks: 5,
    element: 'wood',
    dpsRatio: 0.2,
  },
  // Pháp Tu (Kim Tu, 2026-08-15) — đổi element 'physical' -> 'metal'
  // (unused ở nơi khác trước đó, xác nhận qua grep — an toàn retag)
  // để khớp Kim Tu's build-around-stat (metalPower/metalPenetration),
  // đúng ý "gây xuất huyết" của Kim thay vì chỉ Vật Lý chung chung.
  // Plans/KimPath mục 3 (2026-08-21) — maxStacks 3->5 ("Max: 5 tầng"),
  // duration/dpsRatio giữ nguyên (đã khớp sẵn "5s"/"20% Skill Power/tick").
  {
    id: 'chay_mau',
    name: 'Chảy Máu',
    category: 'dot',
    duration: 5,
    stackMode: 'stack',
    maxStacks: 5,
    element: 'metal',
    dpsRatio: 0.2,
  },
  {
    id: 'te_cong',
    name: 'Tê Cóng',
    category: 'dot',
    duration: 4,
    stackMode: 'refresh',
    element: 'water',
    dpsRatio: 0.25,
  },
  {
    id: 'te_dien',
    name: 'Tê Điện',
    category: 'dot',
    duration: 3,
    stackMode: 'refresh',
    element: 'metal',
    dpsRatio: 0.35,
  },
  {
    id: 'hoai_tu',
    name: 'Hoại Tử',
    category: 'dot',
    duration: 8,
    stackMode: 'stack',
    maxStacks: 4,
    element: 'earth',
    dpsRatio: 0.1,
  },
  // Plans/EarthPath mục III (2026-08-21) — trạng thái nền của Thổ,
  // vẫn là Reaction enabler (Dung Nham/Trói Chân/Độc Thế), xem
  // data/element/ElementReaction.ts. Plans/magicpathgeneral Phase 1
  // (2026-08-21) từng thêm category 'alignment' riêng cho ailment
  // này (marker rỗng, 0 hiệu ứng). Người dùng phản hồi CÙNG NGÀY (sau
  // khi thêm on-hit-proc bên dưới): mọi ailment đóng vai trò Alignment
  // PHẢI tự mang tác dụng cơ chế thật, không được là marker rỗng —
  // category 'alignment' bị xoá hẳn (xem AilmentTypes.ts), Thạch Hóa
  // quay lại 'modifier' + có statModifiers THẬT: -30% evasionRate
  // ("đá hóa thì không né được" — thân cứng như đá, mất khả năng
  // tránh né), số liệu minh hoạ cùng biên độ -20%~-30% với các modifier
  // debuff khác (suy_nhuoc/uy_ap/lam_cham), cần playtest.
  // 2026-08-21 (yêu cầu người dùng trước đó, cùng ngày) — CỘNG THÊM:
  // trong lúc active, MỖI ĐÒN ĐÁNH TRÚNG mục tiêu có 50% cơ hội Choáng
  // (tái dùng ailment 'choang' có sẵn thay vì tạo hiệu ứng/thời lượng
  // riêng — xem AilmentSystem.rollOnHitEffects()). Target mang Thạch
  // Hóa hầu như luôn là mục tiêu ĐANG bị Thổ Cầu Thuật đánh trúng liên
  // tục (skill tự áp lại onHitChance=1 mỗi lần trúng).
  {
    id: 'thach_hoa',
    name: 'Thạch Hóa',
    category: 'modifier',
    duration: 4,
    stackMode: 'refresh',
    element: 'earth',
    statModifiers: [{ stat: 'evasionRate', percent: -0.3 }],
    onHitChance: 0.5,
    onHitAppliesAilmentId: 'choang',
  },
  // Plans/EarthPath mục VI — "Trói Chân": Root, chặn di chuyển nhưng
  // KHÔNG chặn attack/cast (khác Đóng Băng). Duration baseline 2.5s,
  // nhân thêm reactionEffectPercent lúc Reaction áp (xem
  // ReactionManager.ts), KHÔNG qua ailmentDurationPercent thường (đây
  // là ailment do REACTION sinh ra, không phải do skill trực tiếp áp).
  {
    id: 'troi_chan',
    name: 'Trói Chân',
    category: 'cc',
    duration: 2.5,
    stackMode: 'refresh',
    ccEffect: 'root',
  },
  // Plans/EarthPath mục V — "Dung Nham": DoT phần (Lava Zone AoE persistent
  // CHƯA làm — không có hạ tầng "vùng sát thương tồn tại độc lập theo vị
  // trí" nào trong engine hiện tại, xem ElementReaction.ts's ghi chú).
  // Số liệu dpsRatio/duration là ước lượng minh hoạ, cần playtest.
  {
    id: 'dung_nham',
    name: 'Dung Nham',
    category: 'dot',
    duration: 4,
    stackMode: 'refresh',
    element: 'fire',
    dpsRatio: 0.2,
  },
  // Plans/KimPath mục 6 (2026-08-21) — "Huyết Độc": Trúng Độc (Mộc) +
  // Chảy Máu (Kim) "hợp nhất thành một DoT mạnh hơn, KHÔNG chạy song
  // song 2 DoT độc lập" — tái dùng appliesAilmentId (đã xây cho Thổ:
  // Dung Nham/Trói Chân) thay vì dựng cơ chế "merge" thật, đơn giản hơn
  // nhiều và đạt đúng hiệu quả "consume 2, sinh 1 mạnh hơn". dpsRatio
  // cao hơn cả 2 nguồn (0.2/0.2) — số liệu minh hoạ, cần playtest.
  {
    id: 'huyet_doc',
    name: 'Huyết Độc',
    category: 'dot',
    duration: 5,
    stackMode: 'refresh',
    element: 'metal',
    dpsRatio: 0.3,
  },
  {
    id: 'choang',
    name: 'Choáng',
    category: 'cc',
    duration: 1.5,
    stackMode: 'refresh',
    ccEffect: 'stun',
  },
  {
    id: 'dong_bang',
    name: 'Đóng Băng',
    category: 'cc',
    duration: 2,
    stackMode: 'refresh',
    ccEffect: 'freeze',
  },
  // Pháp Tu (Thủy Tu, 2026-08-15) — thêm convertsAfterContinuousSeconds:
  // giữ Làm Chậm LIÊN TỤC (refresh không đứt quãng) đủ 2 giây thì tự
  // chuyển hẳn thành Đóng Băng (dùng lại convertsToOnMaxStacks làm
  // "ailment đích", xem AilmentRegistry.ts's ghi chú/AilmentSystem.
  // update()'s convertAilment()) — không ảnh hưởng nơi khác vì trước
  // đó KHÔNG ai dùng lam_cham (xác nhận qua grep).
  {
    id: 'lam_cham',
    name: 'Làm Chậm',
    category: 'modifier',
    duration: 4,
    stackMode: 'refresh',
    convertsToOnMaxStacks: 'dong_bang',
    convertsAfterContinuousSeconds: 2,
    statModifiers: [
      { stat: 'attackSpeed', percent: -0.3 },
      { stat: 'movementSpeed', percent: -0.3 },
    ],
  },

  // Hàn Khí (Chill) — nhẹ hơn Làm Chậm nhiều, nhưng STACK tới 5 lần
  // trong vòng đời của chính nó (mỗi lần trúng thì refresh + stack) sẽ
  // tự động biến thành Đóng Băng — xem AilmentSystem.apply().
  {
    id: 'han_khi',
    name: 'Hàn Khí',
    category: 'modifier',
    duration: 3,
    stackMode: 'stack',
    maxStacks: 5,
    convertsToOnMaxStacks: 'dong_bang',
    statModifiers: [
      { stat: 'attackSpeed', percent: -0.06 },
      { stat: 'movementSpeed', percent: -0.06 },
    ],
  },

  // Cuồng Bạo (Haste) — buff, dùng chung field `sourceId` để phân biệt
  // nguồn tự buff bản thân (buff effect) khỏi bị áp bởi đối phương.
  {
    id: 'cuong_bao',
    name: 'Cuồng Bạo',
    category: 'modifier',
    duration: 5,
    stackMode: 'refresh',
    statModifiers: [
      { stat: 'attackSpeed', percent: 0.25 },
      { stat: 'movementSpeed', percent: 0.15 },
    ],
  },

  // Suy Nhược (Frailty) — debuff phòng ngự.
  {
    id: 'suy_nhuoc',
    name: 'Suy Nhược',
    category: 'modifier',
    duration: 5,
    stackMode: 'refresh',
    statModifiers: [{ stat: 'defense', percent: -0.25 }],
  },

  // Uy Áp (Dread) — debuff sát thương gây ra.
  {
    id: 'uy_ap',
    name: 'Uy Áp',
    category: 'modifier',
    duration: 5,
    stackMode: 'refresh',
    statModifiers: [{ stat: 'attack', percent: -0.2 }],
  },

  // Giáp Rạn (Pháp Tu Kim Tu, 2026-08-15) — "giảm kháng": trừ THẲNG
  // metalResistance của target (flat, không phải percent — nền hành
  // Ngũ Hành đều = 0, percent trên 0 vẫn = 0, cùng gotcha đã ghi ở
  // nhiều chỗ khác, vd data/technique/Techniques.ts's xich_viem_combat).
  // Khuếch đại TOÀN BỘ sát thương Kim (kể cả của đồng đội/nguồn khác),
  // không riêng gì Kim Tu.
  {
    id: 'giap_ran',
    name: 'Giáp Rạn',
    category: 'modifier',
    duration: 5,
    stackMode: 'refresh',
    statModifiers: [{ stat: 'metalResistance', flat: -15 }],
  },

  // Vạn Kiếm Vũ (Kiếm Tu, 2026-08-15) — "mưa kiếm 9 giây toàn màn
  // hình, bỏ qua 10%-90% giáp/kháng theo cảnh giới". dpsRatio cao hẳn
  // so với 6 DOT thường (nộ kỹ, tốn hẳn 9999 Kiếm Ý mới kích hoạt được,
  // xem data/skill/Skills.ts's van_kiem_trieu_tong) —
  // armorIgnorePercentByRealm xem AilmentSystem.calculateDamagePerSecond().
  {
    id: 'van_kiem_vu',
    name: 'Vạn Kiếm Vũ',
    category: 'dot',
    duration: 9,
    stackMode: 'refresh',
    element: 'metal',
    dpsRatio: 2,
    armorIgnorePercentByRealm: true,
  },
]
