import { v4 as uuidv4 } from 'uuid';
import { getSearchTokens } from './japanese-tokenizer';

/**
 * ローカルインスピレーション抽出サービス
 * OpenAI APIを使わずにテキストからインスピレーションを抽出
 */
export class LocalInspirationService {
  private static instance: LocalInspirationService;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): LocalInspirationService {
    if (!LocalInspirationService.instance) {
      LocalInspirationService.instance = new LocalInspirationService();
    }
    return LocalInspirationService.instance;
  }

  /**
   * テキストからインスピレーションを抽出
   */
  async extractInspiration(
    text: string,
    type: string
  ): Promise<{
    keywords: string[];
    themes: string[];
    emotions: string[];
    plotSeeds: string[];
    characters: Array<{ name: string; role: string; description: string }>;
    scenes: string[];
  }> {
    try {
      // テキストのトークン化
      const tokens = getSearchTokens(text);
      
      // キーワード抽出（頻出する単語）
      const keywords = this.extractKeywords(text, tokens);
      
      // テーマ抽出（文脈から推測）
      const themes = this.extractThemes(text, type);
      
      // 感情抽出
      const emotions = this.extractEmotions(text);
      
      // プロットシード生成
      const plotSeeds = this.generatePlotSeeds(text, type, keywords, themes);
      
      // キャラクター候補抽出
      const characters = this.extractCharacters(text);
      
      // シーンアイデア生成
      const scenes = this.generateSceneIdeas(text, themes, emotions);

      return {
        keywords,
        themes,
        emotions,
        plotSeeds,
        characters,
        scenes,
      };
    } catch (error) {
      console.error('Failed to extract inspiration locally:', error);
      return {
        keywords: [],
        themes: [],
        emotions: [],
        plotSeeds: [],
        characters: [],
        scenes: [],
      };
    }
  }

  /**
   * キーワード抽出
   */
  private extractKeywords(text: string, tokens: string[]): string[] {
    // トークンの頻度をカウント
    const tokenFrequency = new Map<string, number>();
    tokens.forEach(token => {
      if (token.length > 2) { // 2文字以上のトークンのみ
        tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1);
      }
    });

    // 頻度順にソートして上位を取得
    const sortedTokens = Array.from(tokenFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([token]) => token);

    // 一般的な単語を除外
    const commonWords = new Set(['こと', 'もの', 'ため', 'よう', 'など', 'この', 'その', 'あの']);
    const keywords = sortedTokens.filter(token => !commonWords.has(token));

    return keywords.slice(0, 5);
  }

  /**
   * テーマ抽出
   */
  private extractThemes(text: string, type: string): string[] {
    const themes: string[] = [];
    
    // テーマ候補のパターンマッチング
    const themePatterns: { [key: string]: string[] } = {
      '愛': ['愛', '恋', '好き', '想い', '心'],
      '友情': ['友', '仲間', '絆', '信頼'],
      '冒険': ['冒険', '旅', '挑戦', '探検', '発見'],
      '成長': ['成長', '変化', '学び', '経験', '克服'],
      '家族': ['家族', '親', '子', '兄弟', '姉妹'],
      '希望': ['希望', '夢', '未来', '光', '可能性'],
      '別れ': ['別れ', '離れ', '終わり', '去る'],
      '謎': ['謎', '秘密', '不思議', '隠'],
      '戦い': ['戦', '闘', '競', '勝', '負'],
      '時間': ['時', '過去', '未来', '記憶', '歴史'],
    };

    for (const [theme, patterns] of Object.entries(themePatterns)) {
      if (patterns.some(pattern => text.includes(pattern))) {
        themes.push(theme);
      }
    }

    // タイプ別のデフォルトテーマ
    if (type === 'url' && themes.length === 0) {
      themes.push('情報', '発見');
    } else if (type === 'text' && themes.length === 0) {
      themes.push('思考', '表現');
    }

    return themes.slice(0, 3);
  }

  /**
   * 感情抽出
   */
  private extractEmotions(text: string): string[] {
    const emotions: string[] = [];
    
    const emotionPatterns: { [key: string]: string[] } = {
      '喜び': ['嬉しい', '楽しい', '幸せ', '笑', '喜'],
      '悲しみ': ['悲しい', '涙', '泣', '辛い', '切ない'],
      '怒り': ['怒', '腹', 'むかつく', 'イライラ'],
      '恐れ': ['怖', '恐', '不安', '心配'],
      '驚き': ['驚', 'びっくり', '意外', '予想外'],
      '期待': ['期待', '楽しみ', 'わくわく', '待つ'],
      '懐かしさ': ['懐かし', '昔', '思い出', '記憶'],
      '感動': ['感動', '感激', '心に響く', '胸が熱く'],
    };

    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
      if (patterns.some(pattern => text.includes(pattern))) {
        emotions.push(emotion);
      }
    }

    // 文章の雰囲気から推測
    if (text.includes('！')) emotions.push('興奮');
    if (text.includes('？')) emotions.push('疑問');
    if (text.includes('…')) emotions.push('余韻');

    return emotions.slice(0, 3);
  }

  /**
   * プロットシード生成
   */
  private generatePlotSeeds(
    text: string,
    type: string,
    keywords: string[],
    themes: string[]
  ): string[] {
    const seeds: string[] = [];
    
    // キーワードとテーマを組み合わせてプロットシードを生成
    if (themes.includes('愛') && keywords.length > 0) {
      seeds.push(`${keywords[0]}をめぐる恋愛物語`);
    }
    
    if (themes.includes('冒険')) {
      seeds.push(`未知の${keywords[0] || '世界'}への冒険`);
    }
    
    if (themes.includes('謎')) {
      seeds.push(`${keywords[0] || '事件'}の謎を解き明かす物語`);
    }
    
    // テキストの内容から具体的なシードを生成
    const sentences = text.split(/[。！？]/).filter(s => s.length > 10);
    if (sentences.length > 0) {
      seeds.push(`「${sentences[0]}」から始まる物語`);
    }
    
    // タイプ別のシード
    if (type === 'url') {
      seeds.push('Webで見つけた情報から着想を得た現代的な物語');
    }
    
    return seeds.slice(0, 3);
  }

  /**
   * キャラクター候補抽出
   */
  private extractCharacters(text: string): Array<{ name: string; role: string; description: string }> {
    const characters: Array<{ name: string; role: string; description: string }> = [];
    
    // 人物を示すパターン
    const personPatterns = [
      /「([^」]+)」と(言った|語った|話した)/g,
      /([^、。]+)(さん|くん|ちゃん|氏|様)/g,
      /([^、。]+)は([^、。]+)だった/g,
    ];
    
    const foundNames = new Set<string>();
    
    for (const pattern of personPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const name = match[1];
        if (name && name.length < 10 && !foundNames.has(name)) {
          foundNames.add(name);
          characters.push({
            name: name,
            role: '登場人物',
            description: `${name}という人物`,
          });
        }
      }
    }
    
    // 見つからない場合はデフォルトキャラクターを提案
    if (characters.length === 0) {
      characters.push({
        name: '主人公',
        role: '主人公',
        description: 'この物語の中心となる人物',
      });
    }
    
    return characters.slice(0, 3);
  }

  /**
   * シーンアイデア生成
   */
  private generateSceneIdeas(text: string, themes: string[], emotions: string[]): string[] {
    const scenes: string[] = [];
    
    // 時間帯のパターン
    if (text.includes('朝') || text.includes('夜明け')) {
      scenes.push('朝の光が差し込む静かな場面');
    }
    if (text.includes('夜') || text.includes('夕暮れ')) {
      scenes.push('夕暮れ時の感傷的な場面');
    }
    
    // 場所のパターン
    const placePatterns = ['学校', '駅', '公園', '海', '山', '街', '部屋', '店'];
    for (const place of placePatterns) {
      if (text.includes(place)) {
        scenes.push(`${place}での印象的な出来事`);
        break;
      }
    }
    
    // テーマと感情から生成
    if (themes.includes('愛') && emotions.includes('喜び')) {
      scenes.push('二人が初めて心を通わせる場面');
    }
    if (themes.includes('別れ') && emotions.includes('悲しみ')) {
      scenes.push('別れの瞬間の切ない描写');
    }
    
    // テキストから印象的な部分を抽出
    const impressiveParts = text.match(/[^。！？]{20,50}[。！？]/g);
    if (impressiveParts && impressiveParts.length > 0) {
      scenes.push(`「${impressiveParts[0]}」を描写する場面`);
    }
    
    return scenes.slice(0, 3);
  }
}

/**
 * ヘルパー関数：インスピレーション抽出
 */
export async function extractInspirationLocal(
  text: string,
  type: string
): Promise<{
  keywords: string[];
  themes: string[];
  emotions: string[];
  plotSeeds: string[];
  characters: Array<{ name: string; role: string; description: string }>;
  scenes: string[];
}> {
  const service = LocalInspirationService.getInstance();
  return service.extractInspiration(text, type);
}