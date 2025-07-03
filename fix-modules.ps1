# Fix Native Modules for Electron
Write-Host "=== Fixing Native Modules for Electron ===" -ForegroundColor Green
Write-Host ""

# Get Electron version
$electronVersion = (Get-Content package.json | ConvertFrom-Json).devDependencies.electron
Write-Host "Electron version: $electronVersion" -ForegroundColor Cyan

# Install electron-rebuild globally
Write-Host "Installing electron-rebuild..." -ForegroundColor Yellow
npm install -g electron-rebuild

# Clean node_modules for better-sqlite3
Write-Host "Cleaning better-sqlite3..." -ForegroundColor Yellow
if (Test-Path "node_modules\better-sqlite3") {
    Remove-Item -Recurse -Force "node_modules\better-sqlite3"
}

# Reinstall better-sqlite3
Write-Host "Reinstalling better-sqlite3..." -ForegroundColor Yellow
npm install better-sqlite3 --save --force

# Rebuild for Electron
Write-Host "Rebuilding for Electron..." -ForegroundColor Yellow
npx electron-rebuild -f -w better-sqlite3

# Alternative: Use prebuilt binaries
Write-Host ""
Write-Host "If rebuild fails, trying prebuilt-install..." -ForegroundColor Yellow
cd node_modules\better-sqlite3
npx prebuild-install --runtime=electron --target=37.2.0 --arch=x64 --platform=win32 --verbose
cd ..\..

Write-Host ""
Write-Host "Testing better-sqlite3 with Electron..." -ForegroundColor Green

# Test with Electron's node
$testScript = @'
const { app } = require('electron');

app.whenReady().then(() => {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE test (id INTEGER)');
    console.log('✅ better-sqlite3 works with Electron!');
    app.quit();
  } catch (error) {
    console.error('❌ Error:', error.message);
    app.exit(1);
  }
});
'@

$testScript | Out-File -FilePath "test-electron-sqlite.js" -Encoding UTF8
npx electron test-electron-sqlite.js
Remove-Item -Force "test-electron-sqlite.js"