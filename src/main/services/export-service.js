const fs = require('fs').promises;
const path = require('path');
const { dialog } = require('electron');
const { getLogger } = require('../utils/logger');

/**
 * Export Service - Handles various export formats
 */
class ExportService {
    constructor() {
        this.logger = getLogger('export-service');
        this.formats = {
            txt: this.exportToTxt.bind(this),
            md: this.exportToMarkdown.bind(this),
            docx: this.exportToDocx.bind(this),
            pdf: this.exportToPdf.bind(this)
        };
    }

    /**
     * Export content to specified format
     * @param {Object} options
     * @returns {Promise<string>} File path of exported file
     */
    async export(options) {
        const {
            content,
            format = 'txt',
            title = 'Untitled',
            metadata = {},
            includeMetadata = true,
            includeNotes = false,
            customPath = null
        } = options;

        // Get export function
        const exportFn = this.formats[format];
        if (!exportFn) {
            throw new Error(`Unsupported export format: ${format}`);
        }

        // Determine save path
        let filePath;
        if (customPath) {
            filePath = customPath;
        } else {
            // Show save dialog
            const result = await dialog.showSaveDialog({
                title: 'エクスポート先を選択',
                defaultPath: this.generateFileName(title, format),
                filters: this.getFileFilters(format)
            });

            if (result.canceled) {
                throw new Error('Export canceled by user');
            }

            filePath = result.filePath;
        }

        // Prepare content with metadata if requested
        let fullContent = content;
        if (includeMetadata) {
            fullContent = this.addMetadata(content, metadata, format);
        }

        // Export to file
        await exportFn(fullContent, filePath, options);

        this.logger.info(`Exported to ${format}: ${filePath}`);
        return filePath;
    }

    /**
     * Export to plain text
     */
    async exportToTxt(content, filePath, options) {
        await fs.writeFile(filePath, content, 'utf8');
    }

    /**
     * Export to Markdown
     */
    async exportToMarkdown(content, filePath, options) {
        const { title, metadata } = options;
        
        let mdContent = '';
        
        // Add title
        if (title) {
            mdContent += `# ${title}\n\n`;
        }
        
        // Add metadata as frontmatter
        if (metadata && Object.keys(metadata).length > 0) {
            mdContent += '---\n';
            Object.entries(metadata).forEach(([key, value]) => {
                mdContent += `${key}: ${value}\n`;
            });
            mdContent += '---\n\n';
        }
        
        // Add content
        mdContent += content;
        
        await fs.writeFile(filePath, mdContent, 'utf8');
    }

    /**
     * Export to DOCX (Microsoft Word)
     */
    async exportToDocx(content, filePath, options) {
        // This would require a library like docx
        // For now, we'll create a simple RTF file that Word can open
        const rtfContent = this.convertToRtf(content, options);
        
        // Change extension to .rtf if it's .docx
        const rtfPath = filePath.replace(/\.docx$/, '.rtf');
        await fs.writeFile(rtfPath, rtfContent, 'utf8');
        
        return rtfPath;
    }

    /**
     * Export to PDF
     */
    async exportToPdf(content, filePath, options) {
        // This would require electron's printToPDF or a library like puppeteer
        // For now, we'll throw an error
        throw new Error('PDF export is not yet implemented');
    }

    /**
     * Convert content to RTF format
     */
    convertToRtf(content, options) {
        const { title = '', metadata = {} } = options;
        
        // Basic RTF header
        let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Times New Roman;}}\\f0\\fs24';
        
        // Add title
        if (title) {
            rtf += `\\fs32\\b ${this.escapeRtf(title)}\\b0\\fs24\\par\\par`;
        }
        
        // Add metadata
        if (Object.keys(metadata).length > 0) {
            rtf += '\\fs20\\i ';
            Object.entries(metadata).forEach(([key, value]) => {
                rtf += `${this.escapeRtf(key)}: ${this.escapeRtf(String(value))}\\par `;
            });
            rtf += '\\i0\\fs24\\par\\par';
        }
        
        // Add content with paragraph breaks
        const paragraphs = content.split('\n\n');
        paragraphs.forEach(para => {
            if (para.trim()) {
                rtf += this.escapeRtf(para) + '\\par\\par';
            }
        });
        
        rtf += '}';
        return rtf;
    }

    /**
     * Escape special characters for RTF
     */
    escapeRtf(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/{/g, '\\{')
            .replace(/}/g, '\\}')
            .replace(/\n/g, '\\par ');
    }

    /**
     * Add metadata to content
     */
    addMetadata(content, metadata, format) {
        const metaInfo = {
            exportDate: new Date().toISOString(),
            wordCount: this.countWords(content),
            charCount: content.length,
            ...metadata
        };

        let metaString = '';
        
        if (format === 'txt') {
            metaString = '=== メタデータ ===\n';
            Object.entries(metaInfo).forEach(([key, value]) => {
                metaString += `${this.formatKey(key)}: ${value}\n`;
            });
            metaString += '================\n\n';
        }

        return metaString + content;
    }

    /**
     * Format metadata key for display
     */
    formatKey(key) {
        const keyMap = {
            exportDate: 'エクスポート日時',
            wordCount: '単語数',
            charCount: '文字数',
            title: 'タイトル',
            author: '著者',
            projectName: 'プロジェクト名',
            chapterNumber: '章番号'
        };
        return keyMap[key] || key;
    }

    /**
     * Count words in content
     */
    countWords(content) {
        // Simple word count for Japanese and English
        const japaneseChars = content.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g) || [];
        const englishWords = content.match(/[a-zA-Z]+/g) || [];
        return japaneseChars.length + englishWords.length;
    }

    /**
     * Generate filename
     */
    generateFileName(title, format) {
        const date = new Date().toISOString().split('T')[0];
        const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
        const safeTitle = title.replace(/[^\w\s\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, '');
        
        return `${safeTitle}_${date}_${time}.${format}`;
    }

    /**
     * Get file filters for dialog
     */
    getFileFilters(format) {
        const filters = {
            txt: [{ name: 'Text Files', extensions: ['txt'] }],
            md: [{ name: 'Markdown Files', extensions: ['md'] }],
            docx: [{ name: 'Word Documents', extensions: ['docx', 'rtf'] }],
            pdf: [{ name: 'PDF Files', extensions: ['pdf'] }]
        };
        
        return filters[format] || [];
    }

    /**
     * Export project
     */
    async exportProject(project, options = {}) {
        const {
            format = 'txt',
            includeAllChapters = true,
            includePlotInfo = true,
            includeCharacters = true,
            includeNotes = false
        } = options;

        let content = '';

        // Add project title
        content += `${project.name}\n${'='.repeat(project.name.length)}\n\n`;

        // Add project description
        if (project.description) {
            content += `${project.description}\n\n`;
        }

        // Add plot information
        if (includePlotInfo && project.plots) {
            content += '## プロット情報\n\n';
            for (const plot of project.plots) {
                content += `### ${plot.title}\n`;
                content += `${plot.description || ''}\n\n`;
                
                if (includeAllChapters && plot.chapters) {
                    for (const chapter of plot.chapters) {
                        content += `#### 第${chapter.number}章: ${chapter.title}\n`;
                        if (chapter.content) {
                            content += `${chapter.content}\n\n`;
                        }
                    }
                }
            }
        }

        // Add character information
        if (includeCharacters && project.characters) {
            content += '## 登場人物\n\n';
            for (const character of project.characters) {
                content += `### ${character.name}\n`;
                if (character.description) {
                    content += `${character.description}\n\n`;
                }
            }
        }

        // Export with metadata
        const metadata = {
            projectName: project.name,
            author: project.author || '',
            createdAt: project.createdAt,
            totalChapters: project.plots?.reduce((sum, plot) => 
                sum + (plot.chapters?.length || 0), 0) || 0
        };

        return await this.export({
            content,
            format,
            title: project.name,
            metadata,
            includeMetadata: true,
            includeNotes
        });
    }
}

// Export singleton instance
module.exports = new ExportService();