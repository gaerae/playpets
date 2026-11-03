# Dot-sourced by ci.ps1 and store.ps1. Windows finds the qualified icons in Assets (the unplated
# Square44x44Logo.targetsize-* files) only through the package's resources.pri; without them it puts
# the taskbar and Start icon on a plate of the accent color.
function Write-PackageResources([string]$MakePri, [string]$Stage) {
    $temp = Join-Path ([IO.Path]::GetTempPath()) ('playpets-pri-' + [guid]::NewGuid())
    New-Item -ItemType Directory -Force $temp | Out-Null
    try {
        # The config and the dump stay outside the stage, so they are not packed or indexed.
        $config = Join-Path $temp 'priconfig.xml'
        & $MakePri createconfig /cf $config /dq en-US /pv 10.0.0 /o | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'makepri createconfig failed' }
        $pri = Join-Path $Stage 'resources.pri'
        & $MakePri new /pr $Stage /cf $config /mn (Join-Path $Stage 'AppxManifest.xml') /of $pri /o | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'makepri new failed' }
        $dump = Join-Path $temp 'resources.xml'
        & $MakePri dump /if $pri /of $dump /dt detailed /o | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'makepri dump failed' }
        if (!(Select-String -LiteralPath $dump -Pattern 'altform-unplated' -SimpleMatch -Quiet)) {
            throw 'resources.pri does not list the unplated icons'
        }
    } finally {
        Remove-Item -Recurse -Force -LiteralPath $temp -ErrorAction SilentlyContinue
    }
}
