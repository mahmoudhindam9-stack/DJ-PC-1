# DJ Desktop

Standalone Windows desktop edition of DJ.

## Windows-only build

This repository is packaged as a Windows desktop application using Tauri 2 + React + TypeScript + Vite.

**No Android build is part of this project or its CI.**

### Development

Prerequisites:
- Windows 10/11
- Node.js
- Rust toolchain
- WebView2

Run:

```powershell
npm install
npm run dev
```

Build the Windows installer:

```powershell
npm install
npm run build:windows
```

The Tauri installer is generated as an NSIS `*-setup.exe`.

## Distribution package

The Windows release pipeline creates a ZIP that contains exactly:

```
Install.exe
Uninstall.exe
```

### Install.exe
Installs DJ Desktop, creates Desktop and Start Menu shortcuts, launches the application after installation, and installs the standard Windows uninstaller.

### Uninstall.exe
Finds the installed DJ Desktop uninstaller and removes the application. The uninstall hooks also remove DJ Desktop application data and settings stored under its own application directories/registry keys.

User music files outside the DJ Desktop application data/directories are not deleted.

## Android

Android/Gradle files may remain in the source history from the original Remix, but they are not used by the Windows build or release pipeline.
