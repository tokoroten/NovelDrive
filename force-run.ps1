# Force run without type checking
Write-Host "=== Force Running NovelDrive ===" -ForegroundColor Green

# Install Sucrase for fast transpilation
Write-Host "Installing Sucrase..." -ForegroundColor Yellow
npm install --save-dev sucrase

# Clean dist directory
Write-Host "Cleaning dist directory..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force dist
}

# Create dist directories
New-Item -ItemType Directory -Force -Path "dist\main\main" | Out-Null
New-Item -ItemType Directory -Force -Path "dist\main\shared" | Out-Null

# Transpile with Sucrase (no type checking)
Write-Host "Transpiling TypeScript files..." -ForegroundColor Yellow
npx sucrase ./src/main -d ./dist/main/main --transforms typescript --quiet
npx sucrase ./src/shared -d ./dist/main/shared --transforms typescript --quiet

# Copy package.json to dist
Copy-Item package.json dist\main\

Write-Host "Starting Electron..." -ForegroundColor Green
npx electron .