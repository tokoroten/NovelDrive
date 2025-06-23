/**
 * セッションヘッダーコンポーネント
 */

import React from 'react';
import { Session } from './types';

interface SessionHeaderProps {
  session: Session | null;
  topic: string;
  onTopicChange: (topic: string) => void;
  isEditable: boolean;
  error: string | null;
}

export function SessionHeader({
  session,
  topic,
  onTopicChange,
  isEditable,
  error
}: SessionHeaderProps) {
  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'concluded':
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return '進行中';
      case 'paused':
        return '一時停止';
      case 'concluded':
        return '完了';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">エージェント会議室</h2>
        {session && (
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(session.status)}`}>
            {getStatusLabel(session.status)}
          </span>
        )}
      </div>

      {/* 議題入力 */}
      <div>
        <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
          議題
        </label>
        {isEditable ? (
          <input
            id="topic"
            type="text"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="議論のテーマを入力してください"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        ) : (
          <div className="px-4 py-2 bg-gray-50 rounded-md">
            {session?.topic || '未設定'}
          </div>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* セッション情報 */}
      {session && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">開始時刻:</span>
            <div className="font-medium">{new Date(session.startTime).toLocaleString('ja-JP')}</div>
          </div>
          {session.endTime && (
            <div>
              <span className="text-gray-600">終了時刻:</span>
              <div className="font-medium">{new Date(session.endTime).toLocaleString('ja-JP')}</div>
            </div>
          )}
          <div>
            <span className="text-gray-600">メッセージ数:</span>
            <div className="font-medium">{session.messageCount}</div>
          </div>
          {session.summary && (
            <div className="md:col-span-2">
              <span className="text-gray-600">要約:</span>
              <div className="font-medium">{session.summary}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}