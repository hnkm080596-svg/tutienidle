# Quick QA — linh_bao info-anchor node (2026-10-04)

Scope: task-owned diff only (12 files, working tree of `.agent-worktrees/linh-bao-node`).
Mapper: domains `economy-and-progression` + `ui-input-lifecycle`;
`deepAuditCandidate: true` ("cross-system: 2 domains") — NOT escalated:
risk confidently bounded (one new optional flag + one new node + surface
wiring + tests; no persistence schema change — `infoSkillId` is never
saved; no economy flow change — Insight untouched; no Vue/Phaser
lifecycle risk — pure computed additions exercised at runtime).
Unmapped paths routed manually: `betaScopeSkillDomain.ts` ->
progression read-model domain; `locales/*.json` -> ui-input-lifecycle;
`ui-preview/skillMessages.ts` -> ui fixture; arch test -> test code.

## Invariant ledger

1. `linh_bao_tien_than` never enters `nodeLevels`/`purchasedNodeIds` via
   purchase, upgrade, grant, respec, or cascade seams.
2. No Insight is ever debited or refunded on the seat.
3. Mortal surface admits ONLY branches carrying a renderable info
   anchor; every other node there stays 'initiation-pending' locked.
4. Seat verdict never reads 'purchasable'/'available'/'purchased' for
   any player state.
5. Detail surface shows live skill data (template + core level + cast
   count), never a purchase affordance.

## Attacks executed

- `canPurchaseNode`/`purchaseNode` reject with insight + nodeLevels
  untouched — NodeSystem.test 'infoSkillId' (EXECUTED).
- `canUpgradeNode`/`upgradeNode` reject even with injected
  `nodeLevels[info_seat]=1` + `purchasedNodeIds` (corrupt save) —
  EXECUTED.
- `revokeNodeOwnership` early-returns BEFORE `revokedOut.add` /
  `delete nodeLevels` — seat is never counted in respec preview
  `resetNodeIds`/`resetCount` (SOURCE_PROOF lines 554-560).
- Whole-tree respec target enumeration (registry.getAll filter
  `levelsSkillId===undefined && !rewardOnly`) DOES include the seat as
  a target — verified harmless: `revokeNodeOwnership` -> 0, refund +0,
  not added to revokedOut. `devResetBranch` scopes by `branchTag`
  (seat has `elementTag`) -> unreachable, and revoke-guarded anyway.
- `respecApply` clone preflight: seat target produces no mutation ->
  dry-run/commit stay equal.
- `onUpgrade(id)` UI seam double-gated: `row.canUpgrade` false AND
  `row.state !== 'purchasable'` -> `upgradeNode`/`purchaseNode`
  unreachable; upgrade button unmounted (`actionLabel: ''`).
- `grantSkillCore` writes `nodeLevels` without flag checks but is
  unreachable for the seat (core-only callers; seat is not a core and
  no `way.grantedNodeIds` lists it).
- Runtime (Playwright, dev server, real app): mortal (realmId mortal,
  realmLevel 1) -> fire glyph renders 10 nodes incl. seat 'learned'
  1/3, casts 0/1,000, NO upgrade button; committed-fire (real
  `commitFiveElementInitiation`) -> same seat, info-only, no action.
- Other-element (water) + non-beta-way (sword) players: seat is
  'scope-hidden' — domain test EXECUTED.
- Verdict ordering: mortal early-return wins ('initiation-pending')
  over the info branch; committed players get 'info-only' — both
  intended and tested.

## Findings

- Confirmed defects: NONE.
- Nit (deferred): a corrupt save injecting `nodeLevels[linh_bao_tien_than]`
  keeps the value through respec (revoke refuses, by design) — the
  verdict layer ignores `level` for info nodes and `effect:{}`
  aggregates nothing, so it stays inert.
- Nit (deferred): `betaMortalTreeViewTags` admits only `elementTag`
  branches — a future info anchor carrying only `branchTag` would not
  be admitted; documented behavior for the current single-branch
  design.

## Verdict

PASS WITH EVIDENCE — no unresolved Confirmed/Suspected Medium+.
Evidence: 3 new NodeSystem tests + 2 betaScopeSkillDomain tests
(1153 scoped tests green), Playwright runtime captures
(`scratch-evidence/*.png` mortal + committed-fire), source-proof
guard placements.
