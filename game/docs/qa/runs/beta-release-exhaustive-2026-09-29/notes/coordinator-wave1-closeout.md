# Wave-1 closeout — coordinator note (beta-release-exhaustive-2026-09-29)

State at closeout: S1 product=8c280581a5cd (merged beta-repair-carried @1d83cf46).
All three wave-1 blind audits ran on S0 = f1049b5e42757f14aebee18bab3569dc43c37d09 (auditors' own clones, SHA-reported).

## Verdicts
- ASG-BX-SAV (save/restore/cloud/offline, devin-caa5f312): 11 findings — 1 High, 4 Medium, 5 Low, 1 Info. Report: evidence/wave1-save-audit.md. 37 executable repros (green on auditor VM).
- ASG-BX-CBT (combat/skills/buffs/stats, devin-8ff83640): 10 findings — 1 Medium, 5 Low, 4 Nit. Report: evidence/wave1-combat-audit.md.
- ASG-BX-PRG (progression/realm/tribulation/technique/nodes/quests, devin-37285e3f): 2 findings — 1 Medium, 1 Low; extensive nothing-found coverage. Report: evidence/wave1-progression-audit.md.

## Recorded as F-BX-30..F-BX-52 (23 findings)
High/Medium needing repair adjudication:
- F-BX-30 High — offline cultivation priced off one-tick-stale `cultivationPerSecond` snapshot (buff activate/expire inside [tick→save] gap corrupts whole window both directions). Sibling of closed F-BX-04 (EM-02 segmentation fixed mid-window expiry, NOT snapshot staleness).
- F-BX-31 Medium — same-revision remote fork resolved by wall-clock, no backup on pull. Sibling of repaired F-BX-01 — likely covered by dd91b8d6 sync-base gate; RE-VERIFY on S1 before new repair.
- F-BX-32 Medium — two-tab LWW ping-pong whole-payload clobber.
- F-BX-33 Medium — first-push insert race: merge-duplicates upserts (comment claims throws); no CAS on insert branch.
- F-BX-34 Medium — `importSaveRaw` never bumps revision → next-login pull destroys imported save.
- F-BX-41 Medium — reciprocity cap voids PAID committed reactive follow-ups (costs kept, counter dropped at depth≥4).
- F-BX-51 Medium — `TribulationDirector.start()` clobbers pending committedOutcome (victory/defeat consequences lost).

Low/Nit: F-BX-35..40 (save), F-BX-42..50 (combat), F-BX-52 (progression).

## Open carried set after repair closes
Closed by S1 repair merge: F-BX-01,04,05,06,07,08,09,11 (+10/12 rejected with proof).
Still open from wave-0: F-BX-16..29 cohort — icons/art gaps pending user art drops (F-BX-16 truc_co_dan icon, F-BX-19 placeholder icons, etc. classify as HUMAN_EXCEPTION when art lands), reset-save resurrection (F-BX-24 High — needs tombstone/lineage decision), plus assorted Medium/Low.

## Next
- Repair wave-2 (dispatched): Medium+ set + selected Lows; re-verify F-BX-31..34 against S1 first (sync-base repair may already cover fork ordering).
- Wave-2 blind audits: economy/inventory/equipment/offline, quests/companions/formation/stages, ui/i18n/a11y/phaser/audio; auth-electron seams queued (4-child slot cap).
- Per 59-section brief: playthrough matrix, cross-system attacks, clean A + novel synthesis + clean B, terminal decide — outstanding.
