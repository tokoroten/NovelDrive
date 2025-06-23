import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface VersionEntry {
  id: string;
  documentId: string;
  documentType: 'chapter' | 'plot' | 'character' | 'knowledge' | 'project';
  version: number;
  title: string;
  content: string;
  metadata: Record<string, any>;
  changeType: 'create' | 'update' | 'delete' | 'restore';
  changeDescription?: string;
  authorId?: string;
  authorName?: string;
  createdAt: string;
  previousVersionId?: string;
  checksum: string;
  size: number;
}

interface VersionDiff {
  additions: DiffLine[];
  deletions: DiffLine[];
  modifications: DiffLine[];
  summary: {
    linesAdded: number;
    linesDeleted: number;
    linesModified: number;
    charactersAdded: number;
    charactersDeleted: number;
  };
}

interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'added' | 'deleted' | 'modified';
  oldContent?: string;
}

interface Document {
  id: string;
  title: string;
  type: 'chapter' | 'plot' | 'character' | 'knowledge' | 'project';
  projectId?: string;
  lastModified: string;
}

export function VersionHistory() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [currentDiff, setCurrentDiff] = useState<VersionDiff | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (selectedDocument) {
      loadVersionHistory(selectedDocument.id);
    }
  }, [selectedDocument]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      
      // 各ドキュメントタイプから取得
      const [chapters, plots, characters, knowledge, projects] = await Promise.all([
        window.electronAPI.database.listChapters(),
        window.electronAPI.database.listPlots(),
        window.electronAPI.database.listCharacters(),
        window.electronAPI.database.listKnowledge(),
        window.electronAPI.database.listProjects(),
      ]);

      const allDocuments: Document[] = [
        ...chapters.map((ch: any) => ({
          id: ch.id,
          title: ch.title,
          type: 'chapter' as const,
          projectId: ch.project_id,
          lastModified: ch.updated_at,
        })),
        ...plots.map((plot: any) => ({
          id: plot.id,
          title: plot.title,
          type: 'plot' as const,
          projectId: plot.project_id,
          lastModified: plot.updated_at,
        })),
        ...characters.map((char: any) => ({
          id: char.id,
          title: char.name,
          type: 'character' as const,
          projectId: char.project_id,
          lastModified: char.updated_at,
        })),
        ...knowledge.map((k: any) => ({
          id: k.id,
          title: k.title,
          type: 'knowledge' as const,
          projectId: k.project_id,
          lastModified: k.updated_at,
        })),
        ...projects.map((proj: any) => ({
          id: proj.id,
          title: proj.name,
          type: 'project' as const,
          lastModified: proj.updated_at,
        })),
      ];

      setDocuments(allDocuments.sort((a, b) => 
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      ));
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVersionHistory = async (documentId: string) => {
    try {
      setIsLoading(true);
      const response = await window.electronAPI.versionHistory.list(documentId);
      setVersions(response.data || []);
      setSelectedVersions([]);
      setCurrentDiff(null);
    } catch (error) {
      console.error('Failed to load version history:', error);
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const compareTo = async (fromVersionId: string, toVersionId: string) => {
    try {
      setIsLoading(true);
      const response = await window.electronAPI.versionHistory.compare(fromVersionId, toVersionId);
      setCurrentDiff(response.data);
    } catch (error) {
      console.error('Failed to calculate diff:', error);
      alert('差分の計算に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const restoreVersion = async (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    const confirmMessage = `バージョン ${version.version} (${formatDistanceToNow(new Date(version.createdAt), { addSuffix: true, locale: ja })}) に復元しますか？\n\n新しいバージョンとして復元されます。`;
    
    if (!confirm(confirmMessage)) return;

    try {
      setIsLoading(true);
      await window.electronAPI.versionHistory.restore(versionId, {
        createNewVersion: true,
        changeDescription: `バージョン ${version.version} から復元`,
      });
      
      await loadVersionHistory(selectedDocument!.id);
      alert('復元が完了しました');
    } catch (error) {
      console.error('Failed to restore version:', error);
      alert('復元に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteVersion = async (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    if (!confirm(`バージョン ${version.version} を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    try {
      await window.electronAPI.versionHistory.delete(versionId);
      await loadVersionHistory(selectedDocument!.id);
      alert('バージョンが削除されました');
    } catch (error) {
      console.error('Failed to delete version:', error);
      alert('削除に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    }
  };

  const previewVersion = async (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;

    setPreviewContent(version.content);
    setShowPreview(true);
  };

  const handleVersionSelect = (versionId: string) => {
    const currentSelection = [...selectedVersions];
    const index = currentSelection.indexOf(versionId);
    
    if (index >= 0) {
      currentSelection.splice(index, 1);
    } else if (currentSelection.length < 2) {
      currentSelection.push(versionId);
    } else {
      // 最古の選択を削除して新しい選択を追加
      currentSelection.shift();
      currentSelection.push(versionId);
    }
    
    setSelectedVersions(currentSelection);
    
    // 2つ選択されている場合は自動的に比較
    if (currentSelection.length === 2) {
      compareTo(currentSelection[0], currentSelection[1]);
    } else {
      setCurrentDiff(null);
    }
  };

  const getDocumentTypeLabel = (type: string): string => {
    const labels = {
      chapter: '章',
      plot: 'プロット',
      character: 'キャラクター',
      knowledge: '知識',
      project: 'プロジェクト',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getDocumentTypeIcon = (type: string): string => {
    const icons = {
      chapter: '📄',
      plot: '📋',
      character: '👤',
      knowledge: '📚',
      project: '📁',
    };
    return icons[type as keyof typeof icons] || '📄';
  };

  const getChangeTypeLabel = (type: string): string => {
    const labels = {
      create: '作成',
      update: '更新',
      delete: '削除',
      restore: '復元',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getChangeTypeColor = (type: string): string => {
    const colors = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      restore: 'bg-purple-100 text-purple-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredDocuments = documents.filter(doc => {
    if (filterType !== 'all' && doc.type !== filterType) return false;
    if (searchQuery && !doc.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">バージョン履歴</h1>
            <p className="text-gray-600">
              ドキュメントの変更履歴を確認し、任意の時点に復元できます
            </p>
          </div>
        </div>

        {/* フィルターとサーチ */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="ドキュメント名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">すべてのタイプ</option>
            <option value="chapter">章</option>
            <option value="plot">プロット</option>
            <option value="character">キャラクター</option>
            <option value="knowledge">知識</option>
            <option value="project">プロジェクト</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* ドキュメント一覧 */}
        <div className="col-span-4 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">ドキュメント一覧</h2>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              ドキュメントが見つかりません
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredDocuments.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocument(doc)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedDocument?.id === doc.id
                      ? 'bg-primary-100 border-primary-500 border'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getDocumentTypeIcon(doc.type)}</span>
                    <span className="font-medium text-sm truncate">{doc.title}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{getDocumentTypeLabel(doc.type)}</span>
                    <span>{formatDistanceToNow(new Date(doc.lastModified), { addSuffix: true, locale: ja })}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* バージョン履歴 */}
        <div className="col-span-4 bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">バージョン履歴</h2>
            {selectedVersions.length === 2 && (
              <button
                onClick={() => compareTo(selectedVersions[0], selectedVersions[1])}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                比較表示
              </button>
            )}
          </div>

          {!selectedDocument ? (
            <div className="text-center py-8 text-gray-500">
              ドキュメントを選択してください
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              バージョン履歴がありません
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={`border rounded-lg p-3 transition-all ${
                    selectedVersions.includes(version.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedVersions.includes(version.id)}
                        onChange={() => handleVersionSelect(version.id)}
                        className="rounded"
                      />
                      <span className="font-medium">v{version.version}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${getChangeTypeColor(version.changeType)}`}>
                        {getChangeTypeLabel(version.changeType)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => previewVersion(version.id)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title="プレビュー"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => restoreVersion(version.id)}
                        className="p-1 text-blue-500 hover:text-blue-700"
                        title="復元"
                      >
                        ↩️
                      </button>
                      {version.version > 1 && (
                        <button
                          onClick={() => deleteVersion(version.id)}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="削除"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {version.changeDescription && (
                    <p className="text-sm text-gray-600 mb-2">{version.changeDescription}</p>
                  )}
                  
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      {version.authorName && <span>👤 {version.authorName}</span>}
                      <span>📏 {formatFileSize(version.size)}</span>
                    </div>
                    <span>{formatDistanceToNow(new Date(version.createdAt), { addSuffix: true, locale: ja })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 差分表示 */}
        <div className="col-span-4 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">差分表示</h2>

          {!currentDiff ? (
            <div className="text-center py-8 text-gray-500">
              2つのバージョンを選択して比較してください
            </div>
          ) : (
            <div className="space-y-4">
              {/* 差分サマリー */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium mb-2">変更サマリー</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-green-600">
                    +{currentDiff.summary.linesAdded} 行追加
                  </div>
                  <div className="text-red-600">
                    -{currentDiff.summary.linesDeleted} 行削除
                  </div>
                  <div className="text-blue-600">
                    ~{currentDiff.summary.linesModified} 行変更
                  </div>
                  <div className="text-gray-600">
                    {currentDiff.summary.charactersAdded - currentDiff.summary.charactersDeleted > 0 ? '+' : ''}
                    {currentDiff.summary.charactersAdded - currentDiff.summary.charactersDeleted} 文字
                  </div>
                </div>
              </div>

              {/* 差分詳細 */}
              <div className="max-h-80 overflow-y-auto border border-gray-200 rounded">
                <div className="font-mono text-sm">
                  {currentDiff.deletions.map((line, index) => (
                    <div key={`del-${index}`} className="bg-red-50 text-red-800 px-3 py-1 border-l-4 border-red-400">
                      <span className="text-gray-500 mr-2">-{line.lineNumber}</span>
                      {line.content}
                    </div>
                  ))}
                  {currentDiff.additions.map((line, index) => (
                    <div key={`add-${index}`} className="bg-green-50 text-green-800 px-3 py-1 border-l-4 border-green-400">
                      <span className="text-gray-500 mr-2">+{line.lineNumber}</span>
                      {line.content}
                    </div>
                  ))}
                  {currentDiff.modifications.map((line, index) => (
                    <div key={`mod-${index}`} className="border-l-4 border-blue-400">
                      <div className="bg-red-50 text-red-800 px-3 py-1">
                        <span className="text-gray-500 mr-2">-{line.lineNumber}</span>
                        {line.oldContent}
                      </div>
                      <div className="bg-green-50 text-green-800 px-3 py-1">
                        <span className="text-gray-500 mr-2">+{line.lineNumber}</span>
                        {line.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* プレビューダイアログ */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">バージョンプレビュー</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap font-mono text-sm">{previewContent}</pre>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}