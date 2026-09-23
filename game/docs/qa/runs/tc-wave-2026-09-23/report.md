# QA run tc-wave-2026-09-23

- phase: DECIDE
- outcome: QA_BLOCKED_SCOPE
- state: product=6ddad859e4ef contract=efc7def8fcc3 attack=6b85d8b0a3af env=e3ca14a6b377
- base/head: origin/master -> b76cc97b24124ae35233958fbcd6384d0b652bb3

## Findings

- **F-W-0** Low/REAL_DEFECT — PROVEN — hiddenChannelCycles persisted but undeclared on ProductionSiteStateSave (journaled Round-A F-A-6)
- **F-W-1** Medium/TEST_DEFECT — PROVEN — SettingsPanel reset-save test stale after ConfirmModal→SysModalBase teleport rework
- **F-W-2** High/REAL_DEFECT — PROVEN — respec refunds 100% Insight but never claws back one-shot node grants (free Kiem-Y forging, free skill unlocks)
- **F-W-3** Medium/REAL_DEFECT — PROVEN — initiation ritual skips pourCultivationOvercharge — Hai Nap bank pours one realm late
- **F-W-4** Medium/REAL_DEFECT — PROVEN — settlementError drain bypasses the entitlement gate — stale pending record swallows the NEXT victory's entitlement
- **F-W-5** Medium/REAL_DEFECT — PROVEN — committed tribulation outcome + defeat cooldown never persisted — reload in the deferral window drops the finished run; mortals lose the quan_khi re-entry
- **F-W-6** Medium/TEST_DEFECT — PROVEN — harness runs tribulations equipped; production strips gear at admission (startTribulationPrepared)
- **F-W-7** Low/REAL_DEFECT — PROVEN — unseeded Math.random reaches persisted state at 4 wave sites
- **F-W-8** Low/REAL_DEFECT — PROVEN — startTribulation/TribulationDirector.start is fail-open — admission rows enforced only at composable/sim edges
- **F-W-9** Low/REAL_DEFECT — PROVEN — realm-passive grant markers persist apart from the modifier payloads — restore filter can orphan a passive permanently
- **F-W-10** Low/REAL_DEFECT — PROVEN — quest claim-drop filter lacks isDomainScopedAcquisitionEnabled — latent artifact-domain bypass
- **F-W-11** Low/REAL_DEFECT — PROVEN — Kiep Thuong defeat debuff unsaved — reload inside its 60s window erases the penalty
- **F-W-12** Low/REAL_DEFECT — PROVEN — StageWaveSystem bands mis-authored stages into the hidden-beast pool via requiredRealmId ?? 'qi_refining'
- **F-W-13** Nit/DOCUMENTATION_DEFECT — PROVEN — journey-spec doc misstates respec (25% tax = switchRoute) and save version (78 vs 81)
- **F-W-14** Nit/DOCUMENTATION_DEFECT — PROVEN — externalModifiers persists a re-derived channel; stale 'STATIC-ONLY' comment invites double-apply
- **F-W-15** Nit/REAL_DEFECT — PROVEN — tribulationBonusStacks is a write-only counter mirroring loi_kiep modifier sums
- **F-W-16** Nit/REAL_DEFECT — PROVEN — autoWorkerCapacity trusted from payload when no CHQ instance exists (crafted-save phantom workers)
- **F-W-17** Nit/REAL_DEFECT — PROVEN — formationLoadout.assignments lack uniqueness/bounds checks
- **F-W-18** Nit/REAL_DEFECT — PROVEN — truc_co_dan presence-checked but never consumed; 'consumes' comment wrong; dead inventory post-TC
- **F-W-19** Nit/REAL_DEFECT — PROVEN — hidden-beast counter counts idle auto-farm kills while substitution is ACTIVE-only (spec ambiguous)
- **F-W-20** Nit/TEST_DEFECT — PROVEN — harness onAdvance skips per-tick auto-investBodyChapter (boundary-only parity note)

## Coverage

- cells: 0 total; 

## Chronology

- cycle CYC-WAVE-1: FINDINGS; reviews REV-WAVE-A,REV-WAVE-B,REV-WAVE-C

## Convergence

- OK C1-identity: all final evidence binds the declared state
- UNMET C2-census-coverage: domain src/core uncovered; domain src/data uncovered; domain src/services uncovered; domain src/composables uncovered; domain src/components uncovered; domain docs/p7 uncovered
- UNMET C3-no-open: open F-W-0; open F-W-1; open F-W-2; open F-W-3; open F-W-4; open F-W-5; open F-W-6; open F-W-7; open F-W-8; open F-W-9; open F-W-10; open F-W-11; open F-W-12; open F-W-13; open F-W-14; open F-W-15; open F-W-16; open F-W-17; open F-W-18; open F-W-19; open F-W-20
- UNMET C4-final-gates: no final evidence recorded
- OK C5-sequential: sequential phase reviews present
- UNMET C6-clean-pair: Clean A missing/not CLEAN; Clean B missing/not CLEAN
- OK C7-mutation-corpus: mutation + corpus satisfied
- UNMET C8-terminal-check: no sealed independent TERMINAL_CHECK on the final state

## Validation failures

- MC12 F-W-0: actionable finding still PROVEN
- MC12 F-W-1: actionable finding still PROVEN
- MC12 F-W-2: actionable finding still PROVEN
- MC12 F-W-3: actionable finding still PROVEN
- MC12 F-W-4: actionable finding still PROVEN
- MC12 F-W-5: actionable finding still PROVEN
- MC12 F-W-6: actionable finding still PROVEN
- MC12 F-W-7: actionable finding still PROVEN
- MC12 F-W-8: actionable finding still PROVEN
- MC12 F-W-9: actionable finding still PROVEN
- MC12 F-W-10: actionable finding still PROVEN
- MC12 F-W-11: actionable finding still PROVEN
- MC12 F-W-12: actionable finding still PROVEN
- MC12 F-W-13: actionable finding still PROVEN
- MC12 F-W-14: actionable finding still PROVEN
- MC12 F-W-15: actionable finding still PROVEN
- MC12 F-W-16: actionable finding still PROVEN
- MC12 F-W-17: actionable finding still PROVEN
- MC12 F-W-18: actionable finding still PROVEN
- MC12 F-W-19: actionable finding still PROVEN
- MC12 F-W-20: actionable finding still PROVEN
