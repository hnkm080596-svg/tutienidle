import type { Skill } from '../../core/skill/Skill'

export const PHAP_TU_SKILLS: Skill[] = [
  // ==================================================================
  // Phap Tu Thuan He (spec 2026-09-03 2/3, Task 10) -- 20 skill chuoi
  // B/C/D/E + 5 Ultimate cua 5 than Son Hai Kinh, THAY 25 placeholder
  // id cu (chuc_dung_b...thanh_luy -- ten/id/so lieu DUNG bang spec,
  // N2b: khong hau to _b/_c). A la root hien co cua tung hanh
  // (hoa_cau_thuat / thuy_tien_thuat / doc_chuong / diem_kim_thuat /
  // tho_cau_thuat -- giu nguyen). Nhip 1.2: B cd2/cast1.0, C cd3/1.2,
  // D cd4/1.4, E cd6/1.8. Ngan sach dmg 1.3: B 1.1 . C 1.3 (0 neu
  // self-buff) . D 1.5 . E 2.4; moi damage mang manaScalingRatio
  // 0.001 + attributeScaling attunement 0.004 (nhu A). resourceType
  // 'none' (1.4); unlocked false, mo qua node chuoi (Task 11, 1.7 --
  // B-E KHONG requiredRealmId, realm gate o node + bang slot).
  // Bien the C/D = SkillSpecialization (effectsOverride/targetingOverride
  // theo node selectsSpecialization E-8 -- id specialization khop
  // specializationId trong PhapTuNodes.ts Task 11).
  // ==================================================================

  //  Chuoi CHUC DUNG (Hoa -- bung no don, 2.1): A/B/C chong Thieu
  // Dot (hoa_an stack -- N1), D detonates ALL hoa_an stacks, E nukes the whole row.
  {
    id: 'nam_minh_liet_hoa',
    name: 'Nam Minh Liệt Hỏa',
    description: 'Lửa Nam phương nối đuôi Hỏa Cầu — đắp thêm tầng Bỏng chồng lên mục tiêu.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.1,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'hoa_an', ailmentChance: 0.75 },
    ],
    resourceType: 'none',
  },
  {
    id: 'tam_muoi_chan_hoa',
    name: 'Tam Muội Chân Hỏa',
    description: 'Ba ngọn chân hỏa — đắp Bỏng mạnh; biến thể quyết định tụ hay tán.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.3,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'hoa_an', ailmentChance: 1 },
    ],
    // Bien the C (2.1) -- mua node selectsSpecialization la DOI HAN
    // hanh vi (E-8). 'tam_muoi_tu_diem': single + dap THEM 1 tang qua
    // add_stack (E-3 -- buff da chay moi cong, chua co = no-op; debuff
    // apply phia duoi dam bao co 1 tang khi roll trung).
    specializations: [
      {
        id: 'tam_muoi_tu_diem',
        name: 'Tam Muội · Tụ Diễm',
        description: 'Ba ngọn lửa tụ một điểm — đắp 2 tầng Bỏng mỗi cast.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.3,
            components: [{ kind: 'element', element: 'fire', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'hoa_an', ailmentChance: 1 },
          { type: 'add_stack', buffId: 'hoa_an', stacks: 1 },
        ],
      },
      {
        id: 'tam_muoi_tan_diem',
        name: 'Tam Muội · Tán Diễm',
        description: 'Lửa tán thành vùng — Bỏng phủ mọi mục tiêu xung quanh.',
        // Spec 2.1: Tan Diem la AoE -- base skill khong khai targeting
        // (single) nen specialization PHAI tu mang vung (laneRadius 1).
        targeting: { shape: 'square', laneRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 1,
            components: [{ kind: 'element', element: 'fire', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'hoa_an', ailmentChance: 0.7 },
        ],
      },
    ],
    resourceType: 'none',
  },
  {
    id: 'chuc_dung_dan_no',
    name: 'Chúc Dung Dẫn Nộ',
    description: 'Chúc Dung dẫn nộ — kích nổ TOÀN BỘ Bỏng trên mục tiêu thành true damage.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesAilmentId: 'hoa_an',
        damagePerStack: 35,
      },
    ],
    // Bien the D (2.1): Liet Bao = damagePerStack 50 burst toi da;
    // Du Hoa = 30 + ap lai 1 tang Bong SAU kich no (debuff effect chay
    // sau damage -- applyAll reorder damage truoc, debuff sau).
    specializations: [
      {
        id: 'dan_no_liet_bao',
        name: 'Dẫn Nộ · Liệt Bạo',
        description: 'Nộ hỏa bùng nổ — mỗi tầng Bỏng nổ mạnh hơn.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'fire', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
            consumesAilmentId: 'hoa_an',
            damagePerStack: 50,
          },
        ],
      },
      {
        id: 'dan_no_du_hoa',
        name: 'Dẫn Nộ · Dư Hỏa',
        description: 'Kích nổ xong còn than hồng — giữ Bỏng để lặp chuỗi nhanh.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'fire', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
            consumesAilmentId: 'hoa_an',
            damagePerStack: 30,
          },
          { type: 'debuff', buffId: 'hoa_an', ailmentChance: 1 },
        ],
      },
    ],
    resourceType: 'none',
  },
  {
    id: 'hoa_ha_cuu_thien',
    name: 'Hỏa Hà Cửu Thiên',
    description: 'Sông lửa đổ xuống chín tầng trời — nuke lan cả hàng, đòn kết chuỗi.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    targeting: { shape: 'line' },
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'hoa_an', ailmentChance: 1 },
    ],
    resourceType: 'none',
  },

  //  Chuoi THIEN NGO (Thuy -- kiem che + hoi, 2.2): B Te Cong, C hoi
  // Phap Luc (self), D troi + tu buff hap thu, E song can quet.
  {
    id: 'bat_dau_tran_thuy',
    name: 'Bát Đầu Trấn Thủy',
    description: 'Tám đầu Thiên Ngô trấn áp — đòn Thủy trầm ổn gây Tê Cóng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.1,
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'han_tuc', ailmentChance: 0.8 },
    ],
    resourceType: 'none',
  },
  {
    id: 'thanh_tuyen_duong_linh',
    name: 'Thanh Tuyền Dưỡng Linh',
    description: 'Suối thiêng Thanh Tuyền — nuôi Pháp Lực hồi nhanh trong chốc lát.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'thanh_tuyen' }],
    // Variant C (sec.2.2): Tuyen = stronger buff (+12 regen, 8s -
    // duration overridden on the effect; the turn engine reads
    // effect.duration ?? definition.duration); Bang Giap = swapped to a
    // defensive ward.
    specializations: [
      {
        id: 'duong_linh_tuyen',
        name: 'Dưỡng Linh · Tuyền',
        description: 'Mạch suối dồi dào — hồi Pháp Lực mạnh và lâu hơn.',
        effectsOverride: [{ type: 'buff', buffId: 'thanh_tuyen', duration: 8 }],
      },
      {
        id: 'duong_linh_bang_giap',
        name: 'Dưỡng Linh · Băng Giáp',
        description: 'Nước đóng băng giáp — Thủy thiên về phòng thủ.',
        effectsOverride: [{ type: 'buff', buffId: 'bang_giap' }],
      },
    ],
    resourceType: 'none',
  },
  {
    id: 'hoi_luu_thon_no',
    name: 'Hồi Lưu Thôn Nộ',
    description: 'Vòng nước cuốn hút — trói chân mục tiêu, sóng hồi lưu hấp thụ đòn đánh.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'troi_chan', ailmentChance: 0.7 },
      { type: 'buff', buffId: 'hoi_luu' },
    ],
    // Bien the D (2.2): Cam Tuc = troi chac 100%, bo hap thu; Hap Luu
    // = troi 50% nhung leech manh hon, lau hon.
    specializations: [
      {
        id: 'thon_no_cam_tuc',
        name: 'Thôn Nộ · Cấm Túc',
        description: 'Nước xiềng chặt chân — không lối thoát.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'water', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'troi_chan', ailmentChance: 1 },
        ],
      },
      {
        id: 'thon_no_hap_luu',
        name: 'Thôn Nộ · Hấp Lưu',
        description: 'Dòng hút xoáy sâu — sinh lực địch chảy về ta.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'water', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'troi_chan', ailmentChance: 0.5 },
          // Spec 2.2: leech +35%, 5s -- buff dinh nghia 0.20/tang, 2
          // tang = 0.40 (over-tuned); thay bang 1 tang + duration 5s
          // dung so lieu spec (xem ghi chu report).
          // Review round 1 (Finding 2) -- coordinator ruling: GIU 0.20
          // (hoi_luu = +0.20/stack refresh; +35% khong bieu dien duoc
          // neu khong them buff moi -- deviation co chu dich, da ghi
          // chu report).
          { type: 'buff', buffId: 'hoi_luu', duration: 5 },
        ],
      },
    ],
    resourceType: 'none',
  },
  {
    id: 'bac_hai_cuong_lan',
    name: 'Bắc Hải Cuồng Lan',
    description: 'Sóng Bắc Hải càn quét mọi dải cột — đòn kết chuỗi gây Tê Cóng diện rộng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    targeting: { shape: 'all_lanes', columnRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'han_tuc', ailmentChance: 1 },
    ],
    resourceType: 'none',
  },

  //  Chuoi CAU MANG (Moc -- nhiem doc lan, 2.3): B dap Trung Doc,
  // C re cam di chuyen, D LAN doc (E-1), E kich no + hut mau.
  {
    id: 'xuan_sanh_doc_duc',
    name: 'Xuân Sanh Độc Dực',
    description: 'Cánh độc Câu Mang vươn tới — đòn Xuân sinh đầy độc tố.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.1,
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'doc_can', ailmentChance: 1 },
    ],
    resourceType: 'none',
  },
  {
    id: 'cau_mang_can_tri',
    name: 'Câu Mang Căn Trì',
    description: 'Rễ Câu Mang mọc trùm mục tiêu — cấm di chuyển, độc ngấm sâu.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.3,
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'troi_chan', ailmentChance: 0.8 },
      { type: 'debuff', buffId: 'doc_can', ailmentChance: 0.6 },
    ],
    // Bien the C (2.3): Cam Bo = root BAN DAI (buff rieng cau_mang_can
    // 4s, troi_chan 100%), bo doc; Tham Doc = bo root, dap +2 tang doc.
    specializations: [
      {
        id: 'can_tri_cam_bo',
        name: 'Căn Trì · Cấm Bộ',
        description: 'Rễ xiết chặt — mục tiêu không nhúc nhích nổi.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.3,
            components: [{ kind: 'element', element: 'wood', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'troi_chan', ailmentChance: 1 },
          { type: 'debuff', buffId: 'cau_mang_can', ailmentChance: 1 },
        ],
      },
      {
        id: 'can_tri_tham_doc',
        name: 'Căn Trì · Thâm Độc',
        description: 'Độc ngấm tận rễ — Trúng Độc chồng sâu hơn.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.3,
            components: [{ kind: 'element', element: 'wood', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'doc_can', ailmentChance: 1 },
          { type: 'add_stack', buffId: 'doc_can', stacks: 2 },
        ],
      },
    ],
    resourceType: 'none',
  },
  {
    id: 'van_moc_lan_doc',
    name: 'Vạn Mộc Lan Độc',
    // Three-path design (2026-09-25, ruling R5) -- the Trung Doc spread
    // claim was never implemented; effects deal primary_target damage only.
    description: 'Rừng cây lan độc — một đòn Mộc nặng vào mục tiêu chính.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    targeting: { shape: 'square', laneRadius: 1, columnRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        scope: 'primary_target',
      },
    ],
    // Bien the D (2.3): Quang = all_lanes spread 50%; Tham = area
    // spread 100% + refresh duration primary.
    specializations: [
      {
        id: 'lan_doc_quang',
        name: 'Lan Độc · Quảng',
        description: 'Độc theo gió bay khắp chiến trường.',
        // Spec 2.3: Quang = all_lanes columnRadius 1.
        targeting: { shape: 'all_lanes', columnRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'wood', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
            scope: 'primary_target',
          },
        ],
      },
      {
        id: 'lan_doc_tham',
        name: 'Lan Độc · Thâm',
        description: 'Độc ngấm thấu xương — lan trọn vẹn, giữ chân nguồn.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'wood', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
            scope: 'primary_target',
          },
        ],
      },
    ],
    resourceType: 'none',
  },
  {
    id: 'doc_vien_bao_can',
    name: 'Độc Viên Bạo Căn',
    description: 'Vườn độc nổ rễ trăm trượng — kích nổ Trúng Độc, hút sinh lực hồi bản thân.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesAilmentId: 'doc_can',
        damagePerStack: 30,
        healPercentOfDamage: 0.4,
      },
    ],
    resourceType: 'none',
  },

  //  Chuoi NHUC THU (Kim -- nghien nat kim loai, KHONG kiem phap,
  // 2.4): B Kim Giap tu buff, C Kim Lang bao vun AoE, D Kim Chung
  // khuech dai Xuat Huyet (add_stack E-3), E Kim Luan kich no.
  {
    id: 'thu_giap_kim_than',
    name: 'Thu Giáp Kim Thân',
    description: 'Thu sát ngưng thành giáp thép — tự hoá kim, dày phòng thủ, gai phản đòn.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'kim_giap' }],
    resourceType: 'none',
  },
  {
    id: 'kim_lang_toan_phong',
    name: 'Kim Lang Toàn Phong',
    description: 'Bão vụn thép xoáy quanh — Xuất Huyết phủ mọi kẻ địch trong vùng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'enemy',
    targeting: { shape: 'square', laneRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 1.2,
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'liet_thuong', ailmentChance: 0.6 },
    ],
    // Bien the C (2.4): Toan Vuc = AoE vuong rong hon dmg 1.0 bleed
    // 50%; Xuyen Liet = line dmg 1.4 bleed 80%.
    specializations: [
      {
        id: 'kim_lang_toan_vuc',
        name: 'Kim Lang · Toàn Vực',
        description: 'Vụn thép phủ trọn một vùng.',
        // Spec 2.4: Toan Vuc = area laneRadius 1 columnRadius 1.
        targeting: { shape: 'square', laneRadius: 1, columnRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 1,
            components: [{ kind: 'element', element: 'metal', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'liet_thuong', ailmentChance: 0.5 },
        ],
      },
      {
        id: 'kim_lang_xuyen_liet',
        name: 'Kim Lang · Xuyên Liệt',
        description: 'Lưỡi bão xuyên thẳng một hàng.',
        // Spec 2.4: Xuyen Liet = line.
        targeting: { shape: 'line' },
        effectsOverride: [
          {
            type: 'damage',
            value: 1.4,
            components: [{ kind: 'element', element: 'metal', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'liet_thuong', ailmentChance: 0.8 },
        ],
      },
    ],
    resourceType: 'none',
  },
  {
    id: 'kim_chung_cong_huong',
    name: 'Kim Chung Cộng Hưởng',
    description: 'Chuông thép Nhục Thu rung — cộng hưởng khuếch đại Xuất Huyết trên mục tiêu.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      // add_stack chay SAU damage (applyAll reorder) -- buff da chay moi
      // cong (E-3), chua co = no-op.
      { type: 'add_stack', buffId: 'liet_thuong', stacks: 2, refresh: true },
    ],
    // Bien the D (2.4): Tich Huyet = +3 khong choang; Chan Huyet = +1
    // kem 30% Choang.
    specializations: [
      {
        id: 'cong_huong_tich_huyet',
        name: 'Cộng Hưởng · Tích Huyết',
        description: 'Tiếng chuông dồn máu — Xuất Huyết chồng chất.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'metal', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'add_stack', buffId: 'liet_thuong', stacks: 3, refresh: true },
        ],
      },
      {
        id: 'cong_huong_chan_huyet',
        name: 'Cộng Hưởng · Chấn Huyết',
        description: 'Chuông chấn đến choáng váng.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.5,
            components: [{ kind: 'element', element: 'metal', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'add_stack', buffId: 'liet_thuong', stacks: 1, refresh: true },
          { type: 'debuff', buffId: 'choang', ailmentChance: 0.3 },
        ],
      },
    ],
    resourceType: 'none',
  },
  {
    id: 'kim_luan_tran_ap',
    name: 'Kim Luân Trấn Áp',
    description: 'Đĩa thép khổng lồ đè nghiền — kích nổ TOÀN BỘ Xuất Huyết (đòn kết chuỗi).',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesAilmentId: 'liet_thuong',
        damagePerStack: 40,
      },
    ],
    resourceType: 'none',
  },

  //  Chuoi HAU THO (Tho -- phong tuyen, 2.5): B Thach Hoa + chan,
  // C cot dat do don (self ward), D chan dia AoE, E nhot + no khien.
  {
    id: 'hau_tho_tran_ach',
    name: 'Hậu Thổ Trấn Ách',
    description: 'Đá thiêng trấn ải — Thạch Hóa thân địch, chấn động làm choáng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 2,
    castTime: 1,
    execution: { kind: 'cast_time', castTime: 1 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 1.1,
        components: [{ kind: 'element', element: 'earth', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'tran_an', ailmentChance: 0.7 },
      { type: 'debuff', buffId: 'choang', ailmentChance: 0.2 },
    ],
    resourceType: 'none',
  },
  {
    id: 'dia_tru_thua_thien',
    name: 'Địa Trụ Thừa Thiên',
    description: 'Cột đất thiêng đỡ trời — khiên hộ thể dày thêm, phản đòn.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 3,
    castTime: 1.2,
    execution: { kind: 'cast_time', castTime: 1.2 },
    target: 'self',
    effects: [{ type: 'buff', buffId: 'dia_tru' }],
    // Bien the C (2.5, review round 1): Bich = khien THUAN nuoi E no
    // to (buff rieng dia_tru_bich +100 ward/+8 regen);
    // Thu = phan don (buff rieng dia_tru_thu +40 ward/+25% Khien No --
    // generic thorns stat retired, spec 2026-09-15 T12).
    // Khong muon bang_giap/kim_giap -- sai so lieu + dung ten da hanh.
    specializations: [
      {
        id: 'dia_tru_bich',
        name: 'Địa Trụ · Bích',
        description: 'Tường đất vững chãi — khiên dày để dồn cho đòn chót.',
        effectsOverride: [{ type: 'buff', buffId: 'dia_tru_bich' }],
      },
      {
        id: 'dia_tru_thu',
        name: 'Địa Trụ · Thứ',
        description: 'Đất hóa gai nhọn — ai chạm vào cũng đau.',
        effectsOverride: [{ type: 'buff', buffId: 'dia_tru_thu' }],
      },
    ],
    resourceType: 'none',
  },
  {
    id: 'con_lon_chan_dia',
    name: 'Côn Lôn Chấn Địa',
    description: 'Chấn địa Côn Lôn — mọi kẻ đứng trên đất rung chuyển choáng váng.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 4,
    castTime: 1.4,
    execution: { kind: 'cast_time', castTime: 1.4 },
    target: 'enemy',
    targeting: { shape: 'square', laneRadius: 1, columnRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 1.5,
        components: [{ kind: 'element', element: 'earth', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'choang', ailmentChance: 0.4 },
    ],
    // Bien the D (2.5): Tran = single dmg 1.7 choang 70%; Quang =
    // area laneRadius 2 dmg 1.3 choang 25%.
    specializations: [
      {
        id: 'chan_dia_tran',
        name: 'Chấn Địa · Trấn',
        description: 'Trấn xuống đúng một điểm — chấn động tê liệt.',
        effectsOverride: [
          {
            type: 'damage',
            value: 1.7,
            components: [{ kind: 'element', element: 'earth', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'choang', ailmentChance: 0.7 },
        ],
      },
      {
        id: 'chan_dia_quang',
        name: 'Chấn Địa · Quảng',
        description: 'Động đất lan rộng — choáng nhẹ nhưng trúng nhiều.',
        // Spec 2.5: Quang = area laneRadius 2 columnRadius 1.
        targeting: { shape: 'square', laneRadius: 2, columnRadius: 1 },
        effectsOverride: [
          {
            type: 'damage',
            value: 1.3,
            components: [{ kind: 'element', element: 'earth', ratio: 1 }],
            manaScalingRatio: 0.001,
            attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
          },
          { type: 'debuff', buffId: 'choang', ailmentChance: 0.25 },
        ],
      },
    ],
    resourceType: 'none',
  },
  {
    id: 'cuu_tru_dia_lao',
    name: 'Cửu Trù Địa Lao',
    description: 'Ngục đất nhốt mục tiêu — trói chân, nổ toàn bộ khiên thành sát thương.',
    type: 'active',
    level: 1,
    maxLevel: 10,
    cooldown: 6,
    castTime: 1.8,
    execution: { kind: 'cast_time', castTime: 1.8 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 2.4,
        components: [{ kind: 'element', element: 'earth', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesWardForDamage: true,
        damagePerWardPoint: 1.5,
      },
      { type: 'debuff', buffId: 'troi_chan', ailmentChance: 1 },
    ],
    resourceType: 'none',
  },

  //  5 ULTIMATE Thuan he (spec 3) -- The day 100 (+bonus) -> reset 0.
  // buildTag 'ult' - presentation-only label; these 5 defs are empowerment
  // payload (god-ult identity), not a root role. cooldown 0, cast
  // 1.5s, unlocked false (mo qua node ult -- Task 11). Damage value
  // 4.0 chuan; hieu ung dac trung per-element qua engine E-1..E-6.
  {
    id: 'tat_phuong_giang_the',
    name: 'Tất Phương Giáng Thế',
    description: 'Điểu hỏa một chân giáng thế — lửa phủ mọi dải cột, để lại vùng cháy sáu nhịp.',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    targeting: { shape: 'all_lanes', columnRadius: 1 },
    effects: [
      {
        type: 'damage',
        value: 4,
        components: [{ kind: 'element', element: 'fire', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'hoa_an', ailmentChance: 1 },
    ],
    resourceType: 'none',
    buildTag: 'ult',
  },
  {
    id: 'bat_thu_can_quet',
    name: 'Bát Thủ Càn Quét',
    description: 'Tám đầu Thiên Ngô dâng tám đợt sóng — càn quét mọi địch, gột rửa tối đa 8 debuff trên thân.',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    targeting: { shape: 'all_lanes' },
    effects: [
      {
        type: 'damage',
        // Authored hitCount x8 folded into the multiplier (0.6 x 8):
        // the turn engine resolves one hit, not eight (Task 13 strip).
        value: 4.8,
        components: [{ kind: 'element', element: 'water', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'han_tuc', ailmentChance: 1 },
    ],
    resourceType: 'none',
    buildTag: 'ult',
  },
  {
    id: 'kien_moc_thong_thien',
    name: 'Kiến Mộc Thông Thiên',
    description: 'Rễ trăm trượng nối trời đất — trói và nhiễm độc mọi địch, vườn độc sáu nhịp.',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    targeting: { shape: 'all_lanes' },
    effects: [
      {
        type: 'damage',
        value: 4,
        components: [{ kind: 'element', element: 'wood', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'troi_chan', ailmentChance: 1 },
      { type: 'debuff', buffId: 'doc_can', ailmentChance: 1 },
      { type: 'add_stack', buffId: 'doc_can', stacks: 2 },
    ],
    resourceType: 'none',
    buildTag: 'ult',
  },
  {
    id: 'kim_phat_thu_sat',
    name: 'Kim Phạt Thu Sát',
    description: 'Thu là mùa hình phạt — đĩa thép đè nghiền ĐÚNG một mục tiêu (ưu tiên boss), nổ toàn bộ Xuất Huyết, sát thương dư không tràn.',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    effects: [
      {
        type: 'damage',
        value: 6,
        components: [{ kind: 'element', element: 'metal', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
        consumesAilmentId: 'liet_thuong',
        damagePerStack: 80,
      },
    ],
    resourceType: 'none',
    buildTag: 'ult',
  },
  {
    id: 'hau_tho_thanh_luy',
    name: 'Hậu Thổ Thành Lũy',
    description: 'Thành đất thiêng vây khốn mọi địch — mỗi kẻ bị nhốt thêm 6% phòng thủ, tối đa 8 tầng.',
    type: 'active',
    level: 1,
    maxLevel: 5,
    cooldown: 0,
    castTime: 1.5,
    execution: { kind: 'cast_time', castTime: 1.5 },
    target: 'enemy',
    targeting: { shape: 'all_lanes' },
    effects: [
      {
        type: 'damage',
        value: 4,
        components: [{ kind: 'element', element: 'earth', ratio: 1 }],
        manaScalingRatio: 0.001,
        attributeScaling: [{ attributes: ['attunement'], ratioPerPoint: 0.004 }],
      },
      { type: 'debuff', buffId: 'troi_chan', ailmentChance: 1 },
      { type: 'buff', buffId: 'thanh_luy' },
    ],
    resourceType: 'none',
    buildTag: 'ult',
  },
]
