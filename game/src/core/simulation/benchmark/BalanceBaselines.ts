// P5 - canonical baseline recipes (plan section Baseline construction,
// inventory section 1/section 2/section 6). One identical mortal source player + the real
// ritual + declared canonical post-ritual writes - the path's
// contribution is exactly what the recipe produces, nothing
// hand-tuned per path.

import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import { CAST_LEVELING_THRESHOLDS } from '../../skill/SkillSystem'
import { reachableKiemPhoComboIds } from '../../kiem-tu/KiemPhoProvider'
import { SPELL_BASICS } from '../../../data/skill/TurnBasicAttacks'
import type { CultivationPathId, CultivationWayId } from '../../player/CultivationPathKit'
import type {
  SimBuildSnapshot,
  SimulationCanonicalWrite,
} from '../BattleSimulation'

// Fixed seed battery - identical across every cell (recipes x
// benchmarks). K=8 keeps the full matrix inside the suite budget while
// still defeating single-roll conclusions.
export const BALANCE_SEEDS: readonly number[] = [11, 22, 33, 44, 55, 66, 77, 88]

// Channels evaluated by the resource-deadlock gate. `mustGenerate`/
// `mustSpend` name ledger/metric channels; `mustCast` names skillIds
// that must appear in metrics.casts (a kit whose actives never fire is
// deadlocked even if the basic attack keeps swinging).
export interface ExpectedEconomy {
  mustGenerate: readonly string[]
  mustSpend: readonly string[]
  // Channels the way owns but whose spender/generator is realm-gated
  // out of the entry baseline - recorded, never asserted.
  notActiveAtThisPowerPoint: readonly string[]
  mustCast: readonly string[]
}

export interface BaselineRecipe {
  id: string
  // Gate rows vs reported-only alternates (spec names three paths).
  primary: boolean
  ritual: { pathId: CultivationPathId; wayId: CultivationWayId }
  postRitual: readonly SimulationCanonicalWrite[]
  // The recipe's LIVE kit at the entry power point - `skill` origins
  // inside this set bucket as kit_skill in damageByMechanic.
  kitSkillIds: readonly string[]
  expectedEconomy: ExpectedEconomy
}

// The universal-qualified mortal source (inventory section 1): every
// alternate-way offerGate is satisfied so the SAME source can run any
// recipe. Primary (ungated) ways never consult these fields.
export function mortalSourcePlayer(): PlayerData {
  const player = createDefaultPlayer()
  player.realmId = 'mortal'
  player.realmLevel = 12 // CORE_REALM_LEVEL - the ritual gate
  player.skillLevels = { tram: 3, huy_quyen: 3 }
  player.skillCastCounts = { linh_bao: CAST_LEVELING_THRESHOLDS.linh_bao!.lv3 }
  // cuong_chien costs 1 insight; element roots cost 0. Headroom keeps
  // future recipe writes (more nodes) from silently under-funding.
  player.skillInsight = 50
  // rollVanDaoWaive rolls Math.random only when a cost-free talent is
  // selected - empty keeps recipe purchases deterministic.
  player.selectedTalentIds = []
  return player
}

function mortalBuild(): SimBuildSnapshot {
  return { player: mortalSourcePlayer(), skills: [], techniques: [] }
}

const NO_ECONOMY: ExpectedEconomy = {
  mustGenerate: [],
  mustSpend: [],
  notActiveAtThisPowerPoint: [],
  mustCast: [],
}

export const BASELINE_RECIPES: readonly BaselineRecipe[] = [
  {
    id: 'kiem_tu_hien',
    primary: true,
    ritual: { pathId: 'sword', wayId: 'sword_pathway' },
    // freshSwordPathState preset is functional at ritual - no writes.
    postRitual: [],
    // qi_refining (realmIndex 1) unlocks orb_dam only; the other orbs
    // are learned into the loadout but unreachable as basics here.
    // Combo extra-impact ops carry the bare combo id as originId
    // (tam_thich fired 178 damage under 'tam_thich', not the preset id)
    // - they are the way's own mechanic and count as kit damage. Ids
    // come through the provider's derived reachability view (INV-7
    // seals the catalog itself); at qi_refining only tam_thich [D,D,D]
    // is reachable, so higher-realm combos classify as leakage.
    kitSkillIds: ['orb_dam', ...reachableKiemPhoComboIds('qi_refining')],
    expectedEconomy: {
      ...NO_ECONOMY,
      mustCast: ['orb_dam'],
    },
  },
  {
    id: 'phap_tu_ngu_hanh',
    primary: true,
    ritual: { pathId: 'spell', wayId: 'spell_pathway' },
    // Element+route commit is the atomic canonical writer; the free
    // element root unlocks the kit basic.
    postRitual: [
      { type: 'select_phap_tu_element', element: 'fire', route: 'dot' },
    ],
    // Element-basic damage ops carry the element skill id as originId.
    // Only the recipe-resolved live set is kit: the fixed fire route
    // resolves hoa_cau_thuat at qi_refining - any other element id on
    // this row is foreign leakage and must land in other_skill.
    kitSkillIds: ['hoa_cau_thuat'],
    expectedEconomy: {
      // +5 the per landed cast (applySpellPathEssenceGains) + mana regen.
      mustGenerate: ['theGained', 'mpGained'],
      // manaShieldPercent 0.25 drains mp on hits taken.
      mustSpend: ['mpSpent'],
      // The empowered-ultimate spender is golden_core-gated.
      notActiveAtThisPowerPoint: ['theSpent'],
      mustCast: ['hoa_cau_thuat'],
    },
  },
  {
    id: 'the_tu_hien',
    primary: true,
    ritual: { pathId: 'body', wayId: 'body_pathway' },
    // cuong_chien root -> resolveBodyKit produces the kit at battle
    // build. Purchased via the public progressionOps writer.
    postRitual: [{ type: 'purchase_node', nodeId: 'cuong_chien' }],
    kitSkillIds: ['cuong_quyen', 'loan_dau', 'bat_tu_ba_the'],
    expectedEconomy: {
      // kim_cang_bat_hoai_the hp regen is the sustain channel - it
      // cycles only after the player takes damage, guaranteed in
      // attrition.
      mustGenerate: ['healingReceived'],
      mustSpend: [],
      // The* channels are hidden_body_pathway-owned - body_pathway never touches them.
      notActiveAtThisPowerPoint: ['theGained', 'theSpent'],
      mustCast: ['cuong_quyen'],
    },
  },
]

export const ALTERNATE_RECIPES: readonly BaselineRecipe[] = [
  {
    id: 'phap_tu_ngo_dao',
    primary: false,
    ritual: { pathId: 'spell', wayId: 'hidden_spell_pathway' },
    postRitual: [],
    // van_phap_tuy_tam/da_phap_lien_tuyen strikes resolve as element-
    // skill damage ops (diem_kim_thuat, tho_cau_thuat, ...) - the
    // element ids are the way's own damage surface, not foreign kit.
    kitSkillIds: [
      'van_phap_tuy_tam',
      'da_phap_lien_tuyen',
      ...Object.values(SPELL_BASICS).map((b) => b.id),
    ],
    expectedEconomy: {
      ...NO_ECONOMY,
      mustCast: ['van_phap_tuy_tam'],
    },
  },
  {
    id: 'the_tu_ung_the',
    primary: false,
    ritual: { pathId: 'body', wayId: 'hidden_body_pathway' },
    // Non-mutex roots plant the proc-window markers (ho/phan/tro_mon)
    // at battle build - without them the kit is the bare ung_the marker
    // and no reactive window ever opens (all free at qi_refining).
    postRitual: [
      { type: 'purchase_node', nodeId: 'ho_mon' },
      { type: 'purchase_node', nodeId: 'phan_mon' },
      { type: 'purchase_node', nodeId: 'tro_mon' },
    ],
    kitSkillIds: ['tham_the', 'tu_the', 'bach_ung', 'phan_kich', 'tro_kich', 'trong_phan_kich'],
    expectedEconomy: {
      mustGenerate: ['theGained'],
      // Reactive procs spend the pool (TheEconomy is hidden_body_pathway-owned).
      mustSpend: ['theSpent'],
      notActiveAtThisPowerPoint: [],
      mustCast: ['tham_the'],
    },
  },
  {
    id: 'kiem_tu_ngu',
    primary: false,
    ritual: { pathId: 'sword', wayId: 'hidden_sword_pathway' },
    postRitual: [],
    kitSkillIds: ['ngu_kiem_thuat'],
    expectedEconomy: {
      // Kiem Y / Kiem Dao gauges are buff-state on player.swordPath -
      // no ledger channel sees them (recorded limitation).
      ...NO_ECONOMY,
      mustCast: ['ngu_kiem_thuat'],
    },
  },
]

export const ALL_RECIPES: readonly BaselineRecipe[] = [
  ...BASELINE_RECIPES,
  ...ALTERNATE_RECIPES,
]

export function recipeInputs(recipe: BaselineRecipe, seed: number) {
  return { seed, build: mortalBuild(), ritual: recipe.ritual, postRitual: recipe.postRitual }
}
