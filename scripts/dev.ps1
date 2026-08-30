Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$StateDir = if ($env:TODOS_TRAINING_STATE_DIR) { $env:TODOS_TRAINING_STATE_DIR } else { Join-Path $env:TEMP "todos-training" }

$ApiPort = if ($env:API_PORT) { [int]$env:API_PORT } else { 18080 }
$WebPort = if ($env:WEB_PORT) { [int]$env:WEB_PORT } else { 15173 }
$ApiBaseUrl = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "http://localhost:$ApiPort" }

$Detach = $false
$RunBuild = $false
$SkipInstall = $false
$TakeOverPorts = $true
$ResetDatabase = $false

$StartedServices = New-Object System.Collections.Generic.List[string]
$StartedPids = New-Object System.Collections.Generic.List[int]
$RunPidFiles = New-Object System.Collections.Generic.List[string]

function Write-Info($Message) { Write-Host "[INFO]  $Message" -ForegroundColor Cyan }
function Write-Success($Message) { Write-Host "[OK]    $Message" -ForegroundColor Green }
function Write-Warn($Message) { Write-Host "[WARN]  $Message" -ForegroundColor Yellow }
function Write-Fail($Message) { Write-Host "[FAIL]  $Message" -ForegroundColor Red }

function Show-Usage {
    @"
todos-training Windows development launcher

Usage:
  powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 [--detach] [--build] [--skip-install] [--no-takeover] [--reset] [--help]

Options:
  --detach        Start API and Web in the background, then exit after checks.
  --build         Run API/Web/CLI build checks before starting services.
  --skip-install  Do not run pnpm install automatically.
  --no-takeover   Do not stop existing processes on ports $ApiPort/$WebPort.
  --reset         Start with a clean in-memory H2 database.
  --help          Show this help message.

Default behavior:
  - Check Java 21+, Node.js 20+, and pnpm.
  - Stop existing listeners on ports $ApiPort/$WebPort before starting.
  - Install web/cli dependencies when node_modules is missing or manifests changed.
  - Start services/api with Gradle bootRun.
  - Start apps/web with Vite on http://localhost:$WebPort.
  - Store logs and PID files under $StateDir.
  - In foreground mode, Ctrl+C stops only services started by this script.
"@
}

function Parse-Args {
    foreach ($Arg in $args) {
        switch ($Arg) {
            "--detach" { $script:Detach = $true; continue }
            "-Detach" { $script:Detach = $true; continue }
            "--build" { $script:RunBuild = $true; continue }
            "-Build" { $script:RunBuild = $true; continue }
            "--skip-install" { $script:SkipInstall = $true; continue }
            "-SkipInstall" { $script:SkipInstall = $true; continue }
            "--no-takeover" { $script:TakeOverPorts = $false; continue }
            "-NoTakeover" { $script:TakeOverPorts = $false; continue }
            "--reset" { $script:ResetDatabase = $true; continue }
            "-Reset" { $script:ResetDatabase = $true; continue }
            "--help" { Show-Usage; exit 0 }
            "-Help" { Show-Usage; exit 0 }
            "-h" { Show-Usage; exit 0 }
            default {
                Write-Fail "Unknown argument: $Arg"
                Write-Host ""
                Show-Usage
                exit 1
            }
        }
    }
}

function Write-Header {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor White
    Write-Host "  todos-training one-click dev" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor White
    Write-Host ""
}

function Test-Command($Command) {
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Check-Command($Label, $Command, $Hint) {
    $Found = Get-Command $Command -ErrorAction SilentlyContinue
    if ($Found) {
        $Version = "available"
        try {
            $VersionOutput = & $Command --version 2>$null | Select-Object -First 1
            if ($VersionOutput) {
                $Version = $VersionOutput
            }
        } catch {
            $Version = "available"
        }
        Write-Success "$Label - $Version"
        return $true
    }

    Write-Fail "$Label is missing - $Hint"
    return $false
}

function Check-Node-Version {
    if (-not (Test-Command "node")) {
        return $true
    }

    $Major = [int](& node -e "console.log(process.versions.node.split('.')[0])")
    if ($Major -lt 20) {
        Write-Fail "Node.js major version is $Major; expected >= 20"
        return $false
    }

    Write-Success "Node.js major version: $Major (>=20)"
    return $true
}

function Check-Java-Version {
    if (-not (Test-Command "java")) {
        return $true
    }

    $RawText = ""
    try {
        $RawText = (& java --version 2>&1 | ForEach-Object { $_.ToString() }) -join "`n"
    } catch {
        $RawText = ""
    }
    if (-not $RawText) {
        try {
            $RawText = (& java -version 2>&1 | ForEach-Object { $_.ToString() }) -join "`n"
        } catch {
            $RawText = ""
        }
    }

    if (-not $RawText) {
        Write-Fail "Cannot read Java version output; expected >= 21"
        return $false
    }

    $Version = $null
    if ($RawText -match 'version\s+"([^"]+)"') {
        $Version = $Matches[1]
    }
    if (-not $Version -and ($RawText -match 'java\s+(1\.[0-9]+|[0-9][0-9._]*)')) {
        $Version = $Matches[1]
    }
    if (-not $Version -and ($RawText -match 'openjdk\s+(1\.[0-9]+|[0-9][0-9._]*)')) {
        $Version = $Matches[1]
    }

    if (-not $Version) {
        $FirstLine = ($RawText -split "`n")[0]
        Write-Fail "Cannot parse Java version: $FirstLine; expected >= 21"
        return $false
    }

    $Major = $null
    if ($Version -match '^1\.([0-9]+)') {
        $Major = [int]$Matches[1]
    } elseif ($Version -match '^([0-9]+)') {
        $Major = [int]$Matches[1]
    }

    if (-not $Major) {
        $FirstLine = ($RawText -split "`n")[0]
        Write-Fail "Cannot parse Java version: $FirstLine; expected >= 21"
        return $false
    }

    if ($Major -lt 21) {
        Write-Fail "Java version is $Version; expected >= 21"
        return $false
    }

    Write-Success "Java major version: $Major (>=21)"
    return $true
}

function Check-Environment {
    Write-Info "Phase 1: checking environment..."

    $Failures = 0
    if (-not (Check-Command "Node.js" "node" "install Node.js 20+")) { $Failures++ }
    if (-not (Check-Command "pnpm" "pnpm" "install pnpm")) { $Failures++ }
    if (-not (Check-Command "Java" "java" "install JDK 21")) { $Failures++ }
    if (-not (Check-Node-Version)) { $Failures++ }
    if (-not (Check-Java-Version)) { $Failures++ }

    if ($Failures -gt 0) {
        Write-Host ""
        Write-Fail "Found $Failures environment issue(s). Fix them and rerun."
        exit 1
    }
}

function Ensure-State-Dir {
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
}

function Rotate-Log($LogFile) {
    if (Test-Path $LogFile) {
        Move-Item -Force $LogFile "$LogFile.prev"
    }
}

function Test-Port($HostName, $Port) {
    $Client = New-Object System.Net.Sockets.TcpClient
    try {
        $Async = $Client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $Async.AsyncWaitHandle.WaitOne(1000, $false)) {
            return $false
        }
        $Client.EndConnect($Async)
        return $true
    } catch {
        return $false
    } finally {
        $Client.Close()
    }
}

function Write-Log-Tail($LogFile, $MaxLines) {
    if (-not $LogFile -or -not (Test-Path $LogFile)) {
        return
    }
    try {
        $Fs = [System.IO.File]::Open($LogFile, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        try {
            $Reader = New-Object System.IO.StreamReader($Fs)
            $AllLines = New-Object System.Collections.Generic.List[string]
            while ($null -ne ($Line = $Reader.ReadLine())) {
                $AllLines.Add($Line)
            }
            $Count = $AllLines.Count
            $Start = [Math]::Max(0, $Count - $MaxLines)
            for ($i = $Start; $i -lt $Count; $i++) {
                if ($AllLines[$i]) {
                    Write-Host "         $($AllLines[$i])" -ForegroundColor DarkGray
                }
            }
        } finally {
            if ($Reader) { $Reader.Dispose() }
            $Fs.Dispose()
        }
    } catch {}
}

function Disable-PowerShell-WebProxy {
    try {
        [System.Net.WebRequest]::DefaultWebProxy = [System.Net.GlobalProxySelection]::GetEmptyWebProxy()
    } catch {
        try { [System.Net.WebRequest]::DefaultWebProxy = $null } catch {}
    }
    $env:NO_PROXY = "localhost,127.0.0.1,::1"
    $env:no_proxy = "localhost,127.0.0.1,::1"
}

function Wait-For-Port($HostName, $Port, $Label, $MaxSeconds, $LogFile = $null) {
    $Elapsed = 0
    $TickCount = 0
    while ($Elapsed -lt $MaxSeconds) {
        if (Test-Port $HostName $Port) {
            Write-Host ""
            Write-Success "$Label port is open ($HostName`:$Port)"
            return $true
        }
        $TickCount++
        Write-Host "." -NoNewline -ForegroundColor Gray
        if ($TickCount % 5 -eq 0) {
            Write-Host " ${Elapsed}s" -ForegroundColor DarkGray
            if ($TickCount % 15 -eq 0 -and $LogFile) {
                Write-Host "       [$(Split-Path $LogFile -Leaf) tail]:" -ForegroundColor DarkCyan
                Write-Log-Tail $LogFile 5
            }
        }
        Start-Sleep -Seconds 2
        $Elapsed += 2
    }

    Write-Host ""
    if ($LogFile) {
        Write-Warn "$Label port not open after ${Elapsed}s; last 30 lines of $(Split-Path $LogFile -Leaf):"
        Write-Log-Tail $LogFile 30
    }
    throw "$Label port did not open in ${MaxSeconds}s ($HostName`:$Port)"
}

function Wait-For-Http($Url, $Label, $MaxSeconds, $LogFile = $null, $PortOpenHint = $false) {
    Disable-PowerShell-WebProxy
    $Elapsed = 0
    $TickCount = 0
    $HttpFailSincePortOpen = 0
    while ($Elapsed -lt $MaxSeconds) {
        try {
            $Req = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ($Req.StatusCode -ge 200 -and $Req.StatusCode -lt 400) {
                if ($TickCount -gt 0) { Write-Host "" }
                Write-Success "$Label is ready ($Url)"
                return $true
            }
        } catch {
            $Ex = $_.Exception
        }
        $TickCount++
        if ($PortOpenHint) { $HttpFailSincePortOpen += 2 }
        Write-Host "." -NoNewline -ForegroundColor Gray
        if ($TickCount % 5 -eq 0) {
            Write-Host " ${Elapsed}s" -ForegroundColor DarkGray
            if ($TickCount % 15 -eq 0) {
                if ($LogFile) {
                    Write-Host "       [$(Split-Path $LogFile -Leaf) tail]:" -ForegroundColor DarkCyan
                    Write-Log-Tail $LogFile 5
                }
                if ($PortOpenHint -and $HttpFailSincePortOpen -ge 30) {
                    Write-Host ""
                    try {
                        $Uri = [Uri]$Url
                        $Authority = if ($Uri.IsDefaultPort) { $Uri.Host } else { "$($Uri.Host):$($Uri.Port)" }
                    } catch { $Authority = $Url }
                    Write-Warn "PORT IS LISTENING BUT HTTP KEEPS FAILING — POSSIBLE POWERSHELL PROXY ISSUE."
                    Write-Host "       Diagnose: run these commands in another PowerShell window and compare:"
                    Write-Host "         1) Test-NetConnection -ComputerName $($Uri.Host) -Port $($Uri.Port)   <- should TcpTestSucceeded : True"
                    Write-Host "         2) curl.exe -s -o nul -w '%{http_code}' '$Url'   <- should print 200 (native curl.exe bypasses PowerShell proxy)"
                    Write-Host "         3) [System.Net.WebRequest]::DefaultWebProxy = `$null; (Invoke-WebRequest -UseBasicParsing '$Url').StatusCode"
                    Write-Host "       If (2) returns 200 but (3) throws, your WinINET/IE system proxy is routing localhost through a corporate proxy — disable it in Internet Options -> Connections -> LAN settings."
                    $HttpFailSincePortOpen = 0
                }
            }
        }
        Start-Sleep -Seconds 2
        $Elapsed += 2
    }

    Write-Host ""
    if ($LogFile) {
        Write-Warn "$Label not ready yet after ${Elapsed}s; last 30 lines of $(Split-Path $LogFile -Leaf):"
        Write-Log-Tail $LogFile 30
    }
    throw "$Label did not become ready in ${MaxSeconds}s ($Url)"
}

function Get-Port-ProcessIds($Port) {
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique)
    }

    $Rows = netstat -ano -p tcp | Select-String "LISTENING" | Select-String ":$Port "
    return @($Rows | ForEach-Object {
        $Parts = ($_ -split '\s+') | Where-Object { $_ }
        if ($Parts.Length -gt 0) { [int]$Parts[-1] }
    } | Select-Object -Unique)
}

function Stop-Process-Tree($ProcessId) {
    if (-not $ProcessId) {
        return
    }
    & taskkill.exe /PID $ProcessId /T /F *> $null
}

function Force-Take-Over-Port($Port, $Label, $PidFile) {
    if (-not $TakeOverPorts) {
        Write-Warn "Skipping port takeover for $Label ($Port)"
        return
    }

    $ProcessIds = @(Get-Port-ProcessIds $Port | Where-Object { $_ })
    if ($ProcessIds.Count -gt 0) {
        Write-Warn "Stopping existing listener(s) on port $Port for ${Label}: $($ProcessIds -join ', ')"
        foreach ($ProcessId in $ProcessIds) {
            Stop-Process-Tree $ProcessId
        }
        Start-Sleep -Seconds 1
    }

    if (Test-Path $PidFile) {
        Remove-Item -Force $PidFile
    }
}

function Reset-Database {
    if (-not $ResetDatabase) {
        return
    }

    Write-Info "API uses in-memory H2; a fresh API process starts with a clean database."
}

function Invoke-In-Directory($Directory, $Command, [string[]]$Arguments) {
    Push-Location $Directory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }
}

function Install-If-Needed($AppDir, $Label) {
    if ($SkipInstall) {
        Write-Warn "Skipping dependency install for $Label"
        return
    }

    $NodeModules = Join-Path $AppDir "node_modules"
    $Stamp = Join-Path $NodeModules ".todos-training-install.stamp"
    $PackageJson = Join-Path $AppDir "package.json"
    $LockFile = Join-Path $AppDir "pnpm-lock.yaml"
    $NeedsInstall = $false

    if (-not (Test-Path $NodeModules)) {
        $NeedsInstall = $true
    } elseif (-not (Test-Path $Stamp)) {
        $NeedsInstall = $true
    } elseif ((Get-Item $PackageJson).LastWriteTime -gt (Get-Item $Stamp).LastWriteTime) {
        $NeedsInstall = $true
    } elseif ((Test-Path $LockFile) -and ((Get-Item $LockFile).LastWriteTime -gt (Get-Item $Stamp).LastWriteTime)) {
        $NeedsInstall = $true
    }

    if (-not $NeedsInstall) {
        Write-Success "$Label dependencies are up to date"
        return
    }

    Write-Info "Installing $Label dependencies..."
    if (Test-Path $LockFile) {
        Invoke-In-Directory $AppDir "pnpm" @("install", "--frozen-lockfile")
    } else {
        Invoke-In-Directory $AppDir "pnpm" @("install")
    }
    New-Item -ItemType Directory -Force -Path $NodeModules | Out-Null
    New-Item -ItemType File -Force -Path $Stamp | Out-Null
}

function Prepare-Dependencies {
    Write-Host ""
    Write-Info "Phase 2: preparing dependencies..."
    Install-If-Needed (Join-Path $Root "apps\web") "web"
    Install-If-Needed (Join-Path $Root "apps\cli") "cli"
}

function Get-Gradle-Launcher($ApiDir) {
    $GradleBat = Join-Path $ApiDir "gradlew.bat"
    if (Test-Path $GradleBat) {
        return $GradleBat
    }

    $GradleSh = Join-Path $ApiDir "gradlew"
    if (Test-Path $GradleSh) {
        return $GradleSh
    }

    throw "Cannot find Gradle wrapper in $ApiDir"
}

function Run-Build-Checks {
    if (-not $RunBuild) {
        return
    }

    Write-Host ""
    Write-Info "Phase 3: running build checks..."
    $ApiDir = Join-Path $Root "services\api"
    $Gradle = Get-Gradle-Launcher $ApiDir
    Invoke-In-Directory $ApiDir $Gradle @("test")
    Invoke-In-Directory (Join-Path $Root "apps\web") "pnpm" @("build")
    Invoke-In-Directory (Join-Path $Root "apps\cli") "pnpm" @("build")
}

function New-Cmd-Wrapper($Name, $Directory, [string[]]$EnvironmentLines, $CommandLine, $LogFile) {
    $CmdFile = Join-Path $StateDir "$Name.cmd"
    $Lines = New-Object System.Collections.Generic.List[string]
    $Lines.Add("@echo off")
    $Lines.Add("cd /d `"$Directory`"")
    foreach ($Line in $EnvironmentLines) {
        $Lines.Add($Line)
    }
    $Lines.Add("call $CommandLine > `"$LogFile`" 2>&1")
    Set-Content -Path $CmdFile -Value $Lines -Encoding ASCII
    return $CmdFile
}

function Start-Service-Process($Name, $Directory, $LogFile, $PidFile, [string[]]$EnvironmentLines, $CommandLine) {
    Rotate-Log $LogFile
    Write-Info "Starting $Name..."

    $CmdFile = New-Cmd-Wrapper $Name $Directory $EnvironmentLines $CommandLine $LogFile
    $Process = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "`"$CmdFile`"") -WindowStyle Hidden -PassThru
    Set-Content -Path $PidFile -Value $Process.Id -Encoding ASCII

    $StartedServices.Add($Name) | Out-Null
    $StartedPids.Add($Process.Id) | Out-Null
    $RunPidFiles.Add($PidFile) | Out-Null
    Write-Success "$Name started (pid $($Process.Id), log $LogFile)"
}

function Start-Services {
    Write-Host ""
    Write-Info "Phase 4: starting services..."

    $ApiPidFile = Join-Path $StateDir "api.pid"
    $WebPidFile = Join-Path $StateDir "web.pid"
    $ApiLog = Join-Path $StateDir "api.log"
    $WebLog = Join-Path $StateDir "web.log"
    $ApiDir = Join-Path $Root "services\api"
    $WebDir = Join-Path $Root "apps\web"

    Force-Take-Over-Port $ApiPort "api" $ApiPidFile
    Force-Take-Over-Port $WebPort "web" $WebPidFile
    Reset-Database

    $GradleOpts = "-Dorg.gradle.internal.http.socketTimeout=120000 -Dorg.gradle.internal.http.connectionTimeout=120000"
    if ($env:GRADLE_OPTS) { $GradleOpts = "$env:GRADLE_OPTS $GradleOpts" }

    $ApiEnv = @(
        "set `"SERVER_PORT=$ApiPort`"",
        "set `"CORS_ALLOWED_ORIGIN=http://localhost:$WebPort`"",
        "set `"GRADLE_OPTS=$GradleOpts`""
    )
    if ($env:JAVA_HOME) { $ApiEnv += "set `"JAVA_HOME=$env:JAVA_HOME`"" }

    $GradleCommand = if (Test-Path (Join-Path $ApiDir "gradlew.bat")) { ".\gradlew.bat bootRun --console=plain" } else { ".\gradlew bootRun --console=plain" }
    Start-Service-Process `
        "api" `
        $ApiDir `
        $ApiLog `
        $ApiPidFile `
        $ApiEnv `
        $GradleCommand

    try { $ApiHost = ([Uri]$ApiBaseUrl).Host } catch { $ApiHost = "localhost" }
    Write-Info "Waiting for API port $ApiHost`:$ApiPort to open..."
    Wait-For-Port $ApiHost $ApiPort "api" 120 $ApiLog
    Write-Info "API port open; waiting for HTTP readiness at $ApiBaseUrl/api/todos..."
    Wait-For-Http "$ApiBaseUrl/api/todos" "api" 60 $ApiLog $true

    Start-Service-Process `
        "web" `
        $WebDir `
        $WebLog `
        $WebPidFile `
        @("set `"VITE_API_BASE_URL=$ApiBaseUrl`"", "set `"WEB_PORT=$WebPort`"") `
        "pnpm dev"

    Write-Info "Waiting for Web port localhost`:$WebPort to open..."
    Wait-For-Port "localhost" $WebPort "web" 60 $WebLog
    Write-Info "Web port open; waiting for HTTP readiness at http://localhost:$WebPort..."
    Wait-For-Http "http://localhost:$WebPort" "web" 30 $WebLog $true
}

function Print-Success-Summary {
    Write-Host ""
    Write-Success "todos-training local development is ready"
    Write-Host ""
    Write-Host "Services:"
    Write-Host "  API: $ApiBaseUrl"
    Write-Host "  Web: http://localhost:$WebPort"
    Write-Host ""
    Write-Host "Logs:"
    Write-Host "  API: $(Join-Path $StateDir 'api.log')"
    Write-Host "  Web: $(Join-Path $StateDir 'web.log')"
    Write-Host ""
    Write-Host "PID files:"
    foreach ($PidFile in $RunPidFiles) {
        Write-Host "  $PidFile"
    }
}

function Cleanup-Started-Services {
    if ($StartedPids.Count -eq 0) {
        return
    }

    Write-Host ""
    Write-Info "Stopping services started by this run..."

    for ($Index = $StartedPids.Count - 1; $Index -ge 0; $Index--) {
        $ProcessId = $StartedPids[$Index]
        $Name = $StartedServices[$Index]
        Write-Info "Stopping $Name (pid $ProcessId)"
        Stop-Process-Tree $ProcessId
    }

    foreach ($PidFile in $RunPidFiles) {
        if (Test-Path $PidFile) {
            Remove-Item -Force $PidFile
        }
    }

    $StartedServices.Clear()
    $StartedPids.Clear()
    $RunPidFiles.Clear()
}

function Supervise-Foreground {
    Write-Host ""
    Write-Info "Foreground supervision is active. Press Ctrl+C to stop started services."

    while ($true) {
        for ($Index = 0; $Index -lt $StartedPids.Count; $Index++) {
            $ProcessId = $StartedPids[$Index]
            $Name = $StartedServices[$Index]
            $Process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
            if (-not $Process) {
                Write-Fail "$Name exited. See $(Join-Path $StateDir "$Name.log")"
                Cleanup-Started-Services
                exit 1
            }
        }
        Start-Sleep -Seconds 2
    }
}

function Main {
    Parse-Args @args
    Disable-PowerShell-WebProxy
    Write-Header

    try {
        Ensure-State-Dir
        Check-Environment
        Prepare-Dependencies
        Run-Build-Checks
        Start-Services
        Print-Success-Summary

        if ($Detach) {
            return
        }

        Supervise-Foreground
    } catch {
        Write-Fail $_.Exception.Message
        Cleanup-Started-Services
        exit 1
    } finally {
        if (-not $Detach) {
            Cleanup-Started-Services
        }
    }
}

Main @args
