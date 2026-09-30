# Windows install / uninstall / reinstall — Closed Beta

> Scope: proposed certification baseline is **Windows 11 x64** (EXT-08 must
> confirm the final support matrix). Builds are **unsigned** until B4 (PR9)
> lands a signing method — SmartScreen/Defender may warn on the unsigned
> installer; that warning is expected evidence, not a defect.

## Identity

| Field | Value |
|---|---|
| appId | `com.fdlmg.tutienidle` |
| Product name | `Tien Hiep Idle` |
| Executable | `TienHiepIdle.exe` |
| Publisher (CompanyName / Apps & Features) | `fdlmg-tutienidle` |
| Installer artifact | `Tien Hiep Idle-<version>-Setup.exe` |
| Install type | Per-user, no admin rights (NSIS assisted installer) |
| Default install dir | `%LOCALAPPDATA%\Programs\Tien Hiep Idle` (user may change) |
| Local data dir (userData) | `%APPDATA%\Tien Hiep Idle` |

## Install

1. Run `Tien Hiep Idle-<version>-Setup.exe`.
2. Unsigned build: SmartScreen shows "Windows protected your PC" →
   **More info → Run anyway**. (Signed builds replace this with the real
   publisher check at PR9/PR15.)
3. Choose install directory (default `%LOCALAPPDATA%\Programs\Tien Hiep Idle`)
   and shortcut options (Start Menu + Desktop, both default on).
4. Finish — the app launches and writes local state under
   `%APPDATA%\Tien Hiep Idle`.

## Uninstall — local data is preserved by default

Apps & Features → `Tien Hiep Idle` → Uninstall (or the uninstaller in the
install dir).

The uninstaller **asks** whether to also delete local game data:

- **No (default, recommended):** `%APPDATA%\Tien Hiep Idle` is kept. Guest
  identity, save cache and settings survive; a later reinstall continues the
  same account.
- **Yes:** the uninstaller deletes `%APPDATA%\Tien Hiep Idle` permanently.
  **Deleting it forfeits guest access** — a guest identity that existed only
  on this PC cannot be recovered, and the next install starts as a brand-new
  guest. Choose Yes only when that is the intent.

Silent uninstall (`uninstaller.exe /S`) never deletes local data (the
default answer is No).

Equivalent manual deletion (same explicit local-data choice): close the app,
then delete `%APPDATA%\Tien Hiep Idle` yourself. Same warning applies.

## Reinstall

Reinstalling over a preserved `%APPDATA%\Tien Hiep Idle` restores the
existing guest identity, settings and save cache — no login step needed for
guest players. To reinstall *clean*, uninstall with the delete option (or
delete the directory manually) before installing again.

## Package contents contract

`game/build/package-manifest.json` is the allowlist contract for the shipped
payload; `node scripts/release/inspect-package.mjs --input release` (or
`npm run inspect:package`) refuses payloads containing source, test,
credential, dev-tool or log content, unlisted files, missing required
entries, or identity drift. The packaged app carries:

- `resources/app.asar` — `dist/` (renderer build), `dist-electron/` (main +
  preload bundles), `package.json`, `build/icon.ico`.
- `resources/app.asar.unpacked/build/icon.ico` — the real-file copy of the
  runtime icon the main process loads (`path.join(__dirname,
  '../build/icon.ico')`).
- Electron runtime (dll/pak/dat/locales/etc.) as produced by
  electron-builder.

## Known unsealed obligations

- **Clean-machine install/uninstall/reinstall proof** — not yet run on real
  Windows hardware (requires EXT-05). This document describes intended
  behavior verified against configuration and Linux dry-run payload
  inspection only.
- **Icon** — `build/icon.ico` is INTERIM art derived from an approved
  ink-wash asset pending the EXT-10 hand-drawn icon; see
  `build/asset-provenance.md`.
- **Signatures** — none until PR9/EXT-02; expected SmartScreen warning.
- **Publisher appearance** — `fdlmg-tutienidle` is asserted by the manifest
  contract and set via `author.name`/NSIS metadata; visual confirmation in
  Apps & Features requires the clean-Windows run above.
