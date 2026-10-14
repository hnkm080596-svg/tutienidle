import { describe, expect, it } from 'vitest'
import { QUEST_V2_MAINLINE } from './questV2Mainline'
import type { QuestV2Definition } from './questV2Types'
import { QUESTS } from './quests'
import { ENEMIES } from '../enemy/Enemies'
import { STAGES } from '../stage/Stages'
import { materials } from '../materials/materials'
import { pills } from '../pill/pills'
import { REALMS } from '../realms/realm'
import { QUEST_FLAG_IDS } from '../../core/quest/Quest'

const definitions: readonly QuestV2Definition[] = QUEST_V2_MAINLINE
// Independent contract oracle from the three Act tables, not an engine simulation.
const expectedKinds = [
  ['acquire', 'kill'],
  ['kill', 'realm_level_reached'],
  ['acquire', 'production_batch_claimed'],
  ['equipment_equipped', 'kill'],
  ['body_refinement_committed', 'kill'],
  ['realm_level_reached', 'body_refinement_committed'],
  ['stage_clear', 'realm_level_reached'],
  ['realm_reached', 'path_element_attained', 'kill'],
  ['acquire', 'production_batch_claimed'],
  ['flag', 'kill'],
  ['technique_rank_at_least', 'skill_node_progress_committed'],
  ['acquire', 'equipment_enhanced'],
  ['body_refinement_committed', 'kill'],
  ['realm_level_reached', 'stage_clear'],
  ['realm_reached', 'acquire', 'production_batch_claimed'],
  ['kill', 'pill_used'],
  ['companion_available', 'formation_member_assigned'],
  ['equipment_enhanced', 'formation_member_present'],
  ['body_refinement_committed', 'technique_rank_at_least'],
  ['kill', 'battle_victory_with_formation'],
  ['formation_member_present', 'stage_clear'],
]
const expectedBaseRewards = [
  [12, 20, 0],
  [15, 35, 0],
  [16, 35, 0],
  [20, 50, 0],
  [22, 60, 0],
  [25, 70, 0],
  [60, 120, 0],
  [20, 40, 400],
  [25, 0, 500],
  [30, 0, 700],
  [35, 50, 900],
  [35, 0, 1000],
  [45, 80, 1300],
  [80, 150, 2000],
  [16, 20, 2500],
  [20, 0, 3000],
  [24, 0, 4000],
  [24, 40, 4500],
  [30, 40, 5000],
  [36, 50, 6000],
  [80, 100, 12000],
]

describe('quest V2 authored catalog', () => {
  it('has exactly 21 distinct additive IDs and no V1 collision', () => {
    expect(definitions.map((q) => q.id)).toEqual(
      Array.from({ length: 21 }, (_, i) => `tvdm2_main_${String(i + 1).padStart(2, '0')}`),
    )
    const oldIds = new Set(QUESTS.map((q) => q.id))
    expect(definitions.every((q) => !oldIds.has(q.id))).toBe(true)
  })

  it.each(definitions.map((quest, index) => ({ quest, index })))(
    '$quest.designId preserves chain, goals and base rewards',
    ({ quest, index }) => {
      expect(quest.designId).toBe(`V2-${String(index + 1).padStart(2, '0')}`)
      expect(quest.unlocksAfterQuestId).toBe(index === 0 ? undefined : definitions[index - 1]?.id)
      expect(quest.admission).toEqual({
        minRealmAttained: ['mortal', 'qi_refining', 'foundation_establishment'][
          Math.floor(index / 7)
        ],
        predecessor: 'claimed',
      })
      expect(quest.rewardBand).toBe(quest.admission.minRealmAttained)
      expect(quest.cadence).toBe('once')
      expect(quest.chainId).toBe('mainline')
      expect(quest.condition.kind).toBe('allOf')
      expect(quest.condition.objectives.map((o) => o.kind)).toEqual(expectedKinds[index])
      expect(quest.condition.objectives.map((o) => o.objectiveId)).toEqual(
        quest.condition.objectives.map((_, i) => `${quest.id}:o${i + 1}`),
      )
      expect([
        quest.reward.spiritStone,
        quest.reward.cultivation,
        quest.reward.skillInsight,
      ]).toEqual(expectedBaseRewards[index])
      expect(quest.story.opening.length).toBeGreaterThan(20)
      expect(quest.story.ending.length).toBeGreaterThan(20)
      expect(quest.name.length).toBeGreaterThan(0)
      expect(quest.description.length).toBeGreaterThan(0)
      expect(quest.ctaSuggestions.length).toBeGreaterThan(0)
      expect(quest.release.status).toBe('blocked_until_producer_and_cutover_acceptance')
      expect(quest.release.gates).toEqual(
        expect.arrayContaining([
          'objective_engine_and_durable_producers',
          'v1_v2_cutover_no_duplicate_rewards',
          'economy_playthrough',
        ]),
      )
    },
  )

  it('proves catalog targets against production catalogs, including stage boss identity', () => {
    const enemyIds = new Set(ENEMIES.map((e) => e.id))
    const materialIds = new Set(materials.map((m) => m.id))
    const realmIds = new Set(REALMS.map((r) => r.id))
    for (const quest of definitions) {
      expect(realmIds.has(quest.rewardBand)).toBe(true)
      for (const objective of quest.condition.objectives) {
        if ('enemyId' in objective) {
          expect(enemyIds.has(objective.enemyId), objective.objectiveId).toBe(true)
          expect(
            STAGES.some((stage) =>
              stage.enemyPool.some((entry) => entry.enemyId === objective.enemyId),
            ),
            objective.objectiveId,
          ).toBe(true)
        }
        if ('materialId' in objective)
          expect(materialIds.has(objective.materialId), objective.objectiveId).toBe(true)
        if ('realmId' in objective)
          expect(realmIds.has(objective.realmId), objective.objectiveId).toBe(true)
        if ('minRealm' in objective && objective.minRealm)
          expect(realmIds.has(objective.minRealm)).toBe(true)
        if (objective.kind === 'flag') expect(QUEST_FLAG_IDS).toContain(objective.flagId)
        if (objective.kind === 'stage_clear') {
          const stage = STAGES.find((s) => s.id === objective.stageId)
          expect(stage, objective.objectiveId).toBeDefined()
          const boss = {
            mortal_dong_10: 'mortal_ferocious_wild_boar',
            qi_refining_abyssal_pool: 'ferocious_bandit',
            foundation_floor_10: 'foundation_ferocious_spirit_wolf',
          }[objective.stageId]
          expect(stage?.bossEnemyId).toBe(boss)
          expect(enemyIds.has(boss)).toBe(true)
        }
      }
      for (const item of quest.reward.itemDrops)
        expect(pills.some((p) => p.id === item.itemId)).toBe(true)
    }
  })

  it('pins numeric targets and fresh-event versus lifecycle semantics', () => {
    const kills = definitions.flatMap((q) =>
      q.condition.objectives.filter((o) => o.kind === 'kill'),
    )
    expect(kills.map((o) => [o.enemyId, o.amount])).toEqual([
      ['mortal_wild_boar', 1],
      ['mortal_wild_boar', 3],
      ['mortal_wild_boar', 3],
      ['mortal_wild_boar', 2],
      ['bandit', 3],
      ['bandit', 2],
      ['bandit', 5],
      ['foundation_spirit_wolf', 5],
      ['foundation_spirit_wolf', 6],
    ])
    const acquire = definitions.flatMap((q) =>
      q.condition.objectives.filter((o) => o.kind === 'acquire'),
    )
    expect(acquire.map((o) => [o.materialId, o.amount])).toEqual([
      ['mortal_wood_decade', 3],
      ['mortal_ore_decade', 3],
      ['tu_linh_thao_qi_refining_decade', 5],
      ['qi_refining_ore_decade', 3],
      ['foundation_establishment_ore_decade', 3],
    ])
    for (const o of acquire) {
      expect(o.consumeAtClaim).toBe(false)
      expect(o.quantity).toBe('delivered')
      expect(o.source).toBe('any')
      expect(o.evidence).toBe('distinct_committed_receipt_after_activation')
    }
    expect(
      definitions
        .flatMap((q) => q.condition.objectives.filter((o) => o.kind === 'realm_level_reached'))
        .map((o) => [o.realmId, o.level]),
    ).toEqual([
      ['mortal', 3],
      ['mortal', 8],
      ['mortal', 12],
      ['qi_refining', 12],
    ])
    for (const q of definitions)
      for (const o of q.condition.objectives) {
        if ('amount' in o) {
          expect(Number.isSafeInteger(o.amount)).toBe(true)
          expect(o.amount).toBeGreaterThan(0)
        }
        if (o.kind === 'stage_clear') {
          expect(o.outcome).toBe('whole_stage_victory')
          expect(o.evidence).toBe('durable_attainment_reconciled_by_lifecycle')
        }
      }
    expect(
      definitions
        .flatMap((q) =>
          q.condition.objectives.filter((o) => o.kind === 'body_refinement_committed'),
        )
        .map((o) => [o.amount, o.minRealm]),
    ).toEqual([
      [1, undefined],
      [1, undefined],
      [1, 'qi_refining'],
      [2, undefined],
    ])
  })

  it('matches all Act effective totals, with insight and a single pill unscaled', () => {
    const totals = [0, 1, 2].map((act) => {
      const factor = [1, 8, 50][act]!
      return definitions
        .slice(act * 7, act * 7 + 7)
        .reduce(
          (sum, q) => [
            sum[0]! + q.reward.spiritStone * factor,
            sum[1]! + q.reward.cultivation * factor,
            sum[2]! + q.reward.skillInsight,
          ],
          [0, 0, 0],
        )
    })
    expect(totals).toEqual([
      [170, 390, 0],
      [2160, 2560, 6800],
      [11500, 12500, 37000],
    ])
    expect(definitions.flatMap((q) => q.reward.itemDrops)).toEqual([
      { kind: 'pill', itemId: 'tu_linh_dan_qi_refining', amount: 1 },
    ])
    expect(definitions[9]?.reward.itemDrops).toHaveLength(1)
  })

  it('pins producer-specific targets that have no catalog ID', () => {
    expect(
      definitions
        .flatMap((q) => q.condition.objectives.filter((o) => o.kind === 'production_batch_claimed'))
        .map((o) => [o.siteKind, o.amount, o.evidence]),
    ).toEqual([
      ['ore', 1, 'distinct_committed_receipt_after_activation'],
      ['herb', 1, 'distinct_committed_receipt_after_activation'],
      ['ore', 1, 'distinct_committed_receipt_after_activation'],
    ])
    expect(definitions[7]?.condition.objectives[1]).toMatchObject({
      element: 'fire',
      evidence: 'durable_attainment_reconciled_by_lifecycle',
    })
    expect(definitions[10]?.condition.objectives[1]).toMatchObject({ element: 'fire', amount: 1 })
    expect(definitions[15]?.condition.objectives[1]).toMatchObject({
      amount: 1,
      outcome: 'consumption_and_benefit_committed',
    })
    expect(definitions[17]?.condition.objectives[0]).toMatchObject({
      amount: 1,
      minRealm: 'foundation_establishment',
    })
    expect(definitions[16]?.condition.objectives[0]).toMatchObject({ accountOwned: true })
  })

  it('keeps unresolved producer decisions explicit and blocks companion-dependent release', () => {
    expect(definitions[3]?.condition.objectives[0]).toMatchObject({
      uniqueMutation: true,
      reconcileExistingEquippedCount: 1,
    })
    expect(definitions[16]?.condition.objectives[1]).toMatchObject({
      evidence: 'distinct_committed_receipt_after_activation',
      reconcileExistingAssignment: true,
    })
    for (const n of [11, 19])
      expect(definitions[n - 1]?.release.gates).toContain('technique_grade_rank_semantics')
    expect(definitions[10]?.release.gates).toContain('fire_starter_node_eligibility_and_reconcile')
    for (const n of [17, 18, 20, 21])
      expect(definitions[n - 1]?.release.gates).toContain(
        'companion_entitlement_every_beta_account',
      )
    expect(definitions[20]?.release.gates).toContain('q21_formation_evidence_and_migration')
    const formation = definitions[20]?.condition.objectives[0]
    expect(formation?.evidence).toBe('producer_decision_required_claim_state_or_stage_win_snapshot')
    expect(definitions[19]?.condition.objectives[1]).toMatchObject({
      amount: 2,
      formationEvidence: 'valid_companion_snapshot_at_battle_start',
    })
    expect(definitions[17]?.condition.objectives[1].evidence).toBe(
      'owner_state_revalidated_at_claim',
    )
  })
})
