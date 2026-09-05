@echo off
chcp 65001 >nul
title TerminAI — rezervacijski sistem
cd /d "%~dp0app"
set "DATABASE_URL=file:%~dp0app\custom.db"
set "DATABASE_URL=%DATABASE_URL:\=/%"
set AI_ENABLED=false
set PORT=3456
set HOSTNAME=0.0.0.0

echo.
echo  ==============================================
echo   TERMINAI — zaganjam rezervacijski sistem ...
echo   Racunalnik mora pustiti program skozi
echo   pozigasnemu oknu (Windows Defender / firewall).
echo  ==============================================
echo.
echo  Naslov za ta racunalnik:  http://localhost:3456
echo.
echo  WiFi naslov za telefone strank (iste omrezje):
ipconfig | findstr /i "IPv4"
echo.

start "" cmd /c "timeout /t 5 >nul & start http://localhost:3456"

"..untimeun.exe" server.js
echo.
echo  Aplikacija se je ustavila. Pritisnite tipko za izhod.
pause >nul
