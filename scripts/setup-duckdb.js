#!/usr/bin/env node

/**
 * DuckDBセットアップスクリプト
 * 
 * このスクリプトはDuckDBのネイティブモジュールを正しくセットアップします。
 * Electronでネイティブモジュールを使用する際の一般的な問題を解決します。
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🦆 DuckDB Setup Script');
console.log('======================\n');

// 現在の環境情報を表示
console.log('📋 Environment Info:');
console.log(`  Node.js: ${process.version}`);
console.log(`  Platform: ${process.platform}`);
console.log(`  Arch: ${process.arch}`);

try {
  const electronVersion = execSync('npx electron --version', { encoding: 'utf8' }).trim();
  console.log(`  Electron: ${electronVersion}`);
} catch (error) {
  console.log('  Electron: Not found');
}

console.log('\n🔧 Setup Steps:\n');

// Step 1: node_modulesをクリーン
console.log('1. Cleaning node_modules/duckdb...');
const duckdbPath = path.join(__dirname, '..', 'node_modules', 'duckdb');
if (fs.existsSync(duckdbPath)) {
  try {
    fs.rmSync(path.join(duckdbPath, 'build'), { recursive: true, force: true });
    console.log('   ✓ Cleaned duckdb build directory');
  } catch (error) {
    console.log('   ⚠ Could not clean build directory:', error.message);
  }
}

// Step 2: ビルドツールの確認
console.log('\n2. Checking build tools...');
const buildTools = {
  'node-gyp': 'npm install -g node-gyp',
  'python': null,
  'make': null,
  'g++': 'sudo apt-get install build-essential (Linux) or install Xcode (macOS) or install Visual Studio Build Tools (Windows)'
};

let missingTools = [];
for (const [tool, installCmd] of Object.entries(buildTools)) {
  try {
    if (tool === 'python') {
      execSync('python --version', { stdio: 'ignore' });
    } else if (tool === 'node-gyp') {
      execSync('npm list -g node-gyp', { stdio: 'ignore' });
    } else {
      execSync(`which ${tool}`, { stdio: 'ignore' });
    }
    console.log(`   ✓ ${tool} found`);
  } catch (error) {
    console.log(`   ✗ ${tool} not found`);
    if (installCmd) {
      missingTools.push({ tool, installCmd });
    }
  }
}

if (missingTools.length > 0) {
  console.log('\n⚠️  Missing build tools detected!');
  console.log('Please install the following tools:');
  missingTools.forEach(({ tool, installCmd }) => {
    console.log(`  - ${tool}: ${installCmd}`);
  });
  console.log('\nFor detailed instructions, see: https://github.com/nodejs/node-gyp#installation');
}

// Step 3: electron-rebuildの実行
console.log('\n3. Rebuilding DuckDB for Electron...');
try {
  console.log('   Running electron-rebuild...');
  execSync('npx electron-rebuild -f -w duckdb', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('   ✓ DuckDB rebuilt successfully');
} catch (error) {
  console.log('   ✗ Failed to rebuild DuckDB');
  console.log('   Error:', error.message);
  
  // フォールバック: node-gypを直接使用
  console.log('\n   Trying fallback with node-gyp...');
  try {
    const electronVersion = execSync('npx electron --version', { encoding: 'utf8' }).trim().replace('v', '');
    const nodeAbi = execSync(`npx electron --abi ${electronVersion}`, { encoding: 'utf8' }).trim();
    
    process.chdir(duckdbPath);
    execSync(`npx node-gyp rebuild --target=${electronVersion} --arch=${process.arch} --dist-url=https://electronjs.org/headers`, {
      stdio: 'inherit'
    });
    console.log('   ✓ Fallback rebuild successful');
  } catch (fallbackError) {
    console.log('   ✗ Fallback also failed');
    console.log('   Error:', fallbackError.message);
  }
}

// Step 4: ビルド結果の確認
console.log('\n4. Verifying build...');
const builtModulePath = path.join(duckdbPath, 'build', 'Release', 'duckdb.node');
if (fs.existsSync(builtModulePath)) {
  const stats = fs.statSync(builtModulePath);
  console.log(`   ✓ Native module found: ${builtModulePath}`);
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
} else {
  console.log('   ✗ Native module not found at expected location');
  
  // 他の可能な場所を探す
  const alternativePaths = [
    path.join(duckdbPath, 'lib', 'binding', 'duckdb.node'),
    path.join(duckdbPath, 'prebuilds', `${process.platform}-${process.arch}`, 'duckdb.node')
  ];
  
  for (const altPath of alternativePaths) {
    if (fs.existsSync(altPath)) {
      console.log(`   ℹ Found at alternative location: ${altPath}`);
      break;
    }
  }
}

// Step 5: 簡単なテスト
console.log('\n5. Testing DuckDB...');
try {
  const testScript = `
    const duckdb = require('duckdb');
    const db = new duckdb.Database(':memory:');
    console.log('DuckDB loaded successfully!');
  `;
  execSync(`node -e "${testScript}"`, { cwd: path.join(__dirname, '..') });
  console.log('   ✓ DuckDB test passed');
} catch (error) {
  console.log('   ✗ DuckDB test failed');
  console.log('   Error:', error.message);
}

console.log('\n✨ Setup complete!\n');

// 追加の手順を表示
console.log('📝 Next steps:');
console.log('1. If the build failed, install missing build tools and run this script again');
console.log('2. Run "npm run dev" to start the development server');
console.log('3. If issues persist, try:');
console.log('   - npm cache clean --force');
console.log('   - rm -rf node_modules package-lock.json');
console.log('   - npm install');
console.log('   - npm run setup:duckdb');

// 環境変数の設定を推奨
console.log('\n💡 Tip: You can set these environment variables for better debugging:');
console.log('   export ELECTRON_REBUILD_DEBUG=true');
console.log('   export DEBUG=electron-rebuild');