/**
 * エラーハンドリングユーティリティのテスト
 */

import { 
  AppError, 
  ValidationError, 
  NotFoundError, 
  DatabaseError,
  APIError,
  wrapIPCHandler,
  ErrorCollector,
  errorLogger,
  isRetryableError
} from '../error-handler';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('基本的なエラーを作成できる', () => {
      const error = new AppError('テストエラー', 'TEST_ERROR', 400);
      
      expect(error.message).toBe('テストエラー');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.stack).toBeDefined();
    });

    it('APIレスポンス形式に変換できる', () => {
      const error = new AppError('テストエラー', 'TEST_ERROR', 400);
      const response = error.toAPIResponse();
      
      expect(response).toEqual({
        success: false,
        error: {
          message: 'テストエラー',
          code: 'TEST_ERROR',
          statusCode: 400,
          timestamp: error.timestamp.toISOString()
        }
      });
    });
  });

  describe('ValidationError', () => {
    it('バリデーションエラーを作成できる', () => {
      const error = new ValidationError('フィールドが無効です');
      
      expect(error.message).toBe('フィールドが無効です');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });

    it('詳細情報を含めることができる', () => {
      const details = { field: 'email', reason: 'invalid format' };
      const error = new ValidationError('バリデーションエラー', details);
      
      expect(error.details).toEqual(details);
    });
  });

  describe('NotFoundError', () => {
    it('リソースが見つからないエラーを作成できる', () => {
      const error = new NotFoundError('ユーザー');
      
      expect(error.message).toBe('ユーザーが見つかりません');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.resourceType).toBe('ユーザー');
    });
  });

  describe('DatabaseError', () => {
    it('データベースエラーを作成できる', () => {
      const originalError = new Error('Connection failed');
      const error = new DatabaseError('接続に失敗しました', originalError);
      
      expect(error.message).toBe('接続に失敗しました');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('APIError', () => {
    it('APIエラーを作成できる', () => {
      const error = new APIError('外部API呼び出しに失敗', 'EXTERNAL_API', 503);
      
      expect(error.message).toBe('外部API呼び出しに失敗');
      expect(error.apiName).toBe('EXTERNAL_API');
      expect(error.statusCode).toBe(503);
    });
  });
});

describe('wrapIPCHandler', () => {
  it('正常なハンドラーの結果を返す', async () => {
    const handler = wrapIPCHandler(
      async (event, data) => ({ result: data * 2 }),
      'テストハンドラー'
    );
    
    const result = await handler({} as any, 5);
    expect(result).toEqual({ result: 10 });
  });

  it('エラーをキャッチしてAPIレスポンス形式で返す', async () => {
    const handler = wrapIPCHandler(
      async () => { throw new ValidationError('無効な入力'); },
      'テストハンドラー'
    );
    
    const result = await handler({} as any);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('無効な入力');
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('予期しないエラーをハンドリングする', async () => {
    const handler = wrapIPCHandler(
      async () => { throw new Error('予期しないエラー'); },
      'テストハンドラー'
    );
    
    const result = await handler({} as any);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('テストハンドラー: 予期しないエラー');
    expect(result.error?.code).toBe('UNKNOWN_ERROR');
  });
});

describe('ErrorCollector', () => {
  it('複数のエラーを収集できる', () => {
    const collector = new ErrorCollector();
    
    collector.add('item1', new Error('エラー1'));
    collector.add('item2', new Error('エラー2'));
    
    expect(collector.hasErrors()).toBe(true);
    expect(collector.getErrors()).toHaveLength(2);
  });

  it('収集したエラーをスローできる', () => {
    const collector = new ErrorCollector();
    collector.add('item1', new Error('エラー1'));
    
    expect(() => collector.throwIfAny()).toThrow('1件の処理でエラーが発生しました');
  });

  it('エラーをクリアできる', () => {
    const collector = new ErrorCollector();
    collector.add('item1', new Error('エラー1'));
    
    collector.clear();
    expect(collector.hasErrors()).toBe(false);
  });
});

describe('ErrorLogger', () => {
  beforeEach(() => {
    errorLogger.clear();
  });

  it('エラーをログに記録できる', () => {
    const error = new Error('テストエラー');
    const context = { userId: '123' };
    
    errorLogger.log(error, context);
    
    const logs = errorLogger.getRecentErrors(10);
    expect(logs).toHaveLength(1);
    expect(logs[0].error).toBe(error);
    expect(logs[0].context).toEqual(context);
  });

  it('最近のエラーを取得できる', () => {
    for (let i = 0; i < 150; i++) {
      errorLogger.log(new Error(`エラー${i}`));
    }
    
    const logs = errorLogger.getRecentErrors(50);
    expect(logs).toHaveLength(50);
    expect(logs[0].error.message).toBe('エラー149'); // 最新のエラー
  });

  it('ログをクリアできる', () => {
    errorLogger.log(new Error('エラー'));
    errorLogger.clear();
    
    const logs = errorLogger.getRecentErrors(10);
    expect(logs).toHaveLength(0);
  });
});

describe('isRetryableError', () => {
  it('ネットワークエラーはリトライ可能', () => {
    const error = Object.assign(new Error('Network error'), { code: 'ECONNREFUSED' });
    expect(isRetryableError(error)).toBe(true);
  });

  it('タイムアウトエラーはリトライ可能', () => {
    const error = Object.assign(new Error('Timeout'), { code: 'ETIMEDOUT' });
    expect(isRetryableError(error)).toBe(true);
  });

  it('データベースロックエラーはリトライ可能', () => {
    const error = new DatabaseError('database is locked');
    expect(isRetryableError(error)).toBe(true);
  });

  it('バリデーションエラーはリトライ不可', () => {
    const error = new ValidationError('無効な値');
    expect(isRetryableError(error)).toBe(false);
  });

  it('NotFoundエラーはリトライ不可', () => {
    const error = new NotFoundError('リソース');
    expect(isRetryableError(error)).toBe(false);
  });

  it('429エラーはリトライ可能', () => {
    const error = new APIError('Rate limited', 'API', 429);
    expect(isRetryableError(error)).toBe(true);
  });

  it('503エラーはリトライ可能', () => {
    const error = new APIError('Service unavailable', 'API', 503);
    expect(isRetryableError(error)).toBe(true);
  });
});