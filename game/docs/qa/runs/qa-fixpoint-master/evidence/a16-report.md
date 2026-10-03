# Scope-authority blind audit — 2026-10-01 (pin a7d12edf)

**Verdict: FAIL** — 1 Confirmed High producibility gap, 1 Low coverage gap, 1 Nit note. 19 leads verified closed.

Scope attacked: save-shape producibility bounds (forged fields no writer emits), betaScope verdict correctness, capability gates at write seams (learn/upgrade/purchase/respec/settle/dispatch), realm-tier ceilings, magnitude ceilings, claim-source forgery. Only AUTHORITY seams — dormancy itself is intended.

Probe file: `tests/architecture/scopeAuthoritySkills.qa.test.ts` — run `npx vitest run tests/architecture/scopeAuthoritySkills.qa.test.ts`. Expected today: 4 failing probes (the defects), 1 passing HOLD (coherent save still loads).

---

## F-SKILLS-TXP — Confirmed · High · confidence high

**Surface:** `skills[].totalExperience` — `validateSkillEntries` requires only `id` (saveShapeValidation.ts ~L2250); restore copies the field verbatim onto the template clone (GameManagerSaveRestore.ts ~L219).

**The claim no writer can produce.** The one writer (SkillSystem cast path ~L323+336) increments `skill.totalExperience` and calls `castCountSink` → `player.skillCastCounts[id] = totalExperience` **in the same statement**. Every honest save therefore satisfies `skillCastCounts[id] === totalExperience` whenever `totalExperience > 0`. An absent mirror, a divergent mirror, or a non-numeric value is unproducible by construction — the same one-fact-two-mirrors coherence the validator already enforces for `skillInsight ≤ totalSkillInsightGained` (F-A11-3) and the `nodeLevels`/`purchasedNodeIds` pair (F-A11-6). Here it checks none of: type, finiteness, non-negativity, or mirror coherence.

**Mint paths (all live in beta, no dormant system involved):**

| Forged field | Result |
|---|---|
| `totalExperience = 1_000_000`, mirror absent | restores verbatim → `getPrecursorFlatDamageBonus` → **+100,000 flat damage** on linh_bao (the beta starter) |
| `totalExperience = '999999'` (string) | `Math.max(0, 'x')` coerces → **+99,999 flat damage** |
| `totalExperience = 42` + `skillCastCounts = {linh_bao: 1_000_000}` | divergent one-fact mirrors both pass validation |
| `totalExperience = 10_000` | `getCastLeveledSkillLevel` → **Lv3** (writer needs 10k real casts); the same mirror feeds the hidden-pathway `offerGate` eval and `skillCastCount` node prereqs |

Damage mint reaches combat through `getEffectiveSkill` (SkillSystem.ts L122-125): `value + getPrecursorFlatDamageBonus(skill.totalExperience)` for every precursor effect/trigger damage value.

**Suggested bound (writer-inventory):** `isNonNegativeFiniteNumber(totalExperience)` + `skills[].totalExperience === player.skillCastCounts[id]` whenever `totalExperience > 0` (mirror-only keys for unlearned skills stay legal — respec can leave stale counts).

---

## Coverage gaps / notes

- **G-SKILLS-EXP (Low):** `skills[].experience` — same verbatim-restore/no-check class, but no consumer reads it today. Symmetry fix recommended; no mint vector found.
- **G-COUNTERS (Nit):** `cultivation`, `bossKillCount`, `quest progress`, etc. — nonneg-only counters with no cheap writer invariant. Every consumer re-authorizes at its seam (tribulation settle, quest claim bag+scope check, node prereqs); no mint found. Open by construction for counters.
- **realmId > ceiling (golden_core):** NOT a finding — adjudicated F-SCOPE-5 / REJECTED_WITH_PROOF. `realm_beyond_release` flag is the designed carry-forward bound; flagged-but-playable is intentional.

## Leads verified closed (bounded at write seam or inert at consume seam)

committedOutcome re-auth at settle · nodePath/nodeWay re-checked at purchase + aggregators · alchemy dormant-family jobs parked, pill re-derived · building lastCollectedAt capacity-clamped · autoFarm realm-bound + physical floor + consumer guard · persistentTimedEffects per-source writer bounds (tu_linh_tran exact shape, pill regen authored match, dormant family rejected) · hidden beast/channel engines scope-frozen · companions roster+realm+rank bounds, domain dormant · decompose workers capacity-clamp · hiddenPerfection strict-prefix + two-view coherence · selectedSpecializationId claimant-node gate + restore reconcile · way commit isBetaWay fail-closed at both public ops · externalModifiers wiped · unknown ids preflight hard-fail · spirit-stone tier bound (F-SCOPE-1) + vendor grade re-check · quest reconcile inverse-pass deactivates realm-ineligible forged entries.

---

*Probe evidence is deterministic: each failing test restores the forged save, asserts the mint (damage/level lands on live objects), then asserts the secure expectation `validateGameSaveShape(...).ok === false`.*
