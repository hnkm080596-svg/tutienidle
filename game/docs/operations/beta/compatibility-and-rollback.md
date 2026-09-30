# Beta compatibility & rollback (bad-release exercise)

How the beta survives a bad release. The release-channel mechanics
(update feed, promotion) belong to `docs/operations/release.md` (PR8);
this doc owns the **schema/data compatibility contract** that bounds
what a rollback may do, plus the exercise that proves it works.

## 1. Invariants

1. **No automatic downgrade.** Nothing auto-rolls the client back.
   "Rollback" is always an explicit decision: roll the release *forward*
   to a fixed build, or reinstall the previous known-good build.
2. **Server authority is monotonic.** `contractPhase` only moves
   forward (`legacy` -> `prepare` -> `cutover`); migrations only apply
   forward. There is no supported way to un-apply
   `202609300002_beta_authority_cutover.sql` - if a release needs a
   pre-cutover schema, that is a new-project event, not a rollback.
3. **The client rejects a future save schema before mutation.** In
   `SupabaseCloudSaveService.ts`, any load path that finds
   `payload.version` or `schema_version` != `CURRENT_SAVE_VERSION`
   returns `{status:'incompatible', foundVersion, raw}` - the raw bytes
   are preserved untouched and the user lands on the incompatible-save
   surface. The client never "downgrades" a v88 row by writing a v87
   payload over it. Server-side classes `incompatible-schema` /
   `version-mismatch` route to the same recoverable surface; other
   classes (`owner-mismatch`, `invalid-shape`, ...) land on `corrupted`
   with the raw preserved.
4. **`acceptedSaveSchemaVersions` is the only write gate.** The server
   accepts a save iff its `schema_version` is in the list. Rolling a
   client forward must never leave the server list behind - the check
   below exists to catch that.

## 2. Bad-release playbook

Trigger: a release is live and evidence shows it is bad (crashes,
protocol mismatch, save rejection spike, broken updater).

### Step 0 - declare + freeze the update feed

Stop the channel from serving the bad build to new devices. The exact
feed control is owned by `release.md` (PR8); until it exists, the freeze
is a coordination action recorded in the evidence bundle, not a flag in
this repo. Record: who froze, when (UTC), which channel/feed, what
version stopped being served.

### Step 1 - capture immutable evidence (before any fix attempt)

```sh
node scripts/operations/backend-status.mjs   --target <ref> --json
node scripts/operations/migration-ledger.mjs --target <ref>
node scripts/operations/save-inventory.mjs   --target <ref> --details
```

Archive all three outputs in the incident evidence bundle. These are
point-in-time artifacts - do not re-run to "refresh" them; append new
runs instead.

### Step 2 - schema compatibility check

Decide whether the bad release moved any contract:

- `migration-ledger` must equal `environments.md` section 3 - an
  `extra-in-target` row means someone applied schema outside the repo.
- `save_classes` must not show a growth in `incompatible-schema` or
  `version-mismatch` correlated with the release timestamp - that means
  the bad client wrote a schema the rest of the fleet cannot read, and
  the fix is client-side, not a save rewrite.
- `backend_config.acceptedSaveSchemaVersions` vs the release's
  `CURRENT_SAVE_VERSION` - a client at save v88 against a server list of
  `[87]` rejects every write; that is a **config ordering bug**, fixed by
  setting the list forward (a rehearsed lever, `health-and-quota.md`
  2c), never by rewriting saves.

### Step 3 - decide: roll-forward or reinstall

| path | when | action |
| --- | --- | --- |
| roll-forward | a fixed build exists, or the fix is config-only | publish the fix build on the feed; set `minClientVersion` to the fixed version so the bad build is locked out (`backend-config.mjs`) |
| reinstall | no fix build and the bad build corrupts local state | users reinstall the last known-good installer; old-build re-admission is controlled by the same `minClientVersion`/`supportedClientVersions` keys - a clean reinstall of the good build passes them |
| never | - | "downgrade migration", editing `character_saves` rows to an older `schema_version`, flipping `contractPhase` backwards |

If the bad build is still inside `supportedClientVersions`, tightening
that list is how it gets locked out - the exact same rehearsal as
`health-and-quota.md` 2b, this time for real.

### Step 4 - verify + lift

- `backend-status --json` after the decision: `minClientVersion` /
  `supportedClientVersions` / `acceptedSaveSchemaVersions` reflect the
  decision; `maintenance` cleared when done.
- `save-inventory` re-run: no new incompatible classes after unfreeze.
- Feed resumed only after the fixed/good build is confirmed serving.

## 3. The exercise (tabletop + live)

Two forms; both produce evidence bundles (`evidence-template.md`,
scenario `bad-release`).

**Tabletop (anyone, no credentials):** walk sections Step0-Step4 against
a fictional "0.1.0-beta.9 writes save v90" narrative; each participant
states which command/script answers each question. Pass = nobody
proposes an action the invariants forbid.

**Live (staging, UNSEALED until EXT-01):**

1. Release manager announces the mock bad build.
2. Operator records freeze timestamp (Step 0 simulation).
3. Run Step 1 commands; archive.
4. Simulate the v88-client problem: set
   `supportedClientVersions '["0.1.0-beta.0"]'` + `minClientVersion
   '"0.1.0-beta.0"'` via `backend-config.mjs`, confirm
   `get_backend_status()` shows the floor.
5. Simulate server-side rejection drift: verify
   `acceptedSaveSchemaVersions` still `[87]` and a write-path check -
   `save-inventory` classes unchanged.
6. Reverse the lever, record the bundle.

SEAL: `backend-status --json` before/during/after the lever change +
`save-inventory` outputs, archived as `bad-release` evidence. UNSEALED
until EXT-01.

## 4. Cross-checks a client build must satisfy

When a build is declared "known-good", these repo facts define good:

- `CURRENT_SAVE_VERSION` (build-time constant in
  `src/services/save/saveVersion.ts`) must be inside
  `acceptedSaveSchemaVersions` on the live server;
- `CLIENT_PROTOCOL_VERSION` must be inside `supportedProtocolVersions`;
- the build's reported version (`package.json` `version`, the
  build-identity PR1 surface) must be >= `minClientVersion` and inside
  `supportedClientVersions` when those keys are set;
- the client maps server codes to user surfaces per the taxonomy in
  `src/services/session/BackendStatus.ts` - a build that shows raw
  errors or silently retries through `SAVE_SCHEMA_UNSUPPORTED` is not
  good.
