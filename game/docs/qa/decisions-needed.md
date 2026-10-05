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
