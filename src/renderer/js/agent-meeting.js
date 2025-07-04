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
    subscribeToAgentUpdates();
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
    const agents = {
        deputy_editor: { name: '副編集長AI', emoji: '👔' },
        writer: { name: '作家AI', emoji: '✍️' },
        editor: { name: '編集者AI', emoji: '📝' },
        proofreader: { name: '校正AI', emoji: '🔍' }
    };
    return agents[agentType] || { name: 'Unknown Agent', emoji: '🤖' };
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