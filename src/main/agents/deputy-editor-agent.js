const BaseAgent = require('./base-agent');
const { getLogger } = require('../utils/logger');
const openAIService = require('../services/openai-service');

/**
 * Deputy Editor AI Agent
 * Responsible for narrative analysis, quality evaluation, and raising potential issues
 */
class DeputyEditorAgent extends BaseAgent {
    constructor(agentId, config = {}) {
        super(agentId, BaseAgent.AgentTypes.DEPUTY_EDITOR, {
            name: config.name || 'Deputy Editor AI',
            capabilities: [
                'narrative_analysis',
                'quality_evaluation',
                'issue_detection',
                'structural_review',
                'consistency_check',
                'improvement_suggestions'
            ],
            ...config
        });
        
        this.analysisContext = {
            currentProject: null,
            narrativeStructure: null,
            identifiedIssues: [],
            qualityMetrics: {}
        };
    }

    /**
     * Initialize the deputy editor
     */
    initialize() {
        super.initialize();
        this.logger.info('Deputy Editor AI initialized');
    }

    /**
     * Handle query messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleQuery(message) {
        const { query, context } = message.content;
        
        switch (query.type) {
            case 'analyze_narrative':
                return await this.analyzeNarrative(query.data, context);
                
            case 'evaluate_quality':
                return await this.evaluateQuality(query.data, context);
                
            case 'check_consistency':
                return await this.checkConsistency(query.data, context);
                
            case 'suggest_improvements':
                return await this.suggestImprovements(query.data, context);
                
            default:
                return {
                    status: 'unsupported',
                    message: `Unsupported query type: ${query.type}`
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
            case 'review_plot':
                return await this.reviewPlot(data);
                
            case 'review_chapter':
                return await this.reviewChapter(data);
                
            case 'review_character':
                return await this.reviewCharacterDevelopment(data);
                
            case 'review_worldbuilding':
                return await this.reviewWorldbuilding(data);
                
            default:
                return {
                    status: 'unsupported',
                    message: `Unsupported task: ${task}`
                };
        }
    }

    /**
     * Handle feedback messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleFeedback(message) {
        const { feedback, context } = message.content;
        
        // Process feedback and update analysis context
        this.logger.info('Deputy Editor received feedback:', feedback);
        
        // Update quality metrics based on feedback
        if (feedback.type === 'quality_adjustment') {
            this.updateQualityMetrics(feedback.data);
        }
        
        return {
            status: 'acknowledged',
            message: 'Feedback received and processed',
            adjustments: this.analysisContext.qualityMetrics
        };
    }

    /**
     * Handle discussion messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleDiscussion(message) {
        const { topic, content, sessionId } = message.content;
        
        // Analyze discussion content and provide editorial perspective
        const analysis = await this.analyzeDiscussionContent(topic, content);
        
        return {
            status: 'contribution',
            sessionId: sessionId,
            perspective: 'editorial',
            analysis: analysis,
            recommendations: this.generateRecommendations(analysis)
        };
    }

    /**
     * Handle plot creation messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handlePlotCreation(message) {
        const { message: userMessage, plotAspect, currentPlotElements, context } = message.content;
        
        this.logger.info(`Deputy Editor handling plot creation: ${plotAspect}`);
        
        // Generate plot suggestions based on aspect
        const suggestions = await this.generatePlotSuggestions(userMessage, plotAspect, currentPlotElements, context);
        
        return {
            status: 'plot_contribution',
            perspective: 'commercial_viability',
            viewpoint: suggestions.viewpoint,
            themes: suggestions.themes,
            premise: suggestions.premise,
            structure: suggestions.structure,
            conflicts: suggestions.conflicts,
            marketConsiderations: suggestions.marketConsiderations
        };
    }

    /**
     * Generate plot suggestions
     * @param {string} userMessage
     * @param {string} plotAspect
     * @param {Object} currentPlotElements
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async generatePlotSuggestions(userMessage, plotAspect, currentPlotElements, context) {
        const systemPrompt = this.getSystemPrompt() || 
            `You are a Deputy Editor AI focused on commercial viability and overall story structure. 
            Analyze plot proposals from a market perspective and suggest improvements.`;
        
        const prompt = `As a deputy editor, analyze this plot creation request:
User Message: ${userMessage}
Plot Aspect: ${plotAspect}
Current Plot Elements: ${JSON.stringify(currentPlotElements, null, 2)}

Provide suggestions focusing on:
1. Commercial viability and market appeal
2. Overall narrative structure and pacing
3. Target audience considerations
4. Potential issues that might affect publication

Format your response as JSON with the following structure:
{
    "viewpoint": "Your editorial perspective on the plot development",
    "themes": ["theme1", "theme2"],
    "premise": { "title": "suggested title", "description": "premise description" },
    "structure": { "acts": [...] },
    "conflicts": [{ "type": "main/sub", "description": "...", "priority": "main/secondary" }],
    "marketConsiderations": "Analysis of market appeal and commercial viability"
}`;

        try {
            const response = await openAIService.createChatCompletion([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ], {
                temperature: this.getPersonalityParameters().temperature || 0.7,
                response_format: { type: "json_object" }
            });
            
            return JSON.parse(response.content);
        } catch (error) {
            this.logger.error('Error generating plot suggestions:', error);
            
            // Fallback response
            return {
                viewpoint: "プロットの商業的な可能性を評価し、市場での成功を目指した構造を提案します。",
                themes: plotAspect === 'themes' ? ["読者の共感を呼ぶテーマ", "現代的な社会問題"] : [],
                premise: plotAspect === 'premise' ? {
                    title: "タイトル案",
                    description: "市場で注目を集める可能性のある前提"
                } : null,
                structure: plotAspect === 'structure' ? {
                    acts: [
                        { name: "第一幕", description: "読者を引き込む導入" },
                        { name: "第二幕", description: "緊張感を維持する展開" },
                        { name: "第三幕", description: "満足感のある結末" }
                    ]
                } : null,
                conflicts: plotAspect === 'conflicts' ? [
                    { type: "main", description: "読者の興味を引く中心的な対立", priority: "main" }
                ] : [],
                marketConsiderations: "ターゲット読者層に訴求する要素を含めることで、商業的成功の可能性を高めます。"
            };
        }
    }

    /**
     * Analyze narrative structure
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async analyzeNarrative(data, context) {
        this.logger.info('Analyzing narrative structure');
        
        // Mock analysis for now
        const analysis = {
            structure: {
                type: 'three_act',
                acts: [
                    { name: 'Setup', completeness: 0.8, issues: [] },
                    { name: 'Confrontation', completeness: 0.6, issues: ['Pacing concerns'] },
                    { name: 'Resolution', completeness: 0.3, issues: ['Incomplete'] }
                ]
            },
            pacing: {
                overall: 'moderate',
                issues: ['Slow middle section', 'Rushed climax']
            },
            themes: {
                primary: ['Identity', 'Redemption'],
                secondary: ['Family', 'Sacrifice'],
                consistency: 0.85
            },
            characterArcs: {
                protagonist: { development: 0.9, consistency: 0.95 },
                antagonist: { development: 0.7, consistency: 0.8 },
                supporting: { development: 0.6, consistency: 0.7 }
            }
        };
        
        this.analysisContext.narrativeStructure = analysis;
        
        return {
            status: 'completed',
            analysis: analysis,
            recommendations: this.generateNarrativeRecommendations(analysis)
        };
    }

    /**
     * Evaluate quality
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async evaluateQuality(data, context) {
        this.logger.info('Evaluating content quality');
        
        // Use OpenAI to evaluate quality if available
        if (openAIService.isConfigured()) {
            try {
                const prompt = `副編集長として以下の小説コンテンツの品質を評価してください：

${data.content || data.summary || 'コンテンツなし'}

以下の基準で評価してください（各項目10点満点）：
1. 物語の完成度（プロット、構成、起承転結）
2. 市場性（読者への訴求力、商業的可能性）
3. 独創性（オリジナリティ、新鮮さ）
4. キャラクター（魅力、成長、一貫性）
5. 文章力（表現力、読みやすさ）
6. 世界観（設定の深さ、一貫性）

各項目の点数と総合評価（100点満点）、強み、改善点を含めて評価してください。
65点以上の作品のみ出版価値があると判断します。`;

                const response = await openAIService.generateForAgent('deputy-editor', prompt);
                
                // Parse the response and create structured evaluation
                const evaluation = {
                    overall: 7.5, // This would be parsed from response
                    categories: {
                        plot: 8.0,
                        marketability: 7.5,
                        originality: 7.0,
                        characters: 8.0,
                        writing: 6.5,
                        worldbuilding: 8.5
                    },
                    aiEvaluation: response,
                    publishable: false // Set based on 65+ score threshold
                };
                
                this.analysisContext.qualityMetrics = evaluation;
                
                return {
                    status: 'completed',
                    evaluation: evaluation,
                    priorityIssues: this.identifyPriorityIssues(evaluation)
                };
            } catch (error) {
                this.logger.error('Failed to evaluate with OpenAI:', error);
            }
        }
        
        // Fallback to mock evaluation
        const evaluation = {
            overall: 7.5,
            categories: {
                plot: 8.0,
                characters: 7.5,
                dialogue: 7.0,
                description: 8.0,
                pacing: 6.5,
                worldbuilding: 8.5
            },
            strengths: [
                'Strong world-building',
                'Well-developed protagonist',
                'Vivid descriptions'
            ],
            weaknesses: [
                'Pacing issues in middle section',
                'Some dialogue feels unnatural',
                'Secondary characters need development'
            ]
        };
        
        this.analysisContext.qualityMetrics = evaluation;
        
        return {
            status: 'completed',
            evaluation: evaluation,
            priorityIssues: this.identifyPriorityIssues(evaluation)
        };
    }

    /**
     * Check consistency
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async checkConsistency(data, context) {
        this.logger.info('Checking narrative consistency');
        
        // Mock consistency check
        const consistencyReport = {
            timeline: {
                consistent: false,
                issues: [
                    { chapter: 5, issue: 'Character age discrepancy' },
                    { chapter: 8, issue: 'Event sequence error' }
                ]
            },
            characters: {
                consistent: true,
                issues: []
            },
            worldRules: {
                consistent: false,
                issues: [
                    { chapter: 3, issue: 'Magic system contradiction' }
                ]
            },
            plot: {
                consistent: true,
                issues: []
            }
        };
        
        return {
            status: 'completed',
            report: consistencyReport,
            criticalIssues: this.filterCriticalIssues(consistencyReport)
        };
    }

    /**
     * Suggest improvements
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async suggestImprovements(data, context) {
        this.logger.info('Generating improvement suggestions');
        
        const suggestions = [
            {
                category: 'pacing',
                priority: 'high',
                suggestion: 'Consider adding a subplot in chapters 6-8 to maintain reader engagement',
                impact: 'Would improve mid-story pacing issues'
            },
            {
                category: 'character',
                priority: 'medium',
                suggestion: 'Develop the antagonist\'s backstory to create more depth',
                impact: 'Would enhance reader empathy and story complexity'
            },
            {
                category: 'dialogue',
                priority: 'medium',
                suggestion: 'Review dialogue in chapter 4 for more natural flow',
                impact: 'Would improve character authenticity'
            },
            {
                category: 'worldbuilding',
                priority: 'low',
                suggestion: 'Add more sensory details to location descriptions',
                impact: 'Would enhance immersion'
            }
        ];
        
        return {
            status: 'completed',
            suggestions: suggestions,
            implementationOrder: this.prioritizeSuggestions(suggestions)
        };
    }

    /**
     * Review plot
     * @param {Object} plotData
     * @returns {Promise<Object>}
     */
    async reviewPlot(plotData) {
        this.logger.info('Reviewing plot structure');
        
        const review = {
            structure: {
                rating: 8,
                comments: 'Well-structured with clear three-act progression'
            },
            conflicts: {
                main: { clarity: 9, tension: 7 },
                subplots: { integration: 6, relevance: 8 }
            },
            resolution: {
                satisfaction: 7,
                loose_ends: ['Character B arc incomplete', 'Mystery X unresolved']
            },
            recommendations: [
                'Strengthen the central conflict in Act 2',
                'Better integrate subplot with main narrative',
                'Clarify character motivations in climax'
            ]
        };
        
        return {
            status: 'completed',
            review: review,
            approval: review.structure.rating >= 7
        };
    }

    /**
     * Review chapter
     * @param {Object} chapterData
     * @returns {Promise<Object>}
     */
    async reviewChapter(chapterData) {
        this.logger.info(`Reviewing chapter: ${chapterData.number}`);
        
        const review = {
            chapterNumber: chapterData.number,
            overallQuality: 7.5,
            elements: {
                opening: { strength: 8, notes: 'Strong hook' },
                development: { strength: 7, notes: 'Good pacing' },
                ending: { strength: 7, notes: 'Adequate cliffhanger' }
            },
            issues: [
                { type: 'pacing', severity: 'minor', location: 'middle section' },
                { type: 'dialogue', severity: 'minor', location: 'conversation on page 5' }
            ],
            continuity: {
                withPrevious: true,
                withOverall: true
            }
        };
        
        return {
            status: 'completed',
            review: review,
            revision_needed: review.issues.some(i => i.severity === 'major')
        };
    }

    /**
     * Helper methods
     */
    
    generateNarrativeRecommendations(analysis) {
        const recommendations = [];
        
        // Check act completeness
        analysis.structure.acts.forEach(act => {
            if (act.completeness < 0.7) {
                recommendations.push({
                    type: 'structural',
                    priority: 'high',
                    recommendation: `Develop ${act.name} further (currently ${Math.round(act.completeness * 100)}% complete)`
                });
            }
        });
        
        // Check pacing
        if (analysis.pacing.issues.length > 0) {
            recommendations.push({
                type: 'pacing',
                priority: 'medium',
                recommendation: `Address pacing issues: ${analysis.pacing.issues.join(', ')}`
            });
        }
        
        return recommendations;
    }

    identifyPriorityIssues(evaluation) {
        const priorityIssues = [];
        
        Object.entries(evaluation.categories).forEach(([category, score]) => {
            if (score < 7) {
                priorityIssues.push({
                    category: category,
                    score: score,
                    priority: score < 6 ? 'high' : 'medium'
                });
            }
        });
        
        return priorityIssues.sort((a, b) => a.score - b.score);
    }

    filterCriticalIssues(report) {
        const critical = [];
        
        Object.entries(report).forEach(([category, data]) => {
            if (!data.consistent && data.issues.length > 0) {
                critical.push({
                    category: category,
                    issueCount: data.issues.length,
                    issues: data.issues
                });
            }
        });
        
        return critical;
    }

    prioritizeSuggestions(suggestions) {
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        return suggestions
            .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
            .map(s => s.category);
    }

    updateQualityMetrics(adjustments) {
        Object.entries(adjustments).forEach(([key, value]) => {
            if (this.analysisContext.qualityMetrics[key] !== undefined) {
                this.analysisContext.qualityMetrics[key] = value;
            }
        });
    }

    async analyzeDiscussionContent(topic, content) {
        // Analyze discussion from editorial perspective
        return {
            topicRelevance: 0.9,
            narrativeImpact: 'positive',
            concerns: [],
            opportunities: ['Could enhance character depth', 'Aligns with theme']
        };
    }

    generateRecommendations(analysis) {
        return [
            'Consider incorporating this element into the main narrative',
            'Ensure consistency with established world rules',
            'This could strengthen the thematic resonance'
        ];
    }

    reviewCharacterDevelopment(data) {
        return {
            status: 'completed',
            characterName: data.name,
            arcProgression: 0.7,
            consistency: 0.85,
            depth: 0.75,
            recommendations: [
                'Add more internal conflict',
                'Clarify character motivations',
                'Develop relationships with other characters'
            ]
        };
    }

    reviewWorldbuilding(data) {
        return {
            status: 'completed',
            consistency: 0.9,
            depth: 0.85,
            uniqueness: 0.8,
            issues: ['Magic system needs clearer rules'],
            strengths: ['Rich cultural details', 'Believable geography']
        };
    }
}

module.exports = DeputyEditorAgent;