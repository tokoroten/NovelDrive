const BaseRepository = require('./base-repository');
const { getLogger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

/**
 * Repository for managing application settings
 */
class SettingsRepository extends BaseRepository {
    constructor(db) {
        super(db, 'settings');
        this.logger = getLogger('settings-repository');
        this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
        this.defaultSettings = this.getDefaultSettings();
    }

    /**
     * Get default settings
     * @returns {Object}
     */
    getDefaultSettings() {
        return {
            api: {
                openai: {
                    apiKey: '',
                    model: 'gpt-4',
                    temperature: 0.7
                }
            },
            ai: {
                writerModerateIgnorance: true,
                responseLength: 'medium',
                language: 'ja',
                serendipityDistance: 0.5,
                serendipityNoise: 0.2
            },
            editor: {
                fontSize: '16',
                lineHeight: '1.6',
                showLineNumbers: false,
                wordWrap: true,
                autoSave: true,
                autoSaveInterval: '30',
                backupCount: 10
            },
            export: {
                defaultFormat: 'txt',
                includeMetadata: true,
                includeNotes: false,
                filenamePattern: '{project}_{date}_{time}'
            },
            advanced: {
                dataLocation: app.getPath('userData'),
                enable24hMode: false,
                debugMode: false
            }
        };
    }

    /**
     * Load settings from file
     * @returns {Promise<Object>}
     */
    async load() {
        try {
            const data = await fs.readFile(this.settingsPath, 'utf8');
            const settings = JSON.parse(data);
            return { ...this.defaultSettings, ...settings };
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, return defaults
                this.logger.info('Settings file not found, using defaults');
                return this.defaultSettings;
            }
            this.logger.error('Failed to load settings:', error);
            throw error;
        }
    }

    /**
     * Save settings to file
     * @param {Object} settings
     * @returns {Promise<void>}
     */
    async save(settings) {
        try {
            // Merge with defaults to ensure all keys exist
            const merged = { ...this.defaultSettings, ...settings };
            
            // Ensure directory exists
            const dir = path.dirname(this.settingsPath);
            await fs.mkdir(dir, { recursive: true });
            
            // Write settings
            await fs.writeFile(
                this.settingsPath,
                JSON.stringify(merged, null, 2),
                'utf8'
            );
            
            this.logger.info('Settings saved successfully');
        } catch (error) {
            this.logger.error('Failed to save settings:', error);
            throw error;
        }
    }

    /**
     * Get a specific setting value
     * @param {string} key - Dot notation key (e.g., 'api.openai.apiKey')
     * @returns {Promise<any>}
     */
    async get(key) {
        const settings = await this.load();
        const keys = key.split('.');
        let value = settings;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return null;
            }
        }
        
        return value;
    }

    /**
     * Set a specific setting value
     * @param {string} key - Dot notation key
     * @param {any} value
     * @returns {Promise<void>}
     */
    async set(key, value) {
        const settings = await this.load();
        const keys = key.split('.');
        let obj = settings;
        
        // Navigate to the parent object
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in obj) || typeof obj[k] !== 'object') {
                obj[k] = {};
            }
            obj = obj[k];
        }
        
        // Set the value
        obj[keys[keys.length - 1]] = value;
        
        await this.save(settings);
    }

    /**
     * Reset settings to defaults
     * @returns {Promise<void>}
     */
    async reset() {
        await this.save(this.defaultSettings);
        this.logger.info('Settings reset to defaults');
    }

    /**
     * Export settings (excluding sensitive data)
     * @returns {Promise<Object>}
     */
    async export() {
        const settings = await this.load();
        const exported = JSON.parse(JSON.stringify(settings));
        
        // Remove sensitive data
        if (exported.api && exported.api.openai) {
            exported.api.openai.apiKey = '***';
        }
        
        return exported;
    }

    /**
     * Import settings
     * @param {Object} settings
     * @returns {Promise<void>}
     */
    async import(settings) {
        // Validate structure
        if (!settings || typeof settings !== 'object') {
            throw new Error('Invalid settings format');
        }
        
        // Don't import API keys
        const current = await this.load();
        if (current.api && current.api.openai && current.api.openai.apiKey) {
            settings.api = settings.api || {};
            settings.api.openai = settings.api.openai || {};
            settings.api.openai.apiKey = current.api.openai.apiKey;
        }
        
        await this.save(settings);
        this.logger.info('Settings imported successfully');
    }
}

module.exports = SettingsRepository;