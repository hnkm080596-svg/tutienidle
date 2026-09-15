# QA — Pháp Tu review round 3 fixes (quick)

- Scope: HEAD `59a424b6` + round-3 repair diff (buff-definition immutability,
  missing-required-basic fail-fast, fixture repairs, full-suite closure).
- Task-owned paths: `BuffSystem.ts`, `GameManager.ts` (+ paired test files).
- Risk-map route: combat-and-tribulation (runtime effect mutation) +
  economy-and-progression (battle-build fail-fast). Bounded — the boundary
  clone is inside the buff domain's own apply/convert path; no persistence or
  cross-system ownership change.

## Findings checked

| # | Hypothesis | Result | Evidence |
|---|---|---|---|
| R3-1 | `scaleBuffPotency` mutates canonical `BUFF_REGISTRY` definitions via shared effect references | **Confirmed pre-fix → fixed** | `apply()`/`convert()` aliased non-dot effect objects straight from `definition.effects`; `toBuffDefinition` shares them with `LIVE_BUFFS`. Repro test: thach_hoa Cong Minh → runtime -0.45/0.75 while `BUFF_REGISTRY.get('thach_hoa')` must stay -0.30/0.50 → RED (and the earlier MED-4 test's contamination had already compounded the shared object to proc=1 within the same file — cross-test pollution as live proof). `{...effect}` at both boundaries; all template fields are primitives so spread is a complete clone. |
| R3-2 | Other definition→runtime paths alias effects | **Bounded** | Only two boundaries exist: `apply()` and `convert()` — both fixed. `applyGaugeDeltaEffects` reads only. `handleExisting` 'replace' re-uses `resolvedEffects` (already cloned). |
| R3-3 | `potencyAmplified` flag insufficient vs aliasing | **Confirmed the reviewer's model** | The flag correctly bounds "per instance" but the FIRST amp still wrote into the shared template object — instance marker can't fix reference aliasing. Both fixes needed; they compose. |
| R3-4 | Missing required basic silently degrades to generic melee | **Confirmed pre-fix → fixed** | `phap_tu` committed `fire`/`dot` without `hoa_cau_thuat` learned, and `phap_tu_an` without `van_phap_tuy_tam`, both produced GENERIC_PHYSICAL_BASIC. Now `resolvePlayerBasicAttack` throws when `authoredBasicSkillId` returns a required id the `skillManager` lacks (phap paths only; `kiem_tu` keeps its authored static, uncommitted `phap_tu` still gets honest melee). |
| R3-5 | Save validator would have caught the missing-basic state | **Reviewer correct — it does NOT** | The r2 report's claim was wrong: `skills[]` validates entry shape only, not "contains the element basic". The invariant is enforced at battle build (throw), not at load — by design, since learned-skill membership is progression state, not shape. |
| R3-6 | Fixture fallout from the new throw | **Found + fixed** | `NodeSystem.route.test.ts` (×2), `turnRegenStage` (×3), `authoredParity` (×1) committed an element but never learned its basic — all fixtures now `learnSkill` the required basic (the same thing `selectPhapTuElement` grants in production). Suite-wide: these were the only six casualties. |

## Residuals / notes

- `apply()`'s dot branch still builds a fresh object (unchanged); the clone now
  covers every other effect type. `LIVE_BUFFS` source objects remain shared
  with `BUFF_REGISTRY` (same object identity) — safe now that no runtime path
  mutates them; a dev-freeze of the registry remains a possible future
  hardening, deliberately not added (mutating tests would silently no-op in
  non-strict mode, worse than failing loudly).
- `route: null` engine fixtures (regen/parity/route tests) remain as
  route-free scaffolding — boundary-invalid but engine-honest; documented r2.

## Verification evidence

- `npm run type-check` — clean (twice: pre-fix and inside `npm run build`).
- `npm run build` — clean (chunk-size warnings only).
- `npx vitest run` — **558 files / 4215 tests pass, 4 expected-fail, 0
  failures** at final code state (the `eslintCoreSeverity` parallel-load
  flake did not recur this run).
- Scoped during fix: reaction rules 18, phapTuAn 16, buff suite 46,
  route 15, regen 3, parity 11 — all green.

## Verdict

**PASS WITH EVIDENCE** — both round-3 findings repaired with failing-test-first
evidence; the contamination repro additionally demonstrated live cross-test
poisoning before the fix. Full suite is green at final state, closing the
round-2 QA gap.
