/**
 * エージェントステータスパネルコンポーネント
 */

import React from 'react';
import { AgentStatus } from './types';

interface AgentStatusPanelProps {
  statuses: AgentStatus[];
}

export function AgentStatusPanel({ statuses }: AgentStatusPanelProps) {
  const getStatusIcon = (status: AgentStatus['status']) => {
    switch (status) {
      case 'active':
        return '💬';
      case 'thinking':
        return '🤔';
      case 'finished':
        return '✅';
      case 'idle':
        return '😴';
    }
  };

  const getStatusColor = (status: AgentStatus['status']) => {
    switch (status) {
      case 'active':
        return 'text-green-600';
      case 'thinking':
        return 'text-yellow-600';
      case 'finished':
        return 'text-gray-600';
      case 'idle':
        return 'text-blue-600';
    }
  };

  const getStatusLabel = (status: AgentStatus['status']) => {
    switch (status) {
      case 'active':
        return '発言中';
      case 'thinking':
        return '思考中';
      case 'finished':
        return '完了';
      case 'idle':
        return '待機中';
    }
  };

  if (statuses.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">エージェント状態</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {statuses.map((status) => (
          <div
            key={status.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getStatusIcon(status.status)}</span>
              <div>
                <div className="font-medium">{status.name || status.role}</div>
                <div className={`text-sm ${getStatusColor(status.status)}`}>
                  {getStatusLabel(status.status)}
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-gray-600">
              <div>メッセージ: {status.messageCount}</div>
              {status.lastActivity && (
                <div className="text-xs">{status.lastActivity}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}