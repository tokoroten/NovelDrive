// Projects Page Component

const { useState, useEffect, createElement: h } = React;

function ProjectsPage() {
    const projects = window.useStore(state => state.projects);
    const setProjects = window.useStore(state => state.setProjects);
    const setCurrentProject = window.useStore(state => state.setCurrentProject);
    const setView = window.useStore(state => state.setView);
    const setLoading = window.useStore(state => state.setLoading);
    
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProject, setEditingProject] = useState(null);
    
    // Load projects
    useEffect(() => {
        loadProjects();
    }, []);
    
    async function loadProjects() {
        setLoading(true);
        try {
            const api = window.api || window.mockAPI;
            const response = await api.invoke('project:getAll');
            if (response.success) {
                setProjects(response.data);
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
        } finally {
            setLoading(false);
        }
    }
    
    async function createProject(projectData) {
        try {
            const api = window.api || window.mockAPI;
            const response = await api.invoke('project:create', projectData);
            if (response.success) {
                await loadProjects();
                setShowCreateModal(false);
                
                // Navigate to workspace with new project
                setCurrentProject(response.data.id);
                setView('project-workspace');
            }
        } catch (error) {
            console.error('Failed to create project:', error);
            alert('プロジェクトの作成に失敗しました');
        }
    }
    
    async function updateProject(projectId, updates) {
        try {
            const api = window.api || window.mockAPI;
            await api.invoke('project:update', { projectId, updates });
            await loadProjects();
            setShowEditModal(false);
        } catch (error) {
            console.error('Failed to update project:', error);
            alert('プロジェクトの更新に失敗しました');
        }
    }
    
    async function deleteProject(projectId) {
        if (!confirm('このプロジェクトを削除してもよろしいですか？')) return;
        
        try {
            const api = window.api || window.mockAPI;
            await api.invoke('project:delete', { projectId });
            await loadProjects();
            setShowEditModal(false);
        } catch (error) {
            console.error('Failed to delete project:', error);
            alert('プロジェクトの削除に失敗しました');
        }
    }
    
    function openProject(projectId) {
        setCurrentProject(projectId);
        setView('project-workspace');
    }
    
    return h('div', null,
        // Header
        h('header', { className: 'page-header' },
            h('h2', null, 'プロジェクト管理'),
            h('button', {
                className: 'primary-btn',
                onClick: () => setShowCreateModal(true)
            },
                h('span', { className: 'icon' }, '➕'),
                '新規プロジェクト'
            )
        ),
        
        // Projects grid or empty state
        projects.length === 0 ?
            h('div', { className: 'empty-state' },
                h('div', { className: 'empty-icon' }, '📚'),
                h('h3', null, 'プロジェクトがありません'),
                h('p', null, '最初のプロジェクトを作成して、創作を始めましょう。'),
                h('button', {
                    className: 'primary-btn',
                    onClick: () => setShowCreateModal(true)
                },
                    h('span', { className: 'icon' }, '➕'),
                    'プロジェクトを作成'
                )
            ) :
            h('div', { className: 'projects-grid' },
                projects.map(project =>
                    h(ProjectCard, {
                        key: project.id,
                        project,
                        onOpen: () => openProject(project.id),
                        onEdit: () => {
                            setEditingProject(project);
                            setShowEditModal(true);
                        }
                    })
                )
            ),
        
        // Create modal
        showCreateModal && h(CreateProjectModal, {
            onClose: () => setShowCreateModal(false),
            onCreate: createProject
        }),
        
        // Edit modal
        showEditModal && h(EditProjectModal, {
            project: editingProject,
            onClose: () => {
                setShowEditModal(false);
                setEditingProject(null);
            },
            onUpdate: updateProject,
            onDelete: deleteProject
        })
    );
}

// Project Card Component
function ProjectCard({ project, onOpen, onEdit }) {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP');
    };
    
    const getStatusBadge = (status) => {
        const statusMap = {
            planning: { label: '企画中', class: 'status-planning' },
            writing: { label: '執筆中', class: 'status-writing' },
            editing: { label: '編集中', class: 'status-editing' },
            completed: { label: '完成', class: 'status-completed' },
            paused: { label: '中断', class: 'status-paused' }
        };
        const statusInfo = statusMap[status] || statusMap.planning;
        return h('span', { className: `status-badge ${statusInfo.class}` }, statusInfo.label);
    };
    
    return h('div', { className: 'project-card' },
        h('div', { className: 'project-header' },
            h('h3', null, project.name),
            h('button', {
                className: 'icon-btn',
                onClick: onEdit,
                title: '編集'
            }, '✏️')
        ),
        
        project.description && h('p', { className: 'project-description' }, project.description),
        
        h('div', { className: 'project-meta' },
            h('div', { className: 'meta-item' },
                h('span', { className: 'meta-label' }, 'ステータス:'),
                getStatusBadge(project.status)
            ),
            project.genre && h('div', { className: 'meta-item' },
                h('span', { className: 'meta-label' }, 'ジャンル:'),
                h('span', null, project.genre)
            ),
            h('div', { className: 'meta-item' },
                h('span', { className: 'meta-label' }, '更新日:'),
                h('span', null, formatDate(project.updated_at))
            )
        ),
        
        h('div', { className: 'project-actions' },
            h('button', {
                className: 'primary-btn',
                onClick: onOpen
            }, 'プロジェクトを開く')
        )
    );
}

// Create Project Modal
function CreateProjectModal({ onClose, onCreate }) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        genre: '',
        targetLength: ''
    });
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('プロジェクト名を入力してください');
            return;
        }
        onCreate(formData);
    };
    
    return h('div', { className: 'modal', style: { display: 'block' } },
        h('div', { className: 'modal-content' },
            h('div', { className: 'modal-header' },
                h('h3', null, '新規プロジェクト作成'),
                h('button', { className: 'close-btn', onClick: onClose }, '✕')
            ),
            h('form', { className: 'modal-form', onSubmit: handleSubmit },
                h('div', { className: 'form-group' },
                    h('label', { htmlFor: 'project-name' }, 
                        'プロジェクト名 ',
                        h('span', { className: 'required' }, '*')
                    ),
                    h('input', {
                        type: 'text',
                        id: 'project-name',
                        value: formData.name,
                        onChange: (e) => setFormData({ ...formData, name: e.target.value }),
                        placeholder: '例: 星降る夜の物語',
                        required: true
                    })
                ),
                h('div', { className: 'form-group' },
                    h('label', { htmlFor: 'project-description' }, '説明'),
                    h('textarea', {
                        id: 'project-description',
                        rows: 3,
                        value: formData.description,
                        onChange: (e) => setFormData({ ...formData, description: e.target.value }),
                        placeholder: 'プロジェクトの概要を入力してください'
                    })
                ),
                h('div', { className: 'form-group' },
                    h('label', { htmlFor: 'project-genre' }, 'ジャンル'),
                    h('select', {
                        id: 'project-genre',
                        value: formData.genre,
                        onChange: (e) => setFormData({ ...formData, genre: e.target.value })
                    },
                        h('option', { value: '' }, '選択してください'),
                        h('option', { value: 'fantasy' }, 'ファンタジー'),
                        h('option', { value: 'scifi' }, 'SF'),
                        h('option', { value: 'mystery' }, 'ミステリー'),
                        h('option', { value: 'romance' }, '恋愛'),
                        h('option', { value: 'literary' }, '純文学'),
                        h('option', { value: 'other' }, 'その他')
                    )
                ),
                h('div', { className: 'form-group' },
                    h('label', { htmlFor: 'target-length' }, '目標文字数'),
                    h('input', {
                        type: 'number',
                        id: 'target-length',
                        value: formData.targetLength,
                        onChange: (e) => setFormData({ ...formData, targetLength: e.target.value }),
                        placeholder: '100000',
                        min: 0,
                        step: 1000
                    })
                ),
                h('div', { className: 'modal-actions' },
                    h('button', {
                        type: 'button',
                        className: 'secondary-btn',
                        onClick: onClose
                    }, 'キャンセル'),
                    h('button', {
                        type: 'submit',
                        className: 'primary-btn'
                    }, '作成')
                )
            )
        )
    );
}

// Edit Project Modal
function EditProjectModal({ project, onClose, onUpdate, onDelete }) {
    const [formData, setFormData] = useState({
        name: project.name || '',
        description: project.description || '',
        genre: project.genre || '',
        targetLength: project.targetLength || '',
        status: project.status || 'planning'
    });
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('プロジェクト名を入力してください');
            return;
        }
        onUpdate(project.id, formData);
    };
    
    return h('div', { className: 'modal', style: { display: 'block' } },
        h('div', { className: 'modal-content' },
            h('div', { className: 'modal-header' },
                h('h3', null, 'プロジェクト編集'),
                h('button', { className: 'close-btn', onClick: onClose }, '✕')
            ),
            h('form', { className: 'modal-form', onSubmit: handleSubmit },
                h('input', { type: 'hidden', value: project.id }),
                h('div', { className: 'form-group' },
                    h('label', { htmlFor: 'edit-project-name' }, 
                        'プロジェクト名 ',
                        h('span', { className: 'required' }, '*')
                    ),
                    h('input', {
                        type: 'text',
                        id: 'edit-project-name',
                        value: formData.name,
                        onChange: (e) => setFormData({ ...formData, name: e.target.value }),
                        placeholder: '例: 星降る夜の物語',
                        required: true
                    })
                ),
                h('div', { className: 'form-group' },
                    h('label', { htmlFor: 'edit-project-description' }, '説明'),
                    h('textarea', {
                        id: 'edit-project-description',
                        rows: 3,
                        value: formData.description,
                        onChange: (e) => setFormData({ ...formData, description: e.target.value }),
                        placeholder: 'プロジェクトの概要を入力してください'
                    })
                ),
                h('div', { className: 'form-group' },
                    h('label', { htmlFor: 'edit-project-genre' }, 'ジャンル'),
                    h('select', {
                        id: 'edit-project-genre',
                        value: formData.genre,
                        onChange: (e) => setFormData({ ...formData, genre: e.target.value })
                    },
                        h('option', { value: '' }, '選択してください'),
                        h('option', { value: 'fantasy' }, 'ファンタジー'),
                        h('option', { value: 'scifi' }, 'SF'),
                        h('option', { value: 'mystery' }, 'ミステリー'),
                        h('option', { value: 'romance' }, '恋愛'),
                        h('option', { value: 'literary' }, '純文学'),
                        h('option', { value: 'other' }, 'その他')
                    )
                ),
                h('div', { className: 'form-group' },
                    h('label', { htmlFor: 'edit-target-length' }, '目標文字数'),
                    h('input', {
                        type: 'number',
                        id: 'edit-target-length',
                        value: formData.targetLength,
                        onChange: (e) => setFormData({ ...formData, targetLength: e.target.value }),
                        placeholder: '100000',
                        min: 0,
                        step: 1000
                    })
                ),
                h('div', { className: 'form-group' },
                    h('label', { htmlFor: 'edit-project-status' }, 'ステータス'),
                    h('select', {
                        id: 'edit-project-status',
                        value: formData.status,
                        onChange: (e) => setFormData({ ...formData, status: e.target.value })
                    },
                        h('option', { value: 'planning' }, '企画中'),
                        h('option', { value: 'writing' }, '執筆中'),
                        h('option', { value: 'editing' }, '編集中'),
                        h('option', { value: 'completed' }, '完成'),
                        h('option', { value: 'paused' }, '中断')
                    )
                ),
                h('div', { className: 'modal-actions' },
                    h('button', {
                        type: 'button',
                        className: 'danger-btn',
                        onClick: () => onDelete(project.id)
                    }, '削除'),
                    h('div', { style: { flex: 1 } }),
                    h('button', {
                        type: 'button',
                        className: 'secondary-btn',
                        onClick: onClose
                    }, 'キャンセル'),
                    h('button', {
                        type: 'submit',
                        className: 'primary-btn'
                    }, '保存')
                )
            )
        )
    );
}

// Export for use in SPA
window.ProjectsPage = ProjectsPage;