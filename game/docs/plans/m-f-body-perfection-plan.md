# M-F-BODY-PERFECTION — Hidden Body Perfection — plan

Spec: `game/docs/specs/m-f-body-perfection-spec.md` (v1 — pending C2C
spec review). Implements the canonical `{discoveredMaterials,
perfectedRealmIds}` state, the acquisition-funnel discovery hook, the
atomic/idempotent `perfectBodyRealm` transaction, the BODY-CORE channel
multiplier `×(1 + 0.10 × perfectedCount)`, the hidden
`BodyPerfectionSection`, and save v80 - all seams wired, all content
deferred (registry lists authored `[]`).

Phase 1 delivered docs only; Phase 2 implements under C2C impl review.
Worktree per P2 (production edits); `.agent-worktrees/m-f-body-perfection`.

## Step 0 — seam census (verified during spec; evidence in spec §1)

- Raw channel `collectBodyBaseStatDeltas` —
  `BodyProgressionSystem.ts:170-186`; sole consumer merge loop
  `Player.ts:498-502`. Effective collector lands beside it; the merge
  loop is the ONLY consumer swap.
- Acquisition funnel `notifyQuestMaterialGained` —
  `GameManagerQuestOps.ts:54-61`; deps fields
  `GameManagerRewardOps.ts:28`, `GameManagerEconomyOps.ts:21`,
  `EquipmentOpsSystem.ts:39`, `GameManagerBuildingOps.ts:32`,
  `GameManagerTickOps.ts:48`; wiring `GameManager.ts:621-622,698-699,
  767-768,782-783,920-921`. Direct `onMaterialCollected` callers to
  re-route: `BattleLootSystem.ts:556,727`,
  `QuestSystem.claim` `:193-200` (via optional `QuestBagDeps.
  onMaterialGained`). Hookless live landings gaining the funnel:
  `GameManagerTickOps.deliverDecomposeOutput` `:280-282`,
  `GameManagerCompanionOps.ts:108`, essence change credit
  `GameManagerRealmAdvanceOps.ts:593-596`.
- Transaction template `investBodyChapter` —
  `GameManagerRealmAdvanceOps.ts:518-598` (JSON probe `:554-558`,
  `bag.has` preflights, all-or-nothing commit).
- Registry template `assertBodyChapterRegistry` —
  `BodyChapter.ts:333-363`; pure-registry template
  `data/realm/PhysiqueEssence.ts`.
- Save seams `saveShapeValidation.ts:729`, preflight
  `GameManagerSaveRestore.ts:291`, `CURRENT_SAVE_VERSION` +1 over the
  merged base (76 → 80 on the impl branch: M-F-COMPANION-GIFT took
  77, M-F-CHU-THIEN took 78, ARTIFACT-DEFER takes 79 — same r60-f5
  rule applied per landed parallel bump).
- Restore exclusion recorded (`GameManagerSaveRestore.ts:466-471` —
  restore is not acquisition).
- `REALMS` id order + `getRealmIndex` (`realmSystem.ts:98`) for the
  realm-reached gate.

## Step 1 — state + registry + pure domain (`core/realm/body/BodyPerfection.ts`)

- `BodyPerfectionState { discoveredMaterials: string[],
  perfectedRealmIds: string[] }`; `createDefaultBodyPerfection()`;
  `PlayerData.bodyPerfection` field + `createDefaultPlayer` init
  (`Player.ts:442-443` convention).
- `data/realm/BodyPerfection.ts`: `BODY_PERFECTION_REALM_MATERIALS`
  (every `REALMS` id → `readonly string[]`, ALL `[]` — seam, not
  content), `bodyPerfectionMaterialIds`, `bodyPerfectionRealmOf`,
  `isBodyPerfectionMaterial`, and the validate+assert PAIR
  (C2C r65-f2, `BodyChapter.ts:333-363` convention):
  `validateBodyPerfectionRegistry(registry, realmIds): string[]` pure
  + `assertBodyPerfectionRegistry(registry =
  BODY_PERFECTION_REALM_MATERIALS)` invoked once at module load over
  the canonical constant — malformed fixtures inject into the
  validator, never mutate the constant post-import. Pinned checks:
  realm-key set === canonical `REALMS` ids EXACTLY (C2C r60-f3: a
  missing key silently disables a realm); a material id in ≤1 realm
  list (DISTINCT premise); intra-list uniqueness. Material-id
  resolution vs the `materials` catalog is pinned in the integrity
  test (`PhysiqueEssence.test.ts:20` convention — data/realm never
  imports data/materials in production).
- `recordBodyPerfectionMaterialDiscovery(player, materialId)` —
  set-add via `bodyPerfectionRealmOf`; `BODY_PERFECTION_BONUS_PER_REALM
  = 0.10`; `getBodyPerfectionMultiplier(player)`;
  `isBodyPerfectionRevealed(player)`; `canPerfectBodyRealm(player,
  realmId, ownedOf)` (non-empty authored list + realm-reached via
  `getRealmIndex` + not-yet-perfected + `ownedOf(id) >= 1` ∀ +
  **`discoveredMaterials` ⊇ authored list ∀** — C2C r60-f1: inventory
  ≠ canonical discovery, restore can't reconstruct it, and a commit
  without this arm would instantly violate the integrity invariant);
  `applyBodyPerfection(player, realmId)` (write-if-absent push);
  `getBodyPerfectionRealmProgress(player, realmId, ownedOf)` — the
  observational read-model (Q9).

## Step 2 — discovery funnel

- `GameManagerQuestOps.notifyQuestMaterialGained` → rename
  `notifyMaterialGained`; fans out to `questSystem.onMaterialCollected`
  (unchanged) + `recordBodyPerfectionMaterialDiscovery(
  getActivePlayer(), materialId)` when `amount > 0`.
- Rename the deps field at the 5 files + rewire the 5 GameManager
  closures (Step 0 census).
- `BattleLootSystem`: add `deps.notifyMaterialGained`; switch both
  grant sites (`:556`, `:727`) to it; drop no other deps
  (`questSystem`/`questRegistry`/`questManager` stay for
  `onEnemyDefeated :415-417`).
- `QuestSystem.claim`: optional `QuestBagDeps.onMaterialGained` in
  `QuestBagDeps`; `:193-200` prefers it over the bare
  `onMaterialCollected` when provided; `GameManagerQuestOps.claimQuest`
  supplies `(id, delivered) => this.notifyMaterialGained(id, delivered)`.
- Add funnel calls at the three hookless live sites (Step 0) — additive
  only; no amount/overflow changes. Restore sites stay unhooked.

## Step 3 — transaction + multiplier + save

- `GameManagerRealmAdvanceOps.perfectBodyRealm(player, realmId)` —
  `canPerfectBodyRealm` → JSON-probe apply → per-material `bag.has` +
  `remove(1)` → `applyBodyPerfection` → notify. `boolean` return;
  idempotent short-circuit on `perfectedRealmIds.includes`.
- `BodyProgressionSystem.collectEffectiveBodyBaseStatDeltas(player)` =
  raw × `getBodyPerfectionMultiplier` (factor 1 short-circuits to raw).
  `Player.ts:499` merges the effective collector — sole consumer swap;
  raw contract unchanged.
- `CURRENT_SAVE_VERSION` +1 over the merged base AT IMPLEMENTATION
  START (76 → 77 at spec time; re-read `saveVersion.ts:127` — C2C
  r60-f5, never a literal); `validateBodyPerfectionPersistedState`
  beside `saveShapeValidation.ts:729`; `assertBodyPerfectionIntegrity`
  beside `GameManagerSaveRestore.ts:291` (discovered ⊆ authored family;
  perfected ⊆ authored keys with non-empty lists; perfected's list ⊆
  discovered; **`getRealmIndex(perfected) <= getRealmIndex(player.
  realmId)` ∀ — C2C r60-f2, crafted-save smuggle; future-realm
  DISCOVERY stays legal** — the append-only authoring constraint it
  creates is recorded for the content pass).

## Step 4 — hidden surface

- `components/panels/realm/BodyPerfectionSection.vue` +
  `RealmPanel.vue` mount beside `:126-130`. `v-if` on
  `isBodyPerfectionRevealed`; per-realm rows only for realms with ≥1
  discovered material; only discovered ids named; perfect button gated
  on `canPerfect`; perfected realms marked complete. i18n keys
  `panels.realm.bodyPerfection.*` via `useI18n` (P16; VN label
  `Thể Phách Hoàn Thiện` — C2C flag); P15 ASCII comments; existing
  primitives only.

## Step 5 — pin tests (spec §10)

1. `src/data/realm/BodyPerfection.test.ts` — registry gate on
   INJECTED registries via `validateBodyPerfectionRegistry` /
   `assertBodyPerfectionRegistry(reg)` (C2C r65-f2: dup cross-realm
   id throws; unknown realm key throws; missing realm key throws;
   **key-set === REALMS ids exactly — C2C r60-f3**); every authored
   id in the shipped constant resolves in the `materials` catalog
   (`materials` import — C2C r60-f3); reverse lookups; all-empty
   authored state clean.
2. `src/core/realm/body/BodyPerfection.test.ts` —
   record-once/idempotent; non-perfection id no-op; `canPerfect` arms
   (empty list fails closed, unreached realm rejected,
   already-perfected rejected, missing material rejected,
   **owned-but-undiscovered required material rejected — C2C r60-f1**);
   `applyBodyPerfection` write-if-absent;
   `getBodyPerfectionMultiplier` = 1 + 0.10n. **Non-empty arms run on
   `vi.mock` fixture registries (C2C r65-f1)** — the shipped all-empty
   registry only exercises the fail-closed arm.
3. Funnel (C2C r65-f3 — each newly hooked landing pinned individually,
   funnel called EXACTLY ONCE with the NET DELIVERED amount; existing
   quest/overflow semantics preserved at every site):
   - `GameManagerQuestOps.notifyMaterialGained` — rename-site test:
     quest progress + `recordBodyPerfectionMaterialDiscovery`
     both fire once;
     `amount = 0` fires neither;
   - `BattleLootSystem` — both grant sites route through
     `deps.notifyMaterialGained` once per landed material (no dual
     quest hook — `onMaterialCollected` not double-counted);
   - `deliverDecomposeOutput` (`GameManagerTickOps:280-282`) — funnel
     once with `amount - overflow` (full-overflow → no call);
   - companion-token refund (`GameManagerCompanionOps:108`) — funnel
     once with the refunded unit;
   - essence change credit (`GameManagerRealmAdvanceOps:593-596`) —
     funnel once with the credited amount, on success only;
   - `QuestSystem.claim` callback route — `QuestBagDeps.onMaterialGained`
     preferred when provided (no double `onMaterialCollected`),
     bare-hook fallback preserved when absent;
   - restore (`GameManagerSaveRestore:446,485`) — funnel never called;
   - rename sweep — no `notifyQuestMaterialGained` reference survives
     the diff outside migration comments.
4. `GameManagerRealmAdvanceOps.perfectBodyRealm` — probe-failure zero
   mutation (materials + state + notifications), `bag.has` shortfall
   zero mutation, commit consumes exactly one of each listed id + marks
   realm, re-transact returns `false` debiting nothing — **success
   paths on `vi.mock` fixture registries (C2C r65-f1)**; the shipped
   all-empty registry only exercises the fail-closed rejection.
5. Channel — `collectEffectiveBodyBaseStatDeltas` = raw when 0
   perfected; ×1.1 / ×1.2 scaled; `collectBodyBaseStatDeltas` raw
   unchanged; non-body sources (`baseStats`, `modifiers`, equipment,
   `externalModifiers`) byte-identical (multiplier isolation);
   `resolvePlayerStatAssembly` totals reflect scaled body deltas.
6. Save — **fixture-registry round-trip (C2C r68): injected
   non-empty registry + legal state (`discoveredMaterials` ⊇ an
   authored realm list, one `perfectedRealmIds` entry), serialized +
   restored, assert both sets survive serialization end-to-end** —
   proves persisted perfection state round-trips, not just that the
   fields exist; production all-empty round-trip kept as a second
   case (v(CURRENT+1) fields present, both sets `[]`); malformed
   payload emits; **immediately-previous-version save rejected (C2C
   r60-f5)**; integrity rejects a perfected future realm (C2C r60-f2)
   while allowing future-realm discovery; restore fires no
   re-discovery/re-mark.
7. Component — `BodyPerfectionSection` absent pre-discovery (not
   rendered), present post-, partial reveal lists only discovered ids,
   button gating follows `canPerfect`, perfected marker renders —
   driven on `vi.mock`-injected fixture registries + Pinia seeding
   (C2C r60-f4: production lists ship `[]`, so no production injection
   seam exists).
8. Late perfection — perfect `mortal` while `realmId === 'golden_core'`
   succeeds and scales (**fixture registry — C2C r65-f1**).

## Step 6 — gates

- P3 **full** (`npm run verify`): Pinia root state + save schema bump
  trigger full mode. Scoped loop during iteration: `npx vitest run
  src/core/realm/body src/data/realm src/core/game src/services/save
  src/components/panels`.
- P18 OCR (`open-code-review`) on the diff → P4
  `tutienidle-adversarial-qa` quick (P4 deep if quick flags
  save/progression breadth — the S-save + L-progression triggers argue
  for it) → P5 sequential ≥3 passes.
- P13/P14 **triggered**: new UI surface + funnel wiring — Playwright
  from the implementation worktree. Per C2C r60-f4 the production
  runtime drive is HIDDEN-STATE ONLY (empty registry → section absent,
  RealmPanel unchanged, no console errors); the
  absent→revealed→partial→perfected chain is covered by the
  fixture-injected component/unit tests in Step 5.7, not production
  runtime. Recorded evidence per the worktree rule.
- P15 ASCII scan; P16 VN-key audit on the new section.
- Commit + push `devin/1790147578-m-f-body-perfection`; PR base
  `p7/truc-co`; STOP.

## Acceptance criteria (per spec §10)

- All §2–§7 seams land; zero pre-existing behavior drift outside the
  enumerated funnel call sites; the diff carries no authored material
  ids (registry lists stay `[]` — content is a later pass).
- `npm run verify` green; OCR clean; P4 verdict recorded; P5 passes per
  coordinator gate order.
- Runtime evidence captures the production hidden state; the
  absent→revealed→partial→perfected chain is covered by
  fixture-injected tests (C2C r60-f4).
- Report records branch, files, per-gate evidence, limitations.
