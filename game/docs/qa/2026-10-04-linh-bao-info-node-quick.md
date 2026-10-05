# Quick QA — mortal precursor info-anchor trio (2026-10-04, revised)

Scope: task-owned diff only (`.agent-worktrees/linh-bao-node` working
tree). Redesign after Minh ruling: the mortal skill surface is its OWN
tree — three precursor seats on the way-less `tien_than` branch tag —
not a seat bolted onto the phap-tu fire glyph (v1 superseded).
Mapper: domains `economy-and-progression` + `ui-input-lifecycle`;
`deepAuditCandidate: true` ("cross-system: 2 domains") — NOT escalated:
risk confidently bounded (one new optional flag + three new nodes +
surface wiring + tests; no persistence schema change — `infoSkillId` is
never saved; no economy flow change — Insight untouched; no Vue/Phaser
lifecycle risk — pure computed additions exercised at runtime).
Unmapped paths routed manually: `betaScopeSkillDomain.ts` ->
progression read-model domain; `MortalTienThanNodes.ts` -> progression
data; `locales/*.json` -> ui-input-lifecycle; arch test -> test code.

## Invariant ledger

1. `tram_tien_than`/`linh_bao_tien_than`/`huy_quyen_tien_than` never
   enter `nodeLevels`/`purchasedNodeIds` via purchase, upgrade, grant,
   respec, or cascade seams.
2. No Insight is ever debited or refunded on any seat.
3. Mortal surface admits ONLY branches carrying a renderable info
   anchor — the `tien_than` branch (the three precursors); nothing else
   renders for a pre-initiation mortal.
4. Seat verdict never reads 'purchasable'/'available'/'purchased' for
   any player state.
5. Detail surface shows live skill data (template + core level + cast
   count), never a purchase affordance.
6. The lit seat follows `mortalBasicSkillId` (beta pins it to
   linh_bao); the other two seats render locked while staying
   readable.

## Attacks executed

- `canPurchaseNode`/`purchaseNode` reject with insight + nodeLevels
  untouched — NodeSystem.test 'infoSkillId' (EXECUTED).
- `canUpgradeNode`/`upgradeNode` reject even with injected
  `nodeLevels[info_seat]=1` + `purchasedNodeIds` (corrupt save) —
  EXECUTED.
- `revokeNodeOwnership` early-returns BEFORE `revokedOut.add` /
  `delete nodeLevels` — a seat is never counted in respec preview
  `resetNodeIds`/`resetCount` (SOURCE_PROOF lines 554-560).
- Whole-tree respec target enumeration (registry.getAll filter
  `levelsSkillId===undefined && !rewardOnly`) DOES include seats as
  targets — verified harmless: `revokeNodeOwnership` -> 0, refund +0,
  not added to revokedOut. `devResetBranch` enumerates seats by their
  `branchTag: 'tien_than'` — `revokeNodeOwnership` still early-returns
  0 on every one (infoSkillId guard), so a branch reset is a harmless
  no-op on them.
- `respecApply` clone preflight: seat targets produce no mutation ->
  dry-run/commit stay equal.
- `onUpgrade(id)` UI seam double-gated: `row.canUpgrade` false AND
  `row.state !== 'purchasable'` -> `upgradeNode`/`purchaseNode`
  unreachable; upgrade button unmounted (`actionLabel: ''`).
- `grantSkillCore` writes `nodeLevels` without flag checks but is
  unreachable for the seats (core-only callers; seats are not cores and
  no `way.grantedNodeIds` lists them).
- Way-stamp contract: `requiredCultivationPath`/`requiredWay` asserted
  ABSENT on every `infoSkillId` node and required on every other
  purchasable node — PhapTuPath.way.test (EXECUTED).
- Runtime (Playwright, dev server 5299, real app): fresh guest mortal
  -> skill panel shows exactly the three seats; `linh_bao_tien_than`
  'learned' lit (the beta basic), `tram_tien_than` +
  `huy_quyen_tien_than` 'locked'; seat detail mirrors live data
  (name/desc/level 1/3/casts 0/1,000 + info-only condition) with ZERO
  upgrade buttons; locked seats selectable and readable.
- `betaMortalTreeViewTags` returns the `tien_than` branch for the
  mortal view — domain test EXECUTED; water/sword/hidden players keep
  their own scopes (seats carry no stamps; element gate skipped —
  branch tag simply isn't admitted on any path's tag set).

## Findings

- Confirmed defects: NONE.
- Nit (deferred): a corrupt save injecting `nodeLevels[<seat>]` keeps
  the value through respec (revoke refuses, by design) — the verdict
  layer ignores `level` for info nodes and `effect:{}` aggregates
  nothing, so it stays inert.
- Nit (deferred): committed players get 'info-only' rows for the seats
  in the read model but the surface never draws them (the `tien_than`
  tag is only admitted on the mortal view) — consistent with the
  mortal-tree ruling; revisit if post-initiation visibility is wanted.

## Verdict

PASS WITH EVIDENCE — no unresolved Confirmed/Suspected Medium+.
Evidence: 3 NodeSystem tests + updated betaScopeSkillDomain tests +
way-stamp absence assertions (full suite 933 files / 8691 tests green),
Playwright runtime captures (`scratch-evidence/mortal-tree*.png`),
source-proof guard placements.
