// AI Writing Assistant with Sharp Writing Style
// AI臭さを消すキレのある文体を実現

class AIWritingAssistant {
    constructor() {
        this.api = window.api || window.mockAPI;
        this.isActive = false;
        this.currentStyle = 'sharp'; // sharp, emotional, descriptive
        this.selectedPersonality = null;
        this.threadManager = null; // AIThreadManagerのインスタンス
        this.contextWindow = 10; // 保持する会話履歴の数
        
        // 文体パラメータ
        this.styleConfigs = {
            sharp: {
                name: 'シャープライター',
                description: 'キレのある文体でAI臭さを消す',
                traits: {
                    creativity: 90,
                    emotion: 40,
                    logic: 85,
                    terseness: 95, // 簡潔さ
                    uniqueness: 90 // 独自性
                },
                prompts: {
                    base: '短く、鋭く、印象的に。読者の心に刺さる文章を。',
                    continue: '前の文章の勢いを保ちながら、展開にキレを持たせて続けてください。',
                    improve: 'より簡潔に、より鋭く。無駄を削ぎ落とし、本質を突いてください。',
                    dialogue: 'キャラクターの本音が見える、生きた対話を。説明的な台詞は避けて。'
                }
            },
            emotional: {
                name: 'エモーショナルライター',
                description: '感情豊かで読者の心を動かす',
                traits: {
                    creativity: 80,
                    emotion: 95,
                    logic: 60,
                    terseness: 50,
                    uniqueness: 75
                },
                prompts: {
                    base: '感情の機微を大切に、読者の心に響く表現を。',
                    continue: '感情の流れを大切にしながら、自然に続けてください。',
                    improve: 'より感情的に、より心に響くように改善してください。',
                    dialogue: 'キャラクターの感情が伝わる、心のこもった対話を。'
                }
            },
            descriptive: {
                name: '描写派ライター',
                description: '緻密な描写で世界を構築',
                traits: {
                    creativity: 75,
                    emotion: 60,
                    logic: 90,
                    terseness: 30,
                    uniqueness: 70
                },
                prompts: {
                    base: '五感に訴える描写で、読者を物語の世界に引き込んでください。',
                    continue: '世界観を大切にしながら、詳細に続けてください。',
                    improve: 'より豊かな描写で、場面をより鮮明に改善してください。',
                    dialogue: '状況と感情が見える、立体的な対話を。'
                }
            }
        };
        
        this.initializeUI();
        this.loadSettings();
        this.initializeThreadManager();
    }
    
    async initializeThreadManager() {
        // スレッドマネージャーが利用可能か確認
        if (window.aiThreadManager) {
            this.threadManager = window.aiThreadManager;
        } else {
            // スレッドマネージャーを動的にロード
            try {
                const script = document.createElement('script');
                script.src = './js/ai-thread-manager.js';
                document.head.appendChild(script);
                
                // ロード完了を待つ
                await new Promise((resolve) => {
                    script.onload = () => {
                        this.threadManager = window.aiThreadManager;
                        resolve();
                    };
                });
            } catch (error) {
                console.error('Failed to load thread manager:', error);
            }
        }
    }
    
    initializeUI() {
        // AIアシスタントタブにUIを作成
        this.createAssistantInTab();
    }
    
    createAssistantInTab() {
        // AIアシスタントタブのコンテナを取得
        const container = document.querySelector('.ai-assistant-content');
        if (!container) {
            console.warn('AI assistant tab content container not found');
            return;
        }
        
        // AIアシスタントのUIを作成
        container.innerHTML = `
            <div class="ai-assistant-inner">
                <div id="style-selector"></div>
                <div id="action-buttons"></div>
                <div id="thread-view"></div>
                <div id="ai-response"></div>
            </div>
        `;
        
        // 各コンポーネントを初期化
        this.createStyleSelector();
        this.createActionButtons();
        this.createThreadView();
    }
    
    createStyleSelector() {
        const selector = document.getElementById('style-selector');
        if (!selector) return;
        
        selector.innerHTML = `
            <div class="style-selector">
                <label>文体スタイル:</label>
                <select id="writing-style" onchange="window.aiAssistant.changeStyle(this.value)">
                    ${Object.entries(this.styleConfigs).map(([key, config]) => `
                        <option value="${key}" ${key === this.currentStyle ? 'selected' : ''}>
                            ${config.name} - ${config.description}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="style-traits" id="style-traits"></div>
        `;
        
        this.updateStyleTraits();
    }
    
    createActionButtons() {
        const container = document.getElementById('action-buttons');
        if (!container) return;
        
        const actions = [
            { id: 'continue', icon: '➡️', label: '続きを書く', key: 'Ctrl+Shift+C' },
            { id: 'improve', icon: '✨', label: '文章を改善', key: 'Ctrl+Shift+I' },
            { id: 'expand', icon: '📝', label: '詳細に展開', key: 'Ctrl+Shift+E' },
            { id: 'dialogue', icon: '💬', label: '対話を生成', key: 'Ctrl+Shift+D' },
            { id: 'scene', icon: '🎬', label: 'シーン描写', key: 'Ctrl+Shift+S' },
            { id: 'brainstorm', icon: '💡', label: 'アイデア出し', key: 'Ctrl+Shift+B' }
        ];
        
        container.innerHTML = `
            <div class="action-buttons">
                ${actions.map(action => `
                    <button class="action-btn" onclick="window.aiAssistant.executeAction('${action.id}')" title="${action.key}">
                        <span class="icon">${action.icon}</span>
                        <span class="label">${action.label}</span>
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    createThreadView() {
        const container = document.getElementById('thread-view');
        if (!container) return;
        
        container.innerHTML = `
            <div class="thread-container">
                <div class="thread-header">
                    <h4>スレッド履歴</h4>
                    <button class="clear-btn" onclick="window.aiAssistant.clearThread()">
                        クリア
                    </button>
                </div>
                <div class="thread-messages" id="thread-messages"></div>
            </div>
        `;
    }
    
    async executeAction(action) {
        const editor = document.getElementById('editor');
        if (!editor) return;
        
        const selectedText = window.getSelection().toString();
        const context = this.getContext(editor, selectedText);
        
        // プロジェクトIDを取得（現在のプロジェクトから）
        const projectId = window.currentProject?.id || null;
        
        // スレッドマネージャーから履歴を取得
        let threadHistory = [];
        if (this.threadManager) {
            const agentId = `writer_${this.currentStyle}`;
            const history = this.threadManager.getConversationHistory(agentId, projectId, 5);
            threadHistory = history.messages;
        }
        
        // プロンプトを構築
        const styleConfig = this.styleConfigs[this.currentStyle];
        const basePrompt = styleConfig.prompts[action] || styleConfig.prompts.base;
        
        const prompt = this.buildPrompt(action, context, basePrompt, threadHistory);
        
        try {
            // AI応答を取得
            const response = await this.callAI(prompt, action);
            
            // スレッドマネージャーに追加
            if (this.threadManager) {
                const agentId = `writer_${this.currentStyle}`;
                
                // ユーザーメッセージを追加
                this.threadManager.addMessage(agentId, {
                    role: 'user',
                    content: context.selected || context.surrounding.substring(0, 200),
                    metadata: { action }
                }, projectId);
                
                // アシスタントメッセージを追加
                this.threadManager.addMessage(agentId, {
                    role: 'assistant',
                    content: response.text,
                    metadata: { action, style: this.currentStyle }
                }, projectId);
                
                // UIを更新
                this.updateThreadViewFromManager(agentId, projectId);
            }
            
            // UIに表示
            this.displayResponse(response.text, action);
            
            // エディタに挿入オプションを提供
            this.offerInsertion(response.text, editor, selectedText);
            
        } catch (error) {
            console.error('AI execution error:', error);
            this.displayError('AIの実行中にエラーが発生しました');
        }
    }
    
    buildPrompt(action, context, basePrompt, threadHistory) {
        const style = this.styleConfigs[this.currentStyle];
        
        let prompt = `あなたは${style.name}です。${style.description}\n\n`;
        prompt += `文体の特徴:\n`;
        prompt += `- 簡潔さ: ${style.traits.terseness}%\n`;
        prompt += `- 独自性: ${style.traits.uniqueness}%\n`;
        prompt += `- 感情表現: ${style.traits.emotion}%\n\n`;
        
        prompt += basePrompt + '\n\n';
        
        // スレッド履歴を追加
        if (threadHistory.length > 0) {
            prompt += '過去の会話:\n';
            threadHistory.slice(-3).forEach(entry => {
                prompt += `---\n文脈: ${entry.context}\n応答: ${entry.response}\n`;
            });
            prompt += '---\n\n';
        }
        
        // 現在のコンテキストを追加
        if (context.selected) {
            prompt += `選択されたテキスト:\n${context.selected}\n\n`;
        }
        
        prompt += `周辺のテキスト:\n${context.surrounding}\n\n`;
        
        // アクション固有の指示
        const actionInstructions = {
            continue: '上記のテキストの続きを、同じトーンとスタイルで書いてください。',
            improve: '選択されたテキストを、より洗練された表現に改善してください。',
            expand: '選択された部分をより詳細に展開してください。',
            dialogue: '次の対話を、キャラクターの個性を活かして書いてください。',
            scene: 'この場面の描写を、五感に訴える表現で書いてください。',
            brainstorm: 'この文脈で考えられる展開のアイデアを3つ提案してください。'
        };
        
        prompt += actionInstructions[action] || '';
        
        return prompt;
    }
    
    async callAI(prompt, action) {
        if (!this.api) {
            throw new Error('API not available');
        }
        
        const response = await this.api.invoke('openai:assistWritingEnhanced', {
            prompt,
            action,
            agentId: `writer_${this.currentStyle}`,
            personality: this.styleConfigs[this.currentStyle],
            maxTokens: action === 'brainstorm' ? 500 : 300,
            temperature: this.getTemperatureForAction(action)
        });
        
        return response;
    }
    
    getTemperatureForAction(action) {
        const temperatures = {
            continue: 0.7,
            improve: 0.5,
            expand: 0.6,
            dialogue: 0.8,
            scene: 0.7,
            brainstorm: 0.9
        };
        return temperatures[action] || 0.7;
    }
    
    getContext(editor, selectedText) {
        const fullText = editor.value;
        const selectionStart = editor.selectionStart;
        const selectionEnd = editor.selectionEnd;
        
        // 前後500文字を取得
        const contextStart = Math.max(0, selectionStart - 500);
        const contextEnd = Math.min(fullText.length, selectionEnd + 500);
        
        return {
            selected: selectedText,
            surrounding: fullText.substring(contextStart, contextEnd),
            before: fullText.substring(contextStart, selectionStart),
            after: fullText.substring(selectionEnd, contextEnd)
        };
    }
    
    updateThreadViewFromManager(agentId, projectId) {
        if (!this.threadManager) return;
        
        const history = this.threadManager.getConversationHistory(agentId, projectId, 10);
        const messagesContainer = document.getElementById('thread-messages');
        if (!messagesContainer) return;
        
        messagesContainer.innerHTML = history.messages.map(msg => `
            <div class="thread-message">
                <div class="message-header">
                    <span class="action">${msg.role === 'user' ? '👤' : '🤖'} ${msg.metadata?.action ? this.getActionLabel(msg.metadata.action) : msg.role}</span>
                    <span class="time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="message-content">${this.truncateText(msg.content, 100)}</div>
            </div>
        `).join('');
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    updateThreadView(activeThreadKey) {
        const messagesContainer = document.getElementById('thread-messages');
        if (!messagesContainer) return;
        
        const thread = this.threadMemory.get(activeThreadKey) || [];
        
        messagesContainer.innerHTML = thread.map(entry => `
            <div class="thread-message">
                <div class="message-header">
                    <span class="action">${this.getActionLabel(entry.action)}</span>
                    <span class="time">${new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="message-context">${this.truncateText(entry.context, 50)}</div>
                <div class="message-response">${this.truncateText(entry.response, 100)}</div>
            </div>
        `).join('');
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    getActionLabel(action) {
        const labels = {
            continue: '続きを書く',
            improve: '文章を改善',
            expand: '詳細に展開',
            dialogue: '対話を生成',
            scene: 'シーン描写',
            brainstorm: 'アイデア出し'
        };
        return labels[action] || action;
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    displayResponse(text, action) {
        const responseContainer = document.getElementById('ai-response');
        if (!responseContainer) return;
        
        responseContainer.innerHTML = `
            <div class="ai-response-content">
                <div class="response-header">
                    <span class="style-name">${this.styleConfigs[this.currentStyle].name}</span>
                    <span class="action-name">${this.getActionLabel(action)}</span>
                </div>
                <div class="response-text">${this.formatResponse(text)}</div>
                <div class="response-actions">
                    <button onclick="window.aiAssistant.insertResponse()">挿入</button>
                    <button onclick="window.aiAssistant.copyResponse()">コピー</button>
                    <button onclick="window.aiAssistant.regenerate('${action}')">再生成</button>
                </div>
            </div>
        `;
        
        this.lastResponse = text;
    }
    
    formatResponse(text) {
        // 改行を<br>に変換し、特殊文字をエスケープ
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/\n/g, '<br>');
    }
    
    offerInsertion(text, editor, selectedText) {
        this.pendingInsertion = {
            text,
            editor,
            selectedText,
            selectionStart: editor.selectionStart,
            selectionEnd: editor.selectionEnd
        };
    }
    
    insertResponse() {
        if (!this.pendingInsertion || !this.lastResponse) return;
        
        const { editor, selectionStart, selectionEnd } = this.pendingInsertion;
        const textBefore = editor.value.substring(0, selectionStart);
        const textAfter = editor.value.substring(selectionEnd);
        
        editor.value = textBefore + this.lastResponse + textAfter;
        
        // カーソル位置を調整
        const newPosition = selectionStart + this.lastResponse.length;
        editor.setSelectionRange(newPosition, newPosition);
        
        // 変更イベントを発火
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Undo/Redoマネージャに追加
        if (window.undoRedoManager) {
            window.undoRedoManager.addState(editor.value);
        }
    }
    
    copyResponse() {
        if (!this.lastResponse) return;
        
        navigator.clipboard.writeText(this.lastResponse)
            .then(() => {
                this.showNotification('コピーしました');
            })
            .catch(err => {
                console.error('Copy failed:', err);
                this.showNotification('コピーに失敗しました', 'error');
            });
    }
    
    async regenerate(action) {
        await this.executeAction(action);
    }
    
    changeStyle(newStyle) {
        this.currentStyle = newStyle;
        this.updateStyleTraits();
        this.saveSettings();
    }
    
    updateStyleTraits() {
        const traitsContainer = document.getElementById('style-traits');
        if (!traitsContainer) return;
        
        const style = this.styleConfigs[this.currentStyle];
        
        traitsContainer.innerHTML = `
            <div class="traits-grid">
                ${Object.entries(style.traits).map(([trait, value]) => `
                    <div class="trait">
                        <span class="trait-name">${this.getTraitLabel(trait)}</span>
                        <div class="trait-bar">
                            <div class="trait-fill" style="width: ${value}%"></div>
                        </div>
                        <span class="trait-value">${value}%</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    getTraitLabel(trait) {
        const labels = {
            creativity: '創造性',
            emotion: '感情表現',
            logic: '論理性',
            terseness: '簡潔さ',
            uniqueness: '独自性'
        };
        return labels[trait] || trait;
    }
    
    // タブ内での表示なのでtogglePanelは不要
    activateTab() {
        // AIアシスタントタブをアクティブにする
        const tabBtn = document.querySelector('[data-tab="ai-assistant"]');
        if (tabBtn) {
            tabBtn.click();
        }
    }
    
    clearThread() {
        if (this.threadManager) {
            const agentId = `writer_${this.currentStyle}`;
            const projectId = window.currentProject?.id || null;
            
            // スレッドマネージャーのスレッドをクリア
            const key = this.threadManager.getThreadKey(agentId, projectId);
            this.threadManager.threads.delete(key);
            this.threadManager.saveToStorage();
            
            // UIを更新
            this.updateThreadViewFromManager(agentId, projectId);
        }
    }
    
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `ai-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    getCurrentAgentInfo() {
        const style = this.styleConfigs[this.currentStyle];
        return {
            name: style.name,
            style: this.currentStyle,
            traits: style.traits
        };
    }
    
    showPanel() {
        // AIアシスタントタブを表示
        this.activateTab();
    }
    
    saveSettings() {
        const settings = {
            currentStyle: this.currentStyle,
            isActive: this.isActive
        };
        localStorage.setItem('ai-assistant-settings', JSON.stringify(settings));
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('ai-assistant-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.currentStyle = settings.currentStyle || 'sharp';
                this.isActive = settings.isActive !== false;
            }
        } catch (error) {
            console.error('Failed to load AI assistant settings:', error);
        }
        
        // スレッドマネージャーが管理するため、ローカルのスレッドメモリは不要
    }
    
}

// Initialize AI Assistant
window.aiAssistant = new AIWritingAssistant();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIWritingAssistant;
}