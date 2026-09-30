# Build asset provenance — `game/build/`

Assets in this directory are packaging inputs for electron-builder
(`electron-builder.yml`). Every file must trace to an approved source.

## `icon.ico` — INTERIM pending EXT-10

- **Status:** INTERIM. The user's hand-drawn product icon is still pending
  (external input EXT-10). Replace this file's contents when that art lands;
  do not change the filename or the load path.
- **Source:** `art-source/ui/ink-wash/approved/seal-cinnabar-small.png`
  (1254x1254 RGBA, approved ink-wash asset — the cinnabar seal used across
  the game's UI chrome; same asset ships in `public/assets/ui/ink-wash/
  overlays/seal-cinnabar-small.png`).
- **Derivation:** alpha bounding box trimmed, letterboxed to square, LANCZOS
  resampled to 16/24/32/48/64/128/256 px, PNG-encoded into one `.ico`
  container (7 entries). Regenerate:
  `python3` + Pillow, or equivalent image tooling — sizes must stay a
  superset of {16, 32, 48, 256} for NSIS/taskbar/Explorer coverage.
- **License:** project-internal art, same license path as the rest of
  `art-source/ui/ink-wash/approved/`.
- **Consumers:**
  - `electron-builder.yml` `win.icon`, `nsis.installerIcon`,
    `nsis.uninstallerIcon` — builder input for exe/installer icon metadata.
  - Packaged payload `resources/app.asar/build/icon.ico` (via `files:` +
    `asarUnpack`) — the path `electron/main.ts` loads for the runtime window
    icon: `path.join(__dirname, '../build/icon.ico')`.

## `installer.nsh`

- **Status:** final (unsigned-build safe).
- **Purpose:** NSIS hook added via `nsis.include`. `customUnInstall` gives
  the uninstaller an explicit YES/NO choice about deleting
  `%APPDATA%\Tien Hiep Idle`; default is keep. See
  `docs/operations/beta/windows-install.md` for the contract.

## `package-manifest.json`

- **Status:** final contract.
- **Purpose:** allowlisted packaged payload for
  `scripts/release/inspect-package.mjs`. Enumerates identity
  (`appId` `com.fdlmg.tutienidle`, product `Tien Hiep Idle`, executable
  `TienHiepIdle.exe`, publisher `fdlmg-tutienidle`, installer artifact
  pattern), the files allowed inside the unpacked app dir and inside
  `resources/app.asar`, and deny patterns for source/test/credential/
  dev-tool/log content.

## Publisher identity (EXT-10)

- `publisher` / `CompanyName` metadata value: **`fdlmg-tutienidle`** —
  the approved EXT-10 publisher value. In the build it comes from
  `package.json` `author.name`; `copyright` in `electron-builder.yml` uses
  the same owner string. Do not invent alternates.

## Pending external inputs

- **EXT-10 product art:** replaces `icon.ico` contents (keep the filename).
- **EXT-02 signing service:** installer/exe signatures are NOT produced by
  this configuration; see the PR9 scope in the implementation plan.
- **EXT-08 support matrix:** the doc claims Windows 11 x64 as the proposed
  baseline until EXT-08 confirms.
