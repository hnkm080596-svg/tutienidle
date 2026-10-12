# QA lesson routing repair

Scope authorized by user: select the effective published lesson revision. Baseline 597d4727e, worktree `C:/Users/hnkm0/.codex/worktrees/timeauthority-master-integration/tutienidle`, branch `codex/timeauthority-master-integration`. No gameplay, policy publication, dependency, or file removal.

## Responsibility and consumer census (G0-G5)

Owner: `prevention.mjs:routeLessons`. Production consumer: `cli.mjs:cmdPrepare` -> active immutable policy + append-only history -> routing -> construction brief -> preflight. The CLI now supplies the active policy already loaded for the brief identity. History remains evidence; it is not itself publication authority. Policy versions supersede older revisions; unpublished qualified revisions require discovery. Missing/unqualified selected guidance produces STALE. Qualified content cannot change under the same revision, while candidate qualification transitions and publication-only metadata updates remain legal.

Q1-Q12 proportional evidence: same owner and dependency direction retained; no product state/clock/async lifecycle changed; source hash freshness stays in the existing owner; routing is observational; only the real prepare consumer is migrated. Tests cover replacement, policy omission, stale pins, missing/nonqualified selected versions, unpublished candidates, conflicting qualified revisions and candidate-to-qualified transitions. Browser checks are not triggered by Node CLI routing.

## Verification and chronological review

- Original regression RED: stale historical v1 remained STALE when active policy selected fresh v2. GREEN after revision selection.
- Review regression RED: omitted policy lesson incorrectly APPLY. GREEN after active-policy guard. Conflicting qualified content also rejected.
- Type-check: exit 0; this change touches Node tooling only.
- Full QA tooling qualification: 61 passed, 0 failed, 1 designed nested-run skip; PROTOCOL_ADOPTION_QUALIFIED. Corpus remains 25 PENDING cases; this verdict qualifies tooling adoption, not this game release.
- Fresh independent Luna focused prevention + CLI run: 22/22 PASS after final fixes.
- OCR final preview: 4/4 files reviewed, 0 skipped, 100% coverage. Preserved untracked previous baseline/evidence folder explicitly excluded as outside this task. Applicable JS/MJS rules reviewed against all four files. No unresolved confirmed findings on final state.

Sequential Review Pass 1: source/caller and failure contracts; independent Luna found Medium active-policy omission and duplicate-content ambiguity. Both repaired; qualification rerun 61/0/1.

Sequential Review Pass 2: reviewed resulting state after Pass 1 fixes YES; fresh Luna turn verified actual four-file diff, policy ownership and failure guards. No actionable findings; focused 22/22 PASS.

Sequential Review Pass 3: reviewed resulting state after Pass 2 YES; coordinator checked prepare->brief->preflight integration and attacked stale selected revision, missing selection, future unpublished version, rollback omission, source drift and qualification history. No further confirmed defect. Same-context review is self-review, not a second independent clean round.

## Limits

No policy was requalified or published by this repair. The real active policy still selects L-022@1; its stale source pins must remain STALE until independently requalified and published. L-017/L-019 discovery obligations and the TimeAuthority accepted Medium restore/rebase finding remain separate. No QA_FIXED_POINT_REACHED or full game completion claim is made. Existing integration follows the user's High-only repair ruling and local merge authorization.
