# QA Review: beta-scope-v2-authority (BETA SCOPE LOCK v2 Phase-1)

- Date: 2026-09-30
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths: `game/src/core/betaScope.ts` (new), `game/tests/architecture/betaScopeLockV2.test.ts` (new)

## Scope and Risk Map

New leaf policy module + its spec test. `changed-risk-map.mjs` returned both
paths under `unmappedPaths` (no mapper domains, no one-hop consumers,
`deepAuditCandidate: false`). Manual routing of the unmapped items:

- `game/src/core/betaScope.ts` — pure constants + pure predicates; imports
  are type-only except `REALM_TIERS` (foundation-level constant array).
  Zero production consumers in this phase; no state, no I/O, no lifecycle,
  no persistence, no Vue/Pinia/Phaser surface. Blast radius is bounded to
  the module's own return values.
- `game/tests/architecture/betaScopeLockV2.test.ts` — vitest spec; only
  mutates nothing, reads live data catalogs.

Domain packs consulted by adjacency (policy gating future quest/economy/
equipment surfaces): economy-and-progression reasoning applied to the
quest/recipe predicates; no inventory-equipment runtime path exists yet.

Mandatory deep-escalation triggers: none met — no save/cloud, no
clock/offline, no economy transaction, no Vue/Pinia/Phaser lifecycle.
`deepAuditCandidate` is false and the unmapped paths bound cleanly by
inspection (leaf module, no callers).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-SCOPE-1 | admission predicates / betaScope | consumer queries unknown/malformed/empty/case-mutated id | Fail-closed: unknown = not offered | Value mutation | `false`/`null`/`'scope-hidden'` per predicate | unit | High - wrong open answer would leak hidden content; resolved by pinned garbage-input cases |
| INV-SCOPE-2 | BETA_ENEMY_ROSTER vs data/enemy + data/stage | roster consulted by Phase-4 consumers | Census: exactly 12 = 3 acts x (3 normal + 1 boss); every id exists; realm matches act; boss carries bossTrigger; act boss equals live floor-10 bossEnemyId | Stale state (data drift) | census test binding roster to ENEMIES + STAGES | unit | High - roster typo would silently un-gate or mis-gate stage content |
| INV-SCOPE-3 | betaRecipeFamilyOfId | id parsed from recipe.id / pillId / family id | Determinism + unambiguity: `alchemy_` strip then realm-suffix strip then exact allow-list match; family ids never end in a realm suffix | Value mutation, cross-system chain | resolved family or null | unit | Medium - a prefix/suffix collision could enable a hidden recipe |
| INV-SCOPE-4 | verdict helpers | consumer renders by verdict | Two lock classes distinct: progression-locked renders, scope-hidden never does; a met progression gate cannot un-hide | Value mutation | 3-way verdict truth table | unit | Medium - class collapse would either hide in-scope surfaces or show hidden ones |
| INV-SCOPE-5 | isBetaQuestEnabled | quest admission | daily cadence never offered (no enabled path); enemy-specific kill must target roster; generic kill + collect stay open | Value mutation + live-data sweep | per-quest boolean + sweep over QUESTS | unit | High - daily quests are explicitly out of beta |
| INV-SCOPE-6 | module as a whole | later consumers import | Single authority: every predicate derives from the module's own tables (BETA_ENEMY_INDEX derives from BETA_ENEMY_ROSTER, no second roster) | Cross-system chain | code inspection + import surface | source review | Medium - a duplicated allow-list would fork the policy |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run tests/architecture/betaScopeLockV2.test.ts` | 26/26 pass | covers all INV rows |
| `npm run type-check` (vue-tsc --build) | clean | initial TS2367 on all-false `as const` table fixed by widened record read |
| `ocr delegate preview` + self-review vs resolved rules | clean pass, coverage 2/2 | delegation mode; no Medium+ findings |
| STAGES inspection | exactly chapters 1-3, 10 floors each, floor-10 `bossEnemyId` matches roster boss per act | binds census constants to live model |
| ENEMIES inspection | all 12 roster ids resolve, realmId matches act, bosses carry `bossTrigger`, normals do not | pinned in test |

## Findings

None. No Confirmed, Suspected, or Coverage-gap findings against the task
diff. One non-blocking scope note: the authority has no production
consumers yet (Phase-1 contract), so verdict correctness *at call sites*
is Phase-2+ evidence, not this diff's burden.

## New or Changed QA Tests

- `game/tests/architecture/betaScopeLockV2.test.ts` - pins allow-list
  censuses, fail-closed edges, two-class verdicts, roster/stage/data
  binding, recipe id resolution, quest policy truth table + live sweep.
  (Task-authored implementation test, not a QA-pass write; file lives in
  `tests/architecture/` per repo convention for authority guards, e.g.
  `cultivationPathIsolation.test.ts`.)

## Gaps and Residual Risk

- No consumer wiring exists to attack (by design). Residual risk is a
  future consumer reading a verdict sloppily (e.g. treating
  `progression-locked` as hidden); the API names both classes and the
  truth-table pins make misuse visible.
- `betaRecipeFamilyOfId` trusts its REALM_TIERS suffix list; a new realm
  tier automatically extends it — correct direction (more realms =
  broader parse), and the family allow-list still gates the result.

## Pre-existing Failures

None observed; scoped vitest and type-check both clean on this branch.
