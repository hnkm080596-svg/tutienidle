# Evidence bundle template

Every drill, rehearsal, canary-day, release decision and incident
produces one **evidence bundle** - an immutable record another operator
(or the coordinator) can audit later. Bundles are append-only: never
edit a file inside one; add a new bundle instead.

## 1. Bundle layout

```
<scenario>-<ref>-<UTC date>/                      e.g. restore-drill-stagingref-2026-09-30/
  manifest.json                                   (required)
  logs/                                           (command outputs verbatim)
    backend-status.json
    migration-ledger.txt
    save-inventory.txt
    <script>-<phase>.json|txt                     (before/during/after levers)
    pg-restore.stderr.log                          (restore drill only)
  decisions.md                                    (required for incidents)
```

`manifest.json`:

```json
{
  "schema": "beta-evidence/1",
  "scenario": "daily-canary | controls-rehearsal | backup-export | restore-drill | bad-release | incident-<n>",
  "targetRef": "<project ref>",
  "targetLabel": "staging|beta|restore|development|disposable",
  "startedUtc": "<ISO>",
  "finishedUtc": "<ISO>",
  "operator": "<name or handle>",
  "git": { "repo": "hnkm080596-svg/tutienidle", "sha": "<commit the operator ran>" },
  "files": { "logs/backend-status.json": "<sha256>", "...": "..." },
  "sealed": true,
  "notes": "..."
}
```

`sealed` is `true` only when every artifact was produced by a real run
against the named target - a bundle containing planned outputs stays
`sealed: false` and does not close the gate.

## 2. Storage + integrity

- Location: `EXTERNAL` (EXT-07) - the coordinator names the archive
  store and retention. Until then bundles stay on the producing
  operator's machine and are listed in the drill report.
- Integrity: every file in `logs/` gets a sha256 in `manifest.files`;
  the manifest itself is hashed when the bundle is archived.
- Bundles are never secrets stores. Contents must NOT include:
  credential values (keys, passwords, passphrases, JWTs), `pg_dump`
  files or any row payloads (`character_saves.payload`, auth tokens,
  diagnostic dumps containing tokens). `user_id`/`character_id`/
  session ids, row counts, grant booleans, class labels and command
  outputs of the ops scripts are all safe by construction.

## 3. Per-scenario checklist

### daily-canary
- `backend-status --json`, `migration-ledger`, `save-inventory`,
  `prune-jobs --dry-run` outputs; `decisions.md` only when something was
  wrong.

### controls-rehearsal
- `backend-status --json` before/during/after each lever change;
- the exact `backend-config.mjs` invocations (stdout) for each set +
  revert;
- `decisions.md` noting which levers were exercised.

### backup-export
- the export `manifest.json` produced by `backup-export.mjs` (NOT the
  dump); operator record of artifact destination + retention per
  `backup-restore.md` section 1.

### restore-drill
- export manifest; `sha256` of the decrypted dump matched to
  `dumpSha256`;
- full `pg_restore` stderr log with benign/blocking errors classified;
- `restore-verify --json --expect <manifest>` PASS output;
- wall-clock timings export-complete -> verify-pass (feeds RTO);
- `decisions.md` recording the restore path used (full restore vs
  per-table `--data-only`).

### bad-release
- freeze record (who/when/channel/version);
- Step-1 bundle outputs (status/ledger/inventory, `--details` on
  inventory);
- every `backend-config.mjs` lever change with outputs;
- `decisions.md`: the roll-forward-or-reinstall decision and why.

### incident-<n>
- the scenario card name from `incident-response.md`;
- the universal bundle captures before/after;
- every mutating command actually run;
- `decisions.md` with trigger time, abort/escalate calls made, and the
  recovery declaration.

## 4. Filing a bundle

1. Assemble under `<scenario>-<ref>-<UTC date>/`.
2. Write `manifest.json`, hash each `logs/` file into `files`.
3. `sealed: true` only if every artifact is a real run output.
4. Copy to the archive store (EXT-07) or keep locally pending it; link
   the bundle path in the related report/PR.
5. Never `rm` inside a sealed bundle - a correction is a new bundle
   that cites the old one.
