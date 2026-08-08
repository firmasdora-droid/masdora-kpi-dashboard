# =============================================================================
# PEMASANG BRIDGE WHATSAPP — Masdora Team Dashboard
#
# Skrip ini memasang "jambatan" WhatsApp pada komputer ini supaya mesej dari
# group WhatsApp team dihantar terus ke dashboard.
#
# JANGAN jalankan fail ini terus. Klik dua kali "PASANG.bat" sebaliknya.
# =============================================================================

$ErrorActionPreference = "Stop"

$REPO      = "C:\Dev\whatsapp-mcp-go"
$WEBHOOK   = "https://masdora-kpi-dashboard.vercel.app/api/ingest/whatsapp?secret=96ec6d03610a4915739f9e450670ffa5544274846c150d06"

function Say($msg)  { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "   OK - $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "   ! $msg" -ForegroundColor Yellow }

function Invoke-Admin([string]$script) {
    $tmp = "$env:TEMP\masdora-elev-$(Get-Random).ps1"
    $script | Out-File $tmp -Encoding UTF8
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$tmp`"" -Wait
    Remove-Item $tmp -ErrorAction SilentlyContinue
}

function Refresh-Path {
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH","User")
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor White
Write-Host "  PEMASANG BRIDGE WHATSAPP - MASDORA" -ForegroundColor White
Write-Host "==============================================" -ForegroundColor White
Write-Host ""
Write-Host "Windows akan minta kebenaran beberapa kali."
Write-Host "Sila klik YES setiap kali popup muncul." -ForegroundColor Yellow
Write-Host ""
Write-Host "Proses ini ambil masa 5-15 minit. Jangan tutup tetingkap ini."
Write-Host ""
Start-Sleep -Seconds 3

# ---------------------------------------------------------------- 1. Alat asas
Say "Langkah 1/6: Memeriksa alat yang diperlukan..."

$needGo = $true
if (Get-Command go -ErrorAction SilentlyContinue) {
    if ((go version) -match 'go(\d+)\.(\d+)') {
        if ([int]$Matches[1] -gt 1 -or ([int]$Matches[1] -eq 1 -and [int]$Matches[2] -ge 25)) {
            $needGo = $false
            Ok "Go sudah dipasang"
        }
    }
}

$needMsys = -not (Test-Path "C:\msys64\ucrt64\bin\gcc.exe")
$needGit  = -not (Get-Command git -ErrorAction SilentlyContinue)

if ($needGo -or $needMsys -or $needGit) {
    Say "Memasang alat pembinaan (Go / pengkompil C / Git)..."
    Warn "Klik YES pada popup Windows"

    $installScript = ""
    if ($needGit)  { $installScript += "winget install --silent --accept-source-agreements --accept-package-agreements Git.Git`n" }
    if ($needGo)   { $installScript += "winget install --silent --accept-source-agreements --accept-package-agreements GoLang.Go`n" }
    if ($needMsys) { $installScript += "winget install --silent --accept-source-agreements --accept-package-agreements MSYS2.MSYS2`n" }
    Invoke-Admin $installScript

    Refresh-Path
    Ok "Alat dipasang"
}

if (-not (Test-Path "C:\msys64\ucrt64\bin\gcc.exe")) {
    Say "Memasang pengkompil C dalam MSYS2 (2-5 minit)..."
    & "C:\msys64\usr\bin\bash.exe" -lc "pacman -Syu --noconfirm; pacman -S --noconfirm mingw-w64-ucrt-x86_64-gcc" | Out-Null
    Ok "Pengkompil C dipasang"
}

$env:PATH = "C:\msys64\ucrt64\bin;$env:PATH"
Refresh-Path
$env:PATH = "C:\msys64\ucrt64\bin;$env:PATH"
go env -w CGO_ENABLED=1

# ------------------------------------------------------------- 2. Muat turun
Say "Langkah 2/6: Memuat turun bridge WhatsApp..."
if (Test-Path $REPO) {
    Push-Location $REPO
    git pull --ff-only 2>&1 | Out-Null
    Pop-Location
    Ok "Bridge dikemas kini"
} else {
    New-Item -ItemType Directory -Force -Path (Split-Path $REPO) | Out-Null
    git clone https://github.com/vimigo-lee/whatsapp-mcp-go.git $REPO 2>&1 | Out-Null
    Ok "Bridge dimuat turun"
}

# --------------------------------------------------------------- 3. Rahsia
Say "Langkah 3/6: Menyediakan tetapan..."

$envFile = "$REPO\whatsapp-bridge\.env"
if (Test-Path $envFile) {
    $apiKey    = (Select-String -Path $envFile -Pattern '^WHATSAPP_API_KEY=(.+)$').Matches.Groups[1].Value
    $jwtSecret = (Select-String -Path $envFile -Pattern '^WHATSAPP_JWT_SECRET=(.+)$').Matches.Groups[1].Value
    Ok "Tetapan sedia ada digunakan semula"
} else {
    $apiKey    = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
    $jwtSecret = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
    Ok "Tetapan baru dijana"
}

@"
WHATSAPP_API_KEY=$apiKey
WHATSAPP_JWT_SECRET=$jwtSecret
IS_POSTGRES=false
PORT=8080
LOG_LEVEL=info
BRIDGE_TZ=Asia/Kuala_Lumpur
WEBHOOK_URL=$WEBHOOK
"@ | Out-File $envFile -Encoding UTF8

@"
WHATSAPP_API_KEY=$apiKey
API_BASE_URL=http://localhost:8080/api
IS_HTTP=false
"@ | Out-File "$REPO\whatsapp-mcp-server\.env" -Encoding UTF8

# ---------------------------------------------------------------- 4. Bina
Say "Langkah 4/6: Membina bridge (1-3 minit)..."
Push-Location "$REPO\whatsapp-bridge"
$env:CGO_ENABLED = "1"
go mod tidy 2>&1 | Out-Null
go build -o whatsapp-bridge.exe . 2>&1 | Out-Null
Pop-Location

if (-not (Test-Path "$REPO\whatsapp-bridge\whatsapp-bridge.exe")) {
    Write-Host ""
    Write-Host "GAGAL membina bridge. Sila hantar mesej ini kepada Claude." -ForegroundColor Red
    Read-Host "Tekan Enter untuk tutup"
    exit 1
}
Ok "Bridge siap dibina"

# ------------------------------------------------------------- 5. Servis
Say "Langkah 5/6: Memasang servis latar belakang..."
Warn "Klik YES pada popup Windows"

if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
    Invoke-Admin "winget install --silent --accept-source-agreements --accept-package-agreements NSSM.NSSM"
    Refresh-Path
    $env:PATH = "$env:ProgramFiles\NSSM;$env:PATH"
}

$svc = @"
nssm stop WhatsAppBridge 2>`$null
nssm remove WhatsAppBridge confirm 2>`$null
nssm install WhatsAppBridge '$REPO\whatsapp-bridge\whatsapp-bridge.exe'
nssm set WhatsAppBridge AppDirectory '$REPO\whatsapp-bridge'
nssm set WhatsAppBridge AppEnvironmentExtra 'PATH=C:\msys64\ucrt64\bin;C:\Windows\System32;C:\Windows' 'WHATSAPP_API_KEY=$apiKey' 'WHATSAPP_JWT_SECRET=$jwtSecret' 'IS_POSTGRES=false' 'PORT=8080' 'LOG_LEVEL=info' 'BRIDGE_TZ=Asia/Kuala_Lumpur' 'WEBHOOK_URL=$WEBHOOK'
nssm set WhatsAppBridge AppStdout '$REPO\whatsapp-bridge\bridge.log'
nssm set WhatsAppBridge AppStderr '$REPO\whatsapp-bridge\bridge.err'
nssm set WhatsAppBridge AppRotateFiles 1
nssm set WhatsAppBridge AppRotateBytes 10485760
nssm set WhatsAppBridge Start SERVICE_AUTO_START
nssm start WhatsAppBridge
"@
Invoke-Admin $svc
Start-Sleep -Seconds 5
Ok "Servis dipasang (akan hidup automatik setiap kali komputer dibuka)"

# ------------------------------------------------------------- 6. QR code
Say "Langkah 6/6: Menyambung ke WhatsApp..."
Write-Host ""
Write-Host "  Bridge sedang berjalan. Sekarang anda perlu imbas QR code." -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Buka WhatsApp pada telefon"
Write-Host "  2. Tekan tiga titik (menu) di penjuru atas"
Write-Host "  3. Pilih 'Linked Devices' / 'Peranti Berpaut'"
Write-Host "  4. Tekan 'Link a Device' / 'Paut Peranti'"
Write-Host "  5. Imbas QR code yang akan muncul di bawah"
Write-Host ""
Write-Host "  Menunggu QR code..." -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 8
$log = "$REPO\whatsapp-bridge\bridge.log"
if (Test-Path $log) { Get-Content $log -Tail 60 }

Write-Host ""
Write-Host "==============================================" -ForegroundColor White
Write-Host "  SELESAI" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor White
Write-Host ""
Write-Host "Jika QR code tidak kelihatan di atas, jalankan:"
Write-Host "  $REPO\lihat-qr.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "Selepas imbas QR, mesej group WhatsApp akan masuk"
Write-Host "ke dashboard secara automatik dalam beberapa minit."
Write-Host ""
Read-Host "Tekan Enter untuk tutup"
