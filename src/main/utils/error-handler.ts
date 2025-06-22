/**
 * 共通エラーハンドリングユーティリティ
 */

import { app, dialog } from 'electron';

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource}が見つかりません`, 'NOT_FOUND', 404);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      `データベースエラー: ${message}`,
      'DATABASE_ERROR',
      500
    );
    if (originalError) {
      this.stack = originalError.stack;
    }
  }
}

export class AIServiceError extends AppError {
  constructor(message: string, service: string) {
    super(
      `${service}サービスエラー: ${message}`,
      'AI_SERVICE_ERROR',
      503
    );
  }
}

export class FileSystemError extends AppError {
  constructor(message: string, operation: string) {
    super(
      `ファイル${operation}エラー: ${message}`,
      'FILE_SYSTEM_ERROR',
      500
    );
  }
}

interface ErrorLogEntry {
  timestamp: Date;
  error: Error;
  context?: any;
}

class ErrorLogger {
  private errors: ErrorLogEntry[] = [];
  private maxErrors = 1000;

  log(error: Error, context?: any): void {
    this.errors.push({
      timestamp: new Date(),
      error,
      context
    });

    // メモリリークを防ぐため、古いエラーを削除
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // 開発環境ではコンソールに出力
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', error, context);
    }
  }

  getRecentErrors(count = 10): ErrorLogEntry[] {
    return this.errors.slice(-count);
  }

  clear(): void {
    this.errors = [];
  }
}

export const errorLogger = new ErrorLogger();

/**
 * グローバルエラーハンドラー
 */
export function setupGlobalErrorHandlers(): void {
  // 未処理のPromiseリジェクション
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    errorLogger.log(
      new Error(`Unhandled Promise Rejection: ${reason}`),
      { promise }
    );
  });

  // 未処理の例外
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    errorLogger.log(error, { type: 'uncaughtException' });

    // クリティカルなエラーの場合はアプリを終了
    if (!isOperationalError(error)) {
      app.quit();
    }
  });
}

/**
 * エラーが操作的なものかどうかを判定
 */
function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * エラーメッセージをユーザーフレンドリーに変換
 */
export function getUserFriendlyMessage(error: Error): string {
  if (error instanceof ValidationError) {
    return error.message;
  }
  
  if (error instanceof NotFoundError) {
    return error.message;
  }
  
  if (error instanceof DatabaseError) {
    return 'データベースの操作中にエラーが発生しました。しばらく待ってから再度お試しください。';
  }
  
  if (error instanceof AIServiceError) {
    return 'AI サービスが一時的に利用できません。しばらく待ってから再度お試しください。';
  }
  
  if (error instanceof FileSystemError) {
    return 'ファイル操作中にエラーが発生しました。ファイルのアクセス権限を確認してください。';
  }
  
  // デフォルトメッセージ
  return '予期しないエラーが発生しました。アプリケーションを再起動してください。';
}

/**
 * エラーダイアログを表示
 */
export async function showErrorDialog(error: Error, title = 'エラー'): Promise<void> {
  const message = getUserFriendlyMessage(error);
  
  await dialog.showMessageBox({
    type: 'error',
    title,
    message,
    buttons: ['OK']
  });
}

/**
 * IPC通信用のエラーハンドリングラッパー
 */
export function wrapIPCHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  errorMessage = 'リクエストの処理中にエラーが発生しました'
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      errorLogger.log(error as Error, { handler: handler.name, args });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        errorMessage,
        'IPC_HANDLER_ERROR',
        500
      );
    }
  }) as T;
}

/**
 * リトライ可能なエラーかどうかを判定
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof AIServiceError) {
    return true;
  }
  
  if (error instanceof DatabaseError) {
    // デッドロックやタイムアウトの場合はリトライ可能
    const message = error.message.toLowerCase();
    return message.includes('deadlock') || 
           message.includes('timeout') ||
           message.includes('busy');
  }
  
  return false;
}

/**
 * エラーのシリアライズ（IPC通信用）
 */
export function serializeError(error: Error): {
  name: string;
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
} {
  const serialized: any = {
    name: error.name,
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  };
  
  if (error instanceof AppError) {
    serialized.code = error.code;
    serialized.statusCode = error.statusCode;
  }
  
  return serialized;
}

/**
 * バッチ処理用のエラーコレクター
 */
export class ErrorCollector {
  private errors: Array<{ item: any; error: Error }> = [];
  
  add(item: any, error: Error): void {
    this.errors.push({ item, error });
  }
  
  hasErrors(): boolean {
    return this.errors.length > 0;
  }
  
  getErrors(): Array<{ item: any; error: Error }> {
    return [...this.errors];
  }
  
  clear(): void {
    this.errors = [];
  }
  
  throwIfAny(): void {
    if (this.hasErrors()) {
      const errorCount = this.errors.length;
      const firstError = this.errors[0].error;
      throw new AppError(
        `${errorCount}件のエラーが発生しました。最初のエラー: ${firstError.message}`,
        'BATCH_ERROR',
        500
      );
    }
  }
}