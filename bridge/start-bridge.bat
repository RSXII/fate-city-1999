@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed, or not on PATH.
  echo Download it from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies, this only happens once...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed - see errors above.
    pause
    exit /b 1
  )
)

echo.
echo Starting Fate City Foundry bridge on port 8787...
echo Leave this window open while running your session. Closing it stops the bridge.
echo.
node server.js

echo.
echo Bridge stopped or crashed - see any error above.
pause
