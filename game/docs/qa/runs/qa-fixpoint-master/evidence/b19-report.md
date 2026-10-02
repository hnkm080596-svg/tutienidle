# B19 — Scope CONSUMER seam review (blind)

**Commit under test:** `ab0b135e021dbc915821c0855de3d395ce82a5ce` (branch `devin/qa-fixpoint`)
**Surface:** every consumer of persisted/claim state downstream of the scope verdict — HUD/panels/bars/cards/emblems/tooltips/popovers, `src/presentation/bridges/`, `src/components/` — under hostile saved states (carried dormant-way kit, dormant bag stacks, carried claims).
**Verdict:** `PASS WITH GAPS` — two confirmed Medium leaks.

## Method

Censused every component that reads player data, capability resolvers, or bag/registry state. For each, asked "does a carried dormant save (which contract sec.H lets LOAD AND PLAY) render scope-honestly here?" Shared predicates verified consulted at the seams: `resolvePathCapabilities` way-admission (`CultivationPathSystem.ts:184-192` — now fails closed for committed non-beta ways), `isBetaWay`/`isBetaFeature` (`betaScope.ts`), `isCompanionPullTokenSourceSuppressed` + `isDomainScopedAcquisitionEnabled` (`ReleasePolicy.ts`), `betaCombatRolesFor`/`betaSkillTreeFor`/`betaCombatSurfacesFor` (`betaScopeSkillDomain.ts`), `isBetaEquipmentTab`, `isBetaLeftPanelMode`, `isBetaBuildingSurface`, `betaHiddenRealmRecordFor` (`betaScopeSurface.ts`).

## Findings

### b19-01 — Medium — Character detail card renders hidden-way stat rows

**Surface:** `src/components/panels/CharacterDetailCard.vue` (`statGroups` iterates every `BASE_STAT_LABELS` entry in `combat/survival/special/defense_advanced` with no scope filter).

**What leaks:** three rows for the hidden body way's reactive chances — `counterChance` / `protectChance` / `followUpChance` — whose own labels and descriptions name `Thể Tu Ẩn` verbatim (`StatLabels.ts:68-70`), plus `reactionEffectPercent` ("Hiệu Ứng Phản Ứng") which `StatDomain.ts:34` marks as existing only inside the hidden Pháp Tu path.

**Repro:** mount `CharacterDetailCard` on a *fresh default player* — no hostile state needed; every beta player's stat card names the dormant hidden way. `tests/architecture/b19ConsumerScopeLeak.qa.test.ts` → `character detail card renders no hidden-way stat rows` **FAILS**.

**Mint path:** Character panel → "Chi Tiết" button → the card renders for any player at any time. Contract sec.I ("no UI may mention" hidden ways) is violated unconditionally — not just on carried saves.

**Fix shape (reviewer note, not applied):** the stat row list needs the same scope admission the rest of the combat/stat domain uses — filter hidden-path stat keys out of the rendered categories rather than iterating `BASE_STAT_LABELS` raw.

### b19-02 — Medium — Carried artifact-domain stone renders in bag + lore codex

**Surface:** `src/components/panels/bag-sections/MaterialBagSection.vue:239-240` (`entries` — only filter is `isCompanionPullTokenSourceSuppressed`) and `src/components/panels/scripture/LoreCodex.vue:22-28` (`loreItems` — category `'other'` + same single filter).

**What leaks:** a carried `doan_bao_thach` stack (`data/materials/materials.ts:86-92`) renders in both panels. Its description is authored artifact-domain branding: *"dùng để nâng phẩm bản mệnh pháp bảo"* — it names the scope-hidden artifact system to the player. Delivery of the item is suppressed by `isDomainScopedAcquisitionEnabled` (`ReleasePolicy.ts:153`, `ARTIFACT_UNLOCK_REALM_ID = 'golden_core'` — beyond the release ceiling), so the only way a stack exists is a legacy/carried save — which contract sec.H explicitly plays with preserved records, making this production-reachable.

**Repro:** mount both surfaces with `materialBag` containing the stone — `bag-section__count` reports it, `LoreCodex` renders it (EmptyState never mounts). Same test file, tests `material bag hides the domain-suppressed artifact stone` + `lore codex hides the domain-suppressed artifact stone` — both **FAIL**.

**Note on the suppressed-source class:** the pull token (`chieu_hien_lenh`) is already hidden from these same consumers; `doan_bao_thach` is the other census'd suppressed-source material and was not given the symmetric filter. This is dormant-system branding, not a same-value forged counter — inside the defect class, not the accepted-residual class.

## Refuted theories (checked, no leak)

- **Kiếm/Thế bars on carried sword/body saves** — `resolvePathCapabilities` returns `new Set()` for any non-beta committed way, so `hasStaticPathCapability`-gated bridges fail closed.
- **Orb picker / Ăn emblem on carried sword saves** — `CombatBuild.ts` `wayAdmitted` gates `buildDynamicBasic`; the provider never attaches, and the emblem sits inside the role-filtered loop (dead code, not a render leak).
- **Hidden-trial top-bar banner** — the sole resolver routes through `canProgressHiddenBody`, which fails closed under `!isBetaFeature('hiddenContent')`.
- **Talent entitlement dead cards** — reconcile clears rotted records; `resolveTalentEntitlement` rejects non-beta upgrade ids.
- **`RewardList` artifactInsight** — mint requires `isArtifactDomainUnlocked(player.realmId)` (golden_core, beyond ceiling): never sets for a beta realm.
- **Skill tree browsing a dormant way** — `betaWayAdmitted` in `SkillPathPanel` suppresses the way's tree; node-level `nodeWayApplies` re-filters; `betaSkillAdmitted` governs list entries.
- Wheel/buildings/left-panel/standalone-panel/panel-gates/realm ladder/talent IDs/quest rosters/alchemy recipes/pill families/production workforce: all consult their canonical beta predicates.

## Evidence

- Repro file: `tests/architecture/b19ConsumerScopeLeak.qa.test.ts` (3 tests, all 3 fail against the live leaks)
- Command: `cd game && npx vitest run tests/architecture/b19ConsumerScopeLeak.qa.test.ts`
- Findings JSON: `docs/qa/runs/qa-fixpoint-master/evidence/b19-findings.json`
