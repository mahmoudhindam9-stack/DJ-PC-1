!macro NSIS_HOOK_POSTINSTALL
  CreateDirectory "$SMPROGRAMS\\DJ Desktop"
  CreateShortCut "$DESKTOP\\DJ Desktop.lnk" "$INSTDIR\\dj-desktop.exe"
  CreateShortCut "$SMPROGRAMS\\DJ Desktop\\DJ Desktop.lnk" "$INSTDIR\\dj-desktop.exe"
  Exec '"$INSTDIR\\dj-desktop.exe"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ExecWait '"$SYSDIR\\taskkill.exe" /F /T /IM dj-desktop.exe' $0
  ExecWait '"$SYSDIR\\taskkill.exe" /F /T /IM "DJ Desktop.exe"' $1

  RMDir /r "$APPDATA\\com.djdesktop.app"
  RMDir /r "$LOCALAPPDATA\\com.djdesktop.app"
  RMDir /r "$APPDATA\\DJ Desktop"
  RMDir /r "$LOCALAPPDATA\\DJ Desktop"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$DESKTOP\\DJ Desktop.lnk"
  Delete "$APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\DJ Desktop.lnk"
  RMDir /r "$APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\DJ Desktop"
!macroend
