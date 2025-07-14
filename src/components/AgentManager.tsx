import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Agent } from '../types';

interface AgentManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentManager: React.FC<AgentManagerProps> = ({ isOpen, onClose }) => {
  const { agents, activeAgentIds, toggleAgent, updateAgent, addAgent, deleteAgent, resetAgents } = useAppStore();
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<string>('');
  const [showNewAgentForm, setShowNewAgentForm] = useState(false);
  const [newAgent, setNewAgent] = useState<Partial<Agent>>({
    name: '',
    title: '',
    avatar: '🤖',
    canEdit: false,
    systemPrompt: ''
  });

  if (!isOpen) return null;

  const handleEditPrompt = (agent: Agent) => {
    setEditingAgent(agent.id);
    setEditingPrompt(agent.systemPrompt);
  };

  const handleSavePrompt = (agentId: string) => {
    updateAgent(agentId, { systemPrompt: editingPrompt });
    setEditingAgent(null);
  };

  const handleAddAgent = () => {
    if (!newAgent.name || !newAgent.systemPrompt) {
      alert('エージェント名とシステムプロンプトは必須です');
      return;
    }

    const agent: Agent = {
      id: `agent_${Date.now()}`,
      name: newAgent.name!,
      title: newAgent.title || '',
      avatar: newAgent.avatar || '🤖',
      canEdit: newAgent.canEdit || false,
      systemPrompt: newAgent.systemPrompt!
    };

    addAgent(agent);
    setShowNewAgentForm(false);
    setNewAgent({
      name: '',
      title: '',
      avatar: '🤖',
      canEdit: false,
      systemPrompt: ''
    });
  };

  const handleDeleteAgent = (agentId: string) => {
    if (agents.length <= 1) {
      alert('最低1つのエージェントが必要です');
      return;
    }

    if (confirm('このエージェントを削除しますか？')) {
      deleteAgent(agentId);
    }
  };

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
          <div className="mb-4">
            <p className="text-gray-600 mb-3">
              会話に参加するエージェントを選択・編集してください。最低1つのエージェントを選択する必要があります。
            </p>
            <div className="flex justify-between items-center gap-3">
              <button
                onClick={() => {
                  if (confirm('現在のエージェント設定を削除し、デフォルトのエージェントに戻しますか？')) {
                    resetAgents();
                  }
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <span>🔄</span>
                デフォルトエージェントを復元
              </button>
              <button
                onClick={() => setShowNewAgentForm(true)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
              >
                <span>➕</span>
                新規エージェント
              </button>
            </div>
          </div>

          {/* 新規エージェント作成フォーム */}
          {showNewAgentForm && (
            <div className="mb-6 p-4 border-2 border-green-200 bg-green-50 rounded-lg">
              <h3 className="font-semibold mb-3">新規エージェント作成</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">名前 *</label>
                  <input
                    type="text"
                    value={newAgent.name || ''}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="エージェント名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">二つ名</label>
                  <input
                    type="text"
                    value={newAgent.title || ''}
                    onChange={(e) => setNewAgent({ ...newAgent, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="役職や特徴"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">アバター</label>
                  <input
                    type="text"
                    value={newAgent.avatar || ''}
                    onChange={(e) => setNewAgent({ ...newAgent, avatar: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="絵文字"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">編集権限</label>
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={newAgent.canEdit || false}
                      onChange={(e) => setNewAgent({ ...newAgent, canEdit: e.target.checked })}
                      className="rounded"
                    />
                    <span>ドキュメントの編集を許可</span>
                  </label>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">システムプロンプト *</label>
                <textarea
                  value={newAgent.systemPrompt || ''}
                  onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  placeholder="このエージェントの役割と性格を記述..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddAgent}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  作成
                </button>
                <button
                  onClick={() => {
                    setShowNewAgentForm(false);
                    setNewAgent({
                      name: '',
                      title: '',
                      avatar: '🤖',
                      canEdit: false,
                      systemPrompt: ''
                    });
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <div
                key={agent.id}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  activeAgentIds.includes(agent.id)
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                {/* 削除ボタン */}
                {agents.length > 1 && (
                  <button
                    onClick={() => handleDeleteAgent(agent.id)}
                    className="absolute top-2 right-2 p-1 text-red-500 hover:bg-red-100 rounded"
                    title="削除"
                  >
                    🗑️
                  </button>
                )}

                {/* チェックボックスとエージェント情報 */}
                <label className="flex items-start gap-3 cursor-pointer">
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
                  </div>
                </label>

                {/* プロンプト編集部分 */}
                <div className="mt-3">
                  {editingAgent === agent.id ? (
                    <>
                      <textarea
                        value={editingPrompt}
                        onChange={(e) => setEditingPrompt(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        rows={6}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleSavePrompt(agent.id)}
                          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingAgent(null)}
                          className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                        >
                          キャンセル
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 line-clamp-3">
                        {agent.systemPrompt.substring(0, 100)}...
                      </p>
                      <button
                        onClick={() => handleEditPrompt(agent)}
                        className="mt-2 px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                      >
                        プロンプトを編集
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              選択中: {activeAgentIds.length}人 / {agents.length}人
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