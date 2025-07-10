import { useState, useEffect } from 'react'
import { useStore } from '../store'
import { api } from '../lib/api'

export function SettingsPage() {
  const { settings, updateSettings } = useStore()
  const [apiKey, setApiKey] = useState('')
  const [hasApiKey, setHasApiKey] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  useEffect(() => {
    // Load OpenAI config
    loadOpenAIConfig()
  }, [])
  
  const loadOpenAIConfig = async () => {
    const result = await api.openai.getConfig()
    if (result.success) {
      setHasApiKey(result.data.hasApiKey)
      updateSettings('api.openai.hasApiKey', result.data.hasApiKey)
      updateSettings('api.openai.model', result.data.model)
      updateSettings('api.openai.temperature', result.data.temperature)
    }
  }
  
  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value !== '••••••••••••••••') {
      setApiKey(value)
    }
  }
  
  const handleSaveApiKey = async () => {
    if (!apiKey || apiKey === '••••••••••••••••') return
    
    setIsSaving(true)
    try {
      const result = await api.openai.setApiKey(apiKey)
      if (result.success) {
        setHasApiKey(true)
        updateSettings('api.openai.hasApiKey', true)
        setApiKey('')
        alert('APIキーを保存しました')
      } else {
        alert(`エラー: ${result.error}`)
      }
    } catch (error) {
      alert('APIキーの保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }
  
  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    
    try {
      const result = await api.openai.testConnection({
        apiKey: apiKey || undefined,
        model: settings.api.openai.model,
        temperature: settings.api.openai.temperature
      })
      
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, error: 'テストに失敗しました' })
    } finally {
      setIsTesting(false)
    }
  }
  
  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      await api.settings.save(settings)
      alert('設定を保存しました')
    } catch (error) {
      alert('設定の保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }
  
  return (
    <div className="settings-page">
      <header className="page-header">
        <h2>設定</h2>
        <button
          className="primary-btn"
          onClick={handleSaveSettings}
          disabled={isSaving}
        >
          {isSaving ? '保存中...' : '設定を保存'}
        </button>
      </header>
      
      <div className="settings-content">
        <section className="settings-section">
          <h3>API設定</h3>
          
          <div className="form-group">
            <label htmlFor="openai-api-key">OpenAI APIキー</label>
            <div className="input-group">
              <input
                type="password"
                id="openai-api-key"
                value={hasApiKey && !apiKey ? '••••••••••••••••' : apiKey}
                onChange={handleApiKeyChange}
                placeholder={hasApiKey ? 'APIキーは保存済みです' : 'sk-...'}
              />
              <button
                className="secondary-btn"
                onClick={handleSaveApiKey}
                disabled={!apiKey || apiKey === '••••••••••••••••' || isSaving}
              >
                保存
              </button>
            </div>
            {hasApiKey && (
              <p className="help-text">APIキーは安全に保存されています</p>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="openai-model">モデル</label>
            <select
              id="openai-model"
              value={settings.api.openai.model}
              onChange={(e) => updateSettings('api.openai.model', e.target.value)}
            >
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="o1-preview">o1-preview</option>
              <option value="o1-mini">o1-mini</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="openai-temperature">
              Temperature: {settings.api.openai.temperature}
            </label>
            <input
              type="range"
              id="openai-temperature"
              min="0"
              max="2"
              step="0.1"
              value={settings.api.openai.temperature}
              onChange={(e) => updateSettings('api.openai.temperature', parseFloat(e.target.value))}
            />
          </div>
          
          <div className="form-actions">
            <button
              className="primary-btn"
              onClick={handleTestConnection}
              disabled={isTesting || (!hasApiKey && !apiKey)}
            >
              {isTesting ? 'テスト中...' : '接続テスト'}
            </button>
          </div>
          
          {testResult && (
            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? (
                <div>
                  <p>✅ 接続成功</p>
                  {testResult.data && (
                    <div className="test-details">
                      <p>モデル: {testResult.data.model}</p>
                      <p>応答時間: {testResult.data.responseTime}ms</p>
                    </div>
                  )}
                </div>
              ) : (
                <p>❌ {testResult.error || '接続に失敗しました'}</p>
              )}
            </div>
          )}
        </section>
        
        <section className="settings-section">
          <h3>AI設定</h3>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.ai.writerModerateIgnorance}
                onChange={(e) => updateSettings('ai.writerModerateIgnorance', e.target.checked)}
              />
              ライターの適度な無知を有効にする
            </label>
            <p className="help-text">
              より自然な対話のため、ライターエージェントが時々知らないふりをします
            </p>
          </div>
          
          <div className="form-group">
            <label htmlFor="ai-response-length">応答の長さ</label>
            <select
              id="ai-response-length"
              value={settings.ai.responseLength}
              onChange={(e) => updateSettings('ai.responseLength', e.target.value)}
            >
              <option value="short">短い</option>
              <option value="medium">標準</option>
              <option value="long">長い</option>
            </select>
          </div>
        </section>
        
        <section className="settings-section">
          <h3>エディタ設定</h3>
          
          <div className="form-group">
            <label htmlFor="editor-font-size">
              フォントサイズ: {settings.editor.fontSize}px
            </label>
            <input
              type="range"
              id="editor-font-size"
              min="12"
              max="24"
              value={settings.editor.fontSize}
              onChange={(e) => updateSettings('editor.fontSize', parseInt(e.target.value))}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="editor-line-height">
              行間: {settings.editor.lineHeight}
            </label>
            <input
              type="range"
              id="editor-line-height"
              min="1"
              max="2.5"
              step="0.1"
              value={settings.editor.lineHeight}
              onChange={(e) => updateSettings('editor.lineHeight', parseFloat(e.target.value))}
            />
          </div>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.editor.showLineNumbers}
                onChange={(e) => updateSettings('editor.showLineNumbers', e.target.checked)}
              />
              行番号を表示
            </label>
          </div>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.editor.wordWrap}
                onChange={(e) => updateSettings('editor.wordWrap', e.target.checked)}
              />
              折り返し表示
            </label>
          </div>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={settings.editor.autoSave}
                onChange={(e) => updateSettings('editor.autoSave', e.target.checked)}
              />
              自動保存を有効にする
            </label>
          </div>
          
          {settings.editor.autoSave && (
            <div className="form-group">
              <label htmlFor="auto-save-interval">
                自動保存間隔: {settings.editor.autoSaveInterval}秒
              </label>
              <input
                type="range"
                id="auto-save-interval"
                min="10"
                max="300"
                step="10"
                value={settings.editor.autoSaveInterval}
                onChange={(e) => updateSettings('editor.autoSaveInterval', parseInt(e.target.value))}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}