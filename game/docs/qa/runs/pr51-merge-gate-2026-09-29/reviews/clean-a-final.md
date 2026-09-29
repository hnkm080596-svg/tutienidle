# Clean-A-final — CORRECTNESS lens (SEALED)

Session: devin-f07ea17500d741478dd4f49d8950257c
contextId: clean-a-correctness-9f3e
stateHash: b1b1c5ff0d9772d9362be9feac89e052e638f32f3eab4ff545636b52ca42b5b1
verdict: FAIL

verification: type-check clean; 435 scoped tests run — all diff-touched tests pass;
3 observed failures pre-existing (files/signatures present at base f196b8d0).

## findings

### C-01 (Medium) — PlayerPortrait.vue:44-50 (consumers DongFuScene.vue:259, RealmPanel.vue:98)
evidence SOURCE_PROOF. Expected: a hidden_spell_pathway player (cultivationPath 'spell' -> phap_tu
profile) sees the way-keyed cultivate art player-phap-tu-an-cultivate-van-dao-v1 wherever the
cultivate pose renders — the declared purpose of CULTIVATE_TEXTURE_OVERRIDES. Actual: imageUrl
returns profile.cultivateTextureUrl directly, never consults way/override; scenes render the
override via getCultivateTexture(profile, way) but the home figure + realm panel render
player-phap-tu-cultivate-ngu-hanh-v1 for the same player. ENTITY_ART_MODE 'static' makes the
<img> path live; getCultivateTexture returns no url so the override is unreachable through the
component API. way-state is a real shipped save path (PhapTuPath.ts:144). Defect inside the
diff's own touched file; contradicts the 'one entity = one art family' contract.

### C-02 (Low) — stores/player.ts:269-278
evidence SOURCE_PROOF. unbuffedCultivationPerSecond = cultivationPerSecond/(1+percentAtSave)
requires the saved cPS to fold exactly the percent live at save time; cPS is written per
cultivate() tick with the percent at LAST TICK — an effect expiring/activating between last tick
and save leaves cPS inconsistent with percentAtSave; error multiplies over the whole offline
window (<=24h cap, either direction). Trigger window <=1 tick; mid-window segmentation after
that is exact.

### C-03 (Low) — PassiveSystem.ts tick/meetsCondition + GameManagerTickOps.ts:257
evidence SOURCE_PROOF. PassiveSystem ticks globally; hpReader() undefined outside battle ->
meetsCondition fails open -> BOTH complementary legs accumulate to cap while idle (Can Than
chinh +0.1 DR and phan -0.05 simultaneously — the mutual exclusivity hpNotBelow was added to
enforce only holds when the reader works). Net ambient +0.05 finalDamageReductionPercent and
+2.5 leech stack visible on stat surfaces out of combat. Flat channels make this newly
observable (previously percent-on-base-0 = no-op). Self-corrects via resetPassiveStacks at
battle entry; stacks round-trip saves.

### C-04 (Nit) — PassiveSystem.ts per_second accumulator
evidence SOURCE_PROOF. `accumulated` keeps banked seconds while a condition fails and
burst-applies on re-entry (test enshrines it). Benign only because every conditioned per_second
modifier caps at maxStacks 1 today — latent ramp if a future conditioned passive is
uncapped/multi-stack.

### C-05 (Nit) — SupabaseRemoteSave.ts remoteAhead comparator
evidence SOURCE_PROOF. remoteAhead compares remote save_revision against the per-device local
save COUNTER, then a server-vs-client timestamp tie-break. Between two diverged sessions the
side with more saves wins regardless of content freshness (deterministic most-saved-wins vs
previous newest-wins). CAS, lineage adoption (remote+1), 0-row-unavailable path all correct and
convergent; documented policy tradeoff, noted for visibility.

### C-06 (Nit) — stores/player.ts:159-162 (visualArmed), PlayerVisualProfiles.ts:214-222,
verify-fe17.mjs + verify-fixes.mjs (+2 png)
evidence SOURCE_PROOF. `(cultivationPath as string) === 'mortal'` is dead — 'mortal' is not a
CultivationPathId (module keys spell/sword/body; mortals are `undefined`).
CULTIVATE_TEXTURE_OVERRIDES.*.extent declared but no consumer reads it (getCultivateTexture
returns only {key, sourceSize}). Two root-level Playwright verify scripts hardcoding
localhost:5608 (+ screenshots) committed to the tree — process artifacts, harmless but shouldn't
ship.

### C-07 (Nit, pre-existing, out of diff scope) — combatContract.test.ts:88-89,
dynamicRegionHost.test.ts, i18nKeyParity.test.ts
evidence Confirmed (failing at HEAD). 3 failures: onBattleStart string pin stale (signature
predates this diff), dev/skill-vfx.ts constructs Phaser.Game + missing skillVfxLab.* keys —
file exists at base f196b8d0, none of the three files in the diff. Test debt, not a merge
regression.

## attacksTried
- Stat math: recomposed runPipeline (base+Sflat)x(1+Spercent)xPmult against every touched
  modifier; flat-on-base-0 fixes verified (metalPenetration, Can Than legs, TalentBuffs rate
  stats) and percent survivals (Hap Linh x1.5 leech, tu_linh_tran 0.25). Double-counting via
  getScaledPassiveModifiers spread attempted — copies stacks at call time, single accumulator.
  Modifier id uniqueness across TalentPassives verified.
- Clamp attack: finalDamageReductionPercent min 0->-1 intentional (signed downside leg); sole
  consumer CombatScene.ts:155 multiplies (1 - clamped) -> -1 -> 2x damage taken, matching spec.
- hpBelow/hpNotBelow partition at 0.35 boundary complementary, no gap/overlap; fail-open when
  reader undefined -> produced C-03.
- Band oscillation: accumulator banking while blocked -> C-04; release-on-recovery verified.
- Building pin: build->claim->restore->saveAcceptance->shapeValidation->repricing-fraction
  carry-back->dev/starter grants traced; early-return claim paths preserve window; legacy
  fallback only on absent pin (test-pinned). Could not break.
- EM-02: segment boundaries (expiry exactly at window start/end, multi-effect, zero-length);
  divisor semantics -> C-02 at save boundary only.
- Cloud CAS: remoteAhead/pull-order (revision written before save key — crash-safe),
  pushRevision=max(local,remote+1), eq.rev PATCH, empty-updated->unavailable, strict-insert
  409->unavailable, server-owned updated_at trigger, RLS/NOT NULL. Multi-session race: CAS
  loser pulls next cycle — convergent. Ordering semantics -> C-05.
- Nameplate: both write paths (create-time gate read, snapshot reconcile setText) converge on
  authored player.name minted in playerToCombatEntity.
- Armed/unarmed: resolver defaults, payload propagation (TranPhapPanel:267-268), gate seeding,
  event ordering (armed set before applyPlayerVisualProfile), preview-scene rebuild on slug
  change, ANIMATED_CHARACTER_KEYS enumeration, all-slugs preload.
- castClips: manifest cast sections match CHARACTER_ART; atlas frames exist on right sheets;
  per-skill > slot-role precedence; missing/empty-anim -> attack -> standby degrade;
  atlasClipsOf flatten verified at every former Object.values site.
- Deletions: ~199 removed files — representative basenames grepped against src/: zero live
  references.
- Cultivate texture chain — the attack that landed C-01: hidden-way override reachable only via
  getCultivateTexture(profile, way); PlayerPortrait never calls it.

## coverageNotes
- e2e spec (combat-idle-motion-capture) not executed — needs dev server + Playwright;
  motion/fallback verified statically + unit pins.
- Supabase exercised via source + unit tests only; no live CAS against a real backend.
- No visual verification of scenes/panels — art correctness argued via catalogue/atlas/manifest
  tests, not rendered pixels.
- Deletion sweep was grep-by-basename over src/, not asset-internal JSON cross-refs.
- verify-*.mjs scripts unexecuted (need live dev server).
- mortalBasicSkillId restore path read but not stepped end-to-end.
- PassiveSystem ambient accumulation (C-03) inferred from call sites (tick always runs); not
  repro'd against a live GameManager loop.

independence: No qa/ui-audit docs, no findings ledgers, no commit messages read. No
coordination with other reviewers. All evidence produced from source reading, diff inspection,
manifest/atlas JSONs, and local vitest/type-check runs only.
