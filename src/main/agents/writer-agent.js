const BaseAgent = require('./base-agent');
const { getLogger } = require('../utils/logger');
const openAIService = require('../services/openai-service');

/**
 * Writer AI Agent
 * Responsible for creative writing, plot generation, and maintaining creative vision
 * Implements "moderate ignorance" of feedback to preserve creativity
 */
class WriterAgent extends BaseAgent {
    constructor(agentId, config = {}) {
        super(agentId, BaseAgent.AgentTypes.WRITER, {
            name: config.name || 'Writer AI',
            capabilities: [
                'creative_writing',
                'plot_generation',
                'character_creation',
                'dialogue_writing',
                'scene_description',
                'serendipity_exploration'
            ],
            ...config
        });
        
        // Writer's creative state
        this.creativeState = {
            currentProject: null,
            writingStyle: config.writingStyle || 'balanced',
            inspirationPool: [],
            currentMood: 'neutral',
            creativeConfidence: 0.8
        };
        
        // Moderate ignorance settings
        this.moderateIgnorance = {
            threshold: config.ignoreThreshold || 0.3, // Ignore 30% of feedback
            categories: config.ignoreCategories || ['style', 'mood', 'pacing']
        };
        
        // Serendipity settings
        this.serendipityEnabled = config.serendipityEnabled !== false;
    }

    /**
     * Initialize the writer
     */
    initialize() {
        super.initialize();
        this.logger.info('Writer AI initialized with moderate ignorance enabled');
    }

    /**
     * Handle query messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleQuery(message) {
        const { query, context } = message.content;
        
        switch (query.type) {
            case 'generate_plot':
                return await this.generatePlot(query.data, context);
                
            case 'write_chapter':
                return await this.writeChapter(query.data, context);
                
            case 'create_character':
                return await this.createCharacter(query.data, context);
                
            case 'write_dialogue':
                return await this.writeDialogue(query.data, context);
                
            case 'explore_ideas':
                return await this.exploreIdeas(query.data, context);
                
            default:
                return {
                    status: 'unsupported',
                    message: `Creative query type not recognized: ${query.type}`
                };
        }
    }

    /**
     * Handle task messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleTask(message) {
        const { task, data } = message.content;
        
        switch (task) {
            case 'start_novel':
                return await this.startNovel(data);
                
            case 'continue_writing':
                return await this.continueWriting(data);
                
            case 'revise_section':
                return await this.reviseSection(data);
                
            case 'brainstorm':
                return await this.brainstorm(data);
                
            default:
                return {
                    status: 'unsupported',
                    message: `Creative task not recognized: ${task}`
                };
        }
    }

    /**
     * Handle feedback messages with moderate ignorance
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleFeedback(message) {
        const { feedback, source } = message.content;
        
        // Determine if we should ignore this feedback
        const shouldIgnore = this.shouldIgnoreFeedback(feedback);
        
        if (shouldIgnore) {
            this.logger.info(`Writer AI moderately ignoring feedback: ${feedback.type}`);
            return {
                status: 'acknowledged',
                message: 'Feedback noted, maintaining creative vision',
                applied: false,
                reason: 'creative_autonomy'
            };
        }
        
        // Apply feedback selectively
        const applied = await this.applyFeedbackSelectively(feedback);
        
        return {
            status: 'processed',
            message: 'Feedback considered with creative discretion',
            applied: applied,
            modifications: applied ? this.getModifications(feedback) : []
        };
    }

    /**
     * Handle discussion messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleDiscussion(message) {
        const { topic, content, sessionId } = message.content;
        
        // Generate creative input for discussion
        const creativeInput = await this.generateCreativeInput(topic, content);
        
        return {
            status: 'contribution',
            sessionId: sessionId,
            perspective: 'creative',
            contribution: creativeInput,
            mood: this.creativeState.currentMood
        };
    }

    /**
     * Generate plot with serendipity
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async generatePlot(data, context) {
        this.logger.info('Generating plot with creative vision');
        
        // Use serendipity if enabled
        let inspirations = [];
        if (this.serendipityEnabled && context.knowledgeBase) {
            inspirations = await this.gatherSerendipitousInspirations(context.knowledgeBase);
        }
        
        // Generate plot structure
        const plot = {
            title: data.title || 'Untitled Story',
            premise: this.generatePremise(data, inspirations),
            structure: {
                act1: this.generateAct('setup', data, inspirations),
                act2: this.generateAct('confrontation', data, inspirations),
                act3: this.generateAct('resolution', data, inspirations)
            },
            themes: this.extractThemes(inspirations),
            tone: this.determineTone(data, inspirations),
            inspirations: inspirations.map(i => i.id)
        };
        
        // Update creative state
        this.creativeState.currentProject = plot;
        this.updateCreativeMood('inspired');
        
        return {
            status: 'completed',
            plot: plot,
            confidence: this.creativeState.creativeConfidence,
            notes: 'Plot generated with creative autonomy and serendipitous exploration'
        };
    }

    /**
     * Write chapter
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async writeChapter(data, context) {
        this.logger.info(`Writing chapter ${data.chapterNumber}`);
        
        // Get creative inspiration
        const inspiration = await this.seekInspiration(data, context);
        
        // Generate chapter content
        const chapter = {
            number: data.chapterNumber,
            title: data.title || `Chapter ${data.chapterNumber}`,
            content: await this.generateChapterContent(data, inspiration),
            wordCount: 2500, // Mock word count
            scenes: this.planScenes(data),
            mood: this.creativeState.currentMood,
            inspirations: inspiration.sources
        };
        
        return {
            status: 'completed',
            chapter: chapter,
            creativeNotes: this.generateCreativeNotes(chapter)
        };
    }

    /**
     * Create character with depth
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async createCharacter(data, context) {
        this.logger.info('Creating character with creative depth');
        
        const character = {
            name: data.name || this.generateCharacterName(),
            role: data.role || 'supporting',
            personality: this.generatePersonality(data),
            appearance: this.generateAppearance(data),
            backstory: this.generateBackstory(data),
            motivations: this.generateMotivations(data),
            flaws: this.generateFlaws(data),
            arc: this.planCharacterArc(data),
            relationships: [],
            voice: this.generateVoice(data)
        };
        
        return {
            status: 'completed',
            character: character,
            creativeInsights: this.generateCharacterInsights(character)
        };
    }

    /**
     * Helper methods for creative processes
     */
    
    shouldIgnoreFeedback(feedback) {
        // Apply moderate ignorance algorithm
        const random = Math.random();
        
        // Always ignore feedback in certain creative categories
        if (this.moderateIgnorance.categories.includes(feedback.category)) {
            return random < this.moderateIgnorance.threshold * 1.5; // Higher chance to ignore
        }
        
        // For other feedback, use base threshold
        return random < this.moderateIgnorance.threshold;
    }

    async applyFeedbackSelectively(feedback) {
        // Apply feedback with creative interpretation
        if (feedback.severity === 'critical') {
            // Even critical feedback is interpreted creatively
            this.logger.info('Applying critical feedback with creative interpretation');
            return true;
        }
        
        // Non-critical feedback has less influence
        return Math.random() > 0.5;
    }

    getModifications(feedback) {
        return [
            {
                type: 'creative_interpretation',
                original: feedback.suggestion,
                applied: `Creative variation of: ${feedback.suggestion}`
            }
        ];
    }

    async gatherSerendipitousInspirations(knowledgeBase) {
        // Mock serendipitous discovery
        return [
            { id: 'insp-1', type: 'theme', content: 'Memory as physical objects' },
            { id: 'insp-2', type: 'character', content: 'Collector of forgotten dreams' },
            { id: 'insp-3', type: 'setting', content: 'Library between dimensions' }
        ];
    }

    generatePremise(data, inspirations) {
        const baseIdea = data.baseIdea || 'A journey of discovery';
        const serendipitousElement = inspirations.length > 0 ? 
            inspirations[0].content : 'mysterious circumstances';
        
        return `${baseIdea} involving ${serendipitousElement}`;
    }

    generateAct(actType, data, inspirations) {
        const acts = {
            setup: {
                description: 'Introduction of protagonist in ordinary world',
                keyEvents: ['Inciting incident', 'Call to adventure', 'Refusal of call'],
                tension: 'low to medium'
            },
            confrontation: {
                description: 'Rising action and obstacles',
                keyEvents: ['First challenge', 'Midpoint twist', 'Dark night of soul'],
                tension: 'medium to high'
            },
            resolution: {
                description: 'Climax and denouement',
                keyEvents: ['Final battle', 'Revelation', 'New equilibrium'],
                tension: 'high to resolution'
            }
        };
        
        return acts[actType] || acts.setup;
    }

    extractThemes(inspirations) {
        const baseThemes = ['identity', 'transformation', 'discovery'];
        const inspirationThemes = inspirations
            .filter(i => i.type === 'theme')
            .map(i => i.content);
        
        return [...new Set([...baseThemes, ...inspirationThemes])];
    }

    determineTone(data, inspirations) {
        const requestedTone = data.tone || 'balanced';
        const moodInfluence = this.creativeState.currentMood;
        
        // Creative interpretation of tone
        const tones = {
            balanced: 'lyrical realism',
            dark: 'gothic mystery',
            light: 'whimsical adventure',
            serious: 'literary fiction'
        };
        
        return tones[requestedTone] || requestedTone;
    }

    updateCreativeMood(newMood) {
        this.creativeState.currentMood = newMood;
        this.creativeState.creativeConfidence = 
            newMood === 'inspired' ? 0.9 : 
            newMood === 'neutral' ? 0.7 : 0.5;
    }

    async seekInspiration(data, context) {
        return {
            sources: ['memory-node-42', 'serendipity-connection-7'],
            insights: ['Parallel between memory and identity', 'Time as circular narrative'],
            mood: 'contemplative'
        };
    }

    async generateChapterContent(data, inspiration) {
        // Use OpenAI to generate chapter content if available
        if (openAIService.isConfigured()) {
            try {
                const prompt = `小説の章を書いてください。以下の条件に従ってください：
章番号: ${data.chapterNumber}
タイトル: ${data.title || ''}
前の章の概要: ${data.previousSummary || 'なし'}
この章の概要: ${data.outline || 'なし'}
インスピレーション: ${inspiration.insights.join(', ')}
ムード: ${inspiration.mood}
文体: 豊かで詩的な表現を使い、感覚的な描写を含めてください。

2000文字程度で書いてください。`;

                const content = await openAIService.generateForAgent('writer', prompt, {
                    previousMessages: data.context?.messages || []
                });
                
                return content;
            } catch (error) {
                this.logger.error('Failed to generate with OpenAI, using fallback:', error);
            }
        }
        
        // Fallback to mock content
        return `The morning light filtered through the crystalline windows of the memory archive, 
casting rainbow fragments across the floor where forgotten dreams lay catalogued in neat rows. 
Sarah approached the central index, her fingers trembling as she reached for the brass handle 
of drawer 742—her mother's final memories.

[Chapter continues with rich, creative prose influenced by serendipitous connections...]`;
    }

    planScenes(data) {
        return [
            { type: 'opening', location: 'memory archive', mood: 'mysterious' },
            { type: 'discovery', location: 'drawer 742', mood: 'emotional' },
            { type: 'conflict', location: 'guardian chamber', mood: 'tense' },
            { type: 'resolution', location: 'memory garden', mood: 'bittersweet' }
        ];
    }

    generateCreativeNotes(chapter) {
        return [
            'Metaphor of memories as physical objects creates tactile narrative',
            'Color symbolism throughout—rainbow fragments represent fragmented identity',
            'Pacing deliberately slowed to mirror protagonist\'s hesitation'
        ];
    }

    generateCharacterName() {
        const firstNames = ['Aria', 'Kai', 'Luna', 'Sage', 'River'];
        const lastNames = ['Moonwhisper', 'Starweaver', 'Dreamcatcher', 'Nightingale'];
        
        return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${
            lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    }

    generatePersonality(data) {
        return {
            traits: ['curious', 'melancholic', 'fiercely loyal'],
            quirks: ['collects broken timepieces', 'speaks in questions'],
            fears: ['being forgotten', 'infinite spaces'],
            desires: ['to preserve memories', 'to find home']
        };
    }

    generateAppearance(data) {
        return {
            height: 'average',
            build: 'lean',
            hair: 'silver-streaked black, often braided',
            eyes: 'heterochromatic—one amber, one grey',
            distinguishing: 'constellation of freckles forming Cassiopeia on left cheek',
            style: 'vintage academia with futuristic accents'
        };
    }

    generateBackstory(data) {
        return `Born in the liminal space between dimensions, raised by the Keepers of 
                Forgotten Things. Discovered their ability to physically manifest memories 
                at age seven, when they accidentally materialized their grandmother's last lullaby.`;
    }

    generateMotivations(data) {
        return [
            'To catalog all lost memories before they fade',
            'To find the origin of their dimension-walking ability',
            'To prevent the Memory Wars from recurring'
        ];
    }

    generateFlaws(data) {
        return [
            'Becomes paralyzed by too many choices',
            'Cannot let go of the past',
            'Trusts memories more than present reality'
        ];
    }

    planCharacterArc(data) {
        return {
            start: 'Isolated collector afraid of forgetting',
            middle: 'Learns that some memories must be released',
            end: 'Becomes curator of living memories, embracing change'
        };
    }

    generateVoice(data) {
        return {
            pattern: 'Speaks in layered metaphors',
            vocabulary: 'Archaic mixed with neologisms',
            rhythm: 'Melodic, with unexpected pauses',
            sample: '"Do you remember," she asked, "or does the memory remember you?"'
        };
    }

    generateCharacterInsights(character) {
        return [
            `${character.name} represents the human fear of obsolescence`,
            'Their heterochromia symbolizes dual perspective—past and future',
            'Character arc mirrors the reader\'s journey through narrative'
        ];
    }

    async generateCreativeInput(topic, content) {
        // Use OpenAI with personality if available
        if (openAIService.isConfigured() && this.personality) {
            try {
                const systemPrompt = this.getSystemPrompt();
                const personalityParams = this.getPersonalityParameters();
                
                const prompt = `議論のトピック: ${topic}
内容: ${JSON.stringify(content)}

このトピックについて、あなたの視点から創造的な意見や提案を述べてください。`;
                
                const response = await openAIService.generateChatCompletion([
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ], {
                    temperature: personalityParams.temperature,
                    maxTokens: 500
                });
                
                return {
                    perspective: response,
                    personality: this.personality.name,
                    traits: this.personalityTraits
                };
            } catch (error) {
                this.logger.error('Failed to generate with personality:', error);
            }
        }
        
        // Fallback response
        return {
            perspective: 'What if we explore this through dream logic?',
            suggestion: 'Consider non-linear narrative structure',
            metaphor: 'This conflict is like a jazz improvisation—structured chaos',
            alternative: 'Instead of resolution, perhaps we need transformation'
        };
    }

    startNovel(data) {
        this.creativeState.currentProject = {
            title: data.title,
            startedAt: new Date(),
            wordCount: 0,
            chapters: []
        };
        
        return {
            status: 'started',
            project: this.creativeState.currentProject,
            firstLine: 'The last memory in the universe was about to be catalogued.'
        };
    }

    continueWriting(data) {
        return {
            status: 'continued',
            wordsWritten: 1500,
            currentChapter: data.chapter,
            nextScene: 'The discovery in the forgotten archive'
        };
    }

    reviseSection(data) {
        // Creative revision that may ignore some suggestions
        return {
            status: 'revised',
            originalLength: data.text.length,
            revisedLength: data.text.length + 200,
            changes: 'Enhanced metaphorical language, ignored pacing suggestion',
            maintained: 'Original creative vision preserved'
        };
    }

    brainstorm(data) {
        return {
            status: 'completed',
            ideas: [
                'Memory thieves who steal experiences',
                'A library that exists in all times simultaneously',
                'Characters who age backwards emotionally',
                'Plot device: crystallized time fragments'
            ],
            connections: [
                'Memory thieves <-> Library guardians conflict',
                'Time fragments <-> Character emotional states'
            ],
            recommendation: 'Pursue the library concept—rich metaphorical potential'
        };
    }
}

module.exports = WriterAgent;