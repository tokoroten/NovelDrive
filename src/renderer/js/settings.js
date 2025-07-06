// Settings functionality

// Global state
let currentSettings = {};
let hasUnsavedChanges = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadSettings();
    displayVersionInfo();
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
}

// Load settings
async function loadSettings() {
    try {
        // OpenAI設定を個別に取得
        const openAIConfig = await window.api.invoke('openai:getConfig');
        
        // その他の設定を取得
        const settings = await window.api.invoke('settings:get');
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
        window.api.showMessage('設定の読み込みに失敗しました', 'error');
    }
}

// Apply settings to form
function applySettings(settings) {
    // API Settings
    if (settings.api) {
        if (settings.api.openai) {
            // APIキーの表示処理
            const apiKeyInput = document.getElementById('openai-api-key');
            if (settings.api.openai.hasApiKey) {
                apiKeyInput.value = '••••••••••••••••';
                apiKeyInput.dataset.hasKey = 'true';
            } else {
                apiKeyInput.value = '';
                apiKeyInput.dataset.hasKey = 'false';
            }
            
            setInputValue('openai-model', settings.api.openai.model || 'gpt-4');
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
    // OpenAI API設定を個別に保存
    const apiKeyInput = document.getElementById('openai-api-key');
    if (apiKeyInput.value && apiKeyInput.value !== '••••••••••••••••') {
        try {
            await window.api.invoke('openai:setApiKey', { apiKey: apiKeyInput.value });
            // 保存後にマスク表示
            apiKeyInput.value = '••••••••••••••••';
            apiKeyInput.dataset.hasKey = 'true';
        } catch (error) {
            console.error('Failed to save API key:', error);
            window.api.showMessage('APIキーの保存に失敗しました', 'error');
            return;
        }
    }
    
    // OpenAIのモデルと温度設定
    try {
        await window.api.invoke('openai:updateSettings', {
            model: getInputValue('openai-model'),
            temperature: getInputValue('openai-temperature')
        });
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
        await window.api.invoke('settings:save', settings);
        currentSettings = settings;
        hasUnsavedChanges = false;
        window.api.showMessage('設定を保存しました', 'success');
    } catch (error) {
        console.error('Failed to save settings:', error);
        window.api.showMessage('設定の保存に失敗しました', 'error');
    }
};

// Reset settings to default
window.resetSettings = async function() {
    if (!confirm('すべての設定をデフォルトに戻しますか？')) return;
    
    try {
        await window.api.invoke('settings:reset');
        await loadSettings();
        window.api.showMessage('設定をリセットしました', 'success');
    } catch (error) {
        console.error('Failed to reset settings:', error);
        window.api.showMessage('設定のリセットに失敗しました', 'error');
    }
};

// Toggle API key visibility
window.toggleApiKeyVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
};

// Change data location
window.changeDataLocation = async function() {
    try {
        const result = await window.api.invoke('dialog:selectDirectory');
        if (result) {
            document.getElementById('data-location').value = result;
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

// Warn about unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});