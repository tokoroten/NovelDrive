# Electron Upgrade Script
Write-Host "=== Upgrading Electron to Latest Version ===" -ForegroundColor Green
Write-Host ""

# Check current versions
Write-Host "1. Current versions:" -ForegroundColor Yellow
Write-Host "Node.js: $(node --version)" -ForegroundColor Gray
Write-Host "npm: $(npm --version)" -ForegroundColor Gray
Write-Host ""

# Clean everything
Write-Host "2. Cleaning old dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force package-lock.json
}
if (Test-Path "dist") {
    Remove-Item -Recurse -Force dist
}

# Clean npm cache
Write-Host "3. Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force

# Install with latest Electron
Write-Host ""
Write-Host "4. Installing dependencies with Electron 32..." -ForegroundColor Yellow
npm install --force

# Rebuild native modules
Write-Host ""
Write-Host "5. Rebuilding native modules for Electron 32..." -ForegroundColor Yellow
npm run rebuild

# Build TypeScript
Write-Host ""
Write-Host "6. Building TypeScript..." -ForegroundColor Yellow
npm run build:main

# Test SQLite3 directly
Write-Host ""
Write-Host "7. Testing SQLite3..." -ForegroundColor Yellow
node test-direct.js

# Run migration
Write-Host ""
Write-Host "8. Running database migration..." -ForegroundColor Yellow
npm run db:migrate

Write-Host ""
Write-Host "✅ Upgrade complete! Starting application..." -ForegroundColor Green
npm start