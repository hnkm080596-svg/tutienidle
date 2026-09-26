// P5 - canonical baseline recipes (plan section Baseline construction,
// inventory section 1/section 2/section 6). One identical mortal source player + the real
// ritual + declared canonical post-ritual writes - the path's
// contribution is exactly what the recipe produces, nothing
// hand-tuned per path.

import { createDefaultPlayer, type PlayerData } from '../../player/Player'
import { CAST_LEVELING_THRESHOLDS } from '../../skill/SkillSystem'
import { reachableKiemPhoComboIds } from '../../kiem-tu/KiemPhoProvider'
import { SPELL_BASICS } from '../../../data/skill/TurnBasicAttacks'
import { CORE_SKILLS } from '../../../data/skill/CoreSkills'
import type { CultivationPathId, CultivationWayId } from '../../player/CultivationPathKit'
import { freshSwordPathState } from '../../kiem-tu/KiemTuState'
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
  // Optional: recipes starting from a committed way build (the ritual
  // only ever runs from mortal) omit this and carry the way state in
  // `build` instead.
  ritual?: { pathId: CultivationPathId; wayId: CultivationWayId }
  postRitual: readonly SimulationCanonicalWrite[]
  // Optional build override (F-NK-INT-5) - default mortalBuild();
  // recipes whose postRitual writes carry realm prerequisites
  // (e.g. ngu_kiem_lien at foundation_establishment) must start from
  // an elevated realm snapshot.
  build?: SimBuildSnapshot
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
  player.nodeLevels = { ...player.nodeLevels, core_tram: 3, core_huy_quyen: 3 }
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

// F-NK-INT-5 - a committed hidden_sword_pathway snapshot at
// foundation_establishment owning the whole live spine (khoi granted
// by the ritual a player would have run at mortal L12; lien bought
// with insight). chooseCultivationPath only ever accepts mortal
// realmLevel>=CORE, so a realm-elevated recipe must START committed -
// there is no canonical write that grants way state later.
// F-NK-COR-5: kiemDaoCount=2 (a forged second sword is honest
// mid-progress state) so every cast emits 2 ordered instances and the
// second actually exercises the Lien momentum multiplier - count=1
// leaves the factor pinned at 1 and the lane unmeasured.
//
// Reachable post-ritual shape (F-NK-COR-A4-1 / F-NK-AUT-A4-2): the
// offerGate requires tram Lv3 - core_tram:3 is the level authority, so
// the mortal value is inherited rather than overwritten; every leveled
// node id must appear in purchasedNodeIds (the core_* mirror rule save
// validation enforces), and the mortal precursor skills a real player
// learned stay learned (P7-M4 learned-set membership).
function hiddenNguFoundationBuild(): SimBuildSnapshot {
  const player = mortalSourcePlayer()
  player.realmId = 'foundation_establishment'
  player.realmLevel = 1
  player.cultivationPath = 'sword'
  player.cultivationWay = 'hidden_sword_pathway'
  player.swordPath = { ...freshSwordPathState(), kiemDaoCount: 2 }
  player.nodeLevels = {
    ...player.nodeLevels,
    core_ngu_kiem_thuat: 1,
    ngu_kiem_khoi: 1,
    ngu_kiem_lien: 1,
  }
  player.purchasedNodeIds = [
    'core_tram',
    'core_huy_quyen',
    'core_ngu_kiem_thuat',
    'ngu_kiem_khoi',
    'ngu_kiem_lien',
  ]
  // Mortal precursors remain learned: core_tram:3 -> tram L3, the
  // linh_bao cast count sits at its Lv3 threshold, core_huy_quyen:3 ->
  // huy_quyen L3. ngu_kiem_thuat itself is a kit-minted
  // TurnSkillDefinition, not a Skill - it never enters this list.
  const precursor = (id: string, level: number) => {
    const def = CORE_SKILLS.find((skill) => skill.id === id)
    if (def === undefined) {
      throw new Error(`missing precursor skill def ${id}`)
    }
    return { ...def, level }
  }
  const skills = [
    precursor('tram', 3),
    // linh_bao cast count sits at its Lv3 threshold -> learned at L3.
    precursor('linh_bao', 3),
    precursor('huy_quyen', 3),
  ]
  return { player, skills, techniques: [] }
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
    // are learned into the role kit but unreachable as basics here.
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
    // Beta: the live kit at this entry power point is the basic ONLY -
    // Loan Dau unlocks via the Truc Co core grant and Bat Tu Ba The is
    // post-beta, so neither can mint an originId here.
    kitSkillIds: ['cuong_quyen'],
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
    // F-NK-INT-5 - committed build (khoi+lien owned) so the benchmark
    // exercises the momentum lane, not just the ritual-granted khoi.
    // The ritual itself only accepts mortal, so it cannot produce this
    // state -- the snapshot models post-ritual foundation play.
    build: hiddenNguFoundationBuild(),
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
  return {
    seed,
    build: recipe.build ?? mortalBuild(),
    ...(recipe.ritual ? { ritual: recipe.ritual } : {}),
    postRitual: recipe.postRitual,
  }
}
