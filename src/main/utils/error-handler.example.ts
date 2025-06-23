/**
 * エラーハンドリングの使用例
 */

import { 
  AppError, 
  ValidationError, 
  NotFoundError, 
  DatabaseError,
  wrapIPCHandler,
  ErrorCollector,
  errorLogger,
  isRetryableError
} from './error-handler';
import { retry } from '../core/async/retry';

// 例1: IPCハンドラーでの使用
export const exampleIPCHandler = wrapIPCHandler(
  async (event: any, data: any) => {
    // バリデーション
    if (!data.title) {
      throw new ValidationError('タイトルは必須です');
    }
    
    // リソースが見つからない場合
    const resource = await findResource(data.id);
    if (!resource) {
      throw new NotFoundError('ドキュメント');
    }
    
    // データベースエラー
    try {
      await saveToDatabase(data);
    } catch (error) {
      throw new DatabaseError('保存に失敗しました', error as Error);
    }
    
    return { success: true };
  },
  'ドキュメントの処理中にエラーが発生しました'
);

// 例2: リトライロジックとの組み合わせ
export async function exampleWithRetry(data: any): Promise<any> {
  return retry(
    async () => {
      try {
        return await performOperation(data);
      } catch (error) {
        if (isRetryableError(error as Error)) {
          console.log('リトライ可能なエラーです:', error);
          throw error; // retryに処理を委ねる
        }
        
        // リトライ不可能なエラーはそのままスロー
        throw error;
      }
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000
    }
  );
}

// 例3: バッチ処理でのエラー収集
export async function exampleBatchProcessing(items: any[]): Promise<void> {
  const errorCollector = new ErrorCollector();
  
  for (const item of items) {
    try {
      await processItem(item);
    } catch (error) {
      errorCollector.add(item, error as Error);
      // エラーがあっても処理を継続
    }
  }
  
  // すべてのアイテムを処理した後でエラーをチェック
  if (errorCollector.hasErrors()) {
    const errors = errorCollector.getErrors();
    console.error(`${errors.length}件のエラーが発生しました:`, errors);
    
    // 必要に応じてエラーをスロー
    errorCollector.throwIfAny();
  }
}

// 例4: カスタムエラーの定義と使用
export class QuotaExceededError extends AppError {
  constructor(resourceType: string, limit: number) {
    super(
      `${resourceType}の上限（${limit}）を超えました`,
      'QUOTA_EXCEEDED',
      429 // Too Many Requests
    );
  }
}

export async function checkQuota(type: string, count: number): Promise<void> {
  const limit = getQuotaLimit(type);
  if (count >= limit) {
    throw new QuotaExceededError(type, limit);
  }
}

// 例5: エラーロギングとモニタリング
export async function exampleWithLogging(data: any): Promise<any> {
  try {
    return await riskyOperation(data);
  } catch (error) {
    // エラーをログに記録
    errorLogger.log(error as Error, { 
      operation: 'riskyOperation',
      data,
      timestamp: new Date()
    });
    
    // ユーザーにフレンドリーなメッセージを返す
    throw new AppError(
      'データの処理中に問題が発生しました',
      'PROCESSING_ERROR',
      500
    );
  }
}

// 例6: エラーのグループ化とレポート
export function generateErrorReport(): any {
  const recentErrors = errorLogger.getRecentErrors(100);
  
  // エラーをタイプ別にグループ化
  const errorsByType = recentErrors.reduce((acc, entry) => {
    const errorType = entry.error.constructor.name;
    if (!acc[errorType]) {
      acc[errorType] = [];
    }
    acc[errorType].push(entry);
    return acc;
  }, {} as Record<string, typeof recentErrors>);
  
  // レポートの生成
  return {
    totalErrors: recentErrors.length,
    errorsByType: Object.entries(errorsByType).map(([type, errors]) => ({
      type,
      count: errors.length,
      latestError: errors[errors.length - 1]
    })),
    timeRange: {
      from: recentErrors[0]?.timestamp,
      to: recentErrors[recentErrors.length - 1]?.timestamp
    }
  };
}

// ヘルパー関数（実際の実装では適切に置き換える）
async function findResource(id: string): Promise<any> {
  // モック実装
  return null;
}

async function saveToDatabase(data: any): Promise<void> {
  // モック実装
  throw new Error('Database connection failed');
}

async function performOperation(data: any): Promise<any> {
  // モック実装
  return data;
}

async function processItem(item: any): Promise<void> {
  // モック実装
  if (Math.random() > 0.7) {
    throw new Error('Random processing error');
  }
}

async function riskyOperation(data: any): Promise<any> {
  // モック実装
  throw new Error('Something went wrong');
}

function getQuotaLimit(type: string): number {
  // モック実装
  return 100;
}