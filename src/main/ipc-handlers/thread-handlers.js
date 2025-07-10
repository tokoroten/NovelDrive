const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// スレッドデータの保存先
const getThreadFilePath = () => {
    const userDataPath = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share');
    const appDataPath = path.join(userDataPath, 'noveldrive');
    return path.join(appDataPath, 'ai-threads.json');
};

// スレッドデータを読み込み
async function loadThreads() {
    try {
        const filePath = getThreadFilePath();
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // ファイルが存在しない場合はデフォルトデータを返す
        return {
            version: '1.0',
            threads: [],
            lastSaved: new Date().toISOString()
        };
    }
}

// スレッドデータを保存
async function saveThreads(data) {
    try {
        const filePath = getThreadFilePath();
        const dirPath = path.dirname(filePath);
        
        // ディレクトリが存在しない場合は作成
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
        
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        return { success: true };
    } catch (error) {
        console.error('Failed to save threads:', error);
        throw error;
    }
}

function setupThreadHandlers() {
    // スレッドデータの読み込み
    ipcMain.handle('thread:load', async () => {
        try {
            return await loadThreads();
        } catch (error) {
            console.error('Error loading threads:', error);
            throw error;
        }
    });
    
    // スレッドデータの保存
    ipcMain.handle('thread:save', async (event, data) => {
        try {
            return await saveThreads(data);
        } catch (error) {
            console.error('Error saving threads:', error);
            throw error;
        }
    });
    
    // 特定のプロジェクトのスレッドを取得
    ipcMain.handle('thread:getByProject', async (event, projectId) => {
        try {
            const data = await loadThreads();
            const projectThreads = data.threads.filter(thread => thread.projectId === projectId);
            return projectThreads;
        } catch (error) {
            console.error('Error getting project threads:', error);
            throw error;
        }
    });
    
    // スレッドのクリア
    ipcMain.handle('thread:clear', async (event, { agentId, projectId }) => {
        try {
            const data = await loadThreads();
            data.threads = data.threads.filter(thread => 
                !(thread.agentId === agentId && thread.projectId === projectId)
            );
            data.lastSaved = new Date().toISOString();
            await saveThreads(data);
            return { success: true };
        } catch (error) {
            console.error('Error clearing thread:', error);
            throw error;
        }
    });
}

module.exports = { setupThreadHandlers };