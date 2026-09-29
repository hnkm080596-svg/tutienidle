# TU TIÊN IDLE — MASTER HEAD BETA RELEASE EXHAUSTIVE QA MISSION

Source: user-provided mission brief (handed to cloud master agent). Executing agent: cloud Devin. This file preserves the verbatim brief.

## 0. ROLE AND PRIMARY OBJECTIVE
You are the principal Beta release QA coordinator, adversarial game tester, invariant hunter, runtime verifier, persistence auditor, and systems integration reviewer for Tu Tiên IDLE.
Your mission is to attempt to falsify the claim:
The current Git `master` aggregate repository state is ready for a public Beta whose playable progression ceiling is Trúc Cơ / Foundation Establishment.
This is a release-readiness / milestone audit, therefore use the repository's deep adversarial QA mode, not a quick feature review.
You are not being asked merely to run tests.
You must challenge the complete playable product from:
- architecture;
- canonical state ownership;
- character creation;
- authentication/session flow;
- save/load/cloud boundaries;
- progression;
- all six Ways;
- combat;
- skills;
- nodes;
- techniques;
- talents;
- body progression;
- hidden/perfection lineage;
- inventory;
- economy;
- rewards;
- equipment;
- stages;
- auto-farm/idle/offline behavior;
- companions;
- formations;
- UI;
- Phaser runtime;
- presentation timing;
- VFX;
- audio;
- accessibility;
- i18n;
- Electron/browser lifecycle;
- authored content;
- test quality;
- and the QA infrastructure itself.
Search from the largest architectural invariant down to the smallest player-visible or state-machine defect.
Do not optimize for test count, speed, token usage, or number of review rounds.
Optimize for:
detection power, correctness, root-cause removal, regression resistance, and confidence in the exact aggregate state.

## 1. FREEZE THE ACTUAL MASTER STATE FIRST
At the time this mission was authored, the GitHub `master` HEAD is:
`f1049b5e42757f14aebee18bab3569dc43c37d09`
Recent integration includes:
- Sound System architecture/scaffold;
- animation-driven combat impact synchronization.
Do NOT blindly assume the checkout still equals that SHA.
Before doing anything:
determine the actual current `master`;
record the exact HEAD SHA;
record branch/upstream;
record staged, unstaged and untracked state;
determine whether the checkout represents the exact candidate being audited;
materialize/isolate the aggregate candidate if necessary.
If `master` has advanced beyond the SHA above, audit the new actual master HEAD, record the drift, and rebuild the QA snapshot.
Never run tests on one state and claim them as evidence for another.
The final verdict MUST identify the exact:
- `productStateId`;
- `contractId`;
- `attackModelId`;
- `environmentId`;
- Git SHA.
A Git SHA alone is not sufficient if the worktree contains relevant dirty/untracked material.

## 2. USE THE REPOSITORY'S CANONICAL QA SYSTEM
The sole QA decision authority is:
`game/docs/qa/protocol/README.md`
Also read and obey:
- `game/docs/qa/protocol/agent-instructions.md`
- `game/docs/qa/protocol/defect-taxonomy.md`
- `game/docs/qa/protocol/ledger-schema.md`
- `game/docs/qa/protocol/qualification.md`
- `game/docs/qa/learning.md`
- `game/docs/qa/learned-defects.md`
- `.agents/skills/tutienidle-adversarial-qa/`
- all domain packs required by deep mode.
Do NOT invent a parallel QA protocol.
Do NOT use historical C2C / ChatGPT-Web external-review transport as a release criterion.
Do NOT use arbitrary rules such as:
- "5 review rounds";
- "two passes are enough";
- "all tests green = done";
- "no Critical/High means pass";
- "reviewer said DONE".
The current repository already defines its convergence law.
Use `qa:internal` and its ledger as the decision mechanism.
The official terminal outcomes are ONLY:
- `QA_FIXED_POINT_REACHED`
- `QA_FINDINGS_OPEN`
- `QA_UNVERIFIED`
- `QA_BLOCKED_SCOPE`
- `QA_ACCEPTED_WITH_EXCEPTIONS`
Do not invent `BETA QA EXHAUSTED`, `PASS`, or another competing final verdict.

## 3. RELEASE-AUDIT MODE
This is not a change-scoped PR review.
The approval object is the complete aggregate Beta repository state.
The diff is only useful for discovering recent risk.
For this mission:
Treat every production path capable of affecting a Beta player as in scope for inspection, even if it was not recently modified.
Recent code does not receive less scrutiny because it has already been reviewed.
Old code does not receive less scrutiny because it has survived for a long time.
A subsystem with 500 existing tests is not assumed correct.
A previously accepted milestone is not assumed correct.
Historical QA reports are attack hypotheses and evidence history, not proof that the current aggregate state remains correct.

## 4. QA / REPAIR SEPARATION
During an adversarial QA phase, respect the repository QA write boundary.
QA reviewers may create:
- focused reproduction tests;
- E2E evidence;
- QA reports;
- QA ledger/evidence artifacts.
Do NOT silently edit production code while acting as a supposedly independent QA reviewer.
When a defect is proven:
record it;
identify its invariant;
identify its canonical owner;
determine the root defect class;
search semantic siblings repository-wide;
transition into the protocol's explicit REPAIR phase with authorized writer ownership;
repair the coherent cause;
add the strongest appropriate regression pin;
freeze the new state;
invalidate affected evidence;
re-run affected QA;
return to adversarial review.
A repair invalidates prior clean evidence according to the protocol dependency graph.
Never fix something invisibly and preserve a stale PASS.

## 5. CURRENT BETA BOUNDARY
Playable Beta scope ends at:
Foundation Establishment / Trúc Cơ
Beta correctness includes the complete journey from first application launch through Foundation gameplay.
Post-Foundation systems are not required to be playable.
However, shared post-Beta code remains in QA scope when it can:
- leak content into Beta;
- alter generic realm arithmetic;
- affect registries;
- affect save validation;
- affect shared combat/stat logic;
- affect generic UI;
- affect economy/drop bands;
- create dangling references.
In particular:
Artifact is currently deferred to Golden Core / Kim Đan+.
Therefore Beta QA should verify that Artifact does not leak or grant prematurely at Foundation.
Do not fail Beta merely because Golden-Core Artifact gameplay is unavailable.

## 6. CURRENT CANONICAL IDENTITY MATRIX
The canonical base Paths are exactly:
- `sword`
- `spell`
- `body`
The canonical Ways are exactly:
- `sword_pathway`
- `hidden_sword_pathway`
- `spell_pathway`
- `hidden_spell_pathway`
- `body_pathway`
- `hidden_body_pathway`
Audit every legal `(path, way)` pair.
Audit every illegal pair.
A path/way pair is atomic identity.
No stale legacy Vietnamese path ID may become a second identity authority.
Search every:
- writer;
- resolver;
- UI reader;
- save validator;
- restoration path;
- capability predicate;
- stat facet;
- combat build;
- reward path;
- fixture.
Verify that the six-Way model remains internally consistent.

## 7. CHARACTER CREATION — CURRENT HEAD CONTRACT
The creation audit MUST reflect the current Beta design.
New characters begin with:
Base main stats = `1 / 1 / 1 / 1 / 1`
There is no old five-point creation allocation.
The creation flow includes:
- name;
- starting talent;
- starting mortal Basic skill.
The three mortal starting-skill identities are:
- `tram` → Huy Kiếm
- `linh_bao` → Linh Bạo
- `huy_quyen` → Huy Quyền
Test all three choices.
Verify:
- UI option → creation payload;
- creation service;
- local/mock path;
- online/Supabase-capable seam where testable;
- EarlyGame bootstrap;
- PlayerData;
- SkillManager membership;
- `mortalBasicSkillId`;
- runtime combat-role resolution;
- save;
- reload;
- simulation profile.
A valid Mortal save must not rely on an implicit `tram` decision to repair missing canonical creation state.
Attack:
- missing pick;
- foreign skill ID;
- legal but unlearned pick;
- duplicate creation request;
- refresh during creation;
- retry after failed persistence;
- creation through alternate service implementation;
- stale fixture using the deleted attribute-allocation contract.
Creation must lead to a real combat-ready character without developer state injection.

## 8. AUTHENTICATION / SESSION / SAVE ENTRY FLOW
Current project contains:
- guest authentication;
- AuthService abstraction;
- mock/local auth path;
- Supabase auth implementation;
- Local Cloud Save;
- Supabase Remote Save;
- CloudSaveCoordinator;
- SaveSystem;
- session handoff.
Audit the complete player entry lifecycle:
Application start
→ authentication/guest entry
→ character existence detection
→ create/load
→ home
→ gameplay
→ persistence
→ reload
→ re-authentication/session restoration.
Attack:
- reload immediately after login;
- reload immediately after creation;
- local save with no remote save;
- remote unavailable;
- failed cloud write;
- stale cloud snapshot;
- local/remote identity mismatch;
- duplicate save attempts;
- quota/storage error;
- pagehide/quit ordering;
- interrupted handoff;
- logout/login or guest re-entry where supported.
Never use real credentials or production accounts to manufacture QA evidence.
Unavailable remote capability is a declared coverage limitation, not imaginary success.

## 9. SAVE CONTRACT — CURRENT VERSION
Current HEAD uses:
`CURRENT_SAVE_VERSION = 87`
Development policy is:
version rejection, not compatibility translation.
Do NOT demand migration support that the project explicitly does not implement.
Instead verify:
- current v87 save accepts;
- complete non-empty current state round-trips;
- older versions fail cleanly;
- retired fields do not resurrect;
- failed validation causes zero partial restoration;
- derived state is reconstructed only from canonical sources.
Explicitly attack legacy data such as:
- old path/way identities;
- generic skill loadout fields;
- independent `skillLevels`;
- retired BodyProgression fields;
- obsolete technique shape;
- retired hidden state;
- stale Spell `route`;
- invalid core nodes;
- malformed Technique `gradeHistory`;
- impossible hidden lineage state.
For every save attack compare:
before restore vs after rejected restore
across all relevant live owners, not merely the incoming payload.
A rejection is not proven atomic by a returned `false`.

## 10. COMPLETE BETA JOURNEY
Execute and reason through the real journey:
Fresh boot
→ authentication/guest
→ creation
→ Mortal gameplay
→ Mortal progression
→ initiation / Qi Refining entry
→ Qi Refining stages/progression
→ Foundation gate
→ tribulation/breakthrough
→ Foundation entry
→ Foundation systems
→ Foundation Beta ceiling.
The journey must work using production-facing gameplay operations.
Do not call a Beta journey complete if progression required editing PlayerData by hand.
Lab/debug tools may accelerate exploration, but the final proof must include real production seams.

## 11. REALM / BREAKTHROUGH CONTRACT
All current major realms use an 18-level shape.
Audit important threshold states at least around:
- 1;
- 11;
- 12;
- 13;
- 17;
- 18.
Do not assume every major-realm transition uses an identical mechanism.
For the current normal Foundation gate, verify the authoritative Qi requirements:
- Luyện Khí level 12;
- Chapter 10 `qi_refining_abyssal_pool` cleared.
The normal-facing UI should expose the intended normal requirements without leaking hidden resolver-only information.
Attack:
- level 11 + chapter clear;
- level 12 + chapter missing;
- exact legal state;
- level 18 states;
- reload before eligibility;
- reload after eligibility;
- repeated breakthrough request;
- defeat/failure where tribulation applies;
- committed outcome not yet drained;
- double drain;
- stale retry/cooldown state;
- post-commit replay.
Realm settlement must be exactly-once.

## 12. HIDDEN PERFECTION LINEAGE
Treat hidden progression as a high-risk state machine.
The persisted `hiddenPerfection` lineage is canonical.
Audit:
- `lineageActive`;
- lineage closure;
- closure realm;
- realm discovery;
- frozen states;
- completed hidden-body realms;
- hidden breakthrough records;
- realm-specific mechanics.
Test the strict-prefix property.
Once a normal breakthrough closes the hidden lineage, later systems must not reopen it accidentally.
Attack:
- hidden discovery after closure;
- hidden progress after closure;
- completing later hidden body without earlier required history;
- duplicate completion;
- duplicate reward;
- reload around discovery;
- reload around completion;
- reload around breakthrough;
- malformed sparse realm records;
- mismatched bodyCompleted/completed list;
- impossible hidden-breakthrough record;
- future realm hidden data injected into a Beta save.
Historical completed rewards must survive correctly without becoming repeatable.

## 13. CURRENT HIDDEN REALM MECHANICS
Audit the actual authored Beta mechanics rather than a generic hidden checklist.
Mortal
Ancient Beast trial / hidden Mortal mechanism.
Challenge:
- battle-selection probability/trigger;
- encounter replacement;
- survival requirement;
- completion cardinality;
- hidden discovery;
- repeated trial;
- reload.
Qi Refining
Quán Thể / related hidden mechanism.
Verify its state is realm-bound and lineage-bound.
Foundation
Normal Chu Thiên uses the current discrete model.
Current Foundation hidden mechanics include Nghịch Chu Thiên state.
Audit:
- completed steps;
- per-level pity;
- active state;
- RNG boundaries;
- exact resource debits;
- failure;
- success;
- pity persistence;
- reload;
- repeated attempt;
- attempt after completion.
Randomness must be exercised through deterministic seams when possible.
Do not "prove" an RNG mechanic solely from code inspection.

## 14. BODY PROGRESSION AUTHORITY
`BodyProgression` is the canonical cross-realm owner.
Audit all live chapters and chapter prerequisites.
Check:
- Body Refinement;
- Meridian progression;
- Zhou Tian / Foundation chapter;
- late completion;
- realm transition;
- chapter ordering;
- derived facts;
- UI projection.
Search globally for any retired independent engine/field still acting as a writer.
Every Body transaction must satisfy:
Either the complete state transition commits with the exact valid resource consumption, or no relevant owner changes.
Attack resource:
- 0;
- requirement − 1;
- exact requirement;
- requirement + 1;
- full bag;
- wrong material;
- wrong grade;
- higher-grade substitution;
- repeated click;
- save/reload.

## 15. ESSENCE / PHYSIQUE
Current early grade bands include:
- Mortal → Tinh Hoa Phàm Thể
- Qi Refining → Tinh Hoa Bảo Thể
- Foundation → Tinh Hoa Pháp Thể
Higher-grade Essence may substitute downward according to the canonical conversion model.
Do not invent upward conversion.
Verify:
- exact debit;
- no arbitrage;
- substitution direction;
- mixed-stack payment;
- shortage after conversion;
- late body completion.
Physique transformation must happen exactly once at its canonical completion checkpoint.
Attack:
- chapter complete before restore;
- repeated reconstruction;
- late completion;
- completion after realm advancement;
- malformed persisted physique grade;
- duplicate transformation.
No reload may advance physique twice.

## 16. TECHNIQUE — CURRENT MODEL
Current Technique is not the old insight/tier/equip-library model.
Audit the canonical holder:
- zero Technique while Mortal where required;
- canonical Technique after Way commitment;
- `grade`;
- `rank`;
- `mastery`;
- `quality`;
- `gradeHistory`;
- grade effects;
- realm ceiling.
Current frozen-cycle model uses a rank ladder up to the authored current ceiling model, including the current 0..18 rank contract.
Verify:
- rank advancement;
- grade-cycle sealing;
- partial/frozen historical cycle;
- realm exit;
- grade advancement;
- malformed grade history;
- realm ceiling;
- restore integrity.
Technique mastery must come only from authorized sources.
Battle-victory mastery in particular must not be granted from:
- defeat;
- aborted battle;
- visual completion alone;
- duplicate settlement;
- scene teardown;
- repeated drain.
Quality is a modeled axis but has no arbitrary player upgrade route unless current authored production code explicitly provides one.
Search for accidental quality mutation.

## 17. SKILL / CORE NODE AUTHORITY
Current canonical Skill Level authority is:
Core Node Level
Do not resurrect an independent `Skill.level` or persisted `skillLevels` authority.
For every Beta levelled authored skill:
Skill identity
→ Core Node ownership
→ node level
→ resolver/build
→ execution definition
→ actual outcome.
Test each Beta skill individually.
For every levelled skill verify that increasing its canonical Core level changes its intended real runtime effect.
Do not settle for:
"the level number increased."
Verify actual:
- damage;
- healing;
- shield;
- duration;
- resource generation;
- proc magnitude;
- or other authored effect.
For internal/generated/chained/emblem actions, verify scaling remains owned by the intended parent Core/Variation rather than silently creating a second level authority.

## 18. NODE SYSTEM
Audit:
- purchase;
- upgrade;
- maximum level;
- unlock;
- respec where supported;
- reward-only/granted-only nodes;
- mutual exclusion;
- branch semantics;
- Technique rank gates;
- Technique grade gates;
- realm gates;
- one-shot grants;
- clawback/provenance.
Attack both directions:
If A requires B:
Try A without B.
If A grants B:
Remove/reset A and determine whether B should disappear, remain historically owned, or be clawed back.
Do not assume every inverse restores exact prior state.
Establish the intended inverse contract first.

## 19. SIX-WAY GAMEPLAY MATRIX
Every Way needs its own end-to-end audit.
`sword_pathway`
Audit current Kiếm Phổ behavior including:
- Basic-only progression contract;
- orb unlocks;
- preset/combo ownership;
- tail matching;
- authored combo catalog;
- realm gating;
- no accidental Special/Ultimate exposure;
- no generic loadout authority.
`hidden_sword_pathway`
Audit Ngự Kiếm:
- fixed-kit semantics;
- canonical core/node ownership;
- emblems/internal actions;
- evolution/granted nodes;
- combat-role normalization;
- persistence.
`spell_pathway`
Audit the current reimagined Spell path.
Important:
the old persisted `route` machinery is retired in save v87.
Check:
- no live legacy route writer;
- no stale route UI;
- no route-dependent combat behavior;
- elemental state;
- MP/resource behavior;
- Basic/Special Beta progression as currently authored;
- elemental/reaction isolation.
`hidden_spell_pathway`
Audit its fixed authored kit independently from the normal B/S/U progression-unlock axis.
Do not destroy fixed-kit actions merely to satisfy a literal "Basic only" interpretation.
`body_pathway`
Audit current normal Body tree:
- root choice;
- Basic identity;
- Foundation Special acquisition;
- HP costs;
- Max-HP scaling;
- reflection;
- taunt/mark;
- node-driven skill modifications;
- exact once-per-action proc semantics.
`hidden_body_pathway`
Audit current Ứng Thế implementation:
- Thám Thế;
- Quan Thế;
- Thế economy;
- observed target;
- reaction debt / Ứng Trệ / Quá Thế;
- reactive windows;
- Phản/Hộ/Trợ behavior as currently authored;
- hard-CC gates;
- success-only cost;
- borrowed-action economy;
- post-action ordering;
- save/runtime ownership boundaries.
For all six Ways compare:
- headless build;
- actual battle runtime;
- UI representation;
- save/reload;
- canonical node/skill ownership.

## 20. COMBAT — END TO END
Trace a battle through the actual production graph:
Encounter/stage
→ battle request
→ GameManager
→ TurnBattleSystem
→ presentation admission
→ CombatScene
→ action selection
→ skill build
→ cast
→ presentation
→ impact
→ damage/effects
→ death
→ battle outcome
→ settlement
→ rewards
→ persistent progression.
Verify the domain outcome does not depend on a decorative visual accidentally completing.
Test:
- player faster;
- enemy faster;
- ties;
- exact-zero HP;
- overkill;
- AoE;
- multi-hit;
- miss;
- crit;
- ward;
- armor/pierce;
- buffs/debuffs;
- reactive proc;
- chained actions;
- hard CC;
- sudden/dead-end combat states;
- no valid action;
- insufficient resource;
- actor death between declaration and impact;
- target death between hits;
- battle abort;
- scene restart.
Outcome and reward settlement must occur exactly once.

## 21. IMPACT SYNC / PRESENTATION TIMING
Current HEAD includes animation-driven cast-impact timing.
Treat this as a dedicated high-risk integration surface.
Audit the contract:
Domain action declaration
→ presentation fact
→ clip selection
→ authored impact marker
→ runtime timing
→ impact ACK/resume
→ domain resolution.
Challenge:
- duplicate presentation event;
- same-reference duplicate;
- stale token;
- missing token;
- omitted ACK;
- repeated ACK;
- scene switch mid-cast;
- asset missing;
- preferred clip invalid;
- fallback clip;
- static entity;
- resumed cast before impact;
- resumed cast after impact;
- zero-frame asset;
- invalid/non-finite marker timing;
- clip marker outside legal bounds.
Critical invariant:
Presentation controls when a pending domain impact is released, but must never become a second authority for damage/reward/state.
A visual failure must not:
- deal damage twice;
- skip a committed domain action forever;
- replay a cast after resolution;
- grant reward;
- resurrect stale callbacks into the next battle.
Search specifically for per-skill-ID branches inside generic hot paths.

## 22. BUFF / REACTION / PROC SYSTEMS
Audit current shared combat effect engines:
- buff2;
- reactions;
- ailments;
- reactive triggers;
- proc queue;
- follow-up actions;
- reflect;
- control effects.
Check:
- ownership;
- apply;
- refresh;
- stack;
- expiry;
- dispel;
- cleanup;
- target death;
- source death;
- repeated battle;
- save boundary if persistent effects exist.
Cardinality is critical.
A final idempotent state does NOT prove the effect executed only once.
Assert invocation/event counts where exactly-once is part of the contract.
Spell elemental mechanics must not leak globally to Sword/Body merely because a shared helper accepts an element.

## 23. STATS / VITALS
Trace the full stat pipeline from authoritative inputs to combat-effective stats.
Inspect:
- base main stats;
- Body raw contributions;
- physique/perfection effects;
- talents;
- equipment;
- realm passives;
- Technique effects;
- Way stat facets;
- external modifiers;
- combat deltas;
- final values.
Verify provenance and ordering.
Test numeric boundaries:
- zero;
- negative supported-boundary inputs;
- exact cap;
- cap ±1;
- NaN;
- Infinity;
- unsafe integer/overflow where external input can reach it.
Search for:
- double application;
- stale modifier;
- wrong StatDomain;
- foreign-Way domain leakage;
- HP/maxHP desynchronization;
- vitals mutation outside the canonical vitals owner;
- reload applying permanent modifiers twice.
UI stat values must agree with actual production combat construction.

## 24. TALENTS
Audit:
- creation talent;
- mandatory breakthrough entitlement;
- NEW selection;
- UPGRADE selection;
- talent levels;
- offer generation;
- persisted pending offer;
- settlement;
- effect application.
Attack known historical defect families:
- generic entitlement plus hidden/evolution outcome simultaneously;
- forged offer;
- foreign talent;
- zero-weight member inside otherwise legal offer set;
- duplicate choice;
- latent unowned level;
- reload while entitlement pending;
- proceeding while mandatory choice is unresolved.
Every offered option must be individually legal.
"One legal member exists" is not enough.

## 25. INVENTORY / ITEM / REWARD CONSERVATION
For every important Beta item/material transition verify conservation.
Test:
- bag empty;
- capacity −1;
- exact capacity;
- capacity +1;
- stack full;
- partial delivery;
- zero delivery;
- overflow;
- duplicate settlement.
Critical invariant:
A source item/progression transaction must not be destroyed unless the required output was accepted according to its contract.
Re-run relevant historical defect patterns such as:
- reward at full bag;
- partial delivery;
- zero-delivery event dispatch;
- duplicate payout;
- stale reward settlement.

## 26. EQUIPMENT
Audit the complete current equipment pipeline:
- drop;
- instance creation;
- affix allocation;
- grade/quality;
- bag;
- equip;
- unequip;
- replace;
- enhance;
- refine;
- wash;
- dissolve;
- stat contribution;
- save/reload.
Attack every production equipment slot where rules differ.
Search for:
- duplicate compatible affixes;
- incompatible affix family;
- failed transaction partially consuming currency/item;
- equipped item removed while modifier remains;
- stat ghosting;
- same instance equipped more than once;
- preview/commit replay;
- forged preview payload;
- restore of non-empty equipment state.
Use the learned defect ledger—equipment has historically exposed several QA escape classes.

## 27. ECONOMY / PRODUCTION / BUILDINGS / WORKERS
Build a Beta economy graph:
source
→ inventory/currency
→ sink
→ gameplay progression dependency.
Audit:
- spirit stones;
- Essence;
- progression materials;
- worker economy;
- buildings;
- production cycles;
- gathering;
- cultivation resources;
- pill/alchemy resources where active;
- quests;
- drops;
- auto-farm.
Identify:
- sink with no source;
- source with no sink;
- mandatory material unreachable;
- hidden material exposed normally;
- infinite-value loop;
- duplicate production tick;
- resource produced before unlock;
- current resource that is still generated despite being deferred.
Use exact debit/credit assertions.
Do not classify ordinary number tuning as a correctness defect unless it causes structural progression failure/exploit.

## 28. STAGES / ENEMIES / DROPS
Programmatically census every Beta stage and enemy.
For each Beta-reachable enemy validate:
- ID;
- data reference;
- realm;
- combat build;
- skill/action definitions;
- asset/presentation reference;
- reward/drop source;
- encounter eligibility;
- defeat handling.
For stages verify:
- unlock;
- traversal;
- Chapter progression;
- perfect-clear rules;
- auto-farm eligibility;
- reward tables;
- continuation after reload.
Attack conditional-drop rules explicitly.
A rare/hidden drop moved into an unconditional table is a serious progression leak even if all unit tests pass.
Test best-case feasibility of progression thresholds such as perfect clear.
A requirement that is mathematically unreachable in real authored content is a defect, not merely "hard balance".

## 29. AUTO-FARM / IDLE / OFFLINE
Manual and automated progression must use compatible canonical owners.
Compare equivalent scenarios across:
- live combat;
- auto-farm;
- idle/world ticks;
- offline settlement.
Compare:
- rewards;
- mastery;
- stage progression;
- resources;
- kills;
- hidden counters;
- quest progress;
- production;
- save state.
Search for duplicate invocation from multiple tick/update owners.
A final idempotent value can hide two calls.
Measure event/operation cardinality where relevant.
Test:
- short interval;
- long interval;
- reload during auto-farm;
- offline return;
- clock jump;
- negative/stale timestamp;
- repeated offline collection.

## 30. COMPANIONS AND FORMATION
Foundation is the first Beta region where these systems become material.
Audit current companion acquisition, including the current gift/mail-style acquisition contract where applicable.
Verify:
- no premature Mortal/Qi material exposure;
- authored unlock;
- claimability;
- claim exactly once;
- duplicate gift;
- duplicate companion;
- save/reload;
- companion fixed kit;
- progression/scaling;
- combat participation;
- reward cardinality.
Re-run the historical duplicate-companion-payout attack:
the same logical combatant must not produce duplicate per-kill rewards merely because malformed assignment placed it in multiple slots.
Formation audit:
- unlock;
- placement;
- drag/input;
- duplicate combatant prevention;
- active loadout;
- combat projection;
- save/reload;
- stale formation member.

## 31. ARTIFACT NEGATIVE BETA CONTRACT
Artifact is deferred past the Beta ceiling.
Therefore test:
- no normal Foundation grant;
- no Foundation wheel/action falsely enabled;
- no Foundation progression dependency;
- no stage/drop/quest requiring Artifact;
- no Artifact stat leaking into a clean Beta character.
Do not remove dormant post-Beta Artifact code merely because it exists.
Only Beta exposure/interaction is relevant to release readiness.

## 32. QUESTS / NOTIFICATIONS / ANNOUNCEMENTS
Audit quest lifecycle:
- activation;
- progress;
- completion;
- claim;
- duplicate claim;
- objective source;
- reward delivery;
- save/reload.
Check retired/deferred resource objectives for stale quests.
Audit notification and announcement layers for:
- duplicate event;
- stale event after reload;
- blocked modal;
- layering;
- focus trapping;
- progression action hidden behind a persistent overlay.
Player-facing presentation must not make a valid progression action practically unreachable.

## 33. UI / UX — SYSTEMATIC BETA AUDIT
Inspect every Beta-reachable panel and route.
For every action verify:
UI eligibility
= domain eligibility
= commit eligibility.
A disabled button is not sufficient if another UI path can invoke the operation.
A green button is defective if the canonical domain will always reject it.
Check:
- loading state;
- empty state;
- locked state;
- exact requirement text;
- maximum state;
- insufficient-resource state;
- pending transaction;
- success;
- failure;
- save/reload projection.
Audit current canonical UI ownership:
- SkillPathPanel;
- RealmPanel / BodyProgression sections;
- combat HUD;
- bags/equipment;
- world/stages;
- companion/formation;
- settings;
- creation/auth surfaces.
Search for retired gameplay authority resurfacing in UI, especially:
- generic skill loadout;
- standalone Technique progression;
- legacy Spell route;
- retired body fields.

## 34. VISUAL RUNTIME / PHASER
Run actual browser/runtime checks.
Inspect:
- Scene creation;
- Scene shutdown;
- Scene restart;
- event binding;
- event teardown;
- timers;
- tweens;
- particles;
- projectiles;
- animation handlers;
- resize;
- canvas layers;
- overlays.
Run many sequential battles without page refresh.
Look for accumulation of:
- listeners;
- timers;
- tweens;
- sprites;
- pending animation receipts;
- stale battle references.
Battle N must not inherit transient runtime from Battle N−1.

## 35. AUDIO — CURRENT HEAD
Sound architecture is now a real HEAD subsystem.
Audit:
- AudioManager lifecycle;
- unlock-by-user-gesture;
- cue manifest;
- cue resolution;
- channel buses;
- master/music/SFX/ambient settings;
- route music;
- crossfade;
- cue cooldown;
- ducking;
- enable/disable;
- ready listeners;
- disposal;
- persisted settings;
- UI bindings;
- combat event bindings;
- reduced-shake interaction where coupled through settings.
Important distinction:
The current scaffold may intentionally have empty asset-drop slots / silent fallback.
Do NOT report "missing final audio file" as a runtime architecture defect if the current sound spec deliberately allows silence until assets are supplied.
Instead test that:
- a valid cue safely resolves;
- missing slot fails silently as designed;
- no exception occurs;
- routes are wired;
- cue cardinality is correct;
- settings persist;
- listeners clean up;
- re-enable resumes intended music behavior;
- battle/UI events do not spam duplicate cues.
Run the real sound E2E path.

## 36. SETTINGS / ACCESSIBILITY / REDUCED MOTION
Audit:
- keyboard accessibility;
- focus;
- dialog focus return;
- ARIA states where applicable;
- reduced motion;
- reduced shake;
- text scaling/layout tolerance;
- command wheel keyboard path;
- Escape/back semantics;
- disabled control semantics.
Run current accessibility E2E.
Run reduced-motion behavior.
Accessibility defects that prevent operating a required Beta action are release correctness defects, not optional polish.

## 37. I18N / TEXT / PLAYER-FACING CONTRACTS
Current project has Vietnamese/English locale infrastructure.
Audit:
- key parity;
- missing keys;
- raw internal IDs exposed;
- retired terminology;
- incorrect realm/Way/skill labels;
- requirement text inconsistent with canonical eligibility.
Gameplay-facing text that tells the player the wrong requirement is a correctness defect.
Do not mechanically report cosmetic wording preferences.

## 38. ELECTRON / BROWSER LIFECYCLE
The game has both browser and Electron-oriented infrastructure.
Audit applicable lifecycle seams:
- combat clock host;
- quit flush;
- page unload;
- save before quit;
- runtime pause/resume;
- reload.
Where Electron packaging cannot be executed in the available environment, record the coverage boundary honestly.
Do not infer Electron correctness from browser-only tests.

## 39. STATIC ARCHITECTURE / AUTHORITY CENSUS
For every high-risk concept build a repository-wide census of:
- canonical owner;
- legal writers;
- legal readers;
- projections;
- caches;
- save serializer;
- save validator;
- restorer;
- reset/revoke;
- UI;
- simulation;
- debug/test helpers;
- event producers;
- event consumers.
Classify hits as:
- CANONICAL
- LEGAL_WRITER
- PROJECTION
- CACHE
- COMPATIBILITY
- LEGACY
- TEST_ONLY
- DEAD
- SUSPICIOUS
Do not prove absence by one literal grep.
Search aliases, wrappers, event names and data-driven registration.
Particularly census:
- path/way;
- realm;
- hidden lineage;
- Skill/Core levels;
- node levels;
- Technique;
- BodyProgression;
- vitals;
- stats;
- battle outcome;
- rewards;
- save;
- presentation receipts.

## 40. DATA / REGISTRY VALIDATION
Programmatically inspect authored registries.
Detect:
- duplicate IDs;
- missing references;
- dangling refs;
- illegal enum values;
- invalid realm IDs;
- invalid Way pairings;
- orphan Core Nodes;
- Core grants without valid owner;
- impossible prerequisite cycles;
- hidden content exposed through normal catalog;
- post-Beta content required by Beta;
- asset descriptors referencing nonexistent critical assets;
- stale route/node IDs;
- unowned reward entries.
Test both reference directions where ownership is bidirectional.
If:
Skill → Core
is valid,
also ask whether every owned Core has a legal Skill/Way/node/grant source.

## 41. TEST SUITE AUDIT
Do not merely execute the test suite.
Audit its ability to detect defects.
Search for tests that:
- assert input instead of live owner;
- use implementation helper as expected-value oracle;
- mock the SUT itself;
- assert only `truthy`;
- verify a saved payload but not restored live state;
- verify final idempotent state but not call count;
- snapshot a subset of persisted state;
- skip under a provisioned environment;
- silently tolerate a timeout;
- encode a known bug as expected behavior;
- only exercise debug/test seams.
For every critical invariant ask:
If I deliberately removed or inverted this invariant, which test would fail for the intended reason?
Where justified, run targeted invariant mutations.
Compilation failure is not a valid semantic mutation kill.

## 42. LEARNED-DEFECT REPLAY
Read the complete current:
`game/docs/qa/learned-defects.md`
and QA corpus.
Do not assume those bugs still exist.
Use them as adversarial attack families.
At minimum ensure the current attack model addresses historically demonstrated escape classes such as:
- non-empty save round-trip;
- save payload identity;
- full-bag conservation;
- paid preview replay;
- missing/stale animation token;
- real manager-update omission;
- duplicate invocation hidden by idempotency;
- skill scaling lost between model and executor;
- conditional drop gate leakage;
- impossible perfect-clear target;
- duplicate companion payout;
- production composition missing dependency;
- orphan Core ownership;
- tested tree != reviewed tree;
- input asserted instead of live owner;
- forged talent offers;
- zero/partial delivery;
- restore replay.
Search for new siblings of the root class, not only the old exact code location.

## 43. PROPERTY / STATE-MACHINE TESTING
Use generated stateful action campaigns for high-risk domains.
Start from production factories/catalogs.
Generate legal and deliberately invalid action sequences.
Candidate domains include:
- inventory/rewards;
- save/restore;
- progression;
- hidden lineage;
- Technique;
- nodes;
- realm breakthrough;
- companion gifts;
- formation;
- combat settlement.
After every generated action assert global invariants.
At intermediate points:
save
→ reconstruct fresh owner
→ continue sequence.
Use independent expected models where possible.
Do not compute expected output using the same production helper under test.
Retain seeds/traces for failures.
Shrink counterexamples when practical.

## 44. TARGETED FUZZING
Fuzz supported boundaries of:
- save payloads;
- registry IDs;
- numeric fields;
- enums;
- event payloads;
- presentation tokens;
- transaction metadata.
Separate:
- schema-invalid input;
- schema-valid but semantically impossible input.
The second class is especially important.
Fail closed without corrupting live state.

## 45. MUTATION TESTING
Target mutations around historically dangerous invariants.
Examples:
- remove realm gate;
- bypass Way check;
- accept missing token;
- duplicate settlement call;
- remove save-field validation;
- invert own-property membership;
- skip exact debit;
- remove Skill/Core linkage;
- remove hidden lineage prefix;
- broaden conditional drop;
- bypass talent-offer membership.
The claimed regression oracle must kill the semantic mutant.
A surviving meaningful mutant is a coverage finding.

## 46. DETERMINISTIC VERIFICATION
Run final commands from `game/` on the exact frozen candidate as required by the canonical QA manifest.
At minimum evaluate the repository's current gates, including as applicable:
- `npm run type-check`
- `npm run build`
- `npm run verify`
- `npm run test:e2e`
- `npm run lint`
- balance tests
- bundle split check
- asset checks
- designated simulation/property/fuzz campaigns.
Do not assume `npm run verify` includes every release-relevant suite.
Current package scripts separate:
- normal Vitest;
- balance;
- lab;
- E2E.
`npm run lab` is an experiment harness.
Use it heavily for deterministic exploration, but do not automatically count scratch lab experiments as release gates.
Promote stable critical assertions into proper gating coverage where justified.

## 47. ENVIRONMENT FAILURES
A missing browser, ImageMagick binary, package/tool, runtime profile, or other mandatory QA capability is:
missing evidence.
It is NOT a green test.
Classify causality:
- product defect;
- test defect;
- environment failure;
- baseline failure;
- coverage gap.
Preserve the first real failure.
A rerun that happens to pass does not erase a flake.
Investigate and classify it.

## 48. PERFORMANCE / SOAK
Perform repeated/runtime stress checks appropriate to Beta.
Examples:
- many battles;
- long auto-farm;
- repeated route changes;
- repeated save/reload;
- rapid panel open/close;
- scene restart loops;
- audio enable/disable loops;
- large but legal bag/state;
- prolonged idle simulation.
Watch for:
- growing event listener count;
- accumulating timers;
- stale callbacks;
- progressive FPS degradation;
- reactive render loops;
- duplicated actors;
- storage churn;
- unbounded arrays;
- retained battle/presentation state.
One successful battle is not lifecycle proof.

## 49. BALANCE SANITY VS BALANCE TUNING
Do not attempt final numerical game balance unless requested.
But identify structural balance failures such as:
- impossible mandatory fight;
- impossible progression threshold;
- infinite resource loop;
- zero-cost repeatable gain;
- permanent invulnerability through an unintended interaction;
- a Way receiving a multiplier twice;
- required resource orders of magnitude unreachable because of a bug.
Separate:
Correctness defect
from:
Balance/tuning observation
Do not block fixed-point for subjective tuning preferences unless the canonical protocol classifies them as actionable release defects.

## 50. PLAYER-REALISTIC EXPLORATORY PASSES
After structured systems testing, behave like actual players.
Perform exploratory journeys such as:
- first-time player clicking things in unexpected order;
- player never opening a tutorial panel;
- player immediately reopening every modal;
- player repeatedly clicking a transaction;
- player closing/opening command wheel rapidly;
- player leaving/reloading during progression;
- player accumulating resources before discovering their system;
- player ignoring optional progression;
- player over-preparing before breakthrough;
- player advancing at minimum legal threshold;
- player chasing the hidden route;
- player alternating manual and auto play.
Look for "technically valid state, practically broken game".

## 51. FULL PLAYTHROUGH MATRIX
Do not rely on a single full journey.
At minimum cover representative complete journeys for all six Ways:
- sword_pathway
- hidden_sword_pathway
- spell_pathway
- hidden_spell_pathway
- body_pathway
- hidden_body_pathway
For each, inspect milestone state at:
- creation;
- Mortal pre-breakthrough;
- Qi entry;
- mid-Qi;
- normal/hidden threshold;
- Foundation entry;
- Foundation Beta endpoint.
At each milestone record relevant:
- realm;
- level;
- path/way;
- stats;
- skills/cores;
- node levels;
- Technique;
- BodyProgression;
- hidden lineage;
- currencies;
- inventory;
- companion/formation state;
- UI unlocks;
- save acceptance.
Use automation/lab acceleration where necessary, but ensure production-seam/runtime evidence exists for the critical transitions.

## 52. CROSS-SYSTEM ATTACKS
After each system passes independently, deliberately combine systems.
Examples:
Hidden progress
- reload
- Technique frozen cycle
- realm breakthrough.
Full inventory
- battle reward
- talent entitlement
- save.
Scene switch
- pending cast impact
- battle end
- audio cue.
Companion formation
- duplicate assignment
- victory reward.
Technique rank gate
- node respec
- restore.
Offline settlement
- quest completion
- inventory overflow.
These cross-system combinations are high priority because isolated unit suites are least likely to cover them.

## 53. FINDING STANDARD
Use the canonical protocol severity/classification.
For every actionable finding record at least:
ID
Severity
- Critical
- High
- Medium
- Low
- Nit where appropriate
Classification
- REAL_DEFECT
- SPEC_DEFECT
- TEST_DEFECT
- COVERAGE_GAP
- DOCUMENTATION_DEFECT
- FALSE_POSITIVE
- NON_ACTIONABLE
Evidence kind
Examples:
- EXECUTED_RUNTIME
- EXECUTED_INTEGRATION
- EXECUTED_PROPERTY
- EXECUTED_MUTATION
- EXECUTED_UNIT_STRUCTURAL
- SOURCE_PROOF
- HISTORICAL
- INFERRED
- SPEC_DRIFT
Reachability
- production-reachable;
- supported-boundary;
- fixture-injected;
- hypothetical;
- unknown.
Then:
- violated invariant;
- exact state/location;
- minimal counterexample;
- expected;
- actual;
- root cause;
- root defect class;
- blast radius;
- semantic sibling search;
- repair seam;
- regression proof.
Do not inflate severity.
Do not downgrade a proven Low merely to make the release green.
Under the canonical protocol, actionable Low correctness findings still prevent an unqualified fixed point.

## 54. CLEAN A / NOVEL ATTACK / CLEAN B
Do not replace the repository convergence mechanism with "run another review".
Follow the canonical sequence.
After the aggregate state appears clean:
Clean A
Use fresh independent reviewer contexts.
They must derive their own invariants and attacks without being shown previous conclusions where independence requires blindness.
Novel Attack Synthesis
Challenge previously untested:
- assumptions;
- orderings;
- partitions;
- owner/consumer edges;
- failure points;
- event schedules;
- oracle weaknesses.
A new random seed alone is not novel.
Clean B
Run fresh uncontaminated reviewers against the frozen resulting candidate.
Clean B is not the same reviewer saying "still looks fine".
If any repair, contract change, test-oracle change or material attack-model expansion occurs:
invalidate/restart the required clean sequence.

## 55. FINAL MUTATION / COVERAGE AUDIT
Before terminal decision:
- inspect required/N/A coverage cells;
- challenge any N/A classification;
- run targeted high-risk mutations;
- verify learned-defect/golden-bug obligations;
- verify no meaningful mutant survives;
- verify no required surface was skipped due to convenience;
- verify test assertions observe real owners.
Then execute FINAL_FULL_VERIFY on the exact same candidate.
No code/spec/test mutation is allowed between final verification and terminal state identity without invalidation.

## 56. STOP CONDITION
Do not stop because:
- the test suite is green;
- E2E is green;
- no Critical finding remains;
- you have already performed many rounds;
- quota/time is expensive;
- reviewers are tired;
- a previous audit said PASS.
Stop only when the canonical protocol terminal predicate is satisfied.
This includes, among other requirements:
- exact candidate identity remains frozen;
- attack-model coverage is complete;
- no actionable defect or required coverage gap remains;
- deterministic/runtime gates are green;
- sequential reviews are complete;
- Clean A is complete;
- novel attacks have been synthesized/executed;
- Clean B is complete with independent uncontaminated contexts;
- mutation/golden-bug obligations are satisfied;
- evidence integrity is verified;
- an independent terminal verifier confirms the predicate.
If required evidence is unavailable, return:
`QA_UNVERIFIED`
Do not manufacture confidence.

## 57. FINAL REPORT
Generate the canonical QA report from the unified ledger.
The human-readable report must clearly state:
Candidate
- Git branch
- Git SHA
- productStateId
- contractId
- attackModelId
- environmentId
- dirty/untracked status
Beta scope actually exercised
Describe real journeys and which of the six Ways were covered.
Systems covered
State actual executed/source-reviewed coverage.
Do not claim "all" unless the coverage matrix supports it.
Verification
For each relevant gate:
- exact command;
- candidate identity;
- result;
- pass/fail count;
- skip count;
- environment limitation;
- retained evidence.
Findings
Open and closed findings by severity/classification.
Root-class sibling hunts
Summarize meaningful repository-wide searches.
Persistence evidence
State save version and important round-trip/malformed/rejection attacks.
Runtime evidence
Summarize actual browser/Phaser/Electron-capable evidence.
Clean rounds
Document:
- Clean A reviewer independence;
- novel attack synthesis;
- Clean B reviewer independence;
- contamination/access limitations.
Mutation / historical defect coverage
State which high-risk mutations and learned-defect families were challenged.
Remaining boundaries
Explicitly list anything not testable.
Never hide environmental limitations.
Official outcome
Emit exactly one canonical protocol outcome.
If fixed point is reached, use the canonical form:
`QA_FIXED_POINT_REACHED for <productStateId>, <contractId>, <attackModelId>, <environmentId>: no actionable defect remained detectable under the complete declared attack model after the recorded independent falsification attempts.`
Do NOT call the game "bug-free".

## 58. PRIMARY OPERATING PRINCIPLE
At every layer ask:
What state or behavior is this system promising to own?
Then ask:
How can I violate that promise through another legitimate path?
For:
`A permits B`
attempt:
`B without A`.
For:
`A owns B`
attempt:
- B mutated elsewhere;
- A reset while B remains;
- B restored without A;
- A restored without B.
For:
`operation rejects`
compare all affected owner state before and after rejection.
For:
`operation is exactly once`
measure invocation/event/reward cardinality, not merely the final idempotent value.
For:
`state persists`
destroy runtime ownership and reconstruct from the saved representation.
For:
`UI says available`
execute the actual domain operation.
For:
`visual event controls timing`
remove/repeat/stale the visual signal and ensure domain correctness survives.
For:
`test protects invariant`
mutate the invariant and ensure the test fails for the intended semantic reason.

## 59. MISSION END STATE
The purpose of this mission is not to produce a long QA document.
The purpose is to obtain the strongest defensible answer to:
Can a real player take the current aggregate master build from first launch through every supported Beta route to Foundation, repeatedly save/reload it, exercise its combat/progression/economy/UI systems, and remain inside one coherent canonical state without an unresolved actionable defect?
Keep falsifying that proposition until the repository's own fixed-point protocol says the search has converged.
Anything less is intermediate evidence, not Beta release approval.
