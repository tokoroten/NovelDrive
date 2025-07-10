// Settings functionality

// 状態管理システムを使用
const stateManager = window.settingsState || new window.SettingsStateManager();

// Global state
let currentSettings = {};
let hasUnsavedChanges = false;
let apiKeyValue = '';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadSettings();
    displayVersionInfo();
    
    // Restore any unsaved changes flag
    hasUnsavedChanges = stateManager.getTemp('unsaved-changes', false);
    
    // Restore temporary API key if exists
    const tempApiKey = stateManager.getTempApiKey();
    if (tempApiKey) {
        apiKeyValue = tempApiKey;
    }
});

// Initialize event listeners
function initializeEventListeners() {
    // Navigation
    document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.addEventListener('click', handleNavigation);
    });
    
    // Sliders
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        slider.addEventListener('input', handleSliderChange);
    });
    
    // Form inputs
    document.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', markAsChanged);
    });
    
    // APIキー入力の特別処理
    const apiKeyInput = document.getElementById('openai-api-key');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', (e) => {
            apiKeyValue = e.target.value;
            stateManager.saveTempApiKey(apiKeyValue);
            markAsChanged();
        });
    }
    
    // Prevent form submission
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
            e.preventDefault();
        }
    });
}

// Handle navigation
function handleNavigation(event) {
    const button = event.currentTarget;
    const section = button.dataset.section;
    
    // Update nav buttons
    document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    button.classList.add('active');
    
    // Update sections
    document.querySelectorAll('.settings-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-settings`).classList.add('active');
    
    // APIセクションに戻ってきた場合、APIキーの値を復元
    if (section === 'api') {
        setTimeout(() => {
            const apiKeyInput = document.getElementById('openai-api-key');
            if (apiKeyInput) {
                // 一時保存されたAPIキーを確認
                const tempApiKey = stateManager.getTempApiKey();
                if (tempApiKey && tempApiKey !== '••••••••••••••••') {
                    apiKeyInput.value = tempApiKey;
                    apiKeyValue = tempApiKey;
                    apiKeyInput.dataset.hasKey = 'true';
                } else if (apiKeyValue && apiKeyValue !== '••••••••••••••••') {
                    apiKeyInput.value = apiKeyValue;
                    apiKeyInput.dataset.hasKey = 'true';
                } else if (apiKeyInput.dataset.hasKey === 'true') {
                    apiKeyInput.value = '••••••••••••••••';
                }
            }
        }, 10);
    }
    
    // Save active section
    stateManager.saveActiveSection(section);
}

// Handle slider changes
function handleSliderChange(event) {
    const slider = event.target;
    const valueSpan = slider.nextElementSibling;
    if (valueSpan && valueSpan.classList.contains('slider-value')) {
        valueSpan.textContent = slider.value;
    }
    markAsChanged();
}

// Mark settings as changed
function markAsChanged() {
    hasUnsavedChanges = true;
    stateManager.setTemp('unsaved-changes', true);
}

// Load settings
async function loadSettings() {
    try {
        // Use Mock API if available, otherwise use real API
        const api = window.api || window.mockAPI;
        if (!api) {
            console.warn('No API available, using default settings');
            applyDefaultSettings();
            return;
        }
        
        // OpenAI設定を個別に取得
        const openAIConfig = await api.invoke('openai:getConfig');
        console.log('OpenAI config from backend:', openAIConfig);
        
        // その他の設定を取得
        const settings = await api.invoke('settings:get');
        currentSettings = settings;
        
        // OpenAI設定を統合
        if (!settings.api) settings.api = {};
        settings.api.openai = {
            hasApiKey: openAIConfig.hasApiKey,
            model: openAIConfig.model,
            temperature: openAIConfig.temperature,
            isConfigured: openAIConfig.isConfigured
        };
        
        applySettings(settings);
    } catch (error) {
        console.error('Failed to load settings:', error);
        // Use default settings on error
        applyDefaultSettings();
        if (window.api && window.api.showMessage) {
            window.api.showMessage('設定の読み込みに失敗しました', 'error');
        }
    }
}

// Apply default settings when API is not available
function applyDefaultSettings() {
    // Try to load from localStorage first
    let savedSettings = null;
    try {
        const stored = localStorage.getItem('novel-drive-settings');
        if (stored) {
            savedSettings = JSON.parse(stored);
        }
    } catch (error) {
        console.warn('Failed to load settings from localStorage:', error);
    }
    
    // Load OpenAI settings from localStorage
    let openAIKey = '';
    let openAISettings = { model: 'gpt-4o', temperature: 0.7 };
    try {
        openAIKey = localStorage.getItem('novel-drive-openai-key') || '';
        const storedOpenAI = localStorage.getItem('novel-drive-openai-settings');
        if (storedOpenAI) {
            openAISettings = { ...openAISettings, ...JSON.parse(storedOpenAI) };
        }
    } catch (error) {
        console.warn('Failed to load OpenAI settings from localStorage:', error);
    }
    
    const defaultSettings = {
        api: {
            openai: {
                hasApiKey: !!openAIKey,
                model: openAISettings.model,
                temperature: openAISettings.temperature,
                isConfigured: !!openAIKey
            }
        },
        ai: {
            writerModerateIgnorance: true,
            responseLength: 'medium',
            language: 'ja',
            serendipityDistance: 0.5,
            serendipityUsage: true
        },
        editor: {
            theme: 'light',
            fontSize: 16,
            fontFamily: 'system',
            lineHeight: 1.5,
            autoSave: true,
            autoSaveInterval: 30
        },
        export: {
            format: 'docx',
            includeMetadata: true,
            pageBreaks: true
        },
        advanced: {
            enableTelemetry: false,
            debugMode: false,
            experimentalFeatures: false
        }
    };
    
    // Merge saved settings with defaults
    const finalSettings = savedSettings ? mergeSettings(defaultSettings, savedSettings) : defaultSettings;
    
    // Store the API key separately for display
    if (openAIKey) {
        finalSettings._apiKey = openAIKey;
    }
    
    currentSettings = finalSettings;
    applySettings(finalSettings);
}

// Merge settings objects
function mergeSettings(defaults, saved) {
    const result = { ...defaults };
    
    for (const key in saved) {
        if (saved[key] && typeof saved[key] === 'object' && !Array.isArray(saved[key])) {
            result[key] = { ...result[key], ...saved[key] };
        } else {
            result[key] = saved[key];
        }
    }
    
    return result;
}

// Apply settings to form
function applySettings(settings) {
    console.log('Applying settings:', settings);
    
    // API Settings
    if (settings.api) {
        if (settings.api.openai) {
            console.log('OpenAI settings:', settings.api.openai);
            
            // APIキーの表示処理
            const apiKeyInput = document.getElementById('openai-api-key');
            if (apiKeyInput) {
                // 一時保存されたAPIキーを取得
                const tempApiKey = stateManager.getTempApiKey();
                
                // 一時保存された値がある場合はそれを使用
                if (tempApiKey && tempApiKey !== '••••••••••••••••') {
                    apiKeyInput.value = tempApiKey;
                    apiKeyInput.dataset.hasKey = 'true';
                    apiKeyValue = tempApiKey;
                } else if (settings.api.openai.hasApiKey) {
                    // 保存済みのAPIキーがある場合はマスク表示
                    apiKeyInput.value = '••••••••••••••••';
                    apiKeyInput.dataset.hasKey = 'true';
                    apiKeyValue = '••••••••••••••••';
                    
                    // 保存済みフラグを状態管理に記録
                    stateManager.setPersistent('has-saved-api-key', true);
                } else {
                    // APIキーが未設定の場合
                    apiKeyInput.value = '';
                    apiKeyInput.dataset.hasKey = 'false';
                    apiKeyValue = '';
                }
            }
            
            setInputValue('openai-model', settings.api.openai.model || 'gpt-4o');
            setInputValue('openai-temperature', settings.api.openai.temperature || 0.7);
        }
    }
    
    // AI Settings
    if (settings.ai) {
        setInputValue('writer-moderate-ignorance', settings.ai.writerModerateIgnorance !== false);
        setInputValue('ai-response-length', settings.ai.responseLength || 'medium');
        setInputValue('ai-language', settings.ai.language || 'ja');
        setInputValue('serendipity-distance', settings.ai.serendipityDistance || 0.5);
        setInputValue('serendipity-noise', settings.ai.serendipityNoise || 0.2);
    }
    
    // Editor Settings
    if (settings.editor) {
        setInputValue('editor-font-size', settings.editor.fontSize || '16');
        setInputValue('editor-line-height', settings.editor.lineHeight || '1.6');
        setInputValue('editor-line-numbers', settings.editor.showLineNumbers || false);
        setInputValue('editor-word-wrap', settings.editor.wordWrap !== false);
        setInputValue('auto-save-enabled', settings.editor.autoSave !== false);
        setInputValue('auto-save-interval', settings.editor.autoSaveInterval || '30');
        setInputValue('backup-count', settings.editor.backupCount || 10);
    }
    
    // Export Settings
    if (settings.export) {
        setInputValue('export-format', settings.export.defaultFormat || 'txt');
        setInputValue('export-include-metadata', settings.export.includeMetadata !== false);
        setInputValue('export-include-notes', settings.export.includeNotes || false);
        setInputValue('export-filename-pattern', settings.export.filenamePattern || '{project}_{date}_{time}');
    }
    
    // Advanced Settings
    if (settings.advanced) {
        setInputValue('data-location', settings.advanced.dataLocation || '');
        setInputValue('enable-24h-mode', settings.advanced.enable24hMode || false);
        setInputValue('enable-debug-mode', settings.advanced.debugMode || false);
    }
    
    hasUnsavedChanges = false;
}

// Set input value
function setInputValue(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    
    if (element.type === 'checkbox') {
        element.checked = value;
    } else if (element.type === 'range') {
        element.value = value;
        const valueSpan = element.nextElementSibling;
        if (valueSpan && valueSpan.classList.contains('slider-value')) {
            valueSpan.textContent = value;
        }
    } else {
        element.value = value;
    }
}

// Get input value
function getInputValue(id) {
    const element = document.getElementById(id);
    if (!element) return null;
    
    if (element.type === 'checkbox') {
        return element.checked;
    } else if (element.type === 'number' || element.type === 'range') {
        return parseFloat(element.value);
    } else {
        return element.value;
    }
}

// Save settings
window.saveSettings = async function() {
    const api = window.api || window.mockAPI;
    
    // OpenAI API設定を個別に保存
    const apiKeyInput = document.getElementById('openai-api-key');
    if (apiKeyInput.value && apiKeyInput.value !== '••••••••••••••••') {
        try {
            if (api) {
                await api.invoke('openai:setApiKey', { apiKey: apiKeyInput.value });
            } else {
                // Store in localStorage for browser testing
                localStorage.setItem('novel-drive-openai-key', apiKeyInput.value);
            }
            
            // 保存後にマスク表示
            apiKeyInput.value = '••••••••••••••••';
            apiKeyInput.dataset.hasKey = 'true';
            // Keep the actual API key value for tab switching
            // Don't overwrite apiKeyValue with mask
        } catch (error) {
            console.error('Failed to save API key:', error);
            if (api && api.showMessage) {
                api.showMessage('APIキーの保存に失敗しました', 'error');
            } else {
                alert('APIキーの保存に失敗しました');
            }
            return;
        }
    }
    
    // OpenAIのモデルと温度設定
    try {
        if (api) {
            await api.invoke('openai:updateSettings', {
                model: getInputValue('openai-model'),
                temperature: getInputValue('openai-temperature')
            });
        } else {
            // Store in localStorage for browser testing
            localStorage.setItem('novel-drive-openai-settings', JSON.stringify({
                model: getInputValue('openai-model'),
                temperature: getInputValue('openai-temperature')
            }));
        }
    } catch (error) {
        console.error('Failed to update OpenAI settings:', error);
    }
    
    const settings = {
        api: {
            openai: {
                // APIキーは個別に保存済み
                model: getInputValue('openai-model'),
                temperature: getInputValue('openai-temperature')
            }
        },
        ai: {
            writerModerateIgnorance: getInputValue('writer-moderate-ignorance'),
            responseLength: getInputValue('ai-response-length'),
            language: getInputValue('ai-language'),
            serendipityDistance: getInputValue('serendipity-distance'),
            serendipityNoise: getInputValue('serendipity-noise')
        },
        editor: {
            fontSize: getInputValue('editor-font-size'),
            lineHeight: getInputValue('editor-line-height'),
            showLineNumbers: getInputValue('editor-line-numbers'),
            wordWrap: getInputValue('editor-word-wrap'),
            autoSave: getInputValue('auto-save-enabled'),
            autoSaveInterval: getInputValue('auto-save-interval'),
            backupCount: getInputValue('backup-count')
        },
        export: {
            defaultFormat: getInputValue('export-format'),
            includeMetadata: getInputValue('export-include-metadata'),
            includeNotes: getInputValue('export-include-notes'),
            filenamePattern: getInputValue('export-filename-pattern')
        },
        advanced: {
            dataLocation: getInputValue('data-location'),
            enable24hMode: getInputValue('enable-24h-mode'),
            debugMode: getInputValue('enable-debug-mode')
        }
    };
    
    try {
        if (api) {
            await api.invoke('settings:save', settings);
        } else {
            // Store in localStorage for browser testing
            localStorage.setItem('novel-drive-settings', JSON.stringify(settings));
        }
        
        currentSettings = settings;
        hasUnsavedChanges = false;
        stateManager.setUnsavedChanges(false);
        stateManager.clearAllTemp();
        
        if (api && api.showMessage) {
            api.showMessage('設定を保存しました', 'success');
        } else {
            alert('設定を保存しました');
        }
    } catch (error) {
        console.error('Failed to save settings:', error);
        if (api && api.showMessage) {
            api.showMessage('設定の保存に失敗しました', 'error');
        } else {
            alert('設定の保存に失敗しました');
        }
    }
};

// Reset settings to default
window.resetSettings = async function() {
    if (!confirm('すべての設定をデフォルトに戻しますか？')) return;
    
    const api = window.api || window.mockAPI;
    
    try {
        if (api) {
            await api.invoke('settings:reset');
        } else {
            // Clear localStorage for browser testing
            localStorage.removeItem('novel-drive-settings');
            localStorage.removeItem('novel-drive-openai-key');
            localStorage.removeItem('novel-drive-openai-settings');
        }
        
        await loadSettings();
        
        if (api && api.showMessage) {
            api.showMessage('設定をリセットしました', 'success');
        } else {
            alert('設定をリセットしました');
        }
    } catch (error) {
        console.error('Failed to reset settings:', error);
        if (api && api.showMessage) {
            api.showMessage('設定のリセットに失敗しました', 'error');
        } else {
            alert('設定のリセットに失敗しました');
        }
    }
};

// Toggle API key visibility
window.toggleApiKeyVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
};

// Test OpenAI API connection
window.testOpenAIConnection = async function() {
    const testButton = document.getElementById('test-openai-connection');
    const resultDiv = document.getElementById('api-test-result');
    const statusDiv = resultDiv.querySelector('.test-status');
    const detailsDiv = resultDiv.querySelector('.test-details');
    
    // Show loading state
    testButton.disabled = true;
    testButton.innerHTML = '<span class="icon">⏳</span> テスト中...';
    
    // Clear previous test results
    stateManager.clear('test-results', 'temp');
    
    resultDiv.style.display = 'block';
    resultDiv.className = 'api-test-result loading';
    statusDiv.className = 'test-status loading';
    statusDiv.textContent = 'OpenAI APIに接続中...';
    detailsDiv.textContent = 'APIキーの有効性を確認しています';
    
    try {
        // Get current settings
        const apiKey = document.getElementById('openai-api-key').value;
        const model = getInputValue('openai-model');
        const temperature = getInputValue('openai-temperature');
        
        const api = window.api || window.mockAPI;
        let testApiKey = apiKey;
        
        if (apiKey === '••••••••••••••••') {
            // Try to use the saved key
            if (api) {
                const config = await api.invoke('openai:getConfig');
                if (!config.isConfigured) {
                    throw new Error('APIキーが設定されていません');
                }
                testApiKey = null; // Use saved key
            } else {
                // Get from localStorage for browser testing
                testApiKey = localStorage.getItem('novel-drive-openai-key');
                if (!testApiKey) {
                    throw new Error('APIキーが設定されていません');
                }
            }
        } else if (!apiKey || apiKey.length < 20) {
            throw new Error('有効なAPIキーを入力してください');
        }
        
        let testResult;
        if (api) {
            // Test the API connection
            testResult = await api.invoke('openai:testConnection', {
                apiKey: testApiKey,
                model: model,
                temperature: temperature
            });
        } else {
            // Browser testing - simulate API test
            if (testApiKey && testApiKey.startsWith('sk-')) {
                testResult = {
                    success: true,
                    model: model,
                    usage: {
                        total_tokens: 10
                    },
                    responseTime: 250
                };
            } else {
                throw new Error('無効なAPIキー形式です');
            }
        }
        
        if (testResult.success) {
            // Success
            resultDiv.className = 'api-test-result success';
            statusDiv.className = 'test-status success';
            statusDiv.textContent = '✅ 接続成功';
            
            const details = [
                `モデル: ${testResult.model}`,
                `レスポンス時間: ${testResult.responseTime}ms`,
                `テストメッセージ: "${testResult.testMessage}"`,
                `トークン使用量: ${testResult.tokensUsed || 'N/A'}`
            ];
            
            if (testResult.modelInfo) {
                details.push(`モデル情報: ${testResult.modelInfo}`);
            }
            
            detailsDiv.innerHTML = details.join('<br>');
            
            // Save test results
            stateManager.setTemp('test-results', {
                success: true,
                timestamp: Date.now(),
                result: testResult
            });
            
        } else {
            throw new Error(testResult.error || '接続に失敗しました');
        }
        
    } catch (error) {
        // Error
        resultDiv.className = 'api-test-result error';
        statusDiv.className = 'test-status error';
        statusDiv.textContent = '❌ 接続失敗';
        
        let errorDetails = `エラー: ${error.message}`;
        
        // Provide helpful error messages
        if (error.message.includes('401')) {
            errorDetails += '\n\n💡 APIキーが無効です。正しいキーを入力してください。';
        } else if (error.message.includes('429')) {
            errorDetails += '\n\n💡 レート制限に達しました。しばらく待ってから再試行してください。';
        } else if (error.message.includes('quota')) {
            errorDetails += '\n\n💡 APIクォータを超過しています。OpenAIアカウントの使用量を確認してください。';
        } else if (error.message.includes('network') || error.message.includes('timeout')) {
            errorDetails += '\n\n💡 ネットワーク接続を確認してください。';
        } else if (error.message.includes('model')) {
            errorDetails += '\n\n💡 選択したモデルが利用できません。別のモデルを試してください。';
        }
        
        detailsDiv.innerHTML = errorDetails.replace(/\n/g, '<br>');
        
        // Save test error
        stateManager.setTemp('test-results', {
            success: false,
            timestamp: Date.now(),
            error: error.message
        });
        
        console.error('OpenAI API test failed:', error);
    } finally {
        // Reset button
        testButton.disabled = false;
        testButton.innerHTML = '<span class="icon">🔍</span> 接続テスト';
    }
};

// Change data location
window.changeDataLocation = async function() {
    try {
        const result = await window.api.invoke('dialog:selectDirectory');
        if (result && result.success && result.data) {
            document.getElementById('data-location').value = result.data;
            markAsChanged();
        }
    } catch (error) {
        console.error('Failed to select directory:', error);
    }
};

// Clear cache
window.clearCache = async function() {
    if (!confirm('キャッシュをクリアしますか？')) return;
    
    try {
        await window.api.invoke('cache:clear');
        window.api.showMessage('キャッシュをクリアしました', 'success');
    } catch (error) {
        console.error('Failed to clear cache:', error);
        window.api.showMessage('キャッシュのクリアに失敗しました', 'error');
    }
};

// Open external link
window.openExternal = async function(url) {
    try {
        await window.api.invoke('shell:openExternal', { url });
    } catch (error) {
        console.error('Failed to open external link:', error);
    }
};

// Check for updates
window.checkForUpdates = async function() {
    try {
        const result = await window.api.invoke('app:checkForUpdates');
        if (result.updateAvailable) {
            window.api.showMessage(`新しいバージョン ${result.version} が利用可能です`, 'info');
        } else {
            window.api.showMessage('最新バージョンを使用しています', 'success');
        }
    } catch (error) {
        console.error('Failed to check for updates:', error);
        window.api.showMessage('アップデートの確認に失敗しました', 'error');
    }
};

// Display version info
function displayVersionInfo() {
    window.api.invoke('app:getVersionInfo').then(info => {
        document.getElementById('electron-version').textContent = info.electron || 'N/A';
        document.getElementById('node-version').textContent = info.node || 'N/A';
    }).catch(error => {
        console.error('Failed to get version info:', error);
    });
}

// Export settings
window.exportSettings = async function() {
    try {
        const settings = await window.api.invoke('settings:get');
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            settings: settings
        };
        
        const result = await window.api.invoke('export:saveFile', {
            filename: `noveldrive_settings_${new Date().toISOString().split('T')[0]}.json`,
            content: JSON.stringify(exportData, null, 2),
            path: await window.api.invoke('export:selectPath', { filename: 'noveldrive_settings.json' })
        });
        
        if (result.success) {
            window.api.showMessage(`設定をエクスポートしました: ${result.path}`, 'success');
        }
    } catch (error) {
        console.error('Failed to export settings:', error);
        window.api.showMessage('設定のエクスポートに失敗しました', 'error');
    }
};

// Import settings
window.importSettings = async function() {
    if (!confirm('現在の設定が上書きされます。続行しますか？')) return;
    
    try {
        // In a real implementation, this would open a file dialog
        // For mock purposes, we'll simulate importing sample settings
        const importedData = {
            settings: {
                api: { openai: { model: 'gpt-3.5-turbo', temperature: 0.8 } },
                ai: { responseLength: 'long', language: 'ja' },
                editor: { fontSize: '18', showLineNumbers: true },
                export: { defaultFormat: 'docx', includeMetadata: true }
            }
        };
        
        await window.api.invoke('settings:save', importedData.settings);
        await loadSettings();
        window.api.showMessage('設定をインポートしました', 'success');
    } catch (error) {
        console.error('Failed to import settings:', error);
        window.api.showMessage('設定のインポートに失敗しました', 'error');
    }
};

// Create backup
window.createBackup = async function() {
    try {
        const result = await window.api.invoke('backup:create');
        if (result.success) {
            window.api.showMessage(`バックアップを作成しました: ${result.filename}`, 'success');
            updateBackupsList();
        }
    } catch (error) {
        console.error('Failed to create backup:', error);
        window.api.showMessage('バックアップの作成に失敗しました', 'error');
    }
};

// Update backups list
async function updateBackupsList() {
    try {
        const backups = await window.api.invoke('backup:list');
        const backupsList = document.getElementById('backups-list');
        if (!backupsList) return;
        
        if (backups.length === 0) {
            backupsList.innerHTML = '<p class="empty-state">バックアップファイルがありません</p>';
            return;
        }
        
        backupsList.innerHTML = backups.map(backup => `
            <div class="backup-item">
                <div class="backup-info">
                    <strong>${backup.name}</strong>
                    <small>${new Date(backup.date).toLocaleString('ja-JP')}</small>
                    <span class="backup-size">${(backup.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div class="backup-actions">
                    <button class="icon-btn" onclick="restoreBackup('${backup.id}')" title="復元">
                        📥
                    </button>
                    <button class="icon-btn" onclick="deleteBackup('${backup.id}')" title="削除">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to update backups list:', error);
    }
}

// Restore backup
window.restoreBackup = async function(backupId) {
    if (!confirm('現在のデータが上書きされます。続行しますか？')) return;
    
    try {
        const result = await window.api.invoke('backup:restore', { backupId });
        if (result.success) {
            window.api.showMessage('バックアップを復元しました。アプリケーションを再起動してください。', 'success');
        }
    } catch (error) {
        console.error('Failed to restore backup:', error);
        window.api.showMessage('バックアップの復元に失敗しました', 'error');
    }
};

// Delete backup
window.deleteBackup = async function(backupId) {
    if (!confirm('このバックアップを削除しますか？')) return;
    
    try {
        await window.api.invoke('backup:delete', { backupId });
        window.api.showMessage('バックアップを削除しました', 'success');
        updateBackupsList();
    } catch (error) {
        console.error('Failed to delete backup:', error);
        window.api.showMessage('バックアップの削除に失敗しました', 'error');
    }
};

// Reset all data
window.resetAllData = async function() {
    const confirmText = 'RESET';
    const userInput = prompt(`すべてのデータが削除されます。続行するには「${confirmText}」と入力してください:`);
    
    if (userInput !== confirmText) {
        window.api.showMessage('リセットがキャンセルされました', 'info');
        return;
    }
    
    try {
        await window.api.invoke('data:resetAll');
        window.api.showMessage('すべてのデータをリセットしました。アプリケーションを再起動してください。', 'success');
    } catch (error) {
        console.error('Failed to reset all data:', error);
        window.api.showMessage('データのリセットに失敗しました', 'error');
    }
};

// Show storage info
async function showStorageInfo() {
    try {
        const storageInfo = await window.api.invoke('storage:getInfo');
        const storageInfoDiv = document.getElementById('storage-info');
        if (storageInfoDiv) {
            storageInfoDiv.innerHTML = `
                <div class="storage-details">
                    <div class="storage-item">
                        <span>データベースサイズ:</span>
                        <span>${(storageInfo.database / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div class="storage-item">
                        <span>キャッシュサイズ:</span>
                        <span>${(storageInfo.cache / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div class="storage-item">
                        <span>バックアップサイズ:</span>
                        <span>${(storageInfo.backups / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div class="storage-item total">
                        <span>合計:</span>
                        <span>${(storageInfo.total / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to get storage info:', error);
    }
}

// Initialize additional features on load
document.addEventListener('DOMContentLoaded', () => {
    updateBackupsList();
    showStorageInfo();
    
    // Add navigation change handler
    setupNavigationHandlers();
    
    // Listen for storage changes (in case another tab updates settings)
    stateManager.onChange('saved-settings', (value, storageType) => {
        if (storageType === 'persistent' && !hasUnsavedChanges) {
            // Reload settings if they were changed in another tab
            loadSettings();
        }
    });
});

// Warn about unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Open external link
async function openExternalLink(url) {
    try {
        const api = window.api || window.mockAPI;
        if (api && api.invoke) {
            await api.invoke('shell:openExternal', { url });
        } else {
            // Fallback for browser environment
            window.open(url, '_blank');
        }
    } catch (error) {
        console.error('Failed to open external link:', error);
        // Fallback
        window.open(url, '_blank');
    }
}

// Make function globally available
window.openExternalLink = openExternalLink;

// Setup navigation handlers for unsaved changes
function setupNavigationHandlers() {
    // Get all navigation links
    const navLinks = document.querySelectorAll('.nav-item a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            // Check if there are unsaved changes
            if (hasUnsavedChanges) {
                e.preventDefault();
                
                const targetHref = link.getAttribute('href');
                
                // Show confirmation dialog
                const result = await showUnsavedChangesDialog();
                
                if (result === 'save') {
                    // Save settings and then navigate
                    await saveSettings();
                    stateManager.clear('form-inputs', 'temp');
                    stateManager.clear('unsaved-changes', 'temp');
                    window.location.href = targetHref;
                } else if (result === 'discard') {
                    // Discard changes and navigate
                    hasUnsavedChanges = false;
                    stateManager.clear('form-inputs', 'temp');
                    stateManager.clear('unsaved-changes', 'temp');
                    stateManager.clear('api-key-temp', 'temp');
                    window.location.href = targetHref;
                }
                // If 'cancel', do nothing (stay on settings page)
            }
        });
    });
}

// Show unsaved changes dialog
async function showUnsavedChangesDialog() {
    const api = window.api || window.mockAPI;
    
    // Create custom dialog
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.innerHTML = `
        <div class="modal-content" style="max-width: 400px;">
            <h3 style="margin-bottom: var(--spacing-md);">保存されていない変更があります</h3>
            <p style="margin-bottom: var(--spacing-lg);">設定の変更が保存されていません。保存しますか？</p>
            <div class="modal-actions" style="display: flex; gap: var(--spacing-sm); justify-content: flex-end;">
                <button class="secondary-btn" onclick="window.dialogResult='cancel'">キャンセル</button>
                <button class="secondary-btn" onclick="window.dialogResult='discard'">破棄して移動</button>
                <button class="primary-btn" onclick="window.dialogResult='save'">保存して移動</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Wait for user action
    return new Promise((resolve) => {
        window.dialogResult = null;
        
        const checkResult = setInterval(() => {
            if (window.dialogResult) {
                clearInterval(checkResult);
                const result = window.dialogResult;
                window.dialogResult = null;
                document.body.removeChild(dialog);
                resolve(result);
            }
        }, 100);
        
        // Also handle click outside modal
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                clearInterval(checkResult);
                window.dialogResult = null;
                document.body.removeChild(dialog);
                resolve('cancel');
            }
        });
    });
}

// 保存された状態を復元
function restoreSavedState() {
    // アクティブなセクションを復元
    const activeSection = stateManager.getActiveSection();
    const activeButton = document.querySelector(`.settings-nav-item[data-section="${activeSection}"]`);
    if (activeButton) {
        activeButton.click();
    }
    
    // APIテスト結果を復元
    const testResult = stateManager.getApiTestResult();
    if (testResult) {
        displayApiTestResult(testResult);
    }
}

// 現在のフォーム状態を保存
function saveCurrentFormState() {
    const formData = {};
    
    // すべての入力要素の値を保存
    document.querySelectorAll("input, select, textarea").forEach(element => {
        if (element.id && element.type !== "password") {
            if (element.type === "checkbox") {
                formData[element.id] = element.checked;
            } else if (element.type === "radio") {
                if (element.checked) {
                    formData[element.name] = element.value;
                }
            } else {
                formData[element.id] = element.value;
            }
        }
    });
    
    stateManager.saveFormState(formData);
}

// ページ離脱前の警告を設定
function setupBeforeUnloadHandler() {
    window.onbeforeunload = function(e) {
        if (hasUnsavedChanges) {
            const message = "未保存の変更があります。このまま移動しますか？";
            e.returnValue = message;
            return message;
        }
    };
}

// APIテスト結果を表示
function displayApiTestResult(result) {
    const testResultContainer = document.getElementById("api-test-result");
    if (!testResultContainer) return;
    
    testResultContainer.innerHTML = result.success 
        ? `<div class="success">✓ 接続成功 (${result.responseTime}ms)</div>`
        : `<div class="error">✗ 接続失敗: ${result.error}</div>`;
}

// ナビゲーション時の状態保存を改善
const originalHandleNavigation = handleNavigation;
handleNavigation = function(event) {
    // 現在のセクションのフォーム状態を保存
    saveCurrentFormState();
    
    // 元の処理を実行
    originalHandleNavigation.call(this, event);
};
