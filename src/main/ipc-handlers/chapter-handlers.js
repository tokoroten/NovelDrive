const { ipcMain, app } = require('electron');
const { getLogger } = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

const logger = getLogger('chapter-handlers');

/**
 * Setup chapter-related IPC handlers
 */
function setupChapterHandlers(db) {
    const dataPath = path.join(app.getPath('userData'), 'chapters');
    const { RepositoryFactory } = require('../repositories');
    const repositories = new RepositoryFactory(db);
    
    // Ensure chapters directory exists
    ensureChaptersDirectory();
    
    // Get chapter content
    ipcMain.handle('chapter:getContent', async (event, { plotId, chapterId }) => {
        try {
            const filePath = getChapterFilePath(plotId, chapterId);
            
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                return content;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // File doesn't exist yet
                    return '';
                }
                throw error;
            }
        } catch (error) {
            logger.error('Error getting chapter content:', error);
            throw error;
        }
    });
    
    // Save chapter content
    ipcMain.handle('chapter:saveContent', async (event, { plotId, chapterId, content }) => {
        try {
            const filePath = getChapterFilePath(plotId, chapterId);
            const dir = path.dirname(filePath);
            
            // Ensure directory exists
            await fs.mkdir(dir, { recursive: true });
            
            // Save content
            await fs.writeFile(filePath, content, 'utf-8');
            
            // Create backup
            await createBackup(filePath, content);
            
            logger.info(`Saved chapter content: plot ${plotId}, chapter ${chapterId}`);
            return { success: true };
        } catch (error) {
            logger.error('Error saving chapter content:', error);
            throw error;
        }
    });
    
    // Get chapter notes
    ipcMain.handle('chapter:getNotes', async (event, { plotId, chapterId }) => {
        try {
            const filePath = getNotesFilePath(plotId, chapterId);
            
            try {
                const notes = await fs.readFile(filePath, 'utf-8');
                return notes;
            } catch (error) {
                if (error.code === 'ENOENT') {
                    return '';
                }
                throw error;
            }
        } catch (error) {
            logger.error('Error getting chapter notes:', error);
            throw error;
        }
    });
    
    // Save chapter notes
    ipcMain.handle('chapter:saveNotes', async (event, { plotId, chapterId, notes }) => {
        try {
            const filePath = getNotesFilePath(plotId, chapterId);
            const dir = path.dirname(filePath);
            
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, notes, 'utf-8');
            
            return { success: true };
        } catch (error) {
            logger.error('Error saving chapter notes:', error);
            throw error;
        }
    });
    
    // Export chapter
    ipcMain.handle('chapter:export', async (event, { plotId, chapterId, format }) => {
        try {
            const content = await getChapterContent(plotId, chapterId);
            const chapter = await getChapterInfo(plotId, chapterId, repositories);
            
            switch (format) {
                case 'txt':
                    return exportAsText(chapter, content);
                case 'md':
                    return exportAsMarkdown(chapter, content);
                case 'html':
                    return exportAsHTML(chapter, content);
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            logger.error('Error exporting chapter:', error);
            throw error;
        }
    });
    
    // Get writing statistics
    ipcMain.handle('stats:getWriting', async (event, { projectId }) => {
        try {
            const stats = await calculateWritingStats(projectId, repositories);
            return stats;
        } catch (error) {
            logger.error('Error getting writing stats:', error);
            throw error;
        }
    });

    // Get chapters by project
    ipcMain.handle('chapter:list', async (event, projectId) => {
        try {
            if (!projectId) {
                throw new Error('Project ID is required');
            }
            
            const chapters = await repositories.chapters.findBy('project_id', projectId);
            return chapters;
        } catch (error) {
            logger.error('Error listing chapters:', error);
            throw error;
        }
    });
    
    logger.info('Chapter handlers initialized');
}

// Helper functions

async function ensureChaptersDirectory() {
    const dataPath = path.join(app.getPath('userData'), 'chapters');
    await fs.mkdir(dataPath, { recursive: true });
}

function getChapterFilePath(plotId, chapterId) {
    return path.join(
        app.getPath('userData'),
        'chapters',
        `plot_${plotId}`,
        `chapter_${chapterId}.txt`
    );
}

function getNotesFilePath(plotId, chapterId) {
    return path.join(
        app.getPath('userData'),
        'chapters',
        `plot_${plotId}`,
        `chapter_${chapterId}_notes.txt`
    );
}

async function createBackup(filePath, content) {
    const backupPath = filePath.replace('.txt', `_backup_${Date.now()}.txt`);
    const backupDir = path.join(path.dirname(filePath), 'backups');
    
    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(
        path.join(backupDir, path.basename(backupPath)),
        content,
        'utf-8'
    );
    
    // Keep only last 10 backups
    await cleanupOldBackups(backupDir);
}

async function cleanupOldBackups(backupDir) {
    try {
        const files = await fs.readdir(backupDir);
        const backupFiles = files
            .filter(f => f.includes('_backup_'))
            .map(f => ({
                name: f,
                path: path.join(backupDir, f),
                timestamp: parseInt(f.match(/_backup_(\d+)/)[1])
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
        
        // Delete old backups
        for (let i = 10; i < backupFiles.length; i++) {
            await fs.unlink(backupFiles[i].path);
        }
    } catch (error) {
        logger.warn('Error cleaning up backups:', error);
    }
}

async function getChapterContent(plotId, chapterId) {
    const filePath = getChapterFilePath(plotId, chapterId);
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return '';
        }
        throw error;
    }
}

async function getChapterInfo(plotId, chapterId, repositories) {
    // Get chapter info from database
    const plot = await repositories.plots.get(plotId);
    
    return plot.chapters.find(ch => ch.id === chapterId);
}

function exportAsText(chapter, content) {
    return {
        filename: `${chapter.title}.txt`,
        content: `${chapter.title}\n${'='.repeat(chapter.title.length)}\n\n${content}`
    };
}

function exportAsMarkdown(chapter, content) {
    const markdown = `# ${chapter.title}\n\n${content.split('\n\n').map(p => p.trim()).join('\n\n')}`;
    
    return {
        filename: `${chapter.title}.md`,
        content: markdown
    };
}

function exportAsHTML(chapter, content) {
    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>${chapter.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', sans-serif;
            line-height: 1.8;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
        }
        h1 {
            border-bottom: 2px solid #333;
            padding-bottom: 0.5rem;
        }
        p {
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <h1>${chapter.title}</h1>
    ${content.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('\n    ')}
</body>
</html>`;
    
    return {
        filename: `${chapter.title}.html`,
        content: html
    };
}

async function calculateWritingStats(projectId, repositories) {
    
    let totalChars = 0;
    let todayChars = 0;
    const today = new Date().toDateString();
    
    if (projectId) {
        const plots = await repositories.plots.getByProject(projectId);
        
        for (const plot of plots) {
            for (const chapter of plot.chapters || []) {
                totalChars += chapter.wordCount || 0;
                
                // Check if updated today
                if (new Date(chapter.updatedAt).toDateString() === today) {
                    // This is a simplified calculation
                    // In a real app, you'd track actual changes
                    todayChars += Math.floor((chapter.wordCount || 0) * 0.1);
                }
            }
        }
    }
    
    return {
        totalChars,
        todayChars,
        sessionStart: new Date()
    };
}

module.exports = setupChapterHandlers;