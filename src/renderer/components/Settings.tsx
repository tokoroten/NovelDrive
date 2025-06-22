import React, { useState, useEffect } from 'react';
import { AutonomousConfig, AutonomousStatus, TimeSlot } from '../../shared/types';

export function Settings() {
  const [openAIKey, setOpenAIKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [autonomousConfig, setAutonomousConfig] = useState<AutonomousConfig | null>(null);
  const [autonomousStatus, setAutonomousStatus] = useState<AutonomousStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'api' | 'autonomous'>('api');

  useEffect(() => {
    loadSettings();
    loadAutonomousSettings();
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

  const loadAutonomousSettings = async () => {
    try {
      if (window.electronAPI.autonomous) {
        const [config, status] = await Promise.all([
          window.electronAPI.autonomous.getConfig(),
          window.electronAPI.autonomous.getStatus()
        ]);
        setAutonomousConfig(config);
        setAutonomousStatus(status);
      }
    } catch (error) {
      console.error('Failed to load autonomous settings:', error);
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

  const handleAutonomousConfigUpdate = async (newConfig: Partial<AutonomousConfig>) => {
    if (!autonomousConfig) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const updatedConfig = { ...autonomousConfig, ...newConfig };
      await window.electronAPI.autonomous.updateConfig(updatedConfig);
      setAutonomousConfig(updatedConfig);
      setMessage({ type: 'success', text: '自律モード設定を保存しました' });
      
      // Reload status
      const status = await window.electronAPI.autonomous.getStatus();
      setAutonomousStatus(status);
    } catch (error) {
      setMessage({ type: 'error', text: '自律モード設定の保存に失敗しました' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAutonomous = async () => {
    if (!autonomousConfig) return;
    
    const newEnabled = !autonomousConfig.enabled;
    await handleAutonomousConfigUpdate({ enabled: newEnabled });
    
    try {
      if (newEnabled) {
        await window.electronAPI.autonomous.start();
      } else {
        await window.electronAPI.autonomous.stop();
      }
    } catch (error) {
      console.error('Failed to toggle autonomous mode:', error);
    }
  };

  const updateTimeSlot = (index: number, updates: Partial<TimeSlot>) => {
    if (!autonomousConfig) return;
    
    const newTimeSlots = [...autonomousConfig.timeSlots];
    newTimeSlots[index] = { ...newTimeSlots[index], ...updates };
    handleAutonomousConfigUpdate({ timeSlots: newTimeSlots });
  };

  const addTimeSlot = () => {
    if (!autonomousConfig) return;
    
    const newTimeSlot: TimeSlot = {
      start: '09:00',
      end: '17:00',
      enabled: true
    };
    
    handleAutonomousConfigUpdate({
      timeSlots: [...autonomousConfig.timeSlots, newTimeSlot]
    });
  };

  const removeTimeSlot = (index: number) => {
    if (!autonomousConfig) return;
    
    const newTimeSlots = autonomousConfig.timeSlots.filter((_, i) => i !== index);
    handleAutonomousConfigUpdate({ timeSlots: newTimeSlots });
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-secondary-800 mb-8">設定</h2>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6">
        <button
          onClick={() => setActiveTab('api')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'api'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          API設定
        </button>
        <button
          onClick={() => setActiveTab('autonomous')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'autonomous'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          自律モード
        </button>
      </div>

      <div className="max-w-2xl">
        {activeTab === 'api' && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-semibold text-secondary-800 mb-6">API設定</h3>

          <div className="space-y-6">
            <div>
              <label
                htmlFor="openai-key"
                className="block text-sm font-medium text-secondary-700 mb-2"
              >
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
                isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
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
          </>
        )}

        {activeTab === 'autonomous' && autonomousConfig && (
          <>
            {/* Autonomous Mode Status */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-secondary-800">自律モード状態</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  autonomousStatus?.enabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {autonomousStatus?.enabled ? '有効' : '無効'}
                </div>
              </div>
              
              {autonomousStatus && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-secondary-600">本日の実行回数:</span>
                    <span className="ml-2 font-medium">{autonomousStatus.todayCount}</span>
                  </div>
                  <div>
                    <span className="text-secondary-600">総実行回数:</span>
                    <span className="ml-2 font-medium">{autonomousStatus.totalOperations}</span>
                  </div>
                  <div>
                    <span className="text-secondary-600">成功率:</span>
                    <span className="ml-2 font-medium">{autonomousStatus.successRate.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-secondary-600">キュー:</span>
                    <span className="ml-2 font-medium">{autonomousStatus.queueLength}件</span>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <button
                  onClick={handleToggleAutonomous}
                  disabled={isLoading}
                  className={`px-6 py-2 rounded-md text-white font-medium transition-colors ${
                    isLoading 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : autonomousConfig.enabled
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isLoading ? '処理中...' : autonomousConfig.enabled ? '自律モードを停止' : '自律モードを開始'}
                </button>
              </div>
            </div>

            {/* Basic Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-xl font-semibold text-secondary-800 mb-6">基本設定</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    実行間隔 (分)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={autonomousConfig.interval}
                    onChange={(e) => handleAutonomousConfigUpdate({ interval: parseInt(e.target.value) })}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-sm text-secondary-500">
                    自律実行の間隔を設定します (5分〜24時間)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    品質しきい値 (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={autonomousConfig.qualityThreshold}
                    onChange={(e) => handleAutonomousConfigUpdate({ qualityThreshold: parseInt(e.target.value) })}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-sm text-secondary-500">
                    この品質スコア以上のコンテンツのみ保存されます
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    1日の最大実行回数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={autonomousConfig.maxDailyOperations}
                    onChange={(e) => handleAutonomousConfigUpdate({ maxDailyOperations: parseInt(e.target.value) })}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="mt-1 text-sm text-secondary-500">
                    1日あたりの自律実行回数の上限
                  </p>
                </div>
              </div>
            </div>

            {/* Time Slots */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-xl font-semibold text-secondary-800 mb-6">動作時間設定</h3>
              
              <div className="space-y-4">
                {autonomousConfig.timeSlots.map((slot, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-md">
                    <input
                      type="checkbox"
                      checked={slot.enabled}
                      onChange={(e) => updateTimeSlot(index, { enabled: e.target.checked })}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) => updateTimeSlot(index, { start: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-secondary-600">〜</span>
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) => updateTimeSlot(index, { end: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={() => removeTimeSlot(index)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-md hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                ))}
                
                <button
                  onClick={addTimeSlot}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center"
                >
                  + 時間帯を追加
                </button>
              </div>
            </div>

            {/* Content Types */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <h3 className="text-xl font-semibold text-secondary-800 mb-6">生成コンテンツ設定</h3>
              
              <div className="space-y-3">
                {[
                  { key: 'plot', label: 'プロット' },
                  { key: 'character', label: 'キャラクター' },
                  { key: 'worldSetting', label: '世界設定' },
                  { key: 'inspiration', label: 'インスピレーション' }
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autonomousConfig.contentTypes.includes(key as any)}
                      onChange={(e) => {
                        const newContentTypes = e.target.checked
                          ? [...autonomousConfig.contentTypes, key as any]
                          : autonomousConfig.contentTypes.filter(t => t !== key);
                        handleAutonomousConfigUpdate({ contentTypes: newContentTypes });
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-3"
                    />
                    <span className="text-secondary-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Resource Limits */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-semibold text-secondary-800 mb-6">リソース制限</h3>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    最大CPU使用率 (%)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={autonomousConfig.resourceLimits.maxCpuUsage}
                    onChange={(e) => handleAutonomousConfigUpdate({
                      resourceLimits: { ...autonomousConfig.resourceLimits, maxCpuUsage: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    最大メモリ使用量 (MB)
                  </label>
                  <input
                    type="number"
                    min="512"
                    max="8192"
                    step="512"
                    value={autonomousConfig.resourceLimits.maxMemoryUsage}
                    onChange={(e) => handleAutonomousConfigUpdate({
                      resourceLimits: { ...autonomousConfig.resourceLimits, maxMemoryUsage: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    最大API呼び出し/時
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={autonomousConfig.resourceLimits.maxApiCallsPerHour}
                    onChange={(e) => handleAutonomousConfigUpdate({
                      resourceLimits: { ...autonomousConfig.resourceLimits, maxApiCallsPerHour: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    最大トークン/操作
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="8000"
                    step="500"
                    value={autonomousConfig.resourceLimits.maxTokensPerOperation}
                    onChange={(e) => handleAutonomousConfigUpdate({
                      resourceLimits: { ...autonomousConfig.resourceLimits, maxTokensPerOperation: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          </>
        )}

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
    </div>
  );
}
