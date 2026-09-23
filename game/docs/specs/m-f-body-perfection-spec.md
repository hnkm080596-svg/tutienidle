# M-F-BODY-PERFECTION — Hidden Body Perfection — Spec

Status: v2 — draft, amended after C2C spec review r60 (findings
f1–f5 resolved inline; pending re-review)
Depends on: M-F-BODY-CORE (`chapterKind` vocabulary + physique completion
seam + body-owned base-stat channel — merged on `p7/truc-co`), M-QI-07
(physique transaction pattern), M-QI-08/09/10 (essence family + atomic
invest seam), M-F-CEILING (release policy). Ruling §22 + §26–36 of the
Trúc Cơ mission-graph mandate (coordinator directive 2026-09-23);
QI-S save policy (decisions.md:201-203).

Mission-graph scope: optional per-realm Body perfection — a hidden
progression surface fed by per-realm perfection materials (distinct
materials per realm: Mortal 1 / LQ 2 / TC 3 / KD 4…), a Body-domain
perfection transaction, and a +10pp-per-perfected-realm multiplier on
the Body-derived base-stat channel.

NOT in scope: material identity/theme/count authoring per realm
(the ruling forbids generic numbered materials — the data-driven seam
lands, the content is a later pass), drop tables/drop rates, drop-band
placement, exchange/substitution of perfection materials, UI redesign,
physique-grade effects (QI-D4d — an extra grade is explicitly excluded),
save migration/translators (QI-S), balance numbers.

## 1. Audit verdict — zero baseline

Verified file-by-file against `origin/p7/truc-co` (`3b5fbac5`). Every
channel the feature needs exists; nothing of the feature itself does.

| Surface | Evidence | Verdict |
|---|---|---|
| Body-owned base-stat channel | `collectBodyBaseStatDeltas` sums per-stat flat deltas over `BODY_CHAPTERS` — `core/realm/body/BodyProgressionSystem.ts:170-186`; sole consumer `resolvePlayerStatAssembly` merges them onto ephemeral `assembledBase` — `core/player/Player.ts:498-502`. NEVER persisted into `player.baseStats`, never emitted as modifiers. | LANDED — the multiplier's target |
| Chapter delta emitters | `BodyRefinementChapter.collectBaseStatDeltas` derives tier-scaled flat gains — `BodyRefinementChapter.ts:174-176`; capability slot is optional on the shared contract (`BodyChapter.ts:136-138`) so any chapter kind contributes | LANDED |
| Material registry + bag | `Material`/`MaterialBag`/`MaterialRegistry`; `materials` catalog `data/materials/materials.ts` | LANDED |
| Live-acquisition hook convention | `notifyQuestMaterialGained` deps-injected funnel — `GameManagerQuestOps.ts:54-61`, wired as deferred closure into rewardOps/economyOps/equipmentOps/buildingOps/tickOps (`GameManager.ts:621-622,698-699,767-768,782-783,920-921`); BattleLootSystem calls `questSystem.onMaterialCollected` directly (`BattleLootSystem.ts:556-561,727-729`); restore paths deliberately skip it (`GameManagerSaveRestore.ts:466-471`) | LANDED — the seam the discovery hook rides |
| Atomic validate→consume→apply precedent | `investBodyChapter` — `GameManagerRealmAdvanceOps.ts:518-598`: detached JSON probe (never `structuredClone` — Pinia `$state` DataCloneError, C2C r24), `bag.has` per-debit preflight, change-credit capacity preflight, all-or-nothing commit | LANDED — transaction template |
| Save shape + integrity seams | `saveShapeValidation.ts:729` delegates to module-owned `validateBodyProgressionPersistedState`; `GameManagerSaveRestore.ts:291` preflights `assertBodyProgressionIntegrity`; `CURRENT_SAVE_VERSION = 76` (`saveVersion.ts:127`) | LANDED |
| Discovery state | no `bodyPerfection`/`perfectedRealm`/`discoveredMaterial` anywhere in `src/` | ABSENT — this mission |
| Hidden perfection surface | `RealmPanel` hosts `BodyRefinementSection` + `MeridianSection` (`RealmPanel.vue:126-130`); no third body section | ABSENT |
| Perfection transaction | no realm-perfection op exists (`tryAdvanceTechniqueGrade`, `GameManagerRealmAdvanceOps.ts:438-459`, is technique-grade scope) | ABSENT |
| Body-scoped multiplier | `collectBodyBaseStatDeltas` returns raw sums; no perfection factor | ABSENT |

Naming note: `player.mortalPerfectionAchieved` (`Player.ts:163`,
written `GameManagerRealmAdvanceOps.ts:340-342`, consumed
`BreakthroughGrades.ts:53`) is the OLD "hoàn hảo Phàm Nhân" concept —
a breakthrough snapshot (5/5 capped main stats + 6/6 refinement),
unrelated to this mission and untouched by it. The new domain is
`bodyPerfection` — per-realm, post-hoc, material-driven — and the two
concepts must not be conflated in code or copy.

## 2. Canonical state + authored registry

### 2.1 Persisted slice

```ts
// PlayerData gains one field (Player.ts, beside bodyProgression):
bodyPerfection: BodyPerfectionState

// core/realm/body/BodyPerfection.ts:
export interface BodyPerfectionState {
  // material ids acquired at least once (live acquisition only — never
  // restore); set-add semantics, persisted independent of consumption
  discoveredMaterials: string[]
  // realm ids whose perfection transaction committed; canonical set,
  // count feeds the stat multiplier
  perfectedRealmIds: string[]
}
```

- One new top-level `PlayerData` field, NOT a `bodyProgression` slice:
  the chapter registry pins a strict 1:1 chapter↔state-slice coherence
  (`BodyChapter.ts:307-328`); a non-chapter key would violate it.
- `createDefaultBodyPerfection()`
  returns `{ discoveredMaterials: [], perfectedRealmIds: [] }`;
  `createDefaultPlayer` initializes it (`Player.ts:442-443` convention).

### 2.2 Authored registry — the data-driven seam

`data/realm/BodyPerfection.ts` (mirrors `PhysiqueEssence.ts`'s
pure-registry shape):

```ts
// realm id -> the DISTINCT material ids whose consumption perfects that
// realm's body. All lists authored EMPTY now: identities/themes/counts
// are deferred content (ruling forbids generic numbered materials).
// The seam is what lands — every realm key is declared so reverse
// lookup + validation cover the whole realm space uniformly.
export const BODY_PERFECTION_REALM_MATERIALS: Readonly<
  Record<string, readonly string[]>
> = { mortal: [], qi_refining: [], foundation_establishment: [], /* …all REALMS ids */ }

export function bodyPerfectionMaterialIds(realmId): readonly string[] // [] for unknown realm
export function bodyPerfectionRealmOf(materialId): string | undefined  // reverse lookup
export function isBodyPerfectionMaterial(materialId): boolean
```

Registry validation is the validate+assert PAIR
(`validateBodyChapterRegistry`/`assertBodyChapterRegistry` convention,
`BodyChapter.ts:333-363`) so malformed fixtures stay injectable in
tests without mutating the canonical constant (C2C r65-f2):

```ts
export function validateBodyPerfectionRegistry(
  registry: Readonly<Record<string, readonly string[]>>,
  realmIds: readonly string[],
): string[]                                    // issues; [] = clean
export function assertBodyPerfectionRegistry(
  registry = BODY_PERFECTION_REALM_MATERIALS,
): void                                        // throws on issues
```

`assertBodyPerfectionRegistry()` runs once at module load over the
canonical constant; tests inject malformed registries into
`validateBodyPerfectionRegistry`/`assertBodyPerfectionRegistry(reg)`.
Pinned checks:
- **realm-key completeness (C2C r60-f3):** the key set equals the
  canonical `REALMS` id set EXACTLY — a missing key silently disables
  perfection for that realm, an extra key is unknown-realm corrupt;
- a material id appears in at most one realm list (per-realm DISTINCT
  materials — the ruling's premise); ids unique within a list.

**Material-id resolution (C2C r60-f3):** every authored id must resolve
in the `materials` catalog — a typo id is an impossible requirement.
Following the `PhysiqueEssence.test.ts:20` convention (data/realm does
NOT import data/materials in production code), this is pinned by the
registry integrity TEST, which iterates authored ids against `materials`
— not by the module-load gate. Malformed authored data otherwise throws
at import, never reaches the transaction.

## 3. Discovery contract — the loot hook

`recordBodyPerfectionMaterialDiscovery(player, materialId): boolean`
— the canonical writer in `core/realm/body/BodyPerfection.ts`:

```ts
const realmId = bodyPerfectionRealmOf(materialId)
if (realmId === undefined) return false              // not a perfection material
if (player.bodyPerfection.discoveredMaterials.includes(materialId)) return false
player.bodyPerfection.discoveredMaterials.push(materialId)
return true
```

- Written on FIRST live acquisition of an authored perfection material.
  Persists independent of consumption — spending/turning-in/trading the
  material never un-discovers it (the ruling's "NOT inventory-derived").
- Fires only on net-delivered amounts (`delivered > 0`): a full bag that
  drops the loot entirely does not "discover" what the player never got.
- Realm-agnostic: acquisition marks discovery regardless of the player's
  current realm (a gifted early material still counts as found).

### 3.1 Funnel — one seam, two subscribers

The existing `notifyQuestMaterialGained` deps closure IS the "a material
just landed in the player bag" funnel (its contract already says "gọi
MỖI KHI material vào túi" — `GameManagerQuestOps.ts:46-52`). It becomes
the single canonical acquisition seam:

- Rename `GameManagerQuestOps.notifyQuestMaterialGained` →
  `notifyMaterialGained(materialId, amount)`; the implementation fans
  out to `questSystem.onMaterialCollected` (unchanged) AND
  `recordBodyPerfectionMaterialDiscovery(getActivePlayer(), materialId)`
  when `amount > 0`. Deps fields `notifyQuestMaterialGained` rename to
  `notifyMaterialGained` at `GameManagerRewardOps.ts:28`,
  `GameManagerEconomyOps.ts:21`, `EquipmentOpsSystem.ts:39`,
  `GameManagerBuildingOps.ts:32`, `GameManagerTickOps.ts:48`, and the
  wiring closures at `GameManager.ts:621-622,698-699,767-768,782-783,920-921`.
- `BattleLootSystem` currently bypasses the funnel with direct
  `questSystem.onMaterialCollected` calls (`:556`, `:727`) — those two
  calls switch to a new `deps.notifyMaterialGained` (the funnel covers
  quest progress identically; `questSystem`/`questRegistry`/`questManager`
  deps stay for `onEnemyDefeated` `:415-417`). No dual path remains —
  one call per landing.
- `QuestSystem.claim`'s internal material grant (`QuestSystem.ts:193-200`)
  routes through a new OPTIONAL `QuestBagDeps.onMaterialGained` callback
  replacing the bare `onMaterialCollected` call when provided —
  `GameManagerQuestOps.claimQuest` supplies `(id, delivered) =>
  this.notifyMaterialGained(id, delivered)`. Optional, fallback-preserving:
  non-GameManager harnesses keep today's behavior (quest progress only).
- Three live-landing sites that today fire NO hook gain the funnel —
  `GameManagerTickOps.deliverDecomposeOutput` (`:280-282`), the
  companion-roll token refund (`GameManagerCompanionOps.ts:108`), and
  the essence-substitution change credit (`GameManagerRealmAdvanceOps.ts:593-596`,
  re-acquisition of a spent material — idempotent for discovery, and the
  quest hook gains the same coverage it should always have had). Each is
  one call; none changes amounts/overflow semantics.

**Explicitly NOT hooked:** `GameManagerSaveRestore.ts:446,485` restore
rehydration — restore is not acquisition (same exclusion the quest hook
documents at `:466-471`), and discovery is already persisted. The
`EssenceSubstitutionEconomy.ts:302` sim harness bypasses GameManager
ops — excluded (not production player state).

## 4. Perfection transaction — Body domain, atomic, idempotent

`perfectBodyRealm(player, realmId): boolean` on
`GameManagerRealmAdvanceOps` (deps already carry
`materialBag`/`materialRegistry`/`notifications`; signature mirrors
`investBodyChapter(player, chapterId)` — player passed, not resolved).

Sequence (modeled on `investBodyChapter`'s C2C r10/r17 shape):

1. **validate** — `canPerfectBodyRealm(player, realmId, ownedOf)` (pure,
   `ownedOf(materialId) => materialBag.getAmount(id)` oracle):
   authored list non-empty (an unauthored/empty realm fails closed —
   there is nothing to perfect), `getRealmIndex(player.realmId) >=
   getRealmIndex(realmId)` (realm reached — past or current; **late
   perfection is the ruling**, future realms rejected — C2C flag),
   `realmId` not already perfected, `ownedOf(materialId) >= 1` for
   every listed material, **and every listed material id present in
   `player.bodyPerfection.discoveredMaterials`** (C2C r60-f1 —
   inventory is not canonical discovery: restore does not reconstruct
   discovery, so a legal save can hold a required material with no
   discovery bit; without this arm the commit would consume it, mark
   the realm, and immediately violate the §7 integrity invariant
   `perfected realm's list ⊆ discovered`).
2. Probe — apply on a detached `JSON.parse(JSON.stringify(player))`
   clone FIRST (the Pinia-`$state` ruling; `GameManagerRealmAdvanceOps.ts:554-558`);
   a probe failure returns `false` with the real player untouched.
3. **consume** — `materialBag.remove(materialId, 1)` per listed material,
   each preflighted `bag.has` before ANY debit; a plan that cannot fully
   satisfy never commits.
4. **mark + stack** — `applyBodyPerfection(player, realmId)` pushes
   `realmId` into `perfectedRealmIds` (the canonical set — membership IS
   the stack; count increments feed §5). The write is the domain
   function, not inline mutation.
5. **rebuild** — nothing persistent to rebuild: the multiplier is
   derived-on-read inside the base-stat channel (§5), so the very next
   `resolvePlayerStatAssembly` sees it. No modifier slice is emitted —
   the channel stays base-stat only (M-F-BODY-CORE's channel contract).

Atomicity: zero mutation on any failure — validation failure, probe
failure, or an unsatisfiable debit all return `false` before any write.
Idempotency: `perfectedRealmIds.includes(realmId)` short-circuits to
`false` — a re-transact debits nothing and marks nothing.

UI/caller contract: the op returns `boolean` (not `void`) so the surface
can disable deterministically; notifications via the standard queue on
success (`loot`-kind, consistent with ops conventions).

## 5. Stat pipeline — the +10pp body-channel multiplier

```ts
// core/realm/body/BodyPerfection.ts
export const BODY_PERFECTION_BONUS_PER_REALM = 0.10
export function getBodyPerfectionMultiplier(player): number {
  return 1 + BODY_PERFECTION_BONUS_PER_REALM * player.bodyPerfection.perfectedRealmIds.length
}

// BodyProgressionSystem.ts — new effective collector beside the raw one:
export function collectEffectiveBodyBaseStatDeltas(player): Partial<Record<StatType, number>> {
  const factor = getBodyPerfectionMultiplier(player)
  const raw = collectBodyBaseStatDeltas(player)
  // factor === 1 → return raw unchanged (zero perfected realms = zero behavior change)
  …scale each summed delta by factor…
}
```

- `resolvePlayerStatAssembly` (`Player.ts:499`) switches its merge loop
  from `collectBodyBaseStatDeltas` to `collectEffectiveBodyBaseStatDeltas`
  — the ONLY consumer swap; the multiplier enters before assembly
  (`assembledBase = baseStats + effectiveBodyDeltas`), matching the
  ruling's `effectiveBodyBase = rawBodyBase × (1 + 0.10 × perfectedCount)`
  applied GLOBALLY to all Body-derived contribution (every chapter's
  deltas scale — the channel, not a chapter, owns the factor).
- **Isolation:** `player.baseStats`, `player.modifiers`, equipment,
  `externalModifiers`, and every non-body source are untouched — only
  the collected body deltas scale. Downstream derivation reading the
  scaled `pipelineBase` (way-facet emissions via `resolveAttributeTotals`)
  is correct behavior, not a leak: the scaled base IS the canonical base.
- **No extra Physique grade:** `physiqueGrade`/`PhysiqueLadder`/
  `derivePhysiqueGrade` untouched — perfection is a multiplier, not a
  ladder rung.
- Fractional deltas already exist (tier-ratio × baseGains); `×1.1`
  stays float — no rounding rule needed.

## 6. Hidden surface — `BodyPerfectionSection`

`components/panels/realm/BodyPerfectionSection.vue` — a third body
section inside `RealmPanel` beside `BodyRefinementSection` /
`MeridianSection` (`RealmPanel.vue:126-130`):

- `v-if` on `isBodyPerfectionRevealed(player)` (`discoveredMaterials`
  non-empty) — the section is ABSENT before first discovery, not
  hidden-but-mounted (the ruling's "completely absent").
- Per-realm read-model `getBodyPerfectionRealmProgress(player, realmId,
  ownedOf)`: `{ materials: { materialId, discovered, owned }[],
  perfected, canPerfect }` — observational only (Q9); rows render for
  realms with ≥1 discovered material; only DISCOVERED materials are
  named (partial discovery reveals only found materials — undiscovered
  entries show nothing, not even a count of what remains).
- Perfect action button enabled iff `canPerfect`; perfected realms show
  a completed marker. Minimal chrome — existing primitives (`Eyebrow`,
  `Bar`-style rows, `GameButton`), the RealmPanel system-skin variant
  applies automatically inside the opted-in subtree (M-UI-SYSTEM §6.1).
- i18n keys under `panels.realm.bodyPerfection.*` via `useI18n` (P16);
  comments plain ASCII (P15). The VN label is a content decision —
  proposed `Thể Phách Hoàn Thiện`; C2C flag (must not collide with the
  `mortalPerfectionAchieved` "hoàn hảo Phàm Nhân" vocabulary or the
  stage-clear `Hoàn Mỹ` chip).

## 7. Save contract (QI-S)

- **Version rule (C2C r60-f5):** `CURRENT_SAVE_VERSION + 1` over the
  value on the merged base AT IMPLEMENTATION START (76 → 77 at spec
  time; re-read `saveVersion.ts:127` when Phase 2 opens — if the base
  has moved, the new version is base+1, never a literal). The
  immediately previous version is rejected — version rejection is the
  mechanism; no translators, no recompute-on-load.
- `validateBodyPerfectionPersistedState(playerPayload, emit)`
  beside the body-progression delegation (`saveShapeValidation.ts:729`):
  top-level record present+object; `discoveredMaterials`/`perfectedRealmIds`
  arrays of unique strings.
- `assertBodyPerfectionIntegrity(player)` called in
  `preflightSaveRegistryReferences` immediately after
  `assertBodyProgressionIntegrity` (`GameManagerSaveRestore.ts:291`):
  every discovered id resolves via `bodyPerfectionRealmOf` (authored
  family only); every perfected id is a `BODY_PERFECTION_REALM_MATERIALS`
  key with a non-empty authored list; every perfected realm's authored
  ids ⊆ discoveredMaterials; **and `getRealmIndex(perfectedRealmId) <=
  getRealmIndex(player.realmId)` for every perfected realm (C2C r60-f2 —
  runtime validation already rejects future realms, so without this arm
  a crafted save could smuggle in an unreachable perfected realm and
  `getBodyPerfectionMultiplier` would apply it immediately). Early
  DISCOVERY of future-realm materials stays legal — only
  `perfectedRealmIds` is realm-capped.** Fail-closed, aggregate-issue
  style matching the existing gate. (Authoring constraint this creates:
  lists are append-only once a realm can be perfected — recorded for
  the content pass.)
- Restore fires nothing: no re-discovery, no re-mark, no re-apply —
  persisted state is authoritative (S1/S2).

## 8. Consistency invariants

- One canonical writer for discovery (`recordBodyPerfectionMaterialDiscovery`);
  all hook sites route through `notifyMaterialGained` — no site touches
  `player.bodyPerfection` directly.
- One canonical marker (`applyBodyPerfection`); one canonical multiplier
  read (`getBodyPerfectionMultiplier`); one transaction op
  (`perfectBodyRealm`).
- `collectBodyBaseStatDeltas` keeps its raw-sum contract (existing tests
  unchanged); the effective collector is additive beside it.
- `player.bodyProgression` chapter slices, `physiqueGrade`, stage
  `Hoàn Mỹ`/perfect-clear fields, and `mortalPerfectionAchieved` are all
  byte-identical in behavior — untouched.
- No new persisted modifier channel; no `player.baseStats` mutation;
  `Material`/`MaterialBag`/`MaterialRegistry` contracts unchanged.
- Discovery hook sites are additive calls — amounts, overflow, quest
  progress, and notification semantics unchanged at every touched site.
- Discovery gates perfection, not just visibility (C2C r60-f1):
  `canPerfectBodyRealm` requires `discoveredMaterials` ⊇ the target
  realm's authored list, so the §7 invariant `perfected's list ⊆
  discovered` can never be produced by a legal transaction — it holds
  by construction at runtime and is re-verified at restore.

## 9. Out of scope

- Perfection material identities, names, themes, icons, counts, drop
  sources/tables/rates — all content (registry lists stay `[]`).
- Perfection material amounts >1 per material (ruling is "distinct
  materials"; the contract consumes exactly one of each listed id).
- Exchange/substitution/conversion of perfection materials.
- Per-realm differentiated bonuses (the +10pp is uniform and global).
- A second UI surface, detail modal, or inventory filter for perfection
  materials (the bag shows them as ordinary materials; the hidden
  section is the only new surface).
- Balance/economy validation of material availability (no M-D-style
  sim — content does not exist to measure).
- `zhou_tian` chapter work; M-F-CHU-THIEN scope unchanged.

## 10. Acceptance

- All §2–§7 seams land; zero pre-existing behavior drift outside the
  enumerated funnel call sites.
- `npm run type-check` + scoped `npx vitest run` green (P3 quick);
  `npm run verify` if the save-version bump triggers full mode (P3 rule:
  Pinia root state / save schema → full).
- P18 OCR clean; P4 adversarial QA quick verdict recorded; P5
  sequential passes per coordinator gate order.
- Runtime evidence (P13/P14 trigger: new UI surface) — split per
  C2C r60-f4: production runtime evidence covers the
  HIDDEN/WITHOUT-CONTENT state only (all authored lists ship `[]`, so
  the reveal/perfect flows cannot occur on production data: the section
  stays absent, RealmPanel renders normally). The
  absent→discovered→partial-reveal→perfected flow is verified on
  INJECTED FIXTURES — `vi.mock` on the registry module plus Pinia
  state seeding in component/unit tests; no production injection seam
  is added — driven in the implementation worktree before merge-ready.
- Tests pin: discovery persists post-consumption; hidden-until-discovered;
  partial reveal; atomic zero-mutation failure; idempotent re-transact;
  perfect REJECTS an owned-but-undiscovered required material
  (C2C r60-f1); multiplier isolation (+10pp/×N, non-body sources
  untouched, count 0 = factor 1); late perfection; save round-trip +
  rejected old versions; integrity rejects a perfected future realm
  (C2C r60-f2); registry completeness + authored material-id
  resolution (C2C r60-f3); restore fires no re-mark. Positive-path
  domain/ops/component suites (canPerfect, the committing transaction,
  late perfection, the section) run on the same `vi.mock` fixture
  registries + Pinia seeding as C2C r60-f4 — the shipped all-empty
  registry is only exercised through the negative/fail-closed arms
  (C2C r65-f1).
