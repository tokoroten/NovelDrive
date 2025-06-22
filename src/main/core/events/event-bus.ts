/**
 * イベントバス実装
 * アプリケーション内のイベント駆動通信を管理
 */

import { EventEmitter } from 'events';

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  metadata: {
    timestamp: Date;
    userId?: string;
    correlationId?: string;
    causationId?: string;
  };
}

export type EventHandler<T = any> = (event: DomainEvent & { payload: T }) => void | Promise<void>;

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private handlers = new Map<string, Set<EventHandler>>();
  private middlewares: Array<(event: DomainEvent) => void | Promise<void>> = [];

  private constructor() {
    super();
    this.setMaxListeners(100); // 多数のハンドラーに対応
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * イベントハンドラーを登録
   */
  subscribe<T = any>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler);
    
    // Unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(eventType);
        }
      }
    };
  }

  /**
   * 複数のイベントタイプに対してハンドラーを登録
   */
  subscribeMany(eventTypes: string[], handler: EventHandler): () => void {
    const unsubscribers = eventTypes.map(eventType => 
      this.subscribe(eventType, handler)
    );
    
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * イベントを発行
   */
  async publish(event: DomainEvent): Promise<void> {
    // ミドルウェアを実行
    for (const middleware of this.middlewares) {
      await middleware(event);
    }

    // イベントハンドラーを実行
    const handlers = this.handlers.get(event.eventType);
    if (handlers) {
      const promises: Promise<void>[] = [];
      
      for (const handler of handlers) {
        const promise = Promise.resolve(handler(event)).catch(error => {
          console.error(`Error in event handler for ${event.eventType}:`, error);
          this.emit('error', { event, error });
        });
        promises.push(promise);
      }
      
      await Promise.all(promises);
    }

    // Node.js EventEmitter にも発行（互換性のため）
    this.emit(event.eventType, event);
  }

  /**
   * 複数のイベントを一括発行
   */
  async publishMany(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * ミドルウェアを追加
   */
  use(middleware: (event: DomainEvent) => void | Promise<void>): void {
    this.middlewares.push(middleware);
  }

  /**
   * イベントハンドラーの数を取得
   */
  getHandlerCount(eventType?: string): number {
    if (eventType) {
      return this.handlers.get(eventType)?.size || 0;
    }
    
    let total = 0;
    for (const handlers of this.handlers.values()) {
      total += handlers.size;
    }
    return total;
  }

  /**
   * 全てのハンドラーをクリア
   */
  clear(): void {
    this.handlers.clear();
    this.middlewares = [];
    this.removeAllListeners();
  }
}

// シングルトンインスタンス
export const eventBus = EventBus.getInstance();