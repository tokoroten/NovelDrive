const { ipcMain } = require('electron');
const { getLogger } = require('../utils/logger');
const openAIService = require('../services/openai-service');
const { getSettingsRepository } = require('../repositories');

const logger = getLogger('openai-handlers');

/**
 * Register OpenAI-related IPC handlers
 */
function registerOpenAIHandlers(mainWindow) {
    // Set API key
    ipcMain.handle('openai:setApiKey', async (event, data) => {
        try {
            const { apiKey } = data;
            
            if (!apiKey) {
                throw new Error('API key is required');
            }
            
            // Validate API key format
            if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
                throw new Error('Invalid API key format');
            }
            
            // Set API key in service
            openAIService.setApiKey(apiKey);
            
            // Save to settings
            const settingsRepo = getSettingsRepository();
            await settingsRepo.set('openai_api_key', apiKey);
            
            logger.info('OpenAI API key updated');
            return { success: true };
        } catch (error) {
            logger.error('Failed to set API key:', error);
            throw error;
        }
    });
    
    // Get API configuration
    ipcMain.handle('openai:getConfig', async (event) => {
        try {
            const settingsRepo = getSettingsRepository();
            const apiKey = await settingsRepo.get('openai_api_key');
            const model = await settingsRepo.get('openai_model') || 'gpt-4';
            const temperature = await settingsRepo.get('openai_temperature') || 0.7;
            
            return {
                isConfigured: openAIService.isConfigured(),
                hasApiKey: !!apiKey,
                model,
                temperature
            };
        } catch (error) {
            logger.error('Failed to get OpenAI config:', error);
            throw error;
        }
    });
    
    // Update model settings
    ipcMain.handle('openai:updateSettings', async (event, data) => {
        try {
            const { model, temperature } = data;
            const settingsRepo = getSettingsRepository();
            
            if (model) {
                openAIService.setModel(model);
                await settingsRepo.set('openai_model', model);
            }
            
            if (temperature !== undefined) {
                openAIService.setTemperature(temperature);
                await settingsRepo.set('openai_temperature', temperature);
            }
            
            logger.info('OpenAI settings updated');
            return { success: true };
        } catch (error) {
            logger.error('Failed to update OpenAI settings:', error);
            throw error;
        }
    });
    
    // Generate text
    ipcMain.handle('openai:generateText', async (event, data) => {
        try {
            const { prompt, options = {} } = data;
            
            if (!prompt) {
                throw new Error('Prompt is required');
            }
            
            const result = await openAIService.generateText(prompt, options);
            return { text: result };
        } catch (error) {
            logger.error('Failed to generate text:', error);
            throw error;
        }
    });
    
    // Generate for agent
    ipcMain.handle('openai:generateForAgent', async (event, data) => {
        try {
            const { agentType, content, context = {} } = data;
            
            if (!agentType || !content) {
                throw new Error('Agent type and content are required');
            }
            
            const result = await openAIService.generateForAgent(agentType, content, context);
            return { text: result };
        } catch (error) {
            logger.error('Failed to generate for agent:', error);
            throw error;
        }
    });
    
    // Generate writing assistance
    ipcMain.handle('openai:assistWriting', async (event, data) => {
        try {
            const { action, text, context = {} } = data;
            
            const prompts = {
                continue: `続きを書いてください。文体と雰囲気を保ちながら、自然な流れで物語を続けてください。\n\n現在のテキスト:\n${text}`,
                
                improve: `以下のテキストをより良い表現に改善してください。原文の意図は保ちつつ、より洗練された文章にしてください。\n\n原文:\n${text}`,
                
                expand: `以下のテキストに詳細な描写を追加してください。情景、感情、五感に訴える表現を加えてください。\n\n原文:\n${text}`,
                
                dialogue: `以下のコンテキストに基づいて、キャラクター間の自然な対話を生成してください。各キャラクターの個性を反映させてください。\n\nコンテキスト:\n${text}`,
                
                scene: `以下の場面について、詳細な情景描写を書いてください。雰囲気、時間、場所、感覚的な要素を含めてください。\n\n場面:\n${text}`,
                
                brainstorm: `以下のテキストから、物語の展開に関するアイデアを5つ提案してください。創造的で興味深い展開を考えてください。\n\n現在のテキスト:\n${text}`
            };
            
            const prompt = prompts[action];
            if (!prompt) {
                throw new Error(`Unknown writing action: ${action}`);
            }
            
            // Add chapter context if available
            let fullPrompt = prompt;
            if (context.chapterOutline) {
                fullPrompt = `章の概要: ${context.chapterOutline}\n\n${prompt}`;
            }
            
            const result = await openAIService.generateText(fullPrompt, {
                temperature: action === 'brainstorm' ? 0.9 : 0.7,
                maxTokens: action === 'brainstorm' ? 800 : 1000
            });
            
            return { text: result, action };
        } catch (error) {
            logger.error('Failed to assist writing:', error);
            throw error;
        }
    });
    
    // Generate variations
    ipcMain.handle('openai:generateVariations', async (event, data) => {
        try {
            const { text, count = 3 } = data;
            
            if (!text) {
                throw new Error('Text is required');
            }
            
            const variations = await openAIService.generateVariations(text, count);
            return { variations };
        } catch (error) {
            logger.error('Failed to generate variations:', error);
            throw error;
        }
    });
    
    // Analyze text
    ipcMain.handle('openai:analyzeText', async (event, data) => {
        try {
            const { text, analysisType } = data;
            
            if (!text || !analysisType) {
                throw new Error('Text and analysis type are required');
            }
            
            const analysis = await openAIService.analyzeText(text, analysisType);
            return { analysis };
        } catch (error) {
            logger.error('Failed to analyze text:', error);
            throw error;
        }
    });
    
    // Initialize service with saved settings
    initializeOpenAIService();
    
    logger.info('OpenAI handlers registered');
}

/**
 * Initialize OpenAI service with saved settings
 */
async function initializeOpenAIService() {
    try {
        const settingsRepo = getSettingsRepository();
        
        // Load saved settings
        const apiKey = await settingsRepo.get('openai_api_key');
        const model = await settingsRepo.get('openai_model');
        const temperature = await settingsRepo.get('openai_temperature');
        
        // Apply settings if available
        if (apiKey) {
            openAIService.setApiKey(apiKey);
        }
        
        if (model) {
            openAIService.setModel(model);
        }
        
        if (temperature !== null) {
            openAIService.setTemperature(temperature);
        }
        
        logger.info('OpenAI service initialized with saved settings');
    } catch (error) {
        logger.error('Failed to initialize OpenAI service:', error);
        // Don't throw - service can still be configured later
    }
}

module.exports = {
    registerOpenAIHandlers
};