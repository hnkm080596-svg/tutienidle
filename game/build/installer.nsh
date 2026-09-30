; BETA-FINAL PR8 / spec B3 - opt-in local-data removal on uninstall.
; Runs inside the generated uninstaller section (electron-builder
; `nsis.include` hook). Default answer is NO: %APPDATA%\Tien Hiep Idle keeps
; the guest identity, save cache and settings so a reinstall picks up where
; the player left off. Answering YES deletes local data permanently - a
; guest identity that only existed on this machine cannot be recovered and
; the player starts over as a new guest. Silent uninstall (/S) takes the
; /SD default and preserves data.
!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
    "Also delete local game data?$\r$\n$\r$\nNo (recommended): keeps guest identity, saves and settings in %APPDATA%\Tien Hiep Idle for a future reinstall.$\r$\n$\r$\nYes: deletes them permanently. Guest access stored only on this PC cannot be recovered." \
    /SD IDNO IDYES tutienDeleteLocalData IDNO tutienKeepLocalData
  tutienDeleteLocalData:
    RMDir /r "$APPDATA\Tien Hiep Idle"
  tutienKeepLocalData:
!macroend
