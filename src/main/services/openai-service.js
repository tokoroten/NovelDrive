const { getLogger } = require('../utils/logger');
const https = require('https');

/**
 * OpenAI API Service
 */
class OpenAIService {
    constructor() {
        this.logger = getLogger('openai-service');
        this.apiKey = null;
        this.baseURL = 'https://api.openai.com/v1';
        this.defaultModel = 'gpt-4o';
        this.defaultTemperature = 0.7;
    }

    /**
     * Set API key
     * @param {string} apiKey
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
        this.logger.info('OpenAI API key updated');
    }

    /**
     * Set model
     * @param {string} model
     */
    setModel(model) {
        this.defaultModel = model;
        this.logger.info(`OpenAI model set to: ${model}`);
    }

    /**
     * Set temperature
     * @param {number} temperature
     */
    setTemperature(temperature) {
        this.defaultTemperature = temperature;
        this.logger.info(`OpenAI temperature set to: ${temperature}`);
    }

    /**
     * Check if API key is configured
     * @returns {boolean}
     */
    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Make API request
     * @private
     * @param {string} endpoint
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async makeRequest(endpoint, data) {
        if (!this.apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(data);
            
            const options = {
                hostname: 'api.openai.com',
                path: `/v1/${endpoint}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                    'Authorization': `Bearer ${this.apiKey}`
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            const error = new Error(parsed.error?.message || 'API request failed');
                            error.status = res.statusCode;
                            error.response = parsed;
                            reject(error);
                        }
                    } catch (error) {
                        reject(new Error('Failed to parse API response'));
                    }
                });
            });

            req.on('error', (error) => {
                this.logger.error('Request error:', error);
                reject(error);
            });

            req.write(postData);
            req.end();
        });
    }

    /**
     * Generate text completion
     * @param {string} prompt
     * @param {Object} options
     * @returns {Promise<string>}
     */
    async generateText(prompt, options = {}) {
        try {
            const model = options.model || this.defaultModel;
            const requestData = {
                model: model,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: options.temperature || this.defaultTemperature,
                max_tokens: options.maxTokens || 1000,
                n: options.n || 1,
                stream: false
            };

            // Handle o1 models (reasoning models) differently
            if (model.startsWith('o1-')) {
                // o1 models don't support temperature, system messages, or tools
                delete requestData.temperature;
                requestData.max_completion_tokens = requestData.max_tokens;
                delete requestData.max_tokens;
                
                // o1 models work better with detailed user prompts
                requestData.messages[0].content = `Please think through this step by step:\n\n${prompt}`;
            }

            const response = await this.makeRequest('chat/completions', requestData);
            return response.choices[0].message.content;
        } catch (error) {
            this.logger.error('Failed to generate text:', error);
            throw error;
        }
    }

    /**
     * Generate chat completion with conversation history
     * @param {Array<{role: string, content: string}>} messages
     * @param {Object} options
     * @returns {Promise<string>}
     */
    async generateChatCompletion(messages, options = {}) {
        try {
            const model = options.model || this.defaultModel;
            const requestData = {
                model: model,
                messages: messages,
                temperature: options.temperature || this.defaultTemperature,
                max_tokens: options.maxTokens || 1000,
                n: options.n || 1,
                stream: false
            };

            // Handle o1 models differently
            if (model.startsWith('o1-')) {
                // o1 models don't support temperature or system messages
                delete requestData.temperature;
                requestData.max_completion_tokens = requestData.max_tokens;
                delete requestData.max_tokens;
                
                // Filter out system messages for o1 models
                requestData.messages = messages.filter(msg => msg.role !== 'system');
                
                // If there were system messages, prepend their content to the first user message
                const systemMessages = messages.filter(msg => msg.role === 'system');
                if (systemMessages.length > 0 && requestData.messages.length > 0) {
                    const systemContent = systemMessages.map(msg => msg.content).join('\n\n');
                    const firstUserMessage = requestData.messages.find(msg => msg.role === 'user');
                    if (firstUserMessage) {
                        firstUserMessage.content = `${systemContent}\n\n${firstUserMessage.content}`;
                    }
                }
            }

            const response = await this.makeRequest('chat/completions', requestData);
            return response.choices[0].message.content;
        } catch (error) {
            this.logger.error('Failed to generate chat completion:', error);
            throw error;
        }
    }

    /**
     * Generate text for specific agent role
     * @param {string} agentType
     * @param {string} content
     * @param {Object} context
     * @returns {Promise<string>}
     */
    async generateForAgent(agentType, content, context = {}) {
        const systemPrompts = {
            'deputy-editor': `あなたは小説の副編集長AIです。作品の品質評価、構造分析、改善提案を行います。
客観的で建設的なフィードバックを提供してください。`,
            
            'writer': `あなたは創造的な作家AIです。独自の視点と豊かな表現力で物語を紡ぎます。
時には編集者の意見を参考にしつつも、あなたの創造性を大切にしてください。`,
            
            'editor': `あなたは協調的な編集者AIです。作家の意図を尊重しながら、作品をより良くするための提案を行います。
具体的で実践的なアドバイスを心がけてください。`,
            
            'proofreader': `あなたは緻密な校正者AIです。文章の矛盾、誤字脱字、文法的な問題を見つけ出します。
論理的な一貫性と正確性を重視してください。`
        };

        const systemPrompt = systemPrompts[agentType] || '小説創作を支援するAIアシスタントです。';

        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: content
            }
        ];

        // Add context if provided
        if (context.previousMessages) {
            messages.splice(1, 0, ...context.previousMessages);
        }

        return await this.generateChatCompletion(messages, context.options || {});
    }

    /**
     * Generate creative variations
     * @param {string} text
     * @param {number} count
     * @returns {Promise<Array<string>>}
     */
    async generateVariations(text, count = 3) {
        const prompt = `以下のテキストの創造的なバリエーションを${count}つ生成してください。
それぞれ異なるアプローチや視点で書いてください。

元のテキスト：
${text}

バリエーション：`;

        try {
            const response = await this.generateText(prompt, {
                temperature: 0.9,
                maxTokens: 1500
            });

            // Parse variations from response
            const variations = response.split(/\d+\.|バリエーション\d+:|■/).filter(v => v.trim());
            return variations.slice(0, count);
        } catch (error) {
            this.logger.error('Failed to generate variations:', error);
            throw error;
        }
    }

    /**
     * Analyze text for various aspects
     * @param {string} text
     * @param {string} analysisType
     * @returns {Promise<Object>}
     */
    async analyzeText(text, analysisType) {
        const prompts = {
            sentiment: `以下のテキストの感情分析を行い、JSON形式で結果を返してください：
{
    "overall": "positive/negative/neutral",
    "emotions": ["感情1", "感情2"],
    "intensity": 0-10
}

テキスト：${text}`,

            structure: `以下のテキストの構造分析を行い、JSON形式で結果を返してください：
{
    "paragraphs": 段落数,
    "sentences": 文数,
    "averageLength": 平均文長,
    "complexity": "simple/medium/complex"
}

テキスト：${text}`,

            character: `以下のテキストからキャラクター分析を行い、JSON形式で結果を返してください：
{
    "characters": ["キャラ名1", "キャラ名2"],
    "traits": {"キャラ名": ["特徴1", "特徴2"]},
    "relationships": [{"from": "キャラ1", "to": "キャラ2", "type": "関係性"}]
}

テキスト：${text}`
        };

        const prompt = prompts[analysisType];
        if (!prompt) {
            throw new Error(`Unknown analysis type: ${analysisType}`);
        }

        try {
            const response = await this.generateText(prompt, {
                temperature: 0.3,
                maxTokens: 500
            });

            // Try to parse JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return { raw: response };
        } catch (error) {
            this.logger.error('Failed to analyze text:', error);
            throw error;
        }
    }
}

// Export singleton instance
const openAIService = new OpenAIService();
module.exports = openAIService;