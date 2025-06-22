# NovelDrive リファクタリング戦略

## 現状の課題

### 1. 技術的負債
- TypeScriptビルドエラー（約80個）
- 型定義の不整合
- APIインターフェースの重複と不一致
- エラーハンドリングの不統一

### 2. アーキテクチャの問題
- Electronプロセス間通信の複雑化
- サービス層の責務が不明確
- 依存関係の循環
- テスト困難な設計

### 3. 開発効率の低下
- 開発環境とプロダクション環境の差異
- デバッグの困難さ
- コードの重複

## リファクタリング戦略

### フェーズ1: 基盤整備（1-2週間）

#### 1.1 型システムの統一
```typescript
// src/shared/types/index.ts - 全ての型定義を集約
export * from './api-types';
export * from './domain-types';
export * from './ipc-types';
```

#### 1.2 エラーハンドリングの標準化
```typescript
// src/shared/errors/index.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
  }
}

export class DatabaseError extends AppError {}
export class ValidationError extends AppError {}
export class APIError extends AppError {}
```

#### 1.3 ロギングシステムの統一
```typescript
// src/shared/logger/index.ts
export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: Error, meta?: any): void;
}
```

### フェーズ2: アーキテクチャ改善（2-3週間）

#### 2.1 レイヤードアーキテクチャの確立

```
src/
├── main/                    # Electronメインプロセス
│   ├── infrastructure/      # 外部システムとの接続
│   │   ├── database/       # DuckDB関連
│   │   ├── api/           # OpenAI等の外部API
│   │   └── file-system/    # ファイル操作
│   ├── domain/             # ビジネスロジック
│   │   ├── entities/       # ドメインモデル
│   │   ├── services/       # ドメインサービス
│   │   └── repositories/   # リポジトリインターフェース
│   ├── application/        # アプリケーションサービス
│   │   ├── use-cases/     # ユースケース
│   │   └── dto/           # データ転送オブジェクト
│   └── ipc/               # IPCハンドラー
│       └── handlers/      # 各機能のハンドラー
├── renderer/              # Electronレンダラープロセス
│   ├── components/        # UIコンポーネント
│   ├── hooks/            # カスタムフック
│   ├── services/         # フロントエンドサービス
│   └── stores/           # 状態管理
└── shared/               # 共有コード
    ├── types/           # 型定義
    ├── constants/       # 定数
    └── utils/           # ユーティリティ
```

#### 2.2 依存性注入（DI）の導入

```typescript
// src/main/infrastructure/container.ts
export class DIContainer {
  private services = new Map<string, any>();
  
  register<T>(name: string, factory: () => T): void {
    this.services.set(name, factory);
  }
  
  get<T>(name: string): T {
    const factory = this.services.get(name);
    if (!factory) throw new Error(`Service ${name} not found`);
    return factory();
  }
}
```

#### 2.3 イベント駆動アーキテクチャの改善

```typescript
// src/main/infrastructure/event-bus.ts
export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  
  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }
  
  emit(event: string, data: any): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}
```

### フェーズ3: IPCレイヤーの再設計（1-2週間）

#### 3.1 型安全なIPCシステム

```typescript
// src/shared/ipc/contracts.ts
export interface IPCContract<TRequest, TResponse> {
  channel: string;
  request: TRequest;
  response: TResponse;
}

// 各機能のコントラクト定義
export const DatabaseQueryContract: IPCContract<
  { sql: string; params?: any[] },
  { success: boolean; data?: any[]; error?: string }
> = {
  channel: 'db:query',
  request: {} as any,
  response: {} as any,
};
```

#### 3.2 統一されたIPCハンドラー

```typescript
// src/main/ipc/base-handler.ts
export abstract class BaseIPCHandler<TRequest, TResponse> {
  constructor(
    protected channel: string,
    protected container: DIContainer
  ) {
    ipcMain.handle(channel, async (_, request: TRequest) => {
      try {
        return await this.handle(request);
      } catch (error) {
        return this.handleError(error);
      }
    });
  }
  
  abstract handle(request: TRequest): Promise<TResponse>;
  
  protected handleError(error: any): TResponse {
    // 統一されたエラーハンドリング
  }
}
```

### フェーズ4: データアクセス層の改善（1-2週間）

#### 4.1 リポジトリパターンの実装

```typescript
// src/main/domain/repositories/knowledge-repository.ts
export interface KnowledgeRepository {
  findById(id: string): Promise<Knowledge | null>;
  findAll(options?: FindOptions): Promise<Knowledge[]>;
  save(knowledge: Knowledge): Promise<void>;
  delete(id: string): Promise<void>;
}

// src/main/infrastructure/repositories/duckdb-knowledge-repository.ts
export class DuckDBKnowledgeRepository implements KnowledgeRepository {
  constructor(private db: DuckDBConnection) {}
  
  async findById(id: string): Promise<Knowledge | null> {
    // 実装
  }
  // 他のメソッド
}
```

#### 4.2 トランザクション管理

```typescript
// src/main/infrastructure/database/transaction-manager.ts
export class TransactionManager {
  async executeInTransaction<T>(
    work: (conn: DuckDBConnection) => Promise<T>
  ): Promise<T> {
    const conn = await this.db.connect();
    try {
      await conn.run('BEGIN');
      const result = await work(conn);
      await conn.run('COMMIT');
      return result;
    } catch (error) {
      await conn.run('ROLLBACK');
      throw error;
    }
  }
}
```

### フェーズ5: フロントエンドの改善（1-2週間）

#### 5.1 状態管理の統一

```typescript
// src/renderer/stores/root-store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useStore = create(
  devtools(
    (set) => ({
      // グローバル状態
      currentProject: null,
      setCurrentProject: (project) => set({ currentProject: project }),
      // 他の状態
    }),
    { name: 'NovelDrive' }
  )
);
```

#### 5.2 API クライアントの抽象化

```typescript
// src/renderer/services/api-client.ts
export class APIClient {
  async request<TRequest, TResponse>(
    contract: IPCContract<TRequest, TResponse>,
    data: TRequest
  ): Promise<TResponse> {
    return window.electronAPI[contract.channel](data);
  }
}
```

### フェーズ6: テスト基盤の構築（1週間）

#### 6.1 単体テストの整備

```typescript
// src/main/domain/services/__tests__/knowledge-service.test.ts
describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let mockRepo: jest.Mocked<KnowledgeRepository>;
  
  beforeEach(() => {
    mockRepo = createMockRepository();
    service = new KnowledgeService(mockRepo);
  });
  
  test('should create knowledge', async () => {
    // テスト実装
  });
});
```

#### 6.2 統合テストの整備

```typescript
// src/test/integration/database.test.ts
describe('Database Integration', () => {
  let db: DuckDB.Database;
  
  beforeAll(async () => {
    db = await createTestDatabase();
  });
  
  afterAll(async () => {
    await db.close();
  });
  
  test('should perform CRUD operations', async () => {
    // テスト実装
  });
});
```

## 実装優先順位

1. **即座に実施すべき項目**
   - TypeScriptビルドエラーの解消
   - 型定義の統一
   - エラーハンドリングの標準化

2. **短期的に実施すべき項目**
   - IPCレイヤーの型安全化
   - 基本的なテストの追加
   - ロギングシステムの統一

3. **中長期的に実施すべき項目**
   - レイヤードアーキテクチャへの移行
   - 依存性注入の導入
   - 包括的なテストカバレッジ

## 期待される効果

1. **開発効率の向上**
   - 型安全性による実行時エラーの削減
   - IDEのサポート向上
   - デバッグの容易化

2. **保守性の向上**
   - 責務の明確化
   - テスト可能な設計
   - ドキュメントと実装の一致

3. **拡張性の向上**
   - 新機能追加の容易化
   - 外部サービスの切り替え可能性
   - パフォーマンス最適化の余地

## 移行戦略

1. **段階的移行**
   - 新機能から新アーキテクチャを適用
   - 既存機能は順次リファクタリング
   - 常に動作する状態を維持

2. **リスク管理**
   - 各フェーズでの動作確認
   - ロールバック計画の準備
   - ユーザー影響の最小化

3. **チーム連携**
   - コーディング規約の策定
   - レビュープロセスの確立
   - 知識共有の仕組み作り