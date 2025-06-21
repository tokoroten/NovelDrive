import React, { useState, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
      };
    };
  }
}

export function Settings() {
  const [openAIKey, setOpenAIKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const key = await window.electronAPI.settings.get('openai_api_key');
      if (key) {
        setOpenAIKey(key);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      await window.electronAPI.settings.set('openai_api_key', openAIKey);
      setMessage({ type: 'success', text: '設定を保存しました' });
    } catch (error) {
      setMessage({ type: 'error', text: '設定の保存に失敗しました' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-secondary-800 mb-8">設定</h2>
      
      <div className="max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-secondary-800 mb-6">API設定</h3>
          
          <div className="space-y-6">
            <div>
              <label htmlFor="openai-key" className="block text-sm font-medium text-secondary-700 mb-2">
                OpenAI API Key
              </label>
              <div className="relative">
                <input
                  id="openai-key"
                  type={showKey ? 'text' : 'password'}
                  value={openAIKey}
                  onChange={(e) => setOpenAIKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm text-secondary-600 hover:text-secondary-800"
                >
                  {showKey ? '隠す' : '表示'}
                </button>
              </div>
              <p className="mt-2 text-sm text-secondary-500">
                OpenAIのAPIキーを入力してください。キーは暗号化されて保存されます。
              </p>
              <p className="mt-1 text-sm text-secondary-500">
                .envファイルがアプリケーションと同じディレクトリにある場合は、自動的に読み込まれます。
              </p>
            </div>
          </div>
          
          <div className="mt-8">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className={`px-6 py-2 rounded-md text-white font-medium transition-colors ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
          </div>
          
          {message && (
            <div
              className={`mt-4 p-4 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
        
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-secondary-800 mb-4">環境設定ファイル</h3>
          <div className="text-sm text-secondary-600 space-y-2">
            <p>以下の形式で.envファイルを作成することで、自動的に設定を読み込むことができます：</p>
            <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto">
              <code>OPENAI_API_KEY=sk-your-api-key-here</code>
            </pre>
            <p className="text-secondary-500">
              .envファイルは実行ファイルと同じディレクトリに配置してください。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}