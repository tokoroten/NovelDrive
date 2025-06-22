/**
 * ドメインイベント定義
 */

import { v4 as uuidv4 } from 'uuid';
import { DomainEvent } from './event-bus';

/**
 * 基底ドメインイベントクラス
 */
abstract class BaseDomainEvent implements DomainEvent {
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

  constructor(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    payload: any,
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    this.eventId = uuidv4();
    this.eventType = eventType;
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.payload = payload;
    this.metadata = {
      timestamp: new Date(),
      ...metadata
    };
  }
}

/**
 * 知識関連イベント
 */
export class KnowledgeCreated extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'knowledge.created';

  constructor(
    knowledgeId: string,
    payload: {
      title: string;
      type: string;
      projectId?: string;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(KnowledgeCreated.EVENT_TYPE, knowledgeId, 'knowledge', payload, metadata);
  }
}

export class KnowledgeUpdated extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'knowledge.updated';

  constructor(
    knowledgeId: string,
    payload: {
      changes: Record<string, any>;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(KnowledgeUpdated.EVENT_TYPE, knowledgeId, 'knowledge', payload, metadata);
  }
}

export class KnowledgeDeleted extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'knowledge.deleted';

  constructor(
    knowledgeId: string,
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(KnowledgeDeleted.EVENT_TYPE, knowledgeId, 'knowledge', {}, metadata);
  }
}

export class KnowledgeEmbeddingGenerated extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'knowledge.embedding_generated';

  constructor(
    knowledgeId: string,
    payload: {
      dimensions: number;
      model: string;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(KnowledgeEmbeddingGenerated.EVENT_TYPE, knowledgeId, 'knowledge', payload, metadata);
  }
}

/**
 * プロット関連イベント
 */
export class PlotCreated extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'plot.created';

  constructor(
    plotId: string,
    payload: {
      projectId: string;
      version: string;
      parentVersion?: string;
      title: string;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(PlotCreated.EVENT_TYPE, plotId, 'plot', payload, metadata);
  }
}

export class PlotForked extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'plot.forked';

  constructor(
    plotId: string,
    payload: {
      parentPlotId: string;
      parentVersion: string;
      newVersion: string;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(PlotForked.EVENT_TYPE, plotId, 'plot', payload, metadata);
  }
}

export class PlotStatusChanged extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'plot.status_changed';

  constructor(
    plotId: string,
    payload: {
      oldStatus: string;
      newStatus: string;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(PlotStatusChanged.EVENT_TYPE, plotId, 'plot', payload, metadata);
  }
}

/**
 * エージェント議論関連イベント
 */
export class DiscussionStarted extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'discussion.started';

  constructor(
    discussionId: string,
    payload: {
      topic: string;
      participants: string[];
      projectId?: string;
      plotId?: string;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(DiscussionStarted.EVENT_TYPE, discussionId, 'discussion', payload, metadata);
  }
}

export class DiscussionMessageAdded extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'discussion.message_added';

  constructor(
    discussionId: string,
    payload: {
      messageId: string;
      agentId: string;
      content: string;
      inReplyTo?: string;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(DiscussionMessageAdded.EVENT_TYPE, discussionId, 'discussion', payload, metadata);
  }
}

export class DiscussionCompleted extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'discussion.completed';

  constructor(
    discussionId: string,
    payload: {
      decisions: string[];
      qualityScore: number;
      messageCount: number;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(DiscussionCompleted.EVENT_TYPE, discussionId, 'discussion', payload, metadata);
  }
}

/**
 * 自律モード関連イベント
 */
export class AutonomousOperationStarted extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'autonomous.operation_started';

  constructor(
    operationId: string,
    payload: {
      type: string;
      projectId?: string;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(AutonomousOperationStarted.EVENT_TYPE, operationId, 'autonomous_operation', payload, metadata);
  }
}

export class AutonomousOperationCompleted extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'autonomous.operation_completed';

  constructor(
    operationId: string,
    payload: {
      type: string;
      result: any;
      qualityScore: number;
      saved: boolean;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(AutonomousOperationCompleted.EVENT_TYPE, operationId, 'autonomous_operation', payload, metadata);
  }
}

export class AutonomousOperationFailed extends BaseDomainEvent {
  static readonly EVENT_TYPE = 'autonomous.operation_failed';

  constructor(
    operationId: string,
    payload: {
      type: string;
      error: string;
    },
    metadata?: Partial<DomainEvent['metadata']>
  ) {
    super(AutonomousOperationFailed.EVENT_TYPE, operationId, 'autonomous_operation', payload, metadata);
  }
}