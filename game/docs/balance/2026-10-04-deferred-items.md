# Deferred items — 2026-10-04 (per Minh rulings)

Small follow-ups deliberately parked during the beta-balance wave.
Owner noted per item; none block beta.

## Cooldown tooltip (UI — Codex)

Skill icons/hotbar should surface the remaining cooldown on hover/tap
(số giây còn lại + tổng CD của chiêu). Minh: "cd tooltip thêm vào sau,
note lại." Nice-to-have polish; implement with the next UI pass on the
combat HUD/skill dock.

## Vendor price hint (UI — Codex)

One-line hint near the vendor sell action: "nguyên liệu cảnh giới thấp
hơn mới bán được" so Phàm Nhân players understand why higher-tier
herbs/materials cannot be sold yet. Flagged by the economy review
(`2026-10-04-economy-review.md`); design direction already approved.

## Reaction identity (design — no action)

The 2-ấn reaction requirement is intentional: reactions are the Pháp Tu
Ẩn pathway's signature, not a general solo-element mechanic. Keep as
designed; revisit only if a second playable way ships.

## Tribulation defense floor (design — keep)

Độ Kiếp Trúc Cơ needs def ≥ ~130; strength-first builds must respec
into vitality. Minh: "Khó là tốt, khó mới cần idle" — keep the gate.

## Beta-scope predicate duplication (UI — Codex)

A few `.vue` components carry a locally duplicated beta-scope predicate
instead of importing the canonical helpers from `src/core/betaScope*`
(fixpoint AUT-UI-1, Low). Harmless while the scope stays fire-only;
consolidate into the shared predicates on the next UI pass on those
files so future scope changes can't drift. `PlayerVisualProfiles.ts`
has the same duplication in non-UI code — same cleanup, optional.
