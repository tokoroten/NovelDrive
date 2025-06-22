/**
 * 自動保存サービス
 * 変更を検知して定期的に保存を実行
 */
export class AutoSaveService {
  private static instance: AutoSaveService;
  private saveQueue: Map<string, { data: any; timestamp: number }> = new Map();
  private saveTimer: NodeJS.Timeout | null = null;
  private saveInterval = 2000; // 2秒
  private maxRetries = 3;
  private listeners: Map<string, (status: AutoSaveStatus) => void> = new Map();

  private constructor() {
    this.startSaveLoop();
  }

  static getInstance(): AutoSaveService {
    if (!AutoSaveService.instance) {
      AutoSaveService.instance = new AutoSaveService();
    }
    return AutoSaveService.instance;
  }

  /**
   * 保存をキューに追加
   */
  queueSave(id: string, data: any, onStatusChange?: (status: AutoSaveStatus) => void) {
    this.saveQueue.set(id, {
      data,
      timestamp: Date.now(),
    });

    if (onStatusChange) {
      this.listeners.set(id, onStatusChange);
      onStatusChange({ status: 'pending', timestamp: Date.now() });
    }
  }

  /**
   * 特定のアイテムを即座に保存
   */
  async saveNow(id: string): Promise<void> {
    const item = this.saveQueue.get(id);
    if (!item) return;

    await this.performSave(id, item.data);
    this.saveQueue.delete(id);
  }

  /**
   * 保存ループを開始
   */
  private startSaveLoop() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }

    this.saveTimer = setInterval(() => {
      this.processSaveQueue();
    }, this.saveInterval);
  }

  /**
   * 保存キューを処理
   */
  private async processSaveQueue() {
    if (this.saveQueue.size === 0) return;

    const now = Date.now();
    const itemsToSave: Array<[string, any]> = [];

    // 2秒以上経過したアイテムを収集
    for (const [id, item] of this.saveQueue.entries()) {
      if (now - item.timestamp >= this.saveInterval) {
        itemsToSave.push([id, item.data]);
      }
    }

    // 並列で保存を実行
    const savePromises = itemsToSave.map(([id, data]) => 
      this.performSave(id, data)
        .then(() => {
          this.saveQueue.delete(id);
        })
        .catch((error) => {
          console.error(`Failed to save ${id}:`, error);
          // 失敗したアイテムは次回リトライ
        })
    );

    await Promise.allSettled(savePromises);
  }

  /**
   * 実際の保存処理
   */
  private async performSave(id: string, data: any): Promise<void> {
    const listener = this.listeners.get(id);
    
    if (listener) {
      listener({ status: 'saving', timestamp: Date.now() });
    }

    let retries = 0;
    let lastError: Error | null = null;

    while (retries < this.maxRetries) {
      try {
        // データタイプに応じて適切なAPIを呼び出す
        if (data.type === 'chapter') {
          await window.electronAPI.chapters.update(id, data.content);
        } else if (data.type === 'knowledge') {
          await window.electronAPI.database.updateKnowledge(id, data.content);
        } else if (data.type === 'plot') {
          await window.electronAPI.plots.update(id, data.content);
        } else {
          // 汎用的な保存
          await window.electronAPI.database.execute(
            'UPDATE documents SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [JSON.stringify(data.content), id]
          );
        }

        if (listener) {
          listener({ 
            status: 'saved', 
            timestamp: Date.now(),
            savedAt: new Date().toISOString() 
          });
        }
        
        return;
      } catch (error) {
        lastError = error as Error;
        retries++;
        
        if (retries < this.maxRetries) {
          // 指数バックオフでリトライ
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        }
      }
    }

    // すべてのリトライが失敗
    if (listener) {
      listener({ 
        status: 'error', 
        timestamp: Date.now(),
        error: lastError?.message || 'Unknown error'
      });
    }
    
    throw lastError;
  }

  /**
   * クリーンアップ
   */
  destroy() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
    this.saveQueue.clear();
    this.listeners.clear();
  }
}

/**
 * 自動保存の状態
 */
export interface AutoSaveStatus {
  status: 'pending' | 'saving' | 'saved' | 'error';
  timestamp: number;
  savedAt?: string;
  error?: string;
}

/**
 * React Hook: 自動保存機能
 */
export function useAutoSave(
  id: string,
  data: any,
  options?: {
    enabled?: boolean;
    debounceMs?: number;
    onStatusChange?: (status: AutoSaveStatus) => void;
  }
) {
  const autoSaveService = AutoSaveService.getInstance();
  const { enabled = true, debounceMs = 2000, onStatusChange } = options || {};
  
  let debounceTimer: NodeJS.Timeout | null = null;

  const save = () => {
    if (!enabled) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      autoSaveService.queueSave(id, data, onStatusChange);
    }, debounceMs);
  };

  const saveNow = async () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    await autoSaveService.saveNow(id);
  };

  return {
    save,
    saveNow,
  };
}