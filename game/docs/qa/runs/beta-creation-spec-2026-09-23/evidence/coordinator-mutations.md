# Coordinator mutation corpus — beta-creation-spec-2026-09-23

Seed-drift mutations executed against isolated copies of the frozen docs
(@44abadfb content) in /tmp/qa-mutants/. Detector = the coordinator census
claim-check (same grep/symbol-verification used for EV-SPEC-CENSUS-EXEC).
Producer = coordinator (NON_INDEPENDENT): these records prove the claim-check
detector fires on seeded drift; they do not replace sealed review.

| mutation | invariant | drift seeded | detector fired |
|---|---|---|---|
| MUT-SPEC-RULING | I-SPEC-RULING-MAP | erased 'Huy Kiếm' from ruling->contract map | missing skill name in §2 |
| MUT-PLAN-SEAM | I-PLAN-FEASIBLE | setMortalBasicSkill -> assignMortalSkillV2 | symbol absent in src/ |
| MUT-CENSUS-ALLOC | I-CENSUS-ALLOC | allocateStats -> RESERVED_SYMBOL_XYZ | census symbol dropped vs rg writers |
| MUT-CENSUS-PICK | I-CENSUS-PICK | mortalBasicSkillId -> basicSkillPick | 0 references remain vs real consumers |
| MUT-BOOT-SEAM | I-BOOT-SEAM | post-learn -> pre-learn pick write | contradicts setMortalBasicSkill learned-requirement |
| MUT-SAVE-V82 | I-SAVE-V82 | v82/82 -> v81/81 | contradicts CURRENT_SAVE_VERSION+1 ruling |
| MUT-TEST-INV | I-TEST-INV | fabricated CharacterAllocationStep.test.ts entry | file does not exist on disk |

All 7: result=KILLED_EXPECTED, candidateUnchanged=true (mutants isolated to
/tmp/qa-mutants; repository candidate untouched).
