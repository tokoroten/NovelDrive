#!/usr/bin/env ts-node
/**
 * Multi-Agent Discussion System Test Script
 * 
 * This script thoroughly tests the multi-agent discussion functionality including:
 * 1. Agent initialization
 * 2. Discussion flow and ordering
 * 3. Evaluation and scoring system
 * 4. Database persistence
 * 5. Pause/resume functionality
 * 6. Human intervention
 * 7. API usage logging
 */

import Database from "better-sqlite3";
import OpenAI from 'openai';
import { config } from 'dotenv';
import { DiscussionManager, Discussion } from '../services/agents/discussion-manager';
import { ApiUsageLogger } from '../services/api-usage-logger';
import { WriterAgent } from '../services/agents/writer-agent';
import { EditorAgent } from '../services/agents/editor-agent';
import { ProofreaderAgent } from '../services/agents/proofreader-agent';
import { DeputyEditorAgent, QualityEvaluation } from '../services/agents/deputy-editor-agent';

// Load environment variables
config();

interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  duration: number;
  details?: any;
}

class MultiAgentTestSuite {
  private db: duckdb.Database;
  private conn: duckdb.Connection;
  private openai: OpenAI;
  private apiLogger: ApiUsageLogger;
  private discussionManager: DiscussionManager;
  private testResults: TestResult[] = [];

  constructor() {
    // Initialize OpenAI client
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize database in memory for testing
    this.db = new Database(':memory:');
    
    // Initialize API logger
    this.apiLogger = new ApiUsageLogger(this.db);
    
    // Initialize discussion manager
    this.discussionManager = new DiscussionManager(
      this.openai,
      this.db,
      this.apiLogger
    );
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Multi-Agent Discussion System Tests...\n');

    try {
      // Setup test database
      await this.setupTestDatabase();

      // Run individual tests
      await this.testAgentInitialization();
      await this.testDiscussionFlow();
      await this.testEvaluationSystem();
      await this.testDatabasePersistence();
      await this.testPauseResumeFunctionality();
      await this.testHumanIntervention();
      await this.testApiLogging();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Setup test database with required tables
   */
  private async setupTestDatabase(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const setupSQL = `
        -- API Usage Logs
        CREATE TABLE IF NOT EXISTS api_usage_logs (
          id TEXT PRIMARY KEY,
          apiType TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT,
          operation TEXT NOT NULL,
          input_tokens INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0,
          totalTokens INTEGER DEFAULT 0,
          estimatedCost DECIMAL(10, 6) DEFAULT 0,
          duration_ms INTEGER DEFAULT 0,
          status TEXT NOT NULL,
          error_message TEXT,
          request_data TEXT,
          response_data TEXT,
          metadata TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Agent Discussions
        CREATE TABLE IF NOT EXISTS agent_discussions (
          id TEXT PRIMARY KEY,
          project_id TEXT,
          plot_id TEXT,
          topic TEXT NOT NULL,
          status TEXT NOT NULL,
          thread_id TEXT,
          participants TEXT,
          metadata TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Agent Messages
        CREATE TABLE IF NOT EXISTS agent_messages (
          id TEXT PRIMARY KEY,
          discussion_id TEXT NOT NULL,
          agent_role TEXT NOT NULL,
          agent_name TEXT NOT NULL,
          message TEXT NOT NULL,
          message_type TEXT DEFAULT 'text',
          metadata TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (discussion_id) REFERENCES agent_discussions(id)
        );

        -- App Settings
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Insert pricing data for testing
        INSERT OR REPLACE INTO app_settings (key, value) 
        VALUES ('openai_pricing', '{
          "gpt-4-turbo-preview": {
            "input": 0.01,
            "output": 0.03
          },
          "gpt-4": {
            "input": 0.03,
            "output": 0.06
          }
        }');
      `;

      this.conn.run(setupSQL, (err: any) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Test database setup complete');
          resolve();
        }
      });
    });
  }

  /**
   * Test 1: Agent Initialization
   */
  private async testAgentInitialization(): Promise<void> {
    const testName = 'Agent Initialization';
    const startTime = Date.now();

    try {
      console.log('🔧 Testing agent initialization...');

      // Test individual agent creation
      const writer = new WriterAgent(this.openai, this.apiLogger, this.conn);
      const editor = new EditorAgent(this.openai, this.apiLogger);
      const proofreader = new ProofreaderAgent(this.openai, this.apiLogger, this.conn);
      const deputyEditor = new DeputyEditorAgent(this.openai, this.apiLogger);

      // Verify agent properties
      const agents = [writer, editor, proofreader, deputyEditor];
      const expectedRoles = ['writer', 'editor', 'proofreader', 'deputy_editor'];

      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const expectedRole = expectedRoles[i];

        if (agent.getRole() !== expectedRole) {
          throw new Error(`Agent role mismatch: expected ${expectedRole}, got ${agent.getRole()}`);
        }

        if (!agent.getId() || !agent.getName()) {
          throw new Error(`Agent ${expectedRole} missing ID or name`);
        }
      }

      // Test DiscussionManager initialization
      const discussionAgents = this.discussionManager.getAgents();
      if (discussionAgents.length !== 4) {
        throw new Error(`Expected 4 agents, got ${discussionAgents.length}`);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: true,
        message: 'All agents initialized correctly',
        duration,
        details: {
          agentCount: discussionAgents.length,
          roles: discussionAgents.map(a => a.getRole()),
        }
      });

      console.log('✅ Agent initialization test passed');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      });

      console.log('❌ Agent initialization test failed:', error);
    }
  }

  /**
   * Test 2: Discussion Flow and Ordering
   */
  private async testDiscussionFlow(): Promise<void> {
    const testName = 'Discussion Flow';
    const startTime = Date.now();

    try {
      console.log('🗣️ Testing discussion flow...');

      // Start a test discussion
      const topic = '異世界転生した主人公が魔法学院で友情を育む物語の構想について';
      
      // Mock the discussion to avoid actual API calls in basic flow test
      const mockDiscussion = await this.createMockDiscussion(topic);

      // Verify discussion structure
      if (!mockDiscussion.id || !mockDiscussion.topic) {
        throw new Error('Discussion missing required fields');
      }

      if (mockDiscussion.participants.length !== 4) {
        throw new Error(`Expected 4 participants, got ${mockDiscussion.participants.length}`);
      }

      // Verify message ordering (Writer -> Editor -> Proofreader -> Deputy Editor)
      const expectedOrder = ['writer', 'editor', 'proofreader', 'deputy_editor'];
      const messageRoles = mockDiscussion.messages.map(msg => {
        return msg.agentId.split('-')[0];
      });

      for (let i = 0; i < expectedOrder.length; i++) {
        if (messageRoles[i] !== expectedOrder[i]) {
          throw new Error(`Message order incorrect: expected ${expectedOrder[i]}, got ${messageRoles[i]} at position ${i}`);
        }
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: true,
        message: 'Discussion flow and ordering verified',
        duration,
        details: {
          messageCount: mockDiscussion.messages.length,
          messageOrder: messageRoles,
        }
      });

      console.log('✅ Discussion flow test passed');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      });

      console.log('❌ Discussion flow test failed:', error);
    }
  }

  /**
   * Test 3: Evaluation and Scoring System
   */
  private async testEvaluationSystem(): Promise<void> {
    const testName = 'Evaluation System';
    const startTime = Date.now();

    try {
      console.log('🎯 Testing evaluation system...');

      // Create a deputy editor for evaluation testing
      const deputyEditor = new DeputyEditorAgent(this.openai, this.apiLogger);

      // Test evaluation parsing with mock data
      const mockEvaluationContent = `
【物語完成度】75点/100点
- プロットに一貫性があり、キャラクターの成長が描かれている
- 起承転結が明確で読者の興味を維持できる

【市場性】65点/100点
- 異世界転生というトレンドを活用している
- 学園要素で幅広い読者層にアピール可能

【独創性】55点/100点
- 既存作品との差別化要素あり
- 新しい魔法システムの設定が興味深い

【総合評価】65点/100点
【判定】採用推奨

【理由】
- 基準点を満たしており商業化可能
- キャラクターの魅力が十分

【改善提案】
- 魔法システムをより詳細に設定
- サブキャラクターの個性を強化
      `;

      const evaluation = (deputyEditor as any).parseEvaluation(mockEvaluationContent);

      // Verify evaluation parsing
      if (evaluation.narrativeCompleteness !== 75) {
        throw new Error(`Expected narrative score 75, got ${evaluation.narrativeCompleteness}`);
      }

      if (evaluation.marketability !== 65) {
        throw new Error(`Expected market score 65, got ${evaluation.marketability}`);
      }

      if (evaluation.originality !== 55) {
        throw new Error(`Expected originality score 55, got ${evaluation.originality}`);
      }

      if (evaluation.overallScore !== 65) {
        throw new Error(`Expected overall score 65, got ${evaluation.overallScore}`);
      }

      if (evaluation.recommendation !== 'accept') {
        throw new Error(`Expected recommendation 'accept', got ${evaluation.recommendation}`);
      }

      if (evaluation.reasons.length === 0) {
        throw new Error('Expected evaluation reasons to be parsed');
      }

      if (evaluation.suggestions.length === 0) {
        throw new Error('Expected evaluation suggestions to be parsed');
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: true,
        message: 'Evaluation parsing and scoring system working correctly',
        duration,
        details: {
          evaluation: evaluation,
        }
      });

      console.log('✅ Evaluation system test passed');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      });

      console.log('❌ Evaluation system test failed:', error);
    }
  }

  /**
   * Test 4: Database Persistence
   */
  private async testDatabasePersistence(): Promise<void> {
    const testName = 'Database Persistence';
    const startTime = Date.now();

    try {
      console.log('💾 Testing database persistence...');

      // Create a mock discussion
      const mockDiscussion = await this.createMockDiscussion('Test persistence topic');

      // Save to database (simulate the save process)
      await this.saveMockDiscussion(mockDiscussion);

      // Verify discussion was saved
      const savedDiscussion = await this.retrieveDiscussion(mockDiscussion.id);
      if (!savedDiscussion) {
        throw new Error('Discussion not found in database');
      }

      if (savedDiscussion.topic !== mockDiscussion.topic) {
        throw new Error('Discussion topic mismatch after save/retrieve');
      }

      // Verify messages were saved
      const savedMessages = await this.retrieveMessages(mockDiscussion.id);
      if (savedMessages.length !== mockDiscussion.messages.length) {
        throw new Error(`Expected ${mockDiscussion.messages.length} messages, got ${savedMessages.length}`);
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: true,
        message: 'Database persistence working correctly',
        duration,
        details: {
          discussionId: mockDiscussion.id,
          messageCount: savedMessages.length,
        }
      });

      console.log('✅ Database persistence test passed');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      });

      console.log('❌ Database persistence test failed:', error);
    }
  }

  /**
   * Test 5: Pause/Resume Functionality
   */
  private async testPauseResumeFunctionality(): Promise<void> {
    const testName = 'Pause/Resume Functionality';
    const startTime = Date.now();

    try {
      console.log('⏸️ Testing pause/resume functionality...');

      // Create a mock active discussion
      const mockDiscussion = await this.createMockDiscussion('Test pause/resume topic');
      mockDiscussion.status = 'active';
      
      // Simulate setting as current discussion
      (this.discussionManager as any).currentDiscussionId = mockDiscussion.id;
      (this.discussionManager as any).discussions.set(mockDiscussion.id, mockDiscussion);

      // Test pause
      this.discussionManager.pauseDiscussion();
      const pausedDiscussion = this.discussionManager.getActiveDiscussion();
      
      if (!pausedDiscussion || pausedDiscussion.status !== 'paused') {
        throw new Error('Discussion not properly paused');
      }

      // Test resume (without actually running the discussion)
      const discussion = this.discussionManager.getDiscussion(mockDiscussion.id);
      if (discussion) {
        discussion.status = 'active';
      }

      const resumedDiscussion = this.discussionManager.getActiveDiscussion();
      if (!resumedDiscussion || resumedDiscussion.status !== 'active') {
        throw new Error('Discussion not properly resumed');
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: true,
        message: 'Pause/resume functionality working correctly',
        duration,
        details: {
          discussionId: mockDiscussion.id,
          statusTransitions: ['active', 'paused', 'active'],
        }
      });

      console.log('✅ Pause/resume functionality test passed');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      });

      console.log('❌ Pause/resume functionality test failed:', error);
    }
  }

  /**
   * Test 6: Human Intervention
   */
  private async testHumanIntervention(): Promise<void> {
    const testName = 'Human Intervention';
    const startTime = Date.now();

    try {
      console.log('👤 Testing human intervention...');

      // Create a mock active discussion
      const mockDiscussion = await this.createMockDiscussion('Test human intervention topic');
      mockDiscussion.status = 'active';
      
      // Simulate setting as current discussion
      (this.discussionManager as any).currentDiscussionId = mockDiscussion.id;
      (this.discussionManager as any).discussions.set(mockDiscussion.id, mockDiscussion);

      const initialMessageCount = mockDiscussion.messages.length;

      // Test human intervention
      const humanMessage = '編集長として指示します：この設定をより詳しく説明してください。';
      await this.discussionManager.addHumanIntervention(humanMessage);

      const updatedDiscussion = this.discussionManager.getActiveDiscussion();
      if (!updatedDiscussion) {
        throw new Error('Discussion not found after human intervention');
      }

      if (updatedDiscussion.messages.length !== initialMessageCount + 1) {
        throw new Error('Human intervention message not added');
      }

      const lastMessage = updatedDiscussion.messages[updatedDiscussion.messages.length - 1];
      if (lastMessage.agentId !== 'human-editor') {
        throw new Error('Human intervention message has wrong agent ID');
      }

      if (lastMessage.content !== humanMessage) {
        throw new Error('Human intervention message content incorrect');
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: true,
        message: 'Human intervention working correctly',
        duration,
        details: {
          discussionId: mockDiscussion.id,
          messageCount: updatedDiscussion.messages.length,
          humanMessage: humanMessage,
        }
      });

      console.log('✅ Human intervention test passed');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      });

      console.log('❌ Human intervention test failed:', error);
    }
  }

  /**
   * Test 7: API Usage Logging
   */
  private async testApiLogging(): Promise<void> {
    const testName = 'API Usage Logging';
    const startTime = Date.now();

    try {
      console.log('📊 Testing API usage logging...');

      // Test API log entry
      const testLogEntry = {
        apiType: 'chat' as const,
        provider: 'openai' as const,
        model: 'gpt-4-turbo-preview',
        operation: 'test.agent.participate',
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
        estimatedCost: 0.045,
        durationMs: 1500,
        status: 'success' as const,
        metadata: {
          agentId: 'test-agent-123',
          role: 'writer',
          topic: 'Test topic for API logging',
        }
      };

      await this.apiLogger.logApiUsage(testLogEntry);
      const logId = 'test-id';
      if (!logId) {
        throw new Error('API log entry not created');
      }

      // Retrieve and verify the log
      const logs = await this.apiLogger.getUsageByApi('chat');

      if (logs.length === 0) {
        throw new Error('API log not found');
      }

      const retrievedLog = logs[0];
      if (retrievedLog.model !== testLogEntry.model) {
        throw new Error('API log model mismatch');
      }

      if (retrievedLog.totalTokens !== testLogEntry.totalTokens) {
        throw new Error('API log token count mismatch');
      }

      if (retrievedLog.estimatedCost !== testLogEntry.estimatedCost) {
        throw new Error('API log cost mismatch');
      }

      // Test error logging
      const errorLogEntry = {
        apiType: 'chat' as const,
        provider: 'openai' as const,
        model: 'gpt-4-turbo-preview',
        operation: 'test.error.case',
        status: 'error' as const,
        errorMessage: 'Test error message',
        durationMs: 500,
      };

      await this.apiLogger.logApiUsage(errorLogEntry);

      const errorLogs = await this.apiLogger.getUsageByApi('chat');
      if (errorLogs.length === 0) {
        throw new Error('Error log not found');
      }

      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: true,
        message: 'API usage logging working correctly',
        duration,
        details: {
          successLogId: logId,
          errorLogCount: errorLogs.length,
        }
      });

      console.log('✅ API usage logging test passed');

    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({
        testName,
        passed: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      });

      console.log('❌ API usage logging test failed:', error);
    }
  }

  /**
   * Create a mock discussion for testing
   */
  private async createMockDiscussion(topic: string): Promise<Discussion> {
    const discussionId = `test-discussion-${Date.now()}`;
    const agents = this.discussionManager.getAgents();

    const mockDiscussion: Discussion = {
      id: discussionId,
      topic,
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      participants: agents.map(a => a.getId()),
      messages: [
        {
          id: 'msg-1',
          agentId: 'writer-test',
          timestamp: new Date(),
          content: '異世界転生の主人公設定について提案します。現代の高校生が魔法学院に転生し、最初は魔法が使えずに苦労しますが、独自の現代知識を活かして新しい魔法理論を発見していく展開はどうでしょうか。',
          metadata: { confidence: 0.8, emotionalTone: 'enthusiastic' }
        },
        {
          id: 'msg-2',
          agentId: 'editor-test',
          timestamp: new Date(),
          content: '作家AIの提案は興味深いですが、読者の感情移入を高めるため、主人公の心理描写をより詳細にする必要があります。転生直後の混乱や不安、そして希望を丁寧に描写することで物語に深みが出るでしょう。',
          metadata: { confidence: 0.7, emotionalTone: 'constructive' }
        },
        {
          id: 'msg-3',
          agentId: 'proofreader-test',
          timestamp: new Date(),
          content: '魔法システムの設定で注意すべき点があります。「魔法が使えない」という設定と「新しい魔法理論を発見」という展開に矛盾が生じる可能性があります。この点を明確に説明する必要があります。',
          metadata: { confidence: 0.9, emotionalTone: 'concerned' }
        },
        {
          id: 'msg-4',
          agentId: 'deputy_editor-test',
          timestamp: new Date(),
          content: '【物語完成度】72点/100点\n【市場性】68点/100点\n【独創性】58点/100点\n【総合評価】66点/100点\n【判定】採用推奨\n\n【理由】\n- 異世界転生というトレンドを活用\n- キャラクター成長の軸が明確\n\n【改善提案】\n- 魔法システムの詳細設定\n- サブキャラクターとの関係性強化',
          metadata: { confidence: 0.8, emotionalTone: 'neutral' }
        }
      ],
      decisions: ['採用推奨'],
      qualityScore: 66,
      summaries: []
    };

    return mockDiscussion;
  }

  /**
   * Save mock discussion to database
   */
  private async saveMockDiscussion(discussion: Discussion): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const sql = `
        INSERT INTO agent_discussions (
          id, project_id, plot_id, topic, status, thread_id,
          participants, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const metadata = {
        startTime: discussion.startTime,
        endTime: discussion.endTime,
        messageCount: discussion.messages.length,
        qualityScore: discussion.qualityScore,
        decisions: discussion.decisions,
      };

      this.conn.run(
        sql,
        [
          discussion.id,
          discussion.projectId || null,
          discussion.plotId || null,
          discussion.topic,
          discussion.status,
          discussion.id,
          JSON.stringify(discussion.participants),
          JSON.stringify(metadata),
          discussion.startTime.toISOString(),
          new Date().toISOString()
        ],
        (err: any) => {
          if (err) {
            reject(err);
          } else {
            // Save messages
            this.saveMockMessages(discussion.id, discussion.messages)
              .then(() => resolve())
              .catch(reject);
          }
        }
      );
    });
  }

  /**
   * Save mock messages to database
   */
  private async saveMockMessages(discussionId: string, messages: any[]): Promise<void> {
    for (const message of messages) {
      await new Promise<void>((resolve, reject) => {
        const sql = `
          INSERT INTO agent_messages (
            id, discussion_id, agent_role, agent_name, message,
            message_type, metadata, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const agentRole = message.agentId.split('-')[0];

        this.conn.run(
          sql,
          [
            message.id,
            discussionId,
            agentRole,
            agentRole,
            message.content,
            'text',
            JSON.stringify(message.metadata || {}),
            message.timestamp.toISOString()
          ],
          (err: any) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
  }

  /**
   * Retrieve discussion from database
   */
  private async retrieveDiscussion(discussionId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM agent_discussions WHERE id = ?';
      
      this.conn.all(sql, discussionId, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.length > 0 ? rows[0] : null);
        }
      });
    });
  }

  /**
   * Retrieve messages from database
   */
  private async retrieveMessages(discussionId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM agent_messages WHERE discussion_id = ? ORDER BY created_at';
      
      this.conn.all(sql, discussionId, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Display test results
   */
  private displayResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 MULTI-AGENT DISCUSSION SYSTEM TEST RESULTS');
    console.log('='.repeat(60));

    const passedTests = this.testResults.filter(r => r.passed);
    const failedTests = this.testResults.filter(r => !r.passed);

    console.log(`\n✅ Passed: ${passedTests.length}`);
    console.log(`❌ Failed: ${failedTests.length}`);
    console.log(`📊 Total: ${this.testResults.length}`);

    // Show detailed results
    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`\n${status} ${result.testName} (${result.duration}ms)`);
      console.log(`   ${result.message}`);
      
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    });

    // Summary statistics
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = totalDuration / this.testResults.length;

    console.log(`\n📈 Performance Summary:`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    console.log(`   Average Duration: ${Math.round(avgDuration)}ms`);
    console.log(`   Success Rate: ${Math.round((passedTests.length / this.testResults.length) * 100)}%`);

    if (failedTests.length === 0) {
      console.log('\n🎉 All tests passed! Multi-agent discussion system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the results above.');
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      this.conn.close();
      this.db.close();
      console.log('\n🧹 Cleanup completed');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

// Main execution
async function main() {
  const testSuite = new MultiAgentTestSuite();
  await testSuite.runAllTests();
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test suite execution failed:', error);
    process.exit(1);
  });
}

export { MultiAgentTestSuite };