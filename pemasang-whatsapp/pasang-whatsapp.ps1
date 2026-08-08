# =============================================================================
# PEMASANG BRIDGE WHATSAPP — Masdora Team Dashboard
#
# Memasang "jambatan" WhatsApp pada komputer ini supaya mesej dari group
# WhatsApp team dihantar terus ke dashboard.
#
# Tidak memerlukan kebenaran admin. Tidak menggunakan winget.
# Semua alat dimuat turun sebagai fail zik mudah alih ke C:\Dev\masdora-tools.
#
# JANGAN jalankan fail ini terus — klik dua kali "PASANG.bat".
# =============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"   # muat turun jauh lebih laju

$TOOLS   = "C:\Dev\masdora-tools"
$REPO    = "C:\Dev\whatsapp-mcp-go"
$WEBHOOK = "https://masdora-kpi-dashboard.vercel.app/api/ingest/whatsapp?secret=96ec6d03610a4915739f9e450670ffa5544274846c150d06"

$GCC_ZIP = "https://github.com/brechtsanders/winlibs_mingw/releases/download/16.1.0posix-14.0.0-ucrt-r4/winlibs-x86_64-posix-seh-gcc-16.1.0-mingw-w64ucrt-14.0.0-r4.zip"

function Say($m)  { Write-Host "`n>> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "   OK - $m" -ForegroundColor Green }
function Info($m) { Write-Host "   $m" -ForegroundColor Gray }
function Die($m)  {
    Write-Host ""
    Write-Host "GAGAL: $m" -ForegroundColor Red
    Write-Host ""
    Write-Host "Sila ambil gambar skrin tetingkap ini dan hantar kepada Claude." -ForegroundColor Yellow
    Read-Host "Tekan Enter untuk tutup"
    exit 1
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor White
Write-Host "  PEMASANG BRIDGE WHATSAPP - MASDORA" -ForegroundColor White
Write-Host "===============================================" -ForegroundColor White
Write-Host ""
Write-Host "Proses ini ambil masa 10-20 minit (muat turun besar)."
Write-Host "Jangan tutup tetingkap ini."
Write-Host ""
Write-Host "Tiada kebenaran admin diperlukan." -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 2

New-Item -ItemType Directory -Force -Path $TOOLS | Out-Null

# ------------------------------------------------------------------ 1. Go
Say "Langkah 1/6: Menyediakan Go..."

$goExe = "$TOOLS\go\bin\go.exe"
if (Test-Path $goExe) {
    Ok "Go sudah sedia"
} else {
    try {
        $goVer = (Invoke-WebRequest -Uri "https://go.dev/VERSION?m=text" -UseBasicParsing).Content.Split("`n")[0].Trim()
    } catch {
        $goVer = "go1.26.5"
    }
    Info "Memuat turun $goVer (lebih kurang 80 MB)..."
    $goZip = "$TOOLS\go.zip"
    try {
        Invoke-WebRequest -Uri "https://go.dev/dl/$goVer.windows-amd64.zip" -OutFile $goZip -UseBasicParsing
    } catch {
        Die "Tidak dapat memuat turun Go. Semak sambungan internet."
    }
    Info "Mengekstrak Go..."
    Expand-Archive -Path $goZip -DestinationPath $TOOLS -Force
    Remove-Item $goZip -ErrorAction SilentlyContinue
    if (-not (Test-Path $goExe)) { Die "Go gagal diekstrak." }
    Ok "Go sedia"
}

# ----------------------------------------------------------------- 2. gcc
Say "Langkah 2/6: Menyediakan pengkompil C..."

$gccExe = "$TOOLS\mingw64\bin\gcc.exe"
if (Test-Path $gccExe) {
    Ok "Pengkompil C sudah sedia"
} else {
    Info "Memuat turun pengkompil (lebih kurang 130 MB, 3-8 minit)..."
    $gccZip = "$TOOLS\gcc.zip"
    try {
        Invoke-WebRequest -Uri $GCC_ZIP -OutFile $gccZip -UseBasicParsing
    } catch {
        Die "Tidak dapat memuat turun pengkompil C. Semak sambungan internet."
    }
    Info "Mengekstrak pengkompil (2-5 minit)..."
    Expand-Archive -Path $gccZip -DestinationPath $TOOLS -Force
    Remove-Item $gccZip -ErrorAction SilentlyContinue
    if (-not (Test-Path $gccExe)) { Die "Pengkompil C gagal diekstrak." }
    Ok "Pengkompil C sedia"
}

# Guna alat tempatan sahaja untuk sesi ini
$env:PATH        = "$TOOLS\go\bin;$TOOLS\mingw64\bin;$env:PATH"
$env:GOROOT      = "$TOOLS\go"
$env:CGO_ENABLED = "1"

# ----------------------------------------------------------------- 3. Git
Say "Langkah 3/6: Memeriksa Git..."
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Die "Git tiada pada komputer ini. Sila pasang Git dari https://git-scm.com/download/win kemudian jalankan semula PASANG.bat"
}
Ok "Git sedia"

# ------------------------------------------------------------ 4. Muat turun
Say "Langkah 4/6: Memuat turun bridge WhatsApp..."
if (Test-Path "$REPO\.git") {
    Push-Location $REPO
    git pull --ff-only 2>&1 | Out-Null
    Pop-Location
    Ok "Bridge dikemas kini"
} else {
    New-Item -ItemType Directory -Force -Path (Split-Path $REPO) | Out-Null
    git clone https://github.com/vimigo-lee/whatsapp-mcp-go.git $REPO 2>&1 | Out-Null
    if (-not (Test-Path "$REPO\whatsapp-bridge")) { Die "Gagal memuat turun bridge." }
    Ok "Bridge dimuat turun"
}

# --------------------------------------------------------- 5. Tetapan + bina
Say "Langkah 5/6: Membina bridge (2-5 minit)..."

$envFile = "$REPO\whatsapp-bridge\.env"
if (Test-Path $envFile) {
    $apiKey    = (Select-String -Path $envFile -Pattern '^WHATSAPP_API_KEY=(.+)$').Matches.Groups[1].Value
    $jwtSecret = (Select-String -Path $envFile -Pattern '^WHATSAPP_JWT_SECRET=(.+)$').Matches.Groups[1].Value
} else {
    $apiKey    = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
    $jwtSecret = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
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

Push-Location "$REPO\whatsapp-bridge"
Info "Mengumpul kebergantungan..."
& go mod tidy 2>&1 | Out-Null
Info "Membina..."
& go build -o whatsapp-bridge.exe . 2>&1 | Tee-Object -Variable buildOut | Out-Null
Pop-Location

if (-not (Test-Path "$REPO\whatsapp-bridge\whatsapp-bridge.exe")) {
    Write-Host ""
    Write-Host "Ralat pembinaan:" -ForegroundColor Red
    $buildOut | Select-Object -Last 25
    Die "Bridge gagal dibina."
}
Ok "Bridge siap dibina"

# ------------------------------------------------------- 6. Auto-mula + jalan
Say "Langkah 6/6: Menyediakan auto-mula..."

# Skrip pemula (tanpa admin — guna folder Startup pengguna)
$runBat = "$REPO\jalankan-bridge.bat"
@"
@echo off
cd /d "$REPO\whatsapp-bridge"
set "PATH=$TOOLS\mingw64\bin;%PATH%"
whatsapp-bridge.exe >> "$REPO\whatsapp-bridge\bridge.log" 2>&1
"@ | Out-File $runBat -Encoding ASCII

# Pembungkus VBS supaya ia berjalan senyap di latar belakang
$runVbs = "$REPO\jalankan-bridge-senyap.vbs"
@"
Set s = CreateObject("WScript.Shell")
s.Run """$runBat""", 0, False
"@ | Out-File $runVbs -Encoding ASCII

$startup = [Environment]::GetFolderPath('Startup')
Copy-Item $runVbs "$startup\Masdora-WhatsApp-Bridge.vbs" -Force
Ok "Bridge akan hidup automatik setiap kali komputer dibuka"

# Hentikan sebarang bridge lama, kemudian mula yang baru
Get-Process whatsapp-bridge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Remove-Item "$REPO\whatsapp-bridge\bridge.log" -ErrorAction SilentlyContinue

Info "Memulakan bridge..."
Start-Process -FilePath $runBat -WindowStyle Hidden
Start-Sleep -Seconds 10

# ---------------------------------------------------------------- QR code
Write-Host ""
Write-Host "===============================================" -ForegroundColor White
Write-Host "  IMBAS QR CODE DENGAN TELEFON" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor White
Write-Host ""
Write-Host "  1. Buka WhatsApp pada telefon"
Write-Host "  2. Tekan tiga titik (menu) di penjuru atas"
Write-Host "  3. Pilih 'Linked Devices'"
Write-Host "  4. Tekan 'Link a Device'"
Write-Host "  5. Halakan kamera ke QR code di bawah"
Write-Host ""

$log = "$REPO\whatsapp-bridge\bridge.log"
$waited = 0
while ($waited -lt 60) {
    if ((Test-Path $log) -and (Select-String -Path $log -Pattern "█|▄|▀" -Quiet -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Seconds 3
    $waited += 3
}

if (Test-Path $log) { Get-Content $log -Tail 80 }

Write-Host ""
Write-Host "===============================================" -ForegroundColor White
Write-Host "  PEMASANGAN SELESAI" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor White
Write-Host ""
Write-Host "Jika QR code tidak kelihatan, klik dua kali: LIHAT-QR.bat" -ForegroundColor Cyan
Write-Host ""
Write-Host "Selepas imbas QR, mesej group WhatsApp akan masuk ke"
Write-Host "dashboard secara automatik dalam beberapa minit."
Write-Host ""
Read-Host "Tekan Enter untuk tutup"
