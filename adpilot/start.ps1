# AdPilot AI — Start Script (PowerShell)
# Run this from the adpilot/ directory: .\start.ps1

$ROOT = $PSScriptRoot

Write-Host "Starting AdPilot AI..." -ForegroundColor Cyan

# Backend
Write-Host "Setting up backend..." -ForegroundColor Yellow
$backendCmd = @"
cd '$ROOT\backend'
if (-not (Test-Path '.venv')) {
    uv venv .venv --python 3.12 --quiet
    uv pip install -r requirements.txt --quiet
}
& '.venv\Scripts\python.exe' -m uvicorn main:app --reload --port 8000
"@
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $backendCmd -WindowStyle Normal

Start-Sleep -Seconds 4

# Frontend
Write-Host "Setting up frontend..." -ForegroundColor Yellow
$frontendCmd = @"
cd '$ROOT\frontend'
if (-not (Test-Path 'node_modules')) { npm install --silent }
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $frontendCmd -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "AdPilot AI is starting!" -ForegroundColor Green
Write-Host "  App:     http://localhost:5173" -ForegroundColor White
Write-Host "  API:     http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Click 'Load Demo Data' on the dashboard to start exploring." -ForegroundColor Cyan

Start-Sleep -Seconds 3
