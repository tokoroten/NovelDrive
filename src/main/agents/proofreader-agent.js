const BaseAgent = require('./base-agent');
const { getLogger } = require('../utils/logger');

/**
 * Proofreader AI Agent
 * Responsible for detecting contradictions, checking consistency, and final quality assurance
 */
class ProofreaderAgent extends BaseAgent {
    constructor(agentId, config = {}) {
        super(agentId, BaseAgent.AgentTypes.PROOFREADER, {
            name: config.name || 'Proofreader AI',
            capabilities: [
                'contradiction_detection',
                'consistency_checking',
                'timeline_verification',
                'fact_checking',
                'continuity_analysis',
                'final_quality_check'
            ],
            ...config
        });
        
        // Proofreader's knowledge base
        this.knowledgeBase = {
            characters: new Map(),
            timeline: [],
            worldRules: new Map(),
            establishedFacts: new Map(),
            linguisticPatterns: new Map()
        };
        
        // Checking configuration
        this.checkingConfig = {
            strictness: config.strictness || 'high',
            focusAreas: config.focusAreas || ['continuity', 'consistency', 'accuracy'],
            culturalSensitivity: true,
            linguisticPrecision: true
        };
    }

    /**
     * Initialize the proofreader
     */
    initialize() {
        super.initialize();
        this.logger.info('Proofreader AI initialized with high precision checking');
    }

    /**
     * Handle query messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleQuery(message) {
        const { query, context } = message.content;
        
        switch (query.type) {
            case 'check_consistency':
                return await this.checkConsistency(query.data, context);
                
            case 'verify_timeline':
                return await this.verifyTimeline(query.data, context);
                
            case 'detect_contradictions':
                return await this.detectContradictions(query.data, context);
                
            case 'final_proof':
                return await this.performFinalProof(query.data, context);
                
            case 'fact_check':
                return await this.factCheck(query.data, context);
                
            default:
                return {
                    status: 'unsupported',
                    message: `Proofreading query type not recognized: ${query.type}`
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
            case 'build_knowledge_base':
                return await this.buildKnowledgeBase(data);
                
            case 'comprehensive_check':
                return await this.performComprehensiveCheck(data);
                
            case 'update_continuity':
                return await this.updateContinuity(data);
                
            case 'generate_report':
                return await this.generateProofreadingReport(data);
                
            default:
                return {
                    status: 'unsupported',
                    message: `Proofreading task not recognized: ${task}`
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
        
        // Update knowledge base based on feedback
        if (feedback.type === 'false_positive') {
            this.adjustDetectionSensitivity(feedback);
        } else if (feedback.type === 'missed_issue') {
            this.enhanceDetectionPatterns(feedback);
        }
        
        return {
            status: 'acknowledged',
            message: 'Proofreading patterns updated',
            adjustment: this.getAdjustmentDetails(feedback)
        };
    }

    /**
     * Handle discussion messages
     * @param {Object} message
     * @returns {Promise<Object>}
     */
    async handleDiscussion(message) {
        const { topic, content, sessionId } = message.content;
        
        // Provide fact-checking perspective in discussion
        const proofreadingInput = await this.generateProofreadingPerspective(topic, content);
        
        return {
            status: 'contribution',
            sessionId: sessionId,
            perspective: 'fact_checking',
            contribution: proofreadingInput,
            concerns: this.identifyConcerns(content)
        };
    }

    /**
     * Check consistency across the manuscript
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async checkConsistency(data, context) {
        this.logger.info('Performing consistency check');
        
        const consistencyReport = {
            characters: await this.checkCharacterConsistency(data),
            settings: await this.checkSettingConsistency(data),
            plotPoints: await this.checkPlotConsistency(data),
            language: await this.checkLanguageConsistency(data),
            overall: {
                score: 0,
                issues: [],
                criticalIssues: []
            }
        };
        
        // Calculate overall consistency score
        consistencyReport.overall = this.calculateOverallConsistency(consistencyReport);
        
        return {
            status: 'completed',
            report: consistencyReport,
            recommendations: this.generateConsistencyRecommendations(consistencyReport),
            severity: this.assessSeverity(consistencyReport)
        };
    }

    /**
     * Verify timeline accuracy
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async verifyTimeline(data, context) {
        this.logger.info('Verifying timeline consistency');
        
        const timelineAnalysis = {
            events: this.extractTimelineEvents(data),
            chronology: [],
            conflicts: [],
            gaps: [],
            impossibilities: []
        };
        
        // Build chronology
        timelineAnalysis.chronology = this.buildChronology(timelineAnalysis.events);
        
        // Detect timeline issues
        timelineAnalysis.conflicts = this.detectTimelineConflicts(timelineAnalysis.chronology);
        timelineAnalysis.gaps = this.detectTimelineGaps(timelineAnalysis.chronology);
        timelineAnalysis.impossibilities = this.detectImpossibilities(timelineAnalysis.chronology);
        
        return {
            status: 'completed',
            analysis: timelineAnalysis,
            issues: [
                ...timelineAnalysis.conflicts,
                ...timelineAnalysis.gaps,
                ...timelineAnalysis.impossibilities
            ],
            suggestions: this.generateTimelineFixes(timelineAnalysis)
        };
    }

    /**
     * Detect contradictions in the text
     * @param {Object} data
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    async detectContradictions(data, context) {
        this.logger.info('Detecting contradictions');
        
        const contradictions = {
            factual: [],
            character: [],
            world: [],
            plot: []
        };
        
        // Detect different types of contradictions
        contradictions.factual = await this.detectFactualContradictions(data);
        contradictions.character = await this.detectCharacterContradictions(data);
        contradictions.world = await this.detectWorldContradictions(data);
        contradictions.plot = await this.detectPlotContradictions(data);
        
        // Prioritize by severity
        const prioritized = this.prioritizeContradictions(contradictions);
        
        return {
            status: 'completed',
            contradictions: contradictions,
            total: this.countContradictions(contradictions),
            priority: prioritized,
            impact: this.assessContradictionImpact(contradictions)
        };
    }

    /**
     * Helper methods for proofreading functions
     */
    
    async checkCharacterConsistency(data) {
        const issues = [];
        
        // Mock character consistency checks
        issues.push({
            character: 'Sarah',
            issue: 'Eye color described as blue in Ch.3, brown in Ch.7',
            severity: 'medium',
            locations: ['Chapter 3, p.45', 'Chapter 7, p.123']
        });
        
        issues.push({
            character: 'Marcus',
            issue: 'Age inconsistency: stated as 28, but timeline suggests 30',
            severity: 'low',
            locations: ['Chapter 1, p.12', 'Timeline calculation']
        });
        
        return {
            checked: true,
            issues: issues,
            consistency: issues.length === 0 ? 1.0 : 0.85
        };
    }

    async checkSettingConsistency(data) {
        return {
            checked: true,
            issues: [
                {
                    setting: 'Memory Archive',
                    issue: 'Layout description varies between chapters',
                    severity: 'low',
                    suggestion: 'Standardize architectural details'
                }
            ],
            consistency: 0.92
        };
    }

    async checkPlotConsistency(data) {
        return {
            checked: true,
            issues: [],
            consistency: 1.0,
            notes: 'Plot progression is logically consistent'
        };
    }

    async checkLanguageConsistency(data) {
        return {
            checked: true,
            issues: [
                {
                    type: 'terminology',
                    issue: 'Inconsistent use of "memory keeper" vs "keeper of memories"',
                    occurrences: 12,
                    recommendation: 'Standardize to single term'
                }
            ],
            consistency: 0.95
        };
    }

    calculateOverallConsistency(report) {
        const scores = [
            report.characters.consistency,
            report.settings.consistency,
            report.plotPoints.consistency,
            report.language.consistency
        ];
        
        const average = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        const allIssues = [
            ...report.characters.issues,
            ...report.settings.issues,
            ...report.plotPoints.issues,
            ...report.language.issues
        ];
        
        const criticalIssues = allIssues.filter(i => i.severity === 'high');
        
        return {
            score: average,
            issues: allIssues,
            criticalIssues: criticalIssues
        };
    }

    generateConsistencyRecommendations(report) {
        const recommendations = [];
        
        if (report.overall.criticalIssues.length > 0) {
            recommendations.push({
                priority: 'high',
                action: 'Address critical inconsistencies immediately',
                items: report.overall.criticalIssues
            });
        }
        
        if (report.characters.consistency < 0.9) {
            recommendations.push({
                priority: 'medium',
                action: 'Create character consistency sheet',
                reason: 'Multiple character detail conflicts detected'
            });
        }
        
        return recommendations;
    }

    assessSeverity(report) {
        if (report.overall.criticalIssues.length > 0) {
            return 'high';
        } else if (report.overall.issues.length > 10) {
            return 'medium';
        }
        return 'low';
    }

    extractTimelineEvents(data) {
        // Mock timeline extraction
        return [
            { id: 1, description: 'Sarah discovers archive', time: 'Day 1', chapter: 1 },
            { id: 2, description: 'First memory extraction', time: 'Day 3', chapter: 2 },
            { id: 3, description: 'Meeting with Marcus', time: 'Day 2', chapter: 3 },
            { id: 4, description: 'Archive breach', time: 'Day 5', chapter: 5 }
        ];
    }

    buildChronology(events) {
        return events.sort((a, b) => {
            const dayA = parseInt(a.time.match(/\d+/)[0]);
            const dayB = parseInt(b.time.match(/\d+/)[0]);
            return dayA - dayB;
        });
    }

    detectTimelineConflicts(chronology) {
        const conflicts = [];
        
        // Check if chapter order matches chronological order
        for (let i = 0; i < chronology.length - 1; i++) {
            if (chronology[i].chapter > chronology[i + 1].chapter) {
                conflicts.push({
                    type: 'sequence',
                    event1: chronology[i],
                    event2: chronology[i + 1],
                    issue: 'Events appear out of chronological order in narrative'
                });
            }
        }
        
        return conflicts;
    }

    detectTimelineGaps(chronology) {
        const gaps = [];
        
        for (let i = 0; i < chronology.length - 1; i++) {
            const day1 = parseInt(chronology[i].time.match(/\d+/)[0]);
            const day2 = parseInt(chronology[i + 1].time.match(/\d+/)[0]);
            
            if (day2 - day1 > 3) {
                gaps.push({
                    type: 'gap',
                    between: [chronology[i], chronology[i + 1]],
                    duration: `${day2 - day1} days`,
                    issue: 'Unexplained time gap in narrative'
                });
            }
        }
        
        return gaps;
    }

    detectImpossibilities(chronology) {
        // Mock impossibility detection
        return [
            {
                type: 'travel_time',
                issue: 'Character travels between locations faster than possible',
                events: ['Chapter 4: Morning in City A', 'Chapter 4: Afternoon in City B (500km away)']
            }
        ];
    }

    generateTimelineFixes(analysis) {
        const fixes = [];
        
        analysis.conflicts.forEach(conflict => {
            fixes.push({
                issue: conflict,
                suggestion: 'Reorder chapters or add flashback indicators',
                impact: 'medium'
            });
        });
        
        analysis.gaps.forEach(gap => {
            fixes.push({
                issue: gap,
                suggestion: 'Add transitional content or time skip notation',
                impact: 'low'
            });
        });
        
        return fixes;
    }

    async detectFactualContradictions(data) {
        return [
            {
                type: 'factual',
                statement1: 'Archive founded in 2045',
                statement2: 'Archive celebrates 50th anniversary in 2090',
                locations: ['Ch.1 p.23', 'Ch.8 p.156'],
                severity: 'high'
            }
        ];
    }

    async detectCharacterContradictions(data) {
        return [
            {
                type: 'character',
                character: 'Sarah',
                trait1: 'Fear of heights established',
                trait2: 'Climbs tower without hesitation',
                locations: ['Ch.2 p.34', 'Ch.6 p.98'],
                severity: 'medium',
                note: 'Could be character growth if addressed'
            }
        ];
    }

    async detectWorldContradictions(data) {
        return [
            {
                type: 'world_rule',
                rule1: 'Memory extraction requires physical contact',
                violation: 'Remote extraction performed',
                locations: ['Ch.1 p.15', 'Ch.9 p.178'],
                severity: 'high',
                impact: 'Breaks established magic system'
            }
        ];
    }

    async detectPlotContradictions(data) {
        return [];  // No plot contradictions in this example
    }

    prioritizeContradictions(contradictions) {
        const all = [
            ...contradictions.factual,
            ...contradictions.character,
            ...contradictions.world,
            ...contradictions.plot
        ];
        
        return all.sort((a, b) => {
            const severityOrder = { high: 1, medium: 2, low: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }

    countContradictions(contradictions) {
        return Object.values(contradictions).reduce((sum, arr) => sum + arr.length, 0);
    }

    assessContradictionImpact(contradictions) {
        const highSeverity = this.prioritizeContradictions(contradictions)
            .filter(c => c.severity === 'high').length;
        
        if (highSeverity > 2) return 'critical';
        if (highSeverity > 0) return 'significant';
        return 'minor';
    }

    adjustDetectionSensitivity(feedback) {
        // Reduce sensitivity for specific pattern
        this.checkingConfig.strictness = 'medium';
    }

    enhanceDetectionPatterns(feedback) {
        // Add new pattern to detection
        this.knowledgeBase.establishedFacts.set(
            feedback.missedPattern,
            { importance: 'high', added: new Date() }
        );
    }

    getAdjustmentDetails(feedback) {
        return {
            type: feedback.type,
            action: feedback.type === 'false_positive' ? 'reduced_sensitivity' : 'enhanced_detection',
            scope: feedback.scope || 'general'
        };
    }

    async generateProofreadingPerspective(topic, content) {
        return {
            factualConcerns: this.checkFactualAccuracy(content),
            consistencyConcerns: this.quickConsistencyCheck(content),
            suggestions: [
                'Verify timeline alignment',
                'Check character detail consistency',
                'Confirm world rule adherence'
            ]
        };
    }

    identifyConcerns(content) {
        return [
            'Potential timeline conflict mentioned',
            'Character behavior seems inconsistent with established traits'
        ];
    }

    checkFactualAccuracy(content) {
        return ['Date mentioned needs verification', 'Distance calculation seems off'];
    }

    quickConsistencyCheck(content) {
        return ['Character name spelling varies', 'Location description differs'];
    }

    async buildKnowledgeBase(data) {
        // Build comprehensive knowledge base from manuscript
        this.knowledgeBase.characters.clear();
        this.knowledgeBase.timeline = [];
        this.knowledgeBase.worldRules.clear();
        
        // Populate knowledge base (mock)
        this.knowledgeBase.characters.set('Sarah', {
            traits: ['brave', 'curious'],
            physical: { eyes: 'blue', hair: 'black' },
            age: 25
        });
        
        return {
            status: 'completed',
            stats: {
                characters: this.knowledgeBase.characters.size,
                timelineEvents: this.knowledgeBase.timeline.length,
                worldRules: this.knowledgeBase.worldRules.size
            }
        };
    }

    async performComprehensiveCheck(data) {
        const results = {
            consistency: await this.checkConsistency(data, {}),
            timeline: await this.verifyTimeline(data, {}),
            contradictions: await this.detectContradictions(data, {}),
            language: await this.checkLanguageIssues(data),
            formatting: await this.checkFormatting(data)
        };
        
        return {
            status: 'completed',
            results: results,
            overall: this.generateOverallAssessment(results),
            readyForPublication: this.assessPublicationReadiness(results)
        };
    }

    async checkLanguageIssues(data) {
        return {
            grammar: { errors: 3, warnings: 7 },
            spelling: { errors: 1, warnings: 0 },
            style: { issues: 5, suggestions: 12 }
        };
    }

    async checkFormatting(data) {
        return {
            consistent: true,
            issues: ['Inconsistent chapter heading format'],
            score: 0.95
        };
    }

    generateOverallAssessment(results) {
        const issues = results.contradictions.total + 
                      results.consistency.report.overall.issues.length +
                      results.timeline.issues.length;
        
        if (issues === 0) return 'Excellent - Ready for publication';
        if (issues < 5) return 'Good - Minor corrections needed';
        if (issues < 15) return 'Fair - Revision recommended';
        return 'Poor - Significant revision required';
    }

    assessPublicationReadiness(results) {
        return results.contradictions.total === 0 && 
               results.consistency.report.overall.criticalIssues.length === 0;
    }

    async updateContinuity(data) {
        // Update continuity tracking
        return {
            status: 'updated',
            newElements: data.elements,
            conflicts: this.checkNewElementsForConflicts(data.elements)
        };
    }

    checkNewElementsForConflicts(elements) {
        return []; // No conflicts with new elements
    }

    async generateProofreadingReport(data) {
        return {
            status: 'completed',
            report: {
                title: 'Comprehensive Proofreading Report',
                date: new Date().toISOString(),
                summary: 'Document has been thoroughly checked for consistency and accuracy',
                sections: {
                    consistency: 'See detailed consistency report',
                    timeline: 'Timeline verified with minor issues',
                    contradictions: '3 contradictions found and documented',
                    recommendations: 'Address high-priority issues before publication'
                }
            }
        };
    }

    async performFinalProof(data, context) {
        // Final comprehensive check
        const finalCheck = {
            ready: false,
            blockers: [],
            warnings: [],
            suggestions: []
        };
        
        // Check for blockers
        const consistency = await this.checkConsistency(data, context);
        if (consistency.report.overall.criticalIssues.length > 0) {
            finalCheck.blockers.push('Critical consistency issues must be resolved');
        }
        
        // Check for warnings
        if (consistency.report.overall.issues.length > 5) {
            finalCheck.warnings.push('Multiple minor consistency issues present');
        }
        
        // Generate suggestions
        finalCheck.suggestions = [
            'Consider final read-through for flow',
            'Verify all proper nouns are consistently spelled',
            'Check chapter transitions'
        ];
        
        finalCheck.ready = finalCheck.blockers.length === 0;
        
        return {
            status: 'completed',
            finalCheck: finalCheck,
            recommendation: finalCheck.ready ? 'Approved for publication' : 'Revision required'
        };
    }

    async factCheck(data, context) {
        return {
            status: 'completed',
            facts: [
                { statement: 'Archive founded in 2045', verified: true },
                { statement: '500km distance between cities', verified: false, correct: '350km' }
            ],
            accuracy: 0.85
        };
    }
}

module.exports = ProofreaderAgent;