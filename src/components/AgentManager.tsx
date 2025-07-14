import React from 'react';
import { allAgents } from '../agents';
import { useAppStore } from '../store';

interface AgentManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentManager: React.FC<AgentManagerProps> = ({ isOpen, onClose }) => {
  const { activeAgentIds, toggleAgent } = useAppStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">エージェント管理</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <p className="text-gray-600 mb-6">
            会話に参加するエージェントを選択してください。最低1つのエージェントを選択する必要があります。
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allAgents.map(agent => (
              <label
                key={agent.id}
                className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-all border-2 ${
                  activeAgentIds.includes(agent.id)
                    ? 'bg-blue-50 hover:bg-blue-100 border-blue-300'
                    : 'bg-white hover:bg-gray-50 border-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={activeAgentIds.includes(agent.id)}
                  onChange={() => toggleAgent(agent.id)}
                  className="w-5 h-5 text-blue-600 rounded mt-1"
                  disabled={activeAgentIds.length === 1 && activeAgentIds.includes(agent.id)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{agent.avatar}</span>
                    <div>
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-sm text-gray-600 font-semibold">{agent.title}</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {agent.canEdit ? (
                      <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        ✏️ 編集権限あり
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        👁️ 閲覧のみ
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 line-clamp-3">
                    {agent.systemPrompt.substring(0, 100)}...
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              選択中: {activeAgentIds.length}人 / {allAgents.length}人
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              完了
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};