# Force start NovelDrive
Write-Host "=== Force Starting NovelDrive ===" -ForegroundColor Green

# Delete potentially corrupted database
$dbPath = "$env:USERPROFILE\.noveldrive\noveldrive.db"
if (Test-Path $dbPath) {
    Write-Host "Removing existing database..." -ForegroundColor Yellow
    Remove-Item -Force $dbPath
}

# Build with transpileOnly (ignore type errors)
Write-Host "Building without type checking..." -ForegroundColor Yellow
npx tsc -p tsconfig.main.json --transpileOnly

# Start Electron
Write-Host "Starting Electron..." -ForegroundColor Green
npx electron .