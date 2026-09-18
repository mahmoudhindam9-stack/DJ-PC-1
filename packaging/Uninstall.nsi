Unicode true
RequestExecutionLevel user

Name "DJ Desktop Uninstaller"
OutFile "Uninstall.exe"
SilentInstall silent
AutoCloseWindow true
ShowInstDetails nevershow
BrandingText "DJ Desktop"

Section
  SetShellVarContext current

  MessageBox MB_YESNO|MB_ICONQUESTION "This will remove DJ Desktop and all of its saved settings, library data, playlists, cache, and shortcuts from this Windows user. Continue?" IDYES continue
  Abort

continue:
  nsExec::ExecToLog '"$SYSDIR\\taskkill.exe" /F /T /IM dj-desktop.exe'
  Pop $0
  nsExec::ExecToLog '"$SYSDIR\\taskkill.exe" /F /T /IM "DJ Desktop.exe"'
  Pop $1

  ; Installed application directories
  RMDir /r "$LOCALAPPDATA\\DJ Desktop"
  RMDir /r "$LOCALAPPDATA\\Programs\\DJ Desktop"
  RMDir /r "$LOCALAPPDATA\\dj-desktop"
  RMDir /r "$LOCALAPPDATA\\Programs\\dj-desktop"

  ; Tauri app data and WebView2 profile data for identifier com.djdesktop.app
  RMDir /r "$APPDATA\\com.djdesktop.app"
  RMDir /r "$LOCALAPPDATA\\com.djdesktop.app"
  RMDir /r "$APPDATA\\DJ Desktop"
  RMDir /r "$LOCALAPPDATA\\DJ Desktop"

  ; User shortcuts
  Delete "$DESKTOP\\DJ Desktop.lnk"
  Delete "$APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\DJ Desktop.lnk"
  RMDir /r "$APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\DJ Desktop"

  ; Application-specific registry remnants
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\com.djdesktop.app"
  DeleteRegKey HKCU "Software\\DJ Desktop"

  MessageBox MB_OK|MB_ICONINFORMATION "DJ Desktop and its saved data have been removed."
SectionEnd
