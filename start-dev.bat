@echo off
setlocal

rem Launch the native Windows development stack through the PowerShell helper.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dev.ps1"
set "START_DEV_EXIT=%ERRORLEVEL%"

if not "%START_DEV_EXIT%"=="0" (
    echo.
    echo The SMS Gateway development stack did not start.
    pause
)

exit /b %START_DEV_EXIT%
