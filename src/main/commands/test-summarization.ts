/**
 * Test command for message summarization functionality
 */

import { DiscussionManager } from '../services/agents/discussion-manager';
import { ApiUsageLogger } from '../services/api-usage-logger';
import { DatabaseMigration } from '../services/database-migration';
import OpenAI from 'openai';
import Database from "better-sqlite3";
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function createTestDatabase() {
  const db = new Database(':memory:');
  
  // Create minimal required tables for testing
  db.exec(`
      CREATE TABLE IF NOT EXISTS agent_discussions (
        id VARCHAR PRIMARY KEY,
        project_id VARCHAR,
        plot_id VARCHAR,
        topic VARCHAR NOT NULL,
        status VARCHAR NOT NULL,
        thread_id VARCHAR,
        participants TEXT,
        metadata TEXT,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);
  
  db.exec(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id VARCHAR PRIMARY KEY,
        discussion_id VARCHAR NOT NULL,
        agent_role VARCHAR NOT NULL,
        agent_name VARCHAR,
        message TEXT NOT NULL,
        message_type VARCHAR DEFAULT 'text',
        metadata TEXT,
        created_at TIMESTAMP
      )
    `);
  
  db.exec(`
      CREATE TABLE IF NOT EXISTS api_usage_logs (
        id VARCHAR PRIMARY KEY,
        timestamp TIMESTAMP,
        apiType VARCHAR,
        model VARCHAR,
        endpoint VARCHAR,
        tokens_input INTEGER,
        tokens_output INTEGER,
        tokens_total INTEGER,
        cost_usd DECIMAL(10, 6),
        success BOOLEAN,
        error_message TEXT
      )
    `);
  
  return db;
}

async function testSummarization() {
  console.log('🧪 Testing Message Summarization System...\n');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    process.exit(1);
  }

  // Initialize services
  const db = await createTestDatabase();
  const apiLogger = new ApiUsageLogger(db);
  const openai = new OpenAI({ apiKey });
  const discussionManager = new DiscussionManager(openai, db, apiLogger);

  // Set up event listeners for monitoring
  discussionManager.on('discussionStarted', (data) => {
    console.log(`📢 Discussion started: ${data.topic}`);
  });

  discussionManager.on('agentSpoke', (data) => {
    console.log(`\n💬 [${data.role}] spoke (Round ${data.round}):`);
    console.log(data.message.content.substring(0, 200) + '...');
  });

  discussionManager.on('summarizationStarted', (data) => {
    console.log('\n🔄 Summarization started...');
  });

  discussionManager.on('summarizationCompleted', (data) => {
    console.log(`✅ Summarization completed:`);
    console.log(`   - Summarized: ${data.summarizedCount} messages`);
    console.log(`   - Preserved: ${data.preservedCount} messages`);
    console.log(`   - Summary tokens: ${data.summaryTokens}`);
  });

  discussionManager.on('discussionCompleted', (data) => {
    console.log(`\n🎉 Discussion completed!`);
    console.log(`   - Quality score: ${data.qualityScore}`);
    console.log(`   - Decisions: ${data.decisions.length}`);
  });

  // Test topic that will generate substantial discussion
  const topic = '魔法と科学が共存する現代日本を舞台にした、高校生が主人公の冒険小説のプロット';

  try {
    // Start discussion with summarization enabled
    console.log(`\n🚀 Starting discussion on: "${topic}"\n`);
    
    const discussionId = await discussionManager.startDiscussion(
      topic,
      {
        initialKnowledge: `
        ジャンル: 現代ファンタジー、冒険小説
        ターゲット: ヤングアダルト層
        テーマ: 科学と魔法の融合、成長、友情、社会の二面性
        `,
      },
      {
        maxRounds: 8, // More rounds to trigger summarization
        enableSummarization: true,
        summarizationConfig: {
          summarizationThreshold: 50, // Trigger at 50% capacity for testing
          minMessagesToSummarize: 4,
          preserveRecentMessages: 2,
        },
        autoStop: true,
        saveToDatabase: true,
      }
    );

    // Get final discussion data
    const discussion = discussionManager.getDiscussion(discussionId);
    if (discussion) {
      console.log(`\n📊 Final Statistics:`);
      console.log(`   - Total messages: ${discussion.messages.length}`);
      console.log(`   - Total summaries: ${discussion.summaries.length}`);
      console.log(`   - Final status: ${discussion.status}`);
      
      // Show token usage
      const tokenStats = discussionManager.getTokenUsageStats();
      if (tokenStats) {
        console.log(`\n🔢 Token Usage:`);
        console.log(`   - Current tokens: ${tokenStats.currentTokens}`);
        console.log(`   - Max tokens: ${tokenStats.maxTokens}`);
        console.log(`   - Usage: ${tokenStats.usagePercentage.toFixed(1)}%`);
      }

      // Show summaries
      if (discussion.summaries.length > 0) {
        console.log(`\n📝 Summaries Generated:`);
        discussion.summaries.forEach((summary, index) => {
          console.log(`\n   Summary ${index + 1}:`);
          console.log(`   - Original messages: ${summary.originalMessageIds.length}`);
          console.log(`   - Key decisions: ${summary.keyDecisions.join(', ')}`);
          console.log(`   - Summary: ${summary.summary.substring(0, 200)}...`);
        });
      }
    }

    // Get API usage stats
    const apiStats = await apiLogger.getUsageStats();
    const totalCost = await apiLogger.getTotalCost();
    
    console.log(`\n💰 API Usage:`);
    console.log(`   - Total API calls: ${apiStats.length}`);
    console.log(`   - Estimated cost: $${totalCost.toFixed(4)}`);

  } catch (error) {
    console.error('❌ Error during test:', error);
  } finally {
    db.close();
  }
}

// Run the test
if (require.main === module) {
  testSummarization().catch(console.error);
}