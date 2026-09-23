# Coordinator mutation corpus — beta-creation-impl-2026-09-23

Product-code seed mutations executed in-place on the worktree at
92b4ebaa (each: cp backup -> mutate -> run detector -> restore -> git
status clean). Producer = coordinator (NON_INDEPENDENT): these records
prove the declared detectors actually fire; they do not replace sealed
review.

| mutation | invariant | drift seeded | detector | result |
|---|---|---|---|---|
| M-IMPL-1 | I-IMPL-NO-SILENT-TRAM | setMortalBasicSkill call disabled in EarlyGameBootstrap | GameManager.mortalBasicSkill.test.ts (pick === 'linh_bao') | KILLED (exit 1) |
| M-IMPL-2 | I-IMPL-PICK-REQUIRED | missing-pick preflight throw removed | SaveSystem.bootRestore.test.ts | SURVIVED on pre-fix state -> F-IMPL-2 coverage gap -> pinned -> KILLED on final state (exit 1) |
| M-IMPL-3 | I-IMPL-SAVE-PREFLIGHT | invalid-id preflight throw removed | SaveSystem.bootRestore.test.ts | KILLED (exit 1) |
| M-IMPL-4 | I-IMPL-SKILL-MAP | 'tram' -> 'tram_x' in MORTAL_PRECURSOR_SKILL_IDS | MortalPrecursors.test.ts | KILLED (exit 1) |
| M-IMPL-5 | I-IMPL-CONSUME-ONCE | pendingCreationPick = undefined commented out | App.wiring.test.ts (order pin) | KILLED (exit 1) |
| M-IMPL-6 | I-IMPL-NO-ALLOC | power += 5 allocation write seeded in service | rg creation-path census | KILLED (0->1 hits) |
| M-IMPL-7 | I-IMPL-RPC | p_mortal_basic_skill_id -> p_basic_skill_id | SupabaseCharacterCreationService.contract.test.ts | KILLED (exit 1) |

M-IMPL-2's initial SURVIVED result was itself a finding (F-IMPL-2,
COVERAGE_GAP): the missing-pick rejection had no test pin. The pin landed
in the same correction; re-run on the final state is KILLED.
