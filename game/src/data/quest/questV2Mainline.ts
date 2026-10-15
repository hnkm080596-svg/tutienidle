import type { QuestV2Definition } from './questV2Types'

// Authored design, deliberately not registered or adapted to the V1 engine.
// CTA strings are suggestions, not implemented routes. Reward values are base.
export const QUEST_V2_MAINLINE = [
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_01',
    designId: 'V2-01',
    name: 'Lâm Khí Khác Thường',
    description:
      'Thu mới 3 Thập Niên Linh Mộc từ sản xuất hoặc chiến lợi phẩm; đánh bại 1 Dã Trư đang phá rừng.',
    story: {
      opening:
        'Thanh Vân Lâm từng ngát hương gỗ mục; hôm nay những vết đen trên vỏ cây lại ấm như than. Nếu muốn hiểu nguồn khí lạ, trước hết hãy đem về mẫu vật còn tươi.',
      ending:
        'Trong thớ gỗ có một sợi nhiệt khí. Đàn trư hẳn đã uống phải nguồn nước chảy qua vết nứt.',
    },
    ctaSuggestions: ['Đến Sản Xuất', 'Đi Thanh Vân 1-1', 'Nhận thưởng'],
    cadence: 'once',
    chainId: 'mainline',
    admission: {
      minRealmAttained: 'mortal',
      predecessor: 'claimed',
    },
    rewardBand: 'mortal',
    reward: {
      spiritStone: 12,
      cultivation: 20,
      skillInsight: 0,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_01:o1',
          kind: 'acquire',
          evidence: 'distinct_committed_receipt_after_activation',
          materialId: 'material_spirit_wood_decade',
          amount: 3,
          source: 'any',
          quantity: 'delivered',
          consumeAtClaim: false,
        },
        {
          objectiveId: 'tvdm2_main_01:o2',
          kind: 'kill',
          evidence: 'distinct_committed_receipt_after_activation',
          enemyId: 'mortal_wild_boar',
          amount: 1,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_02',
    designId: 'V2-02',
    name: 'Vết Móng Hung Trư',
    description: 'Hạ 3 Dã Trư và nâng nhân vật đến Phàm Nhân tầng 3.',
    story: {
      opening:
        'Vết móng sâu hằn trên thân cây bị cháy. Dã trư húc đổ cả gốc cổ mộc, nhưng chúng tránh một mạch đá ở giữa rừng.',
      ending:
        'Càng mạnh hơn, ngươi càng cảm thấy nhiệt khí luồn dưới lòng đất chứ không đến từ mặt trời.',
    },
    ctaSuggestions: ['Chiến đấu', 'Tu luyện'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_01',
    admission: {
      minRealmAttained: 'mortal',
      predecessor: 'claimed',
    },
    rewardBand: 'mortal',
    reward: {
      spiritStone: 15,
      cultivation: 35,
      skillInsight: 0,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_02:o1',
          kind: 'kill',
          evidence: 'distinct_committed_receipt_after_activation',
          enemyId: 'mortal_wild_boar',
          amount: 3,
        },
        {
          objectiveId: 'tvdm2_main_02:o2',
          kind: 'realm_level_reached',
          evidence: 'durable_attainment_reconciled_by_lifecycle',
          realmId: 'mortal',
          level: 3,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_03',
    designId: 'V2-03',
    name: 'Huyền Khoáng Dị Sắc',
    description:
      'Thu mới 3 Thập Niên Linh Khoáng và nhận ít nhất 1 lượt thành phẩm từ điểm sản xuất quặng.',
    story: {
      opening:
        'Thợ mỏ nhặt được viên quặng xanh có tia đỏ chạy qua lõi. Không ai dám đập nó vì tiếng vang giống nhịp tim.',
      ending: 'Mạch quặng hướng về hang đá. Có kẻ đã đào thứ gì đó ra từ sâu trong lòng núi.',
    },
    ctaSuggestions: ['Đến Mỏ', 'Mở Khí Đường'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_02',
    admission: {
      minRealmAttained: 'mortal',
      predecessor: 'claimed',
    },
    rewardBand: 'mortal',
    reward: {
      spiritStone: 16,
      cultivation: 35,
      skillInsight: 0,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_03:o1',
          kind: 'acquire',
          evidence: 'distinct_committed_receipt_after_activation',
          materialId: 'material_spirit_ore_decade',
          amount: 3,
          source: 'any',
          quantity: 'delivered',
          consumeAtClaim: false,
        },
        {
          objectiveId: 'tvdm2_main_03:o2',
          kind: 'production_batch_claimed',
          evidence: 'distinct_committed_receipt_after_activation',
          siteKind: 'ore',
          amount: 1,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'production_faucet',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_04',
    designId: 'V2-04',
    name: 'Rèn Khí Hộ Thân',
    description: 'Trang bị thành công 1 món đồ và hạ thêm 3 Dã Trư sau khi chuẩn bị.',
    story: {
      opening:
        'Khoáng dị sắc có thể gia cố một mảnh hộ giáp. Lão thợ rèn bảo ngươi đừng bước vào sào huyệt dã trư khi tay còn trống.',
      ending:
        'Vết móng đập vào giáp bật tia sáng đỏ; hung tính của đàn trư giờ có nguyên nhân rõ ràng.',
    },
    ctaSuggestions: ['Mở Trang Bị', 'Khiêu chiến'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_03',
    admission: {
      minRealmAttained: 'mortal',
      predecessor: 'claimed',
    },
    rewardBand: 'mortal',
    reward: {
      spiritStone: 20,
      cultivation: 50,
      skillInsight: 0,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_04:o1',
          kind: 'equipment_equipped',
          evidence: 'distinct_committed_receipt_after_activation',
          amount: 1,
          uniqueMutation: true,
          reconcileExistingEquippedCount: 1,
        },
        {
          objectiveId: 'tvdm2_main_04:o2',
          kind: 'kill',
          evidence: 'distinct_committed_receipt_after_activation',
          enemyId: 'mortal_wild_boar',
          amount: 3,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'equipment_faucet_and_cost',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_05',
    designId: 'V2-05',
    name: 'Khai Mở Thể Mạch',
    description: 'Thực hiện 1 lượt Luyện Thể thành công và hạ 2 Dã Trư.',
    story: {
      opening:
        'Hỏa khí không chỉ thiêu cây; nó dồn ép cả huyết mạch. Hãy luyện gân cốt để chịu nổi sức nóng.',
      ending:
        'Một tia nóng xuyên qua kinh mạch rồi tan đi. Thân thể giờ chịu được luồng khí nặng hơn.',
    },
    ctaSuggestions: ['Luyện Thể', 'Thử sức'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_04',
    admission: {
      minRealmAttained: 'mortal',
      predecessor: 'claimed',
    },
    rewardBand: 'mortal',
    reward: {
      spiritStone: 22,
      cultivation: 60,
      skillInsight: 0,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_05:o1',
          kind: 'body_refinement_committed',
          evidence: 'distinct_committed_receipt_after_activation',
          amount: 1,
        },
        {
          objectiveId: 'tvdm2_main_05:o2',
          kind: 'kill',
          evidence: 'distinct_committed_receipt_after_activation',
          enemyId: 'mortal_wild_boar',
          amount: 2,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'body_faucet_and_cost',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_06',
    designId: 'V2-06',
    name: 'Dấu Tích Dị Hỏa',
    description: 'Đạt Phàm Nhân tầng 8 và hoàn tất thêm 1 lần Luyện Thể.',
    story: {
      opening:
        'Trong hang có những vệt đỏ như kinh văn, nhưng đèn dầu không đủ nóng để tạo ra chúng. Vết nứt của núi hẳn đã được mở từ trước.',
      ending: 'Ngươi nghe tiếng gầm ở đáy động. Thứ canh giữ mạch hỏa đang thức giấc.',
    },
    ctaSuggestions: ['Tu Luyện', 'Luyện Thể'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_05',
    admission: {
      minRealmAttained: 'mortal',
      predecessor: 'claimed',
    },
    rewardBand: 'mortal',
    reward: {
      spiritStone: 25,
      cultivation: 70,
      skillInsight: 0,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_06:o1',
          kind: 'realm_level_reached',
          evidence: 'durable_attainment_reconciled_by_lifecycle',
          realmId: 'mortal',
          level: 8,
        },
        {
          objectiveId: 'tvdm2_main_06:o2',
          kind: 'body_refinement_committed',
          evidence: 'distinct_committed_receipt_after_activation',
          amount: 1,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'body_faucet_and_cost',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_07',
    designId: 'V2-07',
    name: 'Hung Trư Trấn Mạch',
    description: 'Chiến thắng toàn ải Thanh Vân 1-10 và chứng tỏ đã đạt Phàm Nhân tầng 12.',
    story: {
      opening:
        'Dã Trư Vương nằm trên khe nứt. Mỗi lần nó cào đất, cột khí đỏ lại bốc lên như ngọn nến ngược.',
      ending:
        'Đá vỡ, mạch lửa chạy thẳng về Sơn Tặc Trại. Phàm cốt đã rèn xong, đường nhập Luyện Khí đang mở.',
    },
    ctaSuggestions: ['Khiêu chiến 1-10', 'Đến Cảnh Giới — Quán Khí'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_06',
    admission: {
      minRealmAttained: 'mortal',
      predecessor: 'claimed',
    },
    rewardBand: 'mortal',
    reward: {
      spiritStone: 60,
      cultivation: 120,
      skillInsight: 0,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_07:o1',
          kind: 'stage_clear',
          evidence: 'durable_attainment_reconciled_by_lifecycle',
          stageId: 'mortal_dong_10',
          amount: 1,
          outcome: 'whole_stage_victory',
        },
        {
          objectiveId: 'tvdm2_main_07:o2',
          kind: 'realm_level_reached',
          evidence: 'durable_attainment_reconciled_by_lifecycle',
          realmId: 'mortal',
          level: 12,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_08',
    designId: 'V2-08',
    name: 'Tàn Hỏa Ven Sơn',
    description: 'Hoàn thành nhập Luyện Khí/Hỏa và đánh bại 3 Sơn Tặc ở Thanh Vân.',
    story: {
      opening:
        'Nhập đạo mở linh giác. Đường hỏa mạch chạy dưới chân những kẻ cướp khoáng, khiến binh khí chúng đỏ rực trong đêm.',
      ending: 'Trong túi sơn tặc có mẩu giấy ghi vị trí lò đan dã chiến.',
    },
    ctaSuggestions: ['Cảnh Giới/Ngũ Hành', 'Thanh Vân 1-11–13'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_07',
    admission: {
      minRealmAttained: 'qi_refining',
      predecessor: 'claimed',
    },
    rewardBand: 'qi_refining',
    reward: {
      spiritStone: 20,
      cultivation: 40,
      skillInsight: 400,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_08:o1',
          kind: 'realm_reached',
          evidence: 'durable_attainment_reconciled_by_lifecycle',
          realmId: 'qi_refining',
        },
        {
          objectiveId: 'tvdm2_main_08:o2',
          kind: 'path_element_attained',
          evidence: 'durable_attainment_reconciled_by_lifecycle',
          element: 'fire',
        },
        {
          objectiveId: 'tvdm2_main_08:o3',
          kind: 'kill',
          evidence: 'distinct_committed_receipt_after_activation',
          enemyId: 'bandit',
          amount: 3,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_09',
    designId: 'V2-09',
    name: 'Linh Thảo Trong Tro',
    description:
      'Thu mới 5 Tụ Linh Thảo Luyện Khí và nhận ít nhất 1 lứa linh thảo thành công từ sản xuất.',
    story: {
      opening:
        'Bên bờ suối nóng, linh thảo xanh mọc xen trong tro. Lửa thường thiêu rụi lá, dị hỏa lại làm dược tính cô đặc.',
      ending: 'Dược sư xác nhận có thể dùng loài thảo này để luyện Tụ Linh Đan.',
    },
    ctaSuggestions: ['Thu hoạch Linh Thảo', 'Đan Phòng'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_08',
    admission: {
      minRealmAttained: 'qi_refining',
      predecessor: 'claimed',
    },
    rewardBand: 'qi_refining',
    reward: {
      spiritStone: 25,
      cultivation: 0,
      skillInsight: 500,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_09:o1',
          kind: 'acquire',
          evidence: 'distinct_committed_receipt_after_activation',
          materialId: 'tu_linh_thao_qi_refining_decade',
          amount: 5,
          source: 'any',
          quantity: 'delivered',
          consumeAtClaim: false,
        },
        {
          objectiveId: 'tvdm2_main_09:o2',
          kind: 'production_batch_claimed',
          evidence: 'distinct_committed_receipt_after_activation',
          siteKind: 'herb',
          amount: 1,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'production_faucet',
        'alchemy_recipe_and_pill_delivery',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_10',
    designId: 'V2-10',
    name: 'Đan Hỏa Khai Mạch',
    description: 'Luyện chế thành công 1 lần và đánh bại thêm 2 Sơn Tặc.',
    story: {
      opening:
        'Một lò đan nhỏ đặt trên nền quặng đỏ, lửa trở nên ổn định trước khí tức Luyện Khí. Hãy luyện dược để giảm sức ép khi truy đuổi.',
      ending:
        'Mùi đan thoảng qua chiến trường. Bản vẽ lò đan của bọn sơn tặc có một đường hỏa văn kỳ lạ.',
    },
    ctaSuggestions: ['Luyện Đan', 'Đi Thanh Vân'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_09',
    admission: {
      minRealmAttained: 'qi_refining',
      predecessor: 'claimed',
    },
    rewardBand: 'qi_refining',
    reward: {
      spiritStone: 30,
      cultivation: 0,
      skillInsight: 700,
      itemDrops: [
        {
          kind: 'pill',
          itemId: 'tu_linh_dan_qi_refining',
          amount: 1,
        },
      ],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_10:o1',
          kind: 'flag',
          evidence: 'distinct_committed_receipt_after_activation',
          flagId: 'alchemy.crafted',
          amount: 1,
        },
        {
          objectiveId: 'tvdm2_main_10:o2',
          kind: 'kill',
          evidence: 'distinct_committed_receipt_after_activation',
          enemyId: 'bandit',
          amount: 2,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'alchemy_recipe_and_pill_delivery',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_11',
    designId: 'V2-11',
    name: 'Công Pháp Dẫn Hỏa',
    description:
      'Nâng Công Pháp lên rank 1 (trong grade hiện cho phép) và tăng cấp/mở 1 nút kỹ năng Hỏa hợp lệ.',
    story: {
      opening:
        'Tấm bản đồ của sơn tặc dùng nét hỏa tự để đánh dấu khe đá. Muốn đọc được, ngươi phải vận công theo đúng tuần hoàn.',
      ending: 'Linh văn trên bản đồ hiện tên một trại khoáng nằm sau hẻm núi.',
    },
    ctaSuggestions: ['Công Pháp', 'Kỹ Năng Hỏa'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_10',
    admission: {
      minRealmAttained: 'qi_refining',
      predecessor: 'claimed',
    },
    rewardBand: 'qi_refining',
    reward: {
      spiritStone: 35,
      cultivation: 50,
      skillInsight: 900,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_11:o1',
          kind: 'technique_rank_at_least',
          rank: 1,
          evidence: 'producer_decision_required_current_grade_or_durable_milestone',
        },
        {
          objectiveId: 'tvdm2_main_11:o2',
          kind: 'skill_node_progress_committed',
          evidence: 'distinct_committed_receipt_after_activation',
          element: 'fire',
          amount: 1,
          reconcileExistingProgress: 'producer_decision_required',
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'technique_grade_rank_semantics',
        'fire_starter_node_eligibility_and_reconcile',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_12',
    designId: 'V2-12',
    name: 'Khoáng Mạch Bị Đánh Cắp',
    description:
      'Thu mới 3 Thập Niên Linh Khoáng và cường hóa trang bị thành công 1 lần.',
    story: {
      opening:
        'Sơn tặc đào quặng ngay từ vết nứt của Thanh Vân. Một thợ rèn bị bắt thú nhận chúng đang rèn móc giữ linh mạch.',
      ending: 'Vũ khí được gia cố có thể chạm vào mạch quặng mà không bị thiêu đỏ.',
    },
    ctaSuggestions: ['Đi Mỏ', 'Cường Hóa'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_11',
    admission: {
      minRealmAttained: 'qi_refining',
      predecessor: 'claimed',
    },
    rewardBand: 'qi_refining',
    reward: {
      spiritStone: 35,
      cultivation: 0,
      skillInsight: 1000,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_12:o1',
          kind: 'acquire',
          evidence: 'distinct_committed_receipt_after_activation',
          materialId: 'material_spirit_ore_decade',
          amount: 3,
          source: 'any',
          quantity: 'delivered',
          consumeAtClaim: false,
        },
        {
          objectiveId: 'tvdm2_main_12:o2',
          kind: 'equipment_enhanced',
          evidence: 'distinct_committed_receipt_after_activation',
          amount: 1,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'equipment_faucet_and_cost',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_13',
    designId: 'V2-13',
    name: 'Ngũ Hành Phá Trận',
    description:
      'Hoàn thành 1 lần Luyện Thể tại Luyện Khí và đánh bại 5 Sơn Tặc bằng bất kỳ kỹ năng hợp lệ.',
    story: {
      opening:
        'Một hỏa trận cũ nằm dưới chân trại. Gió cuốn tro thành hình phù, như thể chính khe nứt đang nuôi dưỡng tà thuật.',
      ending: 'Bộ trận tan rã, hỏa khí rút về vực sâu. Sơn Tặc Vương vẫn giữ chìa khóa.',
    },
    ctaSuggestions: ['Luyện Thể', 'Dẹp Trại Sơn Tặc'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_12',
    admission: {
      minRealmAttained: 'qi_refining',
      predecessor: 'claimed',
    },
    rewardBand: 'qi_refining',
    reward: {
      spiritStone: 45,
      cultivation: 80,
      skillInsight: 1300,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_13:o1',
          kind: 'body_refinement_committed',
          evidence: 'distinct_committed_receipt_after_activation',
          amount: 1,
          minRealm: 'qi_refining',
        },
        {
          objectiveId: 'tvdm2_main_13:o2',
          kind: 'kill',
          evidence: 'distinct_committed_receipt_after_activation',
          enemyId: 'bandit',
          amount: 5,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'body_faucet_and_cost',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_14',
    designId: 'V2-14',
    name: 'Trảm Sơn Tặc Vương',
    description: 'Đã đạt Luyện Khí tầng 12 và chiến thắng toàn ải Thanh Vân 1-20.',
    story: {
      opening:
        'Sơn Tặc Vương đốt lò quặng ngay miệng vực. Hắn tưởng mình điều khiển dị hỏa, nhưng dòng lửa bên dưới đang lần theo từng bước chân hắn.',
      ending:
        'Vật chứng trên người thủ lĩnh chỉ về hậu sơn, nơi một bầy Linh Lang đang cố phong kín mạch đất. Đường độ kiếp đã xuất hiện.',
    },
    ctaSuggestions: ['Khiêu chiến 1-20', 'Độ Kiếp Trúc Cơ'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_13',
    admission: {
      minRealmAttained: 'qi_refining',
      predecessor: 'claimed',
    },
    rewardBand: 'qi_refining',
    reward: {
      spiritStone: 80,
      cultivation: 150,
      skillInsight: 2000,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_14:o1',
          kind: 'realm_level_reached',
          evidence: 'durable_attainment_reconciled_by_lifecycle',
          realmId: 'qi_refining',
          level: 12,
        },
        {
          objectiveId: 'tvdm2_main_14:o2',
          kind: 'stage_clear',
          evidence: 'durable_attainment_reconciled_by_lifecycle',
          stageId: 'qi_refining_abyssal_pool',
          amount: 1,
          outcome: 'whole_stage_victory',
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_15',
    designId: 'V2-15',
    name: 'Đá Mạch Trúc Cơ',
    description:
      'Bước vào Trúc Cơ, thu mới 3 Thập Niên Linh Khoáng và lĩnh ít nhất 1 lứa quặng từ sản xuất.',
    story: {
      opening:
        'Lôi kiếp rửa sạch tạp khí, nhưng dưới chân hậu sơn vẫn nặng mùi sắt cháy. Một mẩu quặng trắng chuyển đỏ khi người tu cầm lên.',
      ending: 'Trên quặng có dấu răng sói. Linh Lang dường như đem đá về lấp vết nứt.',
    },
    ctaSuggestions: ['Đến Mỏ Hậu Sơn'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_14',
    admission: {
      minRealmAttained: 'foundation_establishment',
      predecessor: 'claimed',
    },
    rewardBand: 'foundation_establishment',
    reward: {
      spiritStone: 16,
      cultivation: 20,
      skillInsight: 2500,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_15:o1',
          kind: 'realm_reached',
          evidence: 'durable_attainment_reconciled_by_lifecycle',
          realmId: 'foundation_establishment',
        },
        {
          objectiveId: 'tvdm2_main_15:o2',
          kind: 'acquire',
          evidence: 'distinct_committed_receipt_after_activation',
          materialId: 'material_spirit_ore_decade',
          amount: 3,
          source: 'any',
          quantity: 'delivered',
          consumeAtClaim: false,
        },
        {
          objectiveId: 'tvdm2_main_15:o3',
          kind: 'production_batch_claimed',
          evidence: 'distinct_committed_receipt_after_activation',
          siteKind: 'ore',
          amount: 1,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'production_faucet',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_16',
    designId: 'V2-16',
    name: 'Bóng Trắng Hậu Sơn',
    description:
      'Đánh bại 5 Linh Lang và sử dụng thành công 1 đan dược hợp lệ để hồi phục/tu luyện.',
    story: {
      opening:
        'Những bóng trắng băng qua màn sương, không tấn công mỏ mà đuổi người khỏi khe sâu. Chúng bị bỏng ở cổ và chân, có vẻ đang gắng sống sót.',
      ending: 'Trong ổ sói có một tấm phù cũ. Ai đó đã từng cố bảo vệ linh mạch.',
    },
    ctaSuggestions: ['Đi Hậu Sơn', 'Mở Túi Đan Dược'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_15',
    admission: {
      minRealmAttained: 'foundation_establishment',
      predecessor: 'claimed',
    },
    rewardBand: 'foundation_establishment',
    reward: {
      spiritStone: 20,
      cultivation: 0,
      skillInsight: 3000,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_16:o1',
          kind: 'kill',
          evidence: 'distinct_committed_receipt_after_activation',
          enemyId: 'foundation_spirit_wolf',
          amount: 5,
        },
        {
          objectiveId: 'tvdm2_main_16:o2',
          kind: 'pill_used',
          evidence: 'distinct_committed_receipt_after_activation',
          amount: 1,
          outcome: 'consumption_and_benefit_committed',
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'usable_pill_faucet',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_17',
    designId: 'V2-17',
    name: 'Linh Lang Chi Ước',
    description:
      'Nhận một đồng hành được cấp sẵn tại Trúc Cơ, đặt đồng hành vào một vị trí trận pháp hợp lệ.',
    story: {
      opening:
        'Người giữ núi gửi một phong thư: linh thú phản ứng với lực lượng lẻ loi, nhưng dịu xuống khi có khí tức đồng hành.',
      ending: 'Khí tức giao hòa, bầy sói ngừng cắn xé và hé lộ đường lên sườn núi.',
    },
    ctaSuggestions: ['Nhận quà Đồng Hành', 'Xếp Trận'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_16',
    admission: {
      minRealmAttained: 'foundation_establishment',
      predecessor: 'claimed',
    },
    rewardBand: 'foundation_establishment',
    reward: {
      spiritStone: 24,
      cultivation: 0,
      skillInsight: 4000,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_17:o1',
          kind: 'companion_available',
          evidence: 'owner_state_revalidated_at_claim',
          accountOwned: true,
        },
        {
          objectiveId: 'tvdm2_main_17:o2',
          kind: 'formation_member_assigned',
          evidence: 'distinct_committed_receipt_after_activation',
          amount: 1,
          reconcileExistingAssignment: true,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'companion_entitlement_every_beta_account',
        'formation_state_and_battle_snapshot',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_18',
    designId: 'V2-18',
    name: 'Rèn Bảo Hộ Mạch',
    description:
      'Cường hóa thành công 1 món trang bị tại Trúc Cơ và duy trì ít nhất 1 vị trí đồng hành trong trận.',
    story: {
      opening:
        'Những phù đá cũ phản ứng với binh khí đã gia cố. Lão thợ đề nghị giữ trận có đồng hành trong khi ngươi chuẩn bị bảo hộ mạch.',
      ending: 'Mạch phù bắt đầu sáng trở lại; lỗ hổng lớn nhất nằm ở tầng sâu nhất.',
    },
    ctaSuggestions: ['Cường Hóa', 'Xem Trận Pháp'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_17',
    admission: {
      minRealmAttained: 'foundation_establishment',
      predecessor: 'claimed',
    },
    rewardBand: 'foundation_establishment',
    reward: {
      spiritStone: 24,
      cultivation: 40,
      skillInsight: 4500,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_18:o1',
          kind: 'equipment_enhanced',
          evidence: 'distinct_committed_receipt_after_activation',
          amount: 1,
          minRealm: 'foundation_establishment',
        },
        {
          objectiveId: 'tvdm2_main_18:o2',
          kind: 'formation_member_present',
          evidence: 'owner_state_revalidated_at_claim',
          minCount: 1,
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'companion_entitlement_every_beta_account',
        'formation_state_and_battle_snapshot',
        'equipment_faucet_and_cost',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_19',
    designId: 'V2-19',
    name: 'Linh Khí Tụ Trận',
    description:
      'Tiến triển Luyện Thể thành công 2 lần và đạt Công Pháp rank 1 trong grade đang cho phép.',
    story: {
      opening:
        'Dòng khí bị xé thành nhiều sợi. Chỉ có thân thể vững và tuần hoàn công pháp chính xác mới chống được lực giật ngược.',
      ending: 'Ngươi đủ sức đến gần mạch lõi. Bầy sói dẫn đường thay vì cản lối.',
    },
    ctaSuggestions: ['Luyện Thể', 'Công Pháp'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_18',
    admission: {
      minRealmAttained: 'foundation_establishment',
      predecessor: 'claimed',
    },
    rewardBand: 'foundation_establishment',
    reward: {
      spiritStone: 30,
      cultivation: 40,
      skillInsight: 5000,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_19:o1',
          kind: 'body_refinement_committed',
          evidence: 'distinct_committed_receipt_after_activation',
          amount: 2,
        },
        {
          objectiveId: 'tvdm2_main_19:o2',
          kind: 'technique_rank_at_least',
          rank: 1,
          evidence: 'producer_decision_required_current_grade_or_durable_milestone',
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'body_faucet_and_cost',
        'technique_grade_rank_semantics',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_20',
    designId: 'V2-20',
    name: 'Hậu Sơn Dị Biến',
    description: 'Hạ 6 Linh Lang nổi loạn và hoàn tất 2 trận đấu có đội hình đồng hành hợp lệ.',
    story: {
      opening:
        'Linh Lang ngã xuống bên những tảng đá đã nứt đôi. Vết thương giống vệt nóng trên quặng ở Thanh Vân Lâm; hóa ra nguồn bệnh chung ở một chỗ.',
      ending:
        'Đường đến cổ mộc đàm đã mở. Một con Lang Vương kiệt sức vẫn cố giữ tảng đá cuối cùng.',
    },
    ctaSuggestions: ['Lên Hậu Sơn'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_19',
    admission: {
      minRealmAttained: 'foundation_establishment',
      predecessor: 'claimed',
    },
    rewardBand: 'foundation_establishment',
    reward: {
      spiritStone: 36,
      cultivation: 50,
      skillInsight: 6000,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_20:o1',
          kind: 'kill',
          evidence: 'distinct_committed_receipt_after_activation',
          enemyId: 'foundation_spirit_wolf',
          amount: 6,
        },
        {
          objectiveId: 'tvdm2_main_20:o2',
          kind: 'battle_victory_with_formation',
          evidence: 'distinct_committed_receipt_after_activation',
          amount: 2,
          formationEvidence: 'valid_companion_snapshot_at_battle_start',
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'companion_entitlement_every_beta_account',
        'formation_state_and_battle_snapshot',
      ],
    },
  },
  {
    schema: 'quest-v2-authored-intent-1',
    id: 'tvdm2_main_21',
    designId: 'V2-21',
    name: 'Linh Lang Vương',
    description:
      'Giữ ít nhất 1 đồng hành trong đội hình và chiến thắng toàn ải Linh Lang Vương ở Hậu Sơn.',
    story: {
      opening:
        'Lang Vương đứng giữa hồ cổ mộc, chân không còn vững. Dưới tảng đá nó giữ là đầu mút linh mạch đang nứt. Bầy sói liều chết để ngăn dị hỏa tràn ra đồng bằng.',
      ending:
        'Lang Vương gục xuống; ngươi phong kín vết rạn, trả khí tức dịu mát cho Thanh Vân. Mạch sâu hơn vẫn còn, nhưng hành trình Trúc Cơ kết thúc tại đây.',
    },
    ctaSuggestions: ['Hậu Sơn — Linh Lang Vương', 'Xem Biên Niên Thành Tựu'],
    cadence: 'once',
    chainId: 'mainline',
    unlocksAfterQuestId: 'tvdm2_main_20',
    admission: {
      minRealmAttained: 'foundation_establishment',
      predecessor: 'claimed',
    },
    rewardBand: 'foundation_establishment',
    reward: {
      spiritStone: 80,
      cultivation: 100,
      skillInsight: 12000,
      itemDrops: [],
    },
    condition: {
      kind: 'allOf',
      objectives: [
        {
          objectiveId: 'tvdm2_main_21:o1',
          kind: 'formation_member_present',
          minCount: 1,
          evidence: 'producer_decision_required_claim_state_or_stage_win_snapshot',
        },
        {
          objectiveId: 'tvdm2_main_21:o2',
          kind: 'stage_clear',
          evidence: 'durable_attainment_reconciled_by_lifecycle',
          stageId: 'foundation_floor_10',
          amount: 1,
          outcome: 'whole_stage_victory',
        },
      ],
    },
    release: {
      status: 'blocked_until_producer_and_cutover_acceptance',
      gates: [
        'objective_engine_and_durable_producers',
        'v1_v2_cutover_no_duplicate_rewards',
        'realm_admission_preserves_old_quests',
        'economy_playthrough',
        'companion_entitlement_every_beta_account',
        'q21_formation_evidence_and_migration',
      ],
    },
  },
] as const satisfies readonly QuestV2Definition[]
