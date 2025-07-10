// Knowledge Graph page JavaScript

let currentProjectId = null;
let graphData = { nodes: [], links: [] };
let graph = null;
let selectedNode = null;
let currentLayout = 'force';
let typeFilter = 'all';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    setupEventListeners();
    initializeGraph();
});

// Setup event listeners
function setupEventListeners() {
    // Project selector
    document.getElementById('project-selector').addEventListener('change', handleProjectChange);

    // Type filters
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            typeFilter = e.target.dataset.type;
            document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            updateGraphData();
        });
    });

    // Layout buttons
    document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentLayout = e.target.dataset.layout;
            document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyLayout();
        });
    });

    // Sliders
    const nodeSizeSlider = document.getElementById('node-size');
    const linkStrengthSlider = document.getElementById('link-strength');

    nodeSizeSlider.addEventListener('input', (e) => {
        console.log('Node size changed to:', e.target.value);
    });

    linkStrengthSlider.addEventListener('input', (e) => {
        console.log('Link strength changed to:', e.target.value);
    });

    // Navigation
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
}

// Initialize 3D graph (Three.js なし版)
function initializeGraph() {
    const container = document.getElementById('graph-view');
    
    // Show Three.js dependency notice
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; padding: 2rem; color: var(--text-secondary);">
            <div style="font-size: 64px; margin-bottom: 1rem;">🕸️</div>
            <h3 style="margin-bottom: 1rem;">3Dナレッジグラフ機能</h3>
            <p style="margin-bottom: 1rem;">この機能はThree.jsと3d-force-graphライブラリに依存しています。<br>オフライン利用のため、CDN依存関係を削除しました。</p>
            <p style="color: var(--text-tertiary); font-size: 0.9rem;">将来のバージョンでローカルライブラリまたは<br>代替実装で対応予定です。</p>
            <div style="margin-top: 2rem;">
                <a href="./knowledge-graph-visual.html" class="primary-btn" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; background: var(--primary-color); color: white; border-radius: 6px;">
                    🔗 2Dビジュアルグラフを使用
                </a>
            </div>
        </div>
    `;
}

// Load projects
async function loadProjects() {
    try {
        const response = await window.api.invoke('project:getAll');
        
        if (response.success) {
            const selector = document.getElementById('project-selector');
            selector.innerHTML = '<option value="">プロジェクトを選択...</option>';
            
            response.data.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = project.name;
                selector.appendChild(option);
            });
            
            // Select first project if available
            if (response.data.length > 0) {
                selector.value = response.data[0].id;
                handleProjectChange();
            }
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
        showError('プロジェクトの読み込みに失敗しました');
    }
}

// Handle project change
async function handleProjectChange() {
    const selector = document.getElementById('project-selector');
    currentProjectId = selector.value ? parseInt(selector.value) : null;
    
    if (currentProjectId) {
        await loadGraphData();
    } else {
        clearGraph();
    }
}

// Load graph data
async function loadGraphData() {
    if (!currentProjectId) return;

    showLoading();

    try {
        // Load knowledge items
        const knowledgeResponse = await window.api.invoke('knowledge:listByProject', { projectId: currentProjectId });
        
        if (knowledgeResponse.success) {
            const knowledge = knowledgeResponse.data;
            
            // Load knowledge links
            const linksResponse = await window.api.invoke('knowledge:getLinks', currentProjectId);
            const links = linksResponse.success ? linksResponse.data : [];
            
            // Build graph data
            buildGraphData(knowledge, links);
            updateGraphStats();
            
            if (graphData.nodes.length === 0) {
                showEmptyState();
            } else {
                hideEmptyState();
                graph.graphData(graphData);
            }
        }
    } catch (error) {
        console.error('Failed to load graph data:', error);
        showError('グラフデータの読み込みに失敗しました');
    } finally {
        hideLoading();
    }
}

// Build graph data
function buildGraphData(knowledge, links) {
    // Create nodes
    const nodes = knowledge.map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        content: item.content,
        metadata: item.metadata ? JSON.parse(item.metadata) : {},
        createdAt: item.created_at
    }));

    // Create links
    const graphLinks = links.map(link => ({
        source: link.source_id,
        target: link.target_id,
        type: link.link_type,
        strength: link.strength || 1
    }));

    graphData = { nodes, links: graphLinks };
    
    // Apply type filter
    if (typeFilter !== 'all') {
        graphData.nodes = graphData.nodes.filter(node => node.type === typeFilter);
        const nodeIds = new Set(graphData.nodes.map(n => n.id));
        graphData.links = graphData.links.filter(link => 
            nodeIds.has(link.source) && nodeIds.has(link.target)
        );
    }
}

// Update graph data with current filters
async function updateGraphData() {
    if (currentProjectId) {
        await loadGraphData();
    }
}

// Apply layout
function applyLayout() {
    if (!graph || graphData.nodes.length === 0) return;

    switch (currentLayout) {
        case 'force':
            // Default force layout
            graph.d3Force('charge').strength(-300);
            graph.d3Force('link').distance(100);
            break;
            
        case 'tree':
            // Tree layout
            const tree = d3.tree()
                .size([360, 300])
                .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);
            
            // Apply tree positions
            // Note: This is simplified, actual implementation would need hierarchy
            break;
            
        case 'radial':
            // Radial layout
            const angleStep = (2 * Math.PI) / graphData.nodes.length;
            const radius = 200;
            
            graphData.nodes.forEach((node, i) => {
                const angle = i * angleStep;
                node.fx = radius * Math.cos(angle);
                node.fy = radius * Math.sin(angle);
                node.fz = 0;
            });
            
            graph.graphData(graphData);
            
            // Release fixed positions after animation
            setTimeout(() => {
                graphData.nodes.forEach(node => {
                    node.fx = undefined;
                    node.fy = undefined;
                    node.fz = undefined;
                });
            }, 2000);
            break;
    }
}

// Handle node click
function handleNodeClick(node) {
    selectedNode = node;
    showNodeInfo(node);
}

// Handle node hover
function handleNodeHover(node) {
    // Could show tooltip here
}

// Show node info in panel
function showNodeInfo(node) {
    const infoPanel = document.getElementById('selected-node-info');
    const titleEl = document.getElementById('selected-node-title');
    const contentEl = document.getElementById('selected-node-content');
    
    titleEl.textContent = node.title;
    contentEl.innerHTML = `
        <div class="node-info-item">
            <strong>タイプ:</strong> ${getTypeLabel(node.type)}
        </div>
        <div class="node-info-item">
            <strong>作成日:</strong> ${new Date(node.createdAt).toLocaleDateString('ja-JP')}
        </div>
        <div class="node-info-item">
            <strong>コンテンツ:</strong><br>
            ${escapeHtml(node.content).substring(0, 200)}${node.content.length > 200 ? '...' : ''}
        </div>
    `;
    
    infoPanel.style.display = 'block';
}

// View node detail
async function viewNodeDetail() {
    if (!selectedNode) return;
    
    try {
        const response = await window.api.invoke('knowledge:getById', selectedNode.id);
        
        if (response.success) {
            showNodeDetailModal(response.data);
        }
    } catch (error) {
        console.error('Failed to load node detail:', error);
        showError('ノード詳細の読み込みに失敗しました');
    }
}

// Show node detail modal
function showNodeDetailModal(node) {
    const modal = document.getElementById('node-detail-modal');
    const titleEl = document.getElementById('node-detail-title');
    const contentEl = document.getElementById('node-detail-content');
    
    titleEl.textContent = node.title;
    
    const metadata = node.metadata ? JSON.parse(node.metadata) : {};
    const connections = graphData.links.filter(link => 
        link.source.id === node.id || link.target.id === node.id
    );
    
    contentEl.innerHTML = `
        <div class="node-detail-section">
            <h4>基本情報</h4>
            <div class="node-detail-text">
                <p><strong>タイプ:</strong> ${getTypeLabel(node.type)}</p>
                <p><strong>作成日:</strong> ${new Date(node.created_at).toLocaleDateString('ja-JP')}</p>
                <p><strong>更新日:</strong> ${new Date(node.updated_at).toLocaleDateString('ja-JP')}</p>
            </div>
        </div>
        
        <div class="node-detail-section">
            <h4>コンテンツ</h4>
            <div class="node-detail-text">${escapeHtml(node.content)}</div>
        </div>
        
        ${metadata.inspirations ? `
            <div class="node-detail-section">
                <h4>インスピレーション</h4>
                <div class="node-connections">
                    ${metadata.inspirations.map(insp => `
                        <div class="connection-item">
                            <span>${getInspirationTypeLabel(insp.type)}: ${escapeHtml(insp.content)}</span>
                            <span class="connection-strength">${Math.round(insp.confidence * 100)}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <div class="node-detail-section">
            <h4>関連ノード (${connections.length})</h4>
            <div class="node-connections">
                ${connections.slice(0, 10).map(conn => {
                    const otherNode = conn.source.id === node.id ? conn.target : conn.source;
                    return `
                        <div class="connection-item">
                            <span>${escapeHtml(otherNode.title)}</span>
                            <span class="connection-strength">${conn.strength.toFixed(2)}</span>
                        </div>
                    `;
                }).join('')}
                ${connections.length > 10 ? '<p>...他 ' + (connections.length - 10) + ' 件</p>' : ''}
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

// Find related nodes
function findRelatedNodes() {
    if (!selectedNode) return;
    
    // Highlight connected nodes
    const connectedNodeIds = new Set();
    graphData.links.forEach(link => {
        if (link.source.id === selectedNode.id) {
            connectedNodeIds.add(link.target.id);
        } else if (link.target.id === selectedNode.id) {
            connectedNodeIds.add(link.source.id);
        }
    });
    
    // Update node colors
    graph.nodeColor(node => {
        if (node.id === selectedNode.id) {
            return '#ff0000'; // Red for selected
        } else if (connectedNodeIds.has(node.id)) {
            return '#ffa500'; // Orange for connected
        } else {
            return getNodeColor(node.type);
        }
    });
}

// Update graph statistics
function updateGraphStats() {
    document.getElementById('node-count').textContent = graphData.nodes.length;
    document.getElementById('link-count').textContent = graphData.links.length;
    
    // Calculate clusters (simplified)
    const clusters = calculateClusters();
    document.getElementById('cluster-count').textContent = clusters.length;
}

// Calculate clusters (simplified algorithm)
function calculateClusters() {
    // This is a simplified cluster detection
    // In a real implementation, you would use community detection algorithms
    const visited = new Set();
    const clusters = [];
    
    graphData.nodes.forEach(node => {
        if (!visited.has(node.id)) {
            const cluster = [];
            const queue = [node];
            
            while (queue.length > 0) {
                const current = queue.shift();
                if (!visited.has(current.id)) {
                    visited.add(current.id);
                    cluster.push(current);
                    
                    // Find connected nodes
                    graphData.links.forEach(link => {
                        if (link.source.id === current.id && !visited.has(link.target.id)) {
                            queue.push(link.target);
                        } else if (link.target.id === current.id && !visited.has(link.source.id)) {
                            queue.push(link.source);
                        }
                    });
                }
            }
            
            if (cluster.length > 0) {
                clusters.push(cluster);
            }
        }
    });
    
    return clusters;
}

// Clear graph
function clearGraph() {
    graphData = { nodes: [], links: [] };
    if (graph) {
        graph.graphData(graphData);
    }
    updateGraphStats();
}

// Handle navigation
function handleNavigation(e) {
    e.preventDefault();
    const page = e.currentTarget.dataset.page;
    
    switch (page) {
        case 'agent-meeting':
            window.location.href = './agent-meeting.html';
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
            // Already on this page
            break;
        case 'settings':
            window.location.href = './settings.html';
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

function getNodeColor(type) {
    const colors = {
        text: '#2196F3',
        url: '#4CAF50',
        image: '#FF9800'
    };
    return colors[type] || '#757575';
}

function getTypeLabel(type) {
    const labels = {
        text: 'テキスト',
        url: 'URL',
        image: '画像'
    };
    return labels[type] || type;
}

function getInspirationTypeLabel(type) {
    const labels = {
        character: 'キャラクター',
        scene: 'シーン',
        theme: 'テーマ',
        plot: 'プロット',
        worldbuilding: '世界観'
    };
    return labels[type] || type;
}

// UI state functions
function showLoading() {
    const container = document.getElementById('graph-view');
    container.innerHTML = `
        <div class="graph-loading">
            <div class="graph-loading-spinner">⚡</div>
            <p>グラフを構築中...</p>
        </div>
    `;
}

function hideLoading() {
    // Loading is replaced by graph
}

function showEmptyState() {
    document.getElementById('empty-state').style.display = 'flex';
    document.querySelector('.graph-container').style.display = 'none';
}

function hideEmptyState() {
    document.getElementById('empty-state').style.display = 'none';
    document.querySelector('.graph-container').style.display = 'block';
}

function hideInfoPanel() {
    document.querySelector('.graph-info-panel').style.display = 'none';
}

function hideNodeDetailModal() {
    document.getElementById('node-detail-modal').style.display = 'none';
}

function editNode() {
    if (!selectedNode) return;
    showInfo('ノード編集機能は開発中です');
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

// Make functions available globally
window.hideInfoPanel = hideInfoPanel;
window.hideNodeDetailModal = hideNodeDetailModal;
window.viewNodeDetail = viewNodeDetail;
window.findRelatedNodes = findRelatedNodes;
window.editNode = editNode;