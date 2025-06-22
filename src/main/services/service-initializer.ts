/**
 * サービス初期化管理
 * 全ての複雑なサービスの依存関係を管理し、適切な順序で初期化する
 */

import * as duckdb from 'duckdb';
import OpenAI from 'openai';
import { PlotManager } from './plot-management';
import { PlotGenerationWorkflow, setupPlotGenerationHandlers } from './plot-generation-workflow';
import { ApiUsageLogger } from './api-usage-logger';
import { MultiAgentOrchestrator } from './multi-agent-system';
import { AutonomousHandlers } from './autonomous-handlers';

let plotGenerationWorkflow: PlotGenerationWorkflow | null = null;
let multiAgentOrchestrator: MultiAgentOrchestrator | null = null;
let autonomousHandlers: AutonomousHandlers | null = null;

/**
 * OpenAIサービスが初期化された後にプロット生成ワークフローを初期化
 */
export function initializePlotGenerationWorkflow(
  openai: OpenAI, 
  dbConnection: duckdb.Connection,
  apiLogger: ApiUsageLogger
): void {
  try {
    // プロットマネージャーの初期化
    const plotManager = new PlotManager(dbConnection);
    
    // プロット生成ワークフローの初期化
    plotGenerationWorkflow = new PlotGenerationWorkflow(
      plotManager,
      dbConnection,
      openai,
      apiLogger
    );

    // IPCハンドラーの設定
    setupPlotGenerationHandlers(plotGenerationWorkflow);

    console.log('Plot generation workflow initialized successfully');
  } catch (error) {
    console.error('Failed to initialize plot generation workflow:', error);
  }
}

/**
 * 自律モードシステムを初期化
 */
export async function initializeAutonomousMode(
  dbConnection: duckdb.Connection
): Promise<void> {
  try {
    // マルチエージェントオーケストレーターの初期化
    multiAgentOrchestrator = new MultiAgentOrchestrator(dbConnection);
    
    // 自律モードハンドラーの初期化
    autonomousHandlers = new AutonomousHandlers(dbConnection, multiAgentOrchestrator);
    await autonomousHandlers.initialize();

    console.log('Autonomous mode system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize autonomous mode system:', error);
  }
}

/**
 * プロット生成ワークフローのインスタンスを取得
 */
export function getPlotGenerationWorkflow(): PlotGenerationWorkflow | null {
  return plotGenerationWorkflow;
}

/**
 * マルチエージェントオーケストレーターのインスタンスを取得
 */
export function getMultiAgentOrchestrator(): MultiAgentOrchestrator | null {
  return multiAgentOrchestrator;
}

/**
 * 自律モードハンドラーのインスタンスを取得
 */
export function getAutonomousHandlers(): AutonomousHandlers | null {
  return autonomousHandlers;
}

/**
 * 全てのサービスをクリーンアップ
 */
export async function cleanup(): Promise<void> {
  if (autonomousHandlers) {
    await autonomousHandlers.cleanup();
    autonomousHandlers = null;
  }
  
  if (multiAgentOrchestrator) {
    await multiAgentOrchestrator.cleanup();
    multiAgentOrchestrator = null;
  }
  
  if (plotGenerationWorkflow) {
    // 必要に応じてクリーンアップ処理を追加
    plotGenerationWorkflow = null;
  }
}