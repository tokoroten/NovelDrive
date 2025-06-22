import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface BackupMetadata {
  id: string;
  name: string;
  description?: string;
  projectIds: string[];
  size: number;
  createdAt: string;
  type: 'auto' | 'manual';
  version: string;
  checksum: string;
}

interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  maxBackups: number;
  includeLogs: boolean;
  compressBackups: boolean;
  backupLocation: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
}

export function BackupRestore() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState<BackupConfig>({
    enabled: true,
    intervalHours: 24,
    maxBackups: 10,
    includeLogs: false,
    compressBackups: true,
    backupLocation: '',
  });
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');

  // 新規バックアップ用の状態
  const [newBackupName, setNewBackupName] = useState('');
  const [newBackupDescription, setNewBackupDescription] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // 復元用の状態
  const [restoreOptions, setRestoreOptions] = useState({
    projectIds: [] as string[],
    overwriteExisting: false,
    createNewProject: true,
    restoreSettings: false,
  });

  useEffect(() => {
    loadBackups();
    loadProjects();
    loadConfig();
  }, []);

  const loadBackups = async () => {
    try {
      const result = await window.electronAPI.backup.listBackups();
      setBackups(result || []);
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const result = await window.electronAPI.database.listProjects();
      setProjects(result || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadConfig = async () => {
    try {
      const result = await window.electronAPI.backup.getConfig();
      if (result) {
        setConfig(result);
      }
    } catch (error) {
      console.error('Failed to load backup config:', error);
    }
  };

  const createBackup = async () => {
    if (!newBackupName.trim()) {
      alert('バックアップ名を入力してください');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('バックアップを作成中...');

    try {
      await window.electronAPI.backup.create({
        name: newBackupName,
        description: newBackupDescription,
        projectIds: selectedProjectIds.length > 0 ? selectedProjectIds : undefined,
      });

      await loadBackups();
      setShowCreateDialog(false);
      setNewBackupName('');
      setNewBackupDescription('');
      setSelectedProjectIds([]);
      
      alert('バックアップが正常に作成されました');
    } catch (error) {
      console.error('Failed to create backup:', error);
      alert('バックアップの作成に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const restoreBackup = async () => {
    if (!selectedBackup) return;

    const confirmMessage = restoreOptions.overwriteExisting
      ? '既存のデータが上書きされます。続行しますか？'
      : '新しいプロジェクトとして復元します。続行しますか？';

    if (!confirm(confirmMessage)) return;

    setIsProcessing(true);
    setProcessingStatus('データを復元中...');

    try {
      await window.electronAPI.backup.restore(selectedBackup.id, restoreOptions);
      
      await loadProjects();
      setShowRestoreDialog(false);
      setSelectedBackup(null);
      
      alert('データが正常に復元されました');
    } catch (error) {
      console.error('Failed to restore backup:', error);
      alert('復元に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const deleteBackup = async (backup: BackupMetadata) => {
    if (!confirm(`バックアップ「${backup.name}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      await window.electronAPI.backup.delete(backup.id);
      await loadBackups();
      alert('バックアップが削除されました');
    } catch (error) {
      console.error('Failed to delete backup:', error);
      alert('削除に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    }
  };

  const updateConfig = async () => {
    try {
      await window.electronAPI.backup.updateConfig(config);
      setShowConfigDialog(false);
      alert('設定が保存されました');
    } catch (error) {
      console.error('Failed to update config:', error);
      alert('設定の保存に失敗しました');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getBackupTypeLabel = (type: string): string => {
    return type === 'auto' ? '自動' : '手動';
  };

  const getStatusColor = (type: string): string => {
    return type === 'auto' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">バックアップ・リストア</h1>
            <p className="text-gray-600">
              プロジェクトデータのバックアップ作成と復元を管理します
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowConfigDialog(true)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              設定
            </button>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              新規バックアップ
            </button>
          </div>
        </div>

        {/* ステータス表示 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">総バックアップ数</div>
            <div className="text-2xl font-semibold">{backups.length}</div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">自動バックアップ</div>
            <div className="text-2xl font-semibold text-blue-600">
              {backups.filter(b => b.type === 'auto').length}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">手動バックアップ</div>
            <div className="text-2xl font-semibold text-green-600">
              {backups.filter(b => b.type === 'manual').length}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">自動バックアップ</div>
            <div className={`text-xl font-semibold ${config.enabled ? 'text-green-600' : 'text-gray-400'}`}>
              {config.enabled ? '有効' : '無効'}
            </div>
          </div>
        </div>
      </div>

      {/* バックアップ一覧 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">バックアップ履歴</h2>
        
        {backups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            バックアップがありません
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div key={backup.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{backup.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(backup.type)}`}>
                        {getBackupTypeLabel(backup.type)}
                      </span>
                    </div>
                    
                    {backup.description && (
                      <p className="text-sm text-gray-600 mb-2">{backup.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>
                        📁 {backup.projectIds.length}個のプロジェクト
                      </span>
                      <span>
                        💾 {formatFileSize(backup.size)}
                      </span>
                      <span>
                        📅 {formatDistanceToNow(new Date(backup.createdAt), {
                          addSuffix: true,
                          locale: ja,
                        })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedBackup(backup);
                        setRestoreOptions({
                          projectIds: [],
                          overwriteExisting: false,
                          createNewProject: true,
                          restoreSettings: false,
                        });
                        setShowRestoreDialog(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      復元
                    </button>
                    <button
                      onClick={() => deleteBackup(backup)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 処理中オーバーレイ */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <span className="font-medium">処理中...</span>
            </div>
            <p className="text-gray-600">{processingStatus}</p>
          </div>
        </div>
      )}

      {/* 新規バックアップダイアログ */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-xl font-semibold mb-6">新規バックアップの作成</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  バックアップ名 *
                </label>
                <input
                  type="text"
                  value={newBackupName}
                  onChange={(e) => setNewBackupName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="例: 重要な節目のバックアップ"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  説明（任意）
                </label>
                <textarea
                  value={newBackupDescription}
                  onChange={(e) => setNewBackupDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                  placeholder="このバックアップの詳細や目的を記載..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  対象プロジェクト（未選択の場合は全て）
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
                  {projects.map((project) => (
                    <label key={project.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProjectIds([...selectedProjectIds, project.id]);
                          } else {
                            setSelectedProjectIds(selectedProjectIds.filter(id => id !== project.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{project.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewBackupName('');
                  setNewBackupDescription('');
                  setSelectedProjectIds([]);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={createBackup}
                disabled={!newBackupName.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 復元ダイアログ */}
      {showRestoreDialog && selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-xl font-semibold mb-6">バックアップからの復元</h3>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium mb-2">復元対象バックアップ</h4>
              <p className="text-sm text-gray-600">
                {selectedBackup.name} ({formatDistanceToNow(new Date(selectedBackup.createdAt), { addSuffix: true, locale: ja })})
              </p>
              <p className="text-sm text-gray-500">
                {selectedBackup.projectIds.length}個のプロジェクト、{formatFileSize(selectedBackup.size)}
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  復元方法
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={restoreOptions.createNewProject}
                      onChange={() => setRestoreOptions({
                        ...restoreOptions,
                        createNewProject: true,
                        overwriteExisting: false,
                      })}
                      name="restoreMode"
                    />
                    <span className="text-sm">新しいプロジェクトとして復元（推奨）</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={restoreOptions.overwriteExisting}
                      onChange={() => setRestoreOptions({
                        ...restoreOptions,
                        createNewProject: false,
                        overwriteExisting: true,
                      })}
                      name="restoreMode"
                    />
                    <span className="text-sm text-red-600">既存データを上書き（危険）</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={restoreOptions.restoreSettings}
                    onChange={(e) => setRestoreOptions({
                      ...restoreOptions,
                      restoreSettings: e.target.checked,
                    })}
                  />
                  <span className="text-sm">アプリケーション設定も復元する</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRestoreDialog(false);
                  setSelectedBackup(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={restoreBackup}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                復元実行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 設定ダイアログ */}
      {showConfigDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <h3 className="text-xl font-semibold mb-6">バックアップ設定</h3>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({
                      ...config,
                      enabled: e.target.checked,
                    })}
                  />
                  <span className="text-sm font-medium">自動バックアップを有効にする</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  バックアップ間隔（時間）
                </label>
                <input
                  type="number"
                  value={config.intervalHours}
                  onChange={(e) => setConfig({
                    ...config,
                    intervalHours: parseInt(e.target.value) || 24,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="1"
                  max="168"
                />
                <p className="text-xs text-gray-500 mt-1">1〜168時間の範囲で設定してください</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  保持する自動バックアップ数
                </label>
                <input
                  type="number"
                  value={config.maxBackups}
                  onChange={(e) => setConfig({
                    ...config,
                    maxBackups: parseInt(e.target.value) || 10,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="1"
                  max="100"
                />
                <p className="text-xs text-gray-500 mt-1">古いバックアップは自動的に削除されます</p>
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.includeLogs}
                    onChange={(e) => setConfig({
                      ...config,
                      includeLogs: e.target.checked,
                    })}
                  />
                  <span className="text-sm">ログファイルも含める</span>
                </label>
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.compressBackups}
                    onChange={(e) => setConfig({
                      ...config,
                      compressBackups: e.target.checked,
                    })}
                  />
                  <span className="text-sm">バックアップファイルを圧縮する</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
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