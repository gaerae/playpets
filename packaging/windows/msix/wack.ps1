# Runs the Windows App Certification Kit on a Store package before it goes anywhere, as Microsoft
# asks. WACK installs what it tests, and Windows installs only a signed package, so a copy is signed
# with a certificate made here for the Store publisher's name, trusted on this runner alone and
# removed after. The unsigned package is what the Store gets. Fails on OVERALL_RESULT="FAIL".
param(
    [Parameter(Mandatory = $true)][string]$Package,
    [Parameter(Mandatory = $true)][string]$Report
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
    throw 'WACK runs only on ephemeral GitHub Windows runners: it trusts a certificate machine-wide.'
}
if (!$env:MSIX_PUBLISHER) { throw 'Store publisher is required' }
# appcert takes only full paths, and its report goes in a folder that already exists.
$Package = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Package)
$Report = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Report)
if (!(Test-Path $Package)) { throw "Missing $Package" }
$appcert = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/App Certification Kit/appcert.exe'
if (!(Test-Path $appcert)) { throw 'The Windows App Certification Kit is missing on this runner' }
$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
$tools = Get-ChildItem $sdk -Directory | Where-Object { Test-Path "$($_.FullName)/x64/signtool.exe" } |
    Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (!$tools) { throw 'Windows SDK signing tools are missing' }
$work = Join-Path $env:RUNNER_TEMP ('playpets-wack-' + [guid]::NewGuid())
New-Item -ItemType Directory -Force $work, (Split-Path $Report) | Out-Null
$copy = Join-Path $work (Split-Path -Leaf $Package)
Copy-Item $Package $copy
$cert = $null
$trusted = $null
try {
    $cert = New-SelfSignedCertificate -Type Custom -Subject $env:MSIX_PUBLISHER -KeyUsage DigitalSignature `
        -FriendlyName 'PlayPets ephemeral WACK' -CertStoreLocation 'Cert:\CurrentUser\My' `
        -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
    $cer = Join-Path $work 'wack.cer'
    Export-Certificate -Cert $cert -FilePath $cer | Out-Null
    $trusted = Import-Certificate -FilePath $cer -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople'
    & "$($tools.FullName)/x64/signtool.exe" sign /fd SHA256 /sha1 $cert.Thumbprint /s My $copy
    if ($LASTEXITCODE -ne 0) { throw 'Signing the WACK copy failed' }
    & $appcert reset | Out-Null
    & $appcert test -appxpackagepath $copy -reportoutputpath $Report
    if (!(Test-Path $Report)) { throw "WACK wrote no report (exit code $LASTEXITCODE)" }
    [xml]$xml = Get-Content -Raw $Report
    $overall = $xml.REPORT.OVERALL_RESULT
    $failed = @($xml.SelectNodes('//TEST[RESULT="FAIL"]') | ForEach-Object { $_.NAME })
    $line = "WACK $(Split-Path -Leaf $Package): $overall" + $(if ($failed.Count) { " (failed: $($failed -join ', '))" } else { '' })
    Write-Host $line
    if ($env:GITHUB_STEP_SUMMARY) { Add-Content $env:GITHUB_STEP_SUMMARY $line }
    if ($overall -eq 'FAIL') { throw 'The Windows App Certification Kit failed this package' }
    if (!$overall) { throw 'The WACK report has no overall result' }
}
finally {
    if ($trusted) { Remove-Item -LiteralPath "Cert:\LocalMachine\TrustedPeople\$($trusted.Thumbprint)" -ErrorAction SilentlyContinue }
    if ($cert) { Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($cert.Thumbprint)" -ErrorAction SilentlyContinue }
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}
