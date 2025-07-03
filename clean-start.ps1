# Clean Start Script for NovelDrive
Write-Host "=== Clean Start for NovelDrive ===" -ForegroundColor Green
Write-Host ""

# 1. Stop all Node processes
Write-Host "1. Stopping all Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Clean all data directories
Write-Host "2. Cleaning data directories..." -ForegroundColor Yellow

# Remove NovelDrive data directory
$novelDriveDir = "$env:USERPROFILE\.noveldrive"
if (Test-Path $novelDriveDir) {
    Write-Host "   Removing $novelDriveDir" -ForegroundColor Gray
    Remove-Item -Recurse -Force $novelDriveDir
}

# Remove any test databases
Get-ChildItem -Path . -Filter "*.db" | ForEach-Object {
    Write-Host "   Removing $($_.Name)" -ForegroundColor Gray
    Remove-Item -Force $_
}

# 3. Clean build artifacts
Write-Host "3. Cleaning build artifacts..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force dist
}

# 4. Rebuild
Write-Host "4. Building application..." -ForegroundColor Yellow
npx tsc -p tsconfig.main.json --transpileOnly

# 5. Create clean database directory
Write-Host "5. Creating clean database directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $novelDriveDir | Out-Null

# 6. Test SQLite3 directly
Write-Host "6. Testing SQLite3..." -ForegroundColor Yellow
$testScript = @'
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.env.USERPROFILE, '.noveldrive', 'test.db');
console.log('Creating test database at:', dbPath);

try {
    const db = new Database(dbPath);
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    db.prepare('INSERT INTO test (id) VALUES (?)').run(1);
    console.log('SQLite3 test passed!');
    db.close();
    fs.unlinkSync(dbPath);
} catch (error) {
    console.error('SQLite3 test failed:', error);
}
'@

$testScript | Out-File -FilePath "sqlite-test.js" -Encoding UTF8
node sqlite-test.js
Remove-Item -Force "sqlite-test.js"

# 7. Start application
Write-Host ""
Write-Host "7. Starting NovelDrive..." -ForegroundColor Green
npx electron .