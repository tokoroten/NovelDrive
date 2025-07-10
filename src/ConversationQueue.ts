export type QueueEvent = {
  id: string;
  type: 'agent_turn' | 'user_input';
  agentId: string;
  timestamp: Date;
};

export type QueueEventHandler = (event: QueueEvent) => Promise<void>;

export class ConversationQueue {
  private queue: QueueEvent[] = [];
  private isProcessing = false;
  private eventHandler: QueueEventHandler | null = null;
  private onQueueChange: ((length: number) => void) | null = null;

  constructor() {
    console.log('🎯 ConversationQueue initialized');
  }

  // イベントハンドラーを設定
  setEventHandler(handler: QueueEventHandler) {
    this.eventHandler = handler;
  }

  // キュー変更通知の設定
  setOnQueueChange(callback: (length: number) => void) {
    this.onQueueChange = callback;
  }

  // イベントをキューに追加
  enqueue(event: Omit<QueueEvent, 'id' | 'timestamp'>) {
    const queueEvent: QueueEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date()
    };

    console.log(`📥 Enqueuing event: ${event.type} for ${event.agentId}`);
    this.queue.push(queueEvent);
    
    // キュー変更を通知
    if (this.onQueueChange) {
      this.onQueueChange(this.queue.length);
    }
    
    // 処理中でなければ処理を開始
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // キューの処理
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      console.log(`🔄 Processing event: ${event.type} for ${event.agentId}`);
      
      // キュー変更を通知
      if (this.onQueueChange) {
        this.onQueueChange(this.queue.length);
      }

      // React state更新のための短い遅延を追加
      await new Promise(resolve => setTimeout(resolve, 50));
      
      try {
        if (this.eventHandler) {
          await this.eventHandler(event);
        } else {
          console.error('❌ No event handler set');
        }
      } catch (error) {
        console.error('❌ Error processing event:', error);
      }

      // 処理間に少し遅延を入れる（オプション）
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.isProcessing = false;
    console.log('✅ Queue processing completed');
  }

  // キューをクリア
  clear() {
    console.log('🧹 Clearing conversation queue');
    this.queue = [];
    if (this.onQueueChange) {
      this.onQueueChange(0);
    }
  }

  // キューの状態を取得
  getQueueLength() {
    return this.queue.length;
  }

  isQueueProcessing() {
    return this.isProcessing;
  }
}