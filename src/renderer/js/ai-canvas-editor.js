// AI Canvas Editor - AIと人間の協調編集システム

class AICanvasEditor {
    constructor() {
        this.editor = null;
        this.aiSuggestions = new Map(); // position -> suggestion
        this.activeAIWriting = false;
        this.aiWritingPosition = null;
        this.collaborationMode = 'canvas'; // 'canvas' or 'traditional'
        this.aiCursor = null;
        this.humanCursor = null;
        this.init();
    }
    
    init() {
        this.editor = document.getElementById('editor');
        if (!this.editor) return;
        
        // Canvas風のエディタに変換
        this.setupCanvasMode();
        this.setupEventListeners();
        this.loadSettings();
    }
    
    setupCanvasMode() {
        // エディタをdiv要素でラップしてCanvas風にする
        const wrapper = this.editor.parentElement;
        
        // Canvas風エディタコンテナを作成
        const canvasEditor = document.createElement('div');
        canvasEditor.className = 'canvas-editor';
        canvasEditor.innerHTML = `
            <div class="canvas-toolbar">
                <button class="canvas-btn" id="ai-write-mode">
                    <span class="icon">🤖</span>
                    AI執筆モード
                </button>
                <button class="canvas-btn" id="human-edit-mode" class="active">
                    <span class="icon">✏️</span>
                    人間編集モード
                </button>
                <button class="canvas-btn" id="collab-mode">
                    <span class="icon">🤝</span>
                    協調モード
                </button>
                <div class="canvas-separator"></div>
                <button class="canvas-btn" id="ai-suggest-here">
                    <span class="icon">💡</span>
                    ここでAI提案
                </button>
                <button class="canvas-btn" id="ai-continue-writing">
                    <span class="icon">➡️</span>
                    AI続き書き
                </button>
                <button class="canvas-btn" id="ai-rewrite-selection">
                    <span class="icon">🔄</span>
                    選択部分をAI書き直し
                </button>
            </div>
            
            <div class="canvas-content">
                <div class="ai-writing-indicator" id="ai-writing-indicator">
                    <span class="ai-cursor">🤖</span>
                    <span class="ai-status">AIが執筆中...</span>
                </div>
                
                <div class="suggestion-bubbles" id="suggestion-bubbles"></div>
            </div>
        `;
        
        // エディタの前に挿入
        wrapper.insertBefore(canvasEditor, this.editor);
        
        // エディタにCanvas用のクラスを追加
        this.editor.classList.add('canvas-mode-editor');
    }
    
    setupEventListeners() {
        // モード切り替え
        document.getElementById('ai-write-mode')?.addEventListener('click', () => this.setMode('ai'));
        document.getElementById('human-edit-mode')?.addEventListener('click', () => this.setMode('human'));
        document.getElementById('collab-mode')?.addEventListener('click', () => this.setMode('collab'));
        
        // AI機能
        document.getElementById('ai-suggest-here')?.addEventListener('click', () => this.aiSuggestAtCursor());
        document.getElementById('ai-continue-writing')?.addEventListener('click', () => this.aiContinueWriting());
        document.getElementById('ai-rewrite-selection')?.addEventListener('click', () => this.aiRewriteSelection());
        
        // エディタイベント
        this.editor.addEventListener('input', (e) => this.handleEditorInput(e));
        this.editor.addEventListener('selectionchange', (e) => this.handleSelectionChange(e));
        
        // AI提案のリアルタイムトリガー
        this.setupAISuggestionTriggers();
    }
    
    setMode(mode) {
        // モードボタンの状態を更新
        document.querySelectorAll('.canvas-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (mode === 'ai') {
            document.getElementById('ai-write-mode').classList.add('active');
            this.startAIWritingMode();
        } else if (mode === 'human') {
            document.getElementById('human-edit-mode').classList.add('active');
            this.stopAIWritingMode();
        } else if (mode === 'collab') {
            document.getElementById('collab-mode').classList.add('active');
            this.startCollaborativeMode();
        }
    }
    
    // AI執筆モード
    async startAIWritingMode() {
        this.activeAIWriting = true;
        this.editor.classList.add('ai-writing-active');
        
        // AIカーソルを表示
        this.showAICursor();
        
        // AIに執筆を開始させる
        const context = this.getWritingContext();
        await this.aiStartWriting(context);
    }
    
    stopAIWritingMode() {
        this.activeAIWriting = false;
        this.editor.classList.remove('ai-writing-active');
        this.hideAICursor();
    }
    
    // 協調モード
    startCollaborativeMode() {
        this.collaborationMode = 'collab';
        this.editor.classList.add('collab-mode');
        
        // 人間が書いている間もAIが提案を出す
        this.enableRealtimeSuggestions();
    }
    
    // AIがカーソル位置で提案
    async aiSuggestAtCursor() {
        const cursorPos = this.editor.selectionStart;
        const context = this.getContextAroundPosition(cursorPos);
        
        const suggestion = await this.getAISuggestion(context);
        this.showSuggestionBubble(cursorPos, suggestion);
    }
    
    // AI続き書き
    async aiContinueWriting() {
        const endPos = this.editor.value.length;
        this.editor.setSelectionRange(endPos, endPos);
        
        const context = this.getWritingContext();
        const continuation = await this.getAIContinuation(context);
        
        // アニメーション付きで文章を追加
        await this.animateTextInsertion(continuation, endPos);
    }
    
    // 選択部分をAI書き直し
    async aiRewriteSelection() {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        
        if (start === end) {
            alert('書き直したいテキストを選択してください。');
            return;
        }
        
        const selectedText = this.editor.value.substring(start, end);
        const context = this.getContextAroundPosition(start);
        
        const rewritten = await this.getAIRewrite(selectedText, context);
        
        // 書き直し候補を表示
        this.showRewriteOptions(start, end, [rewritten]);
    }
    
    // AI執筆アニメーション
    async animateTextInsertion(text, position) {
        const indicator = document.getElementById('ai-writing-indicator');
        indicator.style.display = 'block';
        
        // 一文字ずつアニメーション
        for (let i = 0; i < text.length; i++) {
            if (!this.activeAIWriting) break;
            
            const char = text[i];
            const currentText = this.editor.value;
            const newText = currentText.slice(0, position + i) + char + currentText.slice(position + i);
            
            this.editor.value = newText;
            this.editor.setSelectionRange(position + i + 1, position + i + 1);
            
            // AIカーソルの位置を更新
            this.updateAICursorPosition(position + i + 1);
            
            // タイピング速度をシミュレート
            await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 50));
        }
        
        indicator.style.display = 'none';
        
        // 編集イベントを発火
        this.editor.dispatchEvent(new Event('input'));
    }
    
    // 提案バブルを表示
    showSuggestionBubble(position, suggestion) {
        const bubble = document.createElement('div');
        bubble.className = 'suggestion-bubble';
        bubble.innerHTML = `
            <div class="suggestion-content">${suggestion.text}</div>
            <div class="suggestion-actions">
                <button onclick="window.aiCanvasEditor.acceptSuggestion(${position}, '${suggestion.id}')">採用</button>
                <button onclick="window.aiCanvasEditor.rejectSuggestion('${suggestion.id}')">却下</button>
                <button onclick="window.aiCanvasEditor.modifySuggestion('${suggestion.id}')">修正</button>
            </div>
        `;
        
        // 位置を計算
        const coords = this.getTextCoordinates(position);
        bubble.style.left = coords.x + 'px';
        bubble.style.top = coords.y + 'px';
        
        document.getElementById('suggestion-bubbles').appendChild(bubble);
        
        // 提案を保存
        this.aiSuggestions.set(suggestion.id, {
            position,
            text: suggestion.text,
            bubble
        });
    }
    
    // 書き直しオプションを表示
    showRewriteOptions(start, end, options) {
        const modal = document.createElement('div');
        modal.className = 'rewrite-modal';
        modal.innerHTML = `
            <div class="rewrite-content">
                <h3>AI書き直し候補</h3>
                <div class="original-text">
                    <h4>元のテキスト:</h4>
                    <p>${this.editor.value.substring(start, end)}</p>
                </div>
                <div class="rewrite-options">
                    ${options.map((option, index) => `
                        <div class="rewrite-option">
                            <p>${option}</p>
                            <button onclick="window.aiCanvasEditor.applyRewrite(${start}, ${end}, '${option}')">
                                この案を採用
                            </button>
                        </div>
                    `).join('')}
                </div>
                <div class="rewrite-actions">
                    <button onclick="window.aiCanvasEditor.requestMoreRewrites(${start}, ${end})">
                        他の案を見る
                    </button>
                    <button onclick="this.closest('.rewrite-modal').remove()">
                        キャンセル
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    // リアルタイムAI提案のトリガー設定
    setupAISuggestionTriggers() {
        let suggestionTimer = null;
        
        this.editor.addEventListener('input', () => {
            if (!this.collaborationMode === 'collab') return;
            
            // 入力が止まってから1秒後に提案
            clearTimeout(suggestionTimer);
            suggestionTimer = setTimeout(() => {
                this.checkForSuggestionTriggers();
            }, 1000);
        });
    }
    
    // 提案トリガーをチェック
    async checkForSuggestionTriggers() {
        const cursorPos = this.editor.selectionStart;
        const text = this.editor.value;
        
        // トリガーパターン（例：「？」の後、段落の終わりなど）
        const triggers = [
            { pattern: /[。！？]\s*$/, type: 'sentence_end' },
            { pattern: /\n\n$/, type: 'paragraph_end' },
            { pattern: /「.*」$/, type: 'dialogue_end' }
        ];
        
        const textBeforeCursor = text.substring(0, cursorPos);
        
        for (const trigger of triggers) {
            if (trigger.pattern.test(textBeforeCursor)) {
                const context = this.getContextAroundPosition(cursorPos);
                const suggestion = await this.getAISuggestion(context, trigger.type);
                
                if (suggestion) {
                    this.showInlineSuggestion(cursorPos, suggestion);
                }
                break;
            }
        }
    }
    
    // インライン提案を表示
    showInlineSuggestion(position, suggestion) {
        const preview = document.createElement('span');
        preview.className = 'inline-suggestion';
        preview.textContent = suggestion.text;
        preview.style.opacity = '0.5';
        preview.style.fontStyle = 'italic';
        
        // エディタ内に仮想的に表示（実装は簡略化）
        this.showSuggestionBubble(position, suggestion);
    }
    
    // AI API呼び出し（モック）
    async getAISuggestion(context, triggerType = null) {
        // 実際のAI APIを呼び出す
        if (window.aiAssistant) {
            const result = await window.aiAssistant.executeAction('suggest', {
                context: context,
                triggerType: triggerType,
                mode: 'canvas'
            });
            
            return {
                id: Date.now().toString(),
                text: result.text || 'AI提案を生成できませんでした。'
            };
        }
        
        // モック
        return {
            id: Date.now().toString(),
            text: '次の展開として、主人公は新たな発見をすることになります。'
        };
    }
    
    async getAIContinuation(context) {
        if (window.aiAssistant) {
            const result = await window.aiAssistant.executeAction('continue', {
                context: context,
                mode: 'canvas',
                length: 'medium'
            });
            
            return result.text || '';
        }
        
        return 'そして物語は続いていきます。新たな冒険が始まろうとしていました。';
    }
    
    async getAIRewrite(text, context) {
        if (window.aiAssistant) {
            const result = await window.aiAssistant.executeAction('rewrite', {
                text: text,
                context: context,
                mode: 'canvas',
                style: 'improve'
            });
            
            return result.text || text;
        }
        
        return text + '（AI書き直し版）';
    }
    
    // ヘルパーメソッド
    getWritingContext() {
        const cursorPos = this.editor.selectionStart;
        return {
            fullText: this.editor.value,
            beforeCursor: this.editor.value.substring(Math.max(0, cursorPos - 1000), cursorPos),
            afterCursor: this.editor.value.substring(cursorPos, Math.min(this.editor.value.length, cursorPos + 500)),
            cursorPosition: cursorPos
        };
    }
    
    getContextAroundPosition(position) {
        return {
            before: this.editor.value.substring(Math.max(0, position - 500), position),
            after: this.editor.value.substring(position, Math.min(this.editor.value.length, position + 200)),
            position: position
        };
    }
    
    getTextCoordinates(position) {
        // 簡略化された座標計算
        const rect = this.editor.getBoundingClientRect();
        return {
            x: rect.left + 50,
            y: rect.top + 50
        };
    }
    
    // AIカーソル表示
    showAICursor() {
        const indicator = document.getElementById('ai-writing-indicator');
        indicator.style.display = 'block';
    }
    
    hideAICursor() {
        const indicator = document.getElementById('ai-writing-indicator');
        indicator.style.display = 'none';
    }
    
    updateAICursorPosition(position) {
        // AIカーソルの位置を更新（実装は簡略化）
    }
    
    // 提案の受け入れ/拒否
    acceptSuggestion(position, suggestionId) {
        const suggestion = this.aiSuggestions.get(suggestionId);
        if (!suggestion) return;
        
        // テキストを挿入
        const currentText = this.editor.value;
        const newText = currentText.slice(0, position) + suggestion.text + currentText.slice(position);
        this.editor.value = newText;
        
        // バブルを削除
        suggestion.bubble.remove();
        this.aiSuggestions.delete(suggestionId);
        
        // イベントを発火
        this.editor.dispatchEvent(new Event('input'));
    }
    
    rejectSuggestion(suggestionId) {
        const suggestion = this.aiSuggestions.get(suggestionId);
        if (!suggestion) return;
        
        suggestion.bubble.remove();
        this.aiSuggestions.delete(suggestionId);
    }
    
    modifySuggestion(suggestionId) {
        const suggestion = this.aiSuggestions.get(suggestionId);
        if (!suggestion) return;
        
        // 編集モーダルを表示
        const newText = prompt('提案を編集してください:', suggestion.text);
        if (newText) {
            suggestion.text = newText;
            suggestion.bubble.querySelector('.suggestion-content').textContent = newText;
        }
    }
    
    applyRewrite(start, end, newText) {
        const currentText = this.editor.value;
        const rewritten = currentText.slice(0, start) + newText + currentText.slice(end);
        this.editor.value = rewritten;
        
        // モーダルを閉じる
        document.querySelector('.rewrite-modal')?.remove();
        
        // イベントを発火
        this.editor.dispatchEvent(new Event('input'));
    }
    
    async requestMoreRewrites(start, end) {
        const selectedText = this.editor.value.substring(start, end);
        const context = this.getContextAroundPosition(start);
        
        // 追加の書き直し案を取得
        const moreOptions = [];
        for (let i = 0; i < 3; i++) {
            const rewritten = await this.getAIRewrite(selectedText, context);
            moreOptions.push(rewritten + ` (案${i + 2})`);
        }
        
        // 既存のモーダルを更新
        document.querySelector('.rewrite-modal')?.remove();
        this.showRewriteOptions(start, end, moreOptions);
    }
    
    // 設定の保存/読み込み
    saveSettings() {
        const settings = {
            collaborationMode: this.collaborationMode,
            aiSuggestionsEnabled: this.aiSuggestionsEnabled
        };
        localStorage.setItem('ai-canvas-editor-settings', JSON.stringify(settings));
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('ai-canvas-editor-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.collaborationMode = settings.collaborationMode || 'canvas';
                this.aiSuggestionsEnabled = settings.aiSuggestionsEnabled !== false;
            }
        } catch (error) {
            console.error('Failed to load canvas editor settings:', error);
        }
    }
}

// Initialize AI Canvas Editor
window.aiCanvasEditor = new AICanvasEditor();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AICanvasEditor;
}