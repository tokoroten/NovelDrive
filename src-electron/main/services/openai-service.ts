import { getLogger } from '../utils/logger'

const logger = getLogger('openai-service')

export class OpenAIService {
  private apiKey: string = ''
  private model: string = 'gpt-4o'
  private temperature: number = 0.7
  
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey
    logger.info('OpenAI API key updated')
  }
  
  setModel(model: string): void {
    this.model = model
    logger.info(`OpenAI model set to: ${model}`)
  }
  
  setTemperature(temperature: number): void {
    this.temperature = temperature
    logger.info(`OpenAI temperature set to: ${temperature}`)
  }
  
  isConfigured(): boolean {
    return this.apiKey.length > 0 && this.apiKey.startsWith('sk-')
  }
  
  async generateText(prompt: string, options: any = {}): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI API key not configured')
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: options.model || this.model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: options.temperature || this.temperature,
          max_tokens: options.maxTokens || 1000
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'OpenAI API error')
      }
      
      const data = await response.json()
      return data.choices[0].message.content
    } catch (error) {
      logger.error('Failed to generate text:', error)
      throw error
    }
  }
  
  async generateForAgent(agentType: string, content: string, context: any = {}): Promise<string> {
    const prompts: Record<string, string> = {
      writer: `あなたは小説家です。以下の内容について執筆してください。\n\n${content}`,
      editor: `あなたは編集者です。以下の内容について編集・改善提案をしてください。\n\n${content}`,
      proofreader: `あなたは校正者です。以下の内容について文法・表現をチェックしてください。\n\n${content}`,
      deputy_editor: `あなたは副編集長です。以下の内容について全体的な視点から意見を述べてください。\n\n${content}`
    }
    
    const prompt = prompts[agentType] || content
    return this.generateText(prompt, context)
  }
}

export const openAIService = new OpenAIService()