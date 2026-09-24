# Internal census verification — NON_INDEPENDENT (coordinator self-check)

Recorded while sealed-reviewer dispatch is blocked on the org SWE-2 concurrency cap.
This is same-context evidence, NOT an independent seal — independence evidence must come
from the sealed reviewer sessions when dispatched.

Oracle: main checkout /home/ubuntu/repos/tutienidle detached at docs commit 44abadfb.

| Spec claim | Verified at 44abadfb | Result |
|---|---|---|
| PlayerData.mortalBasicSkillId?: string | src/core/player/Player.ts:132 + default :418 | TRUE |
| setMortalBasicSkill sole role-write op | src/core/game/GameManagerProgressionOps.ts:639 (write :652) | TRUE |
| runtime absent->tram default | src/core/player/CultivationPathRegistry.ts:325-360 | TRUE |
| MORTAL_PRECURSOR_SKILL_IDS = [tram, linh_bao, huy_quyen] + isMortalPrecursorSkillId | src/core/skill/MortalPrecursors.ts:7-12 | TRUE |
| tram="Huy Kiem" | src/data/skill/CoreSkills.ts:17 | TRUE |
| linh_bao="Linh Bao" | src/data/skill/CoreSkills.ts:69 | TRUE |
| huy_quyen="Huy Quyen" | src/data/skill/CoreSkills.ts:120 | TRUE |
| meta drift 'Hủy Quyền' | src/data/skill/TurnSkillDisplayMeta.ts:52 | TRUE (as spec claimed) |
| CHARACTER_CREATION_ATTRIBUTE_POINTS=5 + invalid_attributes path | CharacterCreationService.ts:3,17,20,52-54 | TRUE |
| RPC sends p_attributes | SupabaseCharacterCreationService.ts:65 | TRUE |
| createBaseStats 1/1/1/1/1 default | StatBlock.ts:59-63 | TRUE |
| allocation UI + stepper in creation screen | CharacterCreationScreen.vue (pre-diff) | TRUE |
| test surface pinning old flow | CharacterCreationService.test.ts, boundary/e2e helpers | TRUE |
| CURRENT_SAVE_VERSION=81 at base | saveVersion.ts | TRUE |

Additional consistency check: every plan step executed without deviation in the
implementation (fb16d2b7..e1161842), which is itself EXECUTED evidence the plan's
step order was implementable as written — no stale symbol, no missing seam, no
wrong-ordered dependency encountered.

Coverage note: self-check only; a sealed reviewer may still probe claims not in
this table (doc-internal consistency, edge enumerations, reading-level clarity).
