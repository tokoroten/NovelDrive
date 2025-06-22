import React, { useState, useEffect, useRef } from 'react';

interface PlotGenerationRequest {
  theme: string;
  genre: string;
  targetAudience?: string;
  initialIdea?: string;
  constraints?: string[];
  projectId: string;
  humanUserId?: string;
}

interface PlotGenerationStage {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  result?: any;
  error?: string;
}

interface PlotGenerationSession {
  id: string;
  request: PlotGenerationRequest;
  stages: PlotGenerationStage[];
  currentStage: number;
  status: 'initializing' | 'generating' | 'discussing' | 'evaluating' | 'completed' | 'failed' | 'cancelled';
  discussionId?: string;
  plots: string[];
  finalPlotId?: string;
  evaluation?: any;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    serendipityElements?: string[];
    humanInterventions?: number;
    iterationCount?: number;
  };
}

interface PlotGenerationWorkflowProps {
  projectId: string;
  onPlotGenerated?: (plotId: string) => void;
  onClose?: () => void;
}

export function PlotGenerationWorkflow({ 
  projectId, 
  onPlotGenerated, 
  onClose 
}: PlotGenerationWorkflowProps) {
  const [currentSession, setCurrentSession] = useState<PlotGenerationSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<PlotGenerationRequest>({
    theme: '',
    genre: '',
    targetAudience: '',
    initialIdea: '',
    constraints: [],
    projectId,
  });
  const [interventionText, setInterventionText] = useState('');
  const [showIntervention, setShowIntervention] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [sessions, setSessions] = useState<PlotGenerationSession[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const stageNames: Record<string, string> = {
    serendipity_search: 'セレンディピティ検索',
    initial_plot_gen: '初期プロット生成',
    agent_discussion: 'エージェント議論',
    plot_refinement: 'プロット改善',
    final_evaluation: '最終評価',
    approval_decision: '承認判定'
  };

  const genreOptions = [
    'ファンタジー',
    'SF',
    'ミステリー',
    'ロマンス',
    'ホラー',
    'スリラー',
    'ライトノベル',
    '純文学',
    '歴史小説',
    '青春小説'
  ];

  const targetAudienceOptions = [
    '10代',
    '20代',
    '30代',
    '40代以上',
    '男性向け',
    '女性向け',
    'ヤングアダルト',
    '一般向け'
  ];

  useEffect(() => {
    loadSessions();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const loadSessions = async () => {
    try {
      const response = await window.electronAPI.plotGen.getSessions();
      if (response.success) {
        setSessions(response.sessions);
      }
    } catch (error) {
      addLog('セッション一覧の読み込みに失敗しました');
    }
  };

  const startGeneration = async () => {
    if (!formData.theme || !formData.genre) {
      alert('テーマとジャンルは必須です');
      return;
    }

    setIsGenerating(true);
    setLogs([]);
    addLog('プロット生成を開始します...');

    try {
      const response = await window.electronAPI.plotGen.start(formData);
      
      if (response.success) {
        setCurrentSession({ 
          id: response.sessionId,
          ...formData,
          stages: [],
          currentStage: 0,
          status: 'initializing',
          plots: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as PlotGenerationSession);
        
        addLog(`セッション開始: ${response.sessionId}`);
        
        // セッション状態を定期的に更新
        intervalRef.current = setInterval(() => {
          updateSessionStatus(response.sessionId);
        }, 2000);
        
      } else {
        addLog(`エラー: ${response.error}`);
        setIsGenerating(false);
      }
    } catch (error) {
      addLog('プロット生成の開始に失敗しました');
      setIsGenerating(false);
    }
  };

  const updateSessionStatus = async (sessionId: string) => {
    try {
      const response = await window.electronAPI.plotGen.getSession(sessionId);
      
      if (response.success && response.session) {
        const session = response.session;
        setCurrentSession(session);
        
        if (session.status === 'completed') {
          addLog('プロット生成が完了しました！');
          setIsGenerating(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          
          if (session.finalPlotId && onPlotGenerated) {
            onPlotGenerated(session.finalPlotId);
          }
          
        } else if (session.status === 'failed') {
          addLog('プロット生成に失敗しました');
          setIsGenerating(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          
        } else if (session.status === 'discussing') {
          setShowIntervention(true);
        }
        
        await loadSessions();
      }
    } catch (error) {
      // セッション状態の取得に失敗
    }
  };

  const cancelGeneration = async () => {
    if (!currentSession) return;

    try {
      const response = await window.electronAPI.plotGen.cancel(currentSession.id);
      
      if (response.success) {
        addLog('プロット生成をキャンセルしました');
        setIsGenerating(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    } catch (error) {
      addLog('キャンセルに失敗しました');
    }
  };

  const addIntervention = async () => {
    if (!currentSession || !interventionText.trim()) return;

    try {
      const response = await window.electronAPI.plotGen.addIntervention(
        currentSession.id,
        interventionText
      );
      
      if (response.success) {
        addLog(`人間の介入を追加: ${interventionText.substring(0, 50)}...`);
        setInterventionText('');
      } else {
        addLog('介入の追加に失敗しました');
      }
    } catch (error) {
      addLog('介入の追加に失敗しました');
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const getStageProgress = () => {
    if (!currentSession) return 0;
    return Math.round((currentSession.currentStage / currentSession.stages.length) * 100);
  };

  const renderStageStatus = (stage: PlotGenerationStage) => {
    const statusColors = {
      pending: 'text-gray-400',
      in_progress: 'text-blue-600',
      completed: 'text-green-600',
      failed: 'text-red-600'
    };

    const statusIcons = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
      failed: '❌'
    };

    return (
      <div className="flex items-center gap-2">
        <span className="text-lg">{statusIcons[stage.status]}</span>
        <span className={`font-medium ${statusColors[stage.status]}`}>
          {stageNames[stage.name] || stage.name}
        </span>
        {stage.error && (
          <span className="text-sm text-red-500">({stage.error})</span>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">
              AIプロット生成ワークフロー
            </h2>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex">
          {/* 左側：入力フォーム */}
          <div className="w-1/2 p-6 border-r border-gray-200">
            <h3 className="text-lg font-semibold mb-4">プロット生成設定</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  テーマ *
                </label>
                <input
                  type="text"
                  value={formData.theme}
                  onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="例: 友情と成長、禁断の恋、復讐"
                  disabled={isGenerating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  ジャンル *
                </label>
                <select
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded"
                  disabled={isGenerating}
                >
                  <option value="">選択してください</option>
                  {genreOptions.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  ターゲット読者層
                </label>
                <select
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded"
                  disabled={isGenerating}
                >
                  <option value="">指定なし</option>
                  {targetAudienceOptions.map(audience => (
                    <option key={audience} value={audience}>{audience}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  初期アイデア
                </label>
                <textarea
                  value={formData.initialIdea}
                  onChange={(e) => setFormData({ ...formData, initialIdea: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded h-24 resize-none"
                  placeholder="物語の核となるアイデアや設定があれば記述してください"
                  disabled={isGenerating}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={startGeneration}
                  disabled={isGenerating || !formData.theme || !formData.genre}
                  className={`px-4 py-2 rounded font-medium flex-1 ${
                    isGenerating || !formData.theme || !formData.genre
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {isGenerating ? '生成中...' : 'プロット生成開始'}
                </button>
                
                {isGenerating && (
                  <button
                    onClick={cancelGeneration}
                    className="px-4 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50"
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 右側：進行状況 */}
          <div className="w-1/2 p-6">
            <h3 className="text-lg font-semibold mb-4">生成進行状況</h3>
            
            {currentSession ? (
              <div className="space-y-4">
                {/* プログレスバー */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>進行状況</span>
                    <span>{getStageProgress()}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getStageProgress()}%` }}
                    />
                  </div>
                </div>

                {/* ステージ一覧 */}
                <div className="space-y-2">
                  {currentSession.stages.map((stage, index) => (
                    <div key={stage.name} className="flex items-center gap-3 p-2 rounded">
                      <span className="text-sm text-gray-500 w-8">
                        {index + 1}
                      </span>
                      {renderStageStatus(stage)}
                    </div>
                  ))}
                </div>

                {/* セッション情報 */}
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm space-y-1">
                    <div>ステータス: <span className="font-medium">{currentSession.status}</span></div>
                    <div>生成されたプロット数: {currentSession.plots.length}</div>
                    {currentSession.metadata?.serendipityElements && (
                      <div>発見された要素: {currentSession.metadata.serendipityElements.length}個</div>
                    )}
                    {currentSession.metadata?.humanInterventions && (
                      <div>人間の介入: {currentSession.metadata.humanInterventions}回</div>
                    )}
                  </div>
                </div>

                {/* 人間の介入UI */}
                {showIntervention && currentSession.status === 'discussing' && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                    <h4 className="font-medium text-yellow-800 mb-2">
                      💡 エージェント議論中 - 人間の介入が可能です
                    </h4>
                    <textarea
                      value={interventionText}
                      onChange={(e) => setInterventionText(e.target.value)}
                      className="w-full p-2 border border-yellow-300 rounded h-20 resize-none"
                      placeholder="議論に対する指示や方向修正があれば入力してください"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={addIntervention}
                        disabled={!interventionText.trim()}
                        className={`px-3 py-1 rounded text-sm ${
                          interventionText.trim()
                            ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        介入する
                      </button>
                      <button
                        onClick={() => setShowIntervention(false)}
                        className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
                      >
                        閉じる
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-10">
                プロット生成を開始してください
              </div>
            )}
          </div>
        </div>

        {/* ログ */}
        {logs.length > 0 && (
          <div className="border-t border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-3">生成ログ</h3>
            <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-40 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </div>
          </div>
        )}

        {/* 過去のセッション */}
        <div className="border-t border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-3">過去のセッション</h3>
          {sessions.length === 0 ? (
            <div className="text-gray-500 text-center py-4">
              過去のセッションはありません
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {sessions.slice(-10).reverse().map(session => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <div>
                    <div className="font-medium">
                      {session.request.theme} - {session.request.genre}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(session.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      session.status === 'completed' ? 'text-green-600' :
                      session.status === 'failed' ? 'text-red-600' :
                      session.status === 'cancelled' ? 'text-gray-600' :
                      'text-blue-600'
                    }`}>
                      {session.status}
                    </div>
                    {session.evaluation && (
                      <div className="text-xs text-gray-500">
                        評価: {session.evaluation.overallScore}点
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}