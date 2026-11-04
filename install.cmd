@echo off
rem Doble clic para instalar la configuracion en %USERPROFILE%\.claude
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
