/**
 * メッセージアイテムコンポーネント
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Message, AGENT_COLORS } from './types';

interface MessageItemProps {
  message: Message;
  isLatest?: boolean;
}

export function MessageItem({ message, isLatest = false }: MessageItemProps) {
  const getBadgeColor = (role: string) => {
    return AGENT_COLORS[role] || AGENT_COLORS.human;
  };

  const getConfidenceLevel = (confidence?: number) => {
    if (!confidence) return null;
    if (confidence >= 0.8) return { label: '高', color: 'text-green-600' };
    if (confidence >= 0.5) return { label: '中', color: 'text-yellow-600' };
    return { label: '低', color: 'text-red-600' };
  };

  const getEmotionalTone = (tone?: string) => {
    if (!tone) return null;
    const toneMap: Record<string, { label: string; emoji: string }> = {
      positive: { label: 'ポジティブ', emoji: '😊' },
      negative: { label: 'ネガティブ', emoji: '😟' },
      neutral: { label: '中立', emoji: '😐' },
      excited: { label: '興奮', emoji: '🤩' },
      concerned: { label: '懸念', emoji: '😰' },
    };
    return toneMap[tone] || { label: tone, emoji: '🤔' };
  };

  return (
    <div className={`mb-4 ${isLatest ? 'animate-slide-in' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getBadgeColor(message.agentRole)}`}>
            {message.agentName || message.agentRole}
          </div>
        </div>
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-sm p-4">
            {message.metadata?.replyTo && (
              <div className="text-xs text-gray-500 mb-2">
                返信先: メッセージ#{message.metadata.replyTo}
              </div>
            )}
            <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
            
            {/* メタデータ表示 */}
            {message.metadata && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {message.metadata.confidence !== undefined && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">確信度:</span>
                    <span className={getConfidenceLevel(message.metadata.confidence)?.color}>
                      {getConfidenceLevel(message.metadata.confidence)?.label}
                      ({Math.round(message.metadata.confidence * 100)}%)
                    </span>
                  </div>
                )}
                {message.metadata.emotionalTone && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">感情:</span>
                    <span>
                      {getEmotionalTone(message.metadata.emotionalTone)?.emoji}
                      {getEmotionalTone(message.metadata.emotionalTone)?.label}
                    </span>
                  </div>
                )}
                {message.metadata.thinkingTime && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">思考時間:</span>
                    <span>{message.metadata.thinkingTime}秒</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {formatDistanceToNow(new Date(message.timestamp), { 
              addSuffix: true,
              locale: ja 
            })}
          </div>
        </div>
      </div>
    </div>
  );
}