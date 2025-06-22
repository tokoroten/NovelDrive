# 即座に実施すべきリファクタリング作業

## 1. TypeScriptビルドエラーの解消

### 1.1 共通の型エラーパターンと修正方法

#### パターン1: 古いAPIインターフェースの参照
```typescript
// ❌ 現在のエラー
import { APIUsageLogger } from './api-usage-logger'; // エクスポートされていない

// ✅ 修正
import { ApiUsageLogger } from './api-usage-logger'; // 正しい名前
```

#### パターン2: DuckDB Connection型の不一致
```typescript
// ❌ 現在のエラー
conn.get(...) // getメソッドが存在しない

// ✅ 修正
conn.all(sql, params, (err, rows) => {
  if (rows && rows.length > 0) {
    return rows[0];
  }
});
```

#### パターン3: 型定義の不足
```typescript
// ❌ 現在のエラー
logData.duration // プロパティが存在しない

// ✅ 修正
logData.durationMs // 正しいプロパティ名
```

### 1.2 統一された型定義ファイルの作成

```typescript
// src/shared/types/api.ts
export interface ApiUsageLog {
  id?: string;
  timestamp?: Date;
  apiType: 'chat' | 'embedding' | 'image' | 'thread';
  provider: 'openai' | 'anthropic' | 'local';
  model?: string;
  operation: string;
  endpoint?: string;
  
  // トークン情報
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  
  // コスト情報
  estimatedCost?: number;
  actualCost?: number;
  
  // パフォーマンス
  durationMs?: number;
  
  // ステータス
  status: 'success' | 'error';
  errorMessage?: string;
  
  // その他
  requestData?: any;
  responseData?: any;
  metadata?: Record<string, any>;
}
```

## 2. エラーハンドリングの統一

### 2.1 カスタムエラークラスの実装

```typescript
// src/shared/errors/base-error.ts
export abstract class BaseError extends Error {
  public readonly timestamp: Date;
  
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

// src/shared/errors/database-error.ts
export class DatabaseError extends BaseError {
  constructor(message: string, details?: any) {
    super('DATABASE_ERROR', message, 500, details);
  }
}

// src/shared/errors/validation-error.ts
export class ValidationError extends BaseError {
  constructor(message: string, field?: string) {
    super('VALIDATION_ERROR', message, 400, { field });
  }
}
```

### 2.2 統一されたエラーハンドラー

```typescript
// src/main/utils/error-handler.ts
export class ErrorHandler {
  static handle(error: unknown): { success: false; error: string; code?: string } {
    if (error instanceof BaseError) {
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
    
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message
      };
    }
    
    return {
      success: false,
      error: 'An unknown error occurred'
    };
  }
  
  static async handleAsync<T>(
    operation: () => Promise<T>
  ): Promise<{ success: true; data: T } | { success: false; error: string; code?: string }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      return this.handle(error);
    }
  }
}
```

## 3. IPCハンドラーの標準化

### 3.1 ベースハンドラークラス

```typescript
// src/main/ipc/base-ipc-handler.ts
import { ipcMain, IpcMainInvokeEvent } from 'electron';

export abstract class BaseIPCHandler<TRequest = any, TResponse = any> {
  constructor(protected channel: string) {
    this.register();
  }
  
  private register(): void {
    ipcMain.handle(this.channel, async (event: IpcMainInvokeEvent, ...args: any[]) => {
      try {
        console.log(`[IPC] ${this.channel} called with:`, args);
        const result = await this.handle(event, ...args);
        console.log(`[IPC] ${this.channel} succeeded`);
        return result;
      } catch (error) {
        console.error(`[IPC] ${this.channel} failed:`, error);
        return ErrorHandler.handle(error);
      }
    });
  }
  
  protected abstract handle(
    event: IpcMainInvokeEvent,
    ...args: any[]
  ): Promise<TResponse>;
}
```

### 3.2 具体的なハンドラーの実装例

```typescript
// src/main/ipc/handlers/database-query-handler.ts
export class DatabaseQueryHandler extends BaseIPCHandler<
  [string, any[]?],
  any[]
> {
  constructor(private db: DuckDB.Database) {
    super('db:query');
  }
  
  protected async handle(
    event: IpcMainInvokeEvent,
    sql: string,
    params?: any[]
  ): Promise<any[]> {
    if (!sql || typeof sql !== 'string') {
      throw new ValidationError('SQL query is required');
    }
    
    const conn = this.db.connect();
    
    return new Promise((resolve, reject) => {
      conn.all(sql, params || [], (err, rows) => {
        if (err) {
          reject(new DatabaseError(err.message, { sql, params }));
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}
```

## 4. 設定管理の統一

### 4.1 環境変数と設定の一元管理

```typescript
// src/shared/config/index.ts
export interface AppConfig {
  // 環境
  env: 'development' | 'production' | 'test';
  
  // パス
  paths: {
    userData: string;
    models: string;
    logs: string;
  };
  
  // API設定
  api: {
    openai: {
      apiKey?: string;
      organization?: string;
      maxRetries: number;
      timeout: number;
    };
  };
  
  // データベース設定
  database: {
    path: string;
    maxConnections: number;
  };
  
  // ログ設定
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    maxFiles: number;
    maxFileSize: string;
  };
}

// src/main/config/config-service.ts
export class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;
  
  private constructor() {
    this.config = this.loadConfig();
  }
  
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }
  
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
  
  private loadConfig(): AppConfig {
    // 環境変数、設定ファイル、デフォルト値をマージ
  }
}
```

## 5. ロギングシステムの統一

### 5.1 ロガーインターフェース

```typescript
// src/shared/logger/logger.ts
export interface LogContext {
  [key: string]: any;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  
  child(context: LogContext): Logger;
}

// src/main/logger/console-logger.ts
export class ConsoleLogger implements Logger {
  constructor(private context: LogContext = {}) {}
  
  debug(message: string, context?: LogContext): void {
    console.log(`[DEBUG]`, message, { ...this.context, ...context });
  }
  
  info(message: string, context?: LogContext): void {
    console.log(`[INFO]`, message, { ...this.context, ...context });
  }
  
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN]`, message, { ...this.context, ...context });
  }
  
  error(message: string, error?: Error, context?: LogContext): void {
    console.error(`[ERROR]`, message, error, { ...this.context, ...context });
  }
  
  child(context: LogContext): Logger {
    return new ConsoleLogger({ ...this.context, ...context });
  }
}
```

## 実装順序

1. **Day 1-2**: 型定義の統一とTypeScriptエラーの解消
2. **Day 3**: エラーハンドリングシステムの実装
3. **Day 4**: IPCハンドラーの標準化
4. **Day 5**: 設定管理とロギングシステムの実装
5. **Day 6-7**: テストの追加と動作確認

## チェックリスト

- [ ] 全TypeScriptビルドエラーの解消
- [ ] 統一された型定義ファイルの作成
- [ ] カスタムエラークラスの実装
- [ ] BaseIPCHandlerの実装と既存ハンドラーの移行
- [ ] ConfigServiceの実装
- [ ] ロギングシステムの実装
- [ ] 基本的な単体テストの追加
- [ ] ドキュメントの更新

これらの作業を完了することで、プロジェクトの基盤が大幅に改善され、今後の機能追加や保守が容易になります。