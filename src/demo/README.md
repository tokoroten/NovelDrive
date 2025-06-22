# Message Summarization Demo

This directory contains demonstration scripts that show how the NovelDrive message summarization system works without requiring actual API calls.

## Overview

The message summarization system automatically condenses old messages when approaching token limits, allowing for indefinite conversations while maintaining context. This is crucial for the multi-agent novel writing system where discussions can become very long.

## Demo Files

### 1. `message-summarization-demo.ts`
A comprehensive demo that simulates a full multi-agent discussion with:
- Mock agent responses
- Real token counting using gpt-tokenizer
- Automatic summarization when threshold is reached
- Statistics tracking and compression metrics

### 2. `visual-summarization-demo.ts`
A simplified, visual demo that clearly shows:
- Token usage with progress bars
- Message list with token counts
- The summarization process in action
- Before/after comparison

## How It Works

1. **Token Monitoring**: The system tracks token usage for all messages
2. **Threshold Detection**: When tokens exceed 70% of the limit, summarization triggers
3. **Message Selection**: Older messages (70%) are selected for summarization
4. **Summary Creation**: Selected messages are replaced with a concise summary
5. **Context Preservation**: Recent messages (30%) are kept intact

## Running the Demos

```bash
# Install dependencies (if not already done)
pnpm install

# Run the comprehensive demo
npx ts-node src/demo/message-summarization-demo.ts

# Run the visual demo
npx ts-node src/demo/visual-summarization-demo.ts
```

## Key Features Demonstrated

- **Automatic Triggering**: Summarization happens automatically when needed
- **Compression Efficiency**: Shows how many messages are compressed into summaries
- **Token Reduction**: Displays the token count reduction achieved
- **Context Preservation**: Recent messages remain accessible for continuity
- **Multiple Summaries**: The system can create multiple summary layers over time

## Example Output

```
📊 Token count: 7234/8000 (90%)

⚠️  Token threshold reached! Initiating summarization...

📝 Summarizing 28 messages...
✅ Summarization complete! New token count: 2456 (66% reduction)
```

## Integration with NovelDrive

In the actual NovelDrive system:
- Summaries would be created using the configured LLM (GPT-4)
- Summary quality would be higher with actual context analysis
- Summaries would preserve key decisions and plot points
- The system would maintain character and world-building consistency

## Benefits

1. **Unlimited Conversations**: Agents can discuss indefinitely without hitting limits
2. **Cost Efficiency**: Reduces API token usage significantly
3. **Performance**: Smaller context = faster API responses
4. **Memory Management**: Prevents excessive memory usage in long sessions
5. **Context Preservation**: Important recent context is always available

## Customization

You can adjust these parameters in the demos:
- `TOKEN_LIMIT`: Maximum tokens before forcing summarization
- `SUMMARY_TRIGGER_THRESHOLD`: Percentage of limit to trigger at (0.7 = 70%)
- `MIN_MESSAGES_BEFORE_SUMMARY`: Minimum messages required before summarizing
- Recent message percentage (currently 30%)

## Next Steps

These demos show the core concept. The production system would include:
- Actual API integration for high-quality summaries
- Importance scoring for messages
- Project-specific summary templates
- Summary caching and retrieval
- Integration with the knowledge management layer