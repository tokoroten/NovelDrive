import { v4 as uuidv4 } from 'uuid';

/**
 * ローカルアイデア生成サービス
 * OpenAI APIを使わずにアイデアを生成
 */
export class LocalIdeaGenerator {
  private static instance: LocalIdeaGenerator;

  private constructor() {}

  static getInstance(): LocalIdeaGenerator {
    if (!LocalIdeaGenerator.instance) {
      LocalIdeaGenerator.instance = new LocalIdeaGenerator();
    }
    return LocalIdeaGenerator.instance;
  }

  /**
   * ガチャ要素からアイデアを生成
   */
  async generateIdeaFromElements(elements: {
    character?: any;
    theme?: any;
    situation?: any;
    keyword?: any;
    worldSetting?: any;
  }): Promise<string> {
    const templates = this.getIdeaTemplates();
    const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];
    
    // 要素を埋め込む
    let idea = selectedTemplate;
    
    if (elements.character) {
      idea = idea.replace('[キャラクター]', elements.character.name || '謎の人物');
    }
    
    if (elements.theme) {
      idea = idea.replace('[テーマ]', elements.theme.title || elements.theme.content || '運命');
    }
    
    if (elements.situation) {
      const situationText = typeof elements.situation === 'string' 
        ? elements.situation 
        : elements.situation.content || '不思議な場所';
      idea = idea.replace('[シチュエーション]', situationText);
    }
    
    if (elements.keyword) {
      const keywordText = typeof elements.keyword === 'string'
        ? elements.keyword
        : elements.keyword.content || '秘密';
      idea = idea.replace('[キーワード]', keywordText);
    }
    
    if (elements.worldSetting) {
      idea = idea.replace('[世界設定]', elements.worldSetting.title || '異世界');
    }
    
    // 残った置換文字を削除
    idea = idea.replace(/\[[^\]]+\]/g, '');
    
    // 文を整える
    idea = this.polishIdea(idea);
    
    return idea;
  }

  /**
   * アイデアテンプレート
   */
  private getIdeaTemplates(): string[] {
    return [
      // キャラクター中心
      '[キャラクター]が[シチュエーション]で[キーワード]と出会い、新たな物語が始まる',
      '[キャラクター]の秘められた過去が[シチュエーション]で明らかになる',
      '記憶を失った[キャラクター]が[シチュエーション]で自分の正体を探る',
      
      // テーマ中心
      '[テーマ]をめぐって[シチュエーション]で起きる不思議な出来事',
      '[テーマ]の力を持つ者たちが[シチュエーション]で運命的に出会う',
      '[テーマ]に導かれて[キャラクター]が[シチュエーション]へ向かう',
      
      // シチュエーション中心
      '[シチュエーション]で偶然出会った二人に起きる[テーマ]の物語',
      '[シチュエーション]に閉じ込められた人々が[キーワード]を巡って対立する',
      '[シチュエーション]で発見された[キーワード]が世界を変える',
      
      // キーワード中心
      '[キーワード]を求めて[キャラクター]が冒険に出る',
      '[キーワード]の謎を解く鍵が[シチュエーション]に隠されている',
      '[キーワード]によって結ばれた運命の物語',
      
      // 複合型
      '[キャラクター]と[キーワード]が[シチュエーション]で織りなす[テーマ]の物語',
      '[世界設定]で[キャラクター]が[テーマ]に挑む冒険譚',
      '[シチュエーション]を舞台に[テーマ]と[キーワード]が交錯する',
      
      // 抽象的
      '失われた[キーワード]を取り戻すため、[キャラクター]は旅に出る',
      '[テーマ]の真実を知った[キャラクター]の選択',
      '[シチュエーション]で始まる、予想もしなかった冒険',
      '時を超えて[キーワード]が繋ぐ二つの運命',
      '[世界設定]の片隅で起きる小さな奇跡の物語',
    ];
  }

  /**
   * アイデアを洗練させる
   */
  private polishIdea(idea: string): string {
    // 重複する助詞を削除
    idea = idea.replace(/の{2,}/g, 'の');
    idea = idea.replace(/に{2,}/g, 'に');
    idea = idea.replace(/で{2,}/g, 'で');
    idea = idea.replace(/が{2,}/g, 'が');
    
    // 空白を整理
    idea = idea.replace(/\s+/g, ' ').trim();
    
    // 文末を整える
    if (!idea.match(/[。！？]$/)) {
      idea += '。';
    }
    
    // 50文字を超える場合は短縮
    if (idea.length > 50) {
      idea = idea.substring(0, 47) + '...';
    }
    
    return idea;
  }

  /**
   * プロットの種を生成
   */
  async generatePlotSeed(
    genre: string,
    themes: string[],
    keywords: string[]
  ): Promise<string[]> {
    const seeds: string[] = [];
    
    // ジャンル別のテンプレート
    const genreTemplates: { [key: string]: string[] } = {
      'ファンタジー': [
        '魔法を失った世界で、最後の魔法使いが{keyword}を求めて旅をする',
        '竜と人間が共存する王国で、{theme}をめぐる争いが起きる',
        '異世界から来た主人公が、{keyword}の力で世界を救う',
      ],
      'SF': [
        '人工知能が{theme}を学習し、人類に問いかける',
        '宇宙船で{keyword}を発見した乗組員たちの運命',
        '時間旅行者が{theme}を変えようとして起きる矛盾',
      ],
      'ミステリー': [
        '密室で発見された{keyword}が事件の鍵を握る',
        '{theme}に取り憑かれた人物の謎めいた行動',
        '消えた{keyword}を追う探偵の推理',
      ],
      'ロマンス': [
        '{theme}をきっかけに出会った二人の恋物語',
        '{keyword}に導かれて再会する運命の恋人たち',
        '禁じられた{theme}の中で育まれる愛',
      ],
      'ホラー': [
        '{keyword}に呪われた館での恐怖の一夜',
        '{theme}の影に潜む、見えない恐怖',
        '深夜に現れる{keyword}の正体とは',
      ],
    };
    
    const templates = genreTemplates[genre] || [
      '{theme}をテーマにした{keyword}の物語',
      '{keyword}が導く{theme}への道',
      '{theme}と{keyword}が交錯する瞬間',
    ];
    
    // テンプレートに要素を埋め込む
    for (const template of templates.slice(0, 3)) {
      let seed = template;
      
      if (themes.length > 0) {
        seed = seed.replace('{theme}', themes[Math.floor(Math.random() * themes.length)]);
      }
      
      if (keywords.length > 0) {
        seed = seed.replace('{keyword}', keywords[Math.floor(Math.random() * keywords.length)]);
      }
      
      // 残りの置換文字を削除
      seed = seed.replace(/{[^}]+}/g, '謎');
      
      seeds.push(seed);
    }
    
    return seeds;
  }
}

/**
 * ヘルパー関数：ガチャアイデア生成
 */
export async function generateGachaIdea(elements: any): Promise<string> {
  const generator = LocalIdeaGenerator.getInstance();
  return generator.generateIdeaFromElements(elements);
}

/**
 * ヘルパー関数：プロットシード生成
 */
export async function generatePlotSeeds(
  genre: string,
  themes: string[],
  keywords: string[]
): Promise<string[]> {
  const generator = LocalIdeaGenerator.getInstance();
  return generator.generatePlotSeed(genre, themes, keywords);
}