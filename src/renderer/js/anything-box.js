// Anything Box page JavaScript

let currentProjectId = null;
let currentEntries = [];
let currentFilter = 'all';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeProjectSelector();
});

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Forms
    document.getElementById('text-form').addEventListener('submit', handleTextSubmit);
    document.getElementById('url-form').addEventListener('submit', handleURLSubmit);
    document.getElementById('image-form').addEventListener('submit', handleImageSubmit);
    
    // URL AI Discussion button
    document.getElementById('url-ai-discussion').addEventListener('click', handleURLAIDiscussion);
    
    // Image handling
    const dropZone = document.getElementById('drop-zone');
    const imageInput = document.getElementById('image-input');
    const selectImageBtn = document.getElementById('select-image-btn');
    
    selectImageBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', handleImageSelect);
    
    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            handleImageFile(files[0]);
        }
    });
    
    // Project selector
    document.getElementById('project-selector').addEventListener('change', handleProjectChange);
    
    // Search
    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentFilter = e.target.dataset.filter;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            filterEntries();
        });
    });
    
    // Navigation
    document.querySelectorAll('.nav-item a').forEach(link => {
        link.addEventListener('click', handleNavigation);
    });
}

// Load projects for selector
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
function handleProjectChange() {
    const selector = document.getElementById('project-selector');
    currentProjectId = selector.value ? parseInt(selector.value) : null;
    
    if (currentProjectId) {
        loadEntries();
    } else {
        currentEntries = [];
        renderEntries();
    }
    
    checkProjectSelection();
}

// Check if project is selected
function checkProjectSelection() {
    const hasProject = currentProjectId !== null;
    document.querySelectorAll('form button[type="submit"]').forEach(btn => {
        btn.disabled = !hasProject;
    });
    
    if (!hasProject) {
        showInfo('プロジェクトを選択してください');
    }
}

// Initialize project selector integration
function initializeProjectSelector() {
    // Use the global project selector
    if (window.projectSelector) {
        // Set current project ID from selector
        currentProjectId = window.projectSelector.getCurrentProjectId();
        
        // Load entries if project is selected
        if (currentProjectId) {
            loadEntries();
        }
        
        // Listen for project changes
        window.projectSelector.onChange((projectId) => {
            currentProjectId = projectId;
            if (projectId) {
                loadEntries();
            } else {
                currentEntries = [];
                renderEntries();
            }
            checkProjectSelection();
        });
    }
    
    // Hide old project selector if it exists
    const oldSelector = document.querySelector('.project-selector-container');
    if (oldSelector) {
        oldSelector.style.display = 'none';
    }
}

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.dataset.tab === tabName);
    });
}

// Handle text submission
async function handleTextSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('text-title').value;
    const content = document.getElementById('text-content').value;
    
    if (!content || !content.trim()) {
        showError('テキストを入力してください');
        return;
    }
    
    if (!currentProjectId) {
        showError('プロジェクトを選択してください');
        return;
    }
    
    try {
        showLoading();
        
        console.log('Submitting text:', { projectId: currentProjectId, content: content.substring(0, 50) + '...', title });
        
        const response = await window.api.invoke('anythingBox:processText', {
            projectId: currentProjectId,
            text: content.trim(),
            options: {
                title: title || undefined
            }
        });
        
        if (response) {
            // Handle wrapped response from error handler
            const data = response.data || response;
            
            if (data && data.id) {
                document.getElementById('text-form').reset();
                await loadEntries();
                showSuccess('テキストを保存しました');
                if (data.metadata) {
                    const metadata = JSON.parse(data.metadata);
                    if (metadata.inspirations) {
                        showInspirations(metadata.inspirations);
                    }
                }
            } else if (response.success === false) {
                showError(response?.error?.message || response?.message || 'テキストの処理に失敗しました');
            }
        } else {
            showError('テキストの処理に失敗しました');
        }
    } catch (error) {
        console.error('Failed to process text:', error);
        showError('テキストの処理に失敗しました');
    } finally {
        hideLoading();
    }
}

// Handle URL submission
async function handleURLSubmit(e) {
    e.preventDefault();
    
    const url = document.getElementById('url-input').value;
    const aiFetch = document.getElementById('url-ai-fetch').checked;
    const aiSummary = document.getElementById('url-ai-summary').checked;
    
    if (!url.trim()) return;
    
    try {
        showLoading(aiFetch ? 'AIがコンテンツを取得中...' : 'URLを処理中...');
        
        const response = await window.api.invoke('anythingBox:processURL', {
            projectId: currentProjectId,
            url: url,
            options: {
                aiFetch: aiFetch,
                aiSummary: aiSummary
            }
        });
        
        if (response) {
            // Handle wrapped response from error handler
            const data = response.data || response;
            
            if (data && data.id) {
                document.getElementById('url-form').reset();
                await loadEntries();
                showSuccess('URLを保存しました');
                if (data.metadata) {
                    const metadata = JSON.parse(data.metadata);
                    if (metadata.inspirations) {
                        showInspirations(metadata.inspirations);
                    }
                }
            } else if (response.success === false) {
                showError(response?.error?.message || response?.message || 'URLの処理に失敗しました');
            }
        } else {
            showError('URLの処理に失敗しました');
        }
    } catch (error) {
        console.error('Failed to process URL:', error);
        showError('URLの処理に失敗しました');
    } finally {
        hideLoading();
    }
}

// Handle image submission with enhanced processing
async function handleImageSubmit(e) {
    e.preventDefault();
    
    const imageInput = document.getElementById('image-input');
    const imagePath = imageInput.dataset.path;
    const imageType = imageInput.dataset.type;
    const dataUrl = imageInput.dataset.dataUrl;
    const title = document.getElementById('image-title').value;
    
    if (!dataUrl) return;
    
    // Get processing options
    const options = {
        title: title || undefined,
        extractText: document.getElementById('extract-text')?.checked ?? true,
        analyzeObjects: document.getElementById('analyze-objects')?.checked ?? true,
        extractColors: document.getElementById('extract-colors')?.checked ?? true,
        generateDescription: document.getElementById('generate-description')?.checked ?? true
    };
    
    try {
        showLoading('画像を分析中...');
        
        // Process the image with enhanced options
        const processedData = await processImageData(dataUrl, options);
        
        // Use API or Mock API
        const api = window.api || window.MockAPI;
        
        if (api) {
            const response = await api.invoke('anythingBox:processImage', {
                projectId: currentProjectId,
                imagePath: imagePath,
                imageData: processedData,
                options: options
            });
            
            if (response.success) {
                document.getElementById('image-form').reset();
                resetImagePreview();
                await loadEntries();
                showSuccess('画像を処理しました');
                showInspirations(response.data);
            } else {
                showError(response.error?.message || '画像の処理に失敗しました');
            }
        } else {
            // Browser-only processing
            const inspiration = {
                type: 'image',
                title: title || imagePath,
                content: processedData,
                timestamp: new Date().toISOString()
            };
            
            // Store in localStorage for browser testing
            storeInspiration(inspiration);
            
            document.getElementById('image-form').reset();
            resetImagePreview();
            await loadEntries();
            showSuccess('画像を処理しました');
            showInspirations(inspiration);
        }
    } catch (error) {
        console.error('Failed to process image:', error);
        showError('画像の処理に失敗しました: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Process image data with various analysis options
async function processImageData(dataUrl, options) {
    const results = {
        metadata: {},
        analysis: {}
    };
    
    try {
        // Extract basic metadata
        const img = await loadImage(dataUrl);
        results.metadata = {
            width: img.width,
            height: img.height,
            aspectRatio: (img.width / img.height).toFixed(2),
            format: dataUrl.match(/data:image\/(\w+);/)?.[1] || 'unknown'
        };
        
        // Extract colors if requested
        if (options.extractColors) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const scale = Math.min(1, 200 / Math.max(img.width, img.height));
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            results.analysis.colors = extractColors(imageData.data);
            results.analysis.brightness = calculateBrightness(imageData.data);
            results.analysis.contrast = calculateContrast(imageData.data);
        }
        
        // Generate description if requested
        if (options.generateDescription) {
            results.analysis.description = generateImageDescription(results);
        }
        
        // Simulate OCR if requested (would use real OCR in production)
        if (options.extractText) {
            results.analysis.extractedText = await simulateOCR(dataUrl);
        }
        
        // Simulate object detection if requested
        if (options.analyzeObjects) {
            results.analysis.detectedObjects = await simulateObjectDetection(dataUrl);
        }
        
    } catch (error) {
        console.error('Error processing image:', error);
    }
    
    return results;
}

// Load image promise
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// Calculate average brightness
function calculateBrightness(pixelData) {
    let totalBrightness = 0;
    let pixelCount = 0;
    
    for (let i = 0; i < pixelData.length; i += 4) {
        const r = pixelData[i];
        const g = pixelData[i + 1];
        const b = pixelData[i + 2];
        const a = pixelData[i + 3];
        
        if (a > 128) {
            const brightness = (r + g + b) / 3;
            totalBrightness += brightness;
            pixelCount++;
        }
    }
    
    return Math.round(totalBrightness / pixelCount);
}

// Calculate contrast
function calculateContrast(pixelData) {
    let min = 255, max = 0;
    
    for (let i = 0; i < pixelData.length; i += 4) {
        const r = pixelData[i];
        const g = pixelData[i + 1];
        const b = pixelData[i + 2];
        const a = pixelData[i + 3];
        
        if (a > 128) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            min = Math.min(min, gray);
            max = Math.max(max, gray);
        }
    }
    
    return ((max - min) / 255).toFixed(2);
}

// Generate image description based on analysis
function generateImageDescription(results) {
    const { metadata, analysis } = results;
    let description = [];
    
    // Size description
    if (metadata.width > 2000 || metadata.height > 2000) {
        description.push('高解像度画像');
    } else if (metadata.width < 500 && metadata.height < 500) {
        description.push('小さな画像');
    }
    
    // Aspect ratio
    const ratio = parseFloat(metadata.aspectRatio);
    if (ratio > 1.7) {
        description.push('横長の画像');
    } else if (ratio < 0.6) {
        description.push('縦長の画像');
    } else if (ratio > 0.95 && ratio < 1.05) {
        description.push('正方形に近い画像');
    }
    
    // Brightness
    if (analysis.brightness) {
        if (analysis.brightness > 200) {
            description.push('明るい画像');
        } else if (analysis.brightness < 50) {
            description.push('暗い画像');
        }
    }
    
    // Contrast
    if (analysis.contrast) {
        const contrast = parseFloat(analysis.contrast);
        if (contrast > 0.7) {
            description.push('コントラストが高い');
        } else if (contrast < 0.3) {
            description.push('コントラストが低い');
        }
    }
    
    // Colors
    if (analysis.colors && analysis.colors.length > 0) {
        description.push(`主要な色: ${analysis.colors.slice(0, 3).map(c => c.hex).join(', ')}`);
    }
    
    return description.join('、');
}

// Simulate OCR (placeholder - would use real OCR API in production)
async function simulateOCR(dataUrl) {
    // In production, this would call a real OCR service
    return '';
}

// Simulate object detection (placeholder - would use real ML model in production)
async function simulateObjectDetection(dataUrl) {
    // In production, this would use TensorFlow.js or similar
    return [];
}

// Store inspiration in localStorage for browser testing
function storeInspiration(inspiration) {
    const key = `novel-drive-inspirations-${currentProjectId}`;
    const stored = localStorage.getItem(key);
    const inspirations = stored ? JSON.parse(stored) : [];
    
    inspirations.unshift({
        ...inspiration,
        id: Date.now()
    });
    
    // Keep only last 100 items
    if (inspirations.length > 100) {
        inspirations.length = 100;
    }
    
    localStorage.setItem(key, JSON.stringify(inspirations));
}

// Handle image selection
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImageFile(file);
    }
}

// Handle image file with enhanced processing
function handleImageFile(file) {
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showError('画像サイズは10MB以下にしてください');
        return;
    }
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showError('JPEG、PNG、GIF、WebP形式の画像をアップロードしてください');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const preview = document.getElementById('image-preview');
        const dropContent = document.querySelector('.drop-zone-content');
        
        preview.src = e.target.result;
        preview.style.display = 'block';
        dropContent.style.display = 'none';
        
        // Store file data for processing
        const imageInput = document.getElementById('image-input');
        imageInput.dataset.path = file.name;
        imageInput.dataset.type = file.type;
        imageInput.dataset.dataUrl = e.target.result;
        
        // Enable submit button and show processing options
        document.querySelector('#image-form button[type="submit"]').disabled = false;
        showImageProcessingOptions();
        
        // Auto-analyze image for quick preview
        analyzeImagePreview(e.target.result);
    };
    
    reader.readAsDataURL(file);
}

// Show image processing options
function showImageProcessingOptions() {
    // Check if options already exist
    if (document.getElementById('image-processing-options')) return;
    
    const optionsHtml = `
        <div id="image-processing-options" class="processing-options">
            <h4>画像処理オプション</h4>
            <label>
                <input type="checkbox" id="extract-text" checked>
                テキスト抽出（OCR）
            </label>
            <label>
                <input type="checkbox" id="analyze-objects" checked>
                オブジェクト認識
            </label>
            <label>
                <input type="checkbox" id="extract-colors" checked>
                カラーパレット抽出
            </label>
            <label>
                <input type="checkbox" id="generate-description" checked>
                説明文生成
            </label>
        </div>
    `;
    
    const form = document.getElementById('image-form');
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.insertAdjacentHTML('beforebegin', optionsHtml);
}

// Analyze image for quick preview
async function analyzeImagePreview(dataUrl) {
    try {
        // Extract basic image info
        const img = new Image();
        img.onload = () => {
            const info = {
                width: img.width,
                height: img.height,
                aspectRatio: (img.width / img.height).toFixed(2)
            };
            
            // Display basic info
            displayImageInfo(info);
            
            // Extract dominant colors
            extractDominantColors(img);
        };
        img.src = dataUrl;
    } catch (error) {
        console.error('Failed to analyze image:', error);
    }
}

// Display image information
function displayImageInfo(info) {
    const infoHtml = `
        <div id="image-info" class="image-info">
            <small>
                サイズ: ${info.width} × ${info.height}px
                | アスペクト比: ${info.aspectRatio}
            </small>
        </div>
    `;
    
    const preview = document.getElementById('image-preview');
    if (!document.getElementById('image-info')) {
        preview.insertAdjacentHTML('afterend', infoHtml);
    }
}

// Extract dominant colors from image
function extractDominantColors(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Scale down for performance
    const scale = Math.min(1, 100 / Math.max(img.width, img.height));
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = extractColors(imageData.data);
        displayColorPalette(colors);
    } catch (error) {
        console.warn('Could not extract colors:', error);
    }
}

// Extract top colors from image data
function extractColors(pixelData) {
    const colorMap = {};
    
    // Sample every 4th pixel for performance
    for (let i = 0; i < pixelData.length; i += 16) {
        const r = pixelData[i];
        const g = pixelData[i + 1];
        const b = pixelData[i + 2];
        const a = pixelData[i + 3];
        
        if (a < 128) continue; // Skip transparent pixels
        
        // Quantize colors
        const qr = Math.round(r / 32) * 32;
        const qg = Math.round(g / 32) * 32;
        const qb = Math.round(b / 32) * 32;
        
        const key = `${qr},${qg},${qb}`;
        colorMap[key] = (colorMap[key] || 0) + 1;
    }
    
    // Sort by frequency and get top 5
    return Object.entries(colorMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([color]) => {
            const [r, g, b] = color.split(',').map(Number);
            return { r, g, b, hex: rgbToHex(r, g, b) };
        });
}

// Convert RGB to hex
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Display color palette
function displayColorPalette(colors) {
    const paletteHtml = `
        <div id="color-palette" class="color-palette">
            <small>主要な色:</small>
            <div class="color-swatches">
                ${colors.map(c => `
                    <div class="color-swatch" 
                         style="background-color: ${c.hex}" 
                         title="${c.hex}">
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    const imageInfo = document.getElementById('image-info');
    if (imageInfo && !document.getElementById('color-palette')) {
        imageInfo.insertAdjacentHTML('afterend', paletteHtml);
    }
}

// Reset image preview
function resetImagePreview() {
    const preview = document.getElementById('image-preview');
    const dropContent = document.querySelector('.drop-zone-content');
    
    preview.style.display = 'none';
    preview.src = '';
    dropContent.style.display = 'block';
    
    // Clear image input data
    const imageInput = document.getElementById('image-input');
    imageInput.value = '';
    imageInput.dataset.path = '';
    imageInput.dataset.type = '';
    imageInput.dataset.dataUrl = '';
    
    // Remove processing options
    const processingOptions = document.getElementById('image-processing-options');
    if (processingOptions) {
        processingOptions.remove();
    }
    
    // Remove image info
    const imageInfo = document.getElementById('image-info');
    if (imageInfo) {
        imageInfo.remove();
    }
    
    // Remove color palette
    const colorPalette = document.getElementById('color-palette');
    if (colorPalette) {
        colorPalette.remove();
    }
    
    document.querySelector('#image-form button[type="submit"]').disabled = true;
}

// Load entries
async function loadEntries() {
    if (!currentProjectId) {
        currentEntries = [];
        renderEntries();
        return;
    }
    
    try {
        const api = window.api || window.MockAPI;
        
        if (api) {
            const response = await api.invoke('anythingBox:getRecent', {
                projectId: currentProjectId,
                limit: 50
            });
            
            if (response.success) {
                currentEntries = response.data;
                renderEntries();
            } else {
                showError('エントリーの読み込みに失敗しました');
            }
        } else {
            // Load from localStorage for browser testing
            const key = `novel-drive-inspirations-${currentProjectId}`;
            const stored = localStorage.getItem(key);
            currentEntries = stored ? JSON.parse(stored) : [];
            renderEntries();
        }
    } catch (error) {
        console.error('Failed to load entries:', error);
        // Try localStorage as fallback
        const key = `novel-drive-inspirations-${currentProjectId}`;
        const stored = localStorage.getItem(key);
        currentEntries = stored ? JSON.parse(stored) : [];
        renderEntries();
    }
}

// Render entries
function renderEntries() {
    const container = document.getElementById('entries-container');
    const emptyState = document.getElementById('empty-state');
    
    const filteredEntries = filterEntriesByType(currentEntries);
    
    if (filteredEntries.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }
    
    container.style.display = 'block';
    emptyState.style.display = 'none';
    
    container.innerHTML = filteredEntries.map(entry => createEntryCard(entry)).join('');
}

// Filter entries by type
function filterEntriesByType(entries) {
    if (currentFilter === 'all') return entries;
    return entries.filter(entry => entry.type === currentFilter);
}

// Create entry card HTML
function createEntryCard(entry) {
    const metadata = entry.metadata ? JSON.parse(entry.metadata) : {};
    const inspirations = metadata.inspirations || [];
    
    return `
        <div class="entry-card" data-entry-id="${entry.id}">
            <div class="entry-header">
                <div>
                    <h3 class="entry-title">${escapeHtml(entry.title)}</h3>
                    <span class="entry-type type-${entry.type}">
                        ${getTypeIcon(entry.type)} ${getTypeLabel(entry.type)}
                    </span>
                </div>
                <div class="entry-actions">
                    <button class="secondary-btn" onclick="viewEntry(${entry.id})">
                        詳細
                    </button>
                    <button class="secondary-btn abstract-btn" onclick="abstractEntry(${entry.id})" title="このアイデアを抽象化して新しい発想を生む">
                        <span class="icon">🔄</span> 抽象化→具象化
                    </button>
                    <button class="secondary-btn" onclick="deleteEntry(${entry.id})">
                        削除
                    </button>
                </div>
            </div>
            
            <p class="entry-content">${escapeHtml(entry.content)}</p>
            
            ${inspirations.length > 0 ? `
                <div class="inspirations-preview">
                    <div class="inspirations-title">インスピレーション</div>
                    <div class="inspiration-tags">
                        ${inspirations.slice(0, 3).map(insp => `
                            <span class="inspiration-tag">${getInspirationTypeLabel(insp.type)}</span>
                        `).join('')}
                        ${inspirations.length > 3 ? `<span class="inspiration-tag">+${inspirations.length - 3}</span>` : ''}
                    </div>
                </div>
            ` : ''}
            
            <div class="entry-meta">
                <span class="entry-date">${new Date(entry.created_at).toLocaleString('ja-JP')}</span>
            </div>
        </div>
    `;
}

// Show inspirations
function showInspirations(data) {
    // Handle both entry format and direct inspiration data
    let title, content;
    
    if (data.type === 'image' && data.content) {
        // Enhanced image processing data
        title = data.title || '画像分析結果';
        content = formatImageInspirations(data.content);
    } else if (data.metadata) {
        // Standard entry format
        const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata;
        const inspirations = metadata.inspirations || [];
        
        if (inspirations.length === 0) return;
        
        title = data.title || 'インスピレーション';
        content = `
            <div class="inspiration-list">
                ${inspirations.map(insp => `
                    <div class="inspiration-item">
                        <div class="inspiration-type">${getInspirationTypeLabel(insp.type)}</div>
                        <div class="inspiration-text">${escapeHtml(insp.content)}</div>
                        <div class="inspiration-confidence">確信度: ${Math.round(insp.confidence * 100)}%</div>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (data.inspirations) {
        // Direct inspirations array
        title = data.title || 'インスピレーション';
        content = `
            <div class="inspiration-list">
                ${data.inspirations.map(insp => `
                    <div class="inspiration-item">
                        <div class="inspiration-type">${getInspirationTypeLabel(insp.type)}</div>
                        <div class="inspiration-text">${escapeHtml(insp.content)}</div>
                        ${insp.confidence ? `<div class="inspiration-confidence">確信度: ${Math.round(insp.confidence * 100)}%</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        return;
    }
    
    const modal = document.getElementById('inspiration-modal');
    if (!modal) {
        createInspirationModal();
    }
    
    const modalContent = document.getElementById('inspiration-content');
    modalContent.innerHTML = `
        <h4>${escapeHtml(title)}</h4>
        ${content}
    `;
    
    document.getElementById('inspiration-modal').style.display = 'flex';
}

// Format image inspirations from enhanced processing
function formatImageInspirations(imageData) {
    const { metadata, analysis } = imageData;
    let html = '<div class="image-inspiration-details">';
    
    // Metadata section
    if (metadata) {
        html += `
            <div class="inspiration-section">
                <h5>画像情報</h5>
                <p>サイズ: ${metadata.width} × ${metadata.height}px</p>
                <p>アスペクト比: ${metadata.aspectRatio}</p>
                <p>フォーマット: ${metadata.format}</p>
            </div>
        `;
    }
    
    // Analysis results
    if (analysis) {
        // Description
        if (analysis.description) {
            html += `
                <div class="inspiration-section">
                    <h5>画像の特徴</h5>
                    <p>${analysis.description}</p>
                </div>
            `;
        }
        
        // Colors
        if (analysis.colors && analysis.colors.length > 0) {
            html += `
                <div class="inspiration-section">
                    <h5>主要な色</h5>
                    <div class="color-swatches">
                        ${analysis.colors.map(c => `
                            <div class="color-swatch" 
                                 style="background-color: ${c.hex}" 
                                 title="${c.hex}">
                            </div>
                        `).join('')}
                    </div>
                    <p>明度: ${analysis.brightness || 'N/A'} / コントラスト: ${analysis.contrast || 'N/A'}</p>
                </div>
            `;
        }
        
        // Extracted text
        if (analysis.extractedText) {
            html += `
                <div class="inspiration-section">
                    <h5>抽出されたテキスト</h5>
                    <p>${escapeHtml(analysis.extractedText)}</p>
                </div>
            `;
        }
        
        // Detected objects
        if (analysis.detectedObjects && analysis.detectedObjects.length > 0) {
            html += `
                <div class="inspiration-section">
                    <h5>検出されたオブジェクト</h5>
                    <ul>
                        ${analysis.detectedObjects.map(obj => `
                            <li>${obj.label} (${Math.round(obj.confidence * 100)}%)</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
    }
    
    html += '</div>';
    return html;
}

// Create inspiration modal if it doesn't exist
function createInspirationModal() {
    const modal = document.createElement('div');
    modal.id = 'inspiration-modal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h3>インスピレーション詳細</h3>
                <button class="close-btn" onclick="hideInspirationModal()">✕</button>
            </div>
            <div id="inspiration-content" class="inspiration-content">
                <!-- Content will be inserted here -->
            </div>
            <div class="modal-actions">
                <button class="secondary-btn" onclick="hideInspirationModal()">閉じる</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Hide inspiration modal
function hideInspirationModal() {
    document.getElementById('inspiration-modal').style.display = 'none';
}

// View entry details
async function viewEntry(entryId) {
    try {
        const response = await window.api.invoke('anythingBox:getById', entryId);
        
        if (response.success) {
            showInspirations(response.data);
        }
    } catch (error) {
        console.error('Failed to load entry:', error);
        showError('エントリーの読み込みに失敗しました');
    }
}

// Delete entry
async function deleteEntry(entryId) {
    if (!confirm('このエントリーを削除しますか？')) return;
    
    try {
        const response = await window.api.invoke('anythingBox:delete', entryId);
        
        if (response.success) {
            await loadEntries();
            showSuccess('エントリーを削除しました');
        } else {
            showError('削除に失敗しました');
        }
    } catch (error) {
        console.error('Failed to delete entry:', error);
        showError('削除に失敗しました');
    }
}

// Perform search
async function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    
    if (!query || !currentProjectId) return;
    
    try {
        const response = await window.api.invoke('anythingBox:search', currentProjectId, query);
        
        if (response.success) {
            currentEntries = response.data;
            renderEntries();
        }
    } catch (error) {
        console.error('Search failed:', error);
        showError('検索に失敗しました');
    }
}

// Filter entries
function filterEntries() {
    renderEntries();
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTypeIcon(type) {
    const icons = {
        text: '📝',
        url: '🌐',
        image: '🖼️'
    };
    return icons[type] || '📄';
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

// Loading indicator
function showLoading(message = '処理中...') {
    // Remove any existing loading overlay
    hideLoading();
    
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-spinner-container">
            <div class="icon">⏳</div>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
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

// Handle URL AI Discussion
async function handleURLAIDiscussion() {
    const urlInput = document.getElementById('url-input');
    const url = urlInput.value.trim();
    
    if (!url) {
        showError('URLを入力してください');
        return;
    }
    
    if (!currentProjectId) {
        showError('プロジェクトを選択してください');
        return;
    }
    
    try {
        showLoading('AIエージェントがURLコンテンツを分析し、議論しています...');
        
        const api = window.api || window.MockAPI;
        
        if (api) {
            const response = await api.invoke('urlDiscussion:generateIdeas', {
                url: url,
                projectId: currentProjectId
            });
            
            if (response.success) {
                // Show discussion result modal
                showURLDiscussionResult(response.data);
                
                // Reload entries to show new ideas
                await loadEntries();
                
                // Clear form
                document.getElementById('url-form').reset();
                
                showSuccess('AIエージェントによる議論が完了しました');
            } else {
                showError('AIディスカッションに失敗しました: ' + response.error);
            }
        }
    } catch (error) {
        console.error('Failed to start URL AI discussion:', error);
        showError('AIディスカッションの開始に失敗しました');
    } finally {
        hideLoading();
    }
}

// Show URL Discussion Result Modal
function showURLDiscussionResult(result) {
    const modal = document.createElement('div');
    modal.className = 'modal url-discussion-modal';
    modal.style.display = 'flex';
    
    const stages = result.discussion.stages;
    const summary = result.summary;
    
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h3>AIエージェントによる議論結果</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
            </div>
            <div class="modal-body">
                <div class="discussion-summary">
                    <h4>💡 生成されたアイディア</h4>
                    <div class="summary-content">
                        <p><strong>${summary.decision || '新しい小説企画'}</strong></p>
                        <p>${summary.keyPoints || ''}</p>
                    </div>
                </div>
                
                <div class="discussion-stages">
                    <h4>🗣️ 議論の流れ</h4>
                    ${stages.map(stage => `
                        <div class="discussion-stage">
                            <div class="stage-header">
                                <span class="agent-name">${getAgentName(stage.agent)}</span>
                                <span class="stage-type">${getStageLabel(stage.stage)}</span>
                            </div>
                            <div class="stage-content">
                                ${formatStageContent(stage.content)}
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                ${result.ideas && result.ideas.length > 0 ? `
                    <div class="saved-ideas">
                        <h4>💾 保存されたアイディア</h4>
                        <p>${result.ideas.length}個のアイディアがナレッジベースに保存されました。</p>
                    </div>
                ` : ''}
            </div>
            <div class="modal-actions">
                <button class="secondary-btn" onclick="this.closest('.modal').remove()">
                    閉じる
                </button>
                ${result.ideas && result.ideas.length > 0 && result.ideas[0].id ? `
                    <button class="primary-btn" onclick="convertToPlot(${result.ideas[0].id})">
                        プロットに変換
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add CSS if not already present
    if (!document.getElementById('url-discussion-styles')) {
        const style = document.createElement('style');
        style.id = 'url-discussion-styles';
        style.textContent = `
            .url-discussion-modal .modal-content {
                max-height: 90vh;
                overflow-y: auto;
            }
            
            .discussion-summary {
                background: var(--bg-secondary);
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 2rem;
            }
            
            .discussion-summary h4 {
                margin-bottom: 1rem;
                color: var(--primary);
            }
            
            .summary-content {
                color: var(--text-primary);
            }
            
            .discussion-stages {
                margin-bottom: 2rem;
            }
            
            .discussion-stage {
                margin-bottom: 1.5rem;
                padding: 1rem;
                background: var(--bg-tertiary);
                border-radius: 6px;
            }
            
            .stage-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.5rem;
            }
            
            .agent-name {
                font-weight: 600;
                color: var(--primary);
            }
            
            .stage-type {
                font-size: 0.9rem;
                color: var(--text-secondary);
            }
            
            .stage-content {
                color: var(--text-primary);
                line-height: 1.6;
                max-height: 200px;
                overflow-y: auto;
            }
            
            .saved-ideas {
                background: var(--success-bg);
                padding: 1rem;
                border-radius: 6px;
                color: var(--success);
            }
            
            .button-group {
                display: flex;
                gap: 0.5rem;
            }
        `;
        document.head.appendChild(style);
    }
}

// Helper functions for URL Discussion
function getAgentName(agent) {
    const names = {
        analyst: '🔍 分析者',
        creative: '🎨 創造者',
        editor: '📝 編集者',
        all: '👥 全員'
    };
    return names[agent] || agent;
}

function getStageLabel(stage) {
    const labels = {
        analysis: '情報分析',
        ideation: 'アイディア発想',
        refinement: '企画整理',
        final_discussion: '最終議論'
    };
    return labels[stage] || stage;
}

function formatStageContent(content) {
    if (typeof content === 'string') {
        return escapeHtml(content).substring(0, 300) + '...';
    }
    
    if (content.analysis) {
        return escapeHtml(content.analysis).substring(0, 300) + '...';
    }
    
    if (content.ideas) {
        return escapeHtml(content.ideas).substring(0, 300) + '...';
    }
    
    if (content.refinedIdeas) {
        return escapeHtml(content.refinedIdeas).substring(0, 300) + '...';
    }
    
    if (content.discussion) {
        return escapeHtml(content.discussion).substring(0, 300) + '...';
    }
    
    return JSON.stringify(content).substring(0, 300) + '...';
}

// Convert idea to plot
async function convertToPlot(ideaId) {
    try {
        showLoading('プロットに変換中...');
        
        const api = window.api || window.MockAPI;
        const response = await api.invoke('urlDiscussion:convertToPlot', {
            ideaId: ideaId,
            projectId: currentProjectId
        });
        
        if (response.success) {
            showSuccess('プロットが作成されました');
            // Close modal
            document.querySelector('.url-discussion-modal')?.remove();
            
            // Optional: Navigate to plot page
            if (confirm('作成したプロットを確認しますか？')) {
                localStorage.setItem('selectedPlotId', response.data.id);
                window.location.href = './plot-management.html';
            }
        } else {
            showError('プロット変換に失敗しました: ' + response.error);
        }
    } catch (error) {
        console.error('Failed to convert to plot:', error);
        showError('プロット変換に失敗しました');
    } finally {
        hideLoading();
    }
}

// Make convertToPlot globally available
window.convertToPlot = convertToPlot;

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
            // Already on this page
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

// Abstract and concretize entry
async function abstractEntry(entryId) {
    const entry = currentEntries.find(e => e.id === entryId);
    if (!entry) return;
    
    try {
        showLoading('抽象化処理中...');
        
        // Create abstraction modal
        const modal = document.createElement('div');
        modal.className = 'modal abstraction-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>抽象化→具象化による発想転換</h3>
                    <button class="close-btn" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="original-content">
                        <h4>元のアイデア</h4>
                        <div class="content-box">
                            <p>${escapeHtml(entry.content)}</p>
                        </div>
                    </div>
                    
                    <div class="abstraction-process">
                        <div class="process-step" id="abstraction-step">
                            <h4>🔄 抽象化</h4>
                            <div class="step-content">
                                <p class="loading-text">アイデアの本質を抽出中...</p>
                            </div>
                        </div>
                        
                        <div class="process-arrow">→</div>
                        
                        <div class="process-step" id="concretization-step">
                            <h4>💡 具象化</h4>
                            <div class="step-content">
                                <p class="loading-text">新しい形に変換中...</p>
                            </div>
                        </div>
                    </div>
                    
                    <div id="abstraction-results" style="display: none;">
                        <h4>生成された新しいアイデア</h4>
                        <div id="new-ideas-container"></div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="secondary-btn" onclick="this.closest('.modal').remove()">
                        閉じる
                    </button>
                    <button id="save-abstracted-btn" class="primary-btn" style="display: none;" onclick="saveAbstractedIdeas()">
                        新しいアイデアを保存
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add styles
        if (!document.getElementById('abstraction-styles')) {
            const style = document.createElement('style');
            style.id = 'abstraction-styles';
            style.textContent = `
                .abstraction-modal .modal-content {
                    max-width: 800px;
                }
                
                .content-box {
                    background: var(--bg-secondary);
                    padding: 1rem;
                    border-radius: 6px;
                    margin-bottom: 1.5rem;
                }
                
                .abstraction-process {
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                    margin: 2rem 0;
                }
                
                .process-step {
                    flex: 1;
                    background: var(--bg-tertiary);
                    padding: 1.5rem;
                    border-radius: 8px;
                    text-align: center;
                }
                
                .process-step h4 {
                    margin-bottom: 1rem;
                    color: var(--primary);
                }
                
                .process-arrow {
                    font-size: 2rem;
                    color: var(--primary);
                }
                
                .step-content {
                    min-height: 100px;
                }
                
                .loading-text {
                    color: var(--text-secondary);
                    font-style: italic;
                }
                
                .abstracted-content {
                    background: var(--bg-secondary);
                    padding: 1rem;
                    border-radius: 6px;
                    margin-bottom: 1rem;
                }
                
                .abstraction-level {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                }
                
                .new-idea-card {
                    background: var(--bg-secondary);
                    padding: 1.5rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    border: 2px solid transparent;
                    transition: all 0.2s;
                }
                
                .new-idea-card:hover {
                    border-color: var(--primary);
                }
                
                .idea-variation {
                    font-size: 0.9rem;
                    color: var(--primary);
                    margin-bottom: 0.5rem;
                }
                
                .idea-axis {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                    font-style: italic;
                }
                
                .abstraction-axis-group {
                    margin-bottom: 1.5rem;
                    padding: 1rem;
                    background: var(--bg-tertiary);
                    border-radius: 8px;
                }
                
                .axis-title {
                    color: var(--primary);
                    margin-bottom: 0.8rem;
                    font-weight: bold;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Perform abstraction
        await performAbstraction(entry, modal);
        
    } catch (error) {
        console.error('Failed to abstract entry:', error);
        showError('抽象化処理に失敗しました');
    } finally {
        hideLoading();
    }
}

// Perform abstraction process
async function performAbstraction(entry, modal) {
    try {
        const api = window.api || window.MockAPI;
        
        // Step 1: Abstract the idea
        const abstractionStep = modal.querySelector('#abstraction-step .step-content');
        
        const abstractionResponse = await api.invoke('anythingBox:abstract', {
            content: entry.content,
            type: entry.type,
            projectId: currentProjectId
        });
        
        if (abstractionResponse.success && abstractionResponse.data) {
            const abstractions = abstractionResponse.data.abstractions || [];
            
            // abstractionsが配列であることを確認
            if (!Array.isArray(abstractions)) {
                console.error('Abstractions is not an array:', abstractions);
                throw new Error('抽象化結果の形式が不正です');
            }
            
            // 軸ごとにグループ化して表示
            const groupedAbstractions = {};
            abstractions.forEach(abs => {
                // absが存在し、axisプロパティがあることを確認
                if (!abs || typeof abs !== 'object') {
                    console.warn('Invalid abstraction item:', abs);
                    return;
                }
                
                const axis = abs.axis || 'その他';
                if (!groupedAbstractions[axis]) {
                    groupedAbstractions[axis] = [];
                }
                groupedAbstractions[axis].push(abs);
            });
            
            abstractionStep.innerHTML = Object.entries(groupedAbstractions).map(([axis, items]) => `
                <div class="abstraction-axis-group">
                    <h5 class="axis-title">${axis}軸の抽象化</h5>
                    ${items.map(abs => `
                        <div class="abstracted-content">
                            <div class="abstraction-level">抽象度: ${abs.level || '不明'}</div>
                            <p>${escapeHtml(abs.content || 'コンテンツが見つかりません')}</p>
                        </div>
                    `).join('')}
                </div>
            `).join('');
            
            // Step 2: Concretize into new forms
            const concretizationStep = modal.querySelector('#concretization-step .step-content');
            
            const concretizationResponse = await api.invoke('anythingBox:concretize', {
                abstractions: abstractions,
                originalContent: entry.content,
                projectId: currentProjectId
            });
            
            if (concretizationResponse.success && concretizationResponse.data) {
                const newIdeas = concretizationResponse.data.ideas || [];
                
                if (!Array.isArray(newIdeas)) {
                    console.error('New ideas is not an array:', newIdeas);
                    throw new Error('具体化結果の形式が不正です');
                }
                
                concretizationStep.innerHTML = `
                    <p class="success-text">✓ ${newIdeas.length}個の新しいアイデアを生成しました</p>
                `;
                
                // Show results
                const resultsContainer = modal.querySelector('#abstraction-results');
                const ideasContainer = modal.querySelector('#new-ideas-container');
                
                ideasContainer.innerHTML = newIdeas.map((idea, index) => {
                    // ideaが存在することを確認
                    if (!idea || typeof idea !== 'object') {
                        console.warn('Invalid idea item:', idea);
                        return '';
                    }
                    
                    return `
                    <div class="new-idea-card" data-idea-index="${index}">
                        <div class="idea-variation">バリエーション ${index + 1}: ${idea.variation || '不明'}</div>
                        ${idea.abstractionAxis ? `<div class="idea-axis">抽象化軸: ${idea.abstractionAxis}（${idea.abstractionLevel || '不明'}）</div>` : ''}
                        <h5>${escapeHtml(idea.title || 'タイトルなし')}</h5>
                        <p>${escapeHtml(idea.content || 'コンテンツが見つかりません')}</p>
                        ${idea.explanation ? `<p class="idea-explanation">${escapeHtml(idea.explanation)}</p>` : ''}
                    </div>
                `;
                }).join('');
                
                resultsContainer.style.display = 'block';
                
                // Enable save button
                const saveBtn = modal.querySelector('#save-abstracted-btn');
                saveBtn.style.display = 'block';
                saveBtn.dataset.ideas = JSON.stringify(newIdeas);
                saveBtn.dataset.originalId = entry.id;
            } else {
                // Handle concretization failure
                concretizationStep.innerHTML = `
                    <p class="error-text">✗ 具体化に失敗しました: ${concretizationResponse.error || '不明なエラー'}</p>
                `;
                console.error('Concretization failed:', concretizationResponse);
            }
        } else {
            // Handle abstraction failure
            abstractionStep.innerHTML = `
                <p class="error-text">✗ 抽象化に失敗しました: ${abstractionResponse.error || '不明なエラー'}</p>
            `;
            console.error('Abstraction failed:', abstractionResponse);
        }
        
    } catch (error) {
        console.error('Abstraction process failed:', error);
        throw error;
    }
}

// Save abstracted ideas
async function saveAbstractedIdeas() {
    const btn = event.target;
    const ideas = JSON.parse(btn.dataset.ideas);
    const originalId = btn.dataset.originalId;
    
    try {
        showLoading('新しいアイデアを保存中...');
        
        const api = window.api || window.MockAPI;
        
        // Save each idea as a new entry
        for (const idea of ideas) {
            await api.invoke('anythingBox:create', {
                type: 'text',
                title: idea.title,
                content: idea.content,
                tags: ['抽象化', '発想転換', idea.variation],
                projectId: currentProjectId,
                metadata: {
                    source: 'abstraction',
                    originalEntryId: originalId,
                    variation: idea.variation,
                    explanation: idea.explanation
                }
            });
        }
        
        showSuccess(`${ideas.length}個の新しいアイデアを保存しました`);
        
        // Close modal and reload entries
        btn.closest('.modal').remove();
        await loadEntries();
        
    } catch (error) {
        console.error('Failed to save abstracted ideas:', error);
        showError('アイデアの保存に失敗しました');
    } finally {
        hideLoading();
    }
}

// Make functions available globally
window.viewEntry = viewEntry;
window.deleteEntry = deleteEntry;
window.hideInspirationModal = hideInspirationModal;
window.abstractEntry = abstractEntry;
window.saveAbstractedIdeas = saveAbstractedIdeas;