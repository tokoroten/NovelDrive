import { DiffApplication } from './diffMatcher';

interface WorkerMessage {
  type: 'progress' | 'complete' | 'error';
  message?: string;
  result?: {
    content: string;
    results: DiffApplication[];
  };
  error?: string;
}

/**
 * Web Workerを使用してdiff計算を実行
 */
export function applyDiffsWithWorker(
  content: string,
  diffs: Array<{ oldText: string; newText: string }>,
  threshold: number = 0.7,
  onProgress?: (message: string) => void
): Promise<{
  content: string;
  results: DiffApplication[];
}> {
  return new Promise((resolve, reject) => {
    // Web Workerを作成
    const worker = new Worker('/diffWorkerV2.js');
    
    // タイムアウト設定（30秒）
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('diff計算がタイムアウトしました'));
    }, 30000);
    
    // メッセージハンドラを設定
    worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      const { type, message, result, error } = event.data;
      
      switch (type) {
        case 'progress':
          if (onProgress && message) {
            onProgress(message);
          }
          break;
          
        case 'complete':
          clearTimeout(timeout);
          worker.terminate();
          if (result) {
            resolve(result);
          } else {
            reject(new Error('結果が返されませんでした'));
          }
          break;
          
        case 'error':
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error(error || '不明なエラーが発生しました'));
          break;
      }
    });
    
    // エラーハンドラを設定
    worker.addEventListener('error', (error) => {
      clearTimeout(timeout);
      worker.terminate();
      console.error('Web Worker error:', error);
      console.error('Error details:', {
        message: error.message || 'Unknown error',
        filename: error.filename || 'Unknown file',
        lineno: error.lineno || 'Unknown line',
        colno: error.colno || 'Unknown column',
        error: error.error || 'No error object'
      });
      reject(new Error(`Web Worker error: ${error.message || 'Unknown error'}`));
    });
    
    // diff計算を開始
    worker.postMessage({ content, diffs, threshold });
  });
}