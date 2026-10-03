import type { MainStatKey, StatType } from './StatTypes'
import { MAIN_STAT_KEYS } from './StatTypes'
import type { BaseStats, Stats } from './StatBlock'
import { applyDomainGate, type StatDomain } from './StatDomain'

export type ModifierSourceType =
  | 'realm'
  | 'technique'
  | 'skill'
  | 'buff'
  | 'debuff'
  | 'equipment'
  | 'talent'
  | 'reincarnation'
  | 'pill'
  | 'formation'
  | 'talisman'
  // 'attribute': modifier tu sinh ra boi deriveAttributeModifiers() ben
  // duoi (dan xuat tu 5 attribute goc) - khong phai nguon nao tao tay.
  | 'attribute'

export interface StatModifier {
  id: string

  sourceId: string

  sourceType: ModifierSourceType

  stat: StatType

  // Phan nhom tang Increased (LE tach "Increased Fire Damage" khoi
  // "Increased Damage" chung - moi nhom tu cong don roi nhan RIENG,
  // xem runPipeline()). KHONG khai = roi vao pool chung (untagged),
  // hanh vi giu nguyen nhu truoc khi co field nay.
  tag?: string

  // D10 domain gate: the domain this modifier claims to belong to
  // (authorial intent - see StatDomain.ts). Absent = universal intent:
  // may move universal stats but never a gated one. Optional on
  // purpose: existing content compiles and behaves unchanged while
  // STAT_DOMAIN is empty.
  domain?: StatDomain

  flat?: number

  percent?: number

  multiplier?: number

  stacks?: number

  maxStacks?: number

  perLevelFlat?: number

  perLevelPercent?: number
}

// Tang Attribute goc (Can Cot/Than Phap/Than Thuc/Linh Can/The Chat) -
// dan xuat ra stat phai sinh, KHONG co UI phan bo diem rieng: attribute
// chi la StatType nhu moi stat khac, nhan modifier qua dung pipeline
// hien co (equipment/technique/buff/pill), calculateStats() tu dong
// quy doi ra bonus moi lan tinh lai. So lieu duoi day la khoi diem
// hop ly, can tinh chinh qua playtest, khong phai so chot cung.
const ATTRIBUTE_MIGHT_PER_POINT = 0.6
const ATTRIBUTE_DEFENSE_PER_POINT = 0.4
// stat-system-reimagined Task 8 (D7): speed removed from ALL attribute
// derivation -- no attribute axis may grant tempo (INV-2). Speed is the
// dominant ATB stat by design; its sources are scarce authored grants
// (D1), never a free by-product of point allocation.
const ATTRIBUTE_ACCURACY_PER_POINT = 1.5
const ATTRIBUTE_EVASION_PER_POINT = 1.0
const ATTRIBUTE_CRIT_RATE_PERCENT_PER_POINT = 0.0005
const ATTRIBUTE_AILMENT_RESIST_PER_POINT = 0.002
// D8/D9: Than Than (intelligence) is the control/DoT axis -- gains
// ailmentPotencyPercent as a flat absolute (percent pool on base 0
// would be a no-op). Symmetric with ailmentResistPercent, playtest-tunable.
const ATTRIBUTE_AILMENT_POTENCY_PER_POINT = 0.002
const ATTRIBUTE_CRIT_DAMAGE_PERCENT_PER_POINT = 0.003
const ATTRIBUTE_ELEMENT_POWER_PER_POINT = 0.5
const ATTRIBUTE_MAX_HP_PER_POINT = 8
const ATTRIBUTE_HP_REGEN_PER_POINT = 0.1
// The Tu Reimagined (spec 2026-09-15 section 3.3): vitality ->
// enduranceThreshold moved OUT of the universal derivation into the
// body domain channel (bodyEnduranceModifiers in TheTuPath.ts;
// the deriver is declared on the way facet's deltaDerivers and
// registered from the catalog by CultivationPathSystem).

// Linh Can (Attunement) hap thu nguyen vai tro "do thien hanh" cu cua
// ElementAffinity (da xoa - luon = 0 voi player, chi co y nghia that
// voi enemy) - 1 diem Linh Can tang deu sat thuong CA 6 hanh (ke ca
// Hon Nguyen), dung nghia "linh can tot thi dung thuat phap hanh nao
// cung manh hon", khong thien vi 1 hanh cu the. Spec
// 2026-08-30-phap-tu-dao-sac sec5 - Phong/Loi da bo toan he nen khong
// con trong danh sach nay.
const ATTUNEMENT_POWER_STATS: { stat: StatType; tag: string }[] = [
  { stat: 'woodPower', tag: 'wood' },
  { stat: 'firePower', tag: 'fire' },
  { stat: 'earthPower', tag: 'earth' },
  { stat: 'metalPower', tag: 'metal' },
  { stat: 'waterPower', tag: 'water' },
  { stat: 'primordialPower', tag: 'primordial' },
]

function flatAttributeModifier(sourceId: string, stat: StatType, amount: number): StatModifier {
  return {
    id: `attribute:${sourceId}:${stat}`,
    sourceId,
    sourceType: 'attribute',
    stat,
    flat: amount,
  }
}

function percentAttributeModifier(
  sourceId: string,
  stat: StatType,
  amount: number,
  tag?: string,
): StatModifier {
  return {
    id: `attribute:${sourceId}:${stat}${tag ? `:${tag}` : ''}`,
    sourceId,
    sourceType: 'attribute',
    stat,
    percent: amount,
    tag,
  }
}

// Linh Can CAO thi hanh dang tu luyen cang "thuan" - % nho Increased
// rieng theo TUNG hanh (tag = ten hanh), tach biet khoi pool Increased
// chung cua stat do (vd equipment/technique "+X% Increased Fire
// Damage" sau nay cung gan tag 'fire' de cong don DUNG vao chung pool
// nay, khong lan vao pool tong quat) - minh hoa tag-hierarchy Increased.
const ATTRIBUTE_ELEMENT_TAG_PERCENT_PER_POINT = 0.001

// Parameter narrowed to the 5 main stats (M9): this function only reads
// attribute values, so callers may pass either a full Stats snapshot
// (calculateStats pass 2) or a per-stat DELTA object
// (calculateEffectiveStats live-modifier delta pass).
function deriveAttributeModifiers(finalized: Pick<Stats, MainStatKey>): StatModifier[] {
  const modifiers: StatModifier[] = [
    flatAttributeModifier('strength', 'might', finalized.strength * ATTRIBUTE_MIGHT_PER_POINT),
    flatAttributeModifier('strength', 'defense', finalized.strength * ATTRIBUTE_DEFENSE_PER_POINT),

    flatAttributeModifier(
      'dexterity',
      'accuracyRating',
      finalized.dexterity * ATTRIBUTE_ACCURACY_PER_POINT,
    ),
    flatAttributeModifier(
      'dexterity',
      'evasionRate',
      finalized.dexterity * ATTRIBUTE_EVASION_PER_POINT,
    ),
    percentAttributeModifier(
      'dexterity',
      'criticalRate',
      finalized.dexterity * ATTRIBUTE_CRIT_RATE_PERCENT_PER_POINT,
    ),

    percentAttributeModifier(
      'intelligence',
      'criticalDamage',
      finalized.intelligence * ATTRIBUTE_CRIT_DAMAGE_PERCENT_PER_POINT,
    ),
    flatAttributeModifier(
      'intelligence',
      'ailmentResistPercent',
      finalized.intelligence * ATTRIBUTE_AILMENT_RESIST_PER_POINT,
    ),
    flatAttributeModifier(
      'intelligence',
      'ailmentPotencyPercent',
      finalized.intelligence * ATTRIBUTE_AILMENT_POTENCY_PER_POINT,
    ),

    flatAttributeModifier('vitality', 'maxHp', finalized.vitality * ATTRIBUTE_MAX_HP_PER_POINT),
    flatAttributeModifier(
      'vitality',
      'hpRegenPerTurn',
      finalized.vitality * ATTRIBUTE_HP_REGEN_PER_POINT,
    ),
  ]

  for (const { stat, tag } of ATTUNEMENT_POWER_STATS) {
    modifiers.push(
      flatAttributeModifier(
        'attunement',
        stat,
        finalized.attunement * ATTRIBUTE_ELEMENT_POWER_PER_POINT,
      ),
    )
    modifiers.push(
      percentAttributeModifier(
        'attunement',
        stat,
        finalized.attunement * ATTRIBUTE_ELEMENT_TAG_PERCENT_PER_POINT,
        tag,
      ),
    )
  }

  return modifiers
}

// Key untagged (pool "Increased X" chung) trong bang `increased` ben
// duoi - tach biet khoi cac tag pool cu the (vd 'fire').
const UNTAGGED = ''

/**
 * 1 luot Added -> Increased -> More cho TOAN BO stat, dung chung boi
 * ca 2 pass cua calculateStats() ben duoi.
 *
 * SUA loi so voi ban truoc: "Increased" (percent) gio CONG DON theo
 * CUNG STAT truoc roi moi nhan 1 LAN - truoc day moi nguon percent tu
 * nhan rieng (compound), khien nhieu modifier percent nho cong don
 * MANH hon dang ke so voi y nghia ban dau cua field nay (2 nguon
 * +20% tung cho ra x1.44 thay vi x1.40 dung ra phai co). "More"
 * (multiplier) giu nguyen hanh vi nhan tuan tu - dung y nghia goc.
 *
 * Tag-hierarchy Increased (LE that): modifier co `tag` (vd 'fire') roi
 * vao 1 pool RIENG cho (stat, tag) do, tu cong don noi bo roi nhan nhu
 * 1 TANG multiplier DOC LAP voi pool chung (untagged) - "+20% Increased
 * Fire Damage" va "+20% Increased Damage" ra x1.2 x x1.2 = x1.44,
 * khong gop chung 1 pool x1.4 nhu 2 nguon cung tag. Modifier khong
 * khai `tag` luon roi vao pool chung - 100% content hien co (chua
 * dung field moi) hanh vi giu nguyen khong doi.
 */
function runPipeline(base: Stats, modifiers: StatModifier[]): Stats {
  const result = { ...base }

  const added: Partial<Record<StatType, number>> = {}
  const increased: Map<StatType, Map<string, number>> = new Map()
  const more: Partial<Record<StatType, number[]>> = {}

  for (const modifier of modifiers) {
    const stacks = modifier.stacks ?? 1

    if (modifier.flat !== undefined) {
      added[modifier.stat] = (added[modifier.stat] ?? 0) + modifier.flat * stacks
    }

    if (modifier.percent !== undefined) {
      const tagKey = modifier.tag ?? UNTAGGED

      const pools = increased.get(modifier.stat) ?? new Map<string, number>()

      pools.set(tagKey, (pools.get(tagKey) ?? 0) + modifier.percent * stacks)

      increased.set(modifier.stat, pools)
    }

    if (modifier.multiplier !== undefined) {
      const list = more[modifier.stat] ?? (more[modifier.stat] = [])

      for (let i = 0; i < stacks; i++) {
        list.push(modifier.multiplier)
      }
    }
  }

  for (const stat of Object.keys(result) as StatType[]) {
    let value = base[stat] + (added[stat] ?? 0)

    for (const poolPercent of (increased.get(stat) ?? new Map()).values()) {
      value *= 1 + poolPercent
    }

    for (const mult of more[stat] ?? []) {
      value *= mult
    }

    result[stat] = value
  }

  return result
}

/**
 * 2 luot: luot 1 tinh du moi modifier THAT (equipment/technique/buff/
 * ...) de CHOT gia tri 5 attribute; luot 2 dan xuat bonus tu attribute
 * da chot roi hoa CHUNG vao dung pool Added/Increased cua stat dich
 * (vd attribute-derived +might hoa chung pool voi +might tu trang
 * bi, % tang toc danh tu Dexterity hoa chung pool % tu buff...) -
 * chu ky ham KHONG doi nen moi call site hien co (BattleSystem, store
 * player.ts) tu dong nhan ca 2 sua doi (Increased + Attribute) ma
 * khong can sua gi them.
 */
export function calculateStats(baseStats: BaseStats, modifiers: StatModifier[]): Stats {
  // D10: the domain gate runs before any pipeline work; with an empty
  // STAT_DOMAIN registry every modifier passes through unchanged.
  const accepted = applyDomainGate(modifiers)

  const pass1 = runPipeline(baseStats, accepted)

  const attributeModifiers = deriveAttributeModifiers(pass1)

  return runPipeline(baseStats, [...accepted, ...attributeModifiers])
}

/**
 * D12 ordering contract (stat-system-reimagined spec section 5): runs ONE
 * runPipeline pass over base + persistent modifiers and returns the 5
 * resolved attribute values. Assembly call sites use the totals to emit
 * domain-gated modifiers (spell attunement -> MP) BEFORE calculateStats
 * -- the read is not a second derivation, and the emitted modifiers feed
 * back through the single pipeline (INV-6 intact).
 */
export function resolveAttributeTotals(
  base: Stats,
  modifiers: StatModifier[],
): Pick<Stats, MainStatKey> {
  const resolved = runPipeline(base, modifiers)
  const totals = {} as Pick<Stats, MainStatKey>

  for (const key of MAIN_STAT_KEYS) {
    totals[key] = resolved[key]
  }

  return totals
}

// D12: a domain may register a deltaDeriver so its attribute-reactive
// stats re-emit gated deltas inside calculateEffectiveStats, alongside
// the universal deriveAttributeModifiers pass. The contract derives only
// deltas, never the base -- exactly like the universal delta pass.
// Registration order is invocation order; domains with no
// attribute-reactive stats never register (no-op by absence).
//
// Review fix (2026-09-15): derivers are globally registered but must run
// ONLY for entities that own the domain - the caller declares the
// entity's domains via EffectiveStatContext. A globally-registered
// spell deriver would otherwise leak maxMp/manaRegenPerTurn onto a
// sword entity that gains attunement mid-battle.
export interface EffectiveStatContext {
  // Stat domains the entity owns (player path -> its domain; enemies and
  // context-free callers declare none). A domain's deltaDeriver runs only
  // when present here. Absent = universal delta derivation only.
  readonly activeDomains?: ReadonlySet<StatDomain>
}

export type DomainDeltaDeriver = (
  attributeDelta: Pick<Stats, MainStatKey>,
  context: EffectiveStatContext,
) => StatModifier[]

const DOMAIN_DELTA_DERIVERS = new Map<StatDomain, DomainDeltaDeriver>()

export function registerDomainDeltaDeriver(domain: StatDomain, deriver: DomainDeltaDeriver): void {
  const existing = DOMAIN_DELTA_DERIVERS.get(domain)

  // Review cycle (M4-followup) - two ways sharing a domain must register
  // the SAME deriver instance (the phap ways share one facet object); a
  // different function overwriting silently would flip the delta channel
  // for a domain another way owns.
  if (existing !== undefined && existing !== deriver) {
    throw new Error(`[stats] domain delta deriver conflict on '${domain}' — refusing to overwrite a different deriver`)
  }

  DOMAIN_DELTA_DERIVERS.set(domain, deriver)
}

/** Test/debug escape hatch -- production code registers once at module load. */
export function unregisterDomainDeltaDeriver(domain: StatDomain): void {
  DOMAIN_DELTA_DERIVERS.delete(domain)
}

/**
 * Effective battle stats (R2 / AR-02): fold TEMPORARY battle modifiers
 * (turn buffs, live passive/persistent/timed modifiers) on top of an
 * ALREADY-RESOLVED base. The input must be calculateStats() output (or
 * an equivalent already-normalized stat snapshot) - calculateStats()
 * remains the only full attribute-derivation owner.
 *
 * ARCH-009-adjacent retained debt (M7 -> M9): live modifiers may move
 * the 5 main stats mid-battle (e.g. passive_dai_thua_dao_tam stacking
 * attunement on every landed hit). The resolved base already carries
 * the derivation of ITS OWN attribute values, so re-running
 * deriveAttributeModifiers() on the effective attribute totals would
 * double-count the base. Instead we derive ONLY the DELTA:
 *
 *   effective  = runPipeline(resolvedBase, tempModifiers)
 *   delta[i]   = effective[main_i] - resolvedBase[main_i]
 *   result     = runPipeline(effective, deriveAttributeModifiers(delta))
 *
 * The derived delta folds AFTER the temp-modifier pools (Added into
 * Added, per-tag Increased into its own tag pool) - equivalent to the
 * menu view's single-pass derivation up to pool-fold ordering: the
 * delta's tag pools multiply the already-folded result instead of
 * merging into the same tag sum, so the battle value diverges from the
 * menu value in ONE direction (below it for positive deltas in the
 * authored range). The divergence is bounded, not sub-percent:
 * ~1% at moderate deltas, ~3.3% at the authored cap (50 stacks x
 * attunement 100), ~5% at attunement 200/cap - documented in the M9
 * report. A live main-stat modifier that nets to zero changes nothing.
 */
export function calculateEffectiveStats(
  resolvedBase: Stats,
  tempModifiers: StatModifier[],
  context: EffectiveStatContext = {},
): Stats {
  // D10: same delivery gate as calculateStats - a universal/absent-domain
  // temp modifier can never move a gated stat mid-battle either.
  const accepted = applyDomainGate(tempModifiers)

  const effective = runPipeline(resolvedBase, accepted)

  const attributeDelta = {} as Pick<Stats, MainStatKey>
  let hasDelta = false

  for (const key of MAIN_STAT_KEYS) {
    const delta = effective[key] - resolvedBase[key]
    attributeDelta[key] = delta
    if (delta !== 0) {
      hasDelta = true
    }
  }

  if (!hasDelta) {
    return effective
  }

  const deltaModifiers = deriveAttributeModifiers(attributeDelta)

  // D12: domain deltaDerivers run after the universal delta derivation --
  // e.g. spell re-emits attunement->MP as domain-gated delta modifiers.
  // Each runs ONLY when the entity owns that domain (context-active).
  for (const [domain, deriver] of DOMAIN_DELTA_DERIVERS) {
    if (context.activeDomains?.has(domain)) {
      deltaModifiers.push(...deriver(attributeDelta, context))
    }
  }

  // Review fix (2026-09-15) - deriver-emitted modifiers are
  // system-generated, so the runtime gate is their ONLY guard
  // (architecture whitelist scans authored data/** only). A deriver
  // emitting a wrong-domain gated stat must hit the same wall as any
  // other modifier source.
  return runPipeline(effective, applyDomainGate(deltaModifiers))
}

export function addStack(modifier: StatModifier, amount = 1) {
  const current = modifier.stacks ?? 0

  let newStacks = current + amount

  if (modifier.maxStacks !== undefined) {
    newStacks = Math.min(newStacks, modifier.maxStacks)
  }

  modifier.stacks = newStacks
}
