@echo off
title QR Code WhatsApp - Masdora
echo.
echo Memaparkan QR code terkini dari bridge WhatsApp...
echo.
echo Imbas dengan telefon: WhatsApp ^> tiga titik ^> Linked Devices ^> Link a Device
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Content 'C:\Dev\whatsapp-mcp-go\whatsapp-bridge\bridge.log' -Tail 80 -Wait"
pause
