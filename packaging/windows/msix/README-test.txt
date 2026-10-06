PlayPets MSIX test package
==========================

This package is signed with a test certificate. It is not the package for the Store; it is for
checking that the app works when it is installed as a package.

Install (in an administrator PowerShell, from this folder)

  1. Make this PC trust the test certificate (once)
       Import-Certificate -FilePath .\PlayPets-test.cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople

  2. Install the package
       Add-AppxPackage .\PlayPets_@VERSION@_x64.msix

Remove

       Get-AppxPackage gaerae.PlayPets | Remove-AppxPackage
       Get-ChildItem Cert:\LocalMachine\TrustedPeople | Where-Object Subject -eq '@PUBLISHER@' | Remove-Item

What to check

  [ ] PlayPets starts from the Start menu and the yard and pets show
  [ ] The tray icon and its menu work
  [ ] Show on desktop: pets float above other windows and can be dragged
  [ ] After saving an AI connection, chat works (Claude Code / Codex CLI start)
  [ ] In a new terminal, `playpets pets` lists the friends (execution alias)
  [ ] Settings > Claude Code > Copy settings, paste them, and the friend reacts while Claude Code works
  [ ] A pet imported by address is still there after a restart
  [ ] "Open folder" on the Invite tab opens the folder  <- may not open in a package (see below)

Good to know

  - Files a packaged app writes to %APPDATA% are really stored under
    %LOCALAPPDATA%\Packages\gaerae.PlayPets_...\LocalCache\Roaming.
    The app and the playpets command see the same place, but File Explorer does not.
  - The WebView2 runtime is needed. Windows 11 includes it; Windows 10 may not.
