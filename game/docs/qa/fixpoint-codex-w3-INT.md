# Fixpoint wave-3 INTEGRATION audit — codex aggregate

Branch `codex/hoa-cau-fireball-vfx` @ 9827f9f8 (worktree
`.agent-worktrees/qa-w3-int`, detached at tip). Auditor role:
INTEGRATION — adversarially verify the wave-2 element-boundary fix
(`validateSpellPathPersistedState` F-SCOPE-1 shape emit +
`assertSaveAcceptable` F-SCOPE-1 boundary throw) composes at every
seam it touches, plus new cross-system defect hunt.

Method: code trace of all five save/load seams, a 15-case repro
harness (`src/services/save/w3int.repro.test.ts`, all green —
kept in-worktree as re-runnable pin evidence), `npm run type-check`
clean at HEAD, targeted vitest on the carried-save / rewards /
correctness-audit suites.

## Verdict

**The wave-2 boundary fix composes correctly: 0 Critical / 0 High /
0 Medium. 1 Low, 3 Nit.** Every dispatched surface verified; the
rejection path is the intended hard stop with no half-state, and
local-vs-wire verdict parity holds.

## Surface verdicts (dispatched)

### 1. Boot path ordering end-to-end — VERIFIED

Real seam order confirmed by trace + repro:

```
inspectLocalSave: raw -> parse -> version -> validateGameSaveShape
  -> {status:'corrupted'}                  (shape-level deaths)
  -> {status:'ok', save: normalizedSave}
useAppLifecycle -> restoreGameSession:
  -> preflightSaveRegistryReferences / assertSaveAcceptable  (THROWS)
  -> {status:'rejected', message}          (acceptance-level deaths)
  -> player.restoreFromSave ...            (unreachable on reject)
```

- `element:null` committed save dies at **shape** as `'corrupted'`
  with two issues:
  `player.nodeLevels.hoa_linh_ngo: element root 'hoa_linh_ngo' chỉ sản
  sinh được khi spellPath.element = 'fire'` and
  `player.spellPath.element: commit 'null' ngoài beta scope - save
  không còn seam commit nào`. It never reaches acceptance.
  `useAppLifecycle` routes `'corrupted'`/`'rejected'` to
  `saveIssue.report('corrupted', loaded.raw)` + `boot.fail()` →
  SaveIncompatibleScreen (export/delete recovery). Clean hard stop —
  intended, not a crash, not a wedge.
- A **shape-clean but acceptance-rejecting** save (`wrong-technique`,
  `no-basic-no-core` probes) returns `{status:'rejected', message}`
  from `restoreGameSession` with `player.$state` byte-identical
  afterward — the preflight is pure and runs before
  `player.restoreFromSave`. **No half-state.**
- Reachability of the acceptance layer in production: proven —
  `no-basic-no-core` (fire element + root + core stripped, basic
  unlearned) passes shape (`issues=null`) then dies at kit coherence:
  `"element 'fire' requires learned basic 'hoa_cau_thuat'"`. The new
  boundary check is a live gate, not a dead mirror.

### 2. Remote newest-wins gate — VERIFIED (no divergence)

`SupabaseCloudSaveService` remote load (716-759) and
`adoptCommittedPending` (421-465) both run
`validateGameSaveShape` → `isSaveAcceptable(normalized,
staticSaveAcceptanceCatalogs())` → `'corrupted'` on failure —
identical sequence, identical verdict class to local boot.
`staticSaveAcceptanceCatalogs` is built from the same data arrays the
boot registries consume (`saveAcceptance.ts:345-367`). File import
(`importSaveRaw`, SaveSystem.ts:749-766) and recovery validation
(`recoveryApi.ts:58-68`) run the same pair. No client-vs-wire
divergence surface exists.

### 3. `getActiveElement` / F-SCOPE-1 misfire surface — VERIFIED

- F-SCOPE-1's outer condition (`path==='spell' &&
  way==='spell_pathway' && realm!=='mortal'`) cannot misfire:
  `hidden_spell_pathway` or `sword_pathway` carrying a stale
  `spellPath.element` is killed earlier by shape's pair-ownership emit
  (`player.spellPath: element chỉ thuộc way 'spell_pathway'`), and
  `getActiveElement` fail-closes to `undefined` on both (the element
  axis only exists on the spell_pathway way def, gated behind
  `spell.elemental_casting` capability → `isBetaWay`).
- Mortal + spell pair dies at shape (`không thể set khi realmId là
  mortal`, realm-skill membership, passive-marker emits) — and inside
  acceptance `mortalBoundaryContractViolation` precedes F-SCOPE-1.

### 4. Ordering interplay — VERIFIED as designed

Acceptance order: element-root claim (249-260) → spell kit coherence
(270-286) → hidden-kit coherence (292-301) → F-SCOPE-1 (309-320).

- `element:'water'` + `hoa_linh_ngo` claim → root-claim first:
  `"element root claim 'hoa_linh_ngo' requires committed element
  'fire'"`. Root stripped → F-SCOPE-1:
  `"spell_pathway save carries uncommittable element 'water' outside
  beta scope"`.
- `element:'shadow'` + root → root-claim first; root stripped →
  `"unknown element 'shadow' carries no kit"` (kit coherence before
  F-SCOPE-1, per the dispatch's expected order).
- Shape layer independently rejects each of these forgeries earlier
  with its own descriptive emits (root ownership, F-SCOPE-1 shape
  emit, element-root exclusion conflicts, learned-skill→core mirror,
  core-grant-source). The two layers are coherent, not contradictory.

### 5. `betaLocalCorrectnessAudit` invariant — VERIFIED coexistence

The seam rejection and the runtime uncommitted-resolution
(COR-1 `betaSkillTreeFor`, `resolveBasic`/`resolveSpecialUltimate`
`isBetaElement` gates in CultivationPathRegistry.ts:331,421) are two
independent layers. The audit suite's `committedContext` bypasses the
seam (live-op fire commit fixture); the carried-'water'
resolves-uncommitted test still green. Both layers exercised.

### 6. mainlineCarriedSaves + cultivationPathRewards — VERIFIED

Both suites drive `saveOps.restoreFromSave` (the real restore,
including the acceptance preflight) with F-SCOPE-1-canonical fixtures
(fire element + `hoa_linh_ngo` + `core_hoa_cau_thuat` + learned
`hoa_cau_thuat`): fold-in eviction pins and the realm-reward
reconcile (`tinh_thong_hoa` max-write on restore) are green —
restore flow unchanged by wave-2.

## Findings

### W3-INT-1 — live-replacement seam discards `restoreGameSession` verdict — **Low**

`src/App.vue:663-666`: `onResume` calls
`restoreGameSession(player, gameManager, save, {kind:'live-replacement'})`
and ignores the return. A `{status:'rejected'}` there is swallowed —
no `saveIssue.report`, no fail surface, simulation resumes regardless.
Boot's identical call routes the verdict to the corrupted-save
surface; this seam does not.

Reachability is near-dead: the payload arrives via
`cloudSaveCoordinator.load()`, which already ran shape+acceptance and
persisted only an accepted save — a rejection implies a drift window
(e.g. catalogs changed mid-session between load and resume). The
contract inconsistency is real even if unreachable today: the seam's
own signature returns the verdict the boot path acts on.

Repro evidence: code trace (no harness — the call site's discarded
value is the defect); reachable only if `restoreGameSession` returns
'rejected', which requires acceptance to fail on a payload that
passed the same check moments earlier.

Root-cause class: seam-contract asymmetry (verdict routed at boot,
dropped at reconnect-replacement).

### W3-INT-2 — rail read-model reports basic 'available' without a learned check — **Nit**

`src/core/betaScopeSkillDomain.ts:160-164`: `betaCombatRolesFor`
reports `{role:'basic', skillId: SPELL_KIT_IDS[element][0],
state:'available'}` for a committed beta element with no
`deps.hasSkill` check, while the special below it (198) reports
'not-learned'. Combat's `resolveAuthoredBasic(strict)` throws for
the same state. Unreachable in production — the save boundary rejects
the state and the commit grants atomically — so this is display-only
divergence inside a state that cannot occur.

Root-cause class: read-model asymmetry (special checked, basic not).

### W3-INT-3 — NodeSystem raw `spellPath.element` reads diverge from COR-1 — **Nit**

`src/core/progression/NodeSystem.ts` `isNodeElementActive` /
`isNodeElementEffective` read `player.spellPath.element` directly.
For an in-memory out-of-beta element (e.g. `'water'`), water-tagged
nodes would aggregate as effective while combat, the tree model and
the rail all resolve the element as uncommitted (COR-1). Unreachable:
every production writer (`commitFiveElementInitiation`,
`selectSpellPathElement`) `isBetaElement`-gates, and the save
boundary rejects the state. Defense-in-depth layer only.

Root-cause class: second authority reading raw state the first
authority gates.

### W3-INT-4 — kit coherence covers basic `[0]` only — **REJECTED WITH EVIDENCE**

Candidate: `assertSaveAcceptable` kit coherence requires
`SPELL_KIT_IDS[element][0]` (basic) but not `[1]` (special), so a
save carrying the basic without the special loads with a silently
absent special (`resolveSpecialUltimate` returns `{special:
undefined}`, no throw).

Rejected: the special is not atomically committed — it unlocks via
the `linh_ngo_<special>` keystone gated at `foundation_establishment`
(`PhapTuNodes.builders.ts:119-137`), so basic-without-special is a
canonical qi_refining state, and respec clawback can legitimately
remove a granted special later (only element roots are in
`RESPEC_PRESERVED_NODE_IDS`, ProgressionOps.ts:95-98). The coherence
check mirrors the *crash* surface (missing basic throws at battle
build), not full-kit completeness — correct scope.

## Repro harness

`src/services/save/w3int.repro.test.ts` — 15 cases, all green:
shape verdicts, acceptance ordering (root-claim → kit coherence →
F-SCOPE-1), pair-ownership kills on hidden/sword stale elements,
mortal-pair emits, shape-clean→acceptance-reject reachability,
zero-mutation restore rejection. Kept as re-runnable pin evidence
(`npx vitest run src/services/save/w3int.repro.test.ts`).
