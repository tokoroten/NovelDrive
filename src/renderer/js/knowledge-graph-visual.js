// Check if running in Electron environment
let ipcRenderer = null;
if (typeof require !== 'undefined') {
    try {
        ipcRenderer = require('electron').ipcRenderer;
    } catch (e) {
        // Running in browser environment
        console.log('Running in browser mode, using Mock API');
    }
}

// グラフデータと要素
let graphData = { nodes: [], links: [] };
let currentProjectId = null;
let graphContainer = null;
let canvas = null;
let ctx = null;
let animationId = null;

// グラフ設定
const graphConfig = {
    nodeRadius: 20,
    linkDistance: 150,
    chargeStrength: -30,
    width: 0,
    height: 0,
    damping: 0.9,
    alpha: 0.3
};

// インタラクション状態
let draggedNode = null;
let selectedNode = null;
let hoveredNode = null;
let transform = { x: 0, y: 0, scale: 1 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };

// ノードタイプ別の設定
const nodeTypeConfig = {
    character: { color: '#FF6B6B', icon: '👤', label: 'キャラクター' },
    location: { color: '#4ECDC4', icon: '📍', label: '場所' },
    item: { color: '#FFE66D', icon: '🎁', label: 'アイテム' },
    event: { color: '#A8E6CF', icon: '📅', label: '出来事' },
    world: { color: '#95E1D3', icon: '🌍', label: '世界設定' },
    other: { color: '#C7CEEA', icon: '📂', label: 'その他' }
};

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    initializeGraph();
    setupEventListeners();
    await loadProjects();
    
    // URLパラメータからプロジェクトIDを取得
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');
    if (projectId) {
        document.getElementById('project-selector').value = projectId;
        currentProjectId = parseInt(projectId);
        loadKnowledgeGraph();
    }
});

// グラフの初期化
function initializeGraph() {
    graphContainer = document.getElementById('graph-svg-container');
    graphConfig.width = graphContainer.clientWidth;
    graphConfig.height = graphContainer.clientHeight;

    // Canvasの作成
    createCanvas();
    setupCanvasEvents();
}

// Canvasの作成
function createCanvas() {
    // 既存のcanvasがあれば削除
    const existingCanvas = graphContainer.querySelector('canvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }

    // 新しいcanvasを作成
    canvas = document.createElement('canvas');
    canvas.width = graphConfig.width;
    canvas.height = graphConfig.height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.border = '1px solid var(--border-color)';
    canvas.style.borderRadius = '8px';
    canvas.style.backgroundColor = 'var(--background-primary)';
    
    ctx = canvas.getContext('2d');
    graphContainer.innerHTML = '';
    graphContainer.appendChild(canvas);

    // 高DPI対応
    const dpr = window.devicePixelRatio || 1;
    canvas.width = graphConfig.width * dpr;
    canvas.height = graphConfig.height * dpr;
    canvas.style.width = graphConfig.width + 'px';
    canvas.style.height = graphConfig.height + 'px';
    ctx.scale(dpr, dpr);
}

// Canvasイベントの設定
function setupCanvasEvents() {
    let isMouseDown = false;
    let lastMousePos = { x: 0, y: 0 };

    canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedNode = getNodeAt(x, y);
        if (clickedNode) {
            draggedNode = clickedNode;
            selectedNode = clickedNode;
            showNodeDetail(clickedNode);
        } else {
            dragStart = { x, y };
            isDragging = false;
        }
        
        lastMousePos = { x, y };
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (isMouseDown) {
            if (draggedNode) {
                // ノードをドラッグ
                draggedNode.x = (x - transform.x) / transform.scale;
                draggedNode.y = (y - transform.y) / transform.scale;
                draggedNode.fx = draggedNode.x;
                draggedNode.fy = draggedNode.y;
            } else {
                // ビューをパン
                const dx = x - lastMousePos.x;
                const dy = y - lastMousePos.y;
                transform.x += dx;
                transform.y += dy;
                isDragging = true;
            }
        } else {
            // ホバー検出
            const hoveredNode = getNodeAt(x, y);
            if (hoveredNode !== this.hoveredNode) {
                this.hoveredNode = hoveredNode;
                canvas.style.cursor = hoveredNode ? 'pointer' : 'default';
                
                if (hoveredNode) {
                    showTooltip(e, hoveredNode);
                } else {
                    hideTooltip();
                }
            }
        }
        
        lastMousePos = { x, y };
    });

    canvas.addEventListener('mouseup', () => {
        isMouseDown = false;
        if (draggedNode) {
            draggedNode.fx = null;
            draggedNode.fy = null;
            draggedNode = null;
        }
        isDragging = false;
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedNode = getNodeAt(x, y);
        if (clickedNode) {
            showContextMenu(e, clickedNode);
        }
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(5, transform.scale * scaleFactor));
        
        // ズーム中心を調整
        const dx = (x - transform.x) * (newScale / transform.scale - 1);
        const dy = (y - transform.y) * (newScale / transform.scale - 1);
        
        transform.scale = newScale;
        transform.x -= dx;
        transform.y -= dy;
    });
}

// イベントリスナーの設定
function setupEventListeners() {
    // プロジェクト選択
    document.getElementById('project-selector').addEventListener('change', (e) => {
        currentProjectId = parseInt(e.target.value);
        if (currentProjectId) {
            loadKnowledgeGraph();
        }
    });

    // ノードタイプフィルター
    document.querySelectorAll('.node-type-filter').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            filterNodes();
        });
    });

    // スライダー
    document.getElementById('node-size-slider').addEventListener('input', (e) => {
        graphConfig.nodeRadius = parseInt(e.target.value);
        document.getElementById('node-size-value').textContent = e.target.value;
        
        // ノードサイズをリアルタイム更新
        graphData.nodes.forEach(node => {
            node.radius = graphConfig.nodeRadius;
        });
        drawGraph();
    });

    document.getElementById('link-distance-slider').addEventListener('input', (e) => {
        graphConfig.linkDistance = parseInt(e.target.value);
        document.getElementById('link-distance-value').textContent = e.target.value;
    });

    document.getElementById('force-strength-slider').addEventListener('input', (e) => {
        graphConfig.chargeStrength = parseInt(e.target.value);
        document.getElementById('force-strength-value').textContent = e.target.value;
    });

    // 検索
    const searchInput = document.getElementById('node-search');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        if (searchTerm) {
            searchNodes(searchTerm);
        } else {
            document.getElementById('search-results').style.display = 'none';
        }
    });

    // アクションボタン
    document.getElementById('reset-zoom').addEventListener('click', resetZoom);
    document.getElementById('fit-view').addEventListener('click', fitView);
    document.getElementById('export-image').addEventListener('click', exportImage);

    // 詳細パネルを閉じる
    document.getElementById('close-detail-panel').addEventListener('click', () => {
        document.getElementById('node-detail-panel').style.display = 'none';
    });

    // ウィンドウリサイズ
    window.addEventListener('resize', () => {
        const container = document.getElementById('graph-svg-container');
        graphConfig.width = container.clientWidth;
        graphConfig.height = container.clientHeight;
    });
}

// プロジェクト一覧の読み込み
async function loadProjects() {
    try {
        // Use Mock API if available
        const response = window.api ? 
            await window.api.invoke('project:getAll') :
            await window.mockAPI.invoke('project:getAll');
            
        const projects = response.success ? response.data : response;
        const selector = document.getElementById('project-selector');
        
        selector.innerHTML = '<option value="">プロジェクトを選択...</option>';
        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name || project.title;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

// 知識グラフの読み込み
async function loadKnowledgeGraph() {
    if (!currentProjectId) return;

    try {
        // ローディング表示
        showLoading();

        // Mock graph data for demonstration
        const mockGraphData = generateMockGraphData(currentProjectId);
        
        if (!mockGraphData.nodes || mockGraphData.nodes.length === 0) {
            showEmptyState();
            return;
        }

        hideEmptyState();

        // グラフデータの準備
        graphData = prepareGraphData(mockGraphData);

        // 初期レイアウト計算
        initializeNodePositions();

        // 物理シミュレーション開始
        startSimulation();

        // 統計情報の更新
        updateStats();

    } catch (error) {
        console.error('Failed to load knowledge graph:', error);
        showError('グラフの読み込みに失敗しました');
    } finally {
        hideLoading();
    }
}

// モックグラフデータの生成
function generateMockGraphData(projectId) {
    const nodeTypes = ['character', 'location', 'item', 'event', 'world', 'other'];
    const nodes = [];
    const links = [];
    
    // ノードを生成
    for (let i = 1; i <= 20; i++) {
        const type = nodeTypes[Math.floor(Math.random() * nodeTypes.length)];
        nodes.push({
            id: i,
            title: `${nodeTypeConfig[type].label} ${i}`,
            type: type,
            content: `これは${nodeTypeConfig[type].label}の詳細説明です。プロジェクト${projectId}に関連する重要な要素です。`,
            tags: [`タグ${i}`, `プロジェクト${projectId}`]
        });
    }
    
    // リンクを生成
    for (let i = 0; i < 30; i++) {
        const source = Math.floor(Math.random() * nodes.length) + 1;
        let target = Math.floor(Math.random() * nodes.length) + 1;
        
        // 自己ループを避ける
        while (target === source) {
            target = Math.floor(Math.random() * nodes.length) + 1;
        }
        
        // 重複リンクを避ける
        const linkExists = links.some(link => 
            (link.source_id === source && link.target_id === target) ||
            (link.source_id === target && link.target_id === source)
        );
        
        if (!linkExists) {
            links.push({
                source_id: source,
                target_id: target,
                link_type: 'semantic',
                strength: Math.random() * 0.8 + 0.2
            });
        }
    }
    
    return { nodes, links };
}

// グラフデータの準備
function prepareGraphData(rawData) {
    const nodes = rawData.nodes.map(node => ({
        id: node.id,
        title: node.title,
        type: node.type || 'other',
        content: node.content,
        tags: Array.isArray(node.tags) ? node.tags : 
              (node.tags ? node.tags.split(',').map(t => t.trim()) : []),
        x: Math.random() * graphConfig.width,
        y: Math.random() * graphConfig.height,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        radius: graphConfig.nodeRadius
    }));

    const links = rawData.links.map(link => {
        const sourceNode = nodes.find(n => n.id === link.source_id);
        const targetNode = nodes.find(n => n.id === link.target_id);
        
        return {
            source: sourceNode,
            target: targetNode,
            type: link.link_type,
            strength: link.strength || 0.5
        };
    }).filter(link => link.source && link.target);

    return { nodes, links };
}

// 初期ノード位置の設定
function initializeNodePositions() {
    const centerX = graphConfig.width / 2;
    const centerY = graphConfig.height / 2;
    const radius = Math.min(graphConfig.width, graphConfig.height) / 3;
    
    graphData.nodes.forEach((node, index) => {
        const angle = (index / graphData.nodes.length) * 2 * Math.PI;
        node.x = centerX + Math.cos(angle) * radius;
        node.y = centerY + Math.sin(angle) * radius;
    });
}

// 物理シミュレーション開始
function startSimulation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    const simulate = () => {
        updateForces();
        drawGraph();
        
        if (graphConfig.alpha > 0.001) {
            graphConfig.alpha *= graphConfig.damping;
            animationId = requestAnimationFrame(simulate);
        }
    };
    
    graphConfig.alpha = 0.3;
    simulate();
}

// 力の計算と更新
function updateForces() {
    // リセット力
    graphData.nodes.forEach(node => {
        node.vx *= 0.9;
        node.vy *= 0.9;
    });
    
    // 反発力（ノード間）
    for (let i = 0; i < graphData.nodes.length; i++) {
        for (let j = i + 1; j < graphData.nodes.length; j++) {
            const nodeA = graphData.nodes[i];
            const nodeB = graphData.nodes[j];
            
            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const force = graphConfig.chargeStrength / (distance * distance);
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;
                
                nodeA.vx -= fx;
                nodeA.vy -= fy;
                nodeB.vx += fx;
                nodeB.vy += fy;
            }
        }
    }
    
    // リンク力（引力）
    graphData.links.forEach(link => {
        const dx = link.target.x - link.source.x;
        const dy = link.target.y - link.source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const targetDistance = graphConfig.linkDistance;
            const force = (distance - targetDistance) * 0.1 * link.strength;
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            link.source.vx += fx;
            link.source.vy += fy;
            link.target.vx -= fx;
            link.target.vy -= fy;
        }
    });
    
    // 中心力
    const centerX = graphConfig.width / 2;
    const centerY = graphConfig.height / 2;
    
    graphData.nodes.forEach(node => {
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        node.vx += dx * 0.01;
        node.vy += dy * 0.01;
    });
    
    // 位置更新
    graphData.nodes.forEach(node => {
        if (node.fx == null) node.x += node.vx * graphConfig.alpha;
        if (node.fy == null) node.y += node.vy * graphConfig.alpha;
        
        // 境界内に保持
        node.x = Math.max(node.radius, Math.min(graphConfig.width - node.radius, node.x));
        node.y = Math.max(node.radius, Math.min(graphConfig.height - node.radius, node.y));
    });
}

// グラフの描画
function drawGraph() {
    if (!ctx) return;
    
    // キャンバスクリア
    ctx.clearRect(0, 0, graphConfig.width, graphConfig.height);
    
    // 変換適用
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);
    
    // リンク描画
    drawLinks();
    
    // ノード描画
    drawNodes();
    
    ctx.restore();
}

// リンクの描画
function drawLinks() {
    graphData.links.forEach(link => {
        if (!isNodeVisible(link.source) || !isNodeVisible(link.target)) return;
        
        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);
        
        ctx.strokeStyle = link.type === 'semantic' ? '#666' : '#999';
        ctx.lineWidth = Math.max(0.5, link.strength * 3);
        ctx.globalAlpha = 0.6;
        
        if (link.type === 'reference') {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }
        
        ctx.stroke();
        ctx.globalAlpha = 1;
    });
}

// ノードの描画
function drawNodes() {
    graphData.nodes.forEach(node => {
        if (!isNodeVisible(node)) return;
        
        const isSelected = selectedNode && selectedNode.id === node.id;
        const isHovered = hoveredNode && hoveredNode.id === node.id;
        
        // ノード背景
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        
        // ノードカラー
        const color = nodeTypeConfig[node.type]?.color || '#C7CEEA';
        ctx.fillStyle = color;
        
        if (isSelected) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
        }
        
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // ノードボーダー
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        ctx.strokeStyle = isSelected ? '#333' : (isHovered ? '#555' : '#999');
        ctx.lineWidth = isSelected ? 3 : (isHovered ? 2 : 1);
        ctx.stroke();
        
        // アイコン描画
        const icon = nodeTypeConfig[node.type]?.icon || '📄';
        ctx.font = `${node.radius}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#333';
        ctx.fillText(icon, node.x, node.y);
        
        // ラベル描画
        if (transform.scale > 0.5) {
            ctx.font = '12px Arial';
            ctx.fillStyle = '#333';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const text = node.title.length > 12 ? 
                node.title.substring(0, 12) + '...' : 
                node.title;
            
            ctx.fillText(text, node.x, node.y + node.radius + 5);
        }
    });
}

// ノードの可視性チェック
function isNodeVisible(node) {
    const activeTypes = [];
    document.querySelectorAll('.node-type-filter:checked').forEach(checkbox => {
        activeTypes.push(checkbox.value);
    });
    
    return activeTypes.includes(node.type) && !node.hidden;
}

// 指定座標のノードを取得
function getNodeAt(x, y) {
    const worldX = (x - transform.x) / transform.scale;
    const worldY = (y - transform.y) / transform.scale;
    
    for (const node of graphData.nodes) {
        if (!isNodeVisible(node)) continue;
        
        const dx = worldX - node.x;
        const dy = worldY - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= node.radius) {
            return node;
        }
    }
    
    return null;
}

// ドラッグ機能（D3なし版）
function dragstarted(event, d) { /* スタブ */ }
function dragged(event, d) { /* スタブ */ }
function dragended(event, d) { /* スタブ */ }

// ノード詳細の表示
function showNodeDetail(node) {
    const panel = document.getElementById('node-detail-panel');
    document.getElementById('node-detail-title').textContent = node.title;
    document.getElementById('node-detail-type').textContent = nodeTypeConfig[node.type]?.label || 'その他';
    document.getElementById('node-detail-content').innerHTML = node.content ? 
        node.content.substring(0, 200) + (node.content.length > 200 ? '...' : '') : 
        '<em>内容なし</em>';

    // タグの表示
    const tagsContainer = document.getElementById('node-detail-tags');
    tagsContainer.innerHTML = '';
    if (node.tags && node.tags.length > 0) {
        node.tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        });
    } else {
        tagsContainer.innerHTML = '<em>タグなし</em>';
    }

    // 関連ノードの表示
    const relationsContainer = document.getElementById('node-detail-relations');
    relationsContainer.innerHTML = '';
    const relatedLinks = graphData.links.filter(l => 
        l.source.id === node.id || l.target.id === node.id
    );
    
    relatedLinks.forEach(link => {
        const relatedNode = link.source.id === node.id ? link.target : link.source;
        const relationEl = document.createElement('div');
        relationEl.className = 'relation-item';
        relationEl.innerHTML = `
            <span class="relation-icon">${nodeTypeConfig[relatedNode.type]?.icon || '📄'}</span>
            <span class="relation-title">${relatedNode.title}</span>
        `;
        relationEl.addEventListener('click', () => {
            showNodeDetail(relatedNode);
            focusOnNode(relatedNode);
        });
        relationsContainer.appendChild(relationEl);
    });

    if (relatedLinks.length === 0) {
        relationsContainer.innerHTML = '<em>関連なし</em>';
    }

    // ボタンのイベント設定
    document.getElementById('edit-node-btn').onclick = () => editNode(node);
    document.getElementById('focus-node-btn').onclick = () => focusOnNode(node);

    panel.style.display = 'block';
}

// ノードにフォーカス
function focusOnNode(node) {
    if (!node) return;
    
    // ノードを中心に配置
    const centerX = graphConfig.width / 2;
    const centerY = graphConfig.height / 2;
    
    transform.x = centerX - node.x * transform.scale;
    transform.y = centerY - node.y * transform.scale;
    
    // 選択状態に設定
    selectedNode = node;
    
    // 再描画
    drawGraph();
}

// ツールチップの表示
function showTooltip(event, node) {
    const tooltip = document.getElementById('tooltip');
    tooltip.innerHTML = `
        <strong>${node.title}</strong><br>
        <span>タイプ: ${nodeTypeConfig[node.type]?.label || 'その他'}</span>
    `;
    tooltip.style.display = 'block';
    tooltip.style.left = event.pageX + 10 + 'px';
    tooltip.style.top = event.pageY - 10 + 'px';
}

function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

// コンテキストメニューの表示
function showContextMenu(event, node) {
    const menu = document.getElementById('context-menu');
    menu.style.display = 'block';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';

    // メニュー項目のイベント設定
    document.getElementById('view-details').onclick = () => {
        showNodeDetail(node);
        menu.style.display = 'none';
    };

    document.getElementById('edit-node').onclick = () => {
        editNode(node);
        menu.style.display = 'none';
    };

    document.getElementById('hide-node').onclick = () => {
        hideNode(node);
        menu.style.display = 'none';
    };

    document.getElementById('expand-relations').onclick = () => {
        expandRelations(node);
        menu.style.display = 'none';
    };

    document.getElementById('collapse-relations').onclick = () => {
        collapseRelations(node);
        menu.style.display = 'none';
    };

    // クリックで閉じる
    document.addEventListener('click', () => {
        menu.style.display = 'none';
    }, { once: true });
}

// ノードの編集
function editNode(node) {
    // 編集画面へ遷移
    window.location.href = `project-knowledge.html?project=${currentProjectId}&edit=${node.id}`;
}

// ノードを非表示
function hideNode(node) {
    node.hidden = true;
    filterNodes();
}

// 関連を展開（D3なし版）
function expandRelations(node) {
    console.log('Expand relations for node:', node.title);
}

// 関連を折りたたむ（D3なし版）
function collapseRelations(node) {
    console.log('Collapse relations for node:', node.title);
}

// ノードのフィルタリング
function filterNodes() {
    const activeTypes = [];
    document.querySelectorAll('.node-type-filter:checked').forEach(checkbox => {
        activeTypes.push(checkbox.value);
    });
    
    // 再描画
    drawGraph();
    updateStats();
}

// ノードの検索
function searchNodes(searchTerm) {
    const results = graphData.nodes.filter(node => 
        node.title.toLowerCase().includes(searchTerm) ||
        (node.content && node.content.toLowerCase().includes(searchTerm)) ||
        (node.tags && node.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    );

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (results.length > 0) {
        results.slice(0, 10).forEach(node => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.innerHTML = `
                <span class="result-icon">${nodeTypeConfig[node.type]?.icon || '📄'}</span>
                <span class="result-title">${node.title}</span>
            `;
            resultItem.addEventListener('click', () => {
                showNodeDetail(node);
                focusOnNode(node);
                resultsContainer.style.display = 'none';
                document.getElementById('node-search').value = '';
            });
            resultsContainer.appendChild(resultItem);
        });
        resultsContainer.style.display = 'block';
    } else {
        resultsContainer.innerHTML = '<div class="no-results">結果が見つかりません</div>';
        resultsContainer.style.display = 'block';
    }
}

// ノードサイズの更新（D3なし版）
function updateNodeSize() {
    console.log('Update node size to:', graphConfig.nodeRadius);
}

// ミニマップの更新（D3なし版）
function updateMinimap(transform) {
    console.log('Update minimap');
}

// 統計情報の更新
function updateStats() {
    document.getElementById('node-count').textContent = graphData.nodes.length;
    document.getElementById('link-count').textContent = graphData.links.length;
    
    // クラスター数の計算（簡易版）
    const clusters = detectClusters();
    document.getElementById('cluster-count').textContent = clusters.length;
}

// クラスターの検出（簡易版）
function detectClusters() {
    const visited = new Set();
    const clusters = [];

    function dfs(nodeId, cluster) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        cluster.push(nodeId);

        graphData.links.forEach(link => {
            if (link.source.id === nodeId && !visited.has(link.target.id)) {
                dfs(link.target.id, cluster);
            } else if (link.target.id === nodeId && !visited.has(link.source.id)) {
                dfs(link.source.id, cluster);
            }
        });
    }

    graphData.nodes.forEach(node => {
        if (!visited.has(node.id)) {
            const cluster = [];
            dfs(node.id, cluster);
            clusters.push(cluster);
        }
    });

    return clusters;
}

// ズームリセット
function resetZoom() {
    transform.x = 0;
    transform.y = 0;
    transform.scale = 1;
    drawGraph();
}

// 全体表示
function fitView() {
    if (graphData.nodes.length === 0) return;
    
    // ノードの境界を計算
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    graphData.nodes.forEach(node => {
        if (isNodeVisible(node)) {
            minX = Math.min(minX, node.x - node.radius);
            maxX = Math.max(maxX, node.x + node.radius);
            minY = Math.min(minY, node.y - node.radius);
            maxY = Math.max(maxY, node.y + node.radius);
        }
    });
    
    if (minX === Infinity) return;
    
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const padding = 50;
    
    const scaleX = (graphConfig.width - padding * 2) / graphWidth;
    const scaleY = (graphConfig.height - padding * 2) / graphHeight;
    const scale = Math.min(scaleX, scaleY, 2); // 最大2倍まで
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    transform.scale = scale;
    transform.x = graphConfig.width / 2 - centerX * scale;
    transform.y = graphConfig.height / 2 - centerY * scale;
    
    drawGraph();
}

// 画像として保存
function exportImage() {
    try {
        // 現在のcanvasを画像として保存
        const link = document.createElement('a');
        link.download = `knowledge-graph-${currentProjectId || 'export'}.png`;
        link.href = canvas.toDataURL();
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showSuccess('画像を保存しました');
    } catch (error) {
        console.error('Failed to export image:', error);
        showError('画像の保存に失敗しました');
    }
}

// ローディング表示
function showLoading() {
    const container = graphContainer;
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 1rem; animation: spin 1s linear infinite;">⚡</div>
            <p>グラフを構築中...</p>
        </div>
        <style>
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        </style>
    `;
}

function hideLoading() {
    // Canvas作成時にローディング表示は削除される
}

// 空の状態の表示
function showEmptyState() {
    document.getElementById('empty-state').style.display = 'flex';
    document.querySelector('.graph-view-container').style.display = 'none';
}

function hideEmptyState() {
    document.getElementById('empty-state').style.display = 'none';
    document.querySelector('.graph-view-container').style.display = 'block';
}

// メッセージ表示関数
function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
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
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease;
        font-size: 14px;
        font-weight: 500;
    `;
    
    const colors = {
        error: { bg: '#f44336', text: 'white' },
        success: { bg: '#4CAF50', text: 'white' },
        info: { bg: '#2196F3', text: 'white' }
    };
    
    const color = colors[type] || colors.info;
    notification.style.backgroundColor = color.bg;
    notification.style.color = color.text;
    notification.textContent = message;
    
    // CSS animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    
    if (!document.querySelector('#notification-styles')) {
        style.id = 'notification-styles';
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 5000);
}