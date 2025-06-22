import React, { useState, useEffect } from 'react';

interface PlotNode {
  id: string;
  version: string;
  title: string;
  synopsis: string;
  parentVersion?: string;
  projectId: string;
  status: 'draft' | 'active' | 'archived' | 'merged';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  children?: PlotNode[];
  metadata?: any;
}

interface Project {
  id: string;
  name: string;
}

interface PlotBranchingManagementProps {}

export function PlotBranchingManagement({}: PlotBranchingManagementProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [plotTree, setPlotTree] = useState<PlotNode[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<PlotNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateBranchDialog, setShowCreateBranchDialog] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [branchParent, setBranchParent] = useState<PlotNode | null>(null);
  const [mergeSource, setMergeSource] = useState<PlotNode | null>(null);
  const [mergeTarget, setMergeTarget] = useState<PlotNode | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadPlotTree();
    }
  }, [selectedProjectId]);

  const loadProjects = async () => {
    try {
      const projectList = await window.electronAPI.database.listProjects();
      setProjects(projectList);
      if (projectList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projectList[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadPlotTree = async () => {
    if (!selectedProjectId) return;
    
    setIsLoading(true);
    try {
      const plots = await window.electronAPI.database.listPlots({ projectId: selectedProjectId });
      const treeData = buildPlotTree(plots);
      setPlotTree(treeData);
    } catch (error) {
      console.error('Failed to load plot tree:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buildPlotTree = (plots: any[]): PlotNode[] => {
    const plotMap = new Map<string, PlotNode>();
    const roots: PlotNode[] = [];

    // Create plot nodes
    plots.forEach(plot => {
      plotMap.set(plot.id, {
        id: plot.id,
        version: plot.version,
        title: plot.title,
        synopsis: plot.synopsis,
        parentVersion: plot.parent_version,
        projectId: plot.project_id,
        status: plot.status,
        createdBy: plot.created_by,
        createdAt: plot.created_at,
        updatedAt: plot.updated_at,
        children: [],
        metadata: plot.metadata ? JSON.parse(plot.metadata) : {}
      });
    });

    // Build tree structure
    plotMap.forEach(node => {
      if (node.parentVersion) {
        const parent = Array.from(plotMap.values()).find(p => p.version === node.parentVersion);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const handleCreateBranch = (parentPlot: PlotNode) => {
    setBranchParent(parentPlot);
    setShowCreateBranchDialog(true);
  };

  const handleMergeBranch = (sourcePlot: PlotNode) => {
    setMergeSource(sourcePlot);
    setShowMergeDialog(true);
  };

  const renderPlotNode = (plot: PlotNode, level: number = 0) => {
    const hasChildren = plot.children && plot.children.length > 0;
    const isSelected = selectedPlot?.id === plot.id;

    return (
      <div key={plot.id} className="mb-2">
        <div 
          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
            isSelected ? 'bg-primary-100 border-2 border-primary-300' : 'bg-white border border-gray-200 hover:bg-gray-50'
          }`}
          style={{ marginLeft: `${level * 24}px` }}
          onClick={() => setSelectedPlot(plot)}
        >
          {/* Tree connector */}
          {level > 0 && (
            <div className="flex items-center">
              <div className="w-4 h-px bg-gray-300"></div>
              <div className="w-2 h-2 border-2 border-gray-300 rounded-full bg-white"></div>
            </div>
          )}

          {/* Expand/collapse indicator */}
          <div className="w-4 flex justify-center">
            {hasChildren && (
              <span className="text-gray-400">
                {hasChildren ? '▼' : '▶'}
              </span>
            )}
          </div>

          {/* Plot info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{plot.version}</span>
              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(plot.status)}`}>
                {getStatusLabel(plot.status)}
              </span>
            </div>
            <div className="font-semibold text-gray-900 truncate">{plot.title}</div>
            <div className="text-sm text-gray-600 line-clamp-2">{plot.synopsis}</div>
            <div className="text-xs text-gray-500 mt-1">
              作成者: {plot.createdBy} | {new Date(plot.createdAt).toLocaleDateString('ja-JP')}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateBranch(plot);
              }}
              className="p-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
              title="分岐を作成"
            >
              分岐
            </button>
            {plot.status === 'draft' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMergeBranch(plot);
                }}
                className="p-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                title="マージ"
              >
                マージ
              </button>
            )}
          </div>
        </div>

        {/* Render children */}
        {hasChildren && plot.children?.map(child => renderPlotNode(child, level + 1))}
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      case 'merged': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'アクティブ';
      case 'draft': return 'ドラフト';
      case 'archived': return 'アーカイブ';
      case 'merged': return 'マージ済み';
      default: return status;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-secondary-800 mb-2">プロット分岐管理</h2>
        <p className="text-secondary-600">
          プロットのバージョン管理と分岐・マージを行います。
        </p>
      </div>

      {/* Project selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          プロジェクト選択
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">プロジェクトを選択...</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProjectId && (
        <div className="grid grid-cols-2 gap-6">
          {/* Plot tree */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">プロット系譜</h3>
              <button
                onClick={loadPlotTree}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-gray-400"
              >
                {isLoading ? '読み込み中...' : '更新'}
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : plotTree.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  プロットが見つかりません
                </div>
              ) : (
                <div>
                  {plotTree.map(plot => renderPlotNode(plot))}
                </div>
              )}
            </div>
          </div>

          {/* Plot details */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold mb-4">詳細情報</h3>
            
            {selectedPlot ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">バージョン</label>
                  <div className="text-lg font-mono">{selectedPlot.version}</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">タイトル</label>
                  <div className="text-lg">{selectedPlot.title}</div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">ステータス</label>
                  <span className={`inline-block px-2 py-1 text-sm rounded-full ${getStatusColor(selectedPlot.status)}`}>
                    {getStatusLabel(selectedPlot.status)}
                  </span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">親バージョン</label>
                  <div className="text-sm text-gray-600">
                    {selectedPlot.parentVersion || 'なし（ルート）'}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">概要</label>
                  <div className="text-sm bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                    {selectedPlot.synopsis}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">作成情報</label>
                  <div className="text-sm text-gray-600">
                    <div>作成者: {selectedPlot.createdBy}</div>
                    <div>作成日: {new Date(selectedPlot.createdAt).toLocaleString('ja-JP')}</div>
                    <div>更新日: {new Date(selectedPlot.updatedAt).toLocaleString('ja-JP')}</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <button
                    onClick={() => handleCreateBranch(selectedPlot)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    分岐を作成
                  </button>
                  {selectedPlot.status === 'draft' && (
                    <button
                      onClick={() => handleMergeBranch(selectedPlot)}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      マージ
                    </button>
                  )}
                  <button
                    onClick={() => {
                      // TODO: Edit plot functionality
                      alert('編集機能は今後実装予定です');
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    編集
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                プロットを選択してください
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Branch Dialog */}
      {showCreateBranchDialog && branchParent && (
        <CreateBranchDialog
          parent={branchParent}
          onClose={() => {
            setShowCreateBranchDialog(false);
            setBranchParent(null);
          }}
          onSuccess={() => {
            setShowCreateBranchDialog(false);
            setBranchParent(null);
            loadPlotTree();
          }}
        />
      )}

      {/* Merge Dialog */}
      {showMergeDialog && mergeSource && (
        <MergeDialog
          source={mergeSource}
          availableTargets={plotTree}
          onClose={() => {
            setShowMergeDialog(false);
            setMergeSource(null);
            setMergeTarget(null);
          }}
          onSuccess={() => {
            setShowMergeDialog(false);
            setMergeSource(null);
            setMergeTarget(null);
            loadPlotTree();
          }}
        />
      )}
    </div>
  );
}

// Create Branch Dialog Component
interface CreateBranchDialogProps {
  parent: PlotNode;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateBranchDialog({ parent, onClose, onSuccess }: CreateBranchDialogProps) {
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState(parent.synopsis);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    setIsCreating(true);
    try {
      const branchData = {
        projectId: parent.projectId,
        title: title.trim(),
        synopsis: synopsis.trim(),
        parentVersion: parent.version,
        createdBy: 'user', // TODO: Get actual user
      };

      const result = await window.electronAPI.plotBranching.createBranch(branchData);
      
      if (result.success) {
        alert('分岐が作成されました');
        onSuccess();
      } else {
        alert('分岐の作成に失敗しました');
      }
    } catch (error) {
      console.error('Failed to create branch:', error);
      alert('分岐の作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">分岐を作成</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              親バージョン
            </label>
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {parent.version} - {parent.title}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              新しいタイトル *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="分岐の新しいタイトルを入力..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              概要
            </label>
            <textarea
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="分岐の概要を入力..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100"
          >
            キャンセル
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !title.trim()}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
          >
            {isCreating ? '作成中...' : '分岐を作成'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Merge Dialog Component
interface MergeDialogProps {
  source: PlotNode;
  availableTargets: PlotNode[];
  onClose: () => void;
  onSuccess: () => void;
}

function MergeDialog({ source, availableTargets, onClose, onSuccess }: MergeDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [mergeStrategy, setMergeStrategy] = useState<'replace' | 'merge' | 'combine'>('merge');
  const [description, setDescription] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  const flattenPlots = (plots: PlotNode[]): PlotNode[] => {
    const result: PlotNode[] = [];
    const flatten = (plotList: PlotNode[]) => {
      plotList.forEach(plot => {
        if (plot.id !== source.id && plot.status === 'active') {
          result.push(plot);
        }
        if (plot.children) {
          flatten(plot.children);
        }
      });
    };
    flatten(plots);
    return result;
  };

  const targetOptions = flattenPlots(availableTargets);

  const handleMerge = async () => {
    if (!selectedTargetId) {
      alert('マージ先を選択してください');
      return;
    }

    setIsMerging(true);
    try {
      const mergeData = {
        sourceId: source.id,
        targetId: selectedTargetId,
        strategy: mergeStrategy,
        description: description.trim(),
      };

      const result = await window.electronAPI.plotBranching.mergeBranch(mergeData);
      
      if (result.success) {
        alert('マージが完了しました');
        onSuccess();
      } else {
        alert('マージに失敗しました');
      }
    } catch (error) {
      console.error('Failed to merge plots:', error);
      alert('マージに失敗しました');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">分岐をマージ</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              マージ元
            </label>
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              {source.version} - {source.title}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              マージ先 *
            </label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">マージ先を選択...</option>
              {targetOptions.map(target => (
                <option key={target.id} value={target.id}>
                  {target.version} - {target.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              マージ戦略
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="merge"
                  checked={mergeStrategy === 'merge'}
                  onChange={(e) => setMergeStrategy(e.target.value as 'merge')}
                  name="mergeStrategy"
                />
                <span>マージ - 両方の変更を統合</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="replace"
                  checked={mergeStrategy === 'replace'}
                  onChange={(e) => setMergeStrategy(e.target.value as 'replace')}
                  name="mergeStrategy"
                />
                <span>置換 - マージ元でマージ先を置き換え</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="combine"
                  checked={mergeStrategy === 'combine'}
                  onChange={(e) => setMergeStrategy(e.target.value as 'combine')}
                  name="mergeStrategy"
                />
                <span>結合 - 新しいバージョンとして結合</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              マージの説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="マージの理由や変更内容を記録..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isMerging}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100"
          >
            キャンセル
          </button>
          <button
            onClick={handleMerge}
            disabled={isMerging || !selectedTargetId}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isMerging ? 'マージ中...' : 'マージ実行'}
          </button>
        </div>
      </div>
    </div>
  );
}