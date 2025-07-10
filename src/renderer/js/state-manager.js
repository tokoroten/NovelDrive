/**
 * State Manager for NovelDrive
 * 
 * セッション間で状態を保持する統合的な状態管理システム
 * - sessionStorage: 一時的な状態（タブを閉じると消える）
 * - localStorage: 永続的な状態（ブラウザを再起動しても残る）
 */

class StateManager {
    constructor(namespace = 'novel-drive') {
        this.namespace = namespace;
        this.listeners = new Map();
        this.debounceTimers = new Map();
        
        // ストレージイベントをリッスン（他のタブでの変更を検知）
        window.addEventListener('storage', this.handleStorageChange.bind(this));
    }
    
    /**
     * 一時的な状態を保存（セッション中のみ有効）
     */
    setTemp(key, value) {
        const fullKey = `${this.namespace}-temp-${key}`;
        try {
            sessionStorage.setItem(fullKey, JSON.stringify({
                value,
                timestamp: Date.now()
            }));
            this.notifyListeners(key, value, 'temp');
        } catch (error) {
            console.error('Failed to save temporary state:', error);
        }
    }
    
    /**
     * 一時的な状態を取得
     */
    getTemp(key, defaultValue = null) {
        const fullKey = `${this.namespace}-temp-${key}`;
        try {
            const item = sessionStorage.getItem(fullKey);
            if (!item) return defaultValue;
            
            const { value } = JSON.parse(item);
            return value;
        } catch (error) {
            console.error('Failed to get temporary state:', error);
            return defaultValue;
        }
    }
    
    /**
     * 永続的な状態を保存
     */
    setPersistent(key, value) {
        const fullKey = `${this.namespace}-${key}`;
        try {
            localStorage.setItem(fullKey, JSON.stringify({
                value,
                timestamp: Date.now()
            }));
            this.notifyListeners(key, value, 'persistent');
        } catch (error) {
            console.error('Failed to save persistent state:', error);
        }
    }
    
    /**
     * 永続的な状態を取得
     */
    getPersistent(key, defaultValue = null) {
        const fullKey = `${this.namespace}-${key}`;
        try {
            const item = localStorage.getItem(fullKey);
            if (!item) return defaultValue;
            
            const { value } = JSON.parse(item);
            return value;
        } catch (error) {
            console.error('Failed to get persistent state:', error);
            return defaultValue;
        }
    }
    
    /**
     * デバウンス付きで一時的な状態を保存
     */
    setTempDebounced(key, value, delay = 500) {
        // 既存のタイマーをクリア
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        // 新しいタイマーを設定
        const timer = setTimeout(() => {
            this.setTemp(key, value);
            this.debounceTimers.delete(key);
        }, delay);
        
        this.debounceTimers.set(key, timer);
    }
    
    /**
     * 状態変更のリスナーを登録
     */
    onChange(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
        
        // リスナーを削除する関数を返す
        return () => {
            const listeners = this.listeners.get(key);
            if (listeners) {
                listeners.delete(callback);
            }
        };
    }
    
    /**
     * リスナーに通知
     */
    notifyListeners(key, value, type) {
        const listeners = this.listeners.get(key);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(value, type);
                } catch (error) {
                    console.error('Error in state change listener:', error);
                }
            });
        }
    }
    
    /**
     * ストレージイベントを処理（他のタブでの変更）
     */
    handleStorageChange(event) {
        if (!event.key || !event.key.startsWith(this.namespace)) return;
        
        const keyParts = event.key.split('-');
        const isTemp = keyParts[2] === 'temp';
        const actualKey = isTemp ? keyParts.slice(3).join('-') : keyParts.slice(2).join('-');
        
        if (event.newValue) {
            try {
                const { value } = JSON.parse(event.newValue);
                this.notifyListeners(actualKey, value, isTemp ? 'temp' : 'persistent');
            } catch (error) {
                console.error('Failed to parse storage event:', error);
            }
        }
    }
    
    /**
     * 特定のキーの状態をクリア
     */
    clear(key, type = 'both') {
        if (type === 'temp' || type === 'both') {
            sessionStorage.removeItem(`${this.namespace}-temp-${key}`);
        }
        if (type === 'persistent' || type === 'both') {
            localStorage.removeItem(`${this.namespace}-${key}`);
        }
    }
    
    /**
     * すべての一時的な状態をクリア
     */
    clearAllTemp() {
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith(`${this.namespace}-temp-`)) {
                sessionStorage.removeItem(key);
            }
        });
    }
    
    /**
     * 古いデータをクリーンアップ（7日以上前のデータを削除）
     */
    cleanup(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
        const now = Date.now();
        
        // sessionStorageのクリーンアップ
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith(this.namespace)) {
                try {
                    const item = JSON.parse(sessionStorage.getItem(key));
                    if (item.timestamp && (now - item.timestamp) > maxAgeMs) {
                        sessionStorage.removeItem(key);
                    }
                } catch (error) {
                    // パースエラーの場合は削除
                    sessionStorage.removeItem(key);
                }
            }
        });
        
        // localStorageのクリーンアップ
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(this.namespace)) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (item.timestamp && (now - item.timestamp) > maxAgeMs) {
                        localStorage.removeItem(key);
                    }
                } catch (error) {
                    // パースエラーの場合は削除しない（重要なデータの可能性）
                }
            }
        });
    }
}

// 設定画面専用の状態管理
class SettingsStateManager extends StateManager {
    constructor() {
        super('novel-drive-settings');
        this.initializeDefaults();
    }
    
    initializeDefaults() {
        // デフォルトの状態を定義
        this.defaults = {
            activeSection: 'api',
            unsavedChanges: false,
            scrollPositions: {},
            expandedSections: {}
        };
    }
    
    /**
     * フォームの状態を保存
     */
    saveFormState(formData) {
        this.setTemp('form-data', formData);
    }
    
    /**
     * フォームの状態を復元
     */
    restoreFormState() {
        return this.getTemp('form-data', {});
    }
    
    /**
     * APIキーの一時保存（マスクされていない値のみ）
     */
    saveTempApiKey(apiKey) {
        if (apiKey && apiKey !== '••••••••••••••••') {
            this.setTemp('api-key', apiKey);
        }
    }
    
    /**
     * 一時保存されたAPIキーを取得
     */
    getTempApiKey() {
        return this.getTemp('api-key', '');
    }
    
    /**
     * APIキーの一時保存をクリア
     */
    clearTempApiKey() {
        this.clear('api-key', 'temp');
    }
    
    /**
     * 現在のセクションを保存
     */
    saveActiveSection(section) {
        this.setTemp('active-section', section);
        this.setPersistent('last-active-section', section);
    }
    
    /**
     * 現在のセクションを取得
     */
    getActiveSection() {
        return this.getTemp('active-section') || 
               this.getPersistent('last-active-section') || 
               this.defaults.activeSection;
    }
    
    /**
     * 未保存の変更フラグを設定
     */
    setUnsavedChanges(hasChanges) {
        this.setTemp('unsaved-changes', hasChanges);
    }
    
    /**
     * 未保存の変更があるかチェック
     */
    hasUnsavedChanges() {
        return this.getTemp('unsaved-changes', false);
    }
    
    /**
     * スクロール位置を保存
     */
    saveScrollPosition(section, position) {
        const positions = this.getTemp('scroll-positions', {});
        positions[section] = position;
        this.setTempDebounced('scroll-positions', positions, 200);
    }
    
    /**
     * スクロール位置を復元
     */
    getScrollPosition(section) {
        const positions = this.getTemp('scroll-positions', {});
        return positions[section] || 0;
    }
    
    /**
     * セクションの展開状態を保存
     */
    saveExpandedState(sectionId, isExpanded) {
        const expanded = this.getPersistent('expanded-sections', {});
        expanded[sectionId] = isExpanded;
        this.setPersistent('expanded-sections', expanded);
    }
    
    /**
     * セクションの展開状態を取得
     */
    getExpandedState(sectionId) {
        const expanded = this.getPersistent('expanded-sections', {});
        return expanded[sectionId] !== false; // デフォルトは展開
    }
    
    /**
     * APIテスト結果を保存
     */
    saveApiTestResult(result) {
        this.setTemp('api-test-result', {
            result,
            timestamp: Date.now()
        });
    }
    
    /**
     * APIテスト結果を取得
     */
    getApiTestResult() {
        const data = this.getTemp('api-test-result');
        if (!data) return null;
        
        // 5分以上前の結果は無効
        if (Date.now() - data.timestamp > 5 * 60 * 1000) {
            this.clear('api-test-result', 'temp');
            return null;
        }
        
        return data.result;
    }
    
    /**
     * すべての設定状態をエクスポート（デバッグ用）
     */
    exportState() {
        const state = {
            temp: {},
            persistent: {},
            timestamp: Date.now()
        };
        
        // sessionStorageから取得
        Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith(this.namespace)) {
                state.temp[key] = sessionStorage.getItem(key);
            }
        });
        
        // localStorageから取得
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(this.namespace)) {
                state.persistent[key] = localStorage.getItem(key);
            }
        });
        
        return state;
    }
    
    /**
     * 状態をインポート（デバッグ用）
     */
    importState(state) {
        if (!state || typeof state !== 'object') return;
        
        // 一時的な状態を復元
        if (state.temp) {
            Object.entries(state.temp).forEach(([key, value]) => {
                sessionStorage.setItem(key, value);
            });
        }
        
        // 永続的な状態を復元
        if (state.persistent) {
            Object.entries(state.persistent).forEach(([key, value]) => {
                localStorage.setItem(key, value);
            });
        }
    }
}

// グローバルインスタンスを作成
window.settingsState = new SettingsStateManager();

// デバッグ用にコンソールからアクセス可能にする
if (window.debugMode || localStorage.getItem('novel-drive-debug-mode')) {
    window.StateManager = StateManager;
    window.SettingsStateManager = SettingsStateManager;
}