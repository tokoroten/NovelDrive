import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as duckdb from 'duckdb';
import { 
  AutonomousConfig, 
  AutonomousOperation, 
  AutonomousStatus, 
  AutonomousLog,
  AutonomousContentType,
  AutonomousOperationResult,
  OperationMetrics,
  SystemHealth,
  TimeSlot
} from '../../shared/types';
import { MultiAgentOrchestrator } from './multi-agent-system';
import { QualityFilterService } from './quality-filter-service';
import { ResourceMonitor } from './resource-monitor';
import { AutonomousLogger } from './autonomous-logger';

export class AutonomousModeService extends EventEmitter {
  private config: AutonomousConfig;
  private isRunning = false;
  private currentOperation: AutonomousOperation | null = null;
  private operationQueue: AutonomousOperation[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private dailyOperationCount = 0;
  private lastOperationTime: Date | null = null;
  private totalOperations = 0;
  private successfulOperations = 0;
  
  private conn: duckdb.Connection;
  private orchestrator: MultiAgentOrchestrator;
  private qualityFilter: QualityFilterService;
  private resourceMonitor: ResourceMonitor;
  private logger: AutonomousLogger;

  constructor(conn: duckdb.Connection, orchestrator: MultiAgentOrchestrator) {
    super();
    this.conn = conn;
    this.orchestrator = orchestrator;
    this.qualityFilter = new QualityFilterService(conn);
    this.resourceMonitor = new ResourceMonitor();
    this.logger = new AutonomousLogger(conn);
    
    // Default configuration
    this.config = {
      enabled: false,
      interval: 30, // 30 minutes
      qualityThreshold: 65, // 65% minimum quality
      maxConcurrentOperations: 1,
      maxDailyOperations: 48, // 48 operations per day max
      timeSlots: [
        { start: '09:00', end: '18:00', enabled: true }, // daytime
        { start: '22:00', end: '06:00', enabled: false } // night time disabled by default
      ],
      resourceLimits: {
        maxCpuUsage: 70, // 70% max CPU
        maxMemoryUsage: 2048, // 2GB max memory
        maxApiCallsPerHour: 100,
        maxTokensPerOperation: 4000
      },
      contentTypes: ['plot', 'character', 'worldSetting', 'inspiration']
    };

    // Reset daily counter at midnight
    this.scheduleDaily(() => {
      this.dailyOperationCount = 0;
      this.logger.log('info', 'system', 'Daily operation counter reset');
    });
  }

  async initialize(): Promise<void> {
    await this.logger.initialize();
    await this.qualityFilter.initialize();
    await this.resourceMonitor.initialize();
    
    // Load configuration from database
    await this.loadConfiguration();
    
    this.logger.log('info', 'system', 'Autonomous mode service initialized');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.log('warn', 'system', 'Autonomous mode already running');
      return;
    }

    if (!this.config.enabled) {
      this.logger.log('info', 'system', 'Autonomous mode is disabled');
      return;
    }

    this.isRunning = true;
    
    // Start the main operation loop
    this.intervalId = setInterval(async () => {
      await this.processOperationCycle();
    }, this.config.interval * 60 * 1000); // Convert minutes to milliseconds

    this.logger.log('info', 'system', `Autonomous mode started with ${this.config.interval} minute intervals`);
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Cancel current operation if running
    if (this.currentOperation && this.currentOperation.status === 'running') {
      this.currentOperation.status = 'cancelled';
      this.currentOperation.endTime = new Date();
      await this.saveOperation(this.currentOperation);
    }

    // Clear queue
    this.operationQueue = [];
    this.currentOperation = null;

    this.logger.log('info', 'system', 'Autonomous mode stopped');
    this.emit('stopped');
  }

  private async processOperationCycle(): Promise<void> {
    try {
      // Check if we should run at this time
      if (!this.isWithinTimeSlot()) {
        return;
      }

      // Check system health
      const systemHealth = await this.resourceMonitor.getLastHealth();
      if (!systemHealth.healthy) {
        this.logger.log('warn', 'system', 'System health check failed, skipping operation', undefined, { health: systemHealth });
        return;
      }

      // Check daily limits
      if (this.dailyOperationCount >= this.config.maxDailyOperations) {
        this.logger.log('info', 'system', 'Daily operation limit reached');
        return;
      }

      // Check if we have capacity for new operations
      if (this.currentOperation) {
        return; // Already running an operation
      }

      // Generate new operation or process queue
      const operation = this.operationQueue.shift() || await this.generateOperation();
      if (!operation) {
        return;
      }

      await this.executeOperation(operation);
      
    } catch (error) {
      this.logger.log('error', 'system', 'Error in operation cycle', undefined, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private async generateOperation(): Promise<AutonomousOperation | null> {
    // Randomly select content type based on configuration
    const contentTypes = this.config.contentTypes;
    if (contentTypes.length === 0) {
      return null;
    }

    const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
    
    const operation: AutonomousOperation = {
      id: uuidv4(),
      type: contentType,
      status: 'pending',
      startTime: new Date(),
      metrics: {
        duration: 0,
        tokensUsed: 0,
        apiCalls: 0,
        cpuUsage: 0,
        memoryUsage: 0
      }
    };

    this.logger.log('info', 'operation', `Generated new ${contentType} operation`, operation.id);
    return operation;
  }

  private async executeOperation(operation: AutonomousOperation): Promise<void> {
    this.currentOperation = operation;
    operation.status = 'running';
    operation.startTime = new Date();

    const startTime = Date.now();
    const startMetrics = await this.resourceMonitor.getCurrentMetrics();

    try {
      this.logger.log('info', 'operation', `Starting ${operation.type} operation`, operation.id);

      let result: AutonomousOperationResult;

      switch (operation.type) {
        case 'plot':
          result = await this.generatePlot(operation);
          break;
        case 'character':
          result = await this.generateCharacter(operation);
          break;
        case 'worldSetting':
          result = await this.generateWorldSetting(operation);
          break;
        case 'inspiration':
          result = await this.generateInspiration(operation);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      // Calculate metrics
      const endTime = Date.now();
      const endMetrics = await this.resourceMonitor.getCurrentMetrics();
      
      operation.metrics = {
        duration: endTime - startTime,
        tokensUsed: result.content.tokensUsed || 0,
        apiCalls: result.content.apiCalls || 0,
        cpuUsage: Math.max(0, endMetrics.cpuUsage - startMetrics.cpuUsage),
        memoryUsage: Math.max(0, endMetrics.memoryUsage - startMetrics.memoryUsage)
      };

      // Quality assessment
      const qualityAssessment = await this.qualityFilter.assessQuality(result.content, operation.type);
      result.qualityScore = qualityAssessment.overallScore;
      result.saved = qualityAssessment.recommendation === 'save' && qualityAssessment.overallScore >= this.config.qualityThreshold;

      if (result.saved) {
        await this.saveGeneratedContent(result.content, operation.type);
        this.successfulOperations++;
        this.logger.log('info', 'operation', `High quality ${operation.type} saved`, operation.id, {
          qualityScore: result.qualityScore,
          threshold: this.config.qualityThreshold
        });
      } else {
        this.logger.log('info', 'operation', `${operation.type} discarded due to low quality`, operation.id, {
          qualityScore: result.qualityScore,
          threshold: this.config.qualityThreshold,
          recommendation: qualityAssessment.recommendation
        });
      }

      operation.result = result;
      operation.status = 'completed';
      operation.endTime = new Date();

      this.dailyOperationCount++;
      this.totalOperations++;
      this.lastOperationTime = new Date();

      this.emit('operationCompleted', operation);

    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : String(error);
      operation.endTime = new Date();
      
      this.logger.log('error', 'operation', `Operation failed: ${error instanceof Error ? error.message : String(error)}`, operation.id);
      this.emit('operationFailed', operation);
      
    } finally {
      await this.saveOperation(operation);
      this.currentOperation = null;
    }
  }

  private async generatePlot(operation: AutonomousOperation): Promise<AutonomousOperationResult> {
    // Use serendipity search to find inspiration
    const inspirationResults = await this.findInspiration('plot');
    const theme = this.extractTheme(inspirationResults);
    
    // Create agents for plot generation
    const writerAgent = await this.orchestrator.createAgent('writer', 'experimental');
    const editorAgent = await this.orchestrator.createAgent('editor', 'logical');
    
    // Generate plot through agent discussion
    const session = await this.orchestrator.startDiscussion(
      `新しいプロットを作成してください。テーマ: ${theme}`,
      [writerAgent, editorAgent],
      { maxRounds: 3 }
    );

    const plotContent = this.extractPlotFromSession(session);
    
    return {
      contentId: uuidv4(),
      qualityScore: 0, // Will be assessed later
      confidence: 0.8,
      saved: false,
      content: {
        type: 'plot',
        theme,
        plotContent,
        session: session.summary,
        tokensUsed: this.calculateTokensUsed(session),
        apiCalls: session.messages.length
      }
    };
  }

  private async generateCharacter(operation: AutonomousOperation): Promise<AutonomousOperationResult> {
    const inspirationResults = await this.findInspiration('character');
    const characterTrait = this.extractCharacterTrait(inspirationResults);
    
    const writerAgent = await this.orchestrator.createAgent('writer', 'emotional');
    
    const session = await this.orchestrator.startDiscussion(
      `${characterTrait}という特徴を持つ魅力的なキャラクターを作成してください。`,
      [writerAgent],
      { maxRounds: 2 }
    );

    const characterContent = this.extractCharacterFromSession(session);
    
    return {
      contentId: uuidv4(),
      qualityScore: 0,
      confidence: 0.7,
      saved: false,
      content: {
        type: 'character',
        trait: characterTrait,
        characterContent,
        session: session.summary,
        tokensUsed: this.calculateTokensUsed(session),
        apiCalls: session.messages.length
      }
    };
  }

  private async generateWorldSetting(operation: AutonomousOperation): Promise<AutonomousOperationResult> {
    const inspirationResults = await this.findInspiration('worldSetting');
    const worldConcept = this.extractWorldConcept(inspirationResults);
    
    const writerAgent = await this.orchestrator.createAgent('writer', 'logical');
    
    const session = await this.orchestrator.startDiscussion(
      `${worldConcept}をベースにした世界設定を作成してください。`,
      [writerAgent],
      { maxRounds: 2 }
    );

    const worldContent = this.extractWorldFromSession(session);
    
    return {
      contentId: uuidv4(),
      qualityScore: 0,
      confidence: 0.6,
      saved: false,
      content: {
        type: 'worldSetting',
        concept: worldConcept,
        worldContent,
        session: session.summary,
        tokensUsed: this.calculateTokensUsed(session),
        apiCalls: session.messages.length
      }
    };
  }

  private async generateInspiration(operation: AutonomousOperation): Promise<AutonomousOperationResult> {
    const inspirationResults = await this.findInspiration('inspiration');
    const combinedInspiration = this.combineInspirations(inspirationResults);
    
    return {
      contentId: uuidv4(),
      qualityScore: 0,
      confidence: 0.5,
      saved: false,
      content: {
        type: 'inspiration',
        inspiration: combinedInspiration,
        sources: inspirationResults.map(r => r.id),
        tokensUsed: 0,
        apiCalls: 0
      }
    };
  }

  private async findInspiration(type: AutonomousContentType): Promise<any[]> {
    // Use serendipity search to find related content
    // This is a simplified implementation
    return [];
  }

  private extractTheme(inspirationResults: any[]): string {
    // Extract theme from inspiration results
    return inspirationResults.length > 0 ? "創造的な発見" : "未知の冒険";
  }

  private extractCharacterTrait(inspirationResults: any[]): string {
    const traits = ["神秘的", "知的", "勇敢", "繊細", "情熱的"];
    return traits[Math.floor(Math.random() * traits.length)];
  }

  private extractWorldConcept(inspirationResults: any[]): string {
    const concepts = ["魔法と科学が共存する世界", "未来都市", "古代文明", "異世界", "並行世界"];
    return concepts[Math.floor(Math.random() * concepts.length)];
  }

  private combineInspirations(inspirationResults: any[]): string {
    return "セレンディピティによる新しい発見";
  }

  private extractPlotFromSession(session: any): string {
    return session.summary || "自動生成されたプロット";
  }

  private extractCharacterFromSession(session: any): string {
    return session.summary || "自動生成されたキャラクター";
  }

  private extractWorldFromSession(session: any): string {
    return session.summary || "自動生成された世界設定";
  }

  private calculateTokensUsed(session: any): number {
    return session.messages.reduce((total: number, msg: any) => {
      return total + (msg.content.length / 4); // Rough estimate
    }, 0);
  }

  private async saveGeneratedContent(content: any, type: AutonomousContentType): Promise<void> {
    // Save content to appropriate table based on type
    const sql = `INSERT INTO autonomous_content (id, type, content, created_at) VALUES (?, ?, ?, ?)`;
    
    return new Promise((resolve, reject) => {
      this.conn.run(sql, [
        content.contentId || uuidv4(),
        type,
        JSON.stringify(content),
        new Date()
      ], (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private isWithinTimeSlot(): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    return this.config.timeSlots.some(slot => {
      if (!slot.enabled) return false;
      
      const start = slot.start;
      const end = slot.end;
      
      // Handle overnight time slots (e.g., 22:00 to 06:00)
      if (start > end) {
        return currentTime >= start || currentTime <= end;
      } else {
        return currentTime >= start && currentTime <= end;
      }
    });
  }

  private scheduleDaily(callback: () => void): void {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      callback();
      // Schedule for next day
      setInterval(callback, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  private async saveOperation(operation: AutonomousOperation): Promise<void> {
    const sql = `
      INSERT INTO autonomous_operations 
      (id, type, status, project_id, start_time, end_time, result, error, metrics, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      this.conn.run(sql, [
        operation.id,
        operation.type,
        operation.status,
        operation.projectId || null,
        operation.startTime,
        operation.endTime || null,
        JSON.stringify(operation.result),
        operation.error || null,
        JSON.stringify(operation.metrics),
        new Date()
      ], (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async loadConfiguration(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT config FROM autonomous_config ORDER BY created_at DESC LIMIT 1`;
      
      this.conn.all(sql, [], (err: Error | null, row: any) => {
        if (err) {
          reject(err);
        } else if (row) {
          this.config = { ...this.config, ...JSON.parse(row.config) };
          resolve();
        } else {
          resolve(); // Use default config
        }
      });
    });
  }

  // Public API methods
  async updateConfiguration(newConfig: Partial<AutonomousConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Save to database
    const sql = `INSERT INTO autonomous_config (config, created_at) VALUES (?, ?)`;
    
    return new Promise((resolve, reject) => {
      this.conn.run(sql, [
        JSON.stringify(this.config),
        new Date()
      ], (err: Error | null) => {
        if (err) reject(err);
        else {
          this.logger.log('info', 'system', 'Configuration updated');
          resolve();
        }
      });
    });
  }

  getConfiguration(): AutonomousConfig {
    return { ...this.config };
  }

  getStatus(): AutonomousStatus {
    return {
      enabled: this.config.enabled,
      currentOperation: this.currentOperation || undefined,
      queueLength: this.operationQueue.length,
      lastOperationTime: this.lastOperationTime || undefined,
      todayCount: this.dailyOperationCount,
      totalOperations: this.totalOperations,
      successRate: this.totalOperations > 0 ? (this.successfulOperations / this.totalOperations) * 100 : 0,
      systemHealth: this.resourceMonitor.getLastHealth()
    };
  }

  async getLogs(options: {
    limit?: number;
    level?: 'info' | 'warn' | 'error' | 'debug';
    category?: 'operation' | 'quality' | 'resource' | 'system';
    operationId?: string;
    since?: Date;
  } = {}): Promise<AutonomousLog[]> {
    return this.logger.getRecentLogs(
      options.limit || 100,
      options.level,
      options.category,
      options.operationId
    );
  }

  async queueOperation(type: AutonomousContentType, projectId?: string): Promise<string> {
    const operation: AutonomousOperation = {
      id: uuidv4(),
      type,
      status: 'pending',
      projectId,
      startTime: new Date(),
      metrics: {
        duration: 0,
        tokensUsed: 0,
        apiCalls: 0,
        cpuUsage: 0,
        memoryUsage: 0
      }
    };

    this.operationQueue.push(operation);
    this.logger.log('info', 'operation', `Queued ${type} operation`, operation.id);
    
    return operation.id;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    await this.orchestrator.cleanup();
  }
}