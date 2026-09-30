# Beta incident response (tabletop runbook)

Scenario cards for the failures the beta must survive. Every card uses
the same shape so an unfamiliar operator can run it:

- **Trigger** - what tells you this scenario is live
- **Prereq** - access/tools needed before acting
- **Act** - ordered steps with the exact command
- **Observe** - what success looks like (and the command that proves it)
- **Abort** - stop conditions; stop means "escalate, don't improvise"
- **Escalate** - who owns the next decision (`EXTERNAL` owners are
  unfilled coordinator work - see `environments.md` section 7)
- **Recover** - how normal state is declared again + the evidence bundle
  required

Universal first move for every scenario: capture the point-in-time
bundle before touching anything -

```sh
node scripts/operations/backend-status.mjs   --target <ref> --json
node scripts/operations/migration-ledger.mjs --target <ref>
node scripts/operations/save-inventory.mjs   --target <ref>
```

## Scenario 1 - failed / partial migration

**Trigger:** a migration apply errors mid-run; `migration-ledger` shows a
`pending` entry or `extra-in-target`; `backend-status` shows
`contractPhase` != expected for the release stage.

**Prereq:** `SUPABASE_DB_URL`, the migration file, the apply log.

**Act:**
1. Capture the bundle (above).
2. `node scripts/operations/migration-ledger.mjs --target <ref>` - which
   versions are applied vs pending.
3. Read the failed migration's transaction boundary: each repo migration
   applies in its own transaction, so a failure is all-or-nothing per
   file - confirm with `beta_contract_phase()` and the ledger whether
   the file is fully in or fully out.
4. If fully out: fix the SQL issue forward (new migration or corrected
   apply), re-apply in order. If partially in (only possible if the
   apply path bypassed transactions): stop - Abort.
5. After repair: `npm run test:supabase` (contract runner is idempotent;
   applies only un-ledgered migrations) or direct apply, then re-run the
   ledger probe.

**Observe:** `migration-ledger` lists all repo files `applied`, zero
`extra-in-target`; `backend-status` `contractPhase` matches the stage;
canary all-green.

**Abort:** ledger shows applied rows that do not match repo files,
`contractPhase` is `cutover` while a prepare piece failed, or any table
privilege probe shows grants reopened. Partial-applied = page the
backend owner, do not patch rows by hand.

**Escalate:** `EXTERNAL` backend owner (EXT-01); for a mid-release
migration failure also the release manager (`release.md` owner).

**Recover:** canary green for two consecutive days; evidence bundle
contains apply log + ledger diffs + post-repair `backend-status`.

## Scenario 2 - quota exhaustion (db size / connections / egress)

**Trigger:** Supabase dashboard quota warning (EXT-01 alerting still
manual), or writes failing with resource errors; `pg_database_size` near
the (to-be-sealed) plan ceiling.

**Prereq:** dashboard access or `SUPABASE_DB_URL` for the size reads.

**Act:**
1. Bundle capture.
2. Size read:
   `select pg_size_pretty(pg_database_size(oid)) from pg_database where datname = current_database();`
   plus `select count(*) from pg_stat_activity where datname = current_database();`
3. Biggest recoverable growth is usually `save_mutation_receipts` +
   `time_checkpoints` - run the prunes:
   `node scripts/operations/prune-jobs.mjs --target <ref> --dry-run`
   then for real `--yes-i-mean-it`.
4. If connections are the limit: `revoke-sessions --all` frees client
   leases but not pool connections - the honest lever is `maintenance`
   on (stops new claims) while the pooler drains:
   `node scripts/operations/backend-config.mjs --target <ref> set maintenance '{"enabled":true,"message":"capacity"}' --yes-i-mean-it`

**Observe:** size/connections below the recorded ceiling; canary green;
writes succeeding.

**Abort:** size still climbing after prune (growth is payload, not
receipts) - do not delete `character_saves`; that is data loss, escalate.

**Escalate:** `EXTERNAL` backend owner for plan upgrade (EXT-01);
EXT-07 owner if retention policy needs changing.

**Recover:** `maintenance` off after the ceiling is safe; evidence bundle
with before/after size + prune output + the new ceiling value recorded
back into `environments.md` section 5.

## Scenario 3 - leaked credential (anon key is NOT this scenario)

**Trigger:** `SUPABASE_DB_URL` password, a service-role key, or a backup
passphrase/dump appears in a repo, log, artifact, or third-party paste.
The shipped `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY` is public by
design - a leak report about it alone is not an incident.

**Prereq:** ability to rotate the credential at the provider
(`EXTERNAL`, EXT-01/EXT-09).

**Act:**
1. Bundle capture (proves current surface before lockdown).
2. Freeze writes:
   `node scripts/operations/backend-config.mjs --target <ref> set maintenance '{"enabled":true,"message":"security"}' --yes-i-mean-it`
   `node scripts/operations/revoke-sessions.mjs --target <ref> --all --yes-i-mean-it`
3. Rotate the leaked credential at the provider; update
   `.env.supabase.contract` / CI secrets.
4. Audit window: what did the leaked value permit? `SUPABASE_DB_URL` =
   full DDL+DML - check `migration-ledger` for `extra-in-target` and
   `save_classes` for unexpected drift; a dump passphrase leak = treat
   all stored archives as disclosed.
5. Fresh authorized backup AFTER rotation:
   `node scripts/operations/backup-export.mjs --target <ref> --out <dir> --yes-i-mean-it`

**Observe:** new credential works (canary green), old credential fails
auth; no unexplained ledger/save-class drift.

**Abort:** evidence of writes under the leaked credential
(`extra-in-target` migrations, `owner-mismatch` growth, sessions for
unknown users). That is a data-integrity incident - escalate to decide
restore-from-backup vs repair.

**Escalate:** `EXTERNAL` backend owner + whoever owns the leaked surface;
data-exposure assessment is a coordinator call, not an operator call.

**Recover:** unfreeze (`maintenance` off) after rotation verified;
evidence bundle with rotation confirmation + audit outputs + new
export manifest.

## Scenario 4 - TLS/cert expiry (client-side connectivity)

**Trigger:** clients fail with `NETWORK_UNAVAILABLE`/`CONFIGURATION_ERROR`
at `get_backend_status` time while the project is healthy; TLS errors in
client diagnostics; provider notices about cert rotation.

**Prereq:** healthy staging project to compare; a way to read the
client's diagnostic surface (PR12's diagnostics reporter).

**Act:**
1. Server-side first - prove the backend is fine:
   `node scripts/operations/backend-status.mjs --target <ref>`
   + `curl -sv https://<ref>.supabase.co/rest/v1/ 2>&1 | grep -i 'cert\|tls\|expir'`
   (records the presented chain + dates in the bundle).
2. If the chain is platform-managed (supabase.co) and valid: the failure
   is client- or network-side (corporate TLS interception, stale CA on
   the device, blocked egress). Classify by asking one affected user for
   the diagnostic output; check whether failures cluster by network.
3. If the cert is genuinely expired platform-side: this is a provider
   incident - open the provider ticket and freeze claims only if clients
   are writing through a broken trust path.

**Observe:** TLS chain valid; `NETWORK_UNAVAILABLE` rate back to
baseline; client diagnostics show reachability.

**Abort:** cannot get any client diagnostic output within the incident
window - classify as untriaged connectivity, not cert.

**Escalate:** provider ticket via `EXTERNAL` backend owner; client-side
fleet issue to the release manager.

**Recover:** canary + one real client session green; bundle with the
cert chain dump + reachability evidence + diagnostic excerpts (no
payloads, no tokens).

## Scenario 5 - broken updater (release applied, clients can't update)

**Trigger:** support reports of update loops/failed installs after a
release; `get_backend_status` shows a version distribution pinned below
the release's `minClientVersion`.

**Prereq:** release channel state (PR8 `release.md`), a way to see
client versions (`backend-status` + support reports until telemetry
exists).

**Act:**
1. Declare + freeze the feed per
   `compatibility-and-rollback.md` Step 0.
2. Bundle capture.
3. Decide roll-forward-or-reinstall per the compat doc's decision table.
   The updater bug itself is fixed in a NEW build - never by shipping a
   "downgrade" build, per invariant 1.
4. If the pinned-old clients are already locked out by
   `minClientVersion`, the safe path is reinstall - make the last
   known-good installer the documented recovery and set
   `supportedClientVersions` to admit it.

**Observe:** version distribution recovers to the good build;
`save_classes` shows no incompatible-class growth (updater failures
must not become save-compat failures).

**Abort:** good-build reinstall path itself fails on a test device
(EXT-05 clean Windows box) - stop, the whole distribution path is the
incident.

**Escalate:** release manager (PR8 owner); if the bug is in the signed
installer, the signing owner (EXT-02).

**Recover:** feed resumed with the fix build; bundle with freeze times +
status outputs + the reinstall-verification result.

## Scenario 6 - feedback / diagnostic triage (support intake)

**Trigger:** beta feedback lands (Discord/tracker/email): "lost my save",
"can't log in", "game won't start".

**Prereq:** the reporter's `user_id`/device label if they can supply it;
the diagnostic surface from the client (PR12).

**Act:**
1. Classify before touching data: account (can't claim), save
   (load fails / incompatible), client (crash/network), or meta
   (translation/balance).
2. Account: `revoke-sessions --user <uuid> --dry-run` to see their live
   sessions; a stuck session is fixed by the real revoke - the client
   then re-claims cleanly.
3. Save: `save-inventory --target <ref> --details` - find their
   character row's class. `ready`/`empty-payload` = client-loadable or
   recoverable by write at current revision; `owner-mismatch` = manual
   repair only (`backend-cutover.md` inventory triage); anything else =
   recoverable at current revision.
4. Client: version check against `minClientVersion`/
   `supportedClientVersions`; network check per scenario 4.
5. Record the outcome in the bundle (user_id is allowed in evidence;
   payloads, tokens and dumps are not).

**Observe:** the user's next session proceeds; their save class is
`ready` post-recovery-write; no other users share the failure signature
(a cluster = real incident, not triage).

**Abort:** the same signature appears for >1 user or any `owner-mismatch`
repair is requested - escalate, never repair ownership by hand outside
a reviewed procedure.

**Escalate:** save-corruption class to `EXTERNAL` backend owner; product
questions to the coordinator.

**Recover:** ticket closed with the evidence bundle linked; the failure
signature added to this doc when it is novel.

## Tabletop qualification

An operator is qualified when they can run scenarios 1, 2 and 6
end-to-end on the `staging` label without the doc author present, and
can name the abort conditions of 3 and 5 from memory. First live
exercise: **UNSEALED** until EXT-01 (needs the staging project).
