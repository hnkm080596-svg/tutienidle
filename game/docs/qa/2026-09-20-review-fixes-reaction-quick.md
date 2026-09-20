# QA — Review Fixes: Reaction Damage / Result-Gated Continuations / Cấm Công Clock / Profile Validation

- Date: 2026-09-20
- Mode: quick
- Scope: post-push review-fix diff on `feat/canonical-seals-ngo-dao-reaction` — `CombatSystemDamageAdapter`, `SkillResolver`/`SkillExecutor` `on_apply_result` gate, `tran_thuy` duration translation, `ReactionRegistry` damage-profile validation, and their tests.
- Verdict: **PASS WITH EVIDENCE** — every attack hypothesis resolved to a proof or a bounded design note; zero confirmed defects.

## Routing

`changed-risk-map.mjs` → domain `combat-and-tribulation`, one-hop consumers `combat presentation and controls` + `loot/progression/persistence`, `deepAuditCandidate: false`. Unmapped task-owned paths (docs, test files, skilldef plumbing) were manually routed by inspection — all are combat-pipeline or test-infra surfaces; nothing crosses save/cloud, time, or economy boundaries, so no deep escalation trigger fires.

## Invariant Ledger

| Hypothesis | Attack | Result |
|---|---|---|
| Reaction damage bypasses resistance again via a second caller | `applyReactionDamage` callers | PROVEN closed — the adapter is the sole caller; `CombatSystem.applyReactionDamage` receives the resolved amount only |
| `element:'attacker'` could emit 'physical'/undefined onto the flat lane | `ReactionOperations.ts:187` | PROVEN — emits `attacker.element satisfies ElementType` (always a canonical seal element); the elementless fallback is a documented dead lane for authored-miss defense |
| Reaction damage reads the wrong stat source | emission + adapter | PROVEN — ops never set `statSourceId`; adapter falls back to `origin.sourceId` (the seal caster), matching the dot lane's convention |
| Penetration/mitigation diverge from the shared formula | `resolveReactionAmount` vs `getResistanceMitigationPercent` | PROVEN — identical helper + cap/floor as the elemental/DoT lanes; negative net resistance amplifies ≤2× exactly like siblings |
| Resisted apply still mutates a stale instance | three executor tests | PROVEN — no-instance-resist, stale-instance-resist (byte-identical), and success-binds-returned-instanceId all asserted in `PhapTuRouteSkills.test.ts` |
| Gated step could bind a stale/colliding apply result | `applyOpIds` scoping + `lastOpResult` | PROVEN — operationIds are minted per-resolve (unique per cast); the gate key is `definitionId::resolvedTargetId` populated strictly before the gated op compiles in the same `onLanded` arm |
| A gated op could run when its apply never settled | executor result narrowing | PROVEN — requires `status:'resolved'` AND `type:'apply_buff'` AND `result.applied===true`; skipped/failed/absent results enqueue nothing |
| cam_cong duration still off-by-one | production `tran_thuy` drive | PROVEN — D3 → remaining 2 → exactly one declare suppressed; D4 → remaining 3 → exactly two; heal fallback legal throughout; expiry restores attack |
| `damageProfileExists` callback could throw via unbound `Map.has` | `DamageProfiles.ts` | PROVEN — catalog `has` is a plain closure over `PROFILES`, no `this` dependency |
| Malformed profile fails only at damage time | registry test | PROVEN — `reactoin` typo throws at `validateReactionDefinitions` during construction |

## Notes

- `resolveReactionAmount` resolves a missing source entity as power 0 (deterministic, mirrors the `legacy_dot` absent-source precedent) rather than skipping — recorded as Nit; reaction-source-death mid-settle cannot produce damage spikes.
- `gateOnApplyResult`'s `SkillResolverError` is unreachable in production (the marker is set only when the same def provably applies the seal earlier in the same `onLanded` arm) — fail-loud structural fault, correct by convention.

## Evidence Referenced

- `npm run verify`: type-check + build + 688 files / 5967 tests; single `eslintCoreSeverity` timeout is environmental (passes isolated in 1.5s — lint-probe cold start under full-suite parallelism).
- Focused: `CombatSystemDamageAdapter.test.ts` (resistance differential 150→90, metal-vs-fire channel selectivity, penetration offset), `PhapTuRouteSkills.test.ts` (3 result-gate acceptance cases), `GameManager.reactionReproof.test.ts` (production tran_thuy D3/D4 drives + doan_moc elemental differential), `ReactionRegistry.test.ts` (construction-time malformed-profile throw), `ReactionPayoff.khac.test.ts` (clamp(D-1,2,3) oracles).
