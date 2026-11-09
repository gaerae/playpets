# Makes the one file the Store gets from the two packages store.ps1 made: a .msixbundle of the x64
# and ARM64 packages, and a .msixupload holding that bundle with each package's public symbols
# (.appxsym). Microsoft recommends a bundle, and the symbols make Partner Center's crash reports
# readable. Nothing is signed: the Store signs what it publishes.
param([Parameter(Mandatory = $true)][string]$Directory)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path "$PSScriptRoot/../../..").Path
$version = (Get-Content -Raw "$root/package.json" | ConvertFrom-Json).version
$dir = (Resolve-Path $Directory).Path
$packages = 'x64', 'arm64' | ForEach-Object { Join-Path $dir "PlayPets_${version}_$_.msix" }
$symbols = 'x64', 'arm64' | ForEach-Object { Join-Path $dir "PlayPets_${version}_$_.appxsym" }
foreach ($file in $packages + $symbols) { if (!(Test-Path $file)) { throw "Missing $(Split-Path -Leaf $file)" } }
$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
$tools = Get-ChildItem $sdk -Directory | Where-Object { Test-Path "$($_.FullName)/x64/makeappx.exe" } |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (!$tools) { throw 'Windows SDK packaging tools are missing' }
$work = Join-Path $env:RUNNER_TEMP ('playpets-bundle-' + [guid]::NewGuid())
New-Item -ItemType Directory -Force "$work/packages", "$work/upload" | Out-Null
# makeappx bundles every package in the folder, so the folder holds these two and nothing else.
Copy-Item $packages "$work/packages/"
$bundle = "$work/upload/PlayPets_$version.msixbundle"
& "$($tools.FullName)/x64/makeappx.exe" bundle /d "$work/packages" /p $bundle /bv "$version.0" /o
if ($LASTEXITCODE -ne 0) { throw 'Store bundle creation failed' }
Copy-Item $symbols "$work/upload/"
$zip = Join-Path $work 'upload.zip'
Compress-Archive -Path "$work/upload/*" -DestinationPath $zip
Move-Item $zip (Join-Path $dir "PlayPets_$version.msixupload") -Force
Remove-Item -Force $packages, $symbols
Remove-Item -Recurse -Force $work
