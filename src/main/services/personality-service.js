const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const { getLogger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const openAIService = require('./openai-service');

/**
 * Personality Service - Manages AI agent personalities
 */
class PersonalityService extends EventEmitter {
    constructor() {
        super();
        
        this.logger = getLogger('personality-service');
        this.personalities = new Map();
        this.currentAssignments = new Map();
        this.presets = new Map();
        
        // Paths
        this.builtInPersonalitiesPath = path.join(__dirname, '..', '..', 'personalities');
        this.customPersonalitiesPath = null; // Will be set when initialized
        
        this.initialize();
    }

    /**
     * Initialize the service
     */
    async initialize() {
        this.logger.info('Initializing Personality Service');
        
        try {
            // Load built-in personalities
            await this.loadBuiltInPersonalities();
            
            // Load default assignments
            this.loadDefaultAssignments();
            
            // Load presets
            this.loadDefaultPresets();
            
            this.logger.info('Personality Service initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Personality Service:', error);
        }
    }

    /**
     * Set custom personalities path
     * @param {string} customPath
     */
    setCustomPersonalitiesPath(customPath) {
        this.customPersonalitiesPath = customPath;
    }

    /**
     * Load built-in personalities from files
     */
    async loadBuiltInPersonalities() {
        try {
            const files = await fs.readdir(this.builtInPersonalitiesPath);
            const personalityFiles = files.filter(f => f.endsWith('.json'));
            
            for (const file of personalityFiles) {
                const filePath = path.join(this.builtInPersonalitiesPath, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const personalities = JSON.parse(content);
                
                // Handle both single personality and array of personalities
                const personalityArray = Array.isArray(personalities) ? personalities : [personalities];
                
                for (const personality of personalityArray) {
                    personality.isBuiltIn = true;
                    personality.id = personality.id || uuidv4();
                    this.personalities.set(personality.id, personality);
                    this.logger.info(`Loaded built-in personality: ${personality.name}`);
                }
            }
        } catch (error) {
            this.logger.error('Error loading built-in personalities:', error);
        }
    }

    /**
     * Load default assignments
     */
    loadDefaultAssignments() {
        // Get first personality of each type as default
        const writerPersonalities = this.getPersonalitiesByRole('writer');
        const editorPersonalities = this.getPersonalitiesByRole('editor');
        const deputyEditorPersonalities = this.getPersonalitiesByRole('deputy_editor');
        const proofreaderPersonalities = this.getPersonalitiesByRole('proofreader');
        
        if (writerPersonalities.length > 0) {
            this.currentAssignments.set('writer', writerPersonalities[0]);
        }
        if (editorPersonalities.length > 0) {
            this.currentAssignments.set('editor', editorPersonalities[0]);
        }
        if (deputyEditorPersonalities.length > 0) {
            this.currentAssignments.set('deputy_editor', deputyEditorPersonalities[0]);
        }
        if (proofreaderPersonalities.length > 0) {
            this.currentAssignments.set('proofreader', proofreaderPersonalities[0]);
        }
    }

    /**
     * Load default presets
     */
    loadDefaultPresets() {
        const presets = [
            {
                id: 'literary-set',
                name: '純文学セット',
                description: '深い内省と芸術性を追求。商業性は二の次。',
                assignment: {
                    writer: 'literary-writer',
                    editor: 'literary-editor',
                    deputy_editor: 'artistic-deputy'
                }
            },
            {
                id: 'commercial-set',
                name: '商業小説セット',
                description: '読者を楽しませることを最優先。売れる作品作り。',
                assignment: {
                    writer: 'entertainment-writer',
                    editor: 'bestseller-editor',
                    deputy_editor: 'market-deputy'
                }
            },
            {
                id: 'experimental-set',
                name: '実験的セット',
                description: 'ジャンルを超えた斬新な作品を生み出す。',
                assignment: {
                    writer: 'sf-writer',
                    editor: 'literary-editor',
                    deputy_editor: 'lightnovel-deputy'
                }
            },
            {
                id: 'twitter-novel-set',
                name: 'Twitter小説セット',
                description: '140文字で心を掴む。バズる小説を生み出す。',
                assignment: {
                    writer: 'twitter-writer',
                    editor: 'twitter-editor',
                    deputy_editor: 'innovative-deputy',
                    proofreader: 'creative-proofreader'
                }
            },
            {
                id: 'narou-set',
                name: 'なろう系セット',
                description: '日刊3000文字連載。読者を虜にする王道展開。',
                assignment: {
                    writer: 'narou-writer',
                    editor: 'narou-editor',
                    deputy_editor: 'market-deputy',
                    proofreader: 'meticulous-proofreader'
                }
            }
        ];
        
        for (const preset of presets) {
            this.presets.set(preset.id, preset);
        }
    }

    /**
     * Get all personalities
     * @returns {Array<Object>}
     */
    getAllPersonalities() {
        return Array.from(this.personalities.values());
    }

    /**
     * Get personalities by role
     * @param {string} role
     * @returns {Array<Object>}
     */
    getPersonalitiesByRole(role) {
        return Array.from(this.personalities.values()).filter(p => p.role === role);
    }

    /**
     * Get personality by ID
     * @param {string} personalityId
     * @returns {Object|null}
     */
    getPersonality(personalityId) {
        return this.personalities.get(personalityId) || null;
    }

    /**
     * Get current assignments
     * @returns {Object}
     */
    getCurrentAssignments() {
        const assignments = {};
        for (const [role, personality] of this.currentAssignments) {
            assignments[role] = personality;
        }
        return assignments;
    }

    /**
     * Switch personality for a role
     * @param {string} role
     * @param {string} personalityId
     * @returns {boolean}
     */
    async switchPersonality(role, personalityId) {
        const personality = this.getPersonality(personalityId);
        if (!personality) {
            throw new Error(`Personality not found: ${personalityId}`);
        }
        
        if (personality.role !== role) {
            throw new Error(`Personality ${personality.name} is for role ${personality.role}, not ${role}`);
        }
        
        const previousPersonality = this.currentAssignments.get(role);
        this.currentAssignments.set(role, personality);
        
        this.logger.info(`Switched ${role} personality to: ${personality.name}`);
        
        // Emit event
        this.emit('personality:switched', {
            role,
            previousPersonality,
            newPersonality: personality
        });
        
        return true;
    }

    /**
     * Apply preset
     * @param {string} presetId
     * @returns {Object}
     */
    async applyPreset(presetId) {
        const preset = this.presets.get(presetId);
        if (!preset) {
            throw new Error(`Preset not found: ${presetId}`);
        }
        
        const results = {};
        
        for (const [role, personalityId] of Object.entries(preset.assignment)) {
            try {
                await this.switchPersonality(role, personalityId);
                results[role] = { success: true, personalityId };
            } catch (error) {
                results[role] = { success: false, error: error.message };
                this.logger.error(`Failed to apply preset for ${role}:`, error);
            }
        }
        
        this.emit('preset:applied', {
            preset,
            results
        });
        
        return results;
    }

    /**
     * Create custom personality
     * @param {Object} personalityData
     * @returns {Object}
     */
    async createCustomPersonality(personalityData) {
        const personality = {
            id: uuidv4(),
            name: personalityData.name,
            role: personalityData.role,
            description: personalityData.description,
            systemPrompt: personalityData.systemPrompt,
            traits: personalityData.traits || this.generateDefaultTraits(),
            examples: personalityData.examples || [],
            createdAt: new Date(),
            isBuiltIn: false
        };
        
        this.personalities.set(personality.id, personality);
        
        // Save to custom personalities if path is set
        if (this.customPersonalitiesPath) {
            await this.saveCustomPersonality(personality);
        }
        
        this.logger.info(`Created custom personality: ${personality.name}`);
        
        this.emit('personality:created', personality);
        
        return personality;
    }

    /**
     * Generate personality using AI
     * @param {Object} params
     * @returns {Object}
     */
    async generatePersonality(params) {
        const { role, genre, traits, reference } = params;
        
        const prompt = `新しいAI人格を作成します。以下の情報を基に、システムプロンプトを生成してください。

役割: ${role}
ジャンル: ${genre}
性格特性: ${traits.join(', ')}
参考にする実在の人物やキャラクター: ${reference || 'なし'}

以下の要素を含めてください：
1. 基本的な性格と価値観
2. 得意とする表現や思考パターン
3. 口調や話し方の特徴
4. 具体的な行動指針3-5個

システムプロンプト:`;

        if (!openAIService.isConfigured()) {
            throw new Error('OpenAI service is not configured');
        }

        const systemPrompt = await openAIService.generateText(prompt, {
            temperature: 0.8,
            maxTokens: 1000
        });

        const personality = await this.createCustomPersonality({
            name: reference || `カスタム${role}`,
            role: role,
            description: `${genre}ジャンルを得意とする${role}`,
            systemPrompt: systemPrompt,
            traits: this.extractTraitsFromPrompt(systemPrompt)
        });

        return personality;
    }

    /**
     * Update personality
     * @param {string} personalityId
     * @param {Object} updates
     * @returns {Object}
     */
    async updatePersonality(personalityId, updates) {
        const personality = this.getPersonality(personalityId);
        if (!personality) {
            throw new Error(`Personality not found: ${personalityId}`);
        }
        
        if (personality.isBuiltIn) {
            throw new Error('Cannot update built-in personalities');
        }
        
        // Update personality
        Object.assign(personality, updates, {
            updatedAt: new Date()
        });
        
        // Save if custom
        if (this.customPersonalitiesPath) {
            await this.saveCustomPersonality(personality);
        }
        
        this.emit('personality:updated', personality);
        
        return personality;
    }

    /**
     * Delete custom personality
     * @param {string} personalityId
     * @returns {boolean}
     */
    async deletePersonality(personalityId) {
        const personality = this.getPersonality(personalityId);
        if (!personality) {
            throw new Error(`Personality not found: ${personalityId}`);
        }
        
        if (personality.isBuiltIn) {
            throw new Error('Cannot delete built-in personalities');
        }
        
        // Check if currently assigned
        for (const [role, assigned] of this.currentAssignments) {
            if (assigned.id === personalityId) {
                throw new Error(`Cannot delete personality currently assigned to ${role}`);
            }
        }
        
        this.personalities.delete(personalityId);
        
        // Delete from file if custom
        if (this.customPersonalitiesPath) {
            await this.deleteCustomPersonalityFile(personalityId);
        }
        
        this.emit('personality:deleted', personality);
        
        return true;
    }

    /**
     * Get all presets
     * @returns {Array<Object>}
     */
    getAllPresets() {
        return Array.from(this.presets.values());
    }

    /**
     * Create custom preset
     * @param {Object} presetData
     * @returns {Object}
     */
    createPreset(presetData) {
        const preset = {
            id: uuidv4(),
            name: presetData.name,
            description: presetData.description,
            assignment: presetData.assignment,
            createdAt: new Date()
        };
        
        this.presets.set(preset.id, preset);
        
        this.emit('preset:created', preset);
        
        return preset;
    }

    /**
     * Delete preset
     * @param {string} presetId
     * @returns {boolean}
     */
    deletePreset(presetId) {
        const preset = this.presets.get(presetId);
        if (!preset) {
            throw new Error(`Preset not found: ${presetId}`);
        }
        
        // Don't delete default presets
        if (['literary-set', 'commercial-set', 'experimental-set'].includes(presetId)) {
            throw new Error('Cannot delete default presets');
        }
        
        this.presets.delete(presetId);
        
        this.emit('preset:deleted', preset);
        
        return true;
    }

    /**
     * Get personality for agent
     * @param {string} agentType
     * @returns {Object}
     */
    getPersonalityForAgent(agentType) {
        const personality = this.currentAssignments.get(agentType);
        if (!personality) {
            this.logger.warn(`No personality assigned for agent type: ${agentType}`);
            return null;
        }
        return personality;
    }

    /**
     * Generate default traits
     * @returns {Object}
     */
    generateDefaultTraits() {
        return {
            creativity: {
                conventionality: 0.5,
                abstractness: 0.5,
                riskTaking: 0.5
            },
            communication: {
                formality: 0.5,
                assertiveness: 0.5,
                empathy: 0.5
            },
            expertise: {
                genre: [],
                themes: [],
                taboos: []
            }
        };
    }

    /**
     * Extract traits from system prompt
     * @param {string} systemPrompt
     * @returns {Object}
     */
    extractTraitsFromPrompt(systemPrompt) {
        // Simple extraction based on keywords
        const traits = this.generateDefaultTraits();
        
        // Check for creativity indicators
        if (systemPrompt.includes('革新') || systemPrompt.includes('実験')) {
            traits.creativity.conventionality = 0.2;
            traits.creativity.riskTaking = 0.8;
        }
        
        // Check for formality
        if (systemPrompt.includes('フォーマル') || systemPrompt.includes('敬語')) {
            traits.communication.formality = 0.8;
        }
        
        // Extract genres
        const genreKeywords = ['SF', 'ファンタジー', 'ミステリー', '恋愛', 'ホラー'];
        traits.expertise.genre = genreKeywords.filter(g => systemPrompt.includes(g));
        
        return traits;
    }

    /**
     * Save custom personality to file
     * @param {Object} personality
     */
    async saveCustomPersonality(personality) {
        const filePath = path.join(this.customPersonalitiesPath, `${personality.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(personality, null, 2));
    }

    /**
     * Delete custom personality file
     * @param {string} personalityId
     */
    async deleteCustomPersonalityFile(personalityId) {
        const filePath = path.join(this.customPersonalitiesPath, `${personalityId}.json`);
        try {
            await fs.unlink(filePath);
        } catch (error) {
            this.logger.error('Failed to delete personality file:', error);
        }
    }

    /**
     * Export personality
     * @param {string} personalityId
     * @returns {string}
     */
    exportPersonality(personalityId) {
        const personality = this.getPersonality(personalityId);
        if (!personality) {
            throw new Error(`Personality not found: ${personalityId}`);
        }
        
        return JSON.stringify(personality, null, 2);
    }

    /**
     * Import personality
     * @param {string} personalityData
     * @returns {Object}
     */
    async importPersonality(personalityData) {
        const personality = JSON.parse(personalityData);
        
        // Generate new ID and mark as custom
        personality.id = uuidv4();
        personality.isBuiltIn = false;
        personality.importedAt = new Date();
        
        this.personalities.set(personality.id, personality);
        
        if (this.customPersonalitiesPath) {
            await this.saveCustomPersonality(personality);
        }
        
        this.emit('personality:imported', personality);
        
        return personality;
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStatistics() {
        const stats = {
            totalPersonalities: this.personalities.size,
            builtInPersonalities: Array.from(this.personalities.values()).filter(p => p.isBuiltIn).length,
            customPersonalities: Array.from(this.personalities.values()).filter(p => !p.isBuiltIn).length,
            personalitiesByRole: {},
            totalPresets: this.presets.size,
            currentAssignments: {}
        };
        
        // Count personalities by role
        const roles = ['writer', 'editor', 'deputy_editor', 'proofreader'];
        for (const role of roles) {
            stats.personalitiesByRole[role] = this.getPersonalitiesByRole(role).length;
            const current = this.currentAssignments.get(role);
            stats.currentAssignments[role] = current ? current.name : 'None';
        }
        
        return stats;
    }
}

// Export singleton instance
const personalityService = new PersonalityService();
module.exports = personalityService;