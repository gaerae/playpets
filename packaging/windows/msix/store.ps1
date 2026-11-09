param(
    [Parameter(Mandatory = $true)][string]$Binary,
    [ValidateSet('x64', 'arm64')][string]$Architecture,
    # The linker's public-symbols PDB (/PDBSTRIPPED): kept beside the package as an .appxsym, which
    # bundle.ps1 puts in the Store upload. Function names only, no source paths or locals.
    [string]$Symbols
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path "$PSScriptRoot/../../..").Path
. "$PSScriptRoot/resources.ps1"
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
Write-PackageResources "$($tools.FullName)/x64/makepri.exe" $work
& "$($tools.FullName)/x64/makeappx.exe" pack /d $work /p "$out/PlayPets_${version}_${Architecture}.msix" /o
if ($LASTEXITCODE -ne 0) { throw 'Store package creation failed' }
if ($Symbols) {
    if (!(Test-Path $Symbols)) { throw 'The public symbols file is missing' }
    # An .appxsym is a zip of the PDBs, under the name the binary records.
    $pdb = Join-Path $work 'symbols/playpets.pdb'
    New-Item -ItemType Directory -Force (Split-Path $pdb) | Out-Null
    Copy-Item $Symbols $pdb
    $zip = Join-Path $work 'symbols.zip'
    Compress-Archive -Path $pdb -DestinationPath $zip
    Move-Item $zip "$out/PlayPets_${version}_${Architecture}.appxsym" -Force
}
Remove-Item -Recurse -Force $work
