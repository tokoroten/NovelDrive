# NovelDrive 開発ガイド

## 開発環境のセットアップ

### 必要なツール

- Node.js 18.x 以上
- npm 8.x 以上
- Git
- VSCode（推奨）
- Chrome/Edge（デバッグ用）

### 初期セットアップ

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/NovelDrive.git
cd NovelDrive

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してOpenAI APIキーを設定

# データベースの初期化
npm run db:migrate

# 開発サーバーの起動
npm run dev
```

### VSCode 推奨拡張機能

- ESLint
- Prettier
- TypeScript Vue Plugin (Volar)
- Tailwind CSS IntelliSense
- DuckDB SQL Tools

## アーキテクチャガイドライン

### ディレクトリ構造

```
src/
├── main/                 # Electronメインプロセス
│   ├── core/            # ビジネスロジック
│   │   ├── domain/      # エンティティとビジネスルール
│   │   ├── events/      # ドメインイベント
│   │   └── errors/      # カスタムエラー
│   ├── services/        # アプリケーションサービス
│   ├── repositories/    # データアクセス層
│   ├── infrastructure/  # 外部サービス統合
│   └── ipc/            # IPCハンドラー
├── renderer/            # Electronレンダラープロセス
│   ├── components/      # Reactコンポーネント
│   ├── hooks/          # カスタムフック
│   ├── utils/          # ユーティリティ関数
│   └── styles/         # グローバルスタイル
└── shared/             # 共有型定義
```

### レイヤー責任

1. **Domain Layer**
   - ビジネスルールの実装
   - 外部依存なし
   - 純粋な TypeScript

2. **Application Layer**
   - ユースケースの実装
   - ドメインオブジェクトの調整
   - トランザクション管理

3. **Infrastructure Layer**
   - 外部APIとの通信
   - データベースアクセス
   - ファイルシステム操作

4. **Presentation Layer**
   - ユーザーインターフェース
   - 状態管理
   - イベントハンドリング

## コーディング規約

### TypeScript

```typescript
// ✅ Good: 明示的な型定義
interface UserData {
  id: string;
  name: string;
  email: string;
}

// ❌ Bad: any型の使用
const userData: any = { ... };

// ✅ Good: エラーハンドリング
try {
  const result = await someAsyncOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', error);
  return { success: false, error: error.message };
}

// ✅ Good: 早期リターン
function processData(data: Data): Result {
  if (!data) {
    return null;
  }
  
  if (!isValid(data)) {
    throw new ValidationError('Invalid data');
  }
  
  return transform(data);
}
```

### React コンポーネント

```tsx
// ✅ Good: 関数コンポーネント + TypeScript
interface Props {
  title: string;
  onClose: () => void;
}

export function Dialog({ title, onClose }: Props) {
  return (
    <div className="dialog">
      <h2>{title}</h2>
      <button onClick={onClose}>閉じる</button>
    </div>
  );
}

// ✅ Good: カスタムフックの使用
function useKnowledge(id: string) {
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadKnowledge(id).then(setKnowledge).finally(() => setLoading(false));
  }, [id]);
  
  return { knowledge, loading };
}
```

### データベースアクセス

```typescript
// ✅ Good: リポジトリパターン
class KnowledgeRepository implements IKnowledgeRepository {
  constructor(private db: Database) {}
  
  async findById(id: string): Promise<Knowledge | null> {
    const sql = 'SELECT * FROM knowledge WHERE id = ?';
    const result = await this.db.query(sql, [id]);
    return result[0] ? this.mapToEntity(result[0]) : null;
  }
  
  private mapToEntity(row: any): Knowledge {
    return new Knowledge(
      row.id,
      row.title,
      row.content,
      // ...
    );
  }
}
```

## テスト戦略

### 単体テスト

```typescript
// ✅ Good: 明確なテストケース
describe('KnowledgeApplicationService', () => {
  let service: KnowledgeApplicationService;
  let mockRepository: jest.Mocked<IKnowledgeRepository>;
  
  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new KnowledgeApplicationService(mockRepository);
  });
  
  describe('createKnowledge', () => {
    it('should create knowledge with valid data', async () => {
      // Arrange
      const input = { title: 'Test', content: 'Content' };
      
      // Act
      const result = await service.createKnowledge(input);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Test' })
      );
    });
  });
});
```

### E2E テスト

```typescript
// ✅ Good: ユーザーシナリオベース
test('should create project and generate plot', async () => {
  // ユーザーがプロジェクトを作成
  await page.click('[data-testid="create-project"]');
  await page.fill('[data-testid="project-name"]', 'My Novel');
  await page.click('[data-testid="submit"]');
  
  // プロット生成を開始
  await page.click('[data-testid="generate-plot"]');
  
  // AIエージェントの議論を確認
  await expect(page.locator('[data-testid="agent-discussion"]')).toBeVisible();
});
```

## デバッグ

### Electron デバッグ

```bash
# メインプロセスのデバッグ
npm run dev -- --inspect

# DevToolsを開く
Ctrl+Shift+I (Windows/Linux)
Cmd+Option+I (macOS)
```

### React DevTools

1. Chrome拡張機能をインストール
2. Electronアプリ内で使用可能

### データベースデバッグ

```typescript
// SQLログを有効化
const db = new Database({
  logQueries: process.env.NODE_ENV === 'development'
});
```

## パフォーマンス最適化

### React 最適化

```typescript
// ✅ Good: メモ化
const ExpensiveComponent = React.memo(({ data }) => {
  const processedData = useMemo(() => 
    expensiveProcessing(data), [data]
  );
  
  return <div>{processedData}</div>;
});

// ✅ Good: 遅延読み込み
const HeavyComponent = React.lazy(() => 
  import('./components/HeavyComponent')
);
```

### データベース最適化

```sql
-- インデックスの作成
CREATE INDEX idx_knowledge_embedding 
ON knowledge_embeddings(knowledge_id);

-- 効率的なクエリ
SELECT k.*, ke.embedding
FROM knowledge k
JOIN knowledge_embeddings ke ON k.id = ke.knowledge_id
WHERE k.project_id = ?
LIMIT 100;
```

## トラブルシューティング

### よくある問題

1. **DuckDB エラー**
   ```bash
   # DuckDB バイナリの再インストール
   npm rebuild duckdb
   ```

2. **Electron 起動エラー**
   ```bash
   # Electron キャッシュのクリア
   rm -rf ~/.electron
   npm install electron --save-dev
   ```

3. **TypeScript エラー**
   ```bash
   # 型定義の再生成
   npm run typecheck -- --force
   ```

## リリース手順

1. バージョン番号の更新
   ```bash
   npm version patch/minor/major
   ```

2. ビルド
   ```bash
   npm run build
   ```

3. テスト
   ```bash
   npm run test
   npm run test:e2e
   ```

4. パッケージング
   ```bash
   npm run package
   ```

## コントリビューション

1. Issue を作成または選択
2. Feature ブランチを作成
   ```bash
   git checkout -b feature/your-feature
   ```
3. 変更をコミット
4. Pull Request を作成
5. レビューを受ける
6. マージ

## リソース

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [DuckDB Documentation](https://duckdb.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)