@echo off
chcp 65001 >nul
title TerminAI — rezervna kopija

set "SRC=%~dp0app\custom.db"
if not exist "%SRC%" set "SRC=C:\TerminAI\app\custom.db"

if not exist "%SRC%" (
  echo  Baza ni najdena. Ali je aplikacija ze namestcena?
  pause
  exit /b 1
)

if not exist "%~dp0REZERVA" mkdir "%~dp0REZERVA"

powershell -NoProfile -Command ^
  "Copy-Item '%SRC%' ('%~dp0REZERVA\baza-' + (Get-Date -Format 'yyyy-MM-dd-HHmm') + '.db')"

echo.
echo  REZERVNA KOPIJA NAREJENA v mapo REZERVA na USB kljucku.
echo  (Ponesite kljuc z vsakim obiskom!)
echo.
pause
