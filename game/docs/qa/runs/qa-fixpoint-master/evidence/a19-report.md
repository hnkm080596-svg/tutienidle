# a19 — Scope AUTHORITY seam review (persisted-state + authority writers)

Reviewer: a19 (blind). Commit: `ab0b135e021dbc915821c0855de3d395ce82a5ce`.
Repro suite: `game/tests/architecture/a19ElementRootWitness.qa.test.ts`
(`npx vitest run tests/architecture/a19ElementRootWitness.qa.test.ts` → 2 failing repros, 1 control pass).

## Verdict: PASS WITH GAPS

The save boundary is heavily hardened — writer-envelope replay across
timedEffects, skills[], technique holder, talents, stage claims, body and
hidden progression, plus a shared `assertSaveAcceptable` predicate at both
boot restore and the remote newest-wins gate. Persisted modifiers are
rebuilt, never trusted. Every authority write seam I probed
(grant/learn/invest/respec/settle/unlock/commit) is gated by a scope
verdict. Two coherence holes remain on the ONE surface that combines
element-axis state with node ownership: the element root ⇔ committed
element witness is replayed only in the element→basic direction
(NOVA-5), never in the root→element direction.

## Findings

### A19-1 (Medium) — forged element-root claim bricks the initiation forever

`PHAP_TU_ELEMENT_ROOT_IDS` nodes are written by exactly one writer:
`commitFiveElementInitiation`, atomically with the element, the realm
advance and the kit basic. The `nodeLevels` prereq replay
(`saveShapeValidation.ts` ~line 1680) replays authored prereqs only;
a root's prereqs are just `excludesNode` on the other four roots, and
nothing restricts a mortal save's `nodeLevels` to `core_*` grants. A
crafted **mortal** save claiming `hoa_linh_ngo` (element=null) passes
`validateGameSaveShape` and `assertSaveAcceptable`. At ritual entry every
element's `canPurchaseNode` probe then fails — the claimed element's
root fails the owned check, the other four fail `excludesNode` —
so `element_root_blocked` is returned for all five elements, forever.
An accepted save loads a permanently bricked progression state no
writer can produce.

Repro: first test in the suite — `shape.ok === true`, all 5 probes
blocked. Confidence: Confirmed (failing test on the pinned commit; brick
verified through the same `canPurchaseNodeSystem` call the ritual uses).

### A19-2 (Low) — committed `spell_pathway` save with `element=null` admitted

`commitFiveElementInitiation` is the only element commit AND the only way
onto `spell_pathway`, so every writer-produced committed save carries
`element != null`. The boundary accepts `{element: null}` on a committed
save anyway (ownership gate fires only on non-null values; the NOVA-5
coherence check only runs when an element resolves). The restored player
mints spell-way authority (MP pool modifiers, `five_elements_art`
holder) with dead element machinery — `selectSpellPathElement` refuses
`realmId !== 'mortal'`, so the element can never be gained. Unproducible
state, weaker symptom than A19-1.

Repro: second test in the suite — accepted at both seams.

### Control (sealed, no defect)

A committed save claiming a second root for a *different* element is
already rejected by `excludesNode` replay — third test passes.

## Cleared surfaces (attacked, no defect)

- Persisted `player.modifiers`/`externalModifiers`: rebuild-don't-trust
  (`resolvePlayerStatAssembly`); externals scrubbed at restore.
- Forged dormant-way saves: `way_out_of_scope` → dormant machinery
  (`isBetaWay` in CombatBuild, capabilities, stat facets) — intended carry.
- Forged dormant `nodeLevels`: inert via `admittedNodeModifiers`;
  respec/devReset/preview refuse while dormant-tree nodes held.
- Forged companions/formationLoadout/artifact: `isScopeHidden` +
  `isBetaFeature` gates (CombatBuild, pullCompanion domain-unlock,
  `commitFormationLoadout`); dormant pull pool empty.
- Forged quest claims: `resolveClaimable` fails closed on
  `!isBetaQuestEnabled`; reconcile deactivates stale claims.
- Forged phaGiap carry stacks: talent witness + maxStacks clamp.
- Forged dormant-family alchemy jobs: parked at settle
  (`scopeHiddenPillFamilyOfId`), excluded from live slot budget.
- Forged decompose slice: `equipmentOreDecompose` flag at the ops layer.
- Authority seams: `learnSkill`, `purchaseNode` (element-root public
  refusal + one-shot-grant provenance), `setKiemPhoPreset`,
  `selectSkillSpecialization`, `commitFiveElementInitiation` (atomic
  rollback), `trainTechnique` (`betaTechniqueAdmitted`), body invest,
  `startJob` (`betaRecipeFamilyOfId`), daily-quest settle — all gated.

Same-value forged counters within authored bounds (timestamps, progress,
insight-level claims a writer could produce) excluded per assignment.
