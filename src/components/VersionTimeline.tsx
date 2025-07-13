import React, { useState, useEffect } from 'react';
import { DocumentVersion } from '../db/schema';
import { sessionService } from '../db';

interface VersionTimelineProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  currentContent: string;
  onRestore: (content: string) => void;
}

export const VersionTimeline: React.FC<VersionTimelineProps> = ({
  isOpen,
  onClose,
  sessionId,
  currentContent,
  onRestore,
}) => {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(true);

  useEffect(() => {
    if (isOpen && sessionId) {
      loadVersions();
    }
  }, [isOpen, sessionId]);

  const loadVersions = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const versionHistory = await sessionService.getDocumentVersions(sessionId);
      setVersions(versionHistory);
      
      // 現在のバージョンを仮想的に追加
      const currentVersion: DocumentVersion = {
        id: 'current',
        sessionId,
        content: currentContent,
        timestamp: new Date(),
        editedBy: 'current',
      };
      setVersions([...versionHistory, currentVersion]);
      setSelectedVersion(currentVersion);
      setPreviewContent(currentContent);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVersionSelect = (version: DocumentVersion) => {
    setSelectedVersion(version);
    setPreviewContent(version.content);
    setIsReadOnly(version.id !== 'current');
  };

  const handleRestore = () => {
    if (!selectedVersion || selectedVersion.id === 'current') return;
    
    if (confirm('この時点の内容を現在のドキュメントに復元しますか？')) {
      onRestore(selectedVersion.content);
      onClose();
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('ja-JP') + ' ' + d.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getEditTypeLabel = (version: DocumentVersion) => {
    if (version.id === 'current') return '現在';
    if (version.editAction?.type === 'append') return '追記';
    if (version.editAction?.type === 'diff') return '編集';
    if (version.editAction?.type === 'manual') return '手動編集';
    return '編集';
  };

  const getEditorName = (editedBy: string) => {
    if (editedBy === 'current') return '現在の状態';
    if (editedBy === 'user') return 'ユーザー';
    const agent = versions.find(v => v.editedBy === editedBy);
    return agent ? editedBy : editedBy;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex z-50">
      <div className="bg-white w-full h-full flex">
        {/* 左側: タイムライン */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">バージョン履歴</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ✕
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                読み込み中...
              </div>
            ) : (
              <div className="p-2">
                {versions.map((version, index) => (
                  <button
                    key={version.id}
                    onClick={() => handleVersionSelect(version)}
                    className={`w-full text-left p-3 mb-2 rounded transition-colors ${
                      selectedVersion?.id === version.id
                        ? 'bg-blue-100 border-blue-500 border'
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${
                        version.id === 'current' ? 'text-blue-600' : ''
                      }`}>
                        {getEditTypeLabel(version)}
                      </span>
                      <span className="text-xs text-gray-500">
                        #{versions.length - index}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {formatDate(version.timestamp)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      by {getEditorName(version.editedBy)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {version.content.length}文字
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* タイムラインスライダー */}
          <div className="p-4 border-t">
            <input
              type="range"
              min="0"
              max={versions.length - 1}
              value={versions.findIndex(v => v.id === selectedVersion?.id) || 0}
              onChange={(e) => {
                const index = parseInt(e.target.value);
                handleVersionSelect(versions[index]);
              }}
              className="w-full"
              disabled={versions.length === 0}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>古い</span>
              <span>新しい</span>
            </div>
          </div>
        </div>

        {/* 右側: プレビュー */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-semibold">
                {selectedVersion?.id === 'current' ? '現在の内容' : '過去のバージョン'}
              </h3>
              {selectedVersion && selectedVersion.id !== 'current' && (
                <p className="text-sm text-gray-600 mt-1">
                  {formatDate(selectedVersion.timestamp)} - {getEditorName(selectedVersion.editedBy)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isReadOnly && (
                <span className="text-sm text-orange-600 bg-orange-50 px-3 py-1 rounded">
                  読み取り専用
                </span>
              )}
              {selectedVersion && selectedVersion.id !== 'current' && (
                <button
                  onClick={handleRestore}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  この内容を復元
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-hidden">
            <textarea
              value={previewContent}
              readOnly={isReadOnly}
              onChange={(e) => setPreviewContent(e.target.value)}
              className={`w-full h-full p-4 border rounded-lg font-mono text-sm resize-none ${
                isReadOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
              }`}
              placeholder="内容がありません"
            />
          </div>

          <div className="p-4 border-t text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>文字数: {previewContent.length}文字</span>
              {selectedVersion && selectedVersion.id !== 'current' && (
                <span className="text-orange-600">
                  ※ 過去のバージョンは編集できません。復元して編集してください。
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};