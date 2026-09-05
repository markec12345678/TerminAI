@echo off
chcp 65001 >nul
title TerminAI — namestitev

echo.
echo  ==============================================
echo   TERMINAI — namestitev na ta racunalnik
echo  ==============================================
echo.

set "TARGET=C:\TerminAI"
if exist "%TARGET%" (
  echo  Mapa %TARGET% ze obstaja — vsebino posodobim.
) else (
  mkdir "%TARGET%"
)

xcopy /E /I /Y "%~dp0app" "%TARGET%\app" >nul
xcopy /E /I /Y "%~dp0runtime" "%TARGET%\runtime" >nul

REM Ustvari rezervno mapo
if not exist "%TARGET%\REZERVA" mkdir "%TARGET%\REZERVA"

REM Bližnjica na namizje
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$sc = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\TerminAI.lnk'); " ^
  "$sc.TargetPath = '%TARGET%\ZAGON.bat'; " ^
  "$sc.WorkingDirectory = '%TARGET%'; " ^
  "$sc.Description = 'TerminAI — rezervacijski sistem'; " ^
  "$sc.Save()"

REM Kopiraj zaganjalnik v koren
copy /Y "%~dp0ZAGON.bat" "%TARGET%\ZAGON.bat" >nul
copy /Y "%~dp0NAREDI-REZERVO.bat" "%TARGET%\NAREDI-REZERVO.bat" >nul

echo  Namestitev koncana!
echo  Bližnjica TERMINAI je na namizju.
echo.
echo  Zazenem sedaj? (pritisnite tipko)
pause >nul
start "" "%TARGET%\ZAGON.bat"
exit
