# Coordinator mutation corpus — REPLAY on final head 2d5349a6

Producer: coordinator (devin-4df500e190cc4b9d837f408a5ed53852), NON_INDEPENDENT.
State: product be27c4e5a82d… / contract d7e0a86484d9… / attack ceaf20da9f77… / env 0c6c1b0a38ab…
Method: cp-backup → mutate in place → run declared detector → restore → `git status` clean on src/ (verified).
Raw outputs: /tmp/qa-mut-impl2/M-IMPL-*.out (summaries inline below).

| mutation | invariant | drift seeded | detector | result on final head |
|---|---|---|---|---|
| M-IMPL-1 | I-IMPL-NO-SILENT-TRAM | `setMortalBasicSkill` guard → `if (false)` in EarlyGameBootstrap | GameManager.mortalBasicSkill.test.ts | KILLED (exit 1) — 2 tests fail incl. pick-write + invalid-pick |
| M-IMPL-2 | I-IMPL-PICK-REQUIRED | missing-pick throw removed (GameManagerSaveRestore :296) | SaveSystem.bootRestore.test.ts | KILLED (exit 1) — 'rejects missing mortalBasicSkillId ... before owner mutates' fails |
| M-IMPL-3 | I-IMPL-SAVE-PREFLIGHT | invalid-id throw neutralized (:280 → `if (false)`) | SaveSystem.bootRestore.test.ts | KILLED (exit 1) — 'rejects non-precursor mortalBasicSkillId' fails |
| M-IMPL-4 | I-IMPL-SKILL-MAP | 'tram'→'tram_x' in MORTAL_PRECURSOR_SKILL_IDS | MortalPrecursors.test.ts | KILLED (exit 1) — 2 tests fail (set == cast-leveling keys; default is precursor) |
| M-IMPL-5 | I-IMPL-CONSUME-ONCE | `pendingCreationPick = undefined` commented out (App.vue:557) | App.wiring.test.ts | KILLED (exit 1) — 'clears the module slot after reading it and before the bootstrap call' fails |
| M-IMPL-6 | I-IMPL-NO-ALLOC | `p_attributes: { strength: 5 }` seeded into RPC body | rg allocation-write census over creation path | KILLED — census 0→1 hits at SupabaseCharacterCreationService.ts:66 |
| M-IMPL-7 | I-IMPL-RPC | `p_mortal_basic_skill_id`→`p_basic_skill_id` in client body | SupabaseCharacterCreationService.contract.test.ts | KILLED (exit 1) — 'sends exactly the migration signature' fails |

7/7 KILLED_EXPECTED on the final state; candidate tree unchanged after the batch (git clean).
