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
    autoSummarizeEnabled,
    setAutoSummarizeEnabled,
    summarizeThreshold,
    setSummarizeThreshold,
  } = useAppStore();

  // ローカルステート（保存前の一時的な値）
  const [tempOpenAIKey, setTempOpenAIKey] = useState('');
  const [tempClaudeKey, setTempClaudeKey] = useState('');
  const [tempProvider, setTempProvider] = useState(llmProvider);
  const [tempModel, setTempModel] = useState(llmModel);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [validatingOpenAI, setValidatingOpenAI] = useState(false);
  const [validatingClaude, setValidatingClaude] = useState(false);
  const [openAIValid, setOpenAIValid] = useState<boolean | null>(null);
  const [claudeValid, setClaudeValid] = useState<boolean | null>(null);
  const [openAIError, setOpenAIError] = useState<string>('');
  const [claudeError, setClaudeError] = useState<string>('');
  const [tempAutoSummarize, setTempAutoSummarize] = useState(autoSummarizeEnabled);
  const [tempThreshold, setTempThreshold] = useState(summarizeThreshold);

  // モデルオプション
  const openAIModels = [
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
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
      setTempAutoSummarize(autoSummarizeEnabled);
      setTempThreshold(summarizeThreshold);
    }
  }, [isOpen, openAIApiKey, claudeApiKey, llmProvider, llmModel, autoSummarizeEnabled, summarizeThreshold]);

  const handleSave = () => {
    console.log('💾 Settings - Saving model:', tempModel);
    console.log('💾 Settings - Saving provider:', tempProvider);
    
    // APIキーを保存
    setOpenAIApiKey(tempOpenAIKey);
    setClaudeApiKey(tempClaudeKey);
    setLLMProvider(tempProvider);
    setLLMModel(tempModel);
    setAutoSummarizeEnabled(tempAutoSummarize);
    setSummarizeThreshold(tempThreshold);

    // LocalStorageにも保存
    if (tempOpenAIKey) {
      localStorage.setItem('noveldrive-openai-key', tempOpenAIKey);
    }
    if (tempClaudeKey) {
      localStorage.setItem('noveldrive-claude-key', tempClaudeKey);
    }
    localStorage.setItem('noveldrive-llm-provider', tempProvider);
    localStorage.setItem('noveldrive-llm-model', tempModel);
    
    console.log('✅ Settings - Model saved to localStorage:', localStorage.getItem('noveldrive-llm-model'));

    onClose();
  };

  const getCurrentModels = () => {
    return tempProvider === 'openai' ? openAIModels : claudeModels;
  };

  // OpenAI APIキーの検証
  const validateOpenAIKey = async () => {
    if (!tempOpenAIKey) {
      setOpenAIError('APIキーを入力してください');
      setOpenAIValid(false);
      return;
    }

    setValidatingOpenAI(true);
    setOpenAIError('');
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempOpenAIKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5,
          temperature: 0
        }),
      });

      if (response.ok) {
        setOpenAIValid(true);
        setOpenAIError('');
      } else {
        const error = await response.json();
        setOpenAIValid(false);
        if (response.status === 401) {
          setOpenAIError('無効なAPIキーです');
        } else if (response.status === 429) {
          setOpenAIError('レート制限またはクォータ超過');
        } else {
          setOpenAIError(error.error?.message || 'エラーが発生しました');
        }
      }
    } catch {
      setOpenAIValid(false);
      setOpenAIError('ネットワークエラー');
    } finally {
      setValidatingOpenAI(false);
    }
  };

  // Claude APIキーの検証
  const validateClaudeKey = async () => {
    if (!tempClaudeKey) {
      setClaudeError('APIキーを入力してください');
      setClaudeValid(false);
      return;
    }

    setValidatingClaude(true);
    setClaudeError('');
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': tempClaudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5,
        }),
      });

      if (response.ok) {
        setClaudeValid(true);
        setClaudeError('');
      } else {
        const error = await response.json();
        setClaudeValid(false);
        if (response.status === 401) {
          setClaudeError('無効なAPIキーです');
        } else if (response.status === 429) {
          setClaudeError('レート制限またはクォータ超過');
        } else {
          setClaudeError(error.error?.message || 'エラーが発生しました');
        }
      }
    } catch {
      setClaudeValid(false);
      setClaudeError('ネットワークエラー');
    } finally {
      setValidatingClaude(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold">設定</h2>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
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
                  onChange={(e) => {
                    setTempProvider(e.target.value as 'openai' | 'claude');
                    // プロバイダー切り替え時に検証状態をリセット
                    setOpenAIValid(null);
                    setClaudeValid(null);
                    setOpenAIError('');
                    setClaudeError('');
                  }}
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
                  onChange={(e) => {
                    setTempProvider(e.target.value as 'openai' | 'claude');
                    // プロバイダー切り替え時に検証状態をリセット
                    setOpenAIValid(null);
                    setClaudeValid(null);
                    setOpenAIError('');
                    setClaudeError('');
                  }}
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
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showOpenAIKey ? 'text' : 'password'}
                    value={tempOpenAIKey}
                    onChange={(e) => {
                      setTempOpenAIKey(e.target.value);
                      setOpenAIValid(null);
                      setOpenAIError('');
                    }}
                    placeholder="sk-..."
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      openAIValid === true ? 'border-green-500' : 
                      openAIValid === false ? 'border-red-500' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                    className="absolute right-2 top-2 text-gray-600 hover:text-gray-800"
                  >
                    {showOpenAIKey ? '🙈' : '👁️'}
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={validateOpenAIKey}
                    disabled={validatingOpenAI || !tempOpenAIKey}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {validatingOpenAI ? '検証中...' : 'APIキーを検証'}
                  </button>
                  {openAIValid === true && (
                    <span className="text-green-600 text-sm">✅ 有効なAPIキー</span>
                  )}
                  {openAIValid === false && openAIError && (
                    <span className="text-red-600 text-sm">❌ {openAIError}</span>
                  )}
                </div>
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
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showClaudeKey ? 'text' : 'password'}
                    value={tempClaudeKey}
                    onChange={(e) => {
                      setTempClaudeKey(e.target.value);
                      setClaudeValid(null);
                      setClaudeError('');
                    }}
                    placeholder="sk-ant-..."
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      claudeValid === true ? 'border-green-500' : 
                      claudeValid === false ? 'border-red-500' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowClaudeKey(!showClaudeKey)}
                    className="absolute right-2 top-2 text-gray-600 hover:text-gray-800"
                  >
                    {showClaudeKey ? '🙈' : '👁️'}
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={validateClaudeKey}
                    disabled={validatingClaude || !tempClaudeKey}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {validatingClaude ? '検証中...' : 'APIキーを検証'}
                  </button>
                  {claudeValid === true && (
                    <span className="text-green-600 text-sm">✅ 有効なAPIキー</span>
                  )}
                  {claudeValid === false && claudeError && (
                    <span className="text-red-600 text-sm">❌ {claudeError}</span>
                  )}
                </div>
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

          {/* 会話履歴の自動要約設定 */}
          <div className="mt-6">
            <h4 className="font-medium text-gray-700 mb-3">会話履歴の自動要約</h4>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto-summarize"
                  checked={tempAutoSummarize}
                  onChange={(e) => setTempAutoSummarize(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="auto-summarize" className="text-sm text-gray-700">
                  会話が指定数を超えたら自動的に要約する
                </label>
              </div>
              
              {tempAutoSummarize && (
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    要約のしきい値（会話ターン数）
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="20"
                      max="200"
                      step="10"
                      value={tempThreshold}
                      onChange={(e) => setTempThreshold(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium text-gray-700 w-12">{tempThreshold}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    会話が{tempThreshold}ターンを超えると、古い会話を要約してメモリを節約します
                  </p>
                </div>
              )}
            </div>
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

        <div className="px-6 py-4 border-t flex justify-end gap-3 flex-shrink-0">
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