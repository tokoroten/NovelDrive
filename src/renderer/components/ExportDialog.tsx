import React, { useState, useEffect } from 'react';

interface Document {
  id: string;
  title: string;
  type: 'chapter' | 'plot' | 'character' | 'knowledge' | 'project';
  projectId?: string;
  content?: string;
}

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedDocuments?: Document[];
}

export function ExportDialog({ isOpen, onClose, preselectedDocuments = [] }: ExportDialogProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'txt' | 'markdown'>('txt');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeVersionHistory, setIncludeVersionHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      if (preselectedDocuments.length > 0) {
        setSelectedDocuments(preselectedDocuments.map(d => d.id));
      }
    }
  }, [isOpen, preselectedDocuments]);

  const loadDocuments = async () => {
    try {
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
          content: ch.content,
        })),
        ...plots.map((plot: any) => ({
          id: plot.id,
          title: plot.title,
          type: 'plot' as const,
          projectId: plot.project_id,
          content: plot.synopsis,
        })),
        ...characters.map((char: any) => ({
          id: char.id,
          title: char.name,
          type: 'character' as const,
          projectId: char.project_id,
          content: char.profile,
        })),
        ...knowledge.map((k: any) => ({
          id: k.id,
          title: k.title,
          type: 'knowledge' as const,
          projectId: k.project_id,
          content: k.content,
        })),
        ...projects.map((proj: any) => ({
          id: proj.id,
          title: proj.name,
          type: 'project' as const,
          content: proj.description,
        })),
      ];

      setDocuments(allDocuments);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments(prev => {
      if (prev.includes(documentId)) {
        return prev.filter(id => id !== documentId);
      } else {
        return [...prev, documentId];
      }
    });
  };

  const handleSelectAll = () => {
    const filtered = getFilteredDocuments();
    const allSelected = filtered.every(doc => selectedDocuments.includes(doc.id));
    
    if (allSelected) {
      // 全て選択されている場合は、フィルタされたドキュメントの選択を解除
      setSelectedDocuments(prev => prev.filter(id => !filtered.find(doc => doc.id === id)));
    } else {
      // 一部またはゼロの場合は、フィルタされたドキュメントを全て選択
      const newSelections = filtered.map(doc => doc.id);
      setSelectedDocuments(prev => [...new Set([...prev, ...newSelections])]);
    }
  };

  const getFilteredDocuments = () => {
    return documents.filter(doc => {
      if (filterType !== 'all' && doc.type !== filterType) return false;
      if (searchQuery && !doc.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  };

  const exportDocuments = async () => {
    if (selectedDocuments.length === 0) {
      alert('エクスポートするドキュメントを選択してください');
      return;
    }

    setIsExporting(true);

    try {
      // 選択されたドキュメントの詳細を取得
      const selectedDocs = documents.filter(doc => selectedDocuments.includes(doc.id));
      
      // エクスポート用のテキストを生成
      let exportContent = '';
      
      if (includeMetadata) {
        exportContent += `# エクスポート情報\n`;
        exportContent += `- 日時: ${new Date().toLocaleString('ja-JP')}\n`;
        exportContent += `- ドキュメント数: ${selectedDocs.length}\n`;
        exportContent += `- 形式: ${exportFormat.toUpperCase()}\n\n`;
        exportContent += '---\n\n';
      }

      for (const doc of selectedDocs) {
        if (exportFormat === 'markdown') {
          exportContent += `# ${doc.title}\n\n`;
          if (includeMetadata) {
            exportContent += `**タイプ:** ${getDocumentTypeLabel(doc.type)}\n`;
            exportContent += `**ID:** ${doc.id}\n\n`;
          }
          exportContent += `${doc.content || ''}\n\n`;
          exportContent += '---\n\n';
        } else {
          exportContent += `${doc.title}\n`;
          exportContent += '='.repeat(doc.title.length) + '\n\n';
          if (includeMetadata) {
            exportContent += `タイプ: ${getDocumentTypeLabel(doc.type)}\n`;
            exportContent += `ID: ${doc.id}\n\n`;
          }
          exportContent += `${doc.content || ''}\n\n`;
          exportContent += '-'.repeat(50) + '\n\n';
        }
      }

      // ファイルとして保存
      const result = await window.electronAPI.export.exportDocuments(
        selectedDocuments,
        exportFormat,
        { includeMetadata, content: exportContent }
      );

      if (result.success) {
        alert(`エクスポートが完了しました。\nファイル: ${result.data?.filePath || 'unknown'}\nサイズ: ${formatFileSize(result.data?.size || 0)}`);
        onClose();
      } else {
        alert('エクスポートに失敗しました');
      }

    } catch (error) {
      console.error('Export failed:', error);
      alert('エクスポートに失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
    } finally {
      setIsExporting(false);
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredDocuments = getFilteredDocuments();
  const allFilteredSelected = filteredDocuments.length > 0 && 
    filteredDocuments.every(doc => selectedDocuments.includes(doc.id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">テキストエクスポート</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* ドキュメント選択 */}
          <div>
            <h3 className="text-lg font-medium mb-4">エクスポートするドキュメント</h3>
            
            {/* フィルターとサーチ */}
            <div className="space-y-3 mb-4">
              <input
                type="text"
                placeholder="ドキュメント名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">すべてのタイプ</option>
                  <option value="chapter">章</option>
                  <option value="plot">プロット</option>
                  <option value="character">キャラクター</option>
                  <option value="knowledge">知識</option>
                  <option value="project">プロジェクト</option>
                </select>
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  {allFilteredSelected ? '全解除' : '全選択'}
                </button>
              </div>
            </div>

            {/* ドキュメント一覧 */}
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
              {filteredDocuments.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  ドキュメントが見つかりません
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredDocuments.map((doc) => (
                    <label
                      key={doc.id}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                        selectedDocuments.includes(doc.id) ? 'bg-primary-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(doc.id)}
                        onChange={() => handleDocumentToggle(doc.id)}
                        className="rounded"
                      />
                      <span className="text-lg">{getDocumentTypeIcon(doc.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{doc.title}</div>
                        <div className="text-xs text-gray-500">{getDocumentTypeLabel(doc.type)}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 text-sm text-gray-600">
              {selectedDocuments.length} / {documents.length} ドキュメント選択中
            </div>
          </div>

          {/* エクスポート設定 */}
          <div>
            <h3 className="text-lg font-medium mb-4">エクスポート設定</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  フォーマット
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="txt"
                      checked={exportFormat === 'txt'}
                      onChange={(e) => setExportFormat(e.target.value as 'txt')}
                      name="format"
                    />
                    <span>プレーンテキスト (.txt)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="markdown"
                      checked={exportFormat === 'markdown'}
                      onChange={(e) => setExportFormat(e.target.value as 'markdown')}
                      name="format"
                    />
                    <span>Markdown (.md)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  オプション
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeMetadata}
                      onChange={(e) => setIncludeMetadata(e.target.checked)}
                    />
                    <span>メタデータを含める</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeVersionHistory}
                      onChange={(e) => setIncludeVersionHistory(e.target.checked)}
                    />
                    <span>バージョン履歴を含める（今後実装）</span>
                  </label>
                </div>
              </div>

              {/* プレビュー */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  プレビュー
                </label>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 max-h-32 overflow-y-auto">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                    {exportFormat === 'markdown' 
                      ? `# ドキュメントタイトル\n\n**タイプ:** 章\n**ID:** chapter-123\n\nドキュメントの内容がここに表示されます...\n\n---`
                      : `ドキュメントタイトル\n${'='.repeat(16)}\n\nタイプ: 章\nID: chapter-123\n\nドキュメントの内容がここに表示されます...\n\n${'-'.repeat(50)}`
                    }
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100"
          >
            キャンセル
          </button>
          <button
            onClick={exportDocuments}
            disabled={selectedDocuments.length === 0 || isExporting}
            className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400"
          >
            {isExporting ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                エクスポート中...
              </div>
            ) : (
              'エクスポート'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}