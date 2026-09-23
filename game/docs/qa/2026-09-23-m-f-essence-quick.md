# QA Review: M-F-ESSENCE — essence bands + substitution residual (test-only pins)

- Date: 2026-09-23
- Mode: quick
- Verdict: PASS WITH EVIDENCE
- Task-owned paths (all test files — zero production edits by spec):
  - `game/src/core/realm/body/BodyChapter.test.ts`
  - `game/src/core/realm/body/BodyChapterEssenceSubstitution.test.ts`
  - `game/src/data/realm/PhysiqueEssence.test.ts`

## Scope and Risk Map

Changed systems: none in production. The diff is pin coverage only at the
typed `BodyChapterCurrency` boundary (economy-and-progression domain by
the risk mapper; one-hop consumers: UI affordability/unlock state, save
and offline progression — exercised only through the already-landed
M-QI-09 seam, which this diff does not touch).

Escalation check: no persisted-shape change, no clock/offline change, no
Vue/Pinia/Phaser surface, `deepAuditCandidate: false`, no `unmappedPaths`
→ quick mode sufficient, no deep escalation.

Exclusions: `game/docs/specs/m-f-essence-spec.md` +
`game/docs/plans/m-f-essence-plan.md` (task-owned docs — no executable
surface).

## Invariant Ledger

| ID | State/owner | Action and transition | Invariant | Attack operator | Observable oracle | Test layer | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV-QA-1 | `bodyChapterEssenceGrade` | TC cost shapes classify at bag+id alone | Namespace honesty | Fake descriptor | `{material, tinh_hoa_phap_the}`→'phap', `{material, tinh_hoa_bao_the}`→'bao' | unit | High — the mission's pin |
| INV-QA-2 | `essenceSubstitutionCoverage` | Phap-required cost: coverage ≡ 0 for every owned set | Conservation | Value mutation over ownedOf | `0` for {}, {phap:9}, {bao:9,phap:9} | unit | High — top-rung semantics |
| INV-QA-3 | `planEssenceSubstitution` | Phap-required plan under `consumed <= ownedOf('phap')` | Exact debit, all-or-nothing | Value mutation | `[{phap, consumed}]`, `covered === consumed`, `change` undefined | unit | High — the contract claim |
| INV-QA-4 | `planEssenceSubstitution` | Bao-required plan: phap hop + exact change-back | Min whole units + exact value | Overpay operator | `[{phap,6}]` covering 12 of 11, `change {bao,1}`; bao-first ordering | unit | High — substitution math |
| INV-QA-5 | `bodyChapterEssenceGrade` + `validateBodyChapterRegistry` | Synthetic `chapterKind:'zhou_tian'` def with phap material currency | Seam is kind-agnostic | Fake registry member | grade 'phap'; no `bodyChapters.zhou_tian.chapterKind` issue | unit | High — the TC-side pin |

## Verification Evidence

| Command or observation | Result | Evidence/limitation |
| --- | --- | --- |
| `npx vitest run src/core/realm/body src/data/realm src/data/drop src/data/enemy` | 18 files / 182 tests pass | The pins run against real production exports — no mocks; every expected value hand-derived from `planEssenceSubstitution`'s published semantics and the authored `{bao:2, phap:2}` ratios read from `PHYSIQUE_ESSENCE_CONVERSION_RATIO` (never copied literals) |
| `npx vitest run src/core/game/GameManager.essenceSubstitution.test.ts` | 12 e2e tests pass | The M-QI-09 seam suite is untouched and stays green — no signature drift |
| `npm run type-check` | clean | `as never` casts match the existing fake-chapter convention |
| `git diff` production scope | only `*.test.ts` + docs | spec §4 invariant: zero production-file edits — confirmed |
| Hand math: consumed 11 vs `{phap:6}` at yield 2 | `ceil(11/2)=6` → covered 12 → `change {bao:1}` | matches the resolver's documented semantics |

## Findings

None. The pins assert production behavior through the real exports; the
out-of-precondition input (`consumed > owned + coverage`) is deliberately
unpinned per spec §3.2/C2C r40 — the suite's existing pham under-covered
case (:126-140 of the resolver test) already documents the raw fallback.
