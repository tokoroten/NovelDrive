/**
 * サービスレジストリ
 * DIコンテナへのサービス登録を管理
 */

import * as duckdb from 'duckdb';
import { DIContainer } from '../core/di-container';
import { EventBus, eventBus } from '../core/events/event-bus';
import { EventStore } from '../core/events/event-store';
import { UnitOfWork } from '../infrastructure/repositories';
import { KnowledgeApplicationService } from '../application/services/knowledge-service';
import { PlotApplicationService } from '../application/services/plot-service';
import { InMemoryTaskQueue } from '../core/async/task-queue';
import { LocalEmbeddingService } from './local-embedding-service';
import { OpenAICompletionService } from './openai-completion-service';
import { 
  AgentManager,
  WriterAgent,
  EditorAgent,
  ProofreaderAgent,
  DeputyEditorAgent
} from './agents';
import { KnowledgeGraphService } from './knowledge-graph-service';
import { SerendipitySearchService } from './serendipity-search-service';
import { PlotManager } from './plot-management';
import { AutonomousLogger } from './autonomous-logger';
import { AITextGenerator } from './ai-text-generator';
import { ExportService } from './export-service';

/**
 * サービスを登録
 */
export async function registerServices(
  container: DIContainer,
  db: duckdb.Database
): Promise<void> {
  // イベントバス（シングルトン）
  container.register('eventBus', async () => eventBus, { singleton: true });

  // データベース接続
  container.register('db', async () => db, { singleton: true });

  // 接続取得用のファクトリー
  container.register('connectionFactory', async () => {
    return () => new Promise<duckdb.Connection>((resolve, reject) => {
      db.connect((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });
  }, { singleton: true });

  // イベントストア
  container.register('eventStore', async (deps) => {
    const conn = await deps.connectionFactory();
    return new EventStore(conn);
  }, { singleton: true });

  // Unit of Work
  container.register('unitOfWork', async (deps) => {
    return new UnitOfWork(deps.db, deps.eventBus);
  }, { singleton: true });

  // 埋め込みサービス（ローカルモデル使用）
  container.register('embeddingService', async () => {
    return new LocalEmbeddingService();
  }, { singleton: true });

  container.register('completionService', async () => {
    return new OpenAICompletionService(process.env.OPENAI_API_KEY || '');
  }, { singleton: true });

  // アプリケーションサービス
  container.register('knowledgeService', async (deps) => {
    return new KnowledgeApplicationService(
      await deps.unitOfWork,
      await deps.embeddingService
    );
  });

  container.register('plotService', async (deps) => {
    return new PlotApplicationService(await deps.unitOfWork);
  });

  // エージェント
  container.register('writerAgent', async (deps) => {
    return new WriterAgent(await deps.completionService);
  });

  container.register('editorAgent', async (deps) => {
    return new EditorAgent(await deps.completionService);
  });

  container.register('proofreaderAgent', async (deps) => {
    return new ProofreaderAgent(await deps.completionService);
  });

  container.register('deputyEditorAgent', async (deps) => {
    return new DeputyEditorAgent(await deps.completionService);
  });

  container.register('agentManager', async (deps) => {
    const manager = new AgentManager();
    manager.registerAgent('writer', await deps.writerAgent);
    manager.registerAgent('editor', await deps.editorAgent);
    manager.registerAgent('proofreader', await deps.proofreaderAgent);
    manager.registerAgent('deputy_editor', await deps.deputyEditorAgent);
    return manager;
  }, { singleton: true });

  // ドメインサービス
  container.register('knowledgeGraphService', async (deps) => {
    const conn = await deps.connectionFactory();
    return new KnowledgeGraphService(conn);
  });

  container.register('serendipitySearchService', async (deps) => {
    const conn = await deps.connectionFactory();
    return new SerendipitySearchService(
      conn,
      await deps.embeddingService
    );
  });

  container.register('plotManager', async (deps) => {
    const conn = await deps.connectionFactory();
    return new PlotManager(conn);
  });

  // Chapter management doesn't have a service class, it uses setupChapterHandlers
  // So we'll remove this registration

  // その他のサービス
  container.register('autonomousLogger', async (deps) => {
    const conn = await deps.connectionFactory();
    return new AutonomousLogger(conn);
  });

  container.register('aiTextGenerator', async (deps) => {
    return new AITextGenerator(await deps.completionService);
  });

  container.register('exportService', async (deps) => {
    const conn = await deps.connectionFactory();
    return new ExportService(conn);
  });

  // タスクキュー
  container.register('taskQueue', async () => {
    const queue = new InMemoryTaskQueue();
    
    // タスクプロセッサーを登録
    queue.registerProcessor('generateEmbedding', async (payload: any) => {
      const embeddingService = await container.get<OpenAIEmbeddingService>('embeddingService');
      return embeddingService.generateEmbedding(payload.text);
    });

    queue.registerProcessor('generatePlot', async (payload: any) => {
      const aiGenerator = await container.get<AITextGenerator>('aiTextGenerator');
      return aiGenerator.generatePlot(payload.prompt, payload.context);
    });

    return queue;
  }, { singleton: true });

  // イベントハンドラーの登録
  await registerEventHandlers(container);
}

/**
 * イベントハンドラーを登録
 */
async function registerEventHandlers(container: DIContainer): Promise<void> {
  const bus = await container.get<EventBus>('eventBus');
  const store = await container.get<EventStore>('eventStore');

  // 全てのドメインイベントをイベントストアに保存
  bus.use(async (event) => {
    try {
      await store.save(event);
    } catch (error) {
      console.error('Failed to save event to store:', error);
    }
  });

  // 知識作成時に自動的に埋め込みを生成
  bus.subscribe('knowledge.created', async (event) => {
    const queue = await container.get<InMemoryTaskQueue>('taskQueue');
    const knowledgeService = await container.get<KnowledgeApplicationService>('knowledgeService');
    
    try {
      const knowledge = await knowledgeService.getKnowledge(event.aggregateId);
      await queue.enqueue('generateEmbedding', {
        knowledgeId: knowledge.id,
        text: `${knowledge.title}\n\n${knowledge.content}`
      });
    } catch (error) {
      console.error('Failed to enqueue embedding generation:', error);
    }
  });

  // プロット作成時の処理
  bus.subscribe('plot.created', async (event) => {
    console.log('New plot created:', event.payload);
    // TODO: プロット作成時の追加処理
  });

  // 自律モード完了時の処理
  bus.subscribe('autonomous.operation_completed', async (event) => {
    const logger = await container.get<AutonomousLogger>('autonomousLogger');
    console.log('Autonomous operation completed:', event.payload);
    // TODO: 品質チェックと保存処理
  });
}

/**
 * サービスのクリーンアップ
 */
export async function cleanupServices(container: DIContainer): Promise<void> {
  // タスクキューを停止
  const queue = await container.get<InMemoryTaskQueue>('taskQueue');
  await queue.stop();

  // Unit of Workを閉じる
  const uow = await container.get<UnitOfWork>('unitOfWork');
  await uow.close();

  // イベントバスをクリア
  const bus = await container.get<EventBus>('eventBus');
  bus.clear();
}