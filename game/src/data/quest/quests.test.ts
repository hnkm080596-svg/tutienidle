import { describe, expect, it } from 'vitest'
import { QUESTS } from './quests'
import { ENEMIES } from '../enemy/Enemies'
import { pills } from '../pill/pills'
import { QUEST_FLAG_IDS, questObjectives } from '../../core/quest/Quest'
import { STAGES } from '../stage/Stages'
import { REALMS } from '../realms/realm'

describe('foundation quests', () => {
  it('có đúng 5 quest Trúc Cơ standalone (chuỗi once không thuộc chain)', () => {
    const foundation = QUESTS.filter(
      (quest) => quest.requiredRealmId === 'foundation_establishment' && quest.chainId === undefined,
    )
    expect(foundation.filter((quest) => quest.cadence === 'once')).toHaveLength(5)
    expect(foundation).toHaveLength(5)
  })

  it('mọi kill quest tham chiếu enemy tồn tại', () => {
    const ids = new Set(ENEMIES.map((enemy) => enemy.id))
    for (const quest of QUESTS) {
      for (const leaf of questObjectives(quest.condition)) {
        if (leaf.kind === 'kill' && leaf.enemyId) {
          expect(ids.has(leaf.enemyId)).toBe(true)
        }
      }
    }
  })

  it('quest Trúc Cơ không có id trùng', () => {
    const foundation = QUESTS.filter((quest) => quest.requiredRealmId === 'foundation_establishment')
    const ids = foundation.map((quest) => quest.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('authored set phủ đủ cả 6 nhóm nhiệm vụ và 3 cadence (once, daily, weekly)', () => {
    expect(QUESTS.some((quest) => quest.cadence === 'daily' && quest.chainId === 'day')).toBe(true)
    expect(QUESTS.some((quest) => quest.cadence === 'weekly' && quest.chainId === 'weekly')).toBe(true)
    expect(QUESTS.some((quest) => quest.cadence === 'once' && quest.chainId === 'achievement')).toBe(true)
    expect(QUESTS.some((quest) => quest.cadence === 'once' && quest.chainId === 'expedition')).toBe(true)
    const ids = QUESTS.map((quest) => quest.id)
    expect(ids).not.toContain('daily_collect_hoi_xuan_thao')
    expect(ids).not.toContain('daily_kill_bandit_15')
    expect(ids).not.toContain('daily_chieu_hien_lenh')

    const stageIds = new Set(STAGES.map((stage) => stage.id))
    const realmIds = new Set(REALMS.map((realm) => realm.id))
    for (const quest of QUESTS) {
      for (const leaf of questObjectives(quest.condition)) {
        if (leaf.kind === 'stage_clear') {
          expect(stageIds.has(leaf.stageId)).toBe(true)
        }
        if (leaf.kind === 'realm_reached') {
          expect(realmIds.has(leaf.realmId)).toBe(true)
        }
      }
    }
  })
})

describe('mainline (chính tuyến) chain data', () => {
  const mainline = QUESTS.filter((quest) => quest.chainId === 'mainline')

  it('15 thành viên, duy nhất một head không có unlocksAfterQuestId', () => {
    expect(mainline).toHaveLength(15)
    const heads = mainline.filter((quest) => quest.unlocksAfterQuestId === undefined)
    expect(heads.map((quest) => quest.id)).toEqual(['main_01_da_san_dau_tien'])
  })

  it('mọi unlocksAfterQuestId trỏ tới một thành viên mainline đã đăng ký', () => {
    const ids = new Set(mainline.map((quest) => quest.id))
    for (const quest of mainline) {
      if (quest.unlocksAfterQuestId !== undefined) {
        expect(ids.has(quest.unlocksAfterQuestId)).toBe(true)
      }
    }
    // chainId only ever carries an unlocksAfterQuestId inside the same
    // chain - no cross-chain or dangling reference can sneak in.
    for (const quest of QUESTS) {
      if (quest.unlocksAfterQuestId !== undefined) {
        expect(quest.chainId).toBe('mainline')
      }
    }
  })

  it('chain walk từ head không chu kỳ và phủ đủ 15 thành viên', () => {
    const byId = new Map(mainline.map((quest) => [quest.id, quest]))
    const order: string[] = []
    let current = mainline.find((quest) => quest.unlocksAfterQuestId === undefined)
    const seen = new Set<string>()
    while (current) {
      expect(seen.has(current.id)).toBe(false)
      seen.add(current.id)
      order.push(current.id)
      current = mainline.find((quest) => quest.unlocksAfterQuestId === current!.id)
    }
    expect(order).toEqual([
      'main_01_da_san_dau_tien',
      'main_02_lam_chi_san',
      'main_03_ho_khieu_lam_trung',
      'main_04_quang_chi_nguyen',
      'main_05_thuy_lang_dam',
      'main_06_vuong_gia_da_de',
      'main_07_ngu_hanh_nhap_mon',
      'main_08_viem_ho_coc',
      'collect_tu_linh_thao_1',
      'main_10_dan_lo_so_khai',
      'collect_qi_refining_ore_decade_1',
      'main_12_trun_don_khoang',
      'main_13_giao_xa_uyen_dam',
      'main_14_do_kiep_truc_co',
      'main_15_giao_sung_chung_cuc',
    ])
    // Every chained member resolves through byId - no orphan.
    expect(order.every((id) => byId.has(id))).toBe(true)
  })

  it('toàn bộ thành viên là cadence once và realm gates đúng act', () => {
    for (const quest of mainline) {
      expect(quest.cadence).toBe('once')
    }
    expect(mainline.find((q) => q.id === 'main_07_ngu_hanh_nhap_mon')?.requiredRealmId).toBe(
      'qi_refining',
    )
    expect(mainline.find((q) => q.id === 'main_14_do_kiep_truc_co')?.requiredRealmId).toBe(
      'foundation_establishment',
    )
    // Only those two members carry a realm gate.
    expect(mainline.filter((q) => q.requiredRealmId !== undefined).map((q) => q.id)).toEqual([
      'main_07_ngu_hanh_nhap_mon',
      'main_14_do_kiep_truc_co',
    ])
  })

  it('mọi flag quest tham chiếu flagId phát ra thật', () => {
    const knownFlags = new Set(QUEST_FLAG_IDS)
    const mainlineFlagQuests = mainline.filter((quest) => quest.condition.kind === 'flag')
    expect(mainlineFlagQuests.map((q) => q.id)).toEqual(['main_10_dan_lo_so_khai'])
    for (const quest of QUESTS) {
      for (const leaf of questObjectives(quest.condition)) {
        if (leaf.kind === 'flag') {
          expect(knownFlags.has(leaf.flagId)).toBe(true)
        }
      }
    }
  })

  // F3 - design sec.1 row 10: the claim pays SS 30 plus one qi-refining
  // Tu Linh Dan as a pill itemDrop; the id must resolve in the catalog.
  it('main_10 reward itemDrop resolves in the pill catalog', () => {
    const pillIds = new Set(pills.map((pill) => pill.id))
    const main10 = mainline.find((quest) => quest.id === 'main_10_dan_lo_so_khai')
    const drops = main10?.reward.itemDrops ?? []
    expect(drops).toContainEqual({
      kind: 'pill',
      itemId: 'tu_linh_dan_qi_refining',
      amount: 1,
    })
    for (const drop of drops) {
      if (drop.kind === 'pill') {
        expect(pillIds.has(drop.itemId)).toBe(true)
      }
    }
  })
})

describe('standalone once quests', () => {
  // F2 - wild_wolf only spawns in the qi_refining Quat stages, so the
  // quest is realm-gated: no more dead 0/10 row admitted at mortal
  // creation. A carried mortal save keeps its in-flight row (the
  // reconcile inverse pass never evicts on progression gates).
  it('kill_wild_wolf_10 is realm-gated to qi_refining', () => {
    const wolf = QUESTS.find((quest) => quest.id === 'kill_wild_wolf_10')
    expect(wolf?.requiredRealmId).toBe('qi_refining')
  })
})
