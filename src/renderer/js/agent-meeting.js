// Agent Meeting Room functionality

// Global state
let currentSession = null;
let sessionTimer = null;
let elapsedSeconds = 0;
let outputItems = [];
let plotElements = {
    themes: [],
    premise: null,
    characters: [],
    setting: null,
    conflicts: [],
    structure: null,
    keyScenes: []
};
let isPlotCreationMode = false;
let currentWorkflow = null;
let workflowIndicator = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadProjectList();
    loadPersonalities();
    loadCustomAgents();
    subscribeToAgentUpdates();
    subscribeToPersonalityUpdates();
    subscribeToWorkflowUpdates();
    checkWorkflowContext();
    createWorkflowIndicator();
});

// Initialize event listeners
function initializeEventListeners() {
    // Session controls
    document.getElementById('start-session').addEventListener('click', startSession);
    document.getElementById('send-message').addEventListener('click', sendMessage);
    document.getElementById('user-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', handleActionButton);
    });
    
    // Project selector
    document.getElementById('project-selector').addEventListener('change', handleProjectChange);
    
    // Session type selector
    document.getElementById('session-type').addEventListener('change', handleSessionTypeChange);
    
    // Plot generation button
    document.getElementById('generate-plot-btn')?.addEventListener('click', generatePlotFromSession);
    
    // Workflow control buttons
    document.getElementById('start-writing-btn')?.addEventListener('click', startWritingPhase);
    document.getElementById('pause-workflow-btn')?.addEventListener('click', pauseWorkflow);
    document.getElementById('resume-workflow-btn')?.addEventListener('click', resumeWorkflow);
    
    // Personality management
    document.getElementById('personality-settings-btn')?.addEventListener('click', showPersonalityModal);
    document.getElementById('apply-preset-btn')?.addEventListener('click', showPresetModal);
    
    // Create agent button
    document.getElementById('create-agent-btn')?.addEventListener('click', () => {
        window.location.href = './agent-creator.html';
    });
    
    // Agent cards - make them clickable for switching
    document.querySelectorAll('.agent-card').forEach(card => {
        card.addEventListener('click', handleAgentClick);
        card.style.cursor = 'pointer';
        card.title = 'クリックしてエージェントを切り替え';
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
    
    // Navigation
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
}

// Load project list
async function loadProjectList() {
    try {
        const api = window.api || window.mockAPI;
        if (!api) {
            console.warn('No API available');
            return;
        }
        
        const response = await api.invoke('project:getAll');
        const projects = response.data || response;
        
        const selector = document.getElementById('project-selector');
        
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

// Handle project selection change
function handleProjectChange(event) {
    const projectId = event.target.value;
    if (projectId) {
        // Load project-specific context
        loadProjectContext(projectId);
    }
}

// Handle session type change
function handleSessionTypeChange(event) {
    const sessionType = event.target.value;
    isPlotCreationMode = sessionType === 'plot_creation';
    
    // Show/hide plot elements panel
    const plotElementsPanel = document.getElementById('plot-elements-panel');
    if (plotElementsPanel) {
        plotElementsPanel.style.display = isPlotCreationMode ? 'block' : 'none';
    }
    
    // Show/hide action buttons
    document.getElementById('default-actions').style.display = isPlotCreationMode ? 'none' : 'flex';
    document.getElementById('plot-actions').style.display = isPlotCreationMode ? 'flex' : 'none';
    
    // Update UI for plot creation mode
    if (isPlotCreationMode && currentSession) {
        updatePlotElementsDisplay();
    }
}

// Generate plot from session
async function generatePlotFromSession() {
    if (!currentSession || !isPlotCreationMode) return;
    
    try {
        const result = await window.api.invoke('agents:generatePlot', {
            sessionId: currentSession.id
        });
        
        if (result.success) {
            window.api.showMessage('プロットが生成されました！', 'success');
            // The plot will be handled through the event system
        } else {
            window.api.showMessage('プロット生成に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to generate plot:', error);
        window.api.showMessage('プロット生成中にエラーが発生しました', 'error');
    }
}

// Load project context for agents
async function loadProjectContext(projectId) {
    try {
        const context = await window.api.invoke('project:getContext', { projectId });
        // Context will be used when starting sessions
        window.currentProjectContext = context;
    } catch (error) {
        console.error('Failed to load project context:', error);
    }
}

// Start agent session
async function startSession() {
    const sessionType = document.getElementById('session-type').value;
    const participantCheckboxes = document.querySelectorAll('.participant-checkboxes input:checked');
    const participants = Array.from(participantCheckboxes).map(cb => cb.value);
    
    if (participants.length === 0) {
        window.api.showMessage('少なくとも1つのエージェントを選択してください', 'warning');
        return;
    }
    
    const projectId = document.getElementById('project-selector').value;
    if (!projectId) {
        window.api.showMessage('プロジェクトを選択してください', 'warning');
        return;
    }
    
    try {
        // Start session through IPC
        const session = await window.api.invoke('agents:startSession', {
            type: sessionType,
            participants,
            projectId,
            context: window.currentProjectContext
        });
        
        currentSession = session;
        isPlotCreationMode = sessionType === 'plot_creation';
        
        // Update UI
        enableSessionControls();
        updateSessionStatus('進行中');
        startSessionTimer();
        clearChatMessages();
        addSystemMessage(`セッション開始: ${getSessionTypeLabel(sessionType)}`);
        
        // Update agent statuses
        participants.forEach(agentType => {
            updateAgentStatus(agentType, 'idle');
        });
        
        // Show plot elements panel if in plot creation mode
        if (isPlotCreationMode) {
            document.getElementById('plot-elements-panel').style.display = 'block';
            document.getElementById('default-actions').style.display = 'none';
            document.getElementById('plot-actions').style.display = 'flex';
            initializePlotElements();
            addSystemMessage('プロット作成モードが開始されました。AIエージェントと協力してプロットを作成しましょう。');
        }
        
    } catch (error) {
        console.error('Failed to start session:', error);
        window.api.showMessage('セッションの開始に失敗しました', 'error');
    }
}

// Send message to agents
async function sendMessage() {
    const input = document.getElementById('user-input');
    const message = input.value.trim();
    
    if (!message || !currentSession) return;
    
    // Add user message to chat
    addUserMessage(message);
    input.value = '';
    
    // Show agents are thinking
    currentSession.participants.forEach(agentType => {
        updateAgentStatus(agentType, 'thinking');
    });
    
    try {
        // Determine plot aspect if in plot creation mode
        let plotAspect = 'general';
        if (isPlotCreationMode) {
            plotAspect = determineplotAspectFromMessage(message);
        }
        
        // Send message through IPC
        await window.api.invoke('agents:sendMessage', {
            sessionId: currentSession.id,
            message,
            role: 'user',
            plotAspect: plotAspect
        });
        
        // Agents will respond through the subscription system
        
    } catch (error) {
        console.error('Failed to send message:', error);
        addSystemMessage('メッセージの送信に失敗しました', 'error');
        
        // Reset agent status on error
        currentSession.participants.forEach(agentType => {
            updateAgentStatus(agentType, 'idle');
        });
    }
}

// Determine plot aspect from message
function determineplotAspectFromMessage(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('テーマ') || lowerMessage.includes('theme')) {
        return 'themes';
    } else if (lowerMessage.includes('前提') || lowerMessage.includes('プレミス') || lowerMessage.includes('premise')) {
        return 'premise';
    } else if (lowerMessage.includes('キャラクター') || lowerMessage.includes('登場人物') || lowerMessage.includes('character')) {
        return 'characters';
    } else if (lowerMessage.includes('設定') || lowerMessage.includes('世界観') || lowerMessage.includes('setting')) {
        return 'setting';
    } else if (lowerMessage.includes('対立') || lowerMessage.includes('コンフリクト') || lowerMessage.includes('conflict')) {
        return 'conflicts';
    } else if (lowerMessage.includes('構造') || lowerMessage.includes('構成') || lowerMessage.includes('structure')) {
        return 'structure';
    }
    
    return 'general';
}

// Handle action buttons
async function handleActionButton(event) {
    const action = event.target.dataset.action;
    if (!currentSession) return;
    
    const actions = {
        // Default actions
        'request-ideas': {
            message: 'このトピックについて新しいアイデアを提案してください。',
            type: 'brainstorm'
        },
        'request-review': {
            message: '現在の内容をレビューし、改善点を指摘してください。',
            type: 'review'
        },
        'request-revision': {
            message: '指摘された問題点を修正し、改善案を提示してください。',
            type: 'revision'
        },
        // Plot creation actions
        'discuss-theme': {
            message: 'この物語のテーマについて議論しましょう。どのようなテーマが読者に響くでしょうか？',
            type: 'plot_theme'
        },
        'discuss-character': {
            message: '魅力的なキャラクターを作りましょう。主人公や重要なキャラクターについて提案してください。',
            type: 'plot_character'
        },
        'discuss-conflict': {
            message: '物語の中心となる対立やコンフリクトについて議論しましょう。どのような対立が物語を推進しますか？',
            type: 'plot_conflict'
        },
        'discuss-structure': {
            message: '物語の構造について議論しましょう。どのような展開が読者を引き込みますか？',
            type: 'plot_structure'
        }
    };
    
    const actionData = actions[action];
    if (actionData) {
        document.getElementById('user-input').value = actionData.message;
        await sendMessage();
    }
}

// Handle agent card clicks for switching
function handleAgentClick(event) {
    const agentCard = event.target.closest('.agent-card');
    if (!agentCard) return;
    
    const agentType = agentCard.dataset.agentType;
    if (!agentType) return;
    
    // Prevent event if clicking on checkbox
    if (event.target.type === 'checkbox') return;
    
    // Prevent event if clicking on delete button
    if (event.target.classList.contains('delete-agent-btn')) return;
    
    // For custom agents, don't show switching modal
    if (agentType.startsWith('custom_')) {
        showMessage('カスタムエージェントの人格は編集できません', 'info');
        return;
    }
    
    // Show agent switching modal
    showAgentSwitchModal(agentType);
}

// Show agent switching modal
async function showAgentSwitchModal(agentType) {
    try {
        const [assignmentsResult, personalitiesResult] = await Promise.all([
            window.api.invoke('personality:get-assignments'),
            window.api.invoke('personality:get-all')
        ]);
        
        if (assignmentsResult.success && personalitiesResult.success) {
            createAgentSwitchModal(agentType, assignmentsResult.data, personalitiesResult.data);
        }
    } catch (error) {
        console.error('Failed to load agent data:', error);
        window.api.showMessage('エージェントデータの読み込みに失敗しました', 'error');
    }
}

// Create agent switch modal
function createAgentSwitchModal(agentType, assignments, allPersonalities) {
    const roleNames = {
        writer: '作家AI',
        editor: '編集者AI',
        deputy_editor: '副編集長AI',
        proofreader: '校正AI'
    };
    
    const currentPersonality = assignments[agentType];
    const rolePersonalities = allPersonalities.filter(p => p.role === agentType);
    
    const modal = document.createElement('div');
    modal.className = 'modal agent-switch-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${roleNames[agentType]}の人格を切り替え</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p>現在の人格: <strong>${currentPersonality?.name || '未設定'}</strong></p>
                <div class="personality-options">
                    ${rolePersonalities.map(p => `
                        <div class="personality-option ${currentPersonality?.id === p.id ? 'current' : ''}" 
                             onclick="selectPersonality('${agentType}', '${p.id}', this)">
                            <div class="personality-header">
                                <strong>${p.name}</strong>
                                ${p.isBuiltIn ? '<span class="badge built-in">標準</span>' : '<span class="badge custom">カスタム</span>'}
                            </div>
                            <div class="personality-description">${p.description || 'No description'}</div>
                            ${currentPersonality?.id === p.id ? '<div class="current-indicator">✓ 現在使用中</div>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="this.closest('.modal').remove()">
                    キャンセル
                </button>
                <button id="apply-personality-btn" class="primary-btn" disabled onclick="applySelectedPersonality('${agentType}')">
                    適用
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add styles if not already added
    if (!document.getElementById('agent-switch-styles')) {
        const style = document.createElement('style');
        style.id = 'agent-switch-styles';
        style.textContent = `
            .agent-switch-modal .modal-content {
                max-width: 500px;
                width: 90%;
            }
            
            .personality-options {
                margin-top: 1rem;
                max-height: 400px;
                overflow-y: auto;
            }
            
            .personality-option {
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 1rem;
                margin-bottom: 0.5rem;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .personality-option:hover {
                border-color: var(--primary);
                background: var(--bg-secondary);
            }
            
            .personality-option.selected {
                border-color: var(--primary);
                background: var(--primary-light);
            }
            
            .personality-option.current {
                border-color: var(--success);
                background: var(--success-light);
            }
            
            .personality-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
            }
            
            .personality-description {
                font-size: 0.9rem;
                color: var(--text-secondary);
                line-height: 1.4;
            }
            
            .current-indicator {
                font-size: 0.8rem;
                color: var(--success);
                font-weight: bold;
                margin-top: 0.5rem;
            }
            
            .badge {
                font-size: 0.7rem;
                padding: 0.2rem 0.4rem;
                border-radius: 3px;
                font-weight: bold;
                text-transform: uppercase;
            }
            
            .badge.built-in {
                background: var(--info-light);
                color: var(--info);
            }
            
            .badge.custom {
                background: var(--warning-light);
                color: var(--warning);
            }
        `;
        document.head.appendChild(style);
    }
}

// Select personality
window.selectedPersonalityId = null;
window.selectPersonality = function(agentType, personalityId, element) {
    // Remove previous selection
    document.querySelectorAll('.personality-option.selected').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Add selection to clicked element
    element.classList.add('selected');
    
    // Store selected personality
    window.selectedPersonalityId = personalityId;
    
    // Enable apply button
    document.getElementById('apply-personality-btn').disabled = false;
};

// Apply selected personality
window.applySelectedPersonality = async function(agentType) {
    if (!window.selectedPersonalityId) return;
    
    try {
        const result = await window.api.invoke('personality:switch', { 
            role: agentType, 
            personalityId: window.selectedPersonalityId 
        });
        
        if (result.success) {
            window.api.showMessage(`${result.data.personality.name}に切り替えました`, 'success');
            updatePersonalityDisplay({ [agentType]: result.data.personality });
            
            // Close modal
            document.querySelector('.agent-switch-modal').remove();
            
            // Reset selection
            window.selectedPersonalityId = null;
        } else {
            window.api.showMessage(result.error || '切り替えに失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to switch personality:', error);
        window.api.showMessage('人格の切り替えに失敗しました', 'error');
    }
};

// Load personalities
async function loadPersonalities() {
    try {
        const result = await window.api.invoke('personality:get-assignments');
        if (result.success) {
            updatePersonalityDisplay(result.data);
        }
    } catch (error) {
        console.error('Failed to load personalities:', error);
    }
}

// Update personality display
function updatePersonalityDisplay(assignments) {
    Object.entries(assignments).forEach(([role, personality]) => {
        const agentCard = document.querySelector(`[data-agent-type="${role}"]`);
        if (agentCard && personality) {
            const personalityElement = agentCard.querySelector('.agent-personality');
            if (personalityElement) {
                personalityElement.textContent = personality.name;
                personalityElement.title = personality.description || '';
            }
        }
    });
}

// Show personality modal
async function showPersonalityModal() {
    const modal = document.getElementById('personality-modal');
    if (!modal) return;
    
    // Load current personalities and options
    try {
        const [assignmentsResult, personalitiesResult] = await Promise.all([
            window.api.invoke('personality:get-assignments'),
            window.api.invoke('personality:get-all')
        ]);
        
        if (assignmentsResult.success && personalitiesResult.success) {
            renderPersonalityOptions(assignmentsResult.data, personalitiesResult.data);
            modal.style.display = 'flex';
        }
    } catch (error) {
        console.error('Failed to load personality data:', error);
        window.api.showMessage('人格データの読み込みに失敗しました', 'error');
    }
}

// Render personality options
function renderPersonalityOptions(assignments, allPersonalities) {
    const container = document.getElementById('personality-options');
    if (!container) return;
    
    const roles = ['writer', 'editor', 'deputy_editor', 'proofreader'];
    const roleNames = {
        writer: '作家AI',
        editor: '編集者AI',
        deputy_editor: '副編集長AI',
        proofreader: '校正AI'
    };
    
    container.innerHTML = roles.map(role => {
        const currentPersonality = assignments[role];
        const rolePersonalities = allPersonalities.filter(p => p.role === role);
        
        return `
            <div class="personality-role">
                <h4>${roleNames[role]}</h4>
                <select class="personality-select" data-role="${role}">
                    ${rolePersonalities.map(p => `
                        <option value="${p.id}" ${currentPersonality?.id === p.id ? 'selected' : ''}>
                            ${p.name} ${p.isBuiltIn ? '' : '(カスタム)'}
                        </option>
                    `).join('')}
                </select>
                <button class="btn-secondary" onclick="switchPersonality('${role}')">
                    適用
                </button>
            </div>
        `;
    }).join('');
}

// Switch personality
window.switchPersonality = async function(role) {
    const select = document.querySelector(`.personality-select[data-role="${role}"]`);
    if (!select) return;
    
    const personalityId = select.value;
    
    try {
        const result = await window.api.invoke('personality:switch', { role, personalityId });
        if (result.success) {
            window.api.showMessage(`${result.data.personality.name}に切り替えました`, 'success');
            updatePersonalityDisplay({ [role]: result.data.personality });
        } else {
            window.api.showMessage(result.error || '切り替えに失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to switch personality:', error);
        window.api.showMessage('人格の切り替えに失敗しました', 'error');
    }
};

// Show preset modal
async function showPresetModal() {
    const modal = document.getElementById('preset-modal');
    if (!modal) return;
    
    try {
        const result = await window.api.invoke('personality:get-presets');
        if (result.success) {
            renderPresetOptions(result.data);
            modal.style.display = 'flex';
        }
    } catch (error) {
        console.error('Failed to load presets:', error);
        window.api.showMessage('プリセットの読み込みに失敗しました', 'error');
    }
}

// Render preset options
function renderPresetOptions(presets) {
    const container = document.getElementById('preset-list');
    if (!container) return;
    
    container.innerHTML = presets.map(preset => `
        <div class="preset-item" onclick="applyPreset('${preset.id}')">
            <h4>${preset.name}</h4>
            <p>${preset.description}</p>
        </div>
    `).join('');
}

// Apply preset
window.applyPreset = async function(presetId) {
    try {
        const result = await window.api.invoke('personality:apply-preset', presetId);
        if (result.success) {
            window.api.showMessage('プリセットを適用しました', 'success');
            document.getElementById('preset-modal').style.display = 'none';
            loadPersonalities(); // Reload to show new assignments
        } else {
            window.api.showMessage('プリセットの適用に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to apply preset:', error);
        window.api.showMessage('プリセットの適用に失敗しました', 'error');
    }
};

// Subscribe to personality updates
function subscribeToPersonalityUpdates() {
    // Listen for personality switches
    window.api.on('personality:switched', (data) => {
        updatePersonalityDisplay({ [data.role]: data.newPersonality });
    });
    
    // Listen for preset applications
    window.api.on('preset:applied', () => {
        loadPersonalities();
    });
}

// Subscribe to agent updates
function subscribeToAgentUpdates() {
    // Listen for agent messages
    window.api.on('agents:message', (data) => {
        if (data.sessionId === currentSession?.id) {
            addAgentMessage(data.agentType, data.message);
            updateAgentStatus(data.agentType, 'idle');
            
            // Update plot elements if in plot creation mode
            if (isPlotCreationMode && data.plotElements) {
                updatePlotElementsFromAgent(data.plotElements);
            }
        }
    });
    
    // Listen for agent status updates
    window.api.on('agents:statusUpdate', (data) => {
        updateAgentStatus(data.agentType, data.status);
    });
    
    // Listen for session outputs
    window.api.on('agents:output', (data) => {
        if (data.sessionId === currentSession?.id) {
            addOutput(data);
        }
    });
    
    // Listen for plot updates
    window.api.on('agents:plotUpdated', (data) => {
        if (data.sessionId === currentSession?.id && isPlotCreationMode) {
            plotElements = data.plotElements;
            updatePlotElementsDisplay();
        }
    });
    
    // Listen for plot generation
    window.api.on('agents:plotGenerated', (data) => {
        if (data.sessionId === currentSession?.id) {
            handleGeneratedPlot(data.plot);
        }
    });
    
    // Listen for session end
    window.api.on('agents:sessionEnded', (data) => {
        if (data.sessionId === currentSession?.id) {
            endSession();
        }
    });
}

// UI Update Functions

function enableSessionControls() {
    document.getElementById('user-input').disabled = false;
    document.getElementById('send-message').disabled = false;
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.disabled = false;
    });
    document.getElementById('start-session').textContent = 'セッション終了';
    document.getElementById('start-session').onclick = endSession;
}

function disableSessionControls() {
    document.getElementById('user-input').disabled = true;
    document.getElementById('send-message').disabled = true;
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.disabled = true;
    });
    document.getElementById('start-session').textContent = 'セッション開始';
    document.getElementById('start-session').onclick = startSession;
}

function updateSessionStatus(status) {
    document.getElementById('session-status').textContent = status;
}

function updateAgentStatus(agentType, status) {
    const agentCard = document.querySelector(`[data-agent-type="${agentType}"]`);
    if (agentCard) {
        const statusElement = agentCard.querySelector('.agent-status');
        statusElement.dataset.status = status;
        statusElement.querySelector('.status-text').textContent = getStatusText(status);
    }
}

function getStatusText(status) {
    const statusTexts = {
        idle: '待機中',
        thinking: '思考中',
        responding: '応答中',
        error: 'エラー',
        waiting: '待機中',
        shutdown: 'オフライン'
    };
    return statusTexts[status] || status;
}

// Chat message functions

function clearChatMessages() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.innerHTML = '';
}

function addSystemMessage(text, type = 'info') {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-text system-${type}">${text}</div>
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function addUserMessage(text) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="message-avatar">👤</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">あなた</span>
                <span class="message-time">${getCurrentTime()}</span>
            </div>
            <div class="message-text">${escapeHtml(text)}</div>
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    updateMessageCount();
}

function addAgentMessage(agentType, text) {
    const messagesContainer = document.getElementById('chat-messages');
    const agentInfo = getAgentInfo(agentType);
    
    // Update agent status to responding
    updateAgentStatus(agentType, 'responding');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message agent';
    messageDiv.innerHTML = `
        <div class="message-avatar">${agentInfo.emoji}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-sender">${agentInfo.name}</span>
                <span class="message-time">${getCurrentTime()}</span>
            </div>
            <div class="message-text">${escapeHtml(text)}</div>
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
    updateMessageCount();
    
    // Return to idle after a delay
    setTimeout(() => {
        updateAgentStatus(agentType, 'idle');
    }, 1000);
}

function getAgentInfo(agentType) {
    const agentCard = document.querySelector(`[data-agent-type="${agentType}"]`);
    const personalityName = agentCard?.querySelector('.agent-personality')?.textContent;
    
    // Handle custom agents
    if (agentType.startsWith('custom_')) {
        const customAgentCard = agentCard;
        if (customAgentCard) {
            const name = customAgentCard.querySelector('.agent-info h4')?.textContent || 'カスタムエージェント';
            const avatar = customAgentCard.querySelector('.agent-avatar')?.textContent || '🤖';
            return { name, emoji: avatar };
        }
        return { name: 'カスタムエージェント', emoji: '🤖' };
    }
    
    const defaultAgents = {
        deputy_editor: { name: '副編集長AI', emoji: '👔' },
        writer: { name: '作家AI', emoji: '✍️' },
        editor: { name: '編集者AI', emoji: '📝' },
        proofreader: { name: '校正AI', emoji: '🔍' }
    };
    
    const agent = defaultAgents[agentType] || { name: 'Unknown Agent', emoji: '🤖' };
    
    // Use personality name if available
    if (personalityName && personalityName !== '-') {
        agent.name = personalityName;
    }
    
    return agent;
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Session timer

function startSessionTimer() {
    elapsedSeconds = 0;
    updateTimerDisplay();
    document.getElementById('session-timer').style.display = 'inline';
    
    sessionTimer = setInterval(() => {
        elapsedSeconds++;
        updateTimerDisplay();
    }, 1000);
}

function stopSessionTimer() {
    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('session-timer').textContent = display;
}

// Output management

function addOutput(outputData) {
    outputItems.push(outputData);
    updateOutputList();
    updateOutputCount();
}

function updateOutputList() {
    const outputList = document.getElementById('output-list');
    
    if (outputItems.length === 0) {
        outputList.innerHTML = '<p class="empty-state">まだコンテンツがありません</p>';
        return;
    }
    
    outputList.innerHTML = outputItems.map((item, index) => `
        <div class="output-item" onclick="showOutput(${index})">
            <div class="output-item-title">${item.title}</div>
            <div class="output-item-preview">${item.preview}</div>
        </div>
    `).join('');
}

// Session history

function addToSessionHistory(session) {
    const historyList = document.getElementById('session-history');
    const historyItem = document.createElement('div');
    historyItem.className = 'session-item';
    historyItem.innerHTML = `
        <div class="session-item-header">
            <span class="session-item-type">${getSessionTypeLabel(session.type)}</span>
            <span class="session-item-date">${new Date().toLocaleDateString('ja-JP')}</span>
        </div>
        <div class="session-item-summary">
            ${session.participants.length}エージェント • ${session.messageCount}メッセージ
        </div>
    `;
    
    // Remove empty state if exists
    const emptyState = historyList.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    // Add to top of list
    historyList.insertBefore(historyItem, historyList.firstChild);
}

// End session

async function endSession() {
    if (!currentSession) return;
    
    try {
        await window.api.invoke('agents:endSession', {
            sessionId: currentSession.id
        });
        
        // Update UI
        stopSessionTimer();
        updateSessionStatus('セッション終了');
        disableSessionControls();
        
        // Add to history
        addToSessionHistory({
            ...currentSession,
            messageCount: parseInt(document.getElementById('message-count').textContent)
        });
        
        // Reset agent statuses
        document.querySelectorAll('.agent-card').forEach(card => {
            updateAgentStatus(card.dataset.agentType, 'idle');
        });
        
        // Reset plot creation mode UI
        if (isPlotCreationMode) {
            document.getElementById('plot-elements-panel').style.display = 'none';
            document.getElementById('default-actions').style.display = 'flex';
            document.getElementById('plot-actions').style.display = 'none';
            isPlotCreationMode = false;
        }
        
        currentSession = null;
        addSystemMessage('セッションが終了しました');
        
    } catch (error) {
        console.error('Failed to end session:', error);
        window.api.showMessage('セッションの終了に失敗しました', 'error');
    }
}

// Utility functions

function getSessionTypeLabel(type) {
    const labels = {
        plot_creation: 'プロット作成モード',
        plot_development: 'プロット開発',
        chapter_writing: '章執筆',
        character_development: 'キャラクター開発',
        review_discussion: 'レビューディスカッション',
        brainstorming: 'ブレインストーミング'
    };
    return labels[type] || type;
}

function getCurrentTime() {
    return new Date().toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateMessageCount() {
    const count = document.querySelectorAll('.message.user, .message.agent').length;
    document.getElementById('message-count').textContent = count;
}

function updateOutputCount() {
    const ideaCount = outputItems.filter(item => item.type === 'idea').length;
    document.getElementById('idea-count').textContent = ideaCount;
}

// Output modal functions

window.showOutput = function(index) {
    const output = outputItems[index];
    if (!output) return;
    
    document.getElementById('output-title').textContent = output.title;
    document.getElementById('output-content').innerHTML = `
        <pre>${escapeHtml(output.content)}</pre>
    `;
    document.getElementById('output-modal').style.display = 'flex';
    
    // Store current output for save/copy functions
    window.currentOutput = output;
};

window.hideOutputModal = function() {
    document.getElementById('output-modal').style.display = 'none';
    window.currentOutput = null;
};

window.saveOutput = async function() {
    if (!window.currentOutput) return;
    
    try {
        await window.api.invoke('agents:saveOutput', {
            projectId: document.getElementById('project-selector').value,
            output: window.currentOutput
        });
        window.api.showMessage('出力を保存しました', 'success');
    } catch (error) {
        console.error('Failed to save output:', error);
        window.api.showMessage('保存に失敗しました', 'error');
    }
};

window.copyOutput = function() {
    if (!window.currentOutput) return;
    
    navigator.clipboard.writeText(window.currentOutput.content)
        .then(() => {
            window.api.showMessage('クリップボードにコピーしました', 'success');
        })
        .catch(() => {
            window.api.showMessage('コピーに失敗しました', 'error');
        });
};

// Plot creation functions

function initializePlotElements() {
    plotElements = {
        themes: [],
        premise: null,
        characters: [],
        setting: null,
        conflicts: [],
        structure: null,
        keyScenes: []
    };
    updatePlotElementsDisplay();
    enablePlotCreationFeatures();
}

// Enable plot creation specific features
function enablePlotCreationFeatures() {
    // Add plot suggestion system
    addPlotSuggestionButtons();
    
    // Enable plot element editing
    enablePlotElementEditing();
    
    // Initialize plot progress tracking
    initializePlotProgress();
}

// Add plot suggestion buttons
function addPlotSuggestionButtons() {
    const plotElementsSections = document.querySelectorAll('.plot-element-section');
    
    plotElementsSections.forEach(section => {
        // Skip if buttons already added
        if (section.querySelector('.plot-element-buttons')) return;
        
        const title = section.querySelector('h5').textContent;
        
        // Add suggestion button
        const suggestionBtn = document.createElement('button');
        suggestionBtn.className = 'plot-suggestion-btn';
        suggestionBtn.innerHTML = '💡 提案を依頼';
        suggestionBtn.onclick = () => requestPlotSuggestion(title);
        
        // Add edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'plot-edit-btn';
        editBtn.innerHTML = '✏️ 編集';
        editBtn.onclick = () => editPlotElement(title);
        
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'plot-element-buttons';
        buttonGroup.appendChild(suggestionBtn);
        buttonGroup.appendChild(editBtn);
        
        section.appendChild(buttonGroup);
    });
}

// Request plot suggestion from AI
async function requestPlotSuggestion(elementType) {
    if (!currentSession) return;
    
    const suggestions = {
        'テーマ': 'この物語の核となるテーマについて、読者の心に響く深いテーマを提案してください。',
        '前提・プレミス': 'この物語の基本的な前提やプレミスについて、魅力的なアイデアを提案してください。',
        'キャラクター': '印象的で魅力的なキャラクターについて、詳細な設定とともに提案してください。',
        '設定・世界観': 'この物語の舞台となる世界観や設定について、詳細で魅力的なアイデアを提案してください。',
        '対立・コンフリクト': '物語を動かす中心的な対立やコンフリクトについて、緊張感のあるアイデアを提案してください。'
    };
    
    const message = suggestions[elementType] || `${elementType}について提案してください。`;
    
    // Auto-fill the input and send
    document.getElementById('user-input').value = message;
    await sendMessage();
}

// Edit plot element
function editPlotElement(elementType) {
    const elementId = getPlotElementId(elementType);
    const contentElement = document.getElementById(elementId);
    const currentContent = extractPlotElementContent(contentElement);
    
    const modal = createEditModal(elementType, currentContent);
    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

// Get plot element ID from type
function getPlotElementId(elementType) {
    const mapping = {
        'テーマ': 'plot-themes',
        '前提・プレミス': 'plot-premise',
        'キャラクター': 'plot-characters',
        '設定・世界観': 'plot-setting',
        '対立・コンフリクト': 'plot-conflicts'
    };
    return mapping[elementType] || null;
}

// Extract current content from plot element
function extractPlotElementContent(contentElement) {
    if (!contentElement) return '';
    
    const items = contentElement.querySelectorAll('.plot-element-item');
    if (items.length > 0) {
        return Array.from(items).map(item => item.textContent.trim()).join('\n');
    }
    
    const textContent = contentElement.textContent.trim();
    return textContent.includes('未設定です') ? '' : textContent;
}

// Create edit modal for plot elements
function createEditModal(elementType, currentContent) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${elementType}を編集</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <textarea id="plot-edit-content" rows="8" style="width: 100%; resize: vertical; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">${currentContent}</textarea>
                <p style="font-size: 12px; color: #666; margin-top: 8px;">
                    ヒント: 複数の項目がある場合は、改行で区切ってください。
                </p>
            </div>
            <div class="modal-actions">
                <button class="primary-btn" onclick="savePlotElement('${elementType}', this.closest('.modal'))">保存</button>
                <button class="secondary-btn" onclick="this.closest('.modal').remove()">キャンセル</button>
            </div>
        </div>
    `;
    return modal;
}

// Initialize plot progress tracking
function initializePlotProgress() {
    // Skip if already exists
    if (document.getElementById('plot-progress')) return;
    
    const progressContainer = document.createElement('div');
    progressContainer.id = 'plot-progress';
    progressContainer.className = 'plot-progress';
    progressContainer.innerHTML = `
        <h5>プロット進捗</h5>
        <div class="progress-items">
            <div class="progress-item" data-element="themes">
                <span class="progress-icon">🎭</span>
                <span class="progress-label">テーマ</span>
                <span class="progress-status">未完了</span>
            </div>
            <div class="progress-item" data-element="premise">
                <span class="progress-icon">📝</span>
                <span class="progress-label">前提</span>
                <span class="progress-status">未完了</span>
            </div>
            <div class="progress-item" data-element="characters">
                <span class="progress-icon">👥</span>
                <span class="progress-label">キャラクター</span>
                <span class="progress-status">未完了</span>
            </div>
            <div class="progress-item" data-element="setting">
                <span class="progress-icon">🌍</span>
                <span class="progress-label">設定</span>
                <span class="progress-status">未完了</span>
            </div>
            <div class="progress-item" data-element="conflicts">
                <span class="progress-icon">⚡</span>
                <span class="progress-label">対立</span>
                <span class="progress-status">未完了</span>
            </div>
        </div>
        <div class="plot-completion">
            <div class="completion-bar">
                <div class="completion-fill" style="width: 0%"></div>
            </div>
            <span class="completion-text">0% 完了</span>
        </div>
    `;
    
    const plotElementsPanel = document.getElementById('plot-elements-panel');
    if (plotElementsPanel) {
        plotElementsPanel.insertBefore(progressContainer, plotElementsPanel.firstChild);
    }
}

// Save plot element
window.savePlotElement = function(elementType, modal) {
    const content = modal.querySelector('#plot-edit-content').value.trim();
    
    // Update plot elements object
    if (elementType === 'テーマ') {
        plotElements.themes = content ? content.split('\n').filter(c => c.trim()) : [];
    } else if (elementType === '前提・プレミス') {
        plotElements.premise = content ? { description: content } : null;
    } else if (elementType === 'キャラクター') {
        plotElements.characters = content ? content.split('\n').filter(c => c.trim()).map(c => ({ name: c.trim() })) : [];
    } else if (elementType === '設定・世界観') {
        plotElements.setting = content ? { description: content } : null;
    } else if (elementType === '対立・コンフリクト') {
        plotElements.conflicts = content ? content.split('\n').filter(c => c.trim()).map(c => ({ description: c.trim() })) : [];
    }
    
    updatePlotElementsDisplay();
    updatePlotProgress();
    modal.remove();
    
    // Save to session if active
    if (currentSession) {
        savePlotElementsToSession();
    }
};

// Save plot elements to session
async function savePlotElementsToSession() {
    try {
        const result = window.api ? 
            await window.api.invoke('agents:updatePlotElements', {
                sessionId: currentSession.id,
                plotElements: plotElements
            }) :
            await window.mockAPI.invoke('agents:updatePlotElements', {
                sessionId: currentSession.id,
                plotElements: plotElements
            });
        
        if (result && result.success) {
            console.log('Plot elements saved successfully');
        }
    } catch (error) {
        console.error('Failed to save plot elements:', error);
    }
}

// Update plot progress
function updatePlotProgress() {
    const progressItems = document.querySelectorAll('.progress-item');
    if (progressItems.length === 0) return;
    
    let completedCount = 0;
    
    progressItems.forEach(item => {
        const element = item.dataset.element;
        const status = item.querySelector('.progress-status');
        let isCompleted = false;
        
        switch(element) {
            case 'themes':
                isCompleted = plotElements.themes && plotElements.themes.length > 0;
                break;
            case 'premise':
                isCompleted = plotElements.premise && plotElements.premise.description && plotElements.premise.description.trim() !== '';
                break;
            case 'characters':
                isCompleted = plotElements.characters && plotElements.characters.length > 0;
                break;
            case 'setting':
                isCompleted = plotElements.setting && plotElements.setting.description && plotElements.setting.description.trim() !== '';
                break;
            case 'conflicts':
                isCompleted = plotElements.conflicts && plotElements.conflicts.length > 0;
                break;
        }
        
        if (isCompleted) {
            item.classList.add('completed');
            status.textContent = '完了';
            completedCount++;
        } else {
            item.classList.remove('completed');
            status.textContent = '未完了';
        }
    });
    
    // Update completion bar
    const completionPercentage = (completedCount / progressItems.length) * 100;
    const completionFill = document.querySelector('.completion-fill');
    const completionText = document.querySelector('.completion-text');
    
    if (completionFill && completionText) {
        completionFill.style.width = `${completionPercentage}%`;
        completionText.textContent = `${Math.round(completionPercentage)}% 完了`;
    }
    
    // Enable plot generation if sufficient progress
    const generateBtn = document.getElementById('generate-plot-btn');
    if (generateBtn) {
        generateBtn.disabled = completionPercentage < 60; // Require at least 3/5 elements
        if (completionPercentage >= 60) {
            generateBtn.innerHTML = '<span class="icon">📋</span> プロット生成';
        } else {
            generateBtn.innerHTML = `<span class="icon">✨</span> プロット生成 (${Math.round(completionPercentage)}% 完了)`;
        }
    }
}

// Enable plot element editing (placeholder for future enhancement)
function enablePlotElementEditing() {
    // Additional editing features can be added here
    console.log('Plot element editing enabled');
}

function updatePlotElementsFromAgent(agentPlotElements) {
    // This is handled by the coordinator, but we can show immediate feedback
    if (agentPlotElements.themes && agentPlotElements.themes.length > 0) {
        addSystemMessage(`エージェントがテーマを提案しました: ${agentPlotElements.themes.join(', ')}`);
    }
    if (agentPlotElements.premise) {
        addSystemMessage(`エージェントが前提を提案しました: ${agentPlotElements.premise.title || agentPlotElements.premise.description}`);
    }
    if (agentPlotElements.characters && agentPlotElements.characters.length > 0) {
        addSystemMessage(`エージェントがキャラクターを提案しました`);
    }
}

function updatePlotElementsDisplay() {
    // Update themes
    const themesContainer = document.getElementById('plot-themes');
    if (themesContainer) {
        if (plotElements.themes.length > 0) {
            themesContainer.innerHTML = plotElements.themes.map(theme => 
                `<div class="plot-element-item">${theme}</div>`
            ).join('');
        } else {
            themesContainer.innerHTML = '<p class="empty-state">テーマが未設定です</p>';
        }
    }
    
    // Update premise
    const premiseContainer = document.getElementById('plot-premise');
    if (premiseContainer) {
        if (plotElements.premise && plotElements.premise.description) {
            premiseContainer.innerHTML = `
                <div class="plot-element-item">
                    ${plotElements.premise.title ? `<strong>${plotElements.premise.title}</strong><br>` : ''}
                    ${plotElements.premise.description}
                </div>
            `;
        } else {
            premiseContainer.innerHTML = '<p class="empty-state">前提が未設定です</p>';
        }
    }
    
    // Update characters
    const charactersContainer = document.getElementById('plot-characters');
    if (charactersContainer) {
        if (plotElements.characters.length > 0) {
            charactersContainer.innerHTML = plotElements.characters.map(char => 
                `<div class="plot-element-item">
                    <strong>${char.name}</strong>
                    ${char.role ? ` - ${char.role}` : ''}
                    ${char.arc ? `<br><small>${char.arc}</small>` : ''}
                </div>`
            ).join('');
        } else {
            charactersContainer.innerHTML = '<p class="empty-state">キャラクターが未設定です</p>';
        }
    }
    
    // Update setting
    const settingContainer = document.getElementById('plot-setting');
    if (settingContainer) {
        if (plotElements.setting && plotElements.setting.description) {
            settingContainer.innerHTML = `
                <div class="plot-element-item">
                    ${plotElements.setting.description}
                    ${plotElements.setting.atmosphere ? `<br><small>雰囲気: ${plotElements.setting.atmosphere}</small>` : ''}
                </div>
            `;
        } else {
            settingContainer.innerHTML = '<p class="empty-state">設定が未設定です</p>';
        }
    }
    
    // Update conflicts
    const conflictsContainer = document.getElementById('plot-conflicts');
    if (conflictsContainer) {
        if (plotElements.conflicts.length > 0) {
            conflictsContainer.innerHTML = plotElements.conflicts.map(conflict => 
                `<div class="plot-element-item">
                    ${conflict.description}
                    ${conflict.type ? `<br><small>種類: ${conflict.type}</small>` : ''}
                </div>`
            ).join('');
        } else {
            conflictsContainer.innerHTML = '<p class="empty-state">対立が未設定です</p>';
        }
    }
    
    // Update progress if the progress tracker exists
    updatePlotProgress();
}

function handleGeneratedPlot(plot) {
    // Show the generated plot
    const plotOutput = {
        type: 'plot',
        title: plot.title || 'Generated Plot',
        preview: plot.premise || 'A new plot has been generated',
        content: JSON.stringify(plot, null, 2)
    };
    
    addOutput(plotOutput);
    
    // Show success message
    addSystemMessage('プロットが正常に生成されました！「生成されたコンテンツ」セクションで確認できます。');
    
    // Option to save the plot
    if (window.confirm('生成されたプロットを保存しますか？')) {
        saveGeneratedPlot(plot);
    }
}

async function saveGeneratedPlot(plot) {
    try {
        const projectId = document.getElementById('project-selector').value;
        if (!projectId) {
            window.api.showMessage('プロジェクトが選択されていません', 'warning');
            return;
        }
        
        await window.api.invoke('plot:create', {
            ...plot,
            projectId: projectId
        });
        
        window.api.showMessage('プロットが保存されました', 'success');
        
        // If in workflow mode, show transition to writing
        if (currentWorkflow) {
            showWritingTransition();
        }
    } catch (error) {
        console.error('Failed to save plot:', error);
        window.api.showMessage('プロットの保存に失敗しました', 'error');
    }
}

// Check workflow context from URL params
function checkWorkflowContext() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');
    const workflowId = urlParams.get('workflowId');
    const autoStart = urlParams.get('autoStart') === 'true';
    
    if (projectId && workflowId) {
        // Set project selector
        document.getElementById('project-selector').value = projectId;
        
        // Load workflow context
        loadWorkflow(workflowId);
        
        if (autoStart) {
            // Auto-start plot creation session
            setTimeout(() => {
                document.getElementById('session-type').value = 'plot_creation';
                handleSessionTypeChange({ target: { value: 'plot_creation' } });
                
                // Select all agents
                document.querySelectorAll('.participant-checkboxes input').forEach(cb => {
                    cb.checked = true;
                });
                
                // Start session
                startSession();
            }, 1000);
        }
    }
}

// Load workflow
async function loadWorkflow(workflowId) {
    try {
        const response = await window.api.invoke('workflow:get', { workflowId });
        if (response.success) {
            currentWorkflow = response.data;
            updateWorkflowIndicator();
        }
    } catch (error) {
        console.error('Failed to load workflow:', error);
    }
}

// Create workflow indicator
function createWorkflowIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'workflow-indicator';
    indicator.className = 'workflow-indicator';
    indicator.style.display = 'none';
    indicator.innerHTML = `
        <div class="workflow-header">
            <h3>ワークフロー進行状況</h3>
            <button class="close-btn" onclick="hideWorkflowIndicator()">×</button>
        </div>
        <div class="workflow-phases">
            <div class="phase" data-phase="project_setup">
                <div class="phase-icon">✓</div>
                <div class="phase-name">プロジェクト設定</div>
            </div>
            <div class="phase-connector"></div>
            <div class="phase" data-phase="plot_creation">
                <div class="phase-icon">📝</div>
                <div class="phase-name">プロット作成</div>
            </div>
            <div class="phase-connector"></div>
            <div class="phase" data-phase="writing_session">
                <div class="phase-icon">✍️</div>
                <div class="phase-name">執筆</div>
            </div>
            <div class="phase-connector"></div>
            <div class="phase" data-phase="review_refinement">
                <div class="phase-icon">🔍</div>
                <div class="phase-name">レビュー</div>
            </div>
            <div class="phase-connector"></div>
            <div class="phase" data-phase="complete">
                <div class="phase-icon">🎉</div>
                <div class="phase-name">完了</div>
            </div>
        </div>
        <div class="workflow-controls">
            <button id="pause-workflow-btn" class="secondary-btn" style="display: none;">
                一時停止
            </button>
            <button id="resume-workflow-btn" class="secondary-btn" style="display: none;">
                再開
            </button>
        </div>
        <div class="workflow-progress">
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text">0% 完了</div>
        </div>
    `;
    
    document.body.appendChild(indicator);
    workflowIndicator = indicator;
    
    // Add styles
    if (!document.getElementById('workflow-indicator-styles')) {
        const style = document.createElement('style');
        style.id = 'workflow-indicator-styles';
        style.textContent = `
            .workflow-indicator {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 600px;
                background: var(--bg-primary);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                padding: 1rem;
            }
            
            .workflow-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }
            
            .workflow-header h3 {
                margin: 0;
                font-size: 1.1rem;
            }
            
            .workflow-header .close-btn {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: var(--text-secondary);
            }
            
            .workflow-phases {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 1rem;
            }
            
            .phase {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.5rem;
                opacity: 0.5;
                transition: opacity 0.3s;
            }
            
            .phase.completed {
                opacity: 1;
            }
            
            .phase.completed .phase-icon {
                background: var(--success);
                color: white;
            }
            
            .phase.in-progress {
                opacity: 1;
            }
            
            .phase.in-progress .phase-icon {
                background: var(--primary);
                color: white;
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
            
            .phase-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: var(--bg-secondary);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
            }
            
            .phase-name {
                font-size: 0.8rem;
                text-align: center;
                color: var(--text-secondary);
            }
            
            .phase-connector {
                flex: 1;
                height: 2px;
                background: var(--border-color);
                margin: 0 -0.5rem;
                margin-bottom: 2rem;
            }
            
            .workflow-controls {
                display: flex;
                gap: 0.5rem;
                margin-bottom: 1rem;
            }
            
            .workflow-progress {
                margin-top: 1rem;
            }
            
            .progress-bar {
                height: 8px;
                background: var(--bg-secondary);
                border-radius: 4px;
                overflow: hidden;
            }
            
            .progress-fill {
                height: 100%;
                background: var(--primary);
                transition: width 0.3s;
            }
            
            .progress-text {
                text-align: center;
                margin-top: 0.5rem;
                font-size: 0.9rem;
                color: var(--text-secondary);
            }
        `;
        document.head.appendChild(style);
    }
}

// Update workflow indicator
function updateWorkflowIndicator() {
    if (!currentWorkflow || !workflowIndicator) return;
    
    workflowIndicator.style.display = 'block';
    
    // Update phase statuses
    Object.entries(currentWorkflow.phases).forEach(([phase, data]) => {
        const phaseElement = workflowIndicator.querySelector(`[data-phase="${phase}"]`);
        if (phaseElement) {
            phaseElement.classList.remove('completed', 'in-progress');
            if (data.status === 'completed') {
                phaseElement.classList.add('completed');
            } else if (data.status === 'in_progress') {
                phaseElement.classList.add('in-progress');
            }
        }
    });
    
    // Update progress
    const totalPhases = Object.keys(currentWorkflow.phases).length;
    const completedPhases = Object.values(currentWorkflow.phases).filter(p => p.status === 'completed').length;
    const progress = Math.round((completedPhases / totalPhases) * 100);
    
    workflowIndicator.querySelector('.progress-fill').style.width = `${progress}%`;
    workflowIndicator.querySelector('.progress-text').textContent = `${progress}% 完了`;
    
    // Update controls
    const pauseBtn = workflowIndicator.querySelector('#pause-workflow-btn');
    const resumeBtn = workflowIndicator.querySelector('#resume-workflow-btn');
    
    if (currentWorkflow.paused) {
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'block';
    } else if (currentWorkflow.currentPhase !== 'complete') {
        pauseBtn.style.display = 'block';
        resumeBtn.style.display = 'none';
    } else {
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
    }
}

// Hide workflow indicator
window.hideWorkflowIndicator = function() {
    if (workflowIndicator) {
        workflowIndicator.style.display = 'none';
    }
};

// Show writing transition
function showWritingTransition() {
    const transitionModal = document.createElement('div');
    transitionModal.className = 'modal writing-transition';
    transitionModal.style.display = 'flex';
    transitionModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>プロット作成完了！</h2>
            </div>
            <div class="modal-body">
                <div class="transition-message">
                    <p>プロットが正常に生成され、保存されました。</p>
                    <p>次は、このプロットに基づいて章の執筆を開始できます。</p>
                </div>
                <div class="transition-options">
                    <h3>執筆オプション</h3>
                    <p>AIエージェントが自動的に各章を執筆し、議論しながら物語を完成させます。</p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="closeTransitionModal()">
                    後で開始
                </button>
                <button id="start-writing-btn" class="primary-btn">
                    執筆を開始
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(transitionModal);
    
    // Add event listener
    document.getElementById('start-writing-btn').addEventListener('click', async () => {
        closeTransitionModal();
        await startWritingPhase();
    });
}

// Close transition modal
window.closeTransitionModal = function() {
    document.querySelector('.writing-transition')?.remove();
};

// Start writing phase
async function startWritingPhase() {
    if (!currentWorkflow) return;
    
    try {
        // Transition workflow to writing phase
        const response = await window.api.invoke('workflow:transition', {
            workflowId: currentWorkflow.id
        });
        
        if (response.success) {
            currentWorkflow = response.data;
            updateWorkflowIndicator();
            
            // End current session
            if (currentSession) {
                await endSession();
            }
            
            // Start new writing session
            document.getElementById('session-type').value = 'chapter_writing';
            handleSessionTypeChange({ target: { value: 'chapter_writing' } });
            
            // Select appropriate agents for writing
            document.querySelectorAll('.participant-checkboxes input').forEach(cb => {
                cb.checked = ['writer', 'editor', 'deputy_editor'].includes(cb.value);
            });
            
            // Start session
            await startSession();
            
            addSystemMessage('執筆フェーズが開始されました。AIエージェントが章の執筆を開始します。');
        }
    } catch (error) {
        console.error('Failed to start writing phase:', error);
        window.api.showMessage('執筆フェーズの開始に失敗しました', 'error');
    }
}

// Pause workflow
async function pauseWorkflow() {
    if (!currentWorkflow) return;
    
    try {
        const response = await window.api.invoke('workflow:pause', {
            workflowId: currentWorkflow.id
        });
        
        if (response.success) {
            currentWorkflow.paused = true;
            updateWorkflowIndicator();
            window.api.showMessage('ワークフローを一時停止しました', 'info');
        }
    } catch (error) {
        console.error('Failed to pause workflow:', error);
        window.api.showMessage('ワークフローの一時停止に失敗しました', 'error');
    }
}

// Resume workflow
async function resumeWorkflow() {
    if (!currentWorkflow) return;
    
    try {
        const response = await window.api.invoke('workflow:resume', {
            workflowId: currentWorkflow.id
        });
        
        if (response.success) {
            currentWorkflow.paused = false;
            updateWorkflowIndicator();
            window.api.showMessage('ワークフローを再開しました', 'info');
        }
    } catch (error) {
        console.error('Failed to resume workflow:', error);
        window.api.showMessage('ワークフローの再開に失敗しました', 'error');
    }
}

// Subscribe to workflow updates
function subscribeToWorkflowUpdates() {
    // Listen for workflow phase transitions
    window.api.on('workflow:phase-transitioned', (data) => {
        if (currentWorkflow && data.workflowId === currentWorkflow.id) {
            currentWorkflow = data.workflow;
            updateWorkflowIndicator();
            
            addSystemMessage(`ワークフローが「${getPhaseLabel(data.toPhase)}」フェーズに移行しました`);
        }
    });
    
    // Listen for plot completion
    window.api.on('workflow:plot-completed', (data) => {
        if (currentWorkflow && data.workflowId === currentWorkflow.id) {
            showWritingTransition();
        }
    });
    
    // Listen for chapter completion
    window.api.on('workflow:chapter-completed', (data) => {
        if (currentWorkflow && data.workflowId === currentWorkflow.id) {
            addSystemMessage(`章 ${data.chapterNumber} が完成しました (進捗: ${Math.round(data.progress)}%)`);
            
            // Update progress in workflow
            if (currentWorkflow.phases.writing_session) {
                currentWorkflow.phases.writing_session.chaptersCompleted = data.chapterNumber;
            }
            updateWorkflowIndicator();
        }
    });
    
    // Listen for workflow completion
    window.api.on('workflow:completed', (data) => {
        if (currentWorkflow && data.workflowId === currentWorkflow.id) {
            addSystemMessage('🎉 ワークフローが完了しました！すべてのフェーズが正常に終了しました。');
            currentWorkflow.currentPhase = 'complete';
            updateWorkflowIndicator();
            
            // Show completion modal
            showCompletionModal(data.stats);
        }
    });
}

// Get phase label
function getPhaseLabel(phase) {
    const labels = {
        project_setup: 'プロジェクト設定',
        plot_creation: 'プロット作成',
        writing_session: '執筆',
        review_refinement: 'レビューと改善',
        complete: '完了'
    };
    return labels[phase] || phase;
}

// Show completion modal
function showCompletionModal(stats) {
    const modal = document.createElement('div');
    modal.className = 'modal workflow-completion';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>🎉 プロジェクト完成！</h2>
            </div>
            <div class="modal-body">
                <div class="completion-stats">
                    <h3>プロジェクト統計</h3>
                    <div class="stat-item">
                        <span class="stat-label">総所要時間:</span>
                        <span class="stat-value">${formatDuration(stats.totalDuration)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">執筆した章数:</span>
                        <span class="stat-value">${stats.chaptersWritten}章</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">プロット作成時間:</span>
                        <span class="stat-value">${formatDuration(stats.plotCreationDuration)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">執筆時間:</span>
                        <span class="stat-value">${formatDuration(stats.writingDuration)}</span>
                    </div>
                </div>
                <div class="completion-message">
                    <p>おめでとうございます！AIエージェントとの協力により、小説プロジェクトが完成しました。</p>
                    <p>プロジェクトページから原稿を確認し、さらに編集することができます。</p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="primary-btn" onclick="navigateToProjects()">
                    プロジェクトページへ
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Navigate to projects page
window.navigateToProjects = function() {
    window.location.href = './projects.html';
};

// Load custom agents
async function loadCustomAgents() {
    try {
        const api = window.api || window.mockAPI;
        const response = await api.invoke('agent:getCustom');
        
        if (response.success && response.data.length > 0) {
            displayCustomAgents(response.data);
        }
    } catch (error) {
        console.error('Failed to load custom agents:', error);
    }
}

// Display custom agents
function displayCustomAgents(customAgents) {
    const section = document.getElementById('custom-agents-section');
    const grid = document.getElementById('custom-agents-grid');
    
    if (!section || !grid) return;
    
    // Clear existing custom agents
    grid.innerHTML = '';
    
    // Add custom agent cards
    customAgents.forEach(agent => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        card.dataset.agentType = `custom_${agent.id}`;
        card.dataset.customAgentId = agent.id;
        
        card.innerHTML = `
            <div class="agent-avatar">${agent.avatar || '🤖'}</div>
            <div class="agent-info">
                <h4>${escapeHtml(agent.name)}</h4>
                <p class="agent-role">${escapeHtml(agent.role)}</p>
                <p class="agent-personality">${escapeHtml(agent.personalityDescription || agent.traits.join('、') || '-')}</p>
                <div class="agent-status" data-status="idle">
                    <span class="status-indicator"></span>
                    <span class="status-text">待機中</span>
                </div>
                <button class="delete-agent-btn" onclick="deleteCustomAgent('${agent.id}', event)" title="削除">
                    ❌
                </button>
            </div>
        `;
        
        // Add click handler for agent switching
        card.addEventListener('click', handleAgentClick);
        card.style.cursor = 'pointer';
        card.title = 'クリックしてエージェントを切り替え';
        
        grid.appendChild(card);
    });
    
    // Show the custom agents section
    section.style.display = 'block';
    
    // Add custom agents to participant checkboxes
    const participantCheckboxes = document.querySelector('.participant-checkboxes');
    if (participantCheckboxes) {
        // Remove existing custom agent checkboxes
        const existingCustomCheckboxes = participantCheckboxes.querySelectorAll('[data-custom]');
        existingCustomCheckboxes.forEach(cb => cb.remove());
        
        // Add new custom agent checkboxes
        customAgents.forEach(agent => {
            const label = document.createElement('label');
            label.dataset.custom = 'true';
            label.innerHTML = `<input type="checkbox" value="custom_${agent.id}"> ${escapeHtml(agent.name)}`;
            participantCheckboxes.appendChild(label);
        });
    }
}

// Delete custom agent
async function deleteCustomAgent(agentId, event) {
    // Stop propagation to prevent card click
    if (event) {
        event.stopPropagation();
    }
    
    if (!confirm('このカスタムエージェントを削除しますか？')) {
        return;
    }
    
    try {
        const api = window.api || window.mockAPI;
        const response = await api.invoke('agent:delete', agentId);
        
        if (response.success) {
            showMessage('カスタムエージェントを削除しました', 'success');
            await loadCustomAgents(); // Reload agents
        } else {
            showMessage('削除に失敗しました', 'error');
        }
    } catch (error) {
        console.error('Failed to delete custom agent:', error);
        showMessage('削除に失敗しました', 'error');
    }
}

// Make deleteCustomAgent globally available
window.deleteCustomAgent = deleteCustomAgent;

// Show message helper
function showMessage(message, type = 'info') {
    const api = window.api || window.mockAPI;
    if (api && api.showMessage) {
        api.showMessage(message, type);
    } else {
        // Fallback to console or alert
        console.log(`[${type}] ${message}`);
    }
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format duration
function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}時間${minutes % 60}分`;
    } else {
        return `${minutes}分${seconds % 60}秒`;
    }
}

// Handle navigation
function handleNavigation(e) {
    e.preventDefault();
    const page = e.currentTarget.dataset.page;
    
    switch (page) {
        case 'agent-meeting':
            // Already on this page
            break;
        case 'projects':
            window.location.href = './projects.html';
            break;
        case 'writing-editor':
            window.location.href = './writing-editor.html';
            break;
        case 'anything-box':
            window.location.href = './anything-box.html';
            break;
        case 'serendipity':
            window.location.href = './serendipity.html';
            break;
        case 'knowledge-graph':
            window.location.href = './knowledge-graph.html';
            break;
        case 'settings':
            window.location.href = './settings.html';
            break;
        default:
            console.log(`Navigation to ${page} not implemented`);
    }
}