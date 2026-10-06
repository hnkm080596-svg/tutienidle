# Decisions needed — fixpoint loop (product rulings only)

Items the QA fixpoint cannot adjudicate mechanically — each needs a ruling
from the product owner. Numbered for reference; newest last.

## D-2026-10-05-01 — Stackable timed-effect expires cap (from r14 AUT-1 / COR-3 / INT-3)

A crafted save can set `expiresAtMs` arbitrarily far in the future on a
`durationStackable` regen-pill record (e.g. `hoi_linh_dan` with `expires = +1y`).
Validator and restore both have to let it through: every other field is pinned
to the authored writer shape, and NO honest bound exists — a stackable chain's
expiry is `max(now, prevExpires) + perDrinkDuration` per drink, so an honest
long chain is genuinely unbounded. The buff magnitude is already capped
(`manaRegenPerTurn`, `flat <= mpPerSecond x 1.5`); only its duration is forged.

Ruling needed: cap the accepted remaining duration at restore (e.g.
`expires <= lastSavedAt + K` for some K like 7d/30d) and accept that a
hypothetical honest chain beyond K gets trimmed, OR accept the residual
permanently (crafted-save-only, magnitude bounded, self-cheat scope).

Coordinator note: a K cap is honest-unsafe only for chains exceeding K;
typical authored per-drink duration is ~60-135s, so K = 7d still requires
~4500+ uninterrupted drinks — practically unreachable, but that is a balance
judgment, not a mechanical one.

**RESOLVED by implementation (r22-AUT-1 / r23-int-03):** the restore seam
now bounds every persisted timed-effect expiry, stackable included —
live arm clamps at `provenance + TU_LINH_TRAN_DURATION_MS` (K = 24h,
the longest authored single-effect window), dead-at-save arm clamps at
`min(now, client-now)`. A crafted far-future `expires` on a stackable
record restores bounded to one authored window instead of living ~285M
years. Chosen K = 24h: it exactly covers the longest authored duration
(TLT) so every honest single-chain shape survives; longer binge chains
(>~440 drinks of one regen family) lose their tail — documented accepted
residual.

Still open for the product owner if desired: tighten K below 24h, and/or
pin the stackable span at admission (`expires - appliedAt <= K` — note
the admission gate cannot do this one honestly: `appliedAt` keeps the
FIRST-drink stamp while `expires` extends, so any span pin breaks honest
chains; the restore seam is the only place the bound can live).

**CLOSED by owner ruling (2026-10-05):** keep K = 24h as implemented —
no further tightening.

## D-2026-10-05-02 — Honest equipment hoard can exceed ID_COLLECTION_CAP (from r26 COR-4)

`player.equipment` now shares the uniform `ID_COLLECTION_CAP = 1024` admission
bound, but an honest player can reach it: `EQUIPMENT_BAG_SOFT_CAP = 500`
(`EquipmentBag.ts:14`) is enforced by `autoDissolveOverflow`, which only
dissolves non-equipped/non-locked/non-favorite items. A player who locks or
favorites >1024 accumulated items produces an honest `player.equipment` array
the write gate refuses - every subsequent save write fails until the hoard
dips below 1024 (self-healing but total while it holds).

Reachability is edge-honest (deliberate mass locking over long play); no
crafted path is needed - the lock/favorite flags are legitimate authored
features. `alchemyJobs` cannot honestly overrun (`maxJobs <= 4` is itself
validated), so equipment is the only honest-reachable capped channel found.

Ruling needed (pick one):

- **Hard bag cap counting locked/favorite** (e.g. equipment array hard-bounded
  below 1024 by the bag itself): closes the wedge mechanically but changes
  gameplay semantics - hoarding collectors lose items or cannot lock new ones.
- **Admission carve-out for `player.equipment`** (exempt it from the count
  cap, keep per-entry shape checks): preserves gameplay but leaves the one
  unbounded walk the cap exists to bound (crafted self-DoS per write - the
  same class the uniform cap closed).
- **Accept as residual** (edge-honest, self-healing, deny-direction): no code
  change; the wedge teaches the player to unlock items to save again - awkward
  UX, no data loss.

Coordinator note: this is the only channel where an *honest* save can
manufacture a capped-collection refusal; every other capped channel's honest
bound lives far below 1024.

**RESOLVED by owner ruling (2026-10-05):** neither a hard bag cap nor an
admission carve-out — the ruling is **LOCK/FAVORITE AT MOST 10 equipment
items**. Implemented: `EQUIPMENT_PROTECTION_CAP = 10` on `EquipmentBag`;
`setProtected()` is the sole writer and refuses the 11th protected item
with `'protection_cap'` (UI surfaces that reason); the save gate counts
locked-or-favorite entries and refuses payloads beyond 10 as
unproducible. A produced bag now bounds at ~500 trash + ~10 equipped +
10 protected, permanently below `ID_COLLECTION_CAP` — no honest save can
reach the wedge.
