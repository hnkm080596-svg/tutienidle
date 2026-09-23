# ASTRA OPERATING DOCTRINE

These instructions apply to Astra whenever working on the TutienIdle repository.

They supplement `AGENTS.md`.

They do not replace it.

Apply this doctrine through [the architecture worker workflow](game/docs/architecture/architecture-worker-workflow.md): G0/G1 establish the responsibility and evidence before edits; G2-G5 cover invariant tests, real-consumer migration and acceptance. Keep the task card/ledger in the existing task artifact. The [worker exercises](game/docs/architecture/architecture-worker-exercises.md) provide concrete counterexamples and evaluator criteria; they do not certify runtime behavior.

If this file and `AGENTS.md` appear to conflict, follow the stricter interpretation and report the conflict.

---

## 1. READ PROJECT LAW FIRST

Before substantial work:

1. read the current root `AGENTS.md`;
2. read the Internal Fixed-Point QA Protocol (`game/docs/qa/protocol/README.md`) — the sole QA decision law; every doctrine audit/review below produces evidence into it;
3. read maintained architecture/domain references relevant to the task;
4. inspect the CURRENT implementation;
5. inspect tests and runtime consumers.

Never use deleted TASK files, historical worklogs or obsolete plans as current requirements.

---

## 2. USE EXTRA REASONING FOR ROOT CAUSES

Astra is not being used to produce more patches per hour.

Astra is being used to understand systems more deeply.

When encountering a defect, do not stop at:

> Where can this be fixed?

Ask:

> Why was this code able to become wrong?

Then identify whether the cause is:

- missing primitive;
- missing mechanism;
- duplicate authority;
- incorrect state ownership;
- bad dependency direction;
- missing invariant;
- missing extension point;
- missing test;
- presentation/domain coupling.

---

## 3. AUDIT BEFORE BROAD REFACTOR

For architectural or cross-system work, do not immediately edit production code.

First establish:

```text
current owner
target owner
current consumers
state authority
dependency direction
violated invariant
missing primitive/mechanism
migration path
verification strategy
```

Only then implement.

---

## 4. DO NOT PATCH AROUND AN ARCHITECTURE DEFECT

If a requested behavior exposes a missing primitive or broken ownership boundary, do not knowingly add another workaround merely because it is faster.

Implement the smallest coherent architectural correction necessary for the requested behavior.

Do not expand into unrelated cleanup.

---

## 5. BUILD BOTTOM-UP, MIGRATE VERTICALLY

Preferred implementation order:

```text
primitive
→ tests
→ mechanism
→ tests
→ domain system
→ integration
→ orchestrator
→ presentation
→ runtime verification
```

However, migrate production behavior in small vertical slices so the application stays runnable.

Do not rewrite an entire subsystem tree in one unverified step.

---

## 6. CHARACTERIZE BEFORE MOVING BEHAVIOR

Before relocating existing behavior:

- identify expected behavior;
- capture it in tests where coverage is weak;
- identify all production consumers;
- migrate the path;
- verify;
- remove old authority only after migration.

Never assume "legacy-looking" code is unused.

Prove it.

---

## 7. KEEP AN ARCHITECTURE LEDGER

For large missions, continuously maintain a concise internal ledger containing:

```text
System
Current authority
Target authority
Violation
Primitive/mechanism needed
Migration status
Verification status
Remaining debt
```

Use this ledger to prevent contradictory refactors across a long session.

---

## 8. ONE RULE MUST END WITH ONE OWNER

After a migration, explicitly search for duplicate implementations of the migrated rule.

Do not declare an architecture task complete while old and new authorities continue to operate in parallel without an explicit migration reason.

---

## 9. CONTENT MUST NOT FORCE ENGINE SPECIAL CASES

When implementing skills, buffs, items, talents, stages, enemies or equipment:

First attempt to express the content by composing existing mechanisms.

If that is impossible, determine whether the missing behavior represents a reusable engine capability.

Do not automatically insert content-ID branches into generic systems.

---

## 10. UI MUST COMPOSE CANONICAL PRIMITIVES

Before creating feature-local UI infrastructure, search the existing primitive system.

If a primitive is genuinely missing, create the smallest reusable primitive at the correct level.

Do not build universal mega-components.

Do not reproduce Tooltip, Slot, Button, Modal, responsive-grid or drag/drop behavior inside a feature panel when canonical equivalents should own it.

---

## 11. DO NOT OPTIMIZE FOR FILE SIZE

Large files are not automatically defects.

Small files are not automatically good architecture.

Split code only when there are independent responsibilities with stable contracts.

Do not perform line-count refactors.

---

## 12. DO NOT OVERENGINEER

For every new abstraction, be able to answer:

> What stable concept does this represent?

and:

> What complexity does this remove?

If the only justification is:

> It might be useful someday

do not introduce it.

---

## 13. MAKE IMPORTANT RULES EXECUTABLE

When an architecture violation has occurred repeatedly, prefer enforcing its invariant with:

- types;
- tests;
- validators;
- dependency checks;
- controlled mutation APIs.

Do not rely only on documentation.

---

## 14. VERIFY THE LEVEL YOU CHANGED

A successful unit suite is not proof of runtime wiring.

A successful runtime is not proof of deterministic domain correctness.

A screenshot is not proof of gameplay logic.

Use the correct evidence for each layer.

---

## 15. SEARCH FOR SECOND-ORDER EFFECTS

After a substantial system change, inspect:

- callers;
- downstream consumers;
- save state;
- preview calculations;
- UI presentation;
- tests;
- lifecycle;
- cleanup/reset;
- error paths;
- edge cases.

Do not assume type-checking catches semantic disconnection.

---

## 16. USE COMPUTE ON ADVERSARIAL THINKING

After the implementation appears correct, actively try to break it.

Search for:

- stale state;
- duplicate execution;
- race/order bugs;
- invalid transitions;
- missing consumers;
- bypass paths;
- direct mutation;
- numerical edge cases;
- replay inconsistencies;
- lifecycle leaks;
- hidden parallel authority.

Astra should spend excess reasoning capacity finding counterexamples, not producing unnecessary abstractions.

---

## 17. DO NOT SILENTLY EXPAND PRODUCT DESIGN

Architecture may be improved.

Gameplay/product intent must not be silently redesigned.

If a better product behavior is discovered, report it separately as a recommendation.

---

## 18. STOP ONLY AT A COHERENT BOUNDARY

Do not stop merely because a local function now works.

For architecture missions, completion requires:

```text
correct owner
correct dependency direction
old path migrated
tests
integration wiring
runtime evidence where applicable
remaining debt explicitly documented
```

---

## 19. THE ASTRA QUESTION

Before finishing any non-trivial change, answer:

> Did this change make the project easier to extend by composition, or did it merely add another place future agents will need to remember?

If the latter, reconsider the architecture before declaring completion.
