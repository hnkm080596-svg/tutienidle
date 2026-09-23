# Round A sealed review — CORRECTNESS lens
reviewer context: devin-5d5be1282a47450f8e514ec259faf959 (sealed; priorFindingsVisible=NO)
sealed against product cba106e9f87b… @873635bd

```
REVIEW_RESULT as your final structured output when done. No reply needed until sealed.

[devin] @ 1790176492 (event-01a0ced57c7d77e0a219dffca99fadf9)
In progress: production seams read (settleOutcome/drain contract confirmed honest vs useTribulation.ts). Next: save/restore + entitlement internals, then npm ci + vitest execution for executed evidence before sealing.

[devin] @ 1790177697 (event-01a0cee73cc577d29333189a21fb8497)
REVIEW_RESULT
Run/request: mf-journey-2026-09-23 / round-A-correctness / product cba106e9f87b

Access: complete — every source surface needed was readable on @873635bd (detached checkout verified: HEAD=873635bd502921a6164eff368cb470af8c735915, merge-base vs origin/p7/truc-co = cf766c83). Diff: 10 files, +2601/−10, zero production edits — matches profile.

Independence: context devin-5d5be1282a47450f8e514ec259faf959; priorFindingsVisible=NO. Material exposure: the implementer's own QA artifact inside the target diff (game/docs/qa/2026-09-23-m-f-journey-quick.md) was read as part of the reviewed change — it documents two in-mission OCR fixes (site-list parity normalization, census input guards); both were independently re-derived and verified by me from source before/while reading it. No docs/qa/runs/ files and no other reviewer's output were touched.

Coverage: assigned lenses inspected → two-phase settle/drain (verified vs useTribulation.ts:131-236 production twin); snapshot/restore parity (EarlyGameSnapshot vs buildGameSave's whole-player serialization + store restoreFromSave whitelist at stores/player.ts:238-353); fixture-seam honesty (holdPill/holdMaterial → real Bag.add, registry.get throws on unknown ids, PillRegistry.ts/MaterialRegistry.ts get() throw paths); ordered-leg coupling (leg N asserts state accumulated across legs, incl. mid-loop leg-G checkpoint); census oracle (channel x channel duplicate-authority via channelEmissionCount>1, kind-agnostic emitted union via channelEmittedMaterialIds, any-drop-kind bypass via kind-free signature set); re-entry (receipt-identity dedup, resolve validate-before-mutate, recordPerfectClearIfEligible includes-guard, gift issue write-if-absent, claimCompanionGift claimed-flag). Omitted: sword pathway legs (not exercised by this journey), full-suite verify (scoped run only), Phaser/Vue runtime surfaces (headless harness excludes them by design).

Attacks (concrete):
- EXECUTED: vitest run on the two touched files — 17/17 pa... [truncated]

[user: Devin Bot (api)] @ 1790177747 (event-01a0cee8a10e7ad0b3ed08dab9220892)
Seal received — coordinator needs only your finding INDEX (your sealed text was truncated in transport). Reply with one line per finding: F-N | severity | title (one short clause) — plus your final Result line. Do not add new findings or re-review; this is index extraction of your sealed result only.

[devin] @ 1790177756 (event-01a0cee8c53d76409baeabcbfe23d290)
Finding index (sealed @873635bd, round-A-correctness):
F-1 | Medium | Snapshot parity/determinism oracle blind spot — EarlyGameSnapshot omits journey-mutated persisted fields (selectedTalentIds/talentLevels/companions/bags/baseStats/modifiers); same-seed runs grant different talents while snapshots stay equal.
F-2 | Low | runTribulation skips startTribulationPrepared's pre-start unequip+modifier sync — ghost snapshots a stat profile production never produces; settle's second unequip masks it.
F-3 | Low | drainTribulationOutcome returns true on an empty director (no committed check) — "cleared-or-deferred" not "outcome drained"; enables drain-before-settle order production can't reach.
F-4 | Low | Census enumerates drop surfaces only — non-drop acquisition authorities (alchemy/vendor/quest/gift/decompose) not covered; vacuous today.
F-5 | Nit | vi.setSystemTime(Date.now()) under fake timers is a no-op at TrucCoJourney.test.ts:648/808/1013.
Result: SEALED_RESULT
```
