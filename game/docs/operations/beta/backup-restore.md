# Beta backup & restore

The beta's save authority lives in one Supabase project. This doc covers
(1) producing an **encrypted authorized backup**, (2) the **restore
drill** that proves the backup is restorable into an isolated project,
and (3) the recovery posture for the live project, including RPO/RTO.

Principle: a backup that has never been restored is a rumor, not a
backup. The drill below is the only evidence that counts, and it stays
**UNSEALED** until EXT-01 + EXT-07 close (no credentials, no isolated
restore project, no artifact storage in this session).

## 1. What a beta backup is

`backup-export.mjs` produces a `pg_dump` custom-format archive plus a
manifest:

```
beta-backup-<ref>-<UTCstamp>.dump          (pg_dump -Fc, whole database)
beta-backup-<ref>-<UTCstamp>.dump.enc      (optional AES-256-CBC openssl)
beta-backup-<ref>-<UTCstamp>.manifest.json (tool, targetRef, targetLabel,
    createdAtUtc, pgDumpVersion, dumpSha256, encrypted, encryptedFile,
    encryptedSha256, rowCounts)
```

`rowCounts` covers: `auth.users`, `auth.identities`, `public.profiles`,
`public.account_sessions`, `public.characters`, `public.character_saves`,
`public.save_mutation_receipts`, `public.time_checkpoints`. Payload bytes
are counted, never logged.

### Policy

| item | value | state |
| --- | --- | --- |
| cadence | daily during beta (schedule EXTERNAL - EXT-07) | procedure ready |
| encryption | required for `staging`/`beta`/unlabeled targets; plaintext allowed only on `development`/`disposable` | enforced by the script |
| passphrase | file path in `BACKUP_PASSPHRASE_FILE`; the file never enters the repo or the evidence bundle | operator-held (EXT-07) |
| artifact storage | `EXTERNAL` (EXT-07): where archives+manifests are stored, retention period, who holds the passphrase backup | unfilled on purpose |
| Supabase managed backups/PITR | `EXTERNAL` (EXT-07): plan-dependent; recorded in `environments.md` once known | unfilled on purpose |

A dump contains personal data (auth identities, profiles). It is a
secret-class artifact: never commit it, never attach it to tickets,
never put it in the evidence bundle - only the manifest belongs there.

## 2. Export procedure

```sh
# preflight only - binaries, out dir, passphrase file, target validation
node scripts/operations/backup-export.mjs --target <ref> --out <dir> --dry-run

# real export (mutating/artifact-writing => --yes-i-mean-it on non-dev targets)
BACKUP_PASSPHRASE_FILE=<path> \
node scripts/operations/backup-export.mjs --target <ref> --out <dir> --yes-i-mean-it
```

`--no-encrypt` exists but the script refuses it unless the target label
is `development` or `disposable`.

Verify the artifact before archiving: manifest sha256 fields match
`sha256sum` of the files on disk; `rowCounts` is non-degenerate
(auth.users > 0 on a project that has users).

SEAL: run the real export against staging, archive the manifest (not the
dump) as `backup-export` evidence.

## 3. Restore drill (the acceptance procedure)

Goal: prove the encrypted backup restores into the isolated `restore`
project such that **Auth identities, profiles, characters, save rows with
revisions and receipt linkage, the grant surface, and migration
compatibility** all verify - not just row counts.

### 3.1 Prerequisites

- isolated project labeled `restore` (never reuse a project that has
  users);
- the dump + manifest + passphrase file on the operator machine;
- env file for the restore project (`SUPABASE_URL`,
  `SUPABASE_DB_URL`, `SUPABASE_TARGET_LABEL=restore`);
- the migrations from `environments.md` section 3 already applied on the
  restore project (contract runner handles this:
  `npm run test:supabase` with the restore env, or `supabase migration`
  tooling - the drill records which path was used);
- two terminals / one second operator for cross-checks.

### 3.2 Procedure

1. **Decrypt to a scratch file** (operator machine):
   `openssl enc -d -aes-256-cbc -pbkdf2 -pass file:$BACKUP_PASSPHRASE_FILE -in <dump>.enc -out /tmp/restore.dmp`
   (skip if plaintext export from a dev label).
2. **Confirm identity**: `sha256sum /tmp/restore.dmp` equals
   `manifest.dumpSha256`.
3. **Restore data into the restore project.** Custom-format restore,
   no ownership/privilege replay (platform roles differ across projects):
   `pg_restore --no-owner --no-privileges -d "$SUPABASE_DB_URL" /tmp/restore.dmp`
   Expected: platform-owned objects (`auth` triggers, storage internals,
   extension objects) may report errors; data tables must load. The first
   drill records the exact error set that is benign vs blocking -
   **UNSEALED** until a real run classifies it. If `pg_restore` cannot
   reach `auth.users`/`auth.identities` as the `postgres` role, the
   fallback is a per-table `--data-only -t` restore list; record which
   path the drill used.
4. **Freeze writes during verification** - the restore project should be
   quiet anyway; belt-and-braces:
   `node scripts/operations/backend-config.mjs --target <restore-ref> set maintenance '{"enabled":true,"message":"restore drill"}' --yes-i-mean-it`
5. **Run the acceptance probe:**
   `node scripts/operations/restore-verify.mjs --target <restore-ref> --expect <manifest>.json`
   Exit 0 = PASS. Any `[FAIL]` line is a blocking finding.

### 3.3 What restore-verify actually proves

- `contractPhase` reads `cutover` (the restored `backend_config`, not a
  fresh seed);
- counts of `auth.users`, `auth.identities`, `profiles`,
  `account_sessions`, `activeSessions`, `characters`, `character_saves`,
  `save_mutation_receipts`, `time_checkpoints` - equal to
  `manifest.rowCounts` when `--expect` is passed;
- **integrity, zero expected**: save owner == character owner, all
  payloads are objects, `payload.version == schema_version`, no
  null/negative `save_revision`, no receipts pointing at missing
  characters, no `last_mutation_id` without its receipt, no character
  without a profile, no auth user without an identity;
- **grant surface**: every public RPC executable by `authenticated`,
  `anon` denied `get_backend_status`, no internal helper exposed, no
  table privileges on `character_saves`/`backend_config`;
- **migration compatibility**: applied `supabase_migrations` versions are
  exactly the repo migration files (no missing, no extra);
- the owner composite FK `character_saves_owner_is_character_owner`
  exists and is validated.

### 3.4 Abort / escalate

Abort and escalate (do not "fix" the dump) when:

- counts mismatch the manifest;
- any integrity check is non-zero - the backup itself is corrupt or the
  export tool dropped rows;
- the ledger shows `extra-in-target` versions - the restore project was
  not clean;
- grants are open (`saves_open`, helpers exposed) - the cutover
  migration was not applied post-restore.

Record the drill in an evidence bundle (`evidence-template.md`,
scenario `restore-drill`): manifest, `restore-verify --json` output,
pg_restore stderr log, classification of benign errors, wall-clock times
from export-complete to verify-pass (this feeds RTO below).

SEAL: `restore-verify` PASS output + manifest + pg_restore log archived.
Until then the drill is **UNSEALED**.

## 4. Live-project recovery posture (freeze/revoke)

If the live project is suspect (corruption, leaked credential, bad
migration), the freeze order is:

```sh
# 1. stop new claims
node scripts/operations/backend-config.mjs --target <ref> set maintenance '{"enabled":true,"message":"under maintenance"}' --yes-i-mean-it
# 2. revoke every live session - forces re-claim after unfreeze
node scripts/operations/revoke-sessions.mjs --target <ref> --all --dry-run   # count first
node scripts/operations/revoke-sessions.mjs --target <ref> --all --yes-i-mean-it
# 3. export before touching anything else
node scripts/operations/backup-export.mjs --target <ref> --out <dir> --yes-i-mean-it
```

Only then decide repair-in-place vs restore-to-new-project; the decision
belongs to the incident commander (`incident-response.md`), not this
doc.

## 5. RPO / RTO

| metric | value | state |
| --- | --- | --- |
| RPO (data loss window) | <= 24h under daily export cadence; better if EXT-07 confirms plan PITR | `UNSEALED` pending EXT-07 + first export run |
| RTO (time to verified restore) | measured by the first successful drill (export-complete to `restore-verify` PASS); target <= 4h | `UNSEALED` - must be measured, never estimated |
| session impact on recovery | all sessions revoked; players re-auth on next launch | documented behavior |
| save compatibility on recovery | restore-verify proves `acceptedSaveSchemaVersions` still covers restored rows; the client-side reject rule is in `compatibility-and-rollback.md` | scripted |
