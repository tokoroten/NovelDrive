const { ipcMain, dialog, shell, app } = require('electron');
const { getLogger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const logger = getLogger('settings-handlers');

function registerSettingsHandlers(db) {
    const SettingsRepository = require('../repositories/settings-repository');
    const settingsRepo = new SettingsRepository(db);

    // Get settings
    ipcMain.handle('settings:get', async () => {
        try {
            const settings = await settingsRepo.load();
            return { success: true, data: settings };
        } catch (error) {
            logger.error('Failed to get settings:', error);
            return { success: false, error: error.message };
        }
    });

    // Save settings
    ipcMain.handle('settings:save', async (event, settings) => {
        try {
            await settingsRepo.save(settings);
            return { success: true };
        } catch (error) {
            logger.error('Failed to save settings:', error);
            return { success: false, error: error.message };
        }
    });

    // Reset settings
    ipcMain.handle('settings:reset', async () => {
        try {
            await settingsRepo.reset();
            return { success: true };
        } catch (error) {
            logger.error('Failed to reset settings:', error);
            return { success: false, error: error.message };
        }
    });

    // Get specific setting
    ipcMain.handle('settings:getValue', async (event, key) => {
        try {
            const value = await settingsRepo.get(key);
            return { success: true, data: value };
        } catch (error) {
            logger.error('Failed to get setting value:', error);
            return { success: false, error: error.message };
        }
    });

    // Set specific setting
    ipcMain.handle('settings:setValue', async (event, { key, value }) => {
        try {
            await settingsRepo.set(key, value);
            return { success: true };
        } catch (error) {
            logger.error('Failed to set setting value:', error);
            return { success: false, error: error.message };
        }
    });

    // Export settings
    ipcMain.handle('settings:export', async () => {
        try {
            const settings = await settingsRepo.export();
            return { success: true, data: settings };
        } catch (error) {
            logger.error('Failed to export settings:', error);
            return { success: false, error: error.message };
        }
    });

    // Import settings
    ipcMain.handle('settings:import', async (event, settings) => {
        try {
            await settingsRepo.import(settings);
            return { success: true };
        } catch (error) {
            logger.error('Failed to import settings:', error);
            return { success: false, error: error.message };
        }
    });

    // Dialog handlers
    ipcMain.handle('dialog:selectDirectory', async () => {
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'データ保存場所を選択'
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
                return { success: true, data: result.filePaths[0] };
            }
            
            return { success: false };
        } catch (error) {
            logger.error('Failed to select directory:', error);
            return { success: false, error: error.message };
        }
    });

    // Cache handlers
    ipcMain.handle('cache:clear', async () => {
        try {
            // Clear embeddings cache
            const cacheDir = path.join(app.getPath('userData'), 'cache');
            await clearDirectory(cacheDir);
            
            // Clear temporary files
            const tempDir = path.join(app.getPath('temp'), 'noveldrive');
            await clearDirectory(tempDir);
            
            logger.info('Cache cleared successfully');
            return { success: true };
        } catch (error) {
            logger.error('Failed to clear cache:', error);
            return { success: false, error: error.message };
        }
    });

    // Shell handlers
    ipcMain.handle('shell:openExternal', async (event, { url }) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            logger.error('Failed to open external URL:', error);
            return { success: false, error: error.message };
        }
    });

    // App info handlers
    ipcMain.handle('app:getVersionInfo', async () => {
        try {
            return {
                success: true,
                data: {
                    version: app.getVersion(),
                    electron: process.versions.electron,
                    node: process.versions.node,
                    chrome: process.versions.chrome,
                    v8: process.versions.v8
                }
            };
        } catch (error) {
            logger.error('Failed to get version info:', error);
            return { success: false, error: error.message };
        }
    });

    // Check for updates (mock implementation)
    ipcMain.handle('app:checkForUpdates', async () => {
        try {
            // In a real implementation, this would check a server for updates
            return {
                success: true,
                data: {
                    updateAvailable: false,
                    currentVersion: app.getVersion(),
                    latestVersion: app.getVersion()
                }
            };
        } catch (error) {
            logger.error('Failed to check for updates:', error);
            return { success: false, error: error.message };
        }
    });

    // Backup handlers
    ipcMain.handle('backup:list', async () => {
        try {
            const backupDir = path.join(app.getPath('userData'), 'backups');
            
            // Ensure backup directory exists
            try {
                await fs.access(backupDir);
            } catch {
                await fs.mkdir(backupDir, { recursive: true });
                return { success: true, data: [] };
            }
            
            const files = await fs.readdir(backupDir);
            const backups = [];
            
            for (const file of files) {
                if (file.endsWith('.db.backup') || file.endsWith('.backup')) {
                    const filePath = path.join(backupDir, file);
                    const stat = await fs.stat(filePath);
                    
                    backups.push({
                        name: file,
                        path: filePath,
                        size: stat.size,
                        created: stat.birthtime,
                        modified: stat.mtime
                    });
                }
            }
            
            // Sort by creation date (newest first)
            backups.sort((a, b) => new Date(b.created) - new Date(a.created));
            
            return { success: true, data: backups };
        } catch (error) {
            logger.error('Failed to list backups:', error);
            return { success: false, error: error.message };
        }
    });

    // Storage info handler
    ipcMain.handle('storage:getInfo', async () => {
        try {
            const userDataPath = app.getPath('userData');
            const dbPath = path.join(userDataPath, 'noveldrive.db');
            const cacheDir = path.join(userDataPath, 'cache');
            const backupDir = path.join(userDataPath, 'backups');
            
            // Get database size
            let dbSize = 0;
            try {
                const dbStat = await fs.stat(dbPath);
                dbSize = dbStat.size;
            } catch {
                // Database might not exist yet
            }
            
            // Get cache size
            let cacheSize = 0;
            try {
                cacheSize = await getDirectorySize(cacheDir);
            } catch {
                // Cache directory might not exist
            }
            
            // Get backup size
            let backupSize = 0;
            try {
                backupSize = await getDirectorySize(backupDir);
            } catch {
                // Backup directory might not exist
            }
            
            // Get disk space info
            const diskUsage = await getDiskUsage(userDataPath);
            
            return {
                success: true,
                data: {
                    database: {
                        size: dbSize,
                        path: dbPath
                    },
                    cache: {
                        size: cacheSize,
                        path: cacheDir
                    },
                    backups: {
                        size: backupSize,
                        path: backupDir
                    },
                    disk: diskUsage,
                    total: dbSize + cacheSize + backupSize
                }
            };
        } catch (error) {
            logger.error('Failed to get storage info:', error);
            return { success: false, error: error.message };
        }
    });

    logger.info('Settings handlers registered');
}

// Helper function to clear directory
async function clearDirectory(dirPath) {
    try {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);
            
            if (stat.isDirectory()) {
                await clearDirectory(filePath);
                await fs.rmdir(filePath);
            } else {
                await fs.unlink(filePath);
            }
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
}

// Helper function to get directory size
async function getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = await fs.stat(filePath);
            
            if (stat.isDirectory()) {
                totalSize += await getDirectorySize(filePath);
            } else {
                totalSize += stat.size;
            }
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
    
    return totalSize;
}

// Helper function to get disk usage
async function getDiskUsage(dirPath) {
    const { execSync } = require('child_process');
    
    try {
        let command;
        let output;
        
        if (process.platform === 'win32') {
            // Windows: use wmic to get disk free space
            const drive = path.parse(dirPath).root;
            command = `wmic logicaldisk where size!="0" get size,freespace,caption`;
            output = execSync(command, { encoding: 'utf8' });
            
            const lines = output.split('\n').filter(line => line.trim());
            for (const line of lines) {
                if (line.includes(drive.charAt(0))) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 3) {
                        return {
                            free: parseInt(parts[1]) || 0,
                            total: parseInt(parts[2]) || 0
                        };
                    }
                }
            }
        } else {
            // Unix-like: use df command
            command = `df -k "${dirPath}"`;
            output = execSync(command, { encoding: 'utf8' });
            
            const lines = output.split('\n');
            if (lines.length > 1) {
                const parts = lines[1].trim().split(/\s+/);
                if (parts.length >= 4) {
                    return {
                        free: parseInt(parts[3]) * 1024, // Convert from KB to bytes
                        total: parseInt(parts[1]) * 1024 // Convert from KB to bytes
                    };
                }
            }
        }
        
        // Fallback if parsing fails
        return {
            free: 0,
            total: 0
        };
    } catch (error) {
        logger.warn('Failed to get disk usage:', error);
        return {
            free: 0,
            total: 0
        };
    }
}

module.exports = { registerSettingsHandlers };