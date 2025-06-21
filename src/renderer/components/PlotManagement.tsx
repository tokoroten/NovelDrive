import React, { useState, useEffect } from 'react';

interface PlotNode {
  id: string;
  projectId: string;
  version: string;
  parentVersion: string | null;
  title: string;
  synopsis: string;
  structure: any;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata?: {
    emotionalBalance?: any;
    conflictLevel?: number;
    paceScore?: number;
    originScore?: number;
    marketScore?: number;
  };
}

export function PlotManagement() {
  const [plots, setPlots] = useState<PlotNode[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<PlotNode | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlotData, setNewPlotData] = useState({
    title: '',
    synopsis: '',
    genre: '',
    acts: 3,
  });
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const projectId = 'default-project'; // TODO: プロジェクト選択機能

  useEffect(() => {
    loadPlotHistory();
  }, []);

  const loadPlotHistory = async () => {
    try {
      const response = await window.electronAPI.plots.history(projectId);
      if (response.success) {
        setPlots(response.plots);
      }
    } catch (error) {
      console.error('Failed to load plot history:', error);
    }
  };

  const createNewPlot = async () => {
    if (!newPlotData.title || !newPlotData.synopsis) return;

    try {
      // 基本的な構造を作成
      const structure = {
        acts: Array.from({ length: newPlotData.acts }, (_, i) => ({
          actNumber: i + 1,
          title: `第${i + 1}幕`,
          chapters: [],
          purpose: '',
          keyEvents: [],
        })),
        totalChapters: 0,
        estimatedLength: 0,
        genre: newPlotData.genre,
        themes: [],
        mainConflict: '',
        resolution: '',
      };

      const response = await window.electronAPI.plots.create({
        projectId,
        title: newPlotData.title,
        synopsis: newPlotData.synopsis,
        structure,
      });

      if (response.success) {
        await loadPlotHistory();
        setIsCreating(false);
        setNewPlotData({ title: '', synopsis: '', genre: '', acts: 3 });
        setSelectedPlot(response.plot);
      }
    } catch (error) {
      console.error('Failed to create plot:', error);
    }
  };

  const forkPlot = async (plotId: string) => {
    try {
      const response = await window.electronAPI.plots.fork(plotId, {
        createdBy: 'human',
      });

      if (response.success) {
        await loadPlotHistory();
        setSelectedPlot(response.plot);
      }
    } catch (error) {
      console.error('Failed to fork plot:', error);
    }
  };

  const startAIDiscussion = async (plotId: string) => {
    if (!selectedPlot) return;

    try {
      const response = await window.electronAPI.agents.startDiscussion({
        topic: `プロット「${selectedPlot.title}」の改善について議論`,
        agentConfigs: [
          { role: 'writer', personality: 'experimental' },
          { role: 'editor', personality: 'logical' },
          { role: 'deputy_editor', personality: 'commercial' },
        ],
        projectId,
        plotId,
        maxRounds: 3,
      });

      if (response.success) {
        // エージェント会議室へ遷移するか、通知を表示
        console.log('Discussion started:', response.session);
      }
    } catch (error) {
      console.error('Failed to start AI discussion:', error);
    }
  };

  const updatePlotStatus = async (plotId: string, status: string) => {
    try {
      const response = await window.electronAPI.plots.updateStatus(plotId, status);
      if (response.success) {
        await loadPlotHistory();
      }
    } catch (error) {
      console.error('Failed to update plot status:', error);
    }
  };

  const renderPlotTree = () => {
    // バージョンツリーを構築
    const rootPlots = plots.filter((p) => !p.parentVersion);

    const renderNode = (plot: PlotNode, depth: number = 0): JSX.Element => {
      const children = plots.filter((p) => p.parentVersion === plot.version);

      return (
        <div key={plot.id} style={{ marginLeft: `${depth * 30}px` }} className="mb-4">
          <div
            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedPlot?.id === plot.id
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => setSelectedPlot(plot)}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold text-primary-600">{plot.version}</span>
                <span className="ml-3 font-medium">{plot.title}</span>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded ${
                  plot.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : plot.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : plot.status === 'reviewing'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                }`}
              >
                {plot.status === 'approved'
                  ? '承認済み'
                  : plot.status === 'rejected'
                    ? '却下'
                    : plot.status === 'reviewing'
                      ? 'レビュー中'
                      : '草稿'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{plot.synopsis}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>作成: {new Date(plot.createdAt).toLocaleDateString()}</span>
              {plot.metadata?.conflictLevel && (
                <span>葛藤: {Math.round(plot.metadata.conflictLevel * 100)}%</span>
              )}
              {plot.metadata?.paceScore && (
                <span>ペース: {Math.round(plot.metadata.paceScore * 100)}%</span>
              )}
            </div>
          </div>
          {children.length > 0 && (
            <div className="mt-2">{children.map((child) => renderNode(child, depth + 1))}</div>
          )}
        </div>
      );
    };

    return <div className="space-y-4">{rootPlots.map((plot) => renderNode(plot))}</div>;
  };

  return (
    <div className="flex h-full gap-6">
      {/* 左側：プロット履歴 */}
      <div className="w-1/2">
        <div className="bg-white rounded-lg shadow-md h-full flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">プロット履歴</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode(viewMode === 'tree' ? 'list' : 'tree')}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  {viewMode === 'tree' ? 'リスト表示' : 'ツリー表示'}
                </button>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                >
                  新規作成
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {plots.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">プロットがありません</div>
            ) : viewMode === 'tree' ? (
              renderPlotTree()
            ) : (
              <div className="space-y-3">
                {plots.map((plot) => (
                  <div
                    key={plot.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedPlot?.id === plot.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onClick={() => setSelectedPlot(plot)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {plot.version}: {plot.title}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(plot.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右側：詳細/編集 */}
      <div className="w-1/2">
        {isCreating ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">新規プロット作成</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">タイトル</label>
                <input
                  type="text"
                  value={newPlotData.title}
                  onChange={(e) => setNewPlotData({ ...newPlotData, title: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="プロットのタイトル"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">あらすじ</label>
                <textarea
                  value={newPlotData.synopsis}
                  onChange={(e) => setNewPlotData({ ...newPlotData, synopsis: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded h-32 resize-none"
                  placeholder="物語のあらすじを入力..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ジャンル</label>
                <input
                  type="text"
                  value={newPlotData.genre}
                  onChange={(e) => setNewPlotData({ ...newPlotData, genre: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded"
                  placeholder="ファンタジー、SF、ミステリーなど"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">幕数</label>
                <select
                  value={newPlotData.acts}
                  onChange={(e) =>
                    setNewPlotData({ ...newPlotData, acts: parseInt(e.target.value) })
                  }
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value={3}>3幕構成</option>
                  <option value={4}>4幕構成</option>
                  <option value={5}>5幕構成</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={createNewPlot}
                  disabled={!newPlotData.title || !newPlotData.synopsis}
                  className={`px-4 py-2 rounded font-medium ${
                    newPlotData.title && newPlotData.synopsis
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  作成
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewPlotData({ title: '', synopsis: '', genre: '', acts: 3 });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        ) : selectedPlot ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-2xl font-bold">{selectedPlot.title}</h3>
                <p className="text-lg text-primary-600 font-medium">
                  バージョン {selectedPlot.version}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => forkPlot(selectedPlot.id)}
                  className="px-3 py-1 bg-secondary-600 text-white rounded text-sm hover:bg-secondary-700"
                >
                  分岐
                </button>
                <button
                  onClick={() => startAIDiscussion(selectedPlot.id)}
                  className="px-3 py-1 bg-primary-600 text-white rounded text-sm hover:bg-primary-700"
                >
                  AI議論
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">ステータス</h4>
                <select
                  value={selectedPlot.status}
                  onChange={(e) => updatePlotStatus(selectedPlot.id, e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded"
                >
                  <option value="draft">草稿</option>
                  <option value="reviewing">レビュー中</option>
                  <option value="approved">承認済み</option>
                  <option value="rejected">却下</option>
                </select>
              </div>

              <div>
                <h4 className="font-semibold mb-2">あらすじ</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedPlot.synopsis}</p>
              </div>

              {selectedPlot.metadata && (
                <div>
                  <h4 className="font-semibold mb-2">分析スコア</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedPlot.metadata.emotionalBalance && (
                      <div className="p-3 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">感情バランス</span>
                        <div className="text-lg font-semibold">
                          {selectedPlot.metadata.emotionalBalance.overall > 0 ? '＋' : ''}
                          {selectedPlot.metadata.emotionalBalance.overall.toFixed(2)}
                        </div>
                      </div>
                    )}
                    {selectedPlot.metadata.conflictLevel !== undefined && (
                      <div className="p-3 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">葛藤レベル</span>
                        <div className="text-lg font-semibold">
                          {Math.round(selectedPlot.metadata.conflictLevel * 100)}%
                        </div>
                      </div>
                    )}
                    {selectedPlot.metadata.paceScore !== undefined && (
                      <div className="p-3 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">ペーススコア</span>
                        <div className="text-lg font-semibold">
                          {Math.round(selectedPlot.metadata.paceScore * 100)}%
                        </div>
                      </div>
                    )}
                    {selectedPlot.metadata.originScore !== undefined && (
                      <div className="p-3 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">独創性</span>
                        <div className="text-lg font-semibold">
                          {Math.round(selectedPlot.metadata.originScore * 100)}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">構造</h4>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    ジャンル: {selectedPlot.structure.genre || '未設定'}
                  </p>
                  <p className="text-sm text-gray-600">
                    幕数: {selectedPlot.structure.acts?.length || 0}
                  </p>
                  <p className="text-sm text-gray-600">
                    推定文字数: {selectedPlot.structure.estimatedLength?.toLocaleString() || 0}
                  </p>
                </div>
              </div>

              <div className="text-sm text-gray-500 pt-4 border-t">
                <p>作成日: {new Date(selectedPlot.createdAt).toLocaleString()}</p>
                <p>更新日: {new Date(selectedPlot.updatedAt).toLocaleString()}</p>
                <p>
                  作成者:{' '}
                  {selectedPlot.createdBy === 'human' ? '人間' : `AI (${selectedPlot.createdBy})`}
                </p>
                {selectedPlot.parentVersion && <p>親バージョン: {selectedPlot.parentVersion}</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 flex items-center justify-center h-full">
            <p className="text-gray-500">プロットを選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}
