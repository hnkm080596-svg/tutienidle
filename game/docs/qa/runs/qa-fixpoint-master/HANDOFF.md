# QA FIXPOINT — beta-scope-v2 master gate: HANDOFF

Run: `qa-fixpoint-master` | Branch `devin/qa-fixpoint` (tip `8a36e70a`, pushed)
| Worktree `.agent-worktrees/qa-fixpoint-master` | Ledger `game/docs/qa/runs/qa-fixpoint-master/ledger.json` (validate: clean)
| `npm run qa:internal -- <cmd> --run qa-fixpoint-master` from `game/`.

## Verdict-per-clause (`decide` @ tip 8a36e70a)

Outcome: **QA_UNVERIFIED** (handoff per coordinator directive — loop stopped before the clean pair landed).

| Clause | State |
|---|---|
| C1 identity (evidence binds declared state) | OK |
| C2 census coverage (68 cells) | OK — all non-INDEPENDENT cells SATISFIED on T28 |
| C3 no-open | UNMET by exceptions only — 84 HUMAN_EXCEPTION (all human-accepted: Low/Nit deferred per Medium+-only ruling + same-value forged-counter class Minh accepted: F-TC6-7, F-TC8-5 family) |
| C4 final gates | OK — `npm run verify` GREEN 8322 tests on tip |
| C5 sequential | OK — CY-SEQ-1..21 sealed, 125 reviews |
| C6 clean pair | **UNMET** — no blind round returned fully CLEAN; every round falsified with real findings (latest trio T27: A19 1M+1L, B19 2M, TC16 PASS) |
| C7 mutation corpus | OK — all mutants killed (latest wave 3/3 + legacy battery 8/8 re-killed on T28) |
| C8 terminal check | OK — independent terminal verifier sealed |
| C9 readiness | OK — not required |

Projected verdict once C6 lands: **QA_ACCEPTED_WITH_EXCEPTIONS** (C3 stays unmet by design — exceptions are human-accepted).

## Findings ledger (262 total)

| Status | Count | Severity split |
|---|---|---|
| CLOSED | 140 | Critical 3, High 57, Medium 80 |
| HUMAN_EXCEPTION | 84 | Critical 1 (F-TC8-5 forged totalExperience — Minh accepted), High 2, Medium 9, Low 47, Nit 28 |
| DUPLICATE_LINKED | 25 | folded into earlier fixes |
| REJECTED_WITH_PROOF | 9 | defended seams verified |

## Latest wave (T28 — A19/B19/TC16 blind trio on ab0b135e)

- F-A19-ROOT-1 (Medium, CLOSED): forged element-root claim on element=null save passed shape+acceptance → every `commitFiveElementInitiation` probe failed `element_root_blocked` forever. Fix: `getActiveElement` cross-check of `PHAP_TU_ELEMENT_ROOT_IDS` ownership at both `saveShapeValidation` and `assertSaveAcceptable` (remote gate). New lesson L-ATOMIC-COWRITE-WITNESS.
- F-B19-STAT-1 (Medium, CLOSED): `CharacterDetailCard` rendered hidden-domain stat rows raw. Fix: `BETA_SCOPE_HIDDEN_STAT_KEYS` + `isBetaStatLabelVisible` admission filter in `betaScope.ts`.
- F-B19-DOMAIN-1 (Medium, CLOSED): carried `doan_bao_thach` rendered artifact-domain branding below its unlock realm in `MaterialBagSection`, `LoreCodex`, `BagGrid` count. Fix: `isDomainScopedAcquisitionEnabled(domainUnlockRealmId, realmId)` filter at all three.
- Deferred: F-A19-ELENULL-1 (Low, `it.fails` pin), F-TC16-EQ-DUPSLOT + F-TC16-TRIB-SKIPREALM (Nit, inert admissions), F-TC16-ALCHEMY-RECIPE-MISMATCH (rejected-with-proof — already defended).

## Recommended next rounds (coordinator)

1. **Fresh blind trio on `8a36e70a`** (authority / consumer / terminal) — the C6 clean pair. If either lands CLEAN, bind CY-CLEAN-A/B + rebind the 16 INDEPENDENT_REVIEW cells' reviewerIds to the clean reviewers (see `/tmp/clean_bind_final.mjs` pattern — still on the box under /tmp), then `decide` → expected QA_ACCEPTED_WITH_EXCEPTIONS.
2. If a round falsifies again: fix Medium+, re-pin, re-run the T28 battery (`/tmp/rebind_t28.sh` is the template; bump log prefixes), fresh trio — P5 recursion as before.
3. Known flake class to keep pinned as exceptions: unseeded Math.random economy draws (F-JOURNEY-FLAKE-1; EarlyGameSession defeated once at qi_refining_forest under parallel run, green standalone).

## SHAs

- master baseline: `46bb1482` (verify GREEN ~7808 at baseline; branch moved on since)
- `devin/frontend-ready` tip: `d6e50e51` — verify GREEN 7873 (unchanged this round; re-checked 2026-09-30)
- `devin/qa-fixpoint` tip: `8a36e70a` — verify GREEN 8322

## Rulings in force (Minh)

- Fix Medium+ only; Low/Nit recorded as exceptions.
- Same-value forged counters a writer could produce = human-accepted residual (online-authority layer owns).
- RESTRICT ≠ DELETE; no backward save compat needed.
- Luyen the / kinh mach / chu thien chain is LIVE; `bodyPath=false` gates only hidden breakthrough + The Tu/Kiem Tu way selection.
