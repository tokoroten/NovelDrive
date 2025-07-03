# NovelDrive Fix and Test Script
Write-Host "=== NovelDrive Fix and Test ===" -ForegroundColor Green
Write-Host ""

# Check Node version
Write-Host "1. Checking Node.js version..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "Current Node.js version: $nodeVersion" -ForegroundColor Gray

# Clean everything
Write-Host ""
Write-Host "2. Cleaning build artifacts and dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force package-lock.json
}
if (Test-Path "dist") {
    Remove-Item -Recurse -Force dist
}
if (Test-Path "$env:USERPROFILE\.noveldrive\noveldrive.db") {
    Write-Host "Removing corrupted database..." -ForegroundColor Yellow
    Remove-Item -Force "$env:USERPROFILE\.noveldrive\noveldrive.db"
}

# Install dependencies
Write-Host ""
Write-Host "3. Installing dependencies..." -ForegroundColor Yellow
npm install --force

# Build TypeScript
Write-Host ""
Write-Host "4. Building TypeScript..." -ForegroundColor Yellow
npm run build:main

# Test without Electron first
Write-Host ""
Write-Host "5. Testing SQLite3 directly..." -ForegroundColor Yellow
$testScript = @'
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('Testing SQLite3...');
try {
    const dbPath = path.join(__dirname, 'test.db');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    
    const db = new Database(dbPath);
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.prepare('INSERT INTO test (name) VALUES (?)').run('Test');
    const result = db.prepare('SELECT * FROM test').get();
    console.log('Result:', result);
    db.close();
    fs.unlinkSync(dbPath);
    console.log('SQLite3 test passed!');
} catch (error) {
    console.error('SQLite3 test failed:', error);
    process.exit(1);
}
'@
$testScript | Out-File -FilePath "test-sqlite.js" -Encoding UTF8
node test-sqlite.js
Remove-Item -Force "test-sqlite.js"

# Run migration
Write-Host ""
Write-Host "6. Running database migration..." -ForegroundColor Yellow
npm run db:migrate

Write-Host ""
Write-Host "7. Starting the application..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
npm start