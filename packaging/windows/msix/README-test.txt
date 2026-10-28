PlayPets MSIX test package
==========================

App version: @VERSION@
This package uses the separate local test publisher @PUBLISHER@. It is not for Store submission.
The Store hand-off is under msix-store and has the Partner Center publisher instead.

Before installing

  Use a disposable Windows x64 account or VM and fully quit other PlayPets instances.
  Back up existing data before testing on an account you normally use.
  An old local 1.2.0.0 test package cannot upgrade to 1.0.0.0. Remove only that test
  package using the publisher-filtered command below before installing this version.
  WebView2 Runtime is required. Its loader DLL is included, but the runtime itself is not.
  Verify the package and certificate hashes against the supplied SHA256SUMS.txt, when provided.

Install

  1. In an administrator PowerShell, trust this public test certificate once:
       Import-Certificate -FilePath .\PlayPets-test.cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople

  2. Install for the Windows user who will run the app:
       Add-AppxPackage .\PlayPets_@VERSION@_x64.msix

  3. Inspect the installed identity:
       Get-AppxPackage -Name gaerae.PlayPets | Select-Object Name, Publisher, Version, Architecture, PackageFamilyName, Status

     The package version matches the app version with a fourth zero: app 1.0.0 uses 1.0.0.0.
     Open PlayPets from Start. No test private key is included in this hand-off.

What to check

  [ ] Yard, friends, backgrounds, window resizing and full screen work
  [ ] Tray, always-on-top and desktop overlays work; Close and Quit behave as documented
  [ ] Settings > About explains Microsoft Store/package-managed updates, with no EXE install button
  [ ] The tray update action opens that explanation, including while offline
  [ ] MSIX uses package-managed updates rather than the GitHub installer updater
  [ ] A saved AI connection works; remove test connections before uninstalling to remove saved keys
  [ ] In a new terminal, `playpets.exe pets` lists friends with the execution alias enabled
  [ ] Optional coding-agent integration works
  [ ] A playpets://import?url=... link opened from a browser starts PlayPets (or brings it forward)
      and imports the pet; the package declares the scheme
  [ ] Settings > Apps > Startup lists PlayPets, off; turned on, PlayPets starts at the next sign-in
  [ ] Note what the in-app Start at login switch does in the package (it writes the Run key)
  [ ] Imported pets, preferences and collection progress survive a restart
  [ ] The data-folder action works under package virtualization
  [ ] All four app languages work

Actual update delivery is a separate test

  Reinstalling this same version is not an upgrade test. A local upgrade needs a higher package
  version, the same identity and the same test certificate. Store-managed updates need separate
  validation through Store after an authorized submission; a local test does not prove that path.

Remove only the local test package

       Get-AppxPackage -Name gaerae.PlayPets |
         Where-Object Publisher -eq '@PUBLISHER@' |
         Remove-AppxPackage

  Inspect the selected publisher before removal. Do not remove the Store installation.
  After testing, remove the imported public certificate from Local Machine > Trusted People
  by the thumbprint of PlayPets-test.cer. Do not remove unrelated certificates. Uninstalling
  may leave local data, credentials and backups.
