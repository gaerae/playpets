# Ephemeral runner gate: no Store credentials, submission or production certificate.
param(
    [Parameter(Mandatory = $true)][string]$ProductionBinary,
    [Parameter(Mandatory = $true)][string]$ProbeBinary,
    [ValidateSet('x64', 'arm64')][string]$Architecture = 'x64'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
    throw 'MSIX installation tests run only on ephemeral GitHub Windows runners.'
}
$root = (Resolve-Path "$PSScriptRoot/../../..").Path
$out = Join-Path $root 'release/windows/msix-ci'
$work = Join-Path $env:RUNNER_TEMP ('playpets-msix-' + [guid]::NewGuid())
New-Item -ItemType Directory -Force $out, $work | Out-Null
$identity = 'PlayPets.CI'
$publisher = 'CN=PlayPets CI'
$report = [ordered]@{ architecture = $Architecture; runner = $env:RUNNER_NAME; ok = $false; steps = @(); storeDelivery = 'not tested' }
$cert = $null
$trusted = $null
$ownedPackage = $false
$script:ownedProcesses = @()

function Native([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments 2>&1 | Out-File -Append -Encoding utf8 (Join-Path $out 'tools.log')
    if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE" }
}
function Step([string]$Name) { $report.steps += $Name; Write-Host "MSIX: $Name" }
function Stop-Owned {
    foreach ($id in $script:ownedProcesses) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
    $script:ownedProcesses = @()
}
function Package([string]$Binary, [string]$Label, [bool]$Upgrade = $false) {
    $stage = Join-Path $work $Label
    New-Item -ItemType Directory -Force "$stage/Assets" | Out-Null
    Copy-Item $Binary "$stage/playpets.exe"
    $loader = Join-Path (Split-Path $Binary) 'WebView2Loader.dll'
    if (Test-Path $loader) { Copy-Item $loader $stage }
    Copy-Item "$root/src-tauri/icons/msix/*.png" "$stage/Assets/"
    Copy-Item "$root/packaging/licenses/THIRD-PARTY-NOTICES.txt" $stage
    $manifest = Join-Path $stage 'AppxManifest.xml'
    Native 'node' @("$root/scripts/msix-manifest.mjs", "$root/packaging/windows/msix/AppxManifest.xml", $manifest, $appVersion)
    [xml]$xml = Get-Content -Raw $manifest
    if ($Upgrade) {
        $v = [version]$xml.Package.Identity.Version
        if ($v.Build -ge 65535) { throw 'No package version headroom for upgrade probe' }
        $xml.Package.Identity.Version = "$($v.Major).$($v.Minor).$($v.Build + 1).0"
        $xml.Save($manifest)
    }
    $package = Join-Path $work "$Label.msix"
    Native $makeAppx @('pack', '/d', $stage, '/p', $package, '/o')
    Native $signTool @('sign', '/fd', 'SHA256', '/sha1', $cert.Thumbprint, '/s', 'My', $package)
    Native $signTool @('verify', '/pa', $package)
    return $package
}
function Installed {
    $packages = @(Get-AppxPackage -Name $identity | Where-Object Publisher -eq $publisher)
    if ($packages.Count -ne 1) { throw 'Expected exactly one installed CI package' }
    $p = $packages[0]
    if ($p.Status -ne 'Ok' -or "$($p.Architecture)" -ne $Architecture) { throw 'Invalid package status or architecture' }
    return $p
}
function Probe([string]$Phase) {
    $p = Installed
    $js = Join-Path $work "$Phase.js"
    Native 'node' @("$root/tests/msix-scenario.mjs", $js, $Phase)
    $result = Join-Path $out "$Phase.json"
    $stdout = Join-Path $out "$Phase.log"
    $stderr = Join-Path $out "$Phase-stderr.log"
    $runner = Join-Path $work "$Phase.ps1"
    # Use the installed app's normal data path so package upgrades exercise its real storage.
    $q = { param($value) "'" + $value.Replace("'", "''") + "'" }
    $body = @'
$ErrorActionPreference = 'Stop'
Remove-Item Env:PLAYPETS_DATA -ErrorAction SilentlyContinue
$env:CODEX_HOME = CODEX
$env:PLAYPETS_LANG = 'en'
$env:PLAYPETS_E2E_EVAL = [IO.File]::ReadAllText(JS)
$process = $null
$resultText = $null
try {
    $process = Start-Process -FilePath EXE -PassThru -RedirectStandardOutput STDOUT -RedirectStandardError STDERR
    $end = (Get-Date).AddSeconds(90)
    do {
        Start-Sleep -Milliseconds 250
        $text = if (Test-Path STDOUT) { [IO.File]::ReadAllText(STDOUT) } else { '' }
        if ($text -match '\[e2e\] MSIX_RESULT (\{[^\r\n]+\})') {
            $resultText = $Matches[1]; break
        }
        if ($process.HasExited) { throw 'Packaged probe exited before reporting' }
    } while ((Get-Date) -lt $end)
    if (!$resultText) { throw 'Packaged probe timed out' }
} catch { $resultText = @{ok=$false; error="$_"} | ConvertTo-Json }
finally { if ($process -and !$process.HasExited) { Stop-Process -Id $process.Id -Force; $process.WaitForExit() } }
[IO.File]::WriteAllText((RESULT + '.tmp'), $resultText)
Move-Item -LiteralPath (RESULT + '.tmp') -Destination RESULT
'@
    $values = @{CODEX="$work/codex"; JS=$js; EXE="$($p.InstallLocation)/playpets.exe"; STDOUT=$stdout; STDERR=$stderr; RESULT=$result}
    $body = [regex]::Replace($body, '\b(CODEX|JS|EXE|STDOUT|STDERR|RESULT)\b', { param($match) & $q $values[$match.Value] })
    Set-Content -Encoding utf8 $runner $body
    Invoke-CommandInDesktopPackage -PackageFamilyName $p.PackageFamilyName -AppId PlayPets `
        -Command 'powershell.exe' -Args "-NoProfile -ExecutionPolicy Bypass -File `"$runner`"" -PreventBreakaway
    $end = (Get-Date).AddSeconds(110)
    while (!(Test-Path $result) -and (Get-Date) -lt $end) { Start-Sleep -Milliseconds 500 }
    if (!(Test-Path $result)) { throw 'Package-context runner did not report' }
    $r = Get-Content -Raw $result | ConvertFrom-Json
    if (!$r.ok) { throw "Packaged $Phase probe failed: $($r.error)" }
    Step "$Phase updater and settings probe"
}

try {
    if (Get-AppxPackage -Name $identity) { throw 'CI package already exists; refusing to replace it' }
    $sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
    $tools = Get-ChildItem $sdk -Directory | Where-Object { Test-Path "$($_.FullName)/x64/makeappx.exe" } |
        Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
    if (!$tools) { throw 'Windows SDK packaging tools are missing' }
    $makeAppx = "$($tools.FullName)/x64/makeappx.exe"
    $signTool = "$($tools.FullName)/x64/signtool.exe"
    $appVersion = (Get-Content -Raw "$root/package.json" | ConvertFrom-Json).version
    $env:MSIX_IDENTITY_NAME = $identity
    $env:MSIX_PUBLISHER = $publisher
    $env:MSIX_PUBLISHER_DISPLAY_NAME = 'PlayPets CI'
    $env:MSIX_ARCHITECTURE = $Architecture
    $cert = New-SelfSignedCertificate -Type Custom -Subject $publisher -KeyUsage DigitalSignature `
        -FriendlyName 'PlayPets ephemeral CI' -CertStoreLocation 'Cert:\CurrentUser\My' `
        -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
    $cer = Join-Path $work 'ci.cer'
    Export-Certificate -Cert $cert -FilePath $cer | Out-Null
    $trusted = Import-Certificate -FilePath $cer -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople'
    $productionPackage = Package $ProductionBinary 'production'
    $ownedPackage = $true
    Add-AppxPackage -Path $productionPackage
    $p = Installed
    $report.production = @{ package = $p.PackageFullName; sha256 = (Get-FileHash $ProductionBinary -Algorithm SHA256).Hash }
    Step 'signed production package installed'
    Remove-Item Env:PLAYPETS_E2E_EVAL -ErrorAction SilentlyContinue
    Remove-Item Env:PLAYPETS_DATA -ErrorAction SilentlyContinue
    Start-Process explorer.exe -ArgumentList "shell:AppsFolder\$($p.PackageFamilyName)!PlayPets"
    $deadline = (Get-Date).AddSeconds(45)
    $process = $null
    do {
        Start-Sleep -Milliseconds 500
        $process = Get-Process playpets -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq "$($p.InstallLocation)\playpets.exe" } | Select-Object -First 1
    } while (!$process -and (Get-Date) -lt $deadline)
    if (!$process) { throw 'Production AUMID activation failed' }
    $script:ownedProcesses += $process.Id
    $deadline = (Get-Date).AddSeconds(30)
    do {
        Start-Sleep -Milliseconds 500
        $process.Refresh()
        if ($process.HasExited) { throw 'Production app exited after activation' }
    } while ((Get-Date) -lt $deadline)
    if ($process.MainWindowHandle -eq 0) { throw 'Production app did not create a visible window' }
    Step 'production AUMID activation and visible window'
    Stop-Owned
    Remove-AppxPackage -Package $p.PackageFullName
    Add-AppxPackage -Path (Package $ProbeBinary 'probe')
    Probe 'prepare'
    $old = (Installed).Version
    Add-AppxPackage -Path (Package $ProbeBinary 'upgrade' $true)
    if ((Installed).Version -le $old) { throw 'Package version did not increase' }
    $report.upgrade = @{ from = "$old"; to = "$((Installed).Version)"; binaryChanged = $false }
    Step 'higher package version installed'
    Probe 'upgrade'
    $report.ok = $true
} catch {
    $report.error = "$_"
    throw
} finally {
    Stop-Owned
    if ($ownedPackage) {
        $active = Get-AppxPackage -Name $identity | Where-Object Publisher -eq $publisher
        if ($active) {
            Get-Process playpets -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq "$($active.InstallLocation)\playpets.exe" } | Stop-Process -Force -ErrorAction Continue
        }
    }
    # The exact identity and publisher belong only to this isolated gate.
    try {
        if ($ownedPackage) {
            Get-AppxPackage -Name $identity | Where-Object Publisher -eq $publisher | ForEach-Object { Remove-AppxPackage -Package $_.PackageFullName }
            if (Get-AppxPackage -Name $identity) { throw 'CI package remains installed' }
        }
        Step 'CI package removed'
    } catch { $report.ok = $false; $report.cleanupError = "$_" }
    try {
        if ($trusted) { Remove-Item "Cert:\LocalMachine\TrustedPeople\$($trusted.Thumbprint)" -Force }
        if ($cert) { Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -DeleteKey -Force }
    } catch { $report.ok = $false; $report.certificateCleanupError = "$_" }
    $report | ConvertTo-Json -Depth 6 | Set-Content -Encoding utf8 (Join-Path $out 'report.json')
    Remove-Item $work -Recurse -Force -ErrorAction Continue
}
if (!$report.ok) { throw 'MSIX gate or cleanup failed; inspect report.json' }
