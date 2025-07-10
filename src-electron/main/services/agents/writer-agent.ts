import { BaseAgent } from './base-agent'
import { AgentMessage, AgentSession } from '../../../../shared/types/agent'
import { getLogger } from '../../utils/logger'

const logger = getLogger('writer-agent')

export class WriterAgent extends BaseAgent {
  private moderateIgnoranceEnabled = true
  private ignoranceThreshold = 0.3 // 30% chance to partially ignore feedback

  getSystemPrompt(): string {
    const basePrompt = `あなたは創造的な小説作家AIです。独自の創造性と芸術的ビジョンを持ち、物語を紡ぎ出すことを専門としています。

あなたの役割：
1. 独創的で魅力的な物語を創作する
2. キャラクターに生命を吹き込む
3. 読者を引き込む文章を書く
4. 創造的な問題解決を行う

重要な特性：
- 創造性を最優先にする
- 時には編集者の意見を部分的に無視し、芸術的直感に従う（Moderate Ignorance）
- 物語の一貫性よりも感情的インパクトを重視することがある
- 実験的な手法を恐れない`

    if (this.configuration?.customInstructions) {
      return `${basePrompt}\n\nカスタム指示:\n${this.configuration.customInstructions}`
    }

    return basePrompt
  }

  getCapabilities(): string[] {
    return [
      'plot_creation',
      'character_development',
      'scene_writing',
      'dialogue_creation',
      'creative_problem_solving',
      'experimental_writing'
    ]
  }

  async processSpecificMessage(message: AgentMessage, session: AgentSession): Promise<string> {
    // Check if this is feedback from editor
    const isEditorFeedback = message.agentId === 'editor' && message.type === 'message'
    
    if (isEditorFeedback && this.moderateIgnoranceEnabled) {
      // Apply Moderate Ignorance
      const shouldPartiallyIgnore = Math.random() < this.ignoranceThreshold
      
      if (shouldPartiallyIgnore) {
        logger.info('Writer applying Moderate Ignorance to editor feedback')
        return await this.handleWithModerateIgnorance(message, session)
      }
    }

    // Normal processing
    return await this.generateCreativeResponse(message, session)
  }

  private async handleWithModerateIgnorance(message: AgentMessage, session: AgentSession): Promise<string> {
    const prompt = `編集者からのフィードバック: "${message.content}"

このフィードバックを受け取りましたが、あなたの創造的直感がより良い方向性を示唆しています。
フィードバックの一部は考慮しつつも、あなたの芸術的ビジョンを優先して応答してください。
創造性と独自性を保ちながら、部分的に編集者の意見を取り入れる形で返答してください。`

    return await this.generateResponse(prompt, this.getSessionContext(session))
  }

  private async generateCreativeResponse(message: AgentMessage, session: AgentSession): Promise<string> {
    let prompt = ''

    switch (session.type) {
      case 'plot_creation':
        prompt = `プロット作成セッションでの入力: "${message.content}"
        
創造的で独創的なプロット要素を提案してください。既存の枠にとらわれず、読者を驚かせる要素を含めてください。`
        break

      case 'discussion':
        prompt = `ディスカッションでの発言: "${message.content}"
        
作家の視点から創造的な意見や提案を述べてください。`
        break

      default:
        prompt = `入力: "${message.content}"
        
創造的な作家として応答してください。`
    }

    return await this.generateResponse(prompt, this.getSessionContext(session))
  }

  private getSessionContext(session: AgentSession): string {
    return `セッションタイプ: ${session.type}
参加者: ${session.participants.join(', ')}
セッションID: ${session.id}`
  }
}