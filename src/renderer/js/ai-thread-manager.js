// AI Thread Manager - 各AIのスレッド永続化とメモリ管理

class AIThreadManager {
    constructor() {
        this.api = window.api || window.mockAPI;
        this.threads = new Map(); // エージェントID -> スレッド
        this.maxThreadLength = 50; // 各スレッドの最大長
        this.maxMemorySize = 10 * 1024 * 1024; // 10MB制限
        this.projectThreads = new Map(); // プロジェクトID -> スレッドマップ
        
        this.initialize();
    }
    
    async initialize() {
        await this.loadFromStorage();
        this.setupPeriodicSave();
        this.setupMemoryMonitoring();
    }
    
    // スレッドの作成または取得
    getOrCreateThread(agentId, projectId = null) {
        const key = this.getThreadKey(agentId, projectId);
        
        if (!this.threads.has(key)) {
            this.threads.set(key, {
                agentId,
                projectId,
                messages: [],
                context: {},
                createdAt: new Date(),
                lastActive: new Date(),
                metadata: {
                    totalTokens: 0,
                    avgResponseTime: 0,
                    successRate: 1.0
                }
            });
        }
        
        return this.threads.get(key);
    }
    
    // メッセージの追加
    addMessage(agentId, message, projectId = null) {
        const thread = this.getOrCreateThread(agentId, projectId);
        
        // メッセージを追加
        thread.messages.push({
            id: this.generateMessageId(),
            timestamp: new Date(),
            role: message.role, // 'user' or 'assistant'
            content: message.content,
            metadata: message.metadata || {},
            tokens: this.estimateTokens(message.content)
        });
        
        // スレッドの更新
        thread.lastActive = new Date();
        thread.metadata.totalTokens += message.tokens || 0;
        
        // メモリ管理
        this.pruneThread(thread);
        
        // 保存
        this.saveToStorage();
        
        return thread;
    }
    
    // コンテキストの更新
    updateContext(agentId, context, projectId = null) {
        const thread = this.getOrCreateThread(agentId, projectId);
        
        thread.context = {
            ...thread.context,
            ...context,
            lastUpdated: new Date()
        };
        
        this.saveToStorage();
    }
    
    // 会話履歴の取得
    getConversationHistory(agentId, projectId = null, limit = 10) {
        const thread = this.getOrCreateThread(agentId, projectId);
        
        // 最新のメッセージから取得
        const messages = thread.messages.slice(-limit);
        
        // コンテキストを含めた履歴を返す
        return {
            messages,
            context: thread.context,
            metadata: thread.metadata
        };
    }
    
    // スレッドの検索
    searchThreads(query, options = {}) {
        const results = [];
        
        this.threads.forEach((thread, key) => {
            // プロジェクトフィルタ
            if (options.projectId && thread.projectId !== options.projectId) {
                return;
            }
            
            // エージェントフィルタ
            if (options.agentId && thread.agentId !== options.agentId) {
                return;
            }
            
            // メッセージ内容の検索
            const matchingMessages = thread.messages.filter(msg => 
                msg.content.toLowerCase().includes(query.toLowerCase())
            );
            
            if (matchingMessages.length > 0) {
                results.push({
                    threadKey: key,
                    thread,
                    matches: matchingMessages,
                    relevance: matchingMessages.length / thread.messages.length
                });
            }
        });
        
        // 関連度でソート
        return results.sort((a, b) => b.relevance - a.relevance);
    }
    
    // スレッドの分析
    analyzeThread(agentId, projectId = null) {
        const thread = this.getOrCreateThread(agentId, projectId);
        
        const analysis = {
            messageCount: thread.messages.length,
            totalTokens: thread.metadata.totalTokens,
            avgMessageLength: 0,
            topTopics: [],
            sentiment: {},
            timeDistribution: {},
            responsePatterns: []
        };
        
        if (thread.messages.length === 0) {
            return analysis;
        }
        
        // 平均メッセージ長
        const totalLength = thread.messages.reduce((sum, msg) => sum + msg.content.length, 0);
        analysis.avgMessageLength = Math.round(totalLength / thread.messages.length);
        
        // トピック抽出（簡易版）
        const words = this.extractKeywords(thread.messages);
        analysis.topTopics = this.getTopWords(words, 10);
        
        // 時間分布
        analysis.timeDistribution = this.analyzeTimeDistribution(thread.messages);
        
        // 応答パターン
        analysis.responsePatterns = this.analyzeResponsePatterns(thread.messages);
        
        return analysis;
    }
    
    // キーワード抽出
    extractKeywords(messages) {
        const words = new Map();
        const stopWords = new Set(['の', 'に', 'は', 'を', 'が', 'と', 'で', 'て', 'た', 'し', 'も', 'な', 'か', 'だ', 'です', 'ます']);
        
        messages.forEach(msg => {
            // 簡易的な単語分割（実際は形態素解析を使うべき）
            const tokens = msg.content.split(/[\s、。！？\n]+/);
            
            tokens.forEach(token => {
                if (token.length > 1 && !stopWords.has(token)) {
                    words.set(token, (words.get(token) || 0) + 1);
                }
            });
        });
        
        return words;
    }
    
    // 上位単語の取得
    getTopWords(words, limit) {
        return Array.from(words.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([word, count]) => ({ word, count }));
    }
    
    // 時間分布の分析
    analyzeTimeDistribution(messages) {
        const distribution = {};
        
        messages.forEach(msg => {
            const hour = new Date(msg.timestamp).getHours();
            distribution[hour] = (distribution[hour] || 0) + 1;
        });
        
        return distribution;
    }
    
    // 応答パターンの分析
    analyzeResponsePatterns(messages) {
        const patterns = [];
        
        for (let i = 1; i < messages.length; i++) {
            if (messages[i].role === 'assistant' && messages[i-1].role === 'user') {
                const userMsg = messages[i-1].content;
                const assistantMsg = messages[i].content;
                
                // パターンの分類
                let pattern = 'other';
                if (userMsg.includes('続き')) pattern = 'continuation';
                else if (userMsg.includes('改善')) pattern = 'improvement';
                else if (userMsg.includes('詳細')) pattern = 'expansion';
                else if (userMsg.includes('対話')) pattern = 'dialogue';
                
                patterns.push({
                    pattern,
                    responseLength: assistantMsg.length,
                    responseTime: new Date(messages[i].timestamp) - new Date(messages[i-1].timestamp)
                });
            }
        }
        
        return patterns;
    }
    
    // スレッドのプルーニング（古いメッセージの削除）
    pruneThread(thread) {
        if (thread.messages.length > this.maxThreadLength) {
            // 古いメッセージを削除（最初の20%を削除）
            const removeCount = Math.floor(this.maxThreadLength * 0.2);
            thread.messages.splice(0, removeCount);
        }
    }
    
    // メモリ使用量の計算
    calculateMemoryUsage() {
        let totalSize = 0;
        
        this.threads.forEach(thread => {
            const threadSize = JSON.stringify(thread).length * 2; // UTF-16で2バイト/文字
            totalSize += threadSize;
        });
        
        return totalSize;
    }
    
    // メモリの最適化
    optimizeMemory() {
        const usage = this.calculateMemoryUsage();
        
        if (usage > this.maxMemorySize) {
            // 最も古いスレッドから削除
            const sortedThreads = Array.from(this.threads.entries())
                .sort((a, b) => a[1].lastActive - b[1].lastActive);
            
            let currentUsage = usage;
            let i = 0;
            
            while (currentUsage > this.maxMemorySize * 0.8 && i < sortedThreads.length) {
                const [key, thread] = sortedThreads[i];
                
                // 30日以上アクセスされていないスレッドを削除
                const daysSinceActive = (new Date() - new Date(thread.lastActive)) / (1000 * 60 * 60 * 24);
                if (daysSinceActive > 30) {
                    this.threads.delete(key);
                    currentUsage = this.calculateMemoryUsage();
                }
                
                i++;
            }
        }
    }
    
    // ストレージへの保存
    async saveToStorage() {
        try {
            const data = {
                version: '1.0',
                threads: Array.from(this.threads.entries()),
                lastSaved: new Date()
            };
            
            if (this.api) {
                await this.api.invoke('thread:save', data);
            } else {
                // LocalStorage fallback
                localStorage.setItem('ai-thread-manager', JSON.stringify(data));
            }
        } catch (error) {
            console.error('Failed to save threads:', error);
        }
    }
    
    // ストレージからの読み込み
    async loadFromStorage() {
        try {
            let data;
            
            if (this.api) {
                data = await this.api.invoke('thread:load');
            } else {
                // LocalStorage fallback
                const saved = localStorage.getItem('ai-thread-manager');
                if (saved) {
                    data = JSON.parse(saved);
                }
            }
            
            if (data && data.threads) {
                this.threads = new Map(data.threads);
            }
        } catch (error) {
            console.error('Failed to load threads:', error);
        }
    }
    
    // 定期保存の設定
    setupPeriodicSave() {
        setInterval(() => {
            this.saveToStorage();
        }, 60000); // 1分ごとに保存
    }
    
    // メモリ監視の設定
    setupMemoryMonitoring() {
        setInterval(() => {
            this.optimizeMemory();
        }, 300000); // 5分ごとにチェック
    }
    
    // スレッドキーの生成
    getThreadKey(agentId, projectId) {
        return projectId ? `${projectId}_${agentId}` : agentId;
    }
    
    // メッセージIDの生成
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // トークン数の推定（簡易版）
    estimateTokens(text) {
        // 日本語は約0.7文字/トークン、英語は約4文字/トークン
        const japaneseRatio = 0.7;
        const englishRatio = 4;
        
        // 日本語と英語の比率を推定
        const japaneseChars = (text.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g) || []).length;
        const totalChars = text.length;
        const japaneseRatio2 = japaneseChars / totalChars;
        
        const avgRatio = japaneseRatio2 * japaneseRatio + (1 - japaneseRatio2) * englishRatio;
        
        return Math.ceil(totalChars / avgRatio);
    }
    
    // エクスポート機能
    exportThread(agentId, projectId = null, format = 'json') {
        const thread = this.getOrCreateThread(agentId, projectId);
        
        if (format === 'json') {
            return JSON.stringify(thread, null, 2);
        } else if (format === 'markdown') {
            return this.exportAsMarkdown(thread);
        } else if (format === 'txt') {
            return this.exportAsText(thread);
        }
        
        throw new Error(`Unsupported format: ${format}`);
    }
    
    // Markdown形式でエクスポート
    exportAsMarkdown(thread) {
        let md = `# AI Thread: ${thread.agentId}\n\n`;
        md += `Created: ${thread.createdAt}\n`;
        md += `Last Active: ${thread.lastActive}\n\n`;
        
        md += `## Context\n\`\`\`json\n${JSON.stringify(thread.context, null, 2)}\n\`\`\`\n\n`;
        
        md += `## Conversation\n\n`;
        thread.messages.forEach(msg => {
            md += `### ${msg.role === 'user' ? '👤 User' : '🤖 Assistant'} - ${new Date(msg.timestamp).toLocaleString()}\n\n`;
            md += `${msg.content}\n\n`;
        });
        
        return md;
    }
    
    // テキスト形式でエクスポート
    exportAsText(thread) {
        let text = `AI Thread: ${thread.agentId}\n`;
        text += `${'='.repeat(50)}\n\n`;
        
        thread.messages.forEach(msg => {
            text += `[${msg.role.toUpperCase()}] ${new Date(msg.timestamp).toLocaleString()}\n`;
            text += `${msg.content}\n`;
            text += `${'-'.repeat(50)}\n\n`;
        });
        
        return text;
    }
}

// グローバルインスタンスの作成
window.aiThreadManager = new AIThreadManager();

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIThreadManager;
}