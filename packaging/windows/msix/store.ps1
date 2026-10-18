param(
    [Parameter(Mandatory = $true)][string]$Binary,
    [ValidateSet('x64', 'arm64')][string]$Architecture
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path "$PSScriptRoot/../../..").Path
$version = (Get-Content -Raw "$root/package.json" | ConvertFrom-Json).version
$work = Join-Path $env:RUNNER_TEMP ('playpets-store-' + [guid]::NewGuid())
$out = Join-Path $root 'release/store'
New-Item -ItemType Directory -Force "$work/Assets", $out | Out-Null
Copy-Item $Binary "$work/playpets.exe"
$loader = Join-Path (Split-Path $Binary) 'WebView2Loader.dll'
if (Test-Path $loader) { Copy-Item $loader $work }
Copy-Item "$root/src-tauri/icons/msix/*.png" "$work/Assets/"
Copy-Item "$root/packaging/licenses/THIRD-PARTY-NOTICES.txt" $work
$env:MSIX_ARCHITECTURE = $Architecture
& node "$root/scripts/msix-manifest.mjs" "$PSScriptRoot/AppxManifest.xml" "$work/AppxManifest.xml" $version
if ($LASTEXITCODE -ne 0) { throw 'Store manifest generation failed' }
if (!$env:MSIX_PUBLISHER) { throw 'Store identity is required' }
$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
$tools = Get-ChildItem $sdk -Directory | Where-Object { Test-Path "$($_.FullName)/x64/makeappx.exe" } |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (!$tools) { throw 'Windows SDK packaging tools are missing' }
& "$($tools.FullName)/x64/makeappx.exe" pack /d $work /p "$out/PlayPets_${version}_${Architecture}.msix" /o
if ($LASTEXITCODE -ne 0) { throw 'Store package creation failed' }
Remove-Item -Recurse -Force $work
