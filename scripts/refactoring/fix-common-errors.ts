#!/usr/bin/env node

/**
 * 共通のビルドエラーを自動修正するスクリプト
 * 
 * 使用方法:
 * npx tsx scripts/refactoring/fix-common-errors.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface Replacement {
  pattern: RegExp;
  replacement: string;
  description: string;
  filePattern?: RegExp;
}

// 修正パターンの定義
const replacements: Replacement[] = [
  // API名称の統一
  {
    pattern: /\bAPIUsageLogger\b/g,
    replacement: 'ApiUsageLogger',
    description: 'APIUsageLogger → ApiUsageLogger'
  },
  
  // プロパティ名の修正
  {
    pattern: /\.duration\b/g,
    replacement: '.durationMs',
    description: 'duration → durationMs',
    filePattern: /api-usage|api_usage/i
  },
  {
    pattern: /\bapi_type\b/g,
    replacement: 'apiType',
    description: 'api_type → apiType'
  },
  {
    pattern: /\btotal_tokens\b/g,
    replacement: 'totalTokens',
    description: 'total_tokens → totalTokens'
  },
  {
    pattern: /\btotal_cost\b/g,
    replacement: 'totalCost',
    description: 'total_cost → totalCost'
  },
  {
    pattern: /\brequest_count\b/g,
    replacement: 'requestCount',
    description: 'request_count → requestCount'
  },
  {
    pattern: /\bsuccess_count\b/g,
    replacement: 'successCount',
    description: 'success_count → successCount'
  },
  {
    pattern: /\berror_count\b/g,
    replacement: 'errorCount',
    description: 'error_count → errorCount'
  },
  {
    pattern: /\bavg_duration_ms\b/g,
    replacement: 'avgDurationMs',
    description: 'avg_duration_ms → avgDurationMs'
  },
  {
    pattern: /\bestimated_cost\b/g,
    replacement: 'estimatedCost',
    description: 'estimated_cost → estimatedCost'
  }
];

// DuckDB conn.get() の修正パターン
const duckdbGetPattern = /conn\.get\s*\(\s*([^,]+),\s*([^,]+),\s*\(([^,]+),\s*([^)]+)\)\s*=>\s*{([^}]+)}\s*\)/g;

// ファイルを再帰的に取得
function getTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        // node_modulesとdistは除外
        if (!['node_modules', 'dist', '.git'].includes(entry.name)) {
          traverse(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

// ファイルの内容を修正
function fixFile(filePath: string): { modified: boolean; changes: string[] } {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const changes: string[] = [];
  
  // 基本的な置換
  for (const { pattern, replacement, description, filePattern } of replacements) {
    // ファイルパターンが指定されている場合はチェック
    if (filePattern && !filePattern.test(filePath)) {
      continue;
    }
    
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      changes.push(`${description} (${matches.length} occurrences)`);
    }
  }
  
  // DuckDB conn.get() の修正
  if (content.includes('conn.get')) {
    content = content.replace(
      duckdbGetPattern,
      `conn.all($1, $2, ($3, rows) => {
        if ($3) return $4($3);
        $4(null, rows?.[0]);
      })`
    );
    
    // より単純なパターンの場合
    content = content.replace(
      /conn\.get\(/g,
      'conn.all('
    );
    
    changes.push('conn.get → conn.all');
  }
  
  const modified = content !== originalContent;
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }
  
  return { modified, changes };
}

// メイン処理
async function main() {
  console.log('🔧 共通ビルドエラーの自動修正を開始します...\n');
  
  const srcPath = path.join(process.cwd(), 'src');
  const files = getTypeScriptFiles(srcPath);
  
  console.log(`📁 ${files.length} 個のTypeScriptファイルを検出しました\n`);
  
  let modifiedCount = 0;
  const allChanges: Map<string, string[]> = new Map();
  
  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    const { modified, changes } = fixFile(file);
    
    if (modified) {
      modifiedCount++;
      allChanges.set(relativePath, changes);
    }
  }
  
  // 結果の表示
  console.log('\n📊 修正結果:\n');
  console.log(`✅ 修正されたファイル: ${modifiedCount} / ${files.length}\n`);
  
  if (modifiedCount > 0) {
    console.log('📝 変更内容:\n');
    
    for (const [file, changes] of allChanges) {
      console.log(`  ${file}:`);
      for (const change of changes) {
        console.log(`    - ${change}`);
      }
      console.log('');
    }
  }
  
  // TypeScriptビルドの確認
  console.log('🏗️  TypeScriptビルドを確認中...\n');
  
  try {
    execSync('npx tsc -p tsconfig.main.json --noEmit', { stdio: 'pipe' });
    console.log('✅ ビルドエラーなし！');
  } catch (error) {
    const output = error.toString();
    const errorCount = (output.match(/error TS/g) || []).length;
    console.log(`⚠️  残りのビルドエラー: ${errorCount} 個`);
    console.log('\n以下のエラーは手動での修正が必要です:');
    console.log(output.substring(0, 1000) + '...');
  }
  
  console.log('\n🎉 自動修正が完了しました！');
  console.log('📌 次のステップ:');
  console.log('  1. git diff で変更内容を確認');
  console.log('  2. npm run build:main で残りのエラーを確認');
  console.log('  3. 手動で残りのエラーを修正');
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});

// 実行
main().catch((error) => {
  console.error('❌ エラーが発生しました:', error);
  process.exit(1);
});