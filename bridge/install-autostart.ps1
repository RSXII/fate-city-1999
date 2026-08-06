# Fate City 1999 - Foundry bridge autostart installer
#
# Creates a shortcut in your Windows Startup folder that launches
# start-bridge.bat (minimized) whenever you log in, so you don't have to
# remember to start the bridge manually before a session.
#
# Run it by right-clicking this file -> "Run with PowerShell".
# If Windows blocks it with an execution-policy error, open PowerShell and run:
#   powershell -ExecutionPolicy Bypass -File install-autostart.ps1

$ErrorActionPreference = 'Stop'

$scriptDir = $PSScriptRoot
$batPath = Join-Path $scriptDir 'start-bridge.bat'
$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir 'Fate City Foundry Bridge.lnk'

if (-not (Test-Path $batPath)) {
  Write-Host "Could not find start-bridge.bat next to this script. Aborting." -ForegroundColor Red
  exit 1
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $batPath
$shortcut.WorkingDirectory = $scriptDir
$shortcut.WindowStyle = 7   # minimized
$shortcut.Description = 'Fate City 1999 Foundry bridge'
$shortcut.Save()

Write-Host ""
Write-Host "Done. The bridge will now start automatically (minimized) whenever you log in." -ForegroundColor Green
Write-Host "Shortcut created at:"
Write-Host "  $shortcutPath"
Write-Host ""
Write-Host "To remove autostart later, just delete that file."
