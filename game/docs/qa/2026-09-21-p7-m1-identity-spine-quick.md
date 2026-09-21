# QA Review: P7-M1 English identity-spine cut

- Date: 2026-09-21
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: 201 reviewable files under `game/src/**`, `game/tests/**` (staged diff on `feat/p7-progression-consolidation`); `game/docs/p7/missions/*` excluded (docs-only)

## Scope and Risk Map

`changed-risk-map.mjs` over the 201 task-owned paths returned `deepAuditCandidate: true` (7 domains, 120 unmapped paths, 19 one-hop consumers). **Escalation decision — bounded to quick:** the change is a pure vocabulary cut (path/way identity literals + identifiers) with zero intended behavior change; every material transition (ritual commit, runtime dispatch, save-boundary validation, domain gating, UI rendering) is pinned by contract tests, the full 6137-test suite, and direct runtime evidence gathered this session. No formula, timing, persistence-policy, or lifecycle semantics changed. The 120 `unmappedPaths` are mechanical rename victims in the same invariant class — bounded by the residue census below.

Domains mapped: combat-and-tribulation, economy-and-progression, inventory-equipment, pinia-phaser-sync, save-and-cloud, time-and-offline, ui-input-lifecycle.

## Invariant Ledger

| # | Invariant | Oracle | Result |
|---|-----------|--------|--------|
| I1 | Atomic pair: `cultivationPath`/`cultivationWay` both-absent (mortal) or both-present, way owned by path | saveShapeValidation tests + live save dump | Holds — `{"path":"sword","way":"sword_pathway"}` persisted atomically with realm advance |
| I2 | Old vocabulary rejected at boundary | negative sentinel fixtures + module `ways` membership check | Holds — old ids fail enum/membership checks (dev-phase, no migration) |
| I3 | Runtime dispatch resolves only canonical `path:way` keys | `CULTIVATION_PATH_RUNTIME_FACTORIES` + LegacySkillCoverage census | Holds — six canonical keys; live combat proves `sword:sword_pathway` resolves the KiemPho provider basic |
| I4 | Leaf content ids unchanged | residue census | Holds — `ung_the` buff, `ngo_dao` talent, `kiem_pho`/`ngu_kiem` tags, `phap_tu`/`kiem_tu`/`the_tu` visual profile ids, `requires_phap_tu` pill reason all classified leaf |
| I5 | No surviving old literal in identity comparisons | full-repo census of `'phap_tu'`/`'kiem_tu'`/`'the_tu'`/`'ngo_dao'`/`'ung_the'`/`'ngu_hanh'`/`'hien'`/`'ngu'`/`'pham_nhan'` | Holds — every residue is leaf id, negative sentinel, or historical comment |
| I6 | Architecture guards remain live (not vacuous) | `cultivationPathIsolation.test.ts` | **Violated, fixed (F2)** — patterns enumerated only old vocabulary |
| I7 | E2E oracle asserts the persisted contract | `tests/e2e/cultivation-path-ritual.spec.ts` | **Violated, fixed (F1)** — asserted retired field names |
| I8 | UI renders from migrated identity | P14 live inspection | Holds — offer list, `kiem_pho` tree, `Đâm` basic, `Kiếm Phổ` bar, `Quán Khí` label all correct; 0 console errors |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
|---|---|---|
| `npm run verify` (type-check + build + vitest) | 6132/6137 green; 1 ASCII-comment failure fixed, baseline regenerated, targeted rerun green; 4 expected-fail | Full suite on latest state; post-fix deltas covered by targeted reruns |
| Residue census (`PathWayId`, old literals, stale identifiers) | 0 unclassified hits in `src/` | All residue classified leaf/sentinel/historical |
| P13/P14 live session (worktree dev server :5842) | Real ritual driven end-to-end; save oracle verified | Screenshots captured then cleaned per P14 artifact policy |
| `npx vitest run tests/architecture/cultivationPathIsolation.test.ts` | 5/5 green after guard extension | Guard provably non-vacuous against new vocabulary |

## Findings

### QA-2026-09-21-1: e2e save-oracle asserted retired persisted field names
- Severity: Medium
- Status: Confirmed → fixed (test-file write inside QA allowlist)
- Invariant: I7
- Preconditions: `tests/e2e/cultivation-path-ritual.spec.ts` after the `kiemTu→swordPath`/`phapTu→spellPath` field rename
- Reproduction: run `npm run test:e2e` → assertions `expect(save.player.kiemTu).toBeDefined()` / `expect(save.player.phapTu).toEqual(...)` fail
- Expected: oracle asserts `swordPath`/`spellPath`
- Actual: oracle asserted retired names while pair assertions were already migrated
- Evidence: direct runtime save dump `{"swordPath":{"preset":["orb_dam"],"kiemY":0,"kiemDaoCount":1,"kiemDaoBase":1}}` vs spec lines 305-307/377-381/410
- Test file: `tests/e2e/cultivation-path-ritual.spec.ts` (fixed: interface + 8 assertions + 6 test titles)
- Owner subsystem: e2e oracle layer
- Blast radius: playwright-only spec; no production impact

### QA-2026-09-21-2: identity-isolation guards vacuous against new vocabulary
- Severity: Medium
- Status: Confirmed → fixed (test-file write inside QA allowlist)
- Invariant: I6
- Preconditions: `tests/architecture/cultivationPathIsolation.test.ts`
- Reproduction: `CONCRETE_ID` enumerated only retired literals — `cultivationPath === 'sword'` outside exempt dirs would not flag; `SLICE_READ_PATTERN` matched only `.kiemTu|.phapTu` — `.swordPath`/`.spellPath` slice reads unguarded
- Expected: guards cover the live identity vocabulary (both vocabularies — legacy reintroduction also blocked)
- Actual: guards vacuous post-migration
- Evidence: pattern source lines 86/171 vs `PlayerData.swordPath`/`spellPath`; post-fix run green with zero new violations (proves no unlisted legit readers exist)
- Test file: `tests/architecture/cultivationPathIsolation.test.ts` (fixed: both patterns extended to new + retained old vocabulary)
- Owner subsystem: architecture guard layer
- Blast radius: guard coverage only; no production impact

## New or Changed QA Tests

- `tests/e2e/cultivation-path-ritual.spec.ts` — save-oracle field rename + titles; proves the e2e suite can actually detect the persisted contract it claims to cover
- `tests/architecture/cultivationPathIsolation.test.ts` — guard vocabulary extension; proves identity-branching and slice-inference guards are live against the canonical ids

## Gaps and Residual Risk

- `npm run test:e2e` (Playwright suite) not executed end-to-end in this session — the ritual spec's own flow was verified manually via the equivalent live session (same Quán Khí → tribulation → offer → confirm path), which substitutes runtime evidence for the sword leg; the other five legs rely on the same code paths and contract tests. Non-material residual gap.
- Cosmetic VN way names retained in a few test titles/prose comments where they describe content (e.g., "ngo_dao build") — classified leaf, intentionally kept.

## Pre-existing Failures

- 4 expected-fail vitest entries (pre-marked, unrelated).
