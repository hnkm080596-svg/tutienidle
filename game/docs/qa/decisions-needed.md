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
