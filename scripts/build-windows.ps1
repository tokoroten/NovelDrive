# Build script for Windows
# This script builds and runs NovelDrive on Windows

Write-Host "NovelDrive Windows Build Script" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Error: Node.js is not installed" -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "npm version: $npmVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Error: npm is not installed" -ForegroundColor Red
    exit 1
}

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path "node_modules")) {
    Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Run the application
Write-Host "`nStarting NovelDrive..." -ForegroundColor Green
$env:NODE_ENV = "development"
npm start

if ($LASTEXITCODE -ne 0) {
    Write-Host "Application exited with error" -ForegroundColor Red
} else {
    Write-Host "Application closed successfully" -ForegroundColor Green
}