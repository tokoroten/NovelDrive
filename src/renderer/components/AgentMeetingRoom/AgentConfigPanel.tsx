/**
 * エージェント設定パネルコンポーネント
 */

import React from 'react';
import { AgentConfig, AGENT_ROLES, PERSONALITIES } from './types';

interface AgentConfigPanelProps {
  participants: AgentConfig[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof AgentConfig, value: string) => void;
  disabled?: boolean;
}

export function AgentConfigPanel({
  participants,
  onAdd,
  onRemove,
  onChange,
  disabled = false
}: AgentConfigPanelProps) {
  const canAddParticipant = participants.length < 4 && !disabled;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">エージェント設定</h3>
      <div className="space-y-3">
        {participants.map((participant, index) => (
          <div key={index} className="flex gap-2">
            <select
              value={participant.role}
              onChange={(e) => onChange(index, 'role', e.target.value)}
              disabled={disabled}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {AGENT_ROLES.map(role => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <select
              value={participant.personality}
              onChange={(e) => onChange(index, 'personality', e.target.value)}
              disabled={disabled}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {PERSONALITIES.map(personality => (
                <option key={personality.value} value={personality.value}>
                  {personality.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={participant.name || ''}
              onChange={(e) => onChange(index, 'name', e.target.value)}
              disabled={disabled}
              placeholder="名前（任意）"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {participants.length > 2 && (
              <button
                onClick={() => onRemove(index)}
                disabled={disabled}
                className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                削除
              </button>
            )}
          </div>
        ))}
        {canAddParticipant && (
          <button
            onClick={onAdd}
            className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-primary-500 hover:text-primary-600"
          >
            エージェントを追加
          </button>
        )}
      </div>
    </div>
  );
}