# QA Quick — R14 leftover: R9 paid-random static guard (2026-09-14)

Verdict: **PASS WITH EVIDENCE**

## Scope

Roadmap R14 guard list had one unshipped row: "paid random result
requires domain capability/token — R9 contract already has runtime
ticket validation; static guard not yet shipped". This adds the static
guard only; the runtime contract itself was verified at R9 and is
pinned here, not reimplemented.

## Guard coverage (`tests/architecture/paidRandomContract.test.ts`)

- `washPendingSlot.set(` / `nextTicketId(` occur only inside
  `core/equipment/EquipmentWash.ts` — the domain owner. Comment-blind
  corpus scan across `src/**`.
- `commitWashAffixes` clears the pending slot BEFORE validating the
  ticket (consume-every-attempt) and applies `pending.affixes` — the
  domain-held roll; its signature takes `ticketId`, never an affix
  payload.
- `previewWashAffixes` calls `rollWashAffixes` (the cost-paying roll)
  before `washPendingSlot.set` — cost precedes ticket issuance.
- `getWashPreviewAffixes` returns `pending.affixes.map(...)` — a display
  copy; returning the live array is explicitly forbidden.
- `pendingRefinePreview` is referenced only inside `EquipmentSystem.ts`
  (instance-owned preview capability).
- `EquipmentWash` has exactly one production importer
  (`core/equipment/EquipmentSystem.ts`) — adapters use the
  GameManager/EquipmentOpsSystem method surface
  (`previewWashItem`/`commitWashItem`/`discardWashTicket`/
  `getWashPreviewAffixes`), verified: `useEquipmentActions.ts` calls
  only the manager surface.

## Falsifiability

- Planted probe `src/core/probe_paid_random.ts` containing
  `washPendingSlot.set(null)` → the domain-owner check failed as
  designed; probe file removed afterwards. The remaining checks are
  signature/body-anchored: reordering consume-after-validate, returning
  the live array, or accepting caller affixes would each trip a
  dedicated assertion.

## Verification

- `npm run type-check` — clean.
- `npx vitest run tests/architecture/` — 23 files / 87 tests pass.
- Test-only change (meta-guard); no production edits, so P3 quick mode
  per the two-mode rule.

## Notes

- Sibling leftover "type-level stat guard" is a nominal-type refactor
  (split `Stats` into raw vs resolved at the type level), not a guard —
  tracked separately in roadmap; out of scope here.
