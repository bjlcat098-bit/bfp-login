@echo off
title BFP Dashboard - Portable

echo =============================================
echo     BFP PDM + ROSTER - Portable Version
echo =============================================
echo.

:: Start local server and open browser
npx serve dist -l 3000 --single >nul 2>&1 &

timeout /t 3 >nul

start http://localhost:3000

echo.
echo Dashboard is running at: http://localhost:3000
echo.
echo Do not close this window while using the app.
echo.
pause