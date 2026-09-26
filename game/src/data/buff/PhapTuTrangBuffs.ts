import type { BuffDefinition } from '../../core/buff2/BuffDefinition'
import type { CapabilityGrantDefinition } from '../../core/battle/contracts/capability'

// Phap Tu Reimagine (2026-09-26 spec) -- "Phap Trang" windows and their
// per-target markers.
//
// A Special cast applies its element's window buff on the caster for
// PHAP_TRANG_TURNS holder turns (recast keep+refresh). Window markers
// live on the TARGET and are bound to the window that spawned them via
// `boundToSourceBuffId` (spec D10): when the window expires, every bound
// marker dies with it.
//
// DEFERRED-TO-ENGINE fields (typed by the engine slice, named here by
// spec): BuffDefinition.boundToSourceBuffId; CapabilityGrantDefinition
// type 'periodic_growth' payload {definitionId, stacks, consume}.

/** Window length in the caster's holder-turn clock (authored, TBD). */
export const PHAP_TRANG_TURNS = 3
/** Kim Liet hard cap per target per window (design sec.60: "about 3"). */
export const KIM_LIET_MAX_STACKS = 3
/** Trong The threshold consumed per delay proc (authored, TBD). */
export const TRONG_THE_THRESHOLD = 3

const WINDOW_STACKING = { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'refresh' } as const
const PER_SOURCE = { instanceScope: 'per_source' } as const
const PER_TARGET = { instanceScope: 'per_target', sourceOwnership: 'latest' } as const
const WINDOW_LIFETIME = { clock: 'holder_turns', duration: PHAP_TRANG_TURNS, scaling: 'fixed' } as const
// Bound markers carry no tick of their own -- the window's expiry removes
// them (D10), so they persist until that binding fires.
const BOUND_LIFETIME = { clock: 'permanent', scaling: 'fixed' } as const

function cap(id: string, type: string, payload: unknown): CapabilityGrantDefinition {
  return { id, type, payload }
}

// ---------------------------------------------------------------------------
// Phap Trang windows (one per special; water keeps the existing thanh_tuyen
// regen buff, which stays authored in ThuanHeBuffs.ts).
// ---------------------------------------------------------------------------

/** Tam Muoi -- fire window: new own-source Hoa An applications gain
    potency (the basic carries the whenSourceBuff-gated add_modifier). */
export const TAM_MUOI_BUFF: BuffDefinition = {
  id: 'tam_muoi',
  name: 'Tam Muội',
  description: 'Tam Muội Chân Hỏa thiêu đốt — Hỏa Ấn gieo trong trạng thái này mạnh hơn hẳn.',
  kind: 'buff',
  polarity: 'buff',
  ...PER_SOURCE,
  stacking: WINDOW_STACKING,
  lifetime: WINDOW_LIFETIME,
  dispellable: false,
}

/** Van Moc -- wood window: first own-source Moc application on each
    target marks it Sinh Co; the marker's periodic_growth capability then
    adds +1 Doc Can stack at that target's next natural ailment tick and
    consumes itself (design sec.52/53). */
export const VAN_MOC_BUFF: BuffDefinition = {
  id: 'van_moc',
  name: 'Vạn Mộc',
  description: 'Vạn Mộc Sinh Cơ — Mộc kình gieo lên địch nuôi một nhịp sinh trưởng chậm.',
  kind: 'buff',
  polarity: 'buff',
  ...PER_SOURCE,
  stacking: WINDOW_STACKING,
  lifetime: WINDOW_LIFETIME,
  dispellable: false,
}

/** Kim Y -- metal window: each landed metal Basic on a primary target
    adds one Kim Liet stack there; each stack deepens the caster's
    skill-local penetration against that target (design sec.57-60). */
export const KIM_Y_BUFF: BuffDefinition = {
  id: 'kim_y',
  name: 'Kim Ý',
  description: 'Kim Ý Ngưng Phong — đòn Kim dồn một mục tiêu càng đánh càng xuyên.',
  kind: 'buff',
  polarity: 'buff',
  ...PER_SOURCE,
  stacking: WINDOW_STACKING,
  lifetime: WINDOW_LIFETIME,
  dispellable: false,
}

/** Trong Nhac -- earth window: each landed earth Basic on the primary
    target adds one Trong The stack; at TRONG_THE_THRESHOLD stacks the
    target's next action is delayed once per window (design sec.64-66). */
export const TRONG_NHAC_BUFF: BuffDefinition = {
  id: 'trong_nhac',
  name: 'Trọng Nhạc',
  description: 'Trọng Nhạc — đòn Thổ dồn trọng áp, tích đủ sẽ đè trễ nhịp địch.',
  kind: 'buff',
  polarity: 'buff',
  ...PER_SOURCE,
  stacking: WINDOW_STACKING,
  lifetime: WINDOW_LIFETIME,
  dispellable: false,
}

// ---------------------------------------------------------------------------
// Window markers (per-target, bound to their window).
// ---------------------------------------------------------------------------

/** Sinh Co -- stamped on a target by the window's landedConsequences
    (gated on sinh_co_chu absence); the periodic_growth grant grows the
    caster's own Doc Can instance once, then the consume flag removes the
    marker. */
export const SINH_CO_MARKER: BuffDefinition = {
  id: 'sinh_co',
  name: 'Sinh Cơ',
  description: 'Hạt sinh cơ Mộc nẩy mầm — Trúng Độc sẽ tự tăng một tầng.',
  kind: 'marker',
  ...PER_TARGET,
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'keep' },
  lifetime: BOUND_LIFETIME,
  boundToSourceBuffId: 'van_moc',
  capabilities: [
    cap('sinh_co.growth', 'periodic_growth', {
      definitionId: 'doc_can',
      stacks: 1,
      consume: true,
    }),
  ],
  dispellable: false,
}

/** Sinh Co Chu -- "already sprouted" latch on the CASTER (per_source):
    the window seeds Sinh Co at most once per cast (spec D11). Bound to
    the caster's own van_moc instance -- dies with the window. */
export const SINH_CO_CHU_MARKER: BuffDefinition = {
  id: 'sinh_co_chu',
  name: 'Sinh Cơ Chu',
  description: 'Dấu ấn sinh cơ đã gieo — trạng thái này chỉ nảy mầm một lần.',
  kind: 'marker',
  ...PER_SOURCE,
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'keep' },
  lifetime: BOUND_LIFETIME,
  boundToSourceBuffId: 'van_moc',
  dispellable: false,
}

/** Kim Liet -- per-target pierce buildup read by the metal basic's
    penetrationFromStacks on its primary hit (reads stacks present before
    the hit lands; the new stack is added after -- design sec.59). */
export const KIM_LIET_MARKER: BuffDefinition = {
  id: 'kim_liet',
  name: 'Kim Liệt',
  description: 'Vết liệt tích lũy — đòn Kim của đối phương xuyên sâu hơn.',
  kind: 'marker',
  ...PER_TARGET,
  stacking: { maxStacks: KIM_LIET_MAX_STACKS, onReapplyStacks: 'add', onReapplyDuration: 'keep' },
  lifetime: BOUND_LIFETIME,
  boundToSourceBuffId: 'kim_y',
  dispellable: false,
}

/** Trong The -- per-target pressure buildup; reaching TRONG_THE_THRESHOLD
    consumes the threshold and delays the target's next action once per
    window (trong_the_da_bi latch). */
export const TRONG_THE_MARKER: BuffDefinition = {
  id: 'trong_the',
  name: 'Trọng Thế',
  description: 'Trọng áp dồn nén — tích đủ ba tầng sẽ đè trễ nhịp hành động.',
  kind: 'marker',
  ...PER_TARGET,
  stacking: { maxStacks: TRONG_THE_THRESHOLD, onReapplyStacks: 'add', onReapplyDuration: 'keep' },
  lifetime: BOUND_LIFETIME,
  boundToSourceBuffId: 'trong_nhac',
  dispellable: false,
}

/** Trong The Da Bi -- anti-lock latch: the window may delay each target
    at most once (design sec.66). */
export const TRONG_THE_DA_BI_MARKER: BuffDefinition = {
  id: 'trong_the_da_bi',
  name: 'Trọng Thế Đã Bị',
  description: 'Trọng áp đã bùng — mục tiêu này không bị đè trễ lần nữa trong trạng thái này.',
  kind: 'marker',
  ...PER_TARGET,
  stacking: { maxStacks: 1, onReapplyStacks: 'keep', onReapplyDuration: 'keep' },
  lifetime: BOUND_LIFETIME,
  boundToSourceBuffId: 'trong_nhac',
  dispellable: false,
}

export const PHAP_TU_TRANG_BUFFS: readonly BuffDefinition[] = [
  TAM_MUOI_BUFF,
  VAN_MOC_BUFF,
  KIM_Y_BUFF,
  TRONG_NHAC_BUFF,
  SINH_CO_MARKER,
  SINH_CO_CHU_MARKER,
  KIM_LIET_MARKER,
  TRONG_THE_MARKER,
  TRONG_THE_DA_BI_MARKER,
]
