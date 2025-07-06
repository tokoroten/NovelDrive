// Agent Meeting Room functionality

// Global state
let currentSession = null;
let sessionTimer = null;
let elapsedSeconds = 0;
let outputItems = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadProjectList();
    loadPersonalities();
    subscribeToAgentUpdates();
    subscribeToPersonalityUpdates();
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
    
    // Personality management
    document.getElementById('personality-settings-btn')?.addEventListener('click', showPersonalityModal);
    document.getElementById('apply-preset-btn')?.addEventListener('click', showPresetModal);
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });
}

// Load project list
async function loadProjectList() {
    try {
        const projects = await window.api.invoke('project:list');
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
        // Send message through IPC
        await window.api.invoke('agents:sendMessage', {
            sessionId: currentSession.id,
            message,
            role: 'user'
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

// Handle action buttons
async function handleActionButton(event) {
    const action = event.target.dataset.action;
    if (!currentSession) return;
    
    const actions = {
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
        }
    };
    
    const actionData = actions[action];
    if (actionData) {
        document.getElementById('user-input').value = actionData.message;
        await sendMessage();
    }
}

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
    
    const defaultAgents = {
        deputy_editor: { name: '副編集長AI', emoji: '👔' },
        writer: { name: '作家AI', emoji: '✍️' },
        editor: { name: '編集者AI', emoji: '📝' },
        proofreader: { name: '校正AI', emoji: '🔍' }
    };
    
    const agent = defaultAgents[agentType] || { name: 'Unknown Agent', emoji: '🤖' };
    
    // Use personality name if available
    if (personalityName) {
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