<#
.SYNOPSIS
Deploys the Cerbo GX LAN monitor config and reporter script to many reachable Cerbos.

.DESCRIPTION
This script runs from your workstation and uses SSH/SCP. It only works for Cerbo
SSH endpoints that are reachable from the network you are on, for example through
a Teltonika VPN, RMS remote access endpoint, or explicit port forward.

CSV columns:
  Host      Required. Reachable SSH host/IP/DNS name for the Cerbo.
  SiteId    Required. VRM site ID assigned to this trailer in the dashboard.
  SshPort   Optional. Defaults to 22.
  SshUser   Optional. Defaults to root.
  ScanCidr  Optional. Example: 192.168.1.0/24. Omit to let the Cerbo detect it.
  ScanMode  Optional. auto or targets. Defaults to auto.
  Token     Optional. If omitted, uses -Token or CERBO_INGEST_TOKEN env var.

.EXAMPLE
.\scripts\cerbo-gx\deploy-lan-monitor.ps1 -CsvPath .\cerbos.csv -RunTest
#>

[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory = $true)]
  [string] $CsvPath,

  [string] $ReporterPath = ".\scripts\cerbo-gx\report-managed-lan.sh",

  [string] $SiteUrl = "https://www.nomadxe.com",

  [string] $Token = $env:CERBO_INGEST_TOKEN,

  [ValidateRange(60, 86400)]
  [int] $IntervalSeconds = 900,

  [switch] $NoSchedule,

  [switch] $RunTest
)

$ErrorActionPreference = "Stop"

function Fail($Message) {
  throw $Message
}

function Require-Command($Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    Fail "Missing required command: $Name"
  }
}

function Shell-Quote($Value) {
  $text = if ($null -eq $Value) { "" } else { [string] $Value }
  return "'" + ($text -replace "'", "'\''") + "'"
}

function Run-ProcessChecked($FilePath, [string[]] $Arguments, $Label) {
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "$Label failed with exit code $LASTEXITCODE"
  }
}

Require-Command ssh
Require-Command scp

if (-not (Test-Path -LiteralPath $CsvPath)) {
  Fail "CSV not found: $CsvPath"
}

if (-not (Test-Path -LiteralPath $ReporterPath)) {
  Fail "Reporter script not found: $ReporterPath"
}

$rows = Import-Csv -LiteralPath $CsvPath
if (-not $rows -or $rows.Count -eq 0) {
  Fail "CSV contains no rows: $CsvPath"
}

if (-not $Token) {
  $secure = Read-Host -Prompt "Enter CERBO_INGEST_TOKEN" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("cerbo-lan-deploy-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempRoot | Out-Null

$loopPath = Join-Path $tempRoot "managed-network-monitor-loop.sh"
$loopContent = @"
#!/bin/sh
set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
INTERVAL_SECONDS="$IntervalSeconds"
PID_FILE="/var/run/managed-network-monitor-loop.pid"
LOG_FILE="/tmp/managed-network-monitor.log"

is_running() {
    [ -f "`$PID_FILE" ] || return 1
    pid="`$(cat "`$PID_FILE" 2>/dev/null || true)"
    [ -n "`$pid" ] || return 1
    kill -0 "`$pid" 2>/dev/null
}

if is_running; then
    exit 0
fi

echo "`$`$" > "`$PID_FILE"

cleanup() {
    rm -f "`$PID_FILE"
    exit 0
}

trap cleanup INT TERM HUP

while :; do
    {
        printf '%s Starting NomadXE managed LAN scan\n' "`$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date)"
        /data/report-managed-lan.sh
        printf '%s Finished NomadXE managed LAN scan\n' "`$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date)"
    } >>"`$LOG_FILE" 2>&1 || true
    sleep "`$INTERVAL_SECONDS"
done
"@
Set-Content -LiteralPath $loopPath -Value $loopContent -Encoding ascii

$installerPath = Join-Path $tempRoot "install-managed-network-monitor.sh"
$installerContent = @'
#!/bin/sh
set -eu

RC_FILE="/data/rc.local"
START_MARK="# BEGIN NOMADXE MANAGED NETWORK MONITOR"
END_MARK="# END NOMADXE MANAGED NETWORK MONITOR"
TMP_FILE="${RC_FILE}.tmp.$$"

if [ -f "$RC_FILE" ]; then
    sed "/$START_MARK/,/$END_MARK/d" "$RC_FILE" > "$TMP_FILE"
else
    printf '#!/bin/sh\n' > "$TMP_FILE"
fi

cat >> "$TMP_FILE" <<'BLOCK'
# BEGIN NOMADXE MANAGED NETWORK MONITOR
if [ -x /data/managed-network-monitor-loop.sh ]; then
    /data/managed-network-monitor-loop.sh >/tmp/managed-network-monitor-loop.out 2>&1 &
fi
# END NOMADXE MANAGED NETWORK MONITOR
BLOCK

chmod +x "$TMP_FILE"
mv "$TMP_FILE" "$RC_FILE"
chmod +x "$RC_FILE"

/data/managed-network-monitor-loop.sh >/tmp/managed-network-monitor-loop.out 2>&1 &
'@
Set-Content -LiteralPath $installerPath -Value $installerContent -Encoding ascii

$results = New-Object System.Collections.Generic.List[object]

try {
  foreach ($row in $rows) {
    $hostName = [string] $row.Host
    $siteId = [string] $row.SiteId
    $sshUser = if ($row.SshUser) { [string] $row.SshUser } else { "root" }
    $sshPort = if ($row.SshPort) { [string] $row.SshPort } else { "22" }
    $scanMode = if ($row.ScanMode) { [string] $row.ScanMode } else { "auto" }
    $scanCidr = [string] $row.ScanCidr
    $rowToken = if ($row.Token) { [string] $row.Token } else { $Token }

    if (-not $hostName) {
      $results.Add([pscustomobject]@{ Host = ""; SiteId = $siteId; Status = "Skipped"; Detail = "Missing Host" })
      continue
    }
    if (-not $siteId) {
      $results.Add([pscustomobject]@{ Host = $hostName; SiteId = ""; Status = "Skipped"; Detail = "Missing SiteId" })
      continue
    }
    if ($scanMode -notin @("auto", "targets")) {
      $results.Add([pscustomobject]@{ Host = $hostName; SiteId = $siteId; Status = "Skipped"; Detail = "Invalid ScanMode: $scanMode" })
      continue
    }
    if (-not $rowToken) {
      $results.Add([pscustomobject]@{ Host = $hostName; SiteId = $siteId; Status = "Skipped"; Detail = "Missing token" })
      continue
    }

    $target = "$sshUser@$hostName"
    $configPath = Join-Path $tempRoot ("managed-network-monitor-$siteId.conf")
    $configLines = @(
      "SITE_URL=$(Shell-Quote $SiteUrl)",
      "CERBO_INGEST_TOKEN=$(Shell-Quote $rowToken)",
      "VRM_SITE_ID=$(Shell-Quote $siteId)",
      "SCAN_MODE=$(Shell-Quote $scanMode)",
      "MAX_PARALLEL='32'",
      "PING_TIMEOUT='1'"
    )
    if ($scanCidr) {
      $configLines += "SCAN_CIDR=$(Shell-Quote $scanCidr)"
    }
    Set-Content -LiteralPath $configPath -Value $configLines -Encoding ascii

    Write-Host "Deploying Cerbo LAN monitor to $target for site $siteId..." -ForegroundColor Cyan

    try {
      $didDeploy = $false
      if ($PSCmdlet.ShouldProcess($target, "Deploy Cerbo LAN monitor")) {
        Run-ProcessChecked "ssh" @("-p", $sshPort, $target, "mkdir -p /data/conf && chmod 700 /data/conf") "prepare remote directories"
        Run-ProcessChecked "scp" @("-P", $sshPort, $configPath, "${target}:/data/conf/managed-network-monitor.conf") "copy config"
        Run-ProcessChecked "scp" @("-P", $sshPort, $ReporterPath, "${target}:/data/report-managed-lan.sh") "copy reporter"
        Run-ProcessChecked "ssh" @("-p", $sshPort, $target, "chmod 600 /data/conf/managed-network-monitor.conf && chmod +x /data/report-managed-lan.sh") "set permissions"

        if (-not $NoSchedule) {
          Run-ProcessChecked "scp" @("-P", $sshPort, $loopPath, "${target}:/data/managed-network-monitor-loop.sh") "copy scheduler loop"
          Run-ProcessChecked "scp" @("-P", $sshPort, $installerPath, "${target}:/tmp/install-managed-network-monitor.sh") "copy scheduler installer"
          Run-ProcessChecked "ssh" @("-p", $sshPort, $target, "chmod +x /data/managed-network-monitor-loop.sh /tmp/install-managed-network-monitor.sh") "prepare scheduler"
        }

        if ($RunTest) {
          Run-ProcessChecked "ssh" @("-p", $sshPort, $target, "/data/report-managed-lan.sh") "test scan"
        }

        if (-not $NoSchedule) {
          Run-ProcessChecked "ssh" @("-p", $sshPort, $target, "/tmp/install-managed-network-monitor.sh") "install scheduler"
        }
        $didDeploy = $true
      }

      if (-not $didDeploy) {
        $results.Add([pscustomobject]@{ Host = $hostName; SiteId = $siteId; Status = "Preview"; Detail = "WhatIf only; no changes made" })
      } else {
        $detail = if ($NoSchedule) { "Deployed without schedule" } else { "Deployed and scheduled every $IntervalSeconds seconds" }
        if ($RunTest) {
          $detail = "$detail; test scan ran"
        }
        $results.Add([pscustomobject]@{ Host = $hostName; SiteId = $siteId; Status = "OK"; Detail = $detail })
      }
    } catch {
      $results.Add([pscustomobject]@{ Host = $hostName; SiteId = $siteId; Status = "Failed"; Detail = $_.Exception.Message })
      Write-Warning "$hostName failed: $($_.Exception.Message)"
    }
  }
} finally {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Deployment summary" -ForegroundColor Green
$results | Format-Table -AutoSize

if (($results | Where-Object { $_.Status -eq "Failed" }).Count -gt 0) {
  exit 1
}
