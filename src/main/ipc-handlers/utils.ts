/**
 * IPC通信のユーティリティ関数
 */

import { retry } from '../core/async/retry';
import { 
  AppError, 
  serializeError, 
  errorLogger,
  isRetryableError 
} from '../utils/error-handler';

export function createSuccessResponse<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

export function createErrorResponse(error: Error | string): { success: false; error: any } {
  if (error instanceof Error) {
    return { success: false, error: serializeError(error) };
  }
  return { success: false, error: { message: error } };
}

export async function handleIPCRequest<T>(
  handler: () => Promise<T>,
  options?: { enableRetry?: boolean; retryCount?: number }
): Promise<{ success: boolean; data?: T; error?: any }> {
  try {
    let result: T;
    
    if (options?.enableRetry) {
      result = await retry(handler, {
        retries: options.retryCount || 3,
        onRetry: (error, attempt) => {
          errorLogger.log(error, { attempt, handler: handler.name });
        }
      });
    } else {
      result = await handler();
    }
    
    return createSuccessResponse(result);
  } catch (error) {
    errorLogger.log(error as Error, { handler: handler.name });
    return createErrorResponse(error as Error);
  }
}

export function wrapHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  options?: { 
    errorMessage?: string;
    enableRetry?: boolean;
    validateInput?: (args: Parameters<T>) => void;
  }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      // 入力検証
      if (options?.validateInput) {
        options.validateInput(args);
      }
      
      // リトライ可能な場合
      if (options?.enableRetry) {
        return await retry(
          () => handler(...args),
          {
            retries: 3,
            shouldRetry: (error) => isRetryableError(error)
          }
        );
      }
      
      return await handler(...args);
    } catch (error) {
      errorLogger.log(error as Error, { 
        handler: handler.name, 
        args,
        errorMessage: options?.errorMessage 
      });
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        options?.errorMessage || 'ハンドラーの実行中にエラーが発生しました',
        'HANDLER_ERROR',
        500
      );
    }
  }) as T;
}