# MISSION 0 — WHOLE PROJECT ARCHITECTURE AUDIT

Audit the CURRENT TutienIdle repository in full.

This is an **AUDIT-ONLY mission**.

Do NOT begin broad production refactors.

Do NOT implement the architecture you recommend.

Do NOT modify `AGENTS.md` during this mission.

Read and obey the current repository `AGENTS.md` first.

Also obey any Astra-specific operating rules configured outside the repository.

Use the CURRENT codebase, CURRENT tests, CURRENT maintained documentation, and CURRENT runtime consumers as evidence.

Do not resurrect deleted `TASK.md`, stale worklogs, obsolete plans, historical implementation notes, or superseded specifications as current requirements.

---

# PRIMARY OBJECTIVE

Determine whether the entire project is being built as a composition of stable systems and primitives, or whether development has accumulated feature-local patches, duplicate authorities, long-arm systems, and unclear ownership.

The desired architectural direction is:

```text
Foundation Primitive
→ Domain Primitive
→ Reusable Mechanism
→ Domain System
→ Orchestrator
→ Presentation / Application
```

Do not assume that the current file/class/module boundaries correctly represent those layers.

Infer the real architecture from behavior, callers, state ownership, dependencies, and runtime consumers.

---

# CORE QUESTION

For every significant architectural problem, do NOT stop at:

> How should this code be refactored?

Ask:

> Why did this patch need to exist in the first place?

Determine whether the root cause is:

- missing primitive;
- missing reusable mechanism;
- duplicate authority;
- incorrect state ownership;
- wrong dependency direction;
- missing extension point;
- missing invariant;
- missing validation;
- missing test;
- presentation/domain coupling;
- content-specific behavior leaking into generic infrastructure;
- temporary migration code that became permanent;
- duplicated old/new implementations.

The audit should identify the missing building blocks that caused patchwork architecture to appear.

---

# ARCHITECTURAL LAWS TO AUDIT AGAINST

Use the current `AGENTS.md` Architecture Constitution as the governing baseline.

Pay particular attention to these principles:

1. Build from stable composable primitives.

2. One semantic rule has one authoritative owner.

3. One mutable domain state has one authoritative writer.

4. Systems do not reach into another domain's internals.

5. Orchestrators coordinate systems; they do not absorb domain rules.

6. Dependencies should point toward foundations.

7. Presentation must not become gameplay authority.

8. Generic mechanisms should compose content rather than hardcode arbitrary content IDs.

9. Shared semantic formulas must have one implementation authority.

10. UI should be composed from canonical primitives rather than feature-local implementations.

11. Fix root causes rather than symptoms.

12. Do not overengineer or create abstractions without a stable concept.

These laws are audit criteria, not predetermined conclusions.

If repository evidence shows that one of them needs refinement, report that as a proposed `AGENTS.md` amendment.

Do not edit the rule during this mission.

---

# AUDIT THE ENTIRE PROJECT

Do not restrict the investigation to combat.

At minimum inspect the following areas where they exist.

## Application / Runtime

- application bootstrap;
- GameManager;
- runtime update loops;
- clocks/timing;
- Vue lifecycle;
- Pinia;
- Vue ↔ Phaser integration;
- events/commands;
- persistence;
- save/load;
- Electron integration;
- Supabase/cloud-related architecture;
- i18n;
- registries;
- configuration.

## Combat

- TurnBattleSystem;
- action execution;
- damage;
- vitals;
- stats;
- targeting;
- RNG;
- buffs;
- debuffs;
- DoT;
- CC;
- skills;
- skill effects;
- triggers;
- elemental alignment;
- reactions;
- talents;
- formations;
- companions;
- enemies;
- bosses;
- waves;
- battle completion;
- stage rewards;
- auto battle;
- battle events;
- presentation acknowledgements;
- remaining legacy combat infrastructure.

## Character / Progression

- character state;
- realms;
- breakthrough;
- cultivation;
- main stats;
- derived stats;
- professions/paths;
- skill trees;
- skill points;
- talents/passives;
- unlock conditions;
- progression gates.

## Items / Equipment

- item definitions;
- item instances;
- inventory;
- stacks;
- equipment;
- equipment slots;
- affixes;
- sets;
- quality;
- realm requirements;
- enhancement;
- forge;
- refine;
- quality upgrades;
- random generation;
- drops/rewards.

## Production

- alchemy;
- crafting;
- forging;
- talismans;
- formations where production-related;
- gathering;
- exploration;
- resource production;
- recipes;
- costs;
- timers/queues.

## World / Content

- stages;
- zones;
- world map;
- encounters;
- enemies;
- rewards;
- progression gates;
- content registries.

## UI

Do not audit UI merely screen-by-screen.

Determine whether it forms a reusable component hierarchy.

Look for concepts such as:

```text
Design Tokens
→ Layout Primitives
→ Interaction Primitives
→ Game UI Primitives
→ Domain Components
→ Feature Compositions
→ Panels / Screens
```

These names are hypotheses, not mandatory implementation.

Audit for:

- duplicate Slot implementations;
- duplicate Tooltip behavior;
- duplicate Button patterns;
- duplicate Modal behavior;
- duplicate Tabs;
- repeated progress bars;
- duplicated drag/drop;
- repeated stat formatting;
- repeated quality/rarity rendering;
- repeated grid calculations;
- arbitrary screen-specific constants;
- CSS patches compensating for incorrect structure;
- domain/business logic inside Vue components;
- UI previews duplicating authoritative gameplay calculations.

Determine which UI primitives already exist and which are genuinely missing.

Do NOT recommend a UniversalComponent or similar mega abstraction.

## Phaser / Presentation

Audit:

- CombatScene;
- scene lifecycle;
- entity views;
- sprite lifecycle;
- animation playback;
- VFX;
- HUD;
- projectiles;
- death presentation;
- combat playback;
- acknowledgement/gating;
- preload;
- responsive rendering;
- Vue ↔ Phaser boundary.

Determine where authoritative gameplay ends and presentation begins.

Look especially for cases where visual state can influence gameplay state.

## Assets

Audit:

```text
source asset
→ metadata
→ validation
→ registry / manifest
→ preload
→ animation definition
→ presentation
```

Inspect:

- asset paths;
- asset registries;
- sprite sheets;
- animation metadata;
- anchors;
- frame dimensions;
- FPS;
- loop/one-shot rules;
- fallback assets;
- PixelLab workflow;
- TexturePacker/ImageMagick or related tooling;
- runtime asset loading.

Determine which stable asset primitives/contracts are missing.

## Tests / Tooling

Audit:

- Vitest unit tests;
- integration tests;
- architecture tests;
- regression tests;
- Playwright;
- runtime wiring guards;
- visual tests;
- fixtures;
- helpers;
- validators;
- type-check;
- lint/build tooling.

Determine which architectural invariants currently rely only on human discipline and should eventually become machine-enforceable.

---

# PRIMITIVE AUDIT

For every major domain answer:

```text
What are the fundamental concepts?

Which are already represented by good primitives?

Which are only partially represented?

Which are duplicated?

Which are too generic?

Which are overly feature-specific?

Which stable primitives are missing?

Which current patches/systems appear to exist because those primitives are missing?
```

Do not add a primitive merely because multiple functions look similar.

A proposed primitive must represent a stable concept.

---

# STATE OWNERSHIP AUDIT

For every important mutable state identify:

```text
State
Creator
Current owner(s)
Current writers
Readers
Reset path
Persistence path
Correct authoritative owner
Violations
```

Pay particular attention to authority conflicts between:

- GameManager;
- Pinia;
- domain systems;
- Vue components;
- Phaser scenes;
- local component state;
- save state.

Find state that has multiple apparent authorities.

---

# ONE RULE — ONE OWNER AUDIT

Identify important rules that are implemented in more than one location.

Examples may include:

- damage;
- armor/resistance;
- DoT;
- stats;
- item/equipment preview versus runtime;
- crafting cost/preview versus execution;
- progression requirements;
- grid/layout calculations;
- asset lookup;
- buff rules.

Do not assume duplication is wrong until semantic equivalence has been proven.

Where duplication is genuine, identify the correct authority.

---

# LONG-ARM AUDIT

Search for systems performing responsibilities outside their domain.

Examples of suspicious patterns:

```text
generic combat system knows specific buff IDs
skill directly edits HP
buff engine reimplements damage mitigation
CombatScene mutates authoritative battle state
equipment UI calculates equipment formulas
crafting directly edits inventory arrays
save layer decides progression
GameManager performs detailed domain calculations
```

For every finding state:

- what the system is doing;
- what it should be doing;
- correct target owner;
- why the violation appeared.

---

# CONTENT LEAKAGE AUDIT

Search generic engine code for feature/content identity logic such as:

```text
skillId
buffId
itemId
talentId
enemyId
formationId
```

Do not automatically label every ID check a defect.

Determine whether knowledge of that identity genuinely belongs to that system.

Where it does not, determine whether the project lacks a stable:

- Effect;
- Trigger;
- Policy;
- Condition;
- Requirement;
- Resolver;
- Modifier;
- Capability;
- registry handler;

or another better mechanism.

---

# PATCHWORK / SHOTGUN-SURGERY AUDIT

Search for signs that development has been fixing symptoms rather than foundations:

- repeated special-case booleans;
- repeated exceptions around the same invariant;
- duplicate formulas;
- large unrelated argument lists;
- functions with several independent responsibilities;
- compatibility adapters with no removal path;
- comments explaining bypasses;
- old and new systems running in parallel;
- magic constants duplicated across modules;
- one content addition requiring edits to many generic systems;
- one UI feature requiring several unrelated component edits;
- direct object/array mutations bypassing an owning domain.

Do not merely call these code smells.

Determine the architectural cause.

---

# GOD OBJECT AUDIT

Large files are NOT automatically architecture problems.

Do not recommend decomposition based on line count.

For each candidate, list its actual independent reasons to change.

A large orchestrator may be valid.

A smaller file may still violate ownership badly.

---

# DEPENDENCY AUDIT

Produce the real current dependency direction.

Look for:

- upward imports;
- cycles;
- runtime coupling hidden behind callbacks;
- domain → presentation dependencies;
- generic foundation → feature dependencies;
- cross-domain access through GameManager or stores;
- event-bus coupling that hides ownership.

Distinguish:

```text
compile-time dependency
runtime dependency
state dependency
event dependency
```

where useful.

---

# ORCHESTRATOR AUDIT

Inspect managers/coordinators such as GameManager and TurnBattleSystem.

Determine whether each operation is:

```text
coordination
```

or:

```text
domain rule
```

Recommend extraction only when there is a stable target owner.

Do not break orchestrators into small files merely to reduce size.

---

# UI PRIMITIVE AUDIT

Determine which UI concepts deserve canonical ownership.

Possible examples include:

```text
Surface
Stack
Grid
ScrollArea
Button
Tooltip
Popover
Modal
Tabs
ProgressBar
Slot
ItemIcon
QualityFrame
StatRow
CostDisplay
RequirementDisplay
SkillNode
EquipmentSlot
```

These are examples only.

For each proposed primitive classify:

```text
EXISTS
PARTIAL
DUPLICATED
MISSING
QUESTIONABLE
```

Explain why it deserves or does not deserve to become canonical.

---

# GAMEPLAY PRIMITIVE AUDIT

Perform the same analysis for stable gameplay concepts.

Possible hypotheses include:

```text
Modifier
Effect
Condition
Requirement
Cost
DamageRequest
DamageResolution
DamageTag
BuffDefinition
Trigger
TargetRule
SkillDefinition
ItemInstance
Recipe
SeededRng
```

Do not force these concepts onto the current architecture.

Use source evidence.

---

# TEST ARCHITECTURE AUDIT

Classify current tests approximately as:

```text
primitive
domain rule
integration
regression
architecture
runtime wiring
presentation
E2E
```

Identify important rules without appropriate evidence.

Find tests that overfit implementation details and make legitimate structural migration unnecessarily difficult.

Identify architecture laws that should eventually become automated import/invariant checks.

Do not modify tests during this audit except for disposable investigative tooling if absolutely necessary and non-production.

---

# REQUIRED DELIVERABLES

Produce ONE coherent audit report.

## 1. Executive Diagnosis

Summarize the actual architectural health of the project.

Do not optimize for positivity or negativity.

## 2. Complete System Inventory

For every meaningful system provide:

```text
System
Purpose
Current implementation/files
Inputs
Outputs
Mutable state
Dependencies
Consumers
Current primitives
Missing primitives
Boundary violations
Duplicated responsibilities
Target responsibility
Risk
```

## 3. Current Architecture Map

Describe how the major systems actually compose today.

## 4. Current Dependency Map

Show important actual dependency directions and problematic dependencies.

## 5. Target Dependency Map

Show the desired direction based on the audit.

## 6. State Ownership Map

For important mutable state:

```text
State
Current authority
Current writers
Correct authority
Allowed writers
Readers
Persistence
Violation
```

## 7. Architecture Violation Register

Every important finding should have:

```text
ID
Priority: P0 / P1 / P2 / P3
Affected files
Evidence
Observed behavior
Violated architecture law
Root cause
Correct owner
Missing primitive/mechanism if applicable
Migration difficulty
Regression risk
```

Priority meaning:

```text
P0 — correctness / foundation risk
P1 — major ownership / boundary problem
P2 — missing reusable primitive / architectural friction
P3 — cleanup / lower-priority debt
```

## 8. Long-Arm Report

List concrete systems that currently perform another system's responsibility.

## 9. Duplicate Authority Report

List semantic rules with multiple competing implementations.

## 10. Primitive Map

Organize by domain and mark:

```text
EXISTS
PARTIAL
DUPLICATED
MISSING
QUESTIONABLE
```

## 11. UI Foundation Audit

Describe current UI composition and recommended primitive hierarchy.

## 12. Gameplay Foundation Audit

Cover combat, stats, buff, skills, items, equipment, progression, production, and world systems.

## 13. Phaser / Presentation Audit

Define the actual and desired boundary between gameplay and presentation.

## 14. Asset Pipeline Audit

Include PixelLab and current combat-character animation workflow.

## 15. Test Architecture Audit

Identify coverage strengths, gaps, and architecture protections worth automating.

## 16. Target Architecture

Show how major systems should ultimately compose:

```text
primitive
→ mechanism
→ system
→ orchestrator
→ presentation
```

Do not produce a hypothetical enterprise framework.

Keep the design appropriate for this game.

## 17. Proposed AGENTS.md Amendments

Compare findings against current `AGENTS.md`.

Propose ONLY evidence-backed additions/changes.

Do NOT edit `AGENTS.md`.

Do NOT rewrite the whole file.

## 18. Migration Waves

Do NOT recommend a giant rewrite.

Create dependency-ordered migration waves.

For each wave specify:

```text
Goal
Why it comes now
Prerequisites
Systems affected
Primitives/mechanisms introduced or repaired
Old paths migrated
Required tests/evidence
Completion criteria
Explicitly out of scope
```

## 19. Systems That Should NOT Be Refactored

Explicitly identify areas that already have sound responsibility boundaries.

Do not generate work for the sake of work.

## 20. Recommended First Implementation Mission

After completing the audit, recommend EXACTLY ONE first implementation mission.

Do NOT execute it.

Explain:

- why it has the highest leverage;
- which later migrations depend on it;
- what architectural responsibility it repairs;
- its expected scope;
- what must remain out of scope.

---

# IMPORTANT EXECUTION RULES

This mission is AUDIT FIRST.

Do not make broad production changes.

Do not redesign gameplay content.

Do not add features.

Do not optimize balance.

Do not delete apparently legacy systems until their production consumers have been proven.

Do not judge architecture by file size alone.

Do not generate abstractions merely because they sound architecturally clean.

Do not turn the project into a generic framework.

Use repository evidence.

Inspect callers.

Inspect runtime consumers.

Inspect tests.

Trace actual state mutations.

Trace actual dependencies.

When uncertain, investigate rather than guess.

The audit is successful when another strong coding agent can use the resulting report to implement future systems consistently without returning to feature-local patchwork.