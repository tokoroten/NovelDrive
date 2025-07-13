import React, { useState, useEffect } from 'react';
import { Session } from '../db/schema';
import { sessionService } from '../db';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  currentSessionId: string | null;
  onNewSession: () => void;
  onLoadSession: (session: Session) => void;
  onShowSettings: () => void;
  onShowVersionTimeline: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  currentSessionId,
  onNewSession,
  onLoadSession,
  onShowSettings,
  onShowVersionTimeline,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // セッション一覧を読み込む
  const loadSessions = async () => {
    setLoading(true);
    try {
      const allSessions = await sessionService.getAllSessions();
      // 重複を除去（念のため）
      const uniqueSessions = allSessions.filter((session, index, self) => 
        index === self.findIndex((s) => s.id === session.id)
      );
      setSessions(uniqueSessions);
      console.log(`Loaded ${uniqueSessions.length} unique sessions`);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [currentSessionId]);

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('ja-JP', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatCharacterCount = (count?: number) => {
    if (!count) return '0文字';
    if (count >= 10000) return `${Math.floor(count / 10000)}万文字`;
    if (count >= 1000) return `${Math.floor(count / 1000)}千文字`;
    return `${count}文字`;
  };

  return (
    <>
      {/* サイドバー */}
      <div 
        className={`fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-40 flex flex-col ${
          isOpen ? 'w-64' : 'w-16'
        }`}
        role="navigation"
        aria-label="作品一覧"
      >
        {/* ヘッダー */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg"
              aria-label={isOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                {isOpen ? (
                  <>
                    <line x1="6" y1="5" x2="14" y2="5" />
                    <line x1="6" y1="10" x2="14" y2="10" />
                    <line x1="6" y1="15" x2="14" y2="15" />
                  </>
                ) : (
                  <>
                    <line x1="4" y1="5" x2="16" y2="5" />
                    <line x1="4" y1="10" x2="16" y2="10" />
                    <line x1="4" y1="15" x2="16" y2="15" />
                  </>
                )}
              </svg>
            </button>
            
            {/* 新規作成ボタン */}
            <button
              onClick={onNewSession}
              className={`p-1.5 hover:bg-gray-800 rounded-lg transition-all ${
                isOpen ? 'opacity-100' : 'opacity-0 w-0'
              }`}
              title="新規作成"
              aria-label="新しい作品を作成"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="14" height="14" rx="2" />
                <line x1="10" y1="6" x2="10" y2="14" />
                <line x1="6" y1="10" x2="14" y2="10" />
              </svg>
            </button>
          </div>
        </div>

        {/* 作品リスト（スクロール可能なエリア） */}
        <div className="flex-1 overflow-y-auto px-2">
          {isOpen ? (
            loading ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                読み込み中...
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                作品がありません
              </div>
            ) : (
              <div className="space-y-1 py-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`relative rounded-lg hover:bg-gray-800 transition-colors group ${
                      currentSessionId === session.id ? 'bg-gray-800' : ''
                    }`}
                  >
                    <button
                      onClick={() => onLoadSession(session)}
                      className="w-full text-left px-3 py-2"
                    >
                      <div className="text-sm font-medium truncate pr-6">
                        {session.title}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2">
                        <span>{formatDate(session.updatedAt)}</span>
                        <span>•</span>
                        <span>{formatCharacterCount(session.metadata?.characterCount || session.documentContent.length)}</span>
                      </div>
                    </button>
                    
                    {/* 削除ボタン（現在のセッション以外で表示） */}
                    {currentSessionId !== session.id && (
                      showDeleteConfirm === session.id ? (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await sessionService.deleteSession(session.id);
                                await loadSessions();
                                setShowDeleteConfirm(null);
                              } catch (error) {
                                console.error('Failed to delete session:', error);
                              }
                            }}
                            className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
                          >
                            削除
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(null);
                            }}
                            className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(session.id);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400 transition-colors"
                          title="削除"
                          aria-label="作品を削除"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M4 4l1 9a1 1 0 001 1h4a1 1 0 001-1l1-9" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            /* 閉じた状態のアイコン表示 */
            <div className="py-2 space-y-1">
              {sessions.slice(0, 5).map((session) => (
                <button
                  key={session.id}
                  onClick={() => onLoadSession(session)}
                  className={`w-full p-3 rounded-lg hover:bg-gray-800 transition-colors flex justify-center ${
                    currentSessionId === session.id ? 'bg-gray-800' : ''
                  }`}
                  title={session.title}
                >
                  <span className="text-lg">📝</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 下部メニュー */}
        <div className="border-t border-gray-700 p-2">
          <button
            onClick={onShowVersionTimeline}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            title={isOpen ? '' : 'タイムライン'}
          >
            <span className="text-xl">🕒</span>
            <span className={`transition-opacity duration-300 ${
              isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
            }`}>
              タイムライン
            </span>
          </button>
          
          <button
            onClick={onShowSettings}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            title={isOpen ? '' : '設定'}
          >
            <span className="text-xl">⚙️</span>
            <span className={`transition-opacity duration-300 ${
              isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'
            }`}>
              設定
            </span>
          </button>
        </div>
      </div>

      {/* オーバーレイ（モバイル用） */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}
    </>
  );
};