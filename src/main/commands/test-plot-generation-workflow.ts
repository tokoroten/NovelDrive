/**
 * プロット生成ワークフローのテストコマンド
 */

import { getDatabase } from '../database';
import { getOpenAI } from '../services/openai-service';
import { getApiUsageLogger } from '../services/api-usage-logger';
import { PlotManager } from '../services/plot-management';
import { PlotGenerationWorkflow } from '../services/plot-generation-workflow';

export async function testPlotGenerationWorkflow(): Promise<void> {
  console.log('=== プロット生成ワークフローテスト開始 ===');

  try {
    // 必要なサービスの取得
    const db = getDatabase();
    const openai = getOpenAI();
    const apiLogger = getApiUsageLogger();

    if (!db) {
      throw new Error('Database not initialized');
    }

    if (!openai) {
      throw new Error('OpenAI not initialized');
    }

    if (!apiLogger) {
      throw new Error('API Logger not initialized');
    }

    const conn = db.connect();
    const plotManager = new PlotManager(conn);
    
    // ワークフローの初期化
    const workflow = new PlotGenerationWorkflow(
      plotManager,
      conn,
      openai,
      apiLogger
    );

    // イベントリスナーの設定
    workflow.on('sessionStarted', (data) => {
      console.log('📝 セッション開始:', data);
    });

    workflow.on('stageStarted', (data) => {
      console.log('🔄 ステージ開始:', data.stage);
    });

    workflow.on('serendipitySearchCompleted', (data) => {
      console.log('🔍 セレンディピティ検索完了:', data.elements, '個の要素を発見');
    });

    workflow.on('initialPlotGenerated', (data) => {
      console.log('📋 初期プロット生成完了:', data.plotId);
    });

    workflow.on('discussionStarted', (data) => {
      console.log('💬 エージェント議論開始:', data.discussionId);
    });

    workflow.on('plotRefined', (data) => {
      console.log('✨ プロット改善完了:', data.refinedPlotId, '改善点:', data.improvements);
    });

    workflow.on('evaluationCompleted', (data) => {
      console.log('📊 評価完了:', data.evaluation.overallScore, '点');
    });

    workflow.on('approvalDecision', (data) => {
      console.log('✅ 承認判定:', data.approved ? '承認' : '不承用', ':', data.plotId);
    });

    workflow.on('sessionCompleted', (data) => {
      console.log('🎉 セッション完了:', data.sessionId);
      console.log('最終プロット:', data.finalPlotId);
      console.log('評価結果:', data.evaluation);
    });

    workflow.on('sessionFailed', (data) => {
      console.error('❌ セッション失敗:', data.sessionId, data.error);
    });

    // テスト用のプロット生成リクエスト
    const testRequest = {
      theme: '友情と成長',
      genre: 'ファンタジー',
      targetAudience: 'ヤングアダルト',
      initialIdea: '異世界に転移した高校生が、魔法を使えないという困難を乗り越えながら仲間と絆を深める物語',
      constraints: ['暴力的な内容は避ける', '希望のある結末にする'],
      projectId: 'test-project-001'
    };

    console.log('🚀 プロット生成開始...');
    console.log('テーマ:', testRequest.theme);
    console.log('ジャンル:', testRequest.genre);
    console.log('初期アイデア:', testRequest.initialIdea);

    // プロット生成の開始
    const sessionId = await workflow.startPlotGeneration(testRequest);
    console.log('セッションID:', sessionId);

    // セッション状態の監視（テスト用）
    const checkInterval = setInterval(async () => {
      const session = workflow.getSession(sessionId);
      if (session) {
        console.log(`進行状況: ${session.currentStage + 1}/${session.stages.length} - ${session.status}`);
        
        if (session.status === 'completed' || session.status === 'failed' || session.status === 'cancelled') {
          clearInterval(checkInterval);
          
          // 最終結果の表示
          console.log('\n=== 最終結果 ===');
          console.log('ステータス:', session.status);
          console.log('生成されたプロット数:', session.plots.length);
          if (session.finalPlotId) {
            console.log('最終プロットID:', session.finalPlotId);
          }
          if (session.evaluation) {
            console.log('評価スコア:', session.evaluation.overallScore);
            console.log('推奨事項:', session.evaluation.recommendation);
          }
          if (session.metadata) {
            console.log('セレンディピティ要素:', session.metadata.serendipityElements?.length || 0);
            console.log('人間の介入回数:', session.metadata.humanInterventions || 0);
            console.log('改善イテレーション回数:', session.metadata.iterationCount || 0);
          }

          console.log('\n=== ステージ詳細 ===');
          session.stages.forEach((stage, index) => {
            console.log(`${index + 1}. ${stage.name}: ${stage.status}`);
            if (stage.error) {
              console.log(`   エラー: ${stage.error}`);
            }
            if (stage.startTime && stage.endTime) {
              const duration = new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime();
              console.log(`   実行時間: ${duration}ms`);
            }
          });

          console.log('\n=== プロット生成ワークフローテスト完了 ===');
        }
      }
    }, 2000);

    // 10分でタイムアウト
    setTimeout(() => {
      clearInterval(checkInterval);
      workflow.cancelSession(sessionId);
      console.log('⏰ テストタイムアウト - セッションをキャンセルしました');
    }, 10 * 60 * 1000);

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

// コマンドライン実行時のエントリーポイント
if (require.main === module) {
  testPlotGenerationWorkflow().catch(console.error);
}