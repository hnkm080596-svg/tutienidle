# Deep Audit — Hidden Perfection Lineage skeleton (BETA-HIDDEN-A)

- Date: 2026-09-23
- Mode: deep (mandatory escalation — save-shape/persistence change + `deepAuditCandidate` surfaces)
- Diff under audit: `origin/beta/rc..HEAD` (`1c48e00c` spec doc, `c37f1f31` skeleton, `d8da4710` OCR round-1 fixes) plus uncommitted QA repro test `src/core/game/GameManager.hiddenLineageRestore.qa.test.ts`
- Scope law: QA writes restricted to `**/*.test.ts`, `tests/e2e/**`, `docs/qa/**` — no production edits inside this run (defects found were fixed on the implementation side and reverified).

## Verdict

**PASS WITH EVIDENCE** — every Confirmed-class defect found in this cycle was fixed and reverified on the implementation side (see Fixes). No unresolved Confirmed/Suspected defect remains inside the changed surface. Bounded risk is itemized at the bottom and is honest, not hidden.

## Command evidence (required set)

| Command | Result |
|---|---|
| `npm run test` (full vitest via `npm run verify`) | PASS — 7126 tests; 3 pre-existing environment failures unchanged vs `origin/beta/rc` (`SettingsPanel.test.ts` ConfirmModal null; `dongFuBackgroundAssets`/`dongFuBuildingPipeline` `spawnSync magick ENOENT` — verified identical on base) |
| `npm run type-check` | PASS |
| `npm run build` | PASS (inside `npm run verify`) |
| `npm run test:e2e` | PASS scoped — 9/9 on the changed surfaces: `body-perfection-hidden.spec.ts` (no-leak realm panel + hidden-state save/reload persistence) and `cultivation-path-ritual.spec.ts` (full six-way ritual matrix incl. both hidden pathway rows). Full-suite e2e not run; the skipped specs do not touch hidden-lineage, breakthrough, realm-entry, or save surfaces — recorded as a bounded coverage note, not a defect. |

## Invariant ledger (exercised during audit)

| # | Invariant (spec §) | Status | Evidence |
|---|---|---|---|
| 1 | Two breakthrough types only; normal success permanently closes the lineage at the departing realm | Verified | `resolveBreakthroughType` + `closeHiddenLineage` unit pins; ritual commit pin; tribulation commit pin; first-closer-wins idempotency pin |
| 2 | Normal failure does NOT close the lineage | Verified | failure-path pin — `closeHiddenLineage` only inside victory/commit paths |
| 3 | Strict-prefix completion; `completedHiddenBodyRealmIds` is always `REALMS[0..k]` | Verified | `completeHiddenBody` gate + `assertHiddenPerfectionIntegrity` chain-rule; tampered non-prefix save rejected end-to-end (repro test) |
| 4 | Entered realm index ≤ player's realm index AND departing realm's hidden body completed | Verified (after fix) | boundary reworked in `d8da4710`: `enteredIndex > playerIndex` rejects; predecessor-body rule added; both pinned; compose-path repro (`GameManager.hiddenLineageRestore.qa.test.ts` test 3) |
| 5 | +10pp additive cap per completed body; cap raises, does not fill; `floor(realmCap × (1 + 0.1n))` single rounding rule | Verified | `StatCap` pins (10→11 mortal@1, 30→36 qi@2); eligibility compares against effective cap |
| 6 | Hidden gate = Lv18 + lineage + current-realm body + all-5 at effective cap + ordinary reqs | Verified | `isHiddenBreakthroughEligible` + `resolveBreakthroughType` pins at both commit seams |
| 7 | Enhanced Realm Entry Passive = authored per-realm variant, no universal multiplier | Verified | `buildEnhancedModifiers` pins (nhap_dao 0.21 universal+domain:'spell', kien_co 0.2 all MAIN_STAT_KEYS); restore repro asserts 0.21 survives round-trip |
| 8 | §4 no-leak: nothing observable before `discovered` | Verified | `discoverHiddenRealm` sole gated writer; e2e `body-perfection-hidden` col-absence; save/reload persistence e2e |
| 9 | Frozen ≠ completed; closure freezes open mechanics via owner-registered readers | Verified | `closeHiddenLineage` freezes via `HIDDEN_MECHANIC_FINISHED_READERS` only on non-completed entries; integrity rejects frozen+completed |
| 10 | Save shape carries all hidden state; migration defaults sanitize; restore fail-closed pre-mutation | Verified | v82 migration pin; shape validator; preflight integrity inside `restoreGameSession`; 5-case restore repro |
| 11 | Mechanic payload opaque, size-bounded, validator-gated | Verified | deep-clone in `EarlyGameSession` (OCR fix), validator registry pin |
| 12 | Retired authorities stay retired | Verified | census — meridian-9 gate, material-gated chi-kieu, `bodyPerfection`, `greatDaoOpportunityLost`, `great_dao_seed`/`thien_dia_chi_kieu` drops removed; live-consumer grep returns only comments |

## Findings

### Fixed during this cycle (implementation side, reverified)

- **[Medium] `assertHiddenPerfectionIntegrity` rejected legitimate current-realm entry** — `enteredIndex >= playerIndex` rejected a save captured immediately after a hidden commit (`['qi_refining']` at realm qi_refining). Spec invariant is `index <= player's`. Fixed to `>`, plus the spec's second invariant (departing realm's hidden body must be completed) which was missing. Pins added. Repro of the exact failure now green in `GameManager.hiddenLineageRestore.qa.test.ts`.
- **[High] effective-cap consumers left on raw `getMainStatCap`** — `allocateAttributePoint`, both `PillSystem` `random_main_stat` candidate filters, and `CharacterPanel`'s cap display clamped at the realm-base cap, making the +10pp raise unreachable through the two canonical stat-gain channels (spec sec.3 census rows). Fixed to `getEffectiveMainStatCap` at all three sites + the panel; regression pin added (`GameManager.hiddenLineageRestore.qa.test.ts` — allocation into raised cap allowed, stops at effective cap, pill candidates roll).
- **[Medium] no realm-residency gate on hidden-body progress** — `canProgressHiddenBody` allowed `completeHiddenBody`/`discoverHiddenRealm` on a realm the player had already left (retroactive cap headroom). Residency check added; incoherent test fixtures that composed non-resident state were corrected.
- **[Low] `realms` map lacked frontier coherence** — `discovered`/`mechanic`/`frozen` entries beyond the completed-prefix frontier, `mechanic` without `discovered`, and `frozen` without `mechanic` were not validator-rejected (tamper-only, §4 no-leak surface). All three rules added + pins.
- **[Low] `EarlyGameSession` shallow-copied `mechanic` payload** — slice would share nested reference with `PlayerData`; deep-cloned via `JSON.parse(JSON.stringify(...))`.
- **[Low] eslint on changed files** — `_`-prefix convention applied to unused enhanced-builder params; dead `SPELL_KIT_IDS` import removed.

### Open findings

- None at Confirmed or Suspected confidence inside the changed surface.

### Nits / pre-existing (recorded, non-blocking)

- `?12` mojibake artifacts (23 occurrences) — pre-existing `ï¿½`-corrupted comments transliterated by the ASCII pass; cosmetic, still ASCII, ratchet-safe. Deferred: repairing them is a comment-drift cleanup outside this mission's surface.
- Stale narrative comments in `FamilyDropTables.ts`/`StageDropTables.ts`/`DropTable.ts`/`Talents.ts` still describe `great_dao_seed`/`thien_dia_chi_kieu` as live drops. Doc-drift only — the materials/drops themselves are retired; flagged for the cleanup pass rather than edited here (comment-only churn risk inside a large diff).
- `ProfessionMaterialMeta` unused-import warning — pre-existing, verified on base.

## Coverage gaps (honest bounds)

- Full `test:e2e` suite not run — scoped 9 specs chosen to cover every changed runtime surface (realm panel no-leak, hidden persistence, ritual matrix both pathways). Specs for unrelated panels/scenes carry no hidden-lineage coupling.
- `runHiddenBattleReplacement` ctx carries `{player, stage, plan}` — B-owned resolvers needing manager/RNG access must capture them at registration; intentional per the mission contract (documented in the spec's interface pins), not a defect.
- Tribulation DIRECTOR question-loop for a hidden breakthrough is covered piecemeal (type resolution at start + outcome-service commit + restore), not as one uninterrupted drive — the compose seams are each pinned; risk accepted as Low.

## Independence evidence

- Internal reviewer contexts (`devin_session_create`) unavailable this cycle: 429 — org concurrent-session cap (5) saturated by sibling missions. Per protocol fallback: internal checks continued and the missing independence evidence is reported here rather than forged. Sealed-reviewer dispatch for both the spec run and the impl run remains queued for retry when a slot frees.
- P18 OCR (Delegation Mode) completed: 69/69 files reviewed, 0 skipped.
