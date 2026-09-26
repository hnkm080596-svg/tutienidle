# Coordinator gates — phap-tu beta scope

Head under review: working tree on devin/1790260800-phap-tu-basic (base be1bdf8d), 33 files changed.

## Executed gates

1. `npm run type-check` (vue-tsc --build) — exit 0, clean across the new
   skillIcon thread (TurnSkillDisplayMeta -> SkillIconManifest ->
   CombatSkillPresentation -> TurnCombatSkillBar -> CombatSkillSlot).
2. Scoped vitest — new + touched pins green:
   - PhapTuRealmRewardNodes.test.ts: 7/7 (rewardOnly seal, grant
     idempotency + no-downgrade, hidden-way L2 + no The, element gate,
     resolveMaxThe +10).
   - PhapTuBasicNodes.test.ts: 8/8 (+10%/direction cap, root+realm
     gates, mutex capstones, levelGates <= maxLevel).
   - PhapTuPath.way.test.ts / CultivationPathKit.test.ts /
     NodeInspector.test.ts / cultivationRitualFlow.integration.test.ts:
     updated pins green (stamp exemption, realmRewards records, realm
     name in locked reason, 8 resource modifiers incl. dormant
     masteries at element null).
   - GameManager.deadIds.test.ts: 5/5 after TECHNIQUE_CAP_ALLOWLIST
     extension (ruling #8 authored gates).
3. tests/architecture/asciiComments.test.ts — 1/1 after ASCII pass on
   all new comments (40 violations found and fixed, comment tokens only;
   Vietnamese data strings untouched by design).
4. Adversarial attack-model probes — all defended by authored pin
   tests above (ATK-REWARD-BYPASS -> canPurchase/canUpgrade seal;
   ATK-GRANT-IDEMPOTENT -> max-write; ATK-REALM-GATE -> foundation
   prereq + isRealmAvailable; ATK-ELEMENT-DORMANT -> isNodeElementActive;
   ATK-CAPSTONE-MUTEX -> excludesNode + authored spec ids;
   ATK-ICON-DEAD-PATH -> manifest keys backed by files on disk;
   ATK-VFX-UNKNOWN-PRESET -> union + preset map; ATK-WAY-LEAK ->
   requiredWay stamp pin; ATK-DESC-LIE -> van_moc_lan_doc description;
   ATK-LOCALE-DRIFT -> vi+en lockedReasons.realm).
5. Full `npm run verify` — in flight (vitest suite re-run after the two
   real fixes above; CombatScene*/dongFu/staticArt extent file-level
   failures are the known canvas/magick environment noise already
   present on master, not task failures).

## Honest labels

- ngoDaoReaction `doc_can` single-test miss observed once in the first
  full run, passes in isolation and alongside the new files; under
  watch on the re-run (deterministic seeded rng, no random excuse).
- NodeRenderer glyph layout is presentation-only; no runtime gate.

## Pipeline lesson (2026-09-25)

Sealed reviewers were dispatched BEFORE the branch was pushed —
children could not read the diff and reconstructed it from the
coordinator's event stream instead. Verdict downgraded: line-level
review only became possible after `git push`. Standing rule going
forward: **push the task branch before dispatching any child
reviewer** — an unpushed head makes the seal non-line-verifiable by
construction.

## Clean-A adjudication (head 1b4935ea, 2026-09-25)

All three sealed clean-A reviewers returned FINDINGS. Disposition:

| Finding | Severity | Disposition | Fix commit |
|---|---|---|---|
| stat() L1 dead payout (formula off-by-one) | High | fixed | 1b4935ea |
| respec revokes rewardOnly realm grants | High | fixed (both reviewers hit it) | 1b4935ea |
| van_moc_lan_doc lying description | Medium | fixed | 1b4935ea |
| element=null mastery leak | Low | fixed (aggregator gate split) | 1b4935ea |
| vfxPresetId dead plumbing | Medium | fixed (adapter maps to presetId + pin) | 1b4935ea |
| header skill-scoped overclaim | Medium | contract rewritten to spell-domain truth | 1b4935ea |
| weak/leaky test pins x3 | Medium | re-pinned to independent expectations | 1b4935ea + 54d90faf |
| dead imports x3 | Nit | fixed | 1b4935ea |
| save leniency note | Nit | REJECTED_WITH_PROOF (pre-existing) | - |

Deferred honestly: per-skillId stat scoping is an engine feature, not
beta scope (recorded in header contract + ledger finding F-CA-06).

Verification on fix head: scoped vitest 44/44 + isolation 5/5,
vue-tsc clean, eslint clean (evidence/fix-verify.log).

Clean-B: 3 sealed reviewers dispatched on 1b4935ea
(CORRECTNESS / AUTHORITY / INTEGRATION over the resulting state).
