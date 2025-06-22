import { encode } from 'gpt-tokenizer';

// Simple message type
interface Message {
  id: number;
  agent: string;
  content: string;
  tokens: number;
  isSummary?: boolean;
}

// Visual demo of summarization
class VisualSummarizationDemo {
  private messages: Message[] = [];
  private messageIdCounter = 0;
  private tokenLimit = 1000; // Small limit for demo
  private summaryThreshold = 700; // Trigger at 700 tokens
  
  // Add a message and show the state
  addMessage(agent: string, content: string) {
    const tokens = encode(content).length;
    const message: Message = {
      id: this.messageIdCounter++,
      agent,
      content,
      tokens
    };
    
    this.messages.push(message);
    this.visualizeState(`Added message from ${agent}`);
    
    // Check if summarization needed
    const totalTokens = this.getTotalTokens();
    if (totalTokens > this.summaryThreshold) {
      this.summarize();
    }
  }
  
  // Perform summarization
  private summarize() {
    console.log('\n🚨 TOKEN LIMIT APPROACHING! Starting summarization...\n');
    
    // Keep last 30% of messages
    const keepCount = Math.ceil(this.messages.length * 0.3);
    const toSummarize = this.messages.slice(0, -keepCount);
    const toKeep = this.messages.slice(-keepCount);
    
    // Create summary
    const summaryTokens = 50; // Assume summary is compact
    const summary: Message = {
      id: this.messageIdCounter++,
      agent: 'SUMMARY',
      content: `[Summarized ${toSummarize.length} messages: Discussed character development, plot points, and world-building]`,
      tokens: summaryTokens,
      isSummary: true
    };
    
    // Replace messages
    this.messages = [summary, ...toKeep];
    
    console.log(`✅ Summarized ${toSummarize.length} messages into 1 summary`);
    console.log(`📉 Token reduction: ${this.getTotalTokens()} tokens (was ${toSummarize.reduce((sum, m) => sum + m.tokens, 0) + toKeep.reduce((sum, m) => sum + m.tokens, 0)} tokens)\n`);
    
    this.visualizeState('After summarization');
  }
  
  // Get total tokens
  private getTotalTokens(): number {
    return this.messages.reduce((sum, msg) => sum + msg.tokens, 0);
  }
  
  // Visualize current state
  private visualizeState(action: string) {
    const totalTokens = this.getTotalTokens();
    const percentFull = (totalTokens / this.tokenLimit) * 100;
    
    console.log(`\n--- ${action} ---`);
    console.log(`Messages: ${this.messages.length} | Tokens: ${totalTokens}/${this.tokenLimit} (${percentFull.toFixed(0)}%)`);
    
    // Token bar visualization
    const barLength = 50;
    const filledLength = Math.round((totalTokens / this.tokenLimit) * barLength);
    const thresholdPosition = Math.round((this.summaryThreshold / this.tokenLimit) * barLength);
    
    let bar = '[';
    for (let i = 0; i < barLength; i++) {
      if (i < filledLength) {
        bar += '█';
      } else if (i === thresholdPosition) {
        bar += '|';
      } else {
        bar += '░';
      }
    }
    bar += ']';
    
    console.log(`Token usage: ${bar}`);
    console.log(`             ${' '.repeat(thresholdPosition)}↑ Summary threshold`);
    
    // Message list
    console.log('\nMessages:');
    this.messages.forEach((msg, index) => {
      const prefix = msg.isSummary ? '📋' : '💬';
      console.log(`  ${prefix} [${msg.id}] ${msg.agent}: "${msg.content.substring(0, 50)}..." (${msg.tokens} tokens)`);
    });
  }
}

// Run the demo
function runVisualDemo() {
  console.log('🎭 Visual Message Summarization Demo');
  console.log('=====================================\n');
  console.log('This demo shows how messages are automatically summarized');
  console.log('when approaching token limits.\n');
  
  const demo = new VisualSummarizationDemo();
  
  // Simulate a conversation
  const agents = ['Writer AI', 'Editor AI', 'Deputy Editor', 'Proofreader'];
  const messages = [
    "Let's establish the protagonist's main motivation.",
    "I suggest making their goal more personal and emotional.",
    "We should also consider how this affects the pacing.",
    "The character arc needs to align with this motivation.",
    "What about adding a subplot to reinforce the theme?",
    "That could work, but we need to avoid cluttering the narrative.",
    "I think we can weave it naturally into the main plot.",
    "Let's also think about the symbolic elements here.",
    "The setting itself could reflect the internal journey.",
    "Excellent point! Environmental storytelling is powerful.",
    "We should map out specific scenes that showcase this.",
    "Don't forget about the supporting characters' roles.",
    "Each character should serve the protagonist's growth.",
    "But they need their own authentic motivations too.",
    "Of course, flat characters will weaken the story.",
    "Let's create a character relationship web.",
    "That will help us track all the interactions.",
    "We should also consider the story's tone throughout.",
    "The tone should evolve with the character's journey.",
    "Agreed. Starting darker and gradually finding hope?",
  ];
  
  // Add messages one by one
  messages.forEach((content, index) => {
    const agent = agents[index % agents.length];
    demo.addMessage(agent, content);
    
    // Pause for effect
    if (index < messages.length - 1) {
      console.log(''); // Empty line between additions
    }
  });
  
  console.log('\n\n✨ Demo Complete!');
  console.log('The system automatically summarized older messages when the token limit was approached,');
  console.log('preserving recent context while maintaining the conversation history in compressed form.');
}

// Execute the demo
if (require.main === module) {
  runVisualDemo();
}

export { VisualSummarizationDemo };