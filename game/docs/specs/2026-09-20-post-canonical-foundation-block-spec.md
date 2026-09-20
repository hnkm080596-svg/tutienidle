# PENDING — Post Canonical Seal / Ngộ Đạo / Reaction V2

Status: `PENDING`
Start condition: Canonical Seal / Ngộ Đạo / Reaction V2 implementation is merged, validated, and has no unresolved Medium+ findings.
Intent: Stabilize the remaining build/combat architecture before expanding content.

## P1 — Canonical Path Authority

Formalize Kiếm Tu / Thể Tu / Pháp Tu as first-class domain authorities.
The runtime must no longer infer a cultivation path from owned skills, seals, Ngộ Đạo nodes, UI state, or other indirect signals.

Target direction:

```
CultivationPath
    ↓
PathDefinition
    ↓
PlayerPathState
    ↓
Build / Unlock State
    ↓
Capabilities
    ↓
Combat Runtime
```

Primary goals:
- establish one canonical authority for active path and path progression;
- define common contracts shared by Kiếm Tu, Thể Tu, and Pháp Tu;
- formalize path branches/subpaths;
- formalize ownership of path-specific skills, passives, resources, seals, and Ngộ Đạo;
- expose capability-based queries for downstream systems;
- remove path inference from combat and feature systems;
- define serialization/save migration rules for path state.

Example principle:

```
BAD:
hasSkill("hoa-cau-thuat") → therefore Pháp Tu

GOOD:
path/capability authority → phap_tu.elemental_casting
```

Exit condition:
- downstream systems do not infer cultivation path indirectly;
- all three paths use the same canonical contract;
- path/build state can be serialized and restored;
- combat consumes capabilities rather than reconstructing player identity.

## P2 — Canonical Build Composition

Create one canonical representation of the player's effective combat build.

Target composition:

```
Player Build
├── Path / Branch
├── Base & Allocated Stats
├── Skills
├── Ngộ Đạo
├── Equipment
├── Formation
├── Talisman
└── Companion
```

Introduce an equivalent of: `ResolvedCombatBuild`

The combat runtime should receive a resolved build instead of independently reading and recombining multiple unrelated stores.

Primary goals:
- define ownership and precedence of stat/modifier sources;
- prevent duplicate modifier application;
- formalize conditional capabilities;
- formalize skill-slot and Ngộ Đạo contribution;
- integrate equipment, formation, talisman, and companion contributions;
- preserve source attribution;
- produce deterministic build resolution.

Exit condition:
- a combat build can be resolved without Phaser;
- identical source state produces identical resolved output;
- every effective modifier retains source attribution;
- combat no longer reconstructs build state ad hoc.

## P3 — Production Combat Vertical Slice

Complete one production-grade battle path from start to finish using the canonical systems.

Target flow:

```
Select Build
→ Enter Stage
→ Battle Initialization
→ Spawn
→ Skills / Actions
→ Damage / Vitals
→ Buff / Debuff
→ Seal
→ Reaction
→ Companion
→ Death
→ Victory / Defeat
→ Reward Settlement
→ Replay / Return
```

Scope should remain intentionally narrow: one complete stage is preferable to many incomplete stages.

Primary goals:
- prove scene transition and battle initialization;
- prove actor/wave lifecycle;
- prove canonical skill → effect → damage/status flow;
- exercise Seal / Reaction / Ngộ Đạo in production combat;
- validate death, cleanup, result, reward, replay, and return flows;
- eliminate leaked listeners and retained runtime state between battles.

Exit condition:
- one full battle loop works without manual state patching;
- replay starts from clean battle state;
- victory and defeat both clean up correctly;
- runtime combat rules remain outside Phaser presentation code.

## P4 — Deterministic Combat Simulation & Balance Harness

Separate combat outcome calculation from visual presentation sufficiently to support headless deterministic simulation.

Target direction:

```
Combat Input
    ↓
Deterministic Combat Simulation
    ↓
Canonical Combat Events
    ↓
Presentation / Phaser
```

Desired capability: `runBattle(seed, build, encounter)` without requiring browser rendering.

Collect at minimum:
- total damage and DPS;
- time-to-kill;
- damage by source;
- seal uptime;
- reaction frequency;
- buff/debuff uptime;
- resource generation and spending;
- mitigation;
- healing/overheal;
- cast frequency;
- deaths and battle outcome.

Exit condition:
- same seed + same inputs produce the same result;
- combat outcome is not FPS-dependent;
- Phaser presentation does not determine simulation outcome;
- batch simulation is available for automated balancing and regression checks.

## P5 — Three-Path Balance Baseline

After deterministic simulation exists, establish baseline builds for:
- Kiếm Tu;
- Thể Tu;
- Pháp Tu.

Do not target identical DPS. Instead validate distinct combat identities and scenario strengths:

- Kiếm Tu → precision / burst / execution / kiếm-based mechanics
- Thể Tu → durability / pressure / sustain / close combat
- Pháp Tu → elemental setup / reaction / AoE / control

Validate against common benchmark encounters, including:
- single target;
- multiple enemies;
- durable target;
- burst-pressure encounter;
- longer attrition battle.

Exit condition:
- no path dominates every benchmark category;
- each path has identifiable strengths and weaknesses;
- no core resource economy deadlocks;
- no secondary mechanic unintentionally becomes the universal dominant damage source.

## P6 — Early Progression Loop Closure

Close one complete early-game progression loop:

```
Combat
→ Reward
→ Resources / Progress
→ Character Growth
→ Stronger Build
→ Harder Combat
```

Initial scope should focus on the actual early game rather than implementing all future realms.

Primary targets:
- Phàm Nhân;
- transition into Luyện Khí;
- stat progression;
- skill/path progression;
- Ngộ Đạo unlock/progression where applicable;
- equipment/resource rewards;
- progression gates;
- persistence/save-load.

Exit condition: A fresh player can progress through the intended early-game loop without developer intervention or placeholder progression state.

## Ordering Constraint

Unless a blocking architectural discovery requires otherwise, execute in this order:

```
Canonical Seal / Ngộ Đạo / Reaction V2
                ↓
P1 — Canonical Path Authority
                ↓
P2 — Canonical Build Composition
                ↓
P3 — Production Combat Vertical Slice
                ↓
P4 — Deterministic Combat Simulation
                ↓
P5 — Three-Path Balance Baseline
                ↓
P6 — Early Progression Loop Closure
```

Do not expand large amounts of new combat content during P1–P4. The purpose of this pending block is to finish the authority, composition, runtime, and verification foundations first so later skills, enemies, companions, stages, and progression content can be added without reopening the same architectural problems.
