// 24時間自律創作モード - バックグラウンドで自動的に創作を行う

class AutonomousCreationMode {
    constructor() {
        this.api = window.api || window.mockAPI;
        this.isActive = false;
        this.isPaused = false;
        this.currentSession = null;
        this.scheduler = null;
        this.stats = {
            sessionsCompleted: 0,
            wordsGenerated: 0,
            chaptersCompleted: 0,
            startTime: null,
            lastActivity: null
        };
        
        // 設定
        this.config = {
            enabled: false,
            schedule: {
                type: 'interval', // 'interval', 'timeSlots', 'continuous'
                intervalMinutes: 60,
                timeSlots: [
                    { start: '09:00', end: '12:00' },
                    { start: '14:00', end: '17:00' },
                    { start: '20:00', end: '23:00' }
                ],
                maxSessionsPerDay: 24,
                pauseBetweenSessions: 10 // 分
            },
            creation: {
                mode: 'balanced', // 'planning', 'writing', 'editing', 'balanced'
                targetWordsPerSession: 500,
                targetChaptersPerDay: 1,
                qualityThreshold: 0.7,
                autoSave: true,
                autoCommit: false
            },
            agents: {
                useAllAgents: true,
                primaryAgent: 'writer_sharp',
                agentRotation: true,
                collaborationMode: 'sequential' // 'sequential', 'parallel', 'consensus'
            },
            notifications: {
                onStart: true,
                onComplete: true,
                onError: true,
                onMilestone: true,
                channels: ['app', 'email', 'discord']
            },
            safety: {
                maxRetries: 3,
                errorPauseMinutes: 30,
                dailyTokenLimit: 100000,
                requireHumanReview: true,
                autoStopOnRepetition: true
            }
        };
        
        this.initialize();
    }
    
    async initialize() {
        await this.loadConfig();
        this.setupUI();
        this.setupScheduler();
        this.setupMonitoring();
        
        // 自動開始チェック
        if (this.config.enabled && !this.isActive) {
            this.start();
        }
    }
    
    setupUI() {
        this.createControlPanel();
        this.createStatusDisplay();
        this.createScheduleView();
    }
    
    createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'autonomous-control-panel';
        panel.className = 'autonomous-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>24時間自律創作モード</h3>
                <div class="status-indicator ${this.isActive ? 'active' : 'inactive'}"></div>
            </div>
            <div class="panel-content">
                <div class="control-buttons">
                    <button id="auto-start-btn" onclick="window.autonomousMode.toggle()">
                        ${this.isActive ? '停止' : '開始'}
                    </button>
                    <button id="auto-pause-btn" onclick="window.autonomousMode.pause()" 
                            ${!this.isActive ? 'disabled' : ''}>
                        ${this.isPaused ? '再開' : '一時停止'}
                    </button>
                    <button onclick="window.autonomousMode.showSettings()">
                        設定
                    </button>
                </div>
                
                <div class="status-overview">
                    <div class="stat-item">
                        <span class="label">セッション完了</span>
                        <span class="value" id="sessions-completed">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">生成文字数</span>
                        <span class="value" id="words-generated">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="label">完成章数</span>
                        <span class="value" id="chapters-completed">0</span>
                    </div>
                </div>
                
                <div class="current-activity" id="current-activity">
                    <div class="activity-text">待機中...</div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="activity-progress"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }
    
    createStatusDisplay() {
        const display = document.createElement('div');
        display.id = 'autonomous-status-display';
        display.className = 'status-display';
        display.innerHTML = `
            <div class="status-header">
                <h4>自律創作ログ</h4>
                <button onclick="window.autonomousMode.clearLog()">クリア</button>
            </div>
            <div class="status-log" id="autonomous-log"></div>
        `;
        
        const panel = document.getElementById('autonomous-control-panel');
        panel.appendChild(display);
    }
    
    createScheduleView() {
        const view = document.createElement('div');
        view.id = 'autonomous-schedule-view';
        view.className = 'schedule-view';
        view.innerHTML = `
            <div class="schedule-header">
                <h4>実行スケジュール</h4>
                <span class="next-run" id="next-run-time">次回: --:--</span>
            </div>
            <div class="schedule-timeline" id="schedule-timeline"></div>
        `;
        
        const panel = document.getElementById('autonomous-control-panel');
        panel.appendChild(view);
    }
    
    setupScheduler() {
        // スケジューラーの設定
        this.scheduler = {
            intervals: [],
            nextRun: null,
            
            start: () => {
                this.clearSchedule();
                
                switch (this.config.schedule.type) {
                    case 'interval':
                        this.setupIntervalSchedule();
                        break;
                    case 'timeSlots':
                        this.setupTimeSlotSchedule();
                        break;
                    case 'continuous':
                        this.setupContinuousSchedule();
                        break;
                }
            },
            
            stop: () => {
                this.clearSchedule();
            }
        };
    }
    
    setupIntervalSchedule() {
        const interval = this.config.schedule.intervalMinutes * 60 * 1000;
        
        const runSession = () => {
            if (!this.isPaused) {
                this.executeSession();
            }
        };
        
        // 初回実行
        runSession();
        
        // 定期実行
        const intervalId = setInterval(runSession, interval);
        this.scheduler.intervals.push(intervalId);
        
        // 次回実行時刻を更新
        this.updateNextRunTime(new Date(Date.now() + interval));
    }
    
    setupTimeSlotSchedule() {
        const checkAndRun = () => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            for (const slot of this.config.schedule.timeSlots) {
                if (currentTime >= slot.start && currentTime < slot.end) {
                    if (!this.currentSession) {
                        this.executeSession();
                    }
                    break;
                }
            }
            
            // 次のスロットを計算
            this.calculateNextTimeSlot();
        };
        
        // 1分ごとにチェック
        const intervalId = setInterval(checkAndRun, 60000);
        this.scheduler.intervals.push(intervalId);
        
        // 初回チェック
        checkAndRun();
    }
    
    setupContinuousSchedule() {
        const runContinuous = async () => {
            while (this.isActive && !this.isPaused) {
                await this.executeSession();
                
                // セッション間の休憩
                await this.sleep(this.config.schedule.pauseBetweenSessions * 60 * 1000);
            }
        };
        
        runContinuous();
    }
    
    async executeSession() {
        if (this.currentSession) {
            this.log('前のセッションがまだ実行中です', 'warning');
            return;
        }
        
        try {
            this.currentSession = {
                id: `session_${Date.now()}`,
                startTime: new Date(),
                project: await this.selectProject(),
                mode: this.determineCreationMode(),
                progress: 0
            };
            
            this.log(`セッション開始: ${this.currentSession.mode}モード`, 'info');
            this.updateActivity(`${this.currentSession.mode}を実行中...`);
            
            // モードに応じた処理を実行
            switch (this.currentSession.mode) {
                case 'planning':
                    await this.executePlanningSession();
                    break;
                case 'writing':
                    await this.executeWritingSession();
                    break;
                case 'editing':
                    await this.executeEditingSession();
                    break;
                case 'balanced':
                    await this.executeBalancedSession();
                    break;
            }
            
            // 統計を更新
            this.stats.sessionsCompleted++;
            this.stats.lastActivity = new Date();
            this.updateStats();
            
            // セッション完了通知
            if (this.config.notifications.onComplete) {
                this.sendNotification('セッション完了', `${this.currentSession.mode}セッションが完了しました`);
            }
            
        } catch (error) {
            this.handleSessionError(error);
        } finally {
            this.currentSession = null;
            this.updateActivity('待機中...');
        }
    }
    
    async executePlanningSession() {
        const agents = ['deputy_editor', 'writer', 'editor'];
        const coordinator = new AgentCoordinator();
        
        // プロット作成の議論
        const discussion = await coordinator.discussTopic({
            topic: 'plot_creation',
            projectId: this.currentSession.project.id,
            agents: agents,
            maxTurns: 10
        });
        
        // 結果を保存
        if (discussion.result && discussion.result.plot) {
            await this.savePlot(discussion.result.plot);
            this.log('プロット作成完了', 'success');
        }
    }
    
    async executeWritingSession() {
        const project = this.currentSession.project;
        const chapter = await this.selectChapterToWrite(project.id);
        
        if (!chapter) {
            this.log('執筆する章がありません', 'warning');
            return;
        }
        
        // AI執筆アシスタントを使用
        const writer = this.getWriter();
        const targetWords = this.config.creation.targetWordsPerSession;
        let totalWords = 0;
        
        while (totalWords < targetWords) {
            // コンテキストを取得
            const context = await this.getWritingContext(chapter);
            
            // 続きを生成
            const response = await writer.executeAction('continue', context);
            const generatedText = response.text;
            
            // 品質チェック
            const quality = await this.assessQuality(generatedText);
            if (quality >= this.config.creation.qualityThreshold) {
                await this.appendToChapter(chapter, generatedText);
                totalWords += this.countWords(generatedText);
                
                // 進捗更新
                this.currentSession.progress = (totalWords / targetWords) * 100;
                this.updateProgress(this.currentSession.progress);
            } else {
                this.log('生成テキストの品質が低いため再試行', 'warning');
            }
            
            // 繰り返しチェック
            if (this.detectRepetition(generatedText)) {
                this.log('繰り返しを検出、セッションを終了', 'warning');
                break;
            }
        }
        
        this.stats.wordsGenerated += totalWords;
        this.log(`${totalWords}文字を執筆しました`, 'success');
    }
    
    async executeEditingSession() {
        const chapter = await this.selectChapterToEdit();
        
        if (!chapter) {
            this.log('編集する章がありません', 'warning');
            return;
        }
        
        // 編集エージェントを起動
        const editor = this.getEditor();
        const content = await this.getChapterContent(chapter);
        
        // セクションごとに編集
        const sections = this.splitIntoSections(content);
        const editedSections = [];
        
        for (const section of sections) {
            const edited = await editor.improve(section);
            editedSections.push(edited);
            
            // 進捗更新
            const progress = (editedSections.length / sections.length) * 100;
            this.updateProgress(progress);
        }
        
        // 編集結果を保存
        const editedContent = editedSections.join('\n\n');
        await this.saveChapterContent(chapter, editedContent);
        
        this.log('章の編集が完了しました', 'success');
    }
    
    async executeBalancedSession() {
        // プロジェクトの状態を分析
        const analysis = await this.analyzeProjectState();
        
        // 優先度に基づいてモードを選択
        if (analysis.needsPlanning) {
            await this.executePlanningSession();
        } else if (analysis.needsWriting) {
            await this.executeWritingSession();
        } else if (analysis.needsEditing) {
            await this.executeEditingSession();
        } else {
            this.log('現在実行すべきタスクがありません', 'info');
        }
    }
    
    async selectProject() {
        // アクティブなプロジェクトを選択
        const projects = await this.api.invoke('project:getAll');
        const activeProjects = projects.data?.filter(p => p.metadata?.autonomousEnabled) || [];
        
        if (activeProjects.length === 0) {
            throw new Error('自律創作が有効なプロジェクトがありません');
        }
        
        // 最も更新されていないプロジェクトを選択
        return activeProjects.sort((a, b) => 
            new Date(a.lastModified) - new Date(b.lastModified)
        )[0];
    }
    
    determineCreationMode() {
        if (this.config.creation.mode !== 'balanced') {
            return this.config.creation.mode;
        }
        
        // バランスモードの場合、時間帯によってモードを変更
        const hour = new Date().getHours();
        
        if (hour >= 6 && hour < 12) {
            return 'planning';
        } else if (hour >= 12 && hour < 18) {
            return 'writing';
        } else if (hour >= 18 && hour < 24) {
            return 'editing';
        } else {
            return 'writing'; // 深夜は執筆
        }
    }
    
    async assessQuality(text) {
        // 簡易的な品質評価
        const criteria = {
            length: text.length > 50 ? 0.2 : 0,
            variety: this.calculateVocabularyVariety(text) * 0.3,
            coherence: this.assessCoherence(text) * 0.3,
            style: this.assessStyleConsistency(text) * 0.2
        };
        
        return Object.values(criteria).reduce((sum, score) => sum + score, 0);
    }
    
    calculateVocabularyVariety(text) {
        const words = text.split(/\s+/);
        const uniqueWords = new Set(words);
        return Math.min(1, uniqueWords.size / words.length * 2);
    }
    
    assessCoherence(text) {
        // 文の長さの一貫性をチェック
        const sentences = text.split(/[。！？]/);
        if (sentences.length < 2) return 1;
        
        const lengths = sentences.map(s => s.length);
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
        
        return Math.max(0, 1 - variance / (avgLength * avgLength));
    }
    
    assessStyleConsistency(text) {
        // スタイルの一貫性（仮実装）
        return 0.8;
    }
    
    detectRepetition(text) {
        // 繰り返しパターンの検出
        const words = text.split(/\s+/);
        const patterns = new Map();
        
        for (let i = 0; i < words.length - 3; i++) {
            const pattern = words.slice(i, i + 3).join(' ');
            patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
        }
        
        // 同じパターンが3回以上出現したら繰り返しと判定
        return Array.from(patterns.values()).some(count => count >= 3);
    }
    
    getWriter() {
        if (window.aiAssistant) {
            return window.aiAssistant;
        }
        
        // フォールバック
        return {
            executeAction: async (action, context) => {
                const response = await this.api.invoke('openai:assistWriting', {
                    action,
                    context,
                    agentId: this.config.agents.primaryAgent
                });
                return response;
            }
        };
    }
    
    getEditor() {
        return {
            improve: async (text) => {
                const response = await this.api.invoke('openai:assistWriting', {
                    action: 'improve',
                    context: { selected: text },
                    agentId: 'editor_twitter'
                });
                return response.text;
            }
        };
    }
    
    async handleSessionError(error) {
        this.log(`エラー: ${error.message}`, 'error');
        
        if (this.config.notifications.onError) {
            this.sendNotification('エラー発生', error.message);
        }
        
        // エラー後の一時停止
        if (this.config.safety.errorPauseMinutes > 0) {
            this.pause();
            setTimeout(() => {
                if (this.isPaused) {
                    this.resume();
                }
            }, this.config.safety.errorPauseMinutes * 60 * 1000);
        }
    }
    
    toggle() {
        if (this.isActive) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.stats.startTime = new Date();
        this.scheduler.start();
        
        this.updateUI();
        this.log('自律創作モードを開始しました', 'success');
        
        if (this.config.notifications.onStart) {
            this.sendNotification('自律創作開始', '24時間自律創作モードが開始されました');
        }
    }
    
    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        this.isPaused = false;
        this.scheduler.stop();
        
        this.updateUI();
        this.log('自律創作モードを停止しました', 'info');
    }
    
    pause() {
        if (!this.isActive || this.isPaused) return;
        
        this.isPaused = true;
        this.updateUI();
        this.log('自律創作モードを一時停止しました', 'info');
    }
    
    resume() {
        if (!this.isActive || !this.isPaused) return;
        
        this.isPaused = false;
        this.updateUI();
        this.log('自律創作モードを再開しました', 'info');
    }
    
    updateUI() {
        // ボタンの更新
        const startBtn = document.getElementById('auto-start-btn');
        const pauseBtn = document.getElementById('auto-pause-btn');
        const statusIndicator = document.querySelector('.status-indicator');
        
        if (startBtn) {
            startBtn.textContent = this.isActive ? '停止' : '開始';
        }
        
        if (pauseBtn) {
            pauseBtn.textContent = this.isPaused ? '再開' : '一時停止';
            pauseBtn.disabled = !this.isActive;
        }
        
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${this.isActive ? 'active' : 'inactive'}`;
        }
    }
    
    updateStats() {
        document.getElementById('sessions-completed').textContent = this.stats.sessionsCompleted;
        document.getElementById('words-generated').textContent = this.stats.wordsGenerated;
        document.getElementById('chapters-completed').textContent = this.stats.chaptersCompleted;
    }
    
    updateActivity(text) {
        const activityEl = document.querySelector('#current-activity .activity-text');
        if (activityEl) {
            activityEl.textContent = text;
        }
    }
    
    updateProgress(percent) {
        const progressEl = document.getElementById('activity-progress');
        if (progressEl) {
            progressEl.style.width = `${percent}%`;
        }
    }
    
    updateNextRunTime(time) {
        const el = document.getElementById('next-run-time');
        if (el) {
            el.textContent = `次回: ${time.toLocaleTimeString()}`;
        }
    }
    
    log(message, type = 'info') {
        const logEl = document.getElementById('autonomous-log');
        if (!logEl) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.innerHTML = `
            <span class="log-time">${new Date().toLocaleTimeString()}</span>
            <span class="log-message">${message}</span>
        `;
        
        logEl.insertBefore(entry, logEl.firstChild);
        
        // 最大100件まで保持
        while (logEl.children.length > 100) {
            logEl.removeChild(logEl.lastChild);
        }
    }
    
    clearLog() {
        const logEl = document.getElementById('autonomous-log');
        if (logEl) {
            logEl.innerHTML = '';
        }
    }
    
    sendNotification(title, message) {
        // アプリ内通知
        if (this.config.notifications.channels.includes('app')) {
            this.showAppNotification(title, message);
        }
        
        // その他の通知チャンネル（将来実装）
    }
    
    showAppNotification(title, message) {
        const notification = document.createElement('div');
        notification.className = 'autonomous-notification';
        notification.innerHTML = `
            <h4>${title}</h4>
            <p>${message}</p>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
    
    showSettings() {
        // 設定モーダルを表示
        const modal = document.createElement('div');
        modal.className = 'autonomous-settings-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>自律創作モード設定</h2>
                <div class="settings-content">
                    ${this.renderSettings()}
                </div>
                <div class="modal-actions">
                    <button onclick="window.autonomousMode.saveSettings()">保存</button>
                    <button onclick="window.autonomousMode.closeSettings()">キャンセル</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    renderSettings() {
        // 設定UIのレンダリング（簡略化）
        return `
            <div class="setting-group">
                <h3>スケジュール設定</h3>
                <label>
                    実行タイプ:
                    <select id="schedule-type">
                        <option value="interval" ${this.config.schedule.type === 'interval' ? 'selected' : ''}>定期実行</option>
                        <option value="timeSlots" ${this.config.schedule.type === 'timeSlots' ? 'selected' : ''}>時間帯指定</option>
                        <option value="continuous" ${this.config.schedule.type === 'continuous' ? 'selected' : ''}>連続実行</option>
                    </select>
                </label>
            </div>
            <div class="setting-group">
                <h3>創作設定</h3>
                <label>
                    モード:
                    <select id="creation-mode">
                        <option value="balanced" ${this.config.creation.mode === 'balanced' ? 'selected' : ''}>バランス</option>
                        <option value="planning" ${this.config.creation.mode === 'planning' ? 'selected' : ''}>企画重視</option>
                        <option value="writing" ${this.config.creation.mode === 'writing' ? 'selected' : ''}>執筆重視</option>
                        <option value="editing" ${this.config.creation.mode === 'editing' ? 'selected' : ''}>編集重視</option>
                    </select>
                </label>
            </div>
        `;
    }
    
    saveSettings() {
        // 設定を保存
        this.config.schedule.type = document.getElementById('schedule-type').value;
        this.config.creation.mode = document.getElementById('creation-mode').value;
        
        this.saveConfig();
        this.closeSettings();
        
        // スケジューラーを再起動
        if (this.isActive) {
            this.scheduler.stop();
            this.scheduler.start();
        }
    }
    
    closeSettings() {
        const modal = document.querySelector('.autonomous-settings-modal');
        if (modal) {
            modal.remove();
        }
    }
    
    async saveConfig() {
        try {
            if (this.api) {
                await this.api.invoke('settings:save', {
                    autonomous: this.config
                });
            } else {
                localStorage.setItem('autonomous-mode-config', JSON.stringify(this.config));
            }
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    }
    
    async loadConfig() {
        try {
            let savedConfig;
            
            if (this.api) {
                const settings = await this.api.invoke('settings:get');
                savedConfig = settings.autonomous;
            } else {
                const saved = localStorage.getItem('autonomous-mode-config');
                if (saved) {
                    savedConfig = JSON.parse(saved);
                }
            }
            
            if (savedConfig) {
                this.config = { ...this.config, ...savedConfig };
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    }
    
    clearSchedule() {
        this.scheduler.intervals.forEach(id => clearInterval(id));
        this.scheduler.intervals = [];
    }
    
    calculateNextTimeSlot() {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        let nextSlot = null;
        let minDiff = Infinity;
        
        for (const slot of this.config.schedule.timeSlots) {
            const [startHour, startMinute] = slot.start.split(':').map(Number);
            const slotTime = startHour * 60 + startMinute;
            
            let diff = slotTime - currentTime;
            if (diff < 0) {
                diff += 24 * 60; // 翌日
            }
            
            if (diff < minDiff) {
                minDiff = diff;
                nextSlot = new Date(now.getTime() + diff * 60 * 1000);
            }
        }
        
        if (nextSlot) {
            this.updateNextRunTime(nextSlot);
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    countWords(text) {
        // 日本語の文字数カウント
        return text.length;
    }
    
    splitIntoSections(text) {
        // テキストをセクションに分割
        return text.split(/\n\n+/).filter(s => s.trim());
    }
    
    async analyzeProjectState() {
        // プロジェクトの状態を分析（簡易実装）
        return {
            needsPlanning: Math.random() > 0.7,
            needsWriting: Math.random() > 0.3,
            needsEditing: Math.random() > 0.5
        };
    }
    
    async getWritingContext(chapter) {
        // 執筆コンテキストの取得（簡易実装）
        return {
            chapter,
            previousContent: '',
            plot: {},
            characters: []
        };
    }
    
    async appendToChapter(chapter, text) {
        // 章にテキストを追加（簡易実装）
        console.log(`Chapter ${chapter.id}: ${text.substring(0, 50)}...`);
    }
    
    async getChapterContent(chapter) {
        // 章の内容を取得（簡易実装）
        return 'サンプルテキスト';
    }
    
    async saveChapterContent(chapter, content) {
        // 章の内容を保存（簡易実装）
        console.log(`Saved chapter ${chapter.id}`);
    }
    
    async selectChapterToWrite(projectId) {
        // 執筆する章を選択（簡易実装）
        return { id: 1, title: 'Chapter 1' };
    }
    
    async selectChapterToEdit() {
        // 編集する章を選択（簡易実装）
        return { id: 1, title: 'Chapter 1' };
    }
    
    async savePlot(plot) {
        // プロットを保存（簡易実装）
        console.log('Plot saved:', plot);
    }
    
    setupMonitoring() {
        // パフォーマンスモニタリング
        setInterval(() => {
            if (this.isActive) {
                // トークン使用量チェック
                // メモリ使用量チェック
                // エラー率チェック
            }
        }, 300000); // 5分ごと
    }
}

// Initialize autonomous mode
window.autonomousMode = new AutonomousCreationMode();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutonomousCreationMode;
}