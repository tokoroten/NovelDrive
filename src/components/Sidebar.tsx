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

  // セッション一覧を読み込む
  const loadSessions = async () => {
    setLoading(true);
    try {
      const allSessions = await sessionService.getAllSessions();
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen, currentSessionId]);

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
      <div className={`fixed left-0 top-0 h-full bg-gray-900 text-white transition-all duration-300 z-40 flex flex-col ${
        isOpen ? 'w-64' : 'w-16'
      }`}>
        {/* ヘッダー */}
        <div className="p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onToggle}
              className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg"
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
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="12" height="12" rx="2" />
                <line x1="10" y1="8" x2="10" y2="12" />
                <line x1="8" y1="10" x2="12" y2="10" />
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
                  <button
                    key={session.id}
                    onClick={() => onLoadSession(session)}
                    className={`w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group ${
                      currentSessionId === session.id ? 'bg-gray-800' : ''
                    }`}
                  >
                    <div className="text-sm font-medium truncate">
                      {session.title}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      <span>{formatDate(session.updatedAt)}</span>
                      <span>•</span>
                      <span>{formatCharacterCount(session.metadata?.characterCount || session.documentContent.length)}</span>
                    </div>
                  </button>
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