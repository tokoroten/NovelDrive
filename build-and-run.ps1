# Build and run with proper module resolution
Write-Host "=== Building NovelDrive ===" -ForegroundColor Green

# Clean dist
Write-Host "Cleaning dist directory..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force dist
}

# Build with TypeScript (CommonJS)
Write-Host "Building with TypeScript..." -ForegroundColor Yellow

# Create a temporary tsconfig for CommonJS
$tsconfig = @'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "./dist/main",
    "lib": ["ES2022"],
    "noEmit": false,
    "incremental": false,
    "noEmitOnError": false,
    "skipLibCheck": true,
    "allowJs": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": [
    "src/main/**/*",
    "src/shared/**/*"
  ],
  "exclude": [
    "node_modules",
    "src/renderer/**/*",
    "src/main/commands/**/*",
    "src/demo/**/*"
  ]
}
'@

$tsconfig | Out-File -FilePath "tsconfig.build.json" -Encoding UTF8

# Build
npx tsc -p tsconfig.build.json

# Remove temp config
Remove-Item -Force "tsconfig.build.json"

# Check if database.js exists
if (!(Test-Path "dist\main\main\database.js")) {
    Write-Host "Warning: database.js not found in dist" -ForegroundColor Yellow
    
    # List what was built
    Write-Host "Built files:" -ForegroundColor Yellow
    Get-ChildItem -Path "dist\main\main" -Filter "*.js" | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" }
}

# Start Electron
Write-Host ""
Write-Host "Starting Electron..." -ForegroundColor Green
npx electron .