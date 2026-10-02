# B18 — Scope CONSUMER Seam Review (blind)

- Commit: `af3666e7a3b987c270d7acdeb4fe3f91166be4db` (branch `devin/qa-fixpoint`, worktree `qa-b18-consumer`)
- Probe: `tests/architecture/b18ConsumerHonesty.qa.test.ts` — SSR `renderToString` mounts of the real components with hostile persisted state; 4 failing DEFECT assertions (deterministic repros), 5 passing controls/observations.
- Run: `npx vitest run tests/architecture/b18ConsumerHonesty.qa.test.ts` → 4 failed | 5 passed.

## Verdict: FAIL WITH REASON

Four scope-honesty leaks into visible play confirmed at render level. All four require a flagged-but-playable save (carried dormant way / carried suppressed bag stacks — contract sec.H: out-of-scope saves still load and play). The verdict machinery itself is sound: every mount chokepoint, capability resolver, and domain predicate checked is correct — the leaks are all consumers that read around the shared predicates, exactly the defect class this seam exists to catch.

## Findings

### B18-01 (Medium) — LoreCodex renders the suppressed Chiêu Hiền Lệnh stack
- **Surface:** `src/components/panels/scripture/LoreCodex.vue` (Scripture Pavilion — beta-admitted `left_panel` mode).
- **Repro:** bag `{chieu_hien_lenh: 5}` → SSR HTML contains "Chiêu Hiền Lệnh" slot; description names Chiêu Hiền Quán + companion pulls (dormant branding).
- **Cause:** `loreItems = materialBag.getAll().filter(s => s.material.category === 'other')` — the only live consumer that reads the material bag without `isCompanionPullTokenSourceSuppressed`. The token is `category: 'other'`, so the lore filter admits it verbatim.
- **Sibling search:** every other reader is gated — `MaterialBagSection.vue:240` (the predicate), `QuestPanel.vue:63`, `QuestSystem.ts:74/252`, `CurrencyHud.vue` companionChips (`isBetaFeature('companion')` + domain unlock), `ChieuMoTab`/`ArtifactPanel`/`CompanionPanel` (scope-hidden panels), `VendorPanel` (sellable categories exclude 'other'). `yeu_dan_hung_giao` and `doan_bao_thach` are 'other'-category too but are not display-suppressed anywhere (acquisition-suppressed only), so LoreCodex showing them matches bag policy — not a disagreement.

### B18-02 (Medium) — BagGrid material-tab count includes suppressed tokens
- **Surface:** `src/components/panels/BagGrid.vue` header badge.
- **Repro:** bag `{chieu_hien_lenh: 5}` on the `material` tab → header renders "1 món" while the grid renders 0 items (probe asserts count `0`, got `1`).
- **Cause:** `BAG_COUNTS.material = materialBag.getAll().length` unfiltered. The adjacent `pill` count filters `scopeHiddenPillFamilyOfId` with the explicit comment "the tab count must agree with what the grid can render" — the material count misses the equivalent filter.
- **Sibling search:** `equipment` count honest (no suppressed equipment ids); `pill` count correctly filtered. This is the same unfiltered-`getAll()` class as B18-01 on a different channel.

### B18-03 (Medium) — SkillPathPanel subtitle brands a carried dormant way
- **Surface:** `src/components/panels/SkillPathPanel.vue` `wayIdentity` (standalone panel `skill` — beta-admitted).
- **Repro:** save `{cultivationPath:'sword', cultivationWay:'hidden_sword_pathway'}` → subtitle renders "Kiếm Tu Ẩn — Vạn Kiếm Quyết" while the panel body correctly renders empty.
- **Cause:** `wayIdentity = getActiveWayDefinition(player)?.name ?? mortalName` — the only ungated read in the file; entries use `betaSkillAdmitted`, `showTree` uses `betaWayAdmitted`, the technique band uses `betaTechniqueAdmitted`.
- **Sibling search:** other `getActiveWayDefinition` consumers — `ArtifactPanel.vue:50` (scope-hidden, inert), `CharacterPanel.vue:55` (B18-05, Low), `QuanKhiPanel` double-gates with `isActivePath && !isScopeHidden('swordPath')` (clean).

### B18-04 (Medium) — Dormant hidden-way cultivate art on live surfaces
- **Surface:** `getCultivateTexture` override → `PlayerPortrait` `variant="cultivate"` (`DongFuScene.vue:259` home figure, `RealmPanel.vue:91`) and `MainScene.ts:336` / `TribulationScene.ts:128` via the `playerCultivationWay` gate (`PhaserCanvas.vue:110` writes the raw way).
- **Repro:** save `{cultivationPath:'spell', cultivationWay:'hidden_spell_pathway'}` → `img src` = `player-phap-tu-an-cultivate-van-dao-v1.png`. The home-scene center figure repaints as the hidden way's art.
- **Cause:** `CULTIVATE_TEXTURE_OVERRIDES` (`PlayerVisualProfiles.ts:207`) applies the override for any way value — no `isBetaWay` admission; `hidden_spell_pathway` is not in `BETA_WAYS`.
- **Sibling search:** every `getCultivateTexture` consumer feeds the raw persisted way — two live `PlayerPortrait` mounts plus the two Phaser scenes (resolver-level evidence; Phaser cannot be SSR-mounted). `portrait` variant uses `combatTextureUrl` (honest). Sword/body ways have no override entry (inert for those saves).

## Deferred findings (no visible-play leak)

- **B18-05 (Low)** — `CharacterPanel` `--aura` tints `var(--el-metal)` for a carried `sword_pathway` save (fixed-element declaration; no branding text). Observation probe documents the tint.
- **B18-06 (Low)** — `RewardList.vue:21` `artifactInsight` row is latent: no beta writer produces a nonzero value.
- **B18-07 (Nit)** — `WorkerLodgePanel` `visibleTabs` uses an ad-hoc `isCompanionDomainUnlocked` check instead of the shared surface model; predicate is beta-aware and the panel is unmountable in beta.
- **B18-08 (Nit)** — `NodeTreePanel` skips `betaSkillTreeFor` (latent; `nodeWayApplies` covers requiredWay-stamped dormant nodes); `CombatTopBar.getActiveHiddenTrial` reads runtime-only battle state (no persisted hostile input, no beta spawn path).

## Verified-clean consumer classes (hostile-state probes reviewed, no leak)

Mount seams double-gate (`ui.openStandalonePanel` + `GameRoot.mountedStandalone`/`betaAdmittedBuildingPopoverId`); capability-driven surfaces collapse via `resolvePathCapabilities` empty-set (turn skill bar, all three presentation bridges, QuanKhi sword card); suppressed-source items are filtered at `MaterialBagSection`, `PillBagSection` (`scopeHiddenPillFamilyOfId`), quest chips/`resolveClaimable`, and `CurrencyHud`; talent offers/entitlements double-gate via `isBetaTalentId`/`isBetaCreationTalentId`; realm-hidden records via `betaHiddenRealmRecordFor`/`isNghichChuTianRevealed`; vendor/stage/alchemy consumers have no dormant content to render; production manual-workforce block is `betaSurfaceVisible`-gated; `unsupportedReleaseReason` flags the carried states without blocking play.

## Access limitations

- Vitest runs under the `node` environment — component evidence uses `createSSRApp` + `renderToString` with App.vue's real provide seams (`GAME_MANAGER_KEY`, `STATE_VERSION_KEY`, `BUMP_STATE_KEY`, pinia, i18n) plus a JSDOM shim for `useDialogFocus`. All four repros are real rendered output strings, not source reads.
- Phaser scenes (`MainScene`, `TribulationScene`) cannot be SSR-mounted; their dormant-art feed is documented at the resolver assertion plus the gate-write site — the same ungated `getCultivateTexture` call SSR proved on `PlayerPortrait`.
- Blind review: no prior reviewer findings were read; existing `*.qa.test.ts` files were used only as harness references.
