/**
 * エラーハンドリングユーティリティのテスト
 */

import {
  AppError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  AIServiceError,
  errorLogger,
  wrapIPCHandler
} from '../error-handler';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('基本的なエラーを作成', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 400);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });
  });

  describe('ValidationError', () => {
    it('バリデーションエラーを作成', () => {
      const error = new ValidationError('無効なメールアドレス');
      
      expect(error.message).toBe('無効なメールアドレス');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('NotFoundError', () => {
    it('リソースタイプを含むエラー', () => {
      const error = new NotFoundError('ユーザー');
      
      expect(error.message).toBe('ユーザーが見つかりません');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('DatabaseError', () => {
    it('元のエラーを保持', () => {
      const originalError = new Error('Connection failed');
      const error = new DatabaseError('接続エラー', originalError);
      
      expect(error.message).toBe('データベースエラー: 接続エラー');
      expect(error.stack).toBe(originalError.stack);
    });
  });

  describe('AIServiceError', () => {
    it('サービス名を含むエラー', () => {
      const error = new AIServiceError('API呼び出し失敗', 'OpenAI');
      
      expect(error.message).toBe('OpenAIサービスエラー: API呼び出し失敗');
      expect(error.code).toBe('AI_SERVICE_ERROR');
      expect(error.statusCode).toBe(503);
    });
  });
});

describe('errorLogger', () => {
  it('エラーをログに記録', () => {
    const error = new Error('Test error');
    const context = { userId: '123' };
    
    errorLogger.log(error, context);
    
    const logs = errorLogger.getRecentErrors(10);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const lastLog = logs[0];
    expect(lastLog.error).toBe(error);
    expect(lastLog.context).toEqual(context);
  });

  it('指定された数のエラーを返す', () => {
    const baseCount = errorLogger.getRecentErrors(100).length;
    
    for (let i = 0; i < 5; i++) {
      errorLogger.log(new Error(`Error ${i}`));
    }
    
    const logs = errorLogger.getRecentErrors(3);
    expect(logs).toHaveLength(3);
  });
});

describe('wrapIPCHandler', () => {
  it('成功時の結果を返す', async () => {
    const handler = jest.fn().mockResolvedValue({ data: 'success' });
    const wrapped = wrapIPCHandler(handler);
    
    const result = await wrapped({} as any, 'test-arg');
    expect(result).toEqual({ data: 'success' });
  });

  it('エラー時に例外をスロー', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('Handler error'));
    const wrapped = wrapIPCHandler(handler, 'カスタムエラーメッセージ');
    
    await expect(wrapped({} as any, 'test-arg')).rejects.toThrow('カスタムエラーメッセージ');
  });

  it('AppErrorの場合はそのままスロー', async () => {
    const appError = new ValidationError('Invalid input');
    const handler = jest.fn().mockRejectedValue(appError);
    const wrapped = wrapIPCHandler(handler);
    
    await expect(wrapped({} as any)).rejects.toThrow(appError);
  });

  it('エラーをログに記録', async () => {
    const logSpy = jest.spyOn(errorLogger, 'log');
    const error = new Error('Test error');
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = wrapIPCHandler(handler);
    
    try {
      await wrapped({} as any, 'test-arg');
    } catch (e) {
      // エラーは期待される
    }
    
    expect(logSpy).toHaveBeenCalledWith(error, { args: ['test-arg'] });
    logSpy.mockRestore();
  });
});

describe('Error Integration', () => {
  it('複数のエラータイプを区別できる', () => {
    const errors = [
      new AppError('App error', 'APP_ERROR'),
      new ValidationError('Validation error'),
      new NotFoundError('Resource'),
      new DatabaseError('DB error'),
      new AIServiceError('AI error', 'GPT')
    ];
    
    errors.forEach(error => {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    });
    
    expect(errors[1].code).toBe('VALIDATION_ERROR');
    expect(errors[2].code).toBe('NOT_FOUND');
    expect(errors[3].code).toBe('DATABASE_ERROR');
    expect(errors[4].code).toBe('AI_SERVICE_ERROR');
  });
});