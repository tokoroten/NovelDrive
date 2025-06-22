/**
 * イベントバスとイベント定義
 */

/**
 * イベントバスインターフェース
 */
export interface IEventBus {
  publish(event: DomainEvent): void;
  subscribe(eventType: string, handler: EventHandler): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}

/**
 * イベントハンドラ型
 */
export type EventHandler = (event: DomainEvent) => void | Promise<void>;

/**
 * ドメインイベント基底クラス
 */
export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public abstract readonly type: string;

  constructor(aggregateId: string, occurredAt?: Date) {
    this.aggregateId = aggregateId;
    this.occurredAt = occurredAt || new Date();
  }
}

/**
 * 知識作成イベント
 */
export class KnowledgeCreated extends DomainEvent {
  public readonly type = 'KnowledgeCreated';
  
  constructor(
    aggregateId: string,
    public readonly title: string,
    public readonly knowledgeType: string,
    public readonly projectId?: string
  ) {
    super(aggregateId);
  }
}

/**
 * 知識更新イベント
 */
export class KnowledgeUpdated extends DomainEvent {
  public readonly type = 'KnowledgeUpdated';
  
  constructor(
    aggregateId: string,
    public readonly changes: Record<string, any>
  ) {
    super(aggregateId);
  }
}

/**
 * 知識削除イベント
 */
export class KnowledgeDeleted extends DomainEvent {
  public readonly type = 'KnowledgeDeleted';
  
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}

/**
 * プロット作成イベント
 */
export class PlotCreated extends DomainEvent {
  public readonly type = 'PlotCreated';
  
  constructor(
    aggregateId: string,
    public readonly projectId: string,
    public readonly version: string,
    public readonly title: string
  ) {
    super(aggregateId);
  }
}

/**
 * プロット更新イベント
 */
export class PlotUpdated extends DomainEvent {
  public readonly type = 'PlotUpdated';
  
  constructor(
    aggregateId: string,
    public readonly changes: Record<string, any>
  ) {
    super(aggregateId);
  }
}

/**
 * プロットフォークイベント
 */
export class PlotForked extends DomainEvent {
  public readonly type = 'PlotForked';
  
  constructor(
    aggregateId: string,
    public readonly parentId: string,
    public readonly parentVersion: string,
    public readonly newVersion: string
  ) {
    super(aggregateId);
  }
}

/**
 * 議論開始イベント
 */
export class DiscussionStarted extends DomainEvent {
  public readonly type = 'DiscussionStarted';
  
  constructor(
    aggregateId: string,
    public readonly topic: string,
    public readonly participants: string[]
  ) {
    super(aggregateId);
  }
}

/**
 * 議論終了イベント
 */
export class DiscussionEnded extends DomainEvent {
  public readonly type = 'DiscussionEnded';
  
  constructor(
    aggregateId: string,
    public readonly conclusion?: string
  ) {
    super(aggregateId);
  }
}

// エクスポート
export { EventBus } from './event-bus';
export { EventStore } from './event-store';