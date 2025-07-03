# NovelDrive Windows Test Script
Write-Host "=== NovelDrive Windows Test ===" -ForegroundColor Green
Write-Host ""

# Check if npm is installed
Write-Host "1. Checking environment..." -ForegroundColor Yellow
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Error: npm is not installed" -ForegroundColor Red
    exit 1
}
Write-Host "npm version: $(npm --version)" -ForegroundColor Gray

# Clean and reinstall
Write-Host ""
Write-Host "2. Cleaning and reinstalling dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force package-lock.json
}

npm install --force

# Rebuild native modules
Write-Host ""
Write-Host "3. Rebuilding native modules for Electron..." -ForegroundColor Yellow
npm run rebuild

# Run migration test
Write-Host ""
Write-Host "4. Testing database migration..." -ForegroundColor Yellow
npm run db:migrate

# Run the application
Write-Host ""
Write-Host "5. Starting the application..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
npm start