[C2C] P7 / MORTAL CHAPTER — FULL SYSTEM AUDIT v2
ROLE
Perform an adversarial, evidence-driven audit of the COMPLETE PHÀM NHÂN gameplay chapter in the CURRENT codebase.
This is an AUDIT ONLY.
DO NOT:
- modify files;
- implement;
- refactor;
- create migrations;
- resurrect legacy systems;
- infer missing design from historical comments;
- treat dead code as live gameplay;
- treat globally-existing systems as Mortal features unless a Mortal player can actually reach them;
- silently make product/design decisions.
The audit boundary is:
Character Creation → entire playable Mortal progression → exact transaction immediately before / during entry into Luyện Khí.
Stop once the player has successfully entered Luyện Khí and post-transition state has been established.
0. EVIDENCE RULES — MANDATORY
Use the LOCAL workspace/current branch state only.
Do not use GitHub as the source of truth if local workspace access exists.
Before auditing:
record branch;
record HEAD commit;
record dirty/staged/untracked state;
identify relevant current P7 specs/plans;
do not modify anything.
Evidence priority
When sources disagree, use this authority order:
Production runtime code that is actually reachable
Tests proving current runtime behavior
Current P7 specs / approved plans
Current system documentation
Code comments
Historical docs / stale plans
A comment is NOT proof of current behavior.
A file existing is NOT proof that the system is live.
A test fixture is NOT proof of production reachability unless the production path exists.
A future/PENDING plan is NOT proof of current implementation.
For every important claim, establish both:
Existence
and
Reachability from a fresh Mortal player
1. REQUIRED CLASSIFICATION
Every audited system/behavior must be classified as exactly one of:
CURRENT LIVE
Production-reachable for a fresh/current Mortal player.
LIVE GLOBAL, NOT MORTAL-SPECIFIC
Exists and may be consumed by Mortal gameplay, but belongs to shared infrastructure rather than the Mortal chapter.
LOCKED DURING MORTAL
Implemented, visible or queryable, but not usable before Luyện Khí or another later gate.
HIDDEN / SPECIAL
Implemented but intentionally outside normal progression/presentation.
DEFERRED / NOT LIVE
Planned, catalogued, stubbed, or disabled but not production-reachable.
LEGACY / RESIDUAL
Old implementation, names, APIs, comments, data, tests, or UI surfaces contradicting the current architecture.
MISSING / INCOMPLETE
Only use this classification when the CURRENT runtime/spec contract requires something that does not exist or cannot complete its intended flow.
Do NOT label something "missing" merely because it might be a good design idea.
2. CANONICAL TERMINOLOGY — HARD RULES
Use current terminology only.
- Active combat classifications are:
  - Basic
  - Special
  - Ultimate
Do NOT call the generic current system "Skill Loadout".
If old code/API names still use loadout terminology, classify that terminology/API as legacy/residual where appropriate.
- Reaction / Elemental Reaction is a Way-specific Pháp Tu mechanic.
It is NOT:
  - a Mortal mechanic;
  - a global realm unlock;
  - a generic Path mechanic.
- Hidden Path / Hidden Way / Hidden Breakthrough must not be treated as normal Path Palette content.
- Body Refinement is a cross-game progression domain.
Mortal owns only the Mortal Body Refinement chapter, not the whole future system.
- Talent is its own domain.
Talent must not own combat execution.
Combat consumes resulting Buffs / Modifiers / combat capabilities.
- Path, Way, Technique, Talent, Body Progression, and Realm are distinct domains unless current production code explicitly couples them.
3. AUDIT QUESTION
Answer one central question:
What does a completely fresh player ACTUALLY experience, own, unlock, use, fight, earn, upgrade, and interact with from Character Creation until the exact moment they become Luyện Khí?
Everything in the audit must support this question.
A. CHARACTER CREATION
Trace the production flow end-to-end.
Audit:
- Character Creation entry;
- Dao Danh;
- validation;
- starting Talent roll;
- starting Talent selection count;
- Talent pool actually used;
- starting Basic / Mortal combat identity;
- starting Technique if any;
- starting attributes/base stats;
- any manual stat allocation;
- starting realm;
- default PlayerData;
- bootstrap mutations after creation;
- starter skill grants;
- starter Technique grants;
- starter inventory/resources;
- initial save creation;
- first production-playable state.
Explicitly identify:
- what CharacterCreationScreen decides;
- what service layer validates;
- what bootstrap/core layer writes;
- what App/store layer adds afterward.
Check for duplicate/bootstrap authority.
B. INITIAL PLAYER STATE
Produce the exact fresh-character state relevant to Mortal gameplay.
Inventory
Audit actual initial amounts/state for:
- equipment;
- spirit stones/currencies;
- materials;
- pills;
- production resources;
- quest items;
- starter equipment/items;
- any prebuilt building/resource state.
Do not infer starter items from catalog existence.
Progression
Audit:
- realmId;
- realmLevel;
- cultivation;
- cultivation rate;
- cultivation cap;
- base stats;
- attribute points;
- skill insight;
- Technique progression;
- Basic progression;
- Body progression;
- stage progression;
- Talent state;
- Path/Way state;
- companion state;
- building state.
Produce a compact fresh-player snapshot.
C. MORTAL BASIC COMBAT IDENTITY
Determine the CURRENT canonical Mortal combat identity.
Audit all relevant candidates including current canonical equivalents of:
- Trảm;
- Huy Kiếm;
- Hủy/Huy Quyền;
- Linh Bạo;
- any other Mortal Basic currently present.
For each CURRENT reachable Mortal combat action report:
- canonical skill/action ID;
- classification:
  - Basic
  - Special
  - Ultimate
  - passive
  - legacy;
- how it is granted;
- whether it is learned;
- whether it is equipped/active automatically;
- production execution pipeline;
- damage formula;
- Might/base damage contribution;
- secondary-stat scaling;
- cadence/cooldown;
- level/progression;
- cast-count progression if any;
- behavior at levels 1/2/3 if implemented;
- whether progression matters before Luyện Khí;
- what happens to it after Path selection.
Critical checks
Search specifically for residual:
- skill loadout slots;
- equipToSlot usage;
- setSkillLoadoutSlot;
- starter Technique assumptions;
- runtime path inference from skills;
- old real-time skill pipeline;
- deprecated Skill representations.
Do not redesign Mortal Basic.
Report architecture seams only.
D. MORTAL COMBAT LOOP
Trace one real Mortal stage from click to settlement.
Required runtime chain:
Stage UI
→ stage validation
→ combat entry
→ build resolution
→ battle creation
→ player spawn
→ enemy/wave spawn
→ turn/action selection
→ skill execution
→ damage
→ vitals
→ buffs/status
→ death
→ victory/defeat
→ reward settlement
→ stage progression
→ retry/progress/auto-farm
→ combat exit
→ save persistence
For every step classify ownership:
- Mortal-specific
or
- global combat infrastructure.
Check:
- manual/auto input;
- repeat;
- progress mode;
- perfect farm;
- boss handling;
- result modal;
- scene transitions;
- cleanup;
- state leakage between runs;
- save timing.
E. MORTAL CONTENT — LIVE CONTENT ONLY
Inventory ALL actual Mortal content.
Stages
Report:
- Mortal zone(s);
- stage IDs;
- floor count;
- stage unlock rules;
- realm-level requirements;
- enemy counts;
- wave rules;
- boss floors;
- perfect-clear rules.
Enemies
Inventory actual Mortal-reachable:
- normal enemies;
- elite variants;
- bosses;
- hidden enemies if reachable during Mortal;
- enemy stat scaling.
Rewards / Drops
Trace actual live drop sources for:
- cultivation-related rewards;
- skill insight;
- spirit stones;
- equipment;
- Body Refinement material;
- pills/materials;
- quest progress;
- Talent hooks;
- companion rewards;
- boss-specific rewards.
Other content
Audit:
- quests;
- achievements;
- exploration/gathering;
- production sources;
- vendors;
- hidden encounters.
Do not list content merely because it exists in a registry.
Prove Mortal reachability.
F. BODY REFINEMENT
Audit BOTH:
CURRENT production behavior
current P7/M5 direction
Do not merge them.
Audit:
- current authority;
- PlayerData fields;
- data definitions;
- six Mortal chapters/tiers;
- tier ordering;
- realm-level gates;
- material cost;
- progress formula;
- Talent modifiers;
- automatic/manual consumption;
- stat contribution;
- breakthrough grade contribution;
- Mortal perfection contribution;
- behavior after leaving Mortal;
- save/restore shape;
- all production consumers;
- all legacy BodyRefinement implementations.
Critical target to compare against
Desired current direction:
Body Refinement contributes BASE STATS.
It should NOT own generic percentage-stat multiplication.
Percentage/multiplier layers belong to systems such as:
- Realm passives;
- equipment;
- explicit Buff/Modifier systems where appropriate.
Report exact conflicts.
Do NOT invent replacement numbers.
G. TALENT
First audit CURRENT Talent architecture completely.
Then compare against the NEW DESIGN below.
New design to RECORD, NOT IMPLEMENT
Talent is a standalone domain/system.
Character Creation grants exactly one starting Talent.
Starting Talent pool is separate from later breakthrough Talent pools.
Starting Talents are deliberately simple.
Roughly 75% may be straightforward stat bonuses.
Some may contain lightweight effects/procs.
Some may be early-game-biased or trade-off Talents.
Later breakthroughs grant additional Talent choices.
Talent pools may be separated by Realm.
Some Talents may be single-pick.
Some may be multi-level and improve through later breakthroughs.
Talent does NOT execute combat logic.
Combat representation is Buff / Modifier / capability.
Combat consumes Buff/Damage/etc. and does not understand Talent ownership semantics.
Audit current support/conflicts for:
- talent definition;
- talent effect declaration;
- stat effects;
- combat passives;
- survive-lethal;
- cultivation effects;
- Body effects;
- reward effects;
- production effects;
- reaction effects;
- Talent hooks in GameManager/BattleLoot;
- hidden passive skill grants;
- save shape;
- multi-talent legacy support.
Important:
Do not propose a new catalog.
Only identify architectural compatibility/conflicts.
H. EQUIPMENT
Audit equipment from the perspective of a Mortal player.
Trace:
enemy/reward
→ equipment generation
→ item instance
→ bag
→ tooltip
→ equip
→ stat contribution
→ unequip
→ enhancement/refinement/etc.
→ save/restore
Audit:
- item grade;
- quality;
- rarity if separate;
- realm requirement;
- stat roll;
- implicit;
- affix;
- equip slots;
- inventory;
- drop rates/sources;
- enhancement;
- refine;
- wash;
- dissolve;
- forge;
- equipment hall;
- realm gate of each operation.
Classify each equipment subsystem as:
- CURRENT MORTAL;
- accessible but premature;
- later-realm;
- deferred;
- legacy.
Hard rule
Item Set system is DEFERRED.
Do not report set bonuses as a missing Mortal feature.
I. BUILDINGS / ECONOMY
Audit every building/system a Mortal player can actually access.
At minimum inspect:
- Động Phủ;
- Truyền Tống;
- Sản Xuất;
- gathering/resource production;
- Đan Phòng;
- alchemy;
- Khí Đường;
- equipment operations;
- Chiêu Hiền Quán;
- Tàng Kinh Các;
- worker systems;
- vendors;
- pill systems;
- any remaining talisman/formation/qi-production systems.
For each system report:
- production reachability from Mortal;
- visible?
- clickable?
- functional?
- resource input;
- resource output;
- realm/building gate;
- actual purpose in Mortal progression;
- whether any Mortal reward feeds it;
- whether it feeds the Mortal → Luyện Khí loop.
Then flag candidates as:
POSSIBLY PREMATURE — USER DECISION REQUIRED
Do not decide that they must move.
J. COMPANION / FORMATION / SOCIAL SYSTEMS
Audit:
- companion roster;
- companion acquisition;
- gacha/recruitment;
- companion progression;
- companion combat participation;
- party formation;
- Trận/formation systems;
- related buildings;
- realm gates;
- Mortal accessibility.
Distinguish carefully between:
- Companion
- party placement
- Trận/formation gameplay
- old formation residue
Do not treat them as the same system.
K. TECHNIQUE / PATH / WAY
Determine exactly what a Mortal player can access before initiation.
Audit:
Technique
- starting Technique;
- whether Mortal genuinely needs/uses one;
- progression;
- rank/grade if current branch has canonical progression;
- combat contribution;
- UI availability.
Path
- whether path is undefined during Mortal;
- Path authority;
- normal Path options;
- Path selection timing.
Way
- Way authority;
- normal Way options;
- gated/hidden Ways;
- capability ownership.
Skill progression
- Mortal-accessible node/progression;
- any Path nodes visible before Path selection;
- passive progression.
Check all path inference residues:
BAD examples:
- owned skill → infer Path;
- seal → infer Path;
- node → infer Path;
- UI state → infer Path.
Current canonical identity must come from Path/Way authority.
L. HIDDEN PATH / HIDDEN BREAKTHROUGH
Audit existing production code/tests only.
Hidden Path / Way
Trace:
- discovery condition;
- offer gate;
- whether hidden content is listed in normal Path Palette;
- whether it is visible while locked;
- whether it appears only when discovered;
- commit transaction;
- reward;
- stronger-than-normal characteristics if actually implemented.
Hidden Breakthrough
Trace:
- special conditions;
- hidden counters;
- Mortal preparation state;
- later realm evaluation;
- foundation types;
- failure state;
- permanent consequences;
- reward.
Design principles to preserve
Hidden content may require substantially more time/effort.
It may be stronger as reward for that investment.
It must NOT become mandatory optimization for ordinary progression.
Do not judge balance unless production tests/data prove a concrete problem.
M. EXACT MORTAL → LUYEN KHI TRANSITION
This is the most important transaction in the audit.
Trace the exact production call chain.
Identify:
- UI entry;
- whether it is called Quán Khí / Initiation Ritual / breakthrough;
- realm-level requirement;
- cultivation requirement;
- cultivation consumption/reset;
- Body requirement;
- Body grade contribution;
- Technique requirement;
- Basic/skill requirement;
- Path requirement;
- Way requirement;
- hidden-path requirements;
- Talent involvement;
- inventory/material cost;
- preflight validation;
- atomicity;
- failure behavior;
- PlayerData mutations;
- Technique mutation;
- skill mutation;
- passive grants;
- quest hooks;
- scene/UI change;
- save trigger;
- post-transition combat build.
Produce a before/after state diff:
BEFORE:
realmId
realmLevel
cultivation
path
way
technique
skills
body
talent
...

AFTER:
...
Do not stop at `realmId = qi_refining`.
Verify the post-transition state is internally valid.
N. COMMAND / UI SURFACE
Inventory EVERYTHING visible/clickable to a Mortal player.
For every entry classify:
- OPEN
- LOCKED
- HIDDEN
- DEFERRED
- LEGACY / RESIDUAL
Inspect at minimum:
- character panel;
- realm panel;
- skill/progression panel;
- Technique panel/band;
- Body section;
- inventory;
- equipment;
- stage selection;
- quest;
- production;
- alchemy;
- equipment hall;
- companion;
- Trận;
- scripture pavilion;
- settings;
- breakthrough/initiation UI;
- command wheel;
- building hotspots.
For OPEN entries, prove the action works.
Do not classify something OPEN solely because a button exists.
Goal:
detect Mortal feature overload using actual reachability.
O. SAVE / MIGRATION / TEST COVERAGE
Audit all Mortal-relevant persistent state.
Save
Identify:
- current save version;
- PlayerData fields;
- manager/system-owned state;
- bags;
- equipment;
- Technique progression;
- skills;
- Path/Way;
- Body;
- Talent;
- stages;
- quests;
- companions;
- production/buildings.
Restore
Trace:
save
→ validation
→ normalization
→ manager restoration
→ PlayerData restore
→ runtime rebind
→ derived modifier rebuild
→ first playable tick
Migration
Classify:
- true migrations;
- fallback/defaulting;
- key whitelisting;
- legacy tolerance;
- silently ignored old state;
- rejected incompatible state.
Tests
Do not merely list test files.
For each important Mortal contract identify whether coverage is:
- UNIT
- INTEGRATION
- E2E / JOURNEY
- MISSING
Pay special attention to:
- fresh character creation;
- bootstrap;
- Mortal Basic;
- battle;
- rewards;
- Body;
- equipment;
- save/load;
- initiation;
- exact Luyện Khí post-state.
P. CROSS-SYSTEM DEPENDENCY MAP
Produce TWO graphs.
P1 — Actual current runtime graph
Example shape only:
Character Creation
    ↓
Player bootstrap
    ├── Talent
    ├── Base Stats
    ├── Mortal Basic
    └── Technique?
          ↓
Cultivation
    ↓
Stage / Combat
    ↓
Reward Settlement
    ├── Equipment
    ├── Materials
    ├── Skill Insight
    ├── Body resources
    └── Quest progress
          ↓
Character Growth
          ↓
Initiation
    ├── Body snapshot
    ├── Path
    ├── Way
    ├── Technique
    └── Skills
          ↓
Luyện Khí
The graph must reflect actual code, not this example.
P2 — Ownership/coupling graph
Explicitly identify questionable edges, e.g.:
Talent ──X──> Combat mutation
Body ──X──> percentage layer
Skill ownership ──X──> Path inference
UI ──X──> domain authority
Realm transaction ──?> Path commit
Mark each edge:
- CORRECT
- QUESTIONABLE
- LEGACY
- MISSING SEAM
Q. COHERENCE TEST
At the end, answer:
Can a completely fresh player, using only production UI and production systems:
create a valid character;
enter the first Mortal gameplay state;
understand/use their Basic;
win Mortal combat;
receive meaningful rewards;
improve their character;
progress Mortal cultivation;
interact with Body progression;
reach the initiation condition;
perform Mortal → Luyện Khí;
end with a valid canonical Path/Way/Technique/skill state;
without:
- dev commands;
- save editing;
- test-only APIs;
- manual state injection;
- placeholder unlocks?
If any step fails, identify the FIRST broken production seam.
OUTPUT FORMAT
Return EXACTLY these 12 sections.
1. MORTAL CURRENT STATE
Give a concise factual description of what is genuinely live today.
Start with:
AUDIT BASIS
Branch:
Commit:
Git state:
Current P7 docs inspected:
Files modified by audit: NONE
Then summarize the actual Mortal chapter.
2. MORTAL PLAYER JOURNEY
Step-by-step production journey:
Character Creation
→ first playable state
→ first combat
→ rewards
→ growth
→ progression
→ initiation
→ Luyện Khí.
Each step must include its owning file/system.
3. SYSTEM INVENTORY
Table:
| System | Classification | Mortal Reachable? | Gate | Authority/Owner | Runtime Entry | Notes |
Do not use vague states like "partial" without explaining exactly what part is live.
4. LEGACY / RESIDUAL
Only include proven contradictions with current architecture.
For every finding use:
[SEVERITY]
Files:
Evidence:
Current behavior:
Current canonical contract:
Why it matters:
5. FEATURE OVERLOAD
Only list systems proven reachable/visible during Mortal.
For each:
System:
Exposure:
Actual function:
Connection to Mortal loop:
Candidate status:
Candidate status may be:
- CORE MORTAL
- SUPPORTING
- POSSIBLY PREMATURE — USER DECISION
- LOCKED
- DEFERRED
Do not make the final product decision.
6. MISSING PIECES
Only include gaps required by current production contracts/specs.
For every item:
[SEVERITY]
Required by:
Missing/incomplete seam:
Evidence:
First affected player step:
Why it blocks/coarsens Mortal coherence:
Do not invent new gameplay.
7. CROSS-SYSTEM OWNERSHIP ISSUES
Focus especially on:
- Talent / Buff / Combat;
- Body / Stats;
- Realm / Path;
- Path / Way;
- Path / Skill;
- Technique / Skill;
- Reward / Progression;
- UI / domain mutation.
Include the ownership graph.
8. BREAKTHROUGH AUDIT
Split into:
Normal Mortal → Luyện Khí
and
Hidden / Special Progression
Do not mix them.
Include the before/after state diff.
9. SAVE / TEST / MIGRATION IMPACT
Report:
- current persistent state;
- migration/fallback behavior;
- legacy save behavior;
- simulation/bootstrap concerns;
- test matrix.
Include a table:
| Contract | Unit | Integration | Journey/E2E | Gap |
10. RECOMMENDED DESIGN DECISIONS
ONLY unresolved factual/product questions that require the user to decide.
For every decision:
D# — Question

Current behavior:
Current evidence:
Why a decision is required:
Options already supported by code/spec:
Do NOT select an option.
Do NOT introduce options unsupported by the audit unless clearly marked as a new design possibility.
11. IMPLEMENTATION PLAN CANDIDATES
Do not write an implementation plan.
Group future work into small independent TDD mission candidates.
Each candidate:
Mission:
Problem proven by audit:
Likely scope:
Acceptance contract:
Dependencies:
Prefer missions that can be independently reviewed and merged.
Do not bundle unrelated systems.
12. FINAL STATE
Return EXACTLY one final state line:
[C2C] STATE MORTAL_AUDIT_READY
if enough evidence exists to describe the complete Mortal production journey.
Otherwise:
[C2C] STATE MORTAL_AUDIT_BLOCKED
and immediately above it list the exact missing evidence/access preventing completion.
FINDING FORMAT — HARD REQUIREMENT
Every actual problem finding anywhere in the report must include:
- Severity: HIGH / MEDIUM / LOW
- File(s)
- Evidence
- Current behavior
- Why it matters
Do not assign severity merely because a feature exists.
Use:
HIGH
- breaks the playable Mortal journey;
- violates a canonical authority boundary;
- corrupts persistence;
- allows invalid transition;
- materially contradicts approved P7 architecture.
MEDIUM
- feature overload;
- ownership ambiguity;
- stale reachable system;
- incomplete UI/domain boundary;
- likely future regression source.
LOW
- terminology;
- comments;
- dead data;
- non-runtime stale documentation.
FINAL AUDIT RULES
- No code changes.
- No generated files.
- No speculative implementation.
- No resurrected legacy design.
- No generic "skill loadout" terminology for the canonical system.
- No Item Set requirement.
- No global Mortal Reaction system.
- No Hidden Path inside the normal Path Palette.
- No treating Body Refinement as Mortal-only.
- No Talent-owned combat execution.
- No conclusions based solely on comments.
- No conclusions based solely on test fixtures.
- No conclusions based solely on catalog existence.
- Prove production reachability.
- Distinguish GLOBAL LIVE from MORTAL LIVE.
- Distinguish CURRENT implementation from NEW DESIGN.
- Stop at valid Luyện Khí entry.
End with only the required C2C state line.
