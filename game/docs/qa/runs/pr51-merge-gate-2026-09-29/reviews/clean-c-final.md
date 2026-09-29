# Clean-C-final — INTEGRATION lens (SEALED)

Session: devin-4f6f72bf78c34e49a3631dd44478fc8e
contextId: integ-ef1f16f4-a1
stateHash: b1b1c5ff0d9772d9362be9feac89e052e638f32f3eab4ff545636b52ca42b5b1
verdict: FAIL

verification: type-check clean; targeted + full vitest run (7130 pass / 4 fail — 3 failures
pre-existing at base, 1 delta-caused); zero code references to any deleted asset; cast-clip
atlas frames and reskin maps resolve end-to-end.

## findings

### F-CLOUD-1 (High) — services/cloudSave/SupabaseRemoteSave.ts:102-105 + LocalCloudSaveService.ts:29-38
evidence SOURCE_PROOF. Expected: cloud sync must never regress to an older revision /
newest-wins reconcile. Actual: save_revision is a per-device lifetime WRITE COUNTER
(local revision = currentRevision + 1 every save, ~15s autosave), not a shared sequence; the
reconcile comment claims the counter "rides the remote row's lineage across devices" — true
only for linear lineage; under device divergence it cannot order. Concrete loss: device B away
2 months at local rev 400 (stale data); device A pulls remote at rev 115 (adopts remote
revision) and plays to rev 130. B logs in: remoteAhead = (130 > 400) = false -> B keeps stale
local -> CAS push at max(400,131)=400 succeeds -> remote now holds stale content at rev 400.
A's next login: 400 > 130 -> pulls the stale save -> A silently loses all progress since
divergence. No test exercises the divergent-lineage case (the "remote newer revision wins" test
only covers remote-ahead on a shared lineage). Residual: at equal revision the tie-break
compares server updated_at to client player.lastSavedAt — a cross-clock comparison the
migration only partially retires.

### F-PORTRAIT-1 (Medium) — components/common/PlayerPortrait.vue:42
evidence Confirmed. Expected: suite green at HEAD. Actual: the diff added usePlayerStore() in
setup for profile-derived art; the unchanged PlayerPortrait.test.ts mounts the component
without a Pinia instance -> getActivePinia() throws; `npx vitest run` fails 1 test ('static
mode renders the PNG <img>'). Delta-introduced test regression: the new component->store
coupling was not ported into the existing test.

### F-OFF-1 (Medium) — stores/player.ts:269-288 + core/cultivation/CultivationTick.ts:29-46
evidence SOURCE_PROOF. Expected: offline accrual prices the window at the rate the player
actually had. Actual: the un-buff derivation divides the saved rate by (1 + percentAtSave) —
percent evaluated at SAVE time — while cultivationPerSecond was folded at LAST-TICK time; a
buff flipping inside the (lastTick -> save) gap mis-folds the rate for the whole offline
window: expiry -> over-grant (+25% for Tu Linh Tran); activation -> under-grant (~-20% of
buffed). The gap is sub-tick so the trigger is rare, but the error scales with the full offline
duration (hours).

### F-OFF-2 (Medium) — services/save/saveShapeValidation.ts:533-563 + core/economy/TuLinhTranBalance.ts:39-46
evidence SOURCE_PROOF. Expected: save/restore shape-validated — every field a new consumer
trusts must be checked. Actual: persistentTimedEffects validation checks
id/sourceItemId/appliedAtMs/expiresAtMs/modifiers but not cultivationSpeedPercent or
effectGroup. The new un-buff divide rate/(1+sum percent) is a new sink: a crafted save/import
with percent <= -1 yields an Infinity or negative unbuffed rate (infinite or negative offline
grant); a NaN percent yields NaN cultivation (addCultivation has no NaN guard -> permanent
progression corruption). Reachable via forged local save or crafted import file; pre-existing
consumers (tick-time multiply) poisoned the rate the same way, but the divide sink is this
diff's addition.

### F-VISUAL-1 (Low) — stores/player.ts:158-163
evidence SOURCE_PROOF. Expected: armed reflects an actual armed/unarmed pick. Actual:
`visualArmed` returns false for every non-mortal profile (the mortal && ... short-circuit).
Harmless today — phap_tu/kiem_tu/the_tu are bare-string bindings that ignore armed — but the
gate reports a definitive 'unarmed' for states never meant to carry the concept; a future
{armed,unarmed} binding on a non-mortal profile would silently resolve the unarmed slug.
Returning undefined (or scoping the key to mortal) would keep the contract honest.

### F-REPO-1 (Nit) — game/verify-fe17.mjs, game/verify-fixes.mjs, verify-fe17-realm.png, verify-fixes-combat.png
evidence SOURCE_PROOF. The same merge that deleted screenshots/.c2c state committed ~2.2MB of
runtime-verification scripts and PNGs at the game root — housekeeping inconsistency; harmless
to runtime.

### F-DOCREF-1 (Nit) — game/public/assets/**/README.md + docs/design/*
evidence SOURCE_PROOF. Runtime clean — zero code references to any of the ~144 deleted files
(exhaustive path-keyed grep over all non-docs sources); ~72 dangling references remain in asset
READMEs/design docs pointing at deleted preview/contact-sheet images.

## attacksTried
- Deleted-file sweep: keyed every deleted repo path to assets/-relative and absolute forms;
  grep over all src/tests/scripts/config — zero code references. manifest.json variants
  (pham_nhan, pham_nhan_unarmed, ngu_kiem, ngu_hanh) all present; sheet/atlas/avatar files
  exist; declared cast-clip frame names `<slug>-cast-<key>-NNN.png` verified frame-by-frame
  inside atlas JSONs (linh_bao 1-17 sheet-2, special 1-17 sheet-3 match CharacterArt.ts
  declarations).
- Armed/unarmed resolution: resolveCharacterArtSlug pair picks armed unless opts.armed===false;
  bare-string bindings ignore armed; resolveCharacterArtSlugs/ANIMATED_CHARACTER_KEYS enumerate
  both variants; every preload path (getHomeDescriptors, getCombatDescriptors, MainScene
  create, TranPhap preview) queues both sheets — no mid-scene atlas-miss on basic-skill flip.
- Gate chain: publishProfile writes profileId+armed+cultivationWay and watches
  realmId/cultivationPath/cultivationWay/mortalBasicSkillId; CombatScene create() +
  player_visual_profile_changed handler both apply armed before re-skin; combat-player-visual
  halts in-flight clips, drops pending transition listeners, re-derives sourceSize/extent per
  mode — no early-return on same-profile so armed flip re-skins.
- Nameplate: entity.name minted from player.name (playerToCombatEntity:582); reconcile's
  sprite.label.setText(action.state.name) syncs authored name — does not overwrite 'Player'.
- RealmPassiveNodes realmId flip (origin->destination): display-only consumer in RealmPanel;
  grantedRealmPassiveIds written by RealmPassiveSystem with the actual realm id — no coupling
  break.
- Building pin: all three construction sites pin accrualRealmId (build(), App.vue starter,
  dev gate); acceptance rejects unknown realm ids; round-trips through detachSaveValue +
  structuredClone; claim re-pins at currentRealmId with fraction carry-back at pinned rate.
- Stats channels: flat modifiers hit the Added pool (percent x0-base no-op avoided); negative
  finalDamageReductionPercent clamps to [-1,0.75]; finalDamageMultiplier stays bounded
  [0.25,2]; flatStat/stat id derivation verified unique across authored entries
  (hpBelow/hpNotBelow suffixes).
- PassiveSystem: hpBelow/hpNotBelow disjoint+exhaustive at the boundary; condition-fail clears
  stacks but retains perSecondAccumulator — safe because the only conditioned per_second skills
  are maxStacks-1 with no passiveConvertsTo; latent risk for a future uncapped conditioned
  per_second. handleEvent's condition-fail path does not clear stacks — dead path today.
- Cloud CAS mechanics: strict POST when no row, PATCH guarded on read revision, 0-rows ->
  'unavailable' -> coordinator resync+retry — individually sound; the defect is the ordering
  key itself (F-CLOUD-1).
  [tail of attacksTried + coverageNotes + independence truncated by transport; core substance
  captured above]

independence: blind — no docs/qa, docs/ui-audit, ledger files, or commit messages read; no
coordination with other reviewers; evidence from source/diff/test execution only.
