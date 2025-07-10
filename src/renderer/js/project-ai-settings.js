// Project-specific AI Settings Management

class ProjectAISettings {
    constructor() {
        this.settings = new Map(); // projectId -> settings
        this.init();
    }
    
    init() {
        this.loadAllSettings();
        
        // プロジェクト変更時に設定を適用
        window.addEventListener('project-changed', (event) => {
            this.applyProjectSettings(event.detail.projectId);
        });
        
        // AI設定変更時に保存
        window.addEventListener('ai-settings-changed', (event) => {
            this.saveCurrentProjectSettings();
        });
    }
    
    // 現在のプロジェクトの設定を取得
    getCurrentProjectSettings() {
        const projectId = window.currentProject?.id;
        if (!projectId) return null;
        
        return this.settings.get(projectId) || this.getDefaultSettings();
    }
    
    // デフォルト設定
    getDefaultSettings() {
        return {
            writingAssistant: {
                style: 'sharp',
                enabled: true
            },
            personalities: [],
            evaluationCriteria: null,
            personalityCriteriaLinks: new Map(),
            threadMemory: {
                maxThreadLength: 50,
                maxMemorySize: 10 * 1024 * 1024
            },
            autonomousMode: {
                enabled: false,
                schedule: 'daily',
                targetWordsPerDay: 2000
            }
        };
    }
    
    // プロジェクトの設定を適用
    applyProjectSettings(projectId) {
        const settings = this.settings.get(projectId) || this.getDefaultSettings();
        
        // AI Writing Assistant の設定を適用
        if (window.aiAssistant) {
            window.aiAssistant.currentStyle = settings.writingAssistant.style;
            window.aiAssistant.isActive = settings.writingAssistant.enabled;
            window.aiAssistant.updateUI();
        }
        
        // パーソナリティの読み込み
        if (window.personalityCanvas && settings.personalities.length > 0) {
            window.personalityCanvas.personalities = settings.personalities;
            window.personalityCanvas.updateCanvas();
        }
        
        // 評価基準の読み込み
        if (window.evaluationCriteriaCanvas && settings.evaluationCriteria) {
            window.evaluationCriteriaCanvas.criteria = [settings.evaluationCriteria];
            window.evaluationCriteriaCanvas.updateCanvas();
        }
        
        // パーソナリティと評価基準のリンクを復元
        if (window.personalityCriteriaLink && settings.personalityCriteriaLinks) {
            window.personalityCriteriaLink.links = new Map(settings.personalityCriteriaLinks);
        }
        
        // スレッドメモリ設定を適用
        if (window.aiThreadManager) {
            window.aiThreadManager.maxThreadLength = settings.threadMemory.maxThreadLength;
            window.aiThreadManager.maxMemorySize = settings.threadMemory.maxMemorySize;
        }
        
        // 自律モード設定を適用
        if (window.autonomousMode) {
            window.autonomousMode.applySettings(settings.autonomousMode);
        }
        
        console.log(`Applied AI settings for project ${projectId}`);
    }
    
    // 現在のプロジェクトの設定を保存
    saveCurrentProjectSettings() {
        const projectId = window.currentProject?.id;
        if (!projectId) return;
        
        const settings = {
            writingAssistant: {
                style: window.aiAssistant?.currentStyle || 'sharp',
                enabled: window.aiAssistant?.isActive !== false
            },
            personalities: window.personalityCanvas?.personalities || [],
            evaluationCriteria: window.evaluationCriteriaCanvas?.criteria?.[0] || null,
            personalityCriteriaLinks: Array.from(window.personalityCriteriaLink?.links || new Map()),
            threadMemory: {
                maxThreadLength: window.aiThreadManager?.maxThreadLength || 50,
                maxMemorySize: window.aiThreadManager?.maxMemorySize || 10 * 1024 * 1024
            },
            autonomousMode: window.autonomousMode?.getSettings() || {
                enabled: false,
                schedule: 'daily',
                targetWordsPerDay: 2000
            },
            lastUpdated: new Date().toISOString()
        };
        
        this.settings.set(projectId, settings);
        this.saveToStorage();
        
        console.log(`Saved AI settings for project ${projectId}`);
    }
    
    // 設定をエクスポート
    exportSettings(projectId) {
        const settings = this.settings.get(projectId);
        if (!settings) return null;
        
        return {
            version: '1.0',
            projectId: projectId,
            settings: settings,
            exportDate: new Date().toISOString()
        };
    }
    
    // 設定をインポート
    importSettings(data) {
        try {
            if (data.version !== '1.0') {
                throw new Error('Unsupported settings version');
            }
            
            const projectId = data.projectId;
            const settings = data.settings;
            
            // Map形式のデータを復元
            if (settings.personalityCriteriaLinks) {
                settings.personalityCriteriaLinks = new Map(settings.personalityCriteriaLinks);
            }
            
            this.settings.set(projectId, settings);
            this.saveToStorage();
            
            // 現在のプロジェクトなら即座に適用
            if (window.currentProject?.id === projectId) {
                this.applyProjectSettings(projectId);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to import settings:', error);
            return false;
        }
    }
    
    // 設定をリセット
    resetProjectSettings(projectId) {
        this.settings.set(projectId, this.getDefaultSettings());
        this.saveToStorage();
        
        if (window.currentProject?.id === projectId) {
            this.applyProjectSettings(projectId);
        }
    }
    
    // ストレージへの保存
    saveToStorage() {
        const data = {
            version: '1.0',
            settings: Array.from(this.settings.entries()).map(([projectId, settings]) => ({
                projectId,
                settings: {
                    ...settings,
                    personalityCriteriaLinks: Array.from(settings.personalityCriteriaLinks || new Map())
                }
            })),
            lastSaved: new Date().toISOString()
        };
        
        localStorage.setItem('project-ai-settings', JSON.stringify(data));
    }
    
    // ストレージから読み込み
    loadAllSettings() {
        try {
            const saved = localStorage.getItem('project-ai-settings');
            if (saved) {
                const data = JSON.parse(saved);
                
                data.settings.forEach(item => {
                    const settings = item.settings;
                    // Map形式のデータを復元
                    if (settings.personalityCriteriaLinks) {
                        settings.personalityCriteriaLinks = new Map(settings.personalityCriteriaLinks);
                    }
                    this.settings.set(item.projectId, settings);
                });
            }
        } catch (error) {
            console.error('Failed to load project AI settings:', error);
        }
    }
    
    // 設定UIを表示
    showSettingsUI(projectId) {
        const settings = this.settings.get(projectId) || this.getDefaultSettings();
        
        const modal = document.createElement('div');
        modal.className = 'project-ai-settings-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>プロジェクトAI設定</h2>
                
                <div class="settings-section">
                    <h3>執筆アシスタント</h3>
                    <label>
                        <input type="checkbox" id="ai-enabled" ${settings.writingAssistant.enabled ? 'checked' : ''}>
                        AI執筆支援を有効化
                    </label>
                    <label>
                        デフォルトスタイル:
                        <select id="ai-style">
                            <option value="sharp" ${settings.writingAssistant.style === 'sharp' ? 'selected' : ''}>シャープライター</option>
                            <option value="emotional" ${settings.writingAssistant.style === 'emotional' ? 'selected' : ''}>エモーショナルライター</option>
                            <option value="descriptive" ${settings.writingAssistant.style === 'descriptive' ? 'selected' : ''}>ディスクリプティブライター</option>
                        </select>
                    </label>
                </div>
                
                <div class="settings-section">
                    <h3>スレッドメモリ</h3>
                    <label>
                        最大スレッド長:
                        <input type="number" id="max-thread-length" value="${settings.threadMemory.maxThreadLength}" min="10" max="200">
                    </label>
                    <label>
                        最大メモリサイズ (MB):
                        <input type="number" id="max-memory-size" value="${settings.threadMemory.maxMemorySize / 1024 / 1024}" min="1" max="50">
                    </label>
                </div>
                
                <div class="settings-section">
                    <h3>自律創作モード</h3>
                    <label>
                        <input type="checkbox" id="autonomous-enabled" ${settings.autonomousMode.enabled ? 'checked' : ''}>
                        24時間自律創作を有効化
                    </label>
                    <label>
                        スケジュール:
                        <select id="autonomous-schedule">
                            <option value="hourly" ${settings.autonomousMode.schedule === 'hourly' ? 'selected' : ''}>毎時</option>
                            <option value="daily" ${settings.autonomousMode.schedule === 'daily' ? 'selected' : ''}>毎日</option>
                            <option value="weekly" ${settings.autonomousMode.schedule === 'weekly' ? 'selected' : ''}>毎週</option>
                        </select>
                    </label>
                    <label>
                        目標文字数/日:
                        <input type="number" id="target-words" value="${settings.autonomousMode.targetWordsPerDay}" min="100" max="10000" step="100">
                    </label>
                </div>
                
                <div class="modal-actions">
                    <button onclick="window.projectAISettings.saveSettingsFromUI('${projectId}')">保存</button>
                    <button onclick="window.projectAISettings.resetProjectSettings('${projectId}')">リセット</button>
                    <button onclick="this.closest('.project-ai-settings-modal').remove()">キャンセル</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    // UIから設定を保存
    saveSettingsFromUI(projectId) {
        const settings = {
            writingAssistant: {
                enabled: document.getElementById('ai-enabled').checked,
                style: document.getElementById('ai-style').value
            },
            threadMemory: {
                maxThreadLength: parseInt(document.getElementById('max-thread-length').value),
                maxMemorySize: parseInt(document.getElementById('max-memory-size').value) * 1024 * 1024
            },
            autonomousMode: {
                enabled: document.getElementById('autonomous-enabled').checked,
                schedule: document.getElementById('autonomous-schedule').value,
                targetWordsPerDay: parseInt(document.getElementById('target-words').value)
            },
            // 既存のパーソナリティと評価基準は保持
            personalities: this.settings.get(projectId)?.personalities || [],
            evaluationCriteria: this.settings.get(projectId)?.evaluationCriteria || null,
            personalityCriteriaLinks: this.settings.get(projectId)?.personalityCriteriaLinks || new Map(),
            lastUpdated: new Date().toISOString()
        };
        
        this.settings.set(projectId, settings);
        this.saveToStorage();
        
        // 現在のプロジェクトなら即座に適用
        if (window.currentProject?.id === projectId) {
            this.applyProjectSettings(projectId);
        }
        
        // モーダルを閉じる
        document.querySelector('.project-ai-settings-modal').remove();
        
        alert('AI設定を保存しました。');
    }
}

// Initialize project AI settings
window.projectAISettings = new ProjectAISettings();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectAISettings;
}