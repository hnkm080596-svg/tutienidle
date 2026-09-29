# Clean-B-final — AUTHORITY lens + TERMINAL CHECK (SEALED)

Session: devin-68c33b9edd20466fa58d67afd69e455d
contextId: clean-b-authority-t2v9
stateHash: b1b1c5ff0d9772d9362be9feac89e052e638f32f3eab4ff545636b52ca42b5b1
verdict: PASS WITH EVIDENCE

verification: type-check clean; npx vitest on 22 touched-surface files: 177/177 green
(TalentBuffs, BuildingSystem, PassiveSystem band/talentv4, SupabaseRemoteSave,
LocalCloudSaveService, TuLinhTranBalance, player.restoreFromSave, RealmPassiveNodes,
buildingAccrualPin, playerNameplate, presentationGate, animationCatalogue, atlasFramesExist,
artPlaceholderDebt, artExtentDeclared, characterArtReskin, PlayerVisualProfiles, CombatPreload,
combat-player-visual, TranPhapPanel, TalentsV4Wiring, PlayerStatAssembly).

## findings

### F1-AUTH-BAND-FAILOPEN (Low) — PassiveSystem.ts:84-91, GameManager.ts:328-336, GameManagerTickOps.ts:257
evidence SOURCE_PROOF. Expected: conditioned per_second passives (Can Than +/-FDR legs, Hap
Linh leech) live only where the hpReader can evaluate the condition. Actual: outside battle
hpReader() -> undefined -> meetsCondition fails open (returns true) -> both conditioned legs
accumulate to maxStacks on home/menu ticks; assembled stat readouts can display a combat band
(-5% FDR / x2.5 leech) while not in combat. Bounded by maxStacks:1, cleared by resetStacks() at
battle start, no combat effect outside battle. Documented fail-open contract (Skill.ts:127-128);
newly visible because flat legs are the first conditioned per_second passives whose stat is
displayed.

### F2-AUTH-PULLWRITE-WINDOW (Low) — SupabaseRemoteSave.ts:112-114, 102-105, 145-174
evidence SOURCE_PROOF. Expected: a pulled remote payload is either fully adopted or safely
re-pulled. Actual: pull writes resolveRevisionKey() before resolveSaveKey(); an exception
between the two localStorage writes leaves revision=N + stale payload; a later push then writes
the stale lineage to remote at N+1 — the pulled payload is gone. Reachable only via a storage
exception in the 2-setItem window plus client clock ahead of server (otherwise the
equal-revision remoteUpdatedMs>localLastSavedAt tie-break re-pulls and heals). Consistent with
the documented LWW/resync convention but the window exists.

### F3-AUTH-ACCUM-OUTOFBAND (Nit) — PassiveSystem.ts:268-292
evidence SOURCE_PROOF. On condition-fail only the sub-second fraction should be retained (per
comment "phan le accumulator giu nguyen"); perSecondAccumulator stores the full prior+delta
while the condition fails; re-entry dumps floor(elapsed) stacks at once — clamped by maxStacks
so capped talents see arm-on-entry (harmless today), but an uncapped conditioned per_second
modifier would dump the whole backlog. Pre-existing at base (unchanged lines); the new data
test pins maxStacks presence for current per_second talents only.

### F4-AUTH-ACCRUALID-TYPE (Nit) — BuildingInstance.ts:24
evidence SOURCE_PROOF. accrualRealmId is plain string; expected the realm-id brand used
elsewhere. Runtime membership enforced by saveAcceptance (getRealmIndex >= 0) — contract
looseness only.

### F5-AUTH-VERIFY-ARTIFACTS (Nit) — game/verify-fe17.mjs, game/verify-fixes.mjs
evidence SOURCE_PROOF. Cleanup wave removed dev artifacts yet two Playwright dev harnesses are
committed at repo root; hygiene noise only, not referenced by production code.

### F6-AUTH-EOF (Nit) — TuLinhTranBalance.ts:92
evidence SOURCE_PROOF. File ends without a trailing newline.

## attacksTried
- Channel substitution: percent->flat conversions verified against StatCalculator semantics
  (added += flat*stacks, pool += percent*stacks, percent on base-0 = silent no-op). All four
  conversions land on zero-base rate stats; leechPercent keeps percent deliberately (scales gear
  flat); authored x2.5 (flat 1.5 pct-pool, cap 1) lands exactly on clamp max 0.25. Pre-existing
  uncapped leech/FDR-percent ramps at base are removed by the cap-1 legs.
- Clamp widening: finalDamageReductionPercent min 0->-1 audited for every consumer — sole math
  consumer CombatSystem.ts:155 uses (1 - clamped) so negative = +damage taken as designed; all
  authored FDR values positive — no hidden negative surfaced.
- Band release authority: modifier.stacks = 0 mutates the SkillManager-owned object via
  getEffectiveSkill().passiveModifiers — the same array addStack uses (specialization override
  included); consistent with the file's documented ownership pattern and resetStacks() at
  battle start.
- Building pin: all 3 construction sites pin accrualRealmId (build(), App.vue starter, dev-grant;
  pinned by tests/architecture/buildingAccrualPin.test.ts). claim() resolves
  amount/rate/materialId under the pin BEFORE re-pinning to currentRealm; the fraction-leftover
  uses the pin's rate — no retro-repricing. `?? realmId` fallback only reachable for legacy
  saves. GameManagerBuildingOps pre-check validates the same pinned material id claim() emits.
- EM-02 algebra: snapshot rate ends with x(1+tuLinhPercent) so /(1+percentAtSave) un-buffs
  exactly; segment 0 always reproduces the saved rate; no-effect saves reduce to the old path
  identically. Hostile percent <= -1 -> non-finite per-segment rate -> calculateOfflineProgress
  clamps to 0 per segment; negative -> self-harm only (finite-negative grant subtracts own
  cultivation).
- Cloud CAS: guard = observed remoteRow.save_revision; pushRevision = max(local, remote+1)
  always strictly > remote -> matched-row detection via Prefer: return=representation sound;
  absent-row race -> strict POST -> real 409 -> 'unavailable'. Revision-primary ordering +
  same-revision timestamp tie-break convergent, matches LocalCloudSaveService CAS conventions;
  migration trigger forces updated_at := now() server-side (client value overridden).
- Nameplate authority: getActivePlayerName?.() ?? 'Player' via optional gate member in both
  scenes; snapshot reconcile writes domain-owned participant.entity.name = player.name — single
  authority, no hardcoded duplication.
- Armed/castClip chain: both slugs enumerated via resolveCharacterArtSlugs for bundle + preload
  + registration; playCastClip resolves skillId->slotRole->'attack' degrade; resume path carries
  identical declared.skillId/castSlotRole as the live emit; preview scene receives armed via
  assignments payload (TranPhapPanel.vue:268); PhaserCanvas watch covers cultivationWay +
  mortalBasicSkillId; ordering applies armed before profile swap everywhere.
- Realm nodes: destination-keyed re-map consistent with 1-based tiers + prepended mortal rung;
  comingSoon pinned to ReleasePolicy instead of index.
- Deletions: 144 deleted assets (images + 4 VFX atlases) — zero source references by basename or
  path.

## coverageNotes
- e2e spec combat-idle-motion-capture.spec.ts reviewed statically, not executed (needs dev
  server + browser harness).
- Migration 202609290001_*.sql verified statically — not applied to a live Supabase instance;
  CAS/return=representation behavior reasoned from the PostgREST contract.
- verify-*.mjs harnesses not executed.
- Live-combat cast-clip playback verified via unit tests + static emit/resume chain, not a live
  session.
- combat/* test-file diffs read for consistency; executed subset listed in verification.
- No conditioned event-triggered (non-per_second) passives exist in data, so the release gap
  for that family is untested by construction.

## terminalCheck
CLEAN — a fresh pass over the aggregate diff found no escaped Medium-or-higher actionable
defect. Authority story is coherent end-to-end: flat-channel fix removes dead values, band
release uses the owning system's own mutation pattern, realm pin enforced at every construction
site and validated at save acceptance, EM-02 re-derives through the one seconds->cultivation
authority, cloud CAS/revision lineage converges without a second ordering source, and the art
wave keeps presentation strictly on the report side of the gate.

independence: consumed no prior findings, audits, ledgers, or commit messages —
game/docs/qa/** and game/docs/ui-audit/** were not opened (the invoked
tutienidle-adversarial-qa skill's learned-defects ledger lives inside that banned path and was
deliberately not opened).
