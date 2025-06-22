# ビルドエラー修正優先順位リスト

## 優先度: 最高（コア機能に影響）

### 1. API名称の統一
**影響ファイル数: 10+**
- `APIUsageLogger` → `ApiUsageLogger` への統一
- 影響範囲: ログシステム全体

**修正方法:**
```bash
# 一括置換コマンド
find src -name "*.ts" -type f -exec sed -i 's/APIUsageLogger/ApiUsageLogger/g' {} +
```

### 2. DuckDB Connection API の修正
**影響ファイル数: 15+**
- `conn.get()` メソッドが存在しない問題
- 代替: `conn.all()` を使用して最初の結果を取得

**修正パターン:**
```typescript
// Before
conn.get(sql, params, callback);

// After
conn.all(sql, params, (err, rows) => {
  if (err) return callback(err);
  callback(null, rows?.[0]);
});
```

### 3. ApiUsageLog インターフェースのプロパティ名
**影響ファイル数: 8**
- `duration` → `durationMs`
- `api_type` → `apiType`
- スネークケースからキャメルケースへの統一

## 優先度: 高（機能動作に必要）

### 4. LocalEmbeddingService の環境変数
**影響ファイル: 1**
```typescript
// src/main/services/local-embedding-service.ts
// env.localURL と env.remoteURL が未定義

// 修正: デフォルト値を使用
const localURL = process.env.LOCAL_URL || 'http://localhost:3000';
const remoteURL = process.env.REMOTE_URL || 'https://models.example.com';
```

### 5. Discussion型のsummariesプロパティ
**影響ファイル: 3**
```typescript
// src/main/services/agents/discussion-manager.ts
export interface Discussion {
  // ... existing properties
  summaries?: DiscussionSummary[]; // 追加
}
```

## 優先度: 中（リファクタリング必要）

### 6. エラーハンドリングの統一
**影響ファイル: 20+**
- try-catchブロックでのエラー型の不一致
- Promise reject時の型安全性

### 7. 循環依存の解消
**主な問題箇所:**
- `database.ts` ↔ `database-handlers.ts`
- `openai-service.ts` ↔ `plot-generation-workflow.ts`

## 修正手順

### ステップ1: 自動修正可能な項目（30分）
```bash
# 1. API名称の一括置換
find src -name "*.ts" -exec sed -i 's/APIUsageLogger/ApiUsageLogger/g' {} +

# 2. プロパティ名の一括置換
find src -name "*.ts" -exec sed -i 's/\.duration\b/.durationMs/g' {} +
find src -name "*.ts" -exec sed -i 's/api_type/apiType/g' {} +
find src -name "*.ts" -exec sed -i 's/total_tokens/totalTokens/g' {} +
```

### ステップ2: 手動修正が必要な項目（2-3時間）

1. **DuckDB API の修正**
   - 各ファイルで `conn.get` を検索
   - 適切な `conn.all` パターンに置換

2. **型定義の追加**
   - `Discussion` インターフェースに `summaries` を追加
   - その他の不足している型定義を追加

### ステップ3: 動作確認（1時間）

```bash
# TypeScriptのビルド確認
npm run build:main

# エラーが残っている場合は個別対応
npx tsc -p tsconfig.main.json --noEmit
```

## 期待される成果

- ビルドエラーの80%以上を解消
- 型安全性の向上
- IDEでの開発体験の改善
- 実行時エラーの削減

## 注意事項

1. **バックアップの作成**
   ```bash
   git checkout -b refactoring/fix-build-errors
   git add .
   git commit -m "WIP: Before build error fixes"
   ```

2. **段階的な修正**
   - 一度に全てを修正せず、カテゴリごとに対応
   - 各段階でビルドとテストを実行

3. **コードレビュー**
   - 自動置換後は必ず差分を確認
   - 意図しない変更がないかチェック