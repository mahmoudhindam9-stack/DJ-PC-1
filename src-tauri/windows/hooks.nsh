; DJ Desktop NSIS installation hooks
; Tauri invokes these macros from the generated NSIS installer.

!macro NSIS_HOOK_POSTINSTALL
  CreateShortCut "$DESKTOP\DJ Desktop.lnk" "$INSTDIR\dj-desktop.exe"
  CreateDirectory "$SMPROGRAMS\DJ Desktop"
  CreateShortCut "$SMPROGRAMS\DJ Desktop\DJ Desktop.lnk" "$INSTDIR\dj-desktop.exe"
  Exec '"$INSTDIR\dj-desktop.exe"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM dj-desktop.exe'
  Delete "$DESKTOP\DJ Desktop.lnk"
  Delete "$SMPROGRAMS\DJ Desktop\DJ Desktop.lnk"
  RMDir "$SMPROGRAMS\DJ Desktop"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  RMDir /r "$APPDATA\com.djdesktop.app"
  RMDir /r "$LOCALAPPDATA\com.djdesktop.app"
  RMDir /r "$APPDATA\DJ Desktop"
  RMDir /r "$LOCALAPPDATA\DJ Desktop"
  RMDir /r "$LOCALAPPDATA\Programs\DJ Desktop"
  DeleteRegKey HKCU "Software\com.djdesktop.app"
  DeleteRegKey HKCU "Software\DJ Desktop"
!macroend
