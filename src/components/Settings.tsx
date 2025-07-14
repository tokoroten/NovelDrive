import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { db } from '../db';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const {
    openAIApiKey,
    setOpenAIApiKey,
    claudeApiKey,
    setClaudeApiKey,
    llmProvider,
    setLLMProvider,
    llmModel,
    setLLMModel,
  } = useAppStore();

  // ローカルステート（保存前の一時的な値）
  const [tempOpenAIKey, setTempOpenAIKey] = useState(openAIApiKey || '');
  const [tempClaudeKey, setTempClaudeKey] = useState(claudeApiKey || '');
  const [tempProvider, setTempProvider] = useState(llmProvider);
  const [tempModel, setTempModel] = useState(llmModel);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);

  // モデルオプション
  const openAIModels = [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ];

  const claudeModels = [
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ];

  useEffect(() => {
    if (isOpen) {
      // 設定を開いたときに現在の値をロード
      setTempOpenAIKey(openAIApiKey || '');
      setTempClaudeKey(claudeApiKey || '');
      setTempProvider(llmProvider);
      setTempModel(llmModel);
    }
  }, [isOpen, openAIApiKey, claudeApiKey, llmProvider, llmModel]);

  const handleSave = () => {
    // APIキーを保存
    setOpenAIApiKey(tempOpenAIKey);
    setClaudeApiKey(tempClaudeKey);
    setLLMProvider(tempProvider);
    setLLMModel(tempModel);

    // LocalStorageにも保存
    if (tempOpenAIKey) {
      localStorage.setItem('noveldrive-openai-key', tempOpenAIKey);
    }
    if (tempClaudeKey) {
      localStorage.setItem('noveldrive-claude-key', tempClaudeKey);
    }
    localStorage.setItem('noveldrive-llm-provider', tempProvider);
    localStorage.setItem('noveldrive-llm-model', tempModel);

    onClose();
  };

  const getCurrentModels = () => {
    return tempProvider === 'openai' ? openAIModels : claudeModels;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl font-semibold">設定</h2>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {/* LLMプロバイダー選択 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              LLMプロバイダー
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="provider"
                  value="openai"
                  checked={tempProvider === 'openai'}
                  onChange={(e) => setTempProvider(e.target.value as 'openai' | 'claude')}
                  className="mr-2"
                />
                OpenAI
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="provider"
                  value="claude"
                  checked={tempProvider === 'claude'}
                  onChange={(e) => setTempProvider(e.target.value as 'openai' | 'claude')}
                  className="mr-2"
                />
                Claude (Anthropic)
              </label>
            </div>
          </div>

          {/* OpenAI API Key */}
          {tempProvider === 'openai' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  type={showOpenAIKey ? 'text' : 'password'}
                  value={tempOpenAIKey}
                  onChange={(e) => setTempOpenAIKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  className="absolute right-2 top-2 text-gray-600 hover:text-gray-800"
                >
                  {showOpenAIKey ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                APIキーは<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenAIのダッシュボード</a>から取得できます
              </p>
            </div>
          )}

          {/* Claude API Key */}
          {tempProvider === 'claude' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Claude API Key
              </label>
              <div className="relative">
                <input
                  type={showClaudeKey ? 'text' : 'password'}
                  value={tempClaudeKey}
                  onChange={(e) => setTempClaudeKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowClaudeKey(!showClaudeKey)}
                  className="absolute right-2 top-2 text-gray-600 hover:text-gray-800"
                >
                  {showClaudeKey ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                APIキーは<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Anthropicのコンソール</a>から取得できます
              </p>
            </div>
          )}

          {/* モデル選択 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              モデル
            </label>
            <select
              value={tempModel}
              onChange={(e) => setTempModel(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {getCurrentModels().map(model => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          {/* 注意事項 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
            <p className="font-semibold text-yellow-800 mb-1">⚠️ 注意事項</p>
            <ul className="text-yellow-700 space-y-1">
              <li>• APIキーは暗号化されずにブラウザのLocalStorageに保存されます</li>
              <li>• 共有コンピューターでは使用しないでください</li>
              <li>• APIの使用には料金が発生する場合があります</li>
            </ul>
          </div>
        </div>

        {/* データ初期化セクション */}
        <div className="px-6 py-4 border-t">
          <h3 className="text-lg font-semibold mb-4 text-red-600">データ初期化</h3>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700 mb-4">
              警告：この操作はすべての作品、会話履歴、設定を削除します。この操作は元に戻せません。
            </p>
            <button
              onClick={async () => {
                if (confirm('本当にすべてのデータを初期化しますか？\n\nこの操作は元に戻せません。')) {
                  try {
                    // IndexedDBを完全に削除
                    await db.delete();
                    
                    // LocalStorageをクリア
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                      const key = localStorage.key(i);
                      if (key && key.startsWith('noveldrive-')) {
                        keysToRemove.push(key);
                      }
                    }
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                    
                    alert('データを初期化しました。ページを再読み込みします。');
                    window.location.reload();
                  } catch (error) {
                    console.error('Failed to reset data:', error);
                    alert('データの初期化に失敗しました。');
                  }
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              すべてのデータを初期化
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};