import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface AutonomousModeConfig {
  enabled: boolean;
  projectId: string;
  schedule: {
    writingInterval: number;
    ideaGenerationInterval: number;
    discussionInterval: number;
  };
  quality: {
    minQualityScore: number;
    autoSaveThreshold: number;
    requireHumanApproval: boolean;
  };
  limits: {
    maxChaptersPerDay: number;
    maxWordsPerSession: number;
    maxTokensPerDay: number;
  };
}

interface AutonomousActivity {
  id: string;
  timestamp: string;
  type: 'idea_generation' | 'plot_development' | 'chapter_writing' | 'discussion' | 'quality_check';
  projectId: string;
  status: 'success' | 'failed' | 'pending_approval';
  content: any;
  qualityScore?: number;
  tokensUsed?: number;
  error?: string;
}

interface AutonomousStatus {
  isRunning: boolean;
  config: AutonomousModeConfig;
  dailyTokenUsage: number;
  tokenLimitRemaining: number;
}

export function AutonomousMode() {
  const [status, setStatus] = useState<AutonomousStatus | null>(null);
  const [activities, setActivities] = useState<AutonomousActivity[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<AutonomousActivity[]>([]);
  const [configValues, setConfigValues] = useState<AutonomousModeConfig>({
    enabled: false,
    projectId: '',
    schedule: {
      writingInterval: 120,
      ideaGenerationInterval: 60,
      discussionInterval: 180,
    },
    quality: {
      minQualityScore: 65,
      autoSaveThreshold: 70,
      requireHumanApproval: true,
    },
    limits: {
      maxChaptersPerDay: 3,
      maxWordsPerSession: 5000,
      maxTokensPerDay: 100000,
    },
  });

  useEffect(() => {
    loadProjects();
    loadStatus();
    loadActivities();

    // イベントリスナーの設定
    window.electronAPI.agents.onAgentStatusUpdate((data: any) => {
      if (data.type === 'autonomous') {
        loadStatus();
        loadActivities();
      }
    });
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectConfig(selectedProject);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const result = await window.electronAPI.database.listProjects();
      setProjects(result);
      if (result.length > 0 && !selectedProject) {
        setSelectedProject(result[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const result = await window.electronAPI.autonomous.getStatus();
      setStatus(result);
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  const loadActivities = async () => {
    try {
      const sql = `
        SELECT * FROM autonomous_activities 
        WHERE project_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 50
      `;
      const result = await window.electronAPI.database.query(sql, [selectedProject]);
      const activities = result.map((row: any) => ({
        ...row,
        content: JSON.parse(row.content || '{}'),
      }));
      setActivities(activities);
      
      // 承認待ちの活動を抽出
      setPendingApprovals(activities.filter(a => a.status === 'pending_approval'));
    } catch (error) {
      console.error('Failed to load activities:', error);
    }
  };

  const loadProjectConfig = async (projectId: string) => {
    try {
      const sql = `
        SELECT config FROM autonomous_config 
        WHERE project_id = ? 
        LIMIT 1
      `;
      const result = await window.electronAPI.database.query(sql, [projectId]);
      if (result.length > 0) {
        const config = JSON.parse(result[0].config);
        setConfigValues(config);
      }
    } catch (error) {
      console.error('Failed to load project config:', error);
    }
  };

  const toggleAutonomousMode = async () => {
    try {
      if (status?.isRunning) {
        await window.electronAPI.autonomous.stop();
      } else {
        await window.electronAPI.autonomous.updateConfig({
          ...configValues,
          enabled: true,
          projectId: selectedProject,
        });
        await window.electronAPI.autonomous.start();
      }
      await loadStatus();
    } catch (error) {
      console.error('Failed to toggle autonomous mode:', error);
    }
  };

  const updateConfig = async () => {
    try {
      await window.electronAPI.autonomous.updateConfig({
        ...configValues,
        projectId: selectedProject,
      });
      setShowConfigDialog(false);
      await loadStatus();
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  const approveActivity = async (activity: AutonomousActivity) => {
    if (activity.type === 'chapter_writing' && activity.content.chapterId) {
      try {
        await window.electronAPI.chapters.update(activity.content.chapterId, {
          content: activity.content.content,
          status: 'completed',
        });
        
        // 活動ステータスを更新
        await window.electronAPI.database.execute(
          `UPDATE autonomous_activities SET status = 'success' WHERE id = ?`,
          [activity.id]
        );
        
        await loadActivities();
      } catch (error) {
        console.error('Failed to approve activity:', error);
      }
    }
  };

  const rejectActivity = async (activity: AutonomousActivity) => {
    try {
      await window.electronAPI.database.execute(
        `UPDATE autonomous_activities SET status = 'failed' WHERE id = ?`,
        [activity.id]
      );
      await loadActivities();
    } catch (error) {
      console.error('Failed to reject activity:', error);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'chapter_writing':
        return '📝';
      case 'idea_generation':
        return '💡';
      case 'discussion':
        return '💬';
      case 'plot_development':
        return '📊';
      case 'quality_check':
        return '✅';
      default:
        return '📌';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'pending_approval':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatInterval = (minutes: number) => {
    if (minutes < 60) return `${minutes}分`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">24時間自律モード</h1>
            <p className="text-gray-600">
              AIが自律的に執筆・アイデア生成・議論を行います
            </p>
          </div>
          
          <div className="text-right">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="mb-4 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">プロジェクトを選択</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowConfigDialog(true)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={!selectedProject}
              >
                設定
              </button>
              
              <button
                onClick={toggleAutonomousMode}
                disabled={!selectedProject}
                className={`px-6 py-2 rounded-md font-medium ${
                  status?.isRunning
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {status?.isRunning ? '停止' : '開始'}
              </button>
            </div>
          </div>
        </div>

        {/* ステータス表示 */}
        {status && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">ステータス</div>
              <div className={`text-xl font-semibold ${status.isRunning ? 'text-green-600' : 'text-gray-600'}`}>
                {status.isRunning ? '実行中' : '停止中'}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">本日のトークン使用量</div>
              <div className="text-xl font-semibold">
                {status.dailyTokenUsage.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">
                残り: {status.tokenLimitRemaining.toLocaleString()}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">品質閾値</div>
              <div className="text-xl font-semibold">
                {status.config.quality.minQualityScore}点
              </div>
              <div className="text-xs text-gray-500">
                自動保存: {status.config.quality.autoSaveThreshold}点
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">承認待ち</div>
              <div className="text-xl font-semibold text-yellow-600">
                {pendingApprovals.length}件
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 承認待ちセクション */}
      {pendingApprovals.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">承認待ちの活動</h2>
          <div className="space-y-4">
            {pendingApprovals.map((activity) => (
              <div key={activity.id} className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getActivityIcon(activity.type)}</span>
                    <div>
                      <div className="font-medium">
                        {activity.type === 'chapter_writing' && `章の執筆`}
                        {activity.type === 'idea_generation' && `アイデア生成`}
                      </div>
                      <div className="text-sm text-gray-500">
                        品質スコア: {activity.qualityScore}点
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveActivity(activity)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      承認
                    </button>
                    <button
                      onClick={() => rejectActivity(activity)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      却下
                    </button>
                  </div>
                </div>
                
                {activity.content.content && (
                  <div className="mt-2 p-3 bg-gray-50 rounded text-sm max-h-40 overflow-y-auto">
                    {activity.content.content.substring(0, 300)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* アクティビティログ */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">アクティビティログ</h2>
        
        <div className="space-y-3">
          {activities.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              まだアクティビティがありません
            </p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                <span className="text-2xl mt-1">{getActivityIcon(activity.type)}</span>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">
                        {activity.type === 'chapter_writing' && '章の執筆'}
                        {activity.type === 'idea_generation' && 'アイデア生成'}
                        {activity.type === 'discussion' && '議論セッション'}
                        {activity.type === 'plot_development' && 'プロット開発'}
                        {activity.type === 'quality_check' && '品質チェック'}
                      </span>
                      <span className={`ml-2 text-sm ${getStatusColor(activity.status)}`}>
                        {activity.status === 'success' && '成功'}
                        {activity.status === 'failed' && '失敗'}
                        {activity.status === 'pending_approval' && '承認待ち'}
                      </span>
                    </div>
                    
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(activity.timestamp), {
                        addSuffix: true,
                        locale: ja,
                      })}
                    </span>
                  </div>
                  
                  {activity.qualityScore && (
                    <div className="text-sm text-gray-600 mt-1">
                      品質スコア: {activity.qualityScore}点
                    </div>
                  )}
                  
                  {activity.tokensUsed && (
                    <div className="text-sm text-gray-600">
                      使用トークン: {activity.tokensUsed.toLocaleString()}
                    </div>
                  )}
                  
                  {activity.error && (
                    <div className="text-sm text-red-600 mt-1">
                      エラー: {activity.error}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 設定ダイアログ */}
      {showConfigDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-6">自律モード設定</h3>
            
            <div className="space-y-6">
              {/* スケジュール設定 */}
              <div>
                <h4 className="font-medium mb-3">実行スケジュール</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      執筆間隔
                    </label>
                    <input
                      type="number"
                      value={configValues.schedule.writingInterval}
                      onChange={(e) => setConfigValues({
                        ...configValues,
                        schedule: {
                          ...configValues.schedule,
                          writingInterval: parseInt(e.target.value) || 120,
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="30"
                      step="30"
                    />
                    <span className="text-xs text-gray-500">分</span>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      アイデア生成間隔
                    </label>
                    <input
                      type="number"
                      value={configValues.schedule.ideaGenerationInterval}
                      onChange={(e) => setConfigValues({
                        ...configValues,
                        schedule: {
                          ...configValues.schedule,
                          ideaGenerationInterval: parseInt(e.target.value) || 60,
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="30"
                      step="30"
                    />
                    <span className="text-xs text-gray-500">分</span>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      議論間隔
                    </label>
                    <input
                      type="number"
                      value={configValues.schedule.discussionInterval}
                      onChange={(e) => setConfigValues({
                        ...configValues,
                        schedule: {
                          ...configValues.schedule,
                          discussionInterval: parseInt(e.target.value) || 180,
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="30"
                      step="30"
                    />
                    <span className="text-xs text-gray-500">分</span>
                  </div>
                </div>
              </div>

              {/* 品質設定 */}
              <div>
                <h4 className="font-medium mb-3">品質管理</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        最小品質スコア
                      </label>
                      <input
                        type="number"
                        value={configValues.quality.minQualityScore}
                        onChange={(e) => setConfigValues({
                          ...configValues,
                          quality: {
                            ...configValues.quality,
                            minQualityScore: parseInt(e.target.value) || 65,
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        min="0"
                        max="100"
                      />
                      <span className="text-xs text-gray-500">0-100点</span>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        自動保存閾値
                      </label>
                      <input
                        type="number"
                        value={configValues.quality.autoSaveThreshold}
                        onChange={(e) => setConfigValues({
                          ...configValues,
                          quality: {
                            ...configValues.quality,
                            autoSaveThreshold: parseInt(e.target.value) || 70,
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        min="0"
                        max="100"
                      />
                      <span className="text-xs text-gray-500">0-100点</span>
                    </div>
                  </div>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={configValues.quality.requireHumanApproval}
                      onChange={(e) => setConfigValues({
                        ...configValues,
                        quality: {
                          ...configValues.quality,
                          requireHumanApproval: e.target.checked,
                        },
                      })}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">人間の承認を必要とする</span>
                  </label>
                </div>
              </div>

              {/* 制限設定 */}
              <div>
                <h4 className="font-medium mb-3">実行制限</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      1日の最大章数
                    </label>
                    <input
                      type="number"
                      value={configValues.limits.maxChaptersPerDay}
                      onChange={(e) => setConfigValues({
                        ...configValues,
                        limits: {
                          ...configValues.limits,
                          maxChaptersPerDay: parseInt(e.target.value) || 3,
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1"
                      max="10"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      セッションの最大文字数
                    </label>
                    <input
                      type="number"
                      value={configValues.limits.maxWordsPerSession}
                      onChange={(e) => setConfigValues({
                        ...configValues,
                        limits: {
                          ...configValues.limits,
                          maxWordsPerSession: parseInt(e.target.value) || 5000,
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="1000"
                      step="1000"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      1日の最大トークン
                    </label>
                    <input
                      type="number"
                      value={configValues.limits.maxTokensPerDay}
                      onChange={(e) => setConfigValues({
                        ...configValues,
                        limits: {
                          ...configValues.limits,
                          maxTokensPerDay: parseInt(e.target.value) || 100000,
                        },
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="10000"
                      step="10000"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowConfigDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={updateConfig}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}