// Display version information
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };

    // Version information - window.api is exposed by preload script
    replaceText('electron-version', 'Loading...');
    replaceText('node-version', 'Loading...');
    replaceText('chrome-version', 'Loading...');
    replaceText('platform', 'Loading...');
    replaceText('arch', 'Loading...');

    // Initialize counter display
    loadCounter();
    loadItems();

    // Counter button handler
    document.getElementById('increment-btn').addEventListener('click', async () => {
        try {
            const response = await window.api.invoke('db:incrementCounter');
            if (response.success) {
                document.getElementById('counter-value').innerText = response.data;
            } else {
                console.error('Failed to increment counter:', response.error);
                showError('カウンターの更新に失敗しました');
            }
        } catch (error) {
            console.error('Failed to increment counter:', error);
            showError('カウンターの更新に失敗しました');
        }
    });

    // Add item button handler
    document.getElementById('add-item-btn').addEventListener('click', async () => {
        const input = document.getElementById('item-input');
        const text = input.value.trim();
        
        if (text) {
            try {
                const response = await window.api.invoke('db:addItem', text);
                if (response.success) {
                    input.value = '';
                    loadItems();
                } else {
                    console.error('Failed to add item:', response.error);
                    showError(response.error.message || 'アイテムの追加に失敗しました');
                }
            } catch (error) {
                console.error('Failed to add item:', error);
                showError('アイテムの追加に失敗しました');
            }
        }
    });

    // Enter key handler for item input
    document.getElementById('item-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('add-item-btn').click();
        }
    });
});

async function loadCounter() {
    try {
        const response = await window.api.invoke('db:getCounter');
        if (response.success) {
            document.getElementById('counter-value').innerText = response.data;
        } else {
            console.error('Failed to load counter:', response.error);
            showError('カウンターの読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Failed to load counter:', error);
        showError('カウンターの読み込みに失敗しました');
    }
}

async function loadItems() {
    try {
        const response = await window.api.invoke('db:getItems');
        if (response.success) {
            const items = response.data;
            const listElement = document.getElementById('items-list');
            
            listElement.innerHTML = items.map(item => `
                <li style="padding: 8px; background-color: white; margin-bottom: 5px; border-radius: 4px;">
                    ${escapeHtml(item.text)} <small style="color: #666;">(${new Date(item.createdAt).toLocaleString('ja-JP')})</small>
                </li>
            `).join('');
            
            if (items.length === 0) {
                listElement.innerHTML = '<li style="padding: 8px; color: #666;">アイテムがありません</li>';
            }
        } else {
            console.error('Failed to load items:', response.error);
            showError('アイテムの読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Failed to load items:', error);
        showError('アイテムの読み込みに失敗しました');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    // Simple error display - could be improved with a proper notification system
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #f44336;
        color: white;
        padding: 16px;
        border-radius: 4px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 1000;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}