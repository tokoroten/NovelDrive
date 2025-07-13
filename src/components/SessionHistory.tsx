import React, { useState, useEffect } from 'react';
import { Session } from '../db/schema';
import { sessionService } from '../db';

interface SessionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionSelect: (session: Session) => void;
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ 
  isOpen, 
  onClose, 
  onSessionSelect 
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // セッション一覧を読み込む
  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const allSessions = await sessionService.getAllSessions();
      setSessions(allSessions);
      setSelectedSessionId(sessionService.getCurrentSessionId());
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSession = (session: Session) => {
    onSessionSelect(session);
    onClose();
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await sessionService.deleteSession(sessionId);
      await loadSessions();
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('ja-JP') + ' ' + d.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatCharacterCount = (count?: number) => {
    if (!count) return '0文字';
    if (count >= 10000) return `${Math.floor(count / 10000)}万${Math.floor((count % 10000) / 1000)}千文字`;
    if (count >= 1000) return `${Math.floor(count / 1000)}千文字`;
    return `${count}文字`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">作品履歴</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              読み込み中...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              保存された作品はありません
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
                    selectedSessionId === session.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">
                        {session.title}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>作成: {formatDate(session.createdAt)}</div>
                        <div>更新: {formatDate(session.updatedAt)}</div>
                        <div className="flex items-center gap-4">
                          <span>文字数: {formatCharacterCount(session.metadata?.characterCount || session.documentContent.length)}</span>
                          <span>会話: {session.conversation.length}ターン</span>
                          {session.metadata?.totalTokens && (
                            <span>トークン: {session.metadata.totalTokens.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      {session.documentContent && (
                        <div className="mt-2 text-sm text-gray-700 line-clamp-2">
                          {session.documentContent.substring(0, 200)}...
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleSelectSession(session)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        開く
                      </button>
                      
                      {showDeleteConfirm === session.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
                          >
                            削除
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="px-3 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors text-sm"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(session.id)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};