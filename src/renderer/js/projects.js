// Projects page JavaScript

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeProjectsPage();
});

function initializeProjectsPage() {
    // Get initial state from global store
    const state = window.globalStore.getState();
    renderProjects(state.projects);
    
    // Subscribe to store changes
    window.globalStore.subscribe((state) => {
        renderProjects(state.projects);
    });
    
    // Setup event listeners
    setupEventListeners();
}

// Setup event listeners
function setupEventListeners() {
    // Create project button
    document.getElementById('create-project-btn').addEventListener('click', showCreateProjectModal);
    
    // Create project form
    document.getElementById('create-project-form').addEventListener('submit', handleCreateProject);
    
    // Edit project form
    document.getElementById('edit-project-form').addEventListener('submit', handleEditProject);
    
    // Navigation
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
}

// Refresh projects from backend
async function refreshProjects() {
    try {
        const response = await window.api.invoke('project:getAll');
        
        if (response.success) {
            // Update global store
            const state = window.globalStore.getState();
            state.setProjects(response.data);
        } else {
            console.error('Failed to load projects:', response.error);
            showError('プロジェクトの読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
        showError('プロジェクトの読み込みに失敗しました');
    }
}

// Render projects
function renderProjects(projects) {
    const container = document.getElementById('projects-container');
    const emptyState = document.getElementById('empty-state');
    
    if (!projects || projects.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    container.style.display = 'grid';
    emptyState.style.display = 'none';
    
    const state = window.globalStore.getState();
    const selectedProjectId = state.currentProjectId;
    
    container.innerHTML = projects.map(project => createProjectCard(project, selectedProjectId)).join('');
    
    // Add create new project card
    container.innerHTML += createEmptyProjectCard();
    
    // Add click handlers
    container.querySelectorAll('.project-card:not(.empty)').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                selectProject(card.dataset.projectId);
            }
        });
    });
    
    // Add event listener for empty project card with error handling
    const emptyCard = container.querySelector('.project-card.empty');
    if (emptyCard) {
        // Remove any existing listeners to prevent duplicates
        emptyCard.removeEventListener('click', showCreateProjectModal);
        emptyCard.addEventListener('click', showCreateProjectModal);
    }
}

// Create project card HTML
function createProjectCard(project, selectedProjectId) {
    const metadata = project.metadata ? JSON.parse(project.metadata) : {};
    const genre = metadata.genre || 'other';
    const targetLength = metadata.targetLength || 0;
    const currentLength = project.chapter_count * 2000; // Estimate
    const progress = targetLength > 0 ? Math.min(100, (currentLength / targetLength) * 100) : 0;
    
    return `
        <div class="project-card ${selectedProjectId === project.id ? 'active' : ''}" data-project-id="${project.id}">
            <div class="project-header">
                <div>
                    <h3 class="project-title">${escapeHtml(project.name)}</h3>
                    ${genre ? `<span class="project-genre genre-${genre}">${getGenreLabel(genre)}</span>` : ''}
                </div>
            </div>
            
            ${project.description ? `
                <p class="project-description">${escapeHtml(project.description)}</p>
            ` : ''}
            
            <div class="project-stats">
                <div class="stat-item">
                    <span class="stat-label">ナレッジ</span>
                    <span class="stat-value">${project.knowledge_count || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">キャラクター</span>
                    <span class="stat-value">${project.character_count || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">プロット</span>
                    <span class="stat-value">${project.plot_count || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">章</span>
                    <span class="stat-value">${project.chapter_count || 0}</span>
                </div>
            </div>
            
            ${targetLength > 0 ? `
                <div class="project-progress">
                    <div class="progress-info">
                        <span>進捗</span>
                        <span>${Math.floor(progress)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
            ` : ''}
            
            <div class="project-actions">
                <button class="secondary-btn" onclick="openProject('${project.id}')">
                    開く
                </button>
                <button class="secondary-btn" onclick="editProject('${project.id}')">
                    編集
                </button>
                ${project.plot_count === 0 ? `
                    <button class="primary-btn" onclick="startAIWorkflowForProject(${project.id}, '${escapeHtml(project.name)}')">
                        AI作成開始
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// Create empty project card
function createEmptyProjectCard() {
    return `
        <div class="project-card empty">
            <div class="empty-icon">➕</div>
            <div class="empty-text">新規プロジェクト</div>
        </div>
    `;
}

// Show create project modal
function showCreateProjectModal() {
    const modal = document.getElementById('create-project-modal');
    const nameInput = document.getElementById('project-name');
    
    // Reset form first
    document.getElementById('create-project-form').reset();
    
    // Show modal
    modal.style.display = 'flex';
    
    // Focus input after a small delay to ensure modal is visible
    setTimeout(() => {
        nameInput.focus();
    }, 100);
}

// Hide create project modal
function hideCreateProjectModal() {
    const modal = document.getElementById('create-project-modal');
    const form = document.getElementById('create-project-form');
    
    // Hide modal
    modal.style.display = 'none';
    
    // Reset form and clear any validation states
    form.reset();
    
    // Clear any error states on form inputs
    form.querySelectorAll('input, textarea, select').forEach(input => {
        input.classList.remove('error');
    });
}

// Handle create project form submission
async function handleCreateProject(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const projectData = {
        name: formData.get('name'),
        description: formData.get('description'),
        metadata: {
            genre: formData.get('genre'),
            targetLength: parseInt(formData.get('targetLength')) || 0,
            status: 'planning'
        }
    };
    
    try {
        const response = await window.api.invoke('project:create', projectData);
        
        if (response.success) {
            hideCreateProjectModal();
            
            // Update global store with new project
            const state = window.globalStore.getState();
            state.addProject(response.data);
            
            showSuccess('プロジェクトを作成しました');
            
            // Show AI workflow prompt
            showAIWorkflowPrompt(response.data.id, response.data.name);
        } else {
            showError(response.error.message || 'プロジェクトの作成に失敗しました');
        }
    } catch (error) {
        console.error('Failed to create project:', error);
        showError('プロジェクトの作成に失敗しました');
    }
}

// Show AI workflow prompt
function showAIWorkflowPrompt(projectId, projectName) {
    const promptModal = document.createElement('div');
    promptModal.className = 'modal ai-workflow-prompt';
    promptModal.style.display = 'flex';
    promptModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>AIワークフローを開始</h2>
            </div>
            <div class="modal-body">
                <div class="workflow-intro">
                    <p>プロジェクト「${escapeHtml(projectName)}」が作成されました！</p>
                    <p>AIエージェントと一緒に、プロット作成から執筆まで自動的に進めることができます。</p>
                </div>
                
                <div class="workflow-steps">
                    <div class="workflow-step">
                        <div class="step-number">1</div>
                        <div class="step-content">
                            <h3>プロット作成</h3>
                            <p>AIエージェントがテーマ、キャラクター、設定を議論してプロットを作成</p>
                        </div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">2</div>
                        <div class="step-content">
                            <h3>章の執筆</h3>
                            <p>プロットに基づいてAIエージェントが各章を執筆</p>
                        </div>
                    </div>
                    <div class="workflow-step">
                        <div class="step-number">3</div>
                        <div class="step-content">
                            <h3>レビューと改善</h3>
                            <p>編集者AIが原稿をレビューし、改善提案</p>
                        </div>
                    </div>
                </div>
                
                <div class="workflow-options">
                    <label class="checkbox-label">
                        <input type="checkbox" id="auto-transition" checked>
                        <span>各フェーズを自動的に進める</span>
                    </label>
                    <label class="form-label">
                        目標章数:
                        <input type="number" id="target-chapters" value="10" min="1" max="50">
                    </label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="secondary-btn" onclick="skipAIWorkflow()">
                    後で開始
                </button>
                <button class="primary-btn" onclick="startAIWorkflow(${projectId})">
                    AIワークフローを開始
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(promptModal);
    
    // Add styles for the workflow prompt
    if (!document.getElementById('workflow-prompt-styles')) {
        const style = document.createElement('style');
        style.id = 'workflow-prompt-styles';
        style.textContent = `
            .ai-workflow-prompt .modal-content {
                max-width: 600px;
                width: 90%;
            }
            
            .workflow-intro {
                margin-bottom: 2rem;
                text-align: center;
            }
            
            .workflow-intro p {
                margin: 0.5rem 0;
            }
            
            .workflow-steps {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                margin-bottom: 2rem;
            }
            
            .workflow-step {
                display: flex;
                align-items: start;
                gap: 1rem;
                padding: 1rem;
                background: var(--bg-secondary);
                border-radius: 8px;
            }
            
            .step-number {
                width: 32px;
                height: 32px;
                background: var(--primary);
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                flex-shrink: 0;
            }
            
            .step-content h3 {
                margin: 0 0 0.5rem 0;
                font-size: 1.1rem;
            }
            
            .step-content p {
                margin: 0;
                color: var(--text-secondary);
                font-size: 0.9rem;
            }
            
            .workflow-options {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                padding: 1rem;
                background: var(--bg-tertiary);
                border-radius: 8px;
            }
            
            .workflow-options .form-label {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .workflow-options input[type="number"] {
                width: 80px;
            }
        `;
        document.head.appendChild(style);
    }
}

// Skip AI workflow
window.skipAIWorkflow = function() {
    document.querySelector('.ai-workflow-prompt').remove();
};

// Start AI workflow
window.startAIWorkflow = async function(projectId) {
    const autoTransition = document.getElementById('auto-transition').checked;
    const targetChapters = parseInt(document.getElementById('target-chapters').value) || 10;
    
    try {
        // Start workflow
        const response = await window.api.invoke('workflow:start', {
            projectId,
            options: {
                autoTransition,
                targetChapters,
                participants: ['deputy_editor', 'writer', 'editor', 'proofreader']
            }
        });
        
        if (response.success) {
            // Close prompt modal
            document.querySelector('.ai-workflow-prompt').remove();
            
            // Navigate to agent meeting room with workflow context
            window.location.href = `./agent-meeting.html?projectId=${projectId}&workflowId=${response.data.id}&autoStart=true`;
        } else {
            showError('ワークフローの開始に失敗しました');
        }
    } catch (error) {
        console.error('Failed to start workflow:', error);
        showError('ワークフローの開始に失敗しました');
    }
};

// Select project
function selectProject(projectId) {
    selectedProjectId = parseInt(projectId);
    
    // Update UI
    document.querySelectorAll('.project-card').forEach(card => {
        card.classList.toggle('active', card.dataset.projectId === projectId);
    });
}

// Open project
function openProject(projectId) {
    console.log('Opening project:', projectId);
    // Navigate to project workspace
    window.location.href = `./project-workspace.html?id=${projectId}`;
}

// Edit project
async function editProject(projectId) {
    try {
        const project = currentProjects.find(p => p.id === parseInt(projectId));
        if (!project) {
            showError('プロジェクトが見つかりません');
            return;
        }
        
        // Populate the edit form with current project data
        const metadata = project.metadata ? JSON.parse(project.metadata) : {};
        
        document.getElementById('edit-project-id').value = project.id;
        document.getElementById('edit-project-name').value = project.name;
        document.getElementById('edit-project-description').value = project.description || '';
        document.getElementById('edit-project-genre').value = metadata.genre || '';
        document.getElementById('edit-target-length').value = metadata.targetLength || '';
        document.getElementById('edit-project-status').value = metadata.status || 'planning';
        
        // Show the edit modal
        document.getElementById('edit-project-modal').style.display = 'flex';
        document.getElementById('edit-project-name').focus();
        
    } catch (error) {
        console.error('Failed to load project for editing:', error);
        showError('プロジェクトの読み込みに失敗しました');
    }
}

// Hide edit project modal
function hideEditProjectModal() {
    document.getElementById('edit-project-modal').style.display = 'none';
    document.getElementById('edit-project-form').reset();
}

// Handle edit project form submission
async function handleEditProject(e) {
    e.preventDefault();
    
    const projectId = parseInt(document.getElementById('edit-project-id').value);
    const formData = new FormData(e.target);
    
    const projectData = {
        name: formData.get('name'),
        description: formData.get('description'),
        metadata: {
            genre: formData.get('genre'),
            targetLength: parseInt(formData.get('targetLength')) || 0,
            status: formData.get('status') || 'planning'
        }
    };
    
    try {
        const response = await window.api.invoke('project:update', projectId, projectData);
        
        if (response.success) {
            hideEditProjectModal();
            await loadProjects();
            showSuccess('プロジェクトを更新しました');
        } else {
            showError(response.error.message || 'プロジェクトの更新に失敗しました');
        }
    } catch (error) {
        console.error('Failed to update project:', error);
        showError('プロジェクトの更新に失敗しました');
    }
}

// Delete project
async function deleteProject() {
    const projectId = parseInt(document.getElementById('edit-project-id').value);
    const project = currentProjects.find(p => p.id === projectId);
    
    if (!project) {
        showError('プロジェクトが見つかりません');
        return;
    }
    
    const confirmed = confirm(`プロジェクト「${project.name}」を削除しますか？\n\nこの操作は取り消すことができません。`);
    
    if (!confirmed) return;
    
    try {
        const response = await window.api.invoke('project:delete', projectId);
        
        if (response) {
            // Close edit modal first
            hideEditProjectModal();
            
            // Reset selected project if it was the deleted one
            if (selectedProjectId === projectId) {
                selectedProjectId = null;
            }
            
            // Reload projects
            await loadProjects();
            
            // Show success message
            showSuccess('プロジェクトを削除しました');
            
            // If no projects remain, ensure the UI is in the correct state
            if (currentProjects.length === 0) {
                // Focus on the create button in empty state
                setTimeout(() => {
                    const createBtn = document.querySelector('#empty-state button');
                    if (createBtn) {
                        createBtn.focus();
                    }
                }, 100);
            }
        } else {
            showError(response.error?.message || 'プロジェクトの削除に失敗しました');
        }
    } catch (error) {
        console.error('Failed to delete project:', error);
        showError('プロジェクトの削除に失敗しました');
    }
}

// Global functions for modal onclick handlers
window.showCreateProjectModal = showCreateProjectModal;
window.hideCreateProjectModal = hideCreateProjectModal;
window.hideEditProjectModal = hideEditProjectModal;
window.deleteProject = deleteProject;

// Handle navigation
function handleNavigation(e) {
    e.preventDefault();
    const page = e.currentTarget.dataset.page;
    
    // Navigate to page
    switch (page) {
        case 'projects':
            // Already on projects page
            break;
        case 'anything-box':
            window.location.href = './anything-box.html';
            break;
        case 'serendipity':
            window.location.href = './serendipity.html';
            break;
        case 'settings':
            window.location.href = './settings.html';
            break;
        case 'writing-editor':
            window.location.href = './writing-editor.html';
            break;
        case 'agent-meeting':
            window.location.href = './agent-meeting.html';
            break;
        case 'knowledge-graph':
            window.location.href = './knowledge-graph.html';
            break;
        case 'analytics':
            window.location.href = './analytics.html';
            break;
        case 'project-workspace':
            window.location.href = './project-workspace.html';
            break;
        default:
            showInfo(`${e.currentTarget.querySelector('span:last-child').textContent}は開発中です`);
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getGenreLabel(genre) {
    const labels = {
        fantasy: 'ファンタジー',
        scifi: 'SF',
        mystery: 'ミステリー',
        romance: '恋愛',
        literary: '純文学',
        other: 'その他'
    };
    return labels[genre] || genre;
}

// Notification functions
function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showInfo(message) {
    showNotification(message, 'info');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    
    const colors = {
        error: '#f44336',
        success: '#4CAF50',
        info: '#2196F3'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.style.color = 'white';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Start AI workflow for existing project
window.startAIWorkflowForProject = function(projectId, projectName) {
    showAIWorkflowPrompt(projectId, projectName);
};