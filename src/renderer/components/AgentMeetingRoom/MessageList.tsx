/**
 * メッセージリストコンポーネント
 */

import React, { useRef, useEffect } from 'react';
import { Message } from './types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  autoScroll: boolean;
  onAutoScrollToggle: () => void;
}

export function MessageList({
  messages,
  isLoading,
  autoScroll,
  onAutoScrollToggle
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="border-b p-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">議論の流れ</h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {messages.length} メッセージ
          </span>
          <button
            onClick={onAutoScrollToggle}
            className={`text-sm px-3 py-1 rounded-md transition-colors ${
              autoScroll
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {autoScroll ? '自動スクロール ON' : '自動スクロール OFF'}
          </button>
        </div>
      </div>
      
      <div className="h-96 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
                <p>議論を準備しています...</p>
              </div>
            ) : (
              <p>まだメッセージがありません</p>
            )}
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <MessageItem
                key={message.id}
                message={message}
                isLatest={index === messages.length - 1}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
    </div>
  );
}