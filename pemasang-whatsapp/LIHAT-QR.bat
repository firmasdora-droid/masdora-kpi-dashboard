@echo off
title QR Code WhatsApp - Masdora
mode con: cols=120 lines=50
echo.
echo Memaparkan QR code terkini dari bridge WhatsApp...
echo.
echo Imbas dengan telefon:
echo   WhatsApp ^> tiga titik ^> Linked Devices ^> Link a Device
echo.
echo (Tekan Ctrl+C untuk tutup)
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Content 'C:\Dev\whatsapp-mcp-go\whatsapp-bridge\bridge.log' -Tail 100 -Wait"
pause
