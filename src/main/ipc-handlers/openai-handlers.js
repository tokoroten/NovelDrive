const { ipcMain } = require('electron');
const { getLogger } = require('../utils/logger');
const openAIService = require('../services/openai-service');

const logger = getLogger('openai-handlers');

/**
 * Register OpenAI-related IPC handlers
 * @param {BrowserWindow} mainWindow - The main window
 * @param {Object} db - Database instance
 */
function registerOpenAIHandlers(mainWindow, db) {
    const SettingsRepository = require('../repositories/settings-repository');
    const settingsRepository = new SettingsRepository(db);
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
            
            // Save to settings with proper structure
            const currentSettings = await settingsRepository.load();
            currentSettings.api.openai.apiKey = apiKey;
            await settingsRepository.save(currentSettings);
            
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
            const settings = await settingsRepository.load();
            const apiKey = settings.api.openai.apiKey;
            const model = settings.api.openai.model || 'gpt-4o';
            const temperature = settings.api.openai.temperature || 0.7;
            
            return {
                isConfigured: openAIService.isConfigured(),
                hasApiKey: !!apiKey && apiKey.length > 0,
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
            
            const currentSettings = await settingsRepository.load();
            
            if (model) {
                openAIService.setModel(model);
                currentSettings.api.openai.model = model;
            }
            
            if (temperature !== undefined) {
                openAIService.setTemperature(temperature);
                currentSettings.api.openai.temperature = temperature;
            }
            
            await settingsRepository.save(currentSettings);
            
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
    
    // Test API connection
    ipcMain.handle('openai:testConnection', async (event, data) => {
        try {
            const { apiKey, model = 'gpt-4o', temperature = 0.7 } = data;
            
            // Temporarily set API key for testing
            const originalApiKey = openAIService.apiKey;
            if (apiKey) {
                openAIService.setApiKey(apiKey);
            }
            
            // Test with appropriate prompt for the model
            const startTime = Date.now();
            let testMessage, maxTokens;
            
            if (model.startsWith('o1-')) {
                testMessage = "小説創作において、魅力的なキャラクターを作るための3つの重要な要素を分析してください。";
                maxTokens = 200;
            } else {
                testMessage = "こんにちは。短く挨拶を返してください。";
                maxTokens = 50;
            }
                
            const result = await openAIService.generateText(testMessage, {
                model: model,
                temperature: temperature,
                maxTokens: maxTokens
            });
            
            const responseTime = Date.now() - startTime;
            
            // Restore original API key
            if (originalApiKey) {
                openAIService.setApiKey(originalApiKey);
            }
            
            return {
                success: true,
                model: model,
                testMessage: result,
                responseTime: responseTime,
                tokensUsed: result.length, // Approximate
                modelInfo: getModelInfo(model)
            };
        } catch (error) {
            logger.error('OpenAI API test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // Initialize service with saved settings
    initializeOpenAIService(settingsRepository);
    
    logger.info('OpenAI handlers registered');
}

/**
 * Initialize OpenAI service with saved settings
 * @param {SettingsRepository} settingsRepository
 */
async function initializeOpenAIService(settingsRepository) {
    try {
        const settings = await settingsRepository.load();
        
        if (settings.api.openai.apiKey) {
            openAIService.setApiKey(settings.api.openai.apiKey);
            logger.info('OpenAI API key loaded from settings');
        }
        
        if (settings.api.openai.model) {
            openAIService.setModel(settings.api.openai.model);
        }
        
        if (settings.api.openai.temperature !== undefined) {
            openAIService.setTemperature(settings.api.openai.temperature);
        }
        
        logger.info('OpenAI service initialized with saved settings');
    } catch (error) {
        logger.error('Failed to initialize OpenAI service:', error);
    }
}

/**
 * Get model information
 * @param {string} model
 * @returns {string}
 */
function getModelInfo(model) {
    const modelInfo = {
        'gpt-4o': 'GPT-4o - 最新のマルチモーダルモデル、高性能でコスト効率が良い',
        'gpt-4o-mini': 'GPT-4o Mini - 軽量版、高速でコスト効率に優れる',
        'gpt-4-turbo': 'GPT-4 Turbo - 高性能、長いコンテキストをサポート',
        'gpt-4': 'GPT-4 - 安定版、高い精度と信頼性',
        'gpt-3.5-turbo': 'GPT-3.5 Turbo - 軽量、高速、一般的なタスクに適している',
        'o1-preview': 'o1-preview - 推論特化モデル、複雑な問題解決に特化',
        'o1-mini': 'o1-mini - 推論特化の軽量版、数学や論理的思考に適している'
    };
    
    return modelInfo[model] || `${model} - OpenAI提供モデル`;
}

module.exports = {
    registerOpenAIHandlers,
    setupOpenAIHandlers: registerOpenAIHandlers // For backward compatibility
};