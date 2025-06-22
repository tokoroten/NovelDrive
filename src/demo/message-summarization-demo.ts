import { encode } from 'gpt-tokenizer';

// Mock types for demonstration
interface Message {
  role: 'system' | 'assistant' | 'user';
  content: string;
  timestamp: Date;
  isSummary?: boolean;
  originalMessageCount?: number;
}

interface AgentMessage extends Message {
  agentName: string;
}

// Configuration
const TOKEN_LIMIT = 8000; // Lowered for demo purposes
const SUMMARY_TRIGGER_THRESHOLD = 0.7; // Trigger at 70% of limit
const MIN_MESSAGES_BEFORE_SUMMARY = 10;

// Mock OpenAI API response generator
function mockOpenAIResponse(prompt: string): string {
  // Simulate different types of responses based on the prompt
  if (prompt.includes('summarize')) {
    return `[Summary of ${prompt.match(/\d+/)?.[0] || 'multiple'} messages]: The agents discussed plot elements including character development, world-building details, and narrative structure. Key decisions were made about the protagonist's motivation and the story's central conflict.`;
  }
  
  const responses = [
    "I think we should develop the character's backstory more. Perhaps they had a traumatic experience that shapes their current worldview.",
    "That's an interesting point. We could also explore how their relationships with other characters reflect this inner conflict.",
    "I agree, but we need to ensure the pacing doesn't suffer. Maybe we can reveal this through flashbacks?",
    "What if we use environmental storytelling instead? Show their past through objects and settings.",
    "That could work well. We should also consider how this affects the overall narrative arc.",
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

// Token counting utility
function countTokens(messages: Message[]): number {
  const totalContent = messages.map(m => m.content).join(' ');
  return encode(totalContent).length;
}

// Message summarization system
class MessageSummarizer {
  private messages: AgentMessage[] = [];
  private summaryCount = 0;
  
  constructor() {
    // Initialize with system message
    this.messages.push({
      role: 'system',
      content: 'You are part of a multi-agent novel writing system. Collaborate to create compelling stories.',
      timestamp: new Date(),
      agentName: 'System'
    });
  }
  
  // Add a new message
  async addMessage(agentName: string, content: string): Promise<void> {
    const message: AgentMessage = {
      role: 'assistant',
      content,
      timestamp: new Date(),
      agentName
    };
    
    this.messages.push(message);
    
    // Check if we need to summarize
    await this.checkAndSummarize();
  }
  
  // Check token count and summarize if needed
  private async checkAndSummarize(): Promise<void> {
    const currentTokens = countTokens(this.messages);
    const tokenThreshold = TOKEN_LIMIT * SUMMARY_TRIGGER_THRESHOLD;
    
    console.log(`\n📊 Token count: ${currentTokens}/${TOKEN_LIMIT} (${Math.round(currentTokens/TOKEN_LIMIT*100)}%)`);
    
    if (currentTokens > tokenThreshold && this.messages.length > MIN_MESSAGES_BEFORE_SUMMARY) {
      console.log('\n⚠️  Token threshold reached! Initiating summarization...');
      await this.summarizeOldMessages();
    }
  }
  
  // Summarize old messages
  private async summarizeOldMessages(): Promise<void> {
    // Keep system message and recent messages
    const systemMessage = this.messages[0];
    const recentMessageCount = Math.floor(this.messages.length * 0.3); // Keep 30% recent
    const messagesToSummarize = this.messages.slice(1, -recentMessageCount);
    const recentMessages = this.messages.slice(-recentMessageCount);
    
    if (messagesToSummarize.length === 0) return;
    
    console.log(`\n📝 Summarizing ${messagesToSummarize.length} messages...`);
    
    // Create summary (mocked)
    const summaryPrompt = `Please summarize these ${messagesToSummarize.length} messages from our novel writing discussion`;
    const summary = mockOpenAIResponse(summaryPrompt);
    
    const summaryMessage: AgentMessage = {
      role: 'assistant',
      content: summary,
      timestamp: new Date(),
      agentName: 'Summary',
      isSummary: true,
      originalMessageCount: messagesToSummarize.length
    };
    
    // Replace old messages with summary
    this.messages = [systemMessage, summaryMessage, ...recentMessages];
    this.summaryCount++;
    
    const newTokenCount = countTokens(this.messages);
    const currentTokenCount = countTokens(this.messages.filter(m => !m.isSummary));
    console.log(`✅ Summarization complete! New token count: ${newTokenCount} (${Math.round((currentTokenCount - newTokenCount)/currentTokenCount*100)}% reduction)`);
  }
  
  // Display current conversation state
  displayConversation(): void {
    console.log('\n=== Current Conversation State ===');
    console.log(`Total messages: ${this.messages.length}`);
    console.log(`Summaries created: ${this.summaryCount}`);
    console.log(`Current tokens: ${countTokens(this.messages)}/${TOKEN_LIMIT}\n`);
    
    this.messages.forEach((msg, index) => {
      if (msg.isSummary) {
        console.log(`\n🗂️  [${index}] SUMMARY (replacing ${msg.originalMessageCount} messages)`);
        console.log(`   ${msg.content}\n`);
      } else if (msg.role === 'system') {
        console.log(`\n⚙️  [${index}] SYSTEM`);
        console.log(`   ${msg.content}\n`);
      } else {
        console.log(`\n👤 [${index}] ${msg.agentName}:`);
        console.log(`   ${msg.content}`);
      }
    });
  }
  
  // Get message statistics
  getStats() {
    const originalMessageCount = this.messages.reduce((count, msg) => {
      return count + (msg.originalMessageCount || 1);
    }, 0) - 1; // Subtract system message
    
    return {
      currentMessageCount: this.messages.length,
      originalMessageCount,
      summaryCount: this.summaryCount,
      currentTokens: countTokens(this.messages),
      tokenLimit: TOKEN_LIMIT,
      compressionRatio: originalMessageCount / this.messages.length
    };
  }
}

// Demo simulation
async function runDemo() {
  console.log('🚀 Starting Message Summarization Demo\n');
  console.log('This demo simulates a long multi-agent discussion and shows how');
  console.log('the system automatically summarizes old messages to stay within token limits.\n');
  
  const summarizer = new MessageSummarizer();
  const agents = ['Writer AI', 'Editor AI', 'Deputy Editor AI', 'Proofreader AI'];
  
  // Simulate a long discussion
  for (let round = 0; round < 30; round++) {
    console.log(`\n--- Round ${round + 1} ---`);
    
    for (const agent of agents) {
      // Generate mock content with varying lengths
      const baseContent = mockOpenAIResponse('Discuss the novel plot');
      const extraContent = round > 15 
        ? ' Additionally, we should consider the implications for future chapters and how this connects to our overarching themes.'
        : '';
      
      await summarizer.addMessage(agent, baseContent + extraContent);
      
      // Small delay for readability in demo
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Show conversation state every 5 rounds
    if ((round + 1) % 5 === 0) {
      summarizer.displayConversation();
    }
  }
  
  // Final statistics
  console.log('\n\n=== Final Statistics ===');
  const stats = summarizer.getStats();
  console.log(`Original messages: ${stats.originalMessageCount}`);
  console.log(`Current messages: ${stats.currentMessageCount}`);
  console.log(`Summaries created: ${stats.summaryCount}`);
  console.log(`Compression ratio: ${stats.compressionRatio.toFixed(2)}x`);
  console.log(`Final token count: ${stats.currentTokens}/${stats.tokenLimit} (${Math.round(stats.currentTokens/stats.tokenLimit*100)}%)`);
  
  console.log('\n✅ Demo complete! The system successfully managed a long conversation');
  console.log('by automatically summarizing old messages when approaching token limits.');
}

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}

export { MessageSummarizer, mockOpenAIResponse };