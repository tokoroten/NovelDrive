// Version Manager for Writing Editor
// Manages chapter versions and provides comparison functionality

class VersionManager {
    constructor() {
        this.versions = new Map(); // chapterId -> array of versions
        this.maxVersionsPerChapter = 20;
    }

    /**
     * Save a new version of a chapter
     * @param {number} chapterId
     * @param {Object} versionData - { content, title, wordCount, savedAt }
     * @returns {Object} The saved version
     */
    saveVersion(chapterId, versionData) {
        if (!this.versions.has(chapterId)) {
            this.versions.set(chapterId, []);
        }

        const versions = this.versions.get(chapterId);
        const version = {
            id: Date.now(),
            chapterId,
            content: versionData.content,
            title: versionData.title,
            wordCount: versionData.wordCount || versionData.content.length,
            savedAt: versionData.savedAt || new Date().toISOString(),
            changes: this.calculateChanges(chapterId, versionData.content)
        };

        versions.push(version);

        // Maintain max versions limit
        if (versions.length > this.maxVersionsPerChapter) {
            versions.shift(); // Remove oldest version
        }

        return version;
    }

    /**
     * Get all versions for a chapter
     * @param {number} chapterId
     * @returns {Array}
     */
    getVersions(chapterId) {
        return this.versions.get(chapterId) || [];
    }

    /**
     * Get a specific version
     * @param {number} chapterId
     * @param {number} versionId
     * @returns {Object|null}
     */
    getVersion(chapterId, versionId) {
        const versions = this.getVersions(chapterId);
        return versions.find(v => v.id === versionId) || null;
    }

    /**
     * Calculate changes from previous version
     * @param {number} chapterId
     * @param {string} newContent
     * @returns {Object}
     */
    calculateChanges(chapterId, newContent) {
        const versions = this.getVersions(chapterId);
        if (versions.length === 0) {
            return {
                added: newContent.length,
                removed: 0,
                modified: 0
            };
        }

        const previousVersion = versions[versions.length - 1];
        const oldContent = previousVersion.content;

        // Simple character-based diff calculation
        const changes = {
            added: 0,
            removed: 0,
            modified: 0
        };

        const lengthDiff = newContent.length - oldContent.length;
        if (lengthDiff > 0) {
            changes.added = lengthDiff;
        } else if (lengthDiff < 0) {
            changes.removed = Math.abs(lengthDiff);
        }

        // Count modified characters (simplified)
        const minLength = Math.min(oldContent.length, newContent.length);
        for (let i = 0; i < minLength; i++) {
            if (oldContent[i] !== newContent[i]) {
                changes.modified++;
            }
        }

        return changes;
    }

    /**
     * Compare two versions and return differences
     * @param {number} chapterId
     * @param {number} versionId1
     * @param {number} versionId2
     * @returns {Object}
     */
    compareVersions(chapterId, versionId1, versionId2) {
        const version1 = this.getVersion(chapterId, versionId1);
        const version2 = this.getVersion(chapterId, versionId2);

        if (!version1 || !version2) {
            throw new Error('One or both versions not found');
        }

        const diff = this.computeDiff(version1.content, version2.content);
        
        return {
            version1: {
                id: version1.id,
                savedAt: version1.savedAt,
                wordCount: version1.wordCount
            },
            version2: {
                id: version2.id,
                savedAt: version2.savedAt,
                wordCount: version2.wordCount
            },
            diff: diff,
            statistics: {
                added: diff.added.length,
                removed: diff.removed.length,
                unchanged: diff.unchanged.length
            }
        };
    }

    /**
     * Compute line-by-line diff between two texts
     * @param {string} text1
     * @param {string} text2
     * @returns {Object}
     */
    computeDiff(text1, text2) {
        const lines1 = text1.split('\n');
        const lines2 = text2.split('\n');
        
        // Simple line-based diff
        const diff = {
            added: [],
            removed: [],
            unchanged: [],
            changes: []
        };

        // Create a map of lines for faster lookup
        const lines2Map = new Map();
        lines2.forEach((line, index) => {
            if (!lines2Map.has(line)) {
                lines2Map.set(line, []);
            }
            lines2Map.get(line).push(index);
        });

        const used2 = new Set();

        // Find matching and removed lines
        lines1.forEach((line, index1) => {
            if (lines2Map.has(line)) {
                const indices = lines2Map.get(line);
                const matchIndex = indices.find(i => !used2.has(i));
                if (matchIndex !== undefined) {
                    used2.add(matchIndex);
                    diff.unchanged.push({
                        line: line,
                        index1: index1,
                        index2: matchIndex
                    });
                } else {
                    diff.removed.push({
                        line: line,
                        index: index1
                    });
                }
            } else {
                diff.removed.push({
                    line: line,
                    index: index1
                });
            }
        });

        // Find added lines
        lines2.forEach((line, index2) => {
            if (!used2.has(index2)) {
                diff.added.push({
                    line: line,
                    index: index2
                });
            }
        });

        // Generate unified changes array for display
        let i1 = 0, i2 = 0;
        while (i1 < lines1.length || i2 < lines2.length) {
            // Check for unchanged line
            const unchanged = diff.unchanged.find(u => u.index1 === i1 && u.index2 === i2);
            if (unchanged) {
                diff.changes.push({
                    type: 'unchanged',
                    content: unchanged.line,
                    lineNumber1: i1 + 1,
                    lineNumber2: i2 + 1
                });
                i1++;
                i2++;
                continue;
            }

            // Check for removed line
            const removed = diff.removed.find(r => r.index === i1);
            if (removed) {
                diff.changes.push({
                    type: 'removed',
                    content: removed.line,
                    lineNumber1: i1 + 1
                });
                i1++;
                continue;
            }

            // Check for added line
            const added = diff.added.find(a => a.index === i2);
            if (added) {
                diff.changes.push({
                    type: 'added',
                    content: added.line,
                    lineNumber2: i2 + 1
                });
                i2++;
                continue;
            }

            // Shouldn't reach here, but increment both just in case
            i1++;
            i2++;
        }

        return diff;
    }

    /**
     * Restore a specific version
     * @param {number} chapterId
     * @param {number} versionId
     * @returns {Object|null}
     */
    restoreVersion(chapterId, versionId) {
        const version = this.getVersion(chapterId, versionId);
        if (!version) {
            return null;
        }

        // Save current state as a new version before restoring
        // This will be handled by the editor when it detects the restore

        return {
            content: version.content,
            title: version.title,
            wordCount: version.wordCount,
            restoredFrom: {
                versionId: version.id,
                savedAt: version.savedAt
            }
        };
    }

    /**
     * Delete a specific version
     * @param {number} chapterId
     * @param {number} versionId
     * @returns {boolean}
     */
    deleteVersion(chapterId, versionId) {
        const versions = this.getVersions(chapterId);
        const index = versions.findIndex(v => v.id === versionId);
        
        if (index !== -1) {
            versions.splice(index, 1);
            return true;
        }
        
        return false;
    }

    /**
     * Clear all versions for a chapter
     * @param {number} chapterId
     */
    clearVersions(chapterId) {
        this.versions.delete(chapterId);
    }

    /**
     * Export versions for backup
     * @param {number} chapterId
     * @returns {string} JSON string
     */
    exportVersions(chapterId) {
        const versions = this.getVersions(chapterId);
        return JSON.stringify({
            chapterId,
            exportedAt: new Date().toISOString(),
            versions: versions
        }, null, 2);
    }

    /**
     * Import versions from backup
     * @param {string} jsonData
     * @returns {boolean}
     */
    importVersions(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (data.chapterId && Array.isArray(data.versions)) {
                this.versions.set(data.chapterId, data.versions);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to import versions:', error);
            return false;
        }
    }
}

// Export for use in editor
window.VersionManager = VersionManager;