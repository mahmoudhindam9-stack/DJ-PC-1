# DJ Desktop

Lightweight Windows desktop application built with React, TypeScript, Vite, and Tauri 2.

## Windows distribution

The release ZIP contains exactly two files:

- Install.exe — installs DJ Desktop for the current Windows user, creates the Desktop and Start Menu shortcuts, then launches the application.
- Uninstall.exe — stops DJ Desktop and removes the installed application, application-specific configuration, WebView2 data, saved settings, library/playlists data, cache, and Desktop/Start Menu shortcuts.

The Tauri NSIS bundle is configured for current-user installation, so the normal installer does not require Administrator privileges. Tauri documents current-user NSIS as the default installation mode. citeturn659165search0turn659165search1

The Windows installer uses the WebView2 download bootstrapper rather than embedding a fixed WebView2 runtime, keeping the package smaller on PCs that already have WebView2. citeturn855709search8

## Local development

Prerequisites:
- Node.js 22+
- Rust stable
- NSIS

Install JavaScript dependencies without creating package-lock.json:

`npm install --no-package-lock`

Run the web UI:

`npm run dev`

Build the Windows installer:

`npm run tauri -- build --bundles nsis`

## CI release package

`.github/workflows/windows-release.yml` builds the x64 Windows NSIS installer, compiles the standalone `Uninstall.exe`, verifies that the distribution directory contains only `Install.exe` and `Uninstall.exe`, creates `DJ Desktop-vX.Y.Z-Windows.zip`, and publishes the ZIP as the GitHub Release asset.

