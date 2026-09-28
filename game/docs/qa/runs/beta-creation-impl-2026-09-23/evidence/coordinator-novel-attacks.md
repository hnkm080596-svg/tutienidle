# Novel-attack synthesis — between Clean A and Clean B (coordinator, final state d3b0cb32)

Novel attacks synthesized against the final head that were NOT in attack-model.json's
original list, exercised as concrete executions. Attack ids are assigned for journal use.

## NA-IMPL-1 — Transient-mutation cross-check: does the fail-closed precursor loop kill partial boots?
Attack: apply M-IMPL-1-style mutation (precursor learn silently fails) to EarlyGameBootstrap
in place, run the mortalBasicSkill detector. Result: KILLED_EXPECTED — the new loop throws
before any pick write; no half-booted save. Evidence: EV2-IMPL-MUTATION-CORPUS.

## NA-IMPL-2 — Crafted incoherent save across BOTH layers simultaneously
Attack: mortal-looking save at shape layer but realmId-keyed non-mortal at preflight layer
(the F-RB-C7 axis attack, re-exercised post-repair). Result: rejected by the new
realmId-keyed isMortalSave predicate; boundary fixtures coherent. Evidence:
EV2-IMPL-PIN-SUITE + EV2-IMPL-RB-CLOSURE.

## NA-IMPL-3 — Consume-once under double onNewCharacter without re-creation
Attack: App.vue bridging slot read twice without a fresh onCharacterCreated emit. AST order
pin + mutation M-IMPL-5 confirm: consume is destructive-read, second observation sees null.
Result: KILLED_EXPECTED. Evidence: EV2-IMPL-MUTATION-CORPUS.

## NA-IMPL-4 — Allocation-write resurrection via side channels
Attack: rg-census every writer path that could reintroduce allocation state (stats writes,
attribute deltas, UI point pools) inside the creation path on the final tree. Result: 0 hits —
no allocation surface remains reachable. Evidence: EV2-IMPL-SOURCE-SWEEP.

## NA-IMPL-5 — Migration divergence: fresh-apply vs already-migrated DBs
Attack: compare the create_character function shape a DB gets via 202608240001+202609240001
versus fresh apply — signature, grants, column, backfill. Result: convergent (idempotent
column add, tram backfill, v81 overload drop, single 7-param function, re-grant).
Evidence: EV2-IMPL-SOURCE-SWEEP + EV2-IMPL-RB-CLOSURE.

## NA-IMPL-6 — Pre-existing failure misattribution attack
Attack: could any of the 3 red suite entries plausibly be caused by this diff? Method:
identical repro on isolated base worktree 6d9af7a9. Result: all 3 fail identically on base —
proven pre-existing (F-IMPL-PRE-1). Evidence: EV2-IMPL-BASE-REPRO.
