# キャラクター対話システム

## 概要

作家が執筆の流れを止めずに書き進められるよう、セリフの内容だけを指定し、後から各キャラクターの性格に合わせた表現に自動変換するシステムです。

## システムの流れ

```
1. 作家AI: 「太郎が【感謝を伝える】」と記述
2. キャラクター対話AI: 太郎のプロフィールを参照
3. シチュエーション分析: 場面・相手・関係性を考慮
4. セリフ生成: 「ありがとう」「感謝します」「サンキュー」など
```

## データ構造

### キャラクタープロフィール
```typescript
interface CharacterProfile {
  id: string;
  name: string;
  
  // 基本情報
  age: number;
  gender: string;
  occupation: string;
  
  // 言語特性
  speechStyle: {
    formality: 'casual' | 'normal' | 'formal' | 'archaic';
    dialect: string; // "関西弁", "標準語" など
    personalPronouns: {
      first: string[];  // ["俺", "私", "僕", "わし"]
      second: string[]; // ["お前", "君", "あなた", "貴様"]
    };
    sentenceEndings: string[]; // ["だぜ", "です", "である", "のだ"]
    vocabularyLevel: 'simple' | 'normal' | 'complex';
  };
  
  // 性格特性
  personality: {
    openness: number;      // 0-1: 内向的〜外向的
    emotionality: number;  // 0-1: 冷静〜感情的
    assertiveness: number; // 0-1: 控えめ〜積極的
    honesty: number;       // 0-1: 建前重視〜本音重視
  };
  
  // 特殊な言い回し
  catchphrases: string[];
  avoidWords: string[]; // 使わない言葉
  favoriteExpressions: string[];
  
  // 関係性による変化
  relationships: Map<string, RelationshipStyle>;
}

interface RelationshipStyle {
  targetCharacterId: string;
  formality: number; // その人物に対する敬語度
  closeness: number; // 親密度
  specialNickname?: string; // 特別な呼び方
}
```

### セリフプレースホルダー
```typescript
interface DialoguePlaceholder {
  characterId: string;
  intent: DialogueIntent;
  emotion?: EmotionType;
  target?: string; // 話しかける相手
  context?: string; // 追加コンテキスト
}

type DialogueIntent = 
  | '感謝を伝える'
  | '謝罪する'
  | '挨拶する'
  | '同意する'
  | '反対する'
  | '質問する'
  | '驚く'
  | '喜ぶ'
  | '怒る'
  | '悲しむ'
  | '励ます'
  | '褒める'
  | '皮肉を言う'
  | '冗談を言う'
  | '告白する'
  | 'カスタム：[具体的な内容]';

type EmotionType = 
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'embarrassed'
  | 'confident';
```

## 実装例

### 1. プレースホルダーの記述方法
```typescript
// 作家AIが書く原稿
const manuscript = `
太郎は部屋に入ると、花子を見つけた。
太郎【感謝を伝える:happy:花子】
花子【照れながら返事する:embarrassed:太郎】
太郎【告白する:nervous:花子】
`;

// パース後
const placeholders = [
  {
    characterId: "taro",
    intent: "感謝を伝える",
    emotion: "happy",
    target: "hanako"
  },
  // ...
];
```

### 2. セリフ生成エンジン
```typescript
class DialogueGenerator {
  constructor(
    private characters: Map<string, CharacterProfile>,
    private llmService: LLMService
  ) {}

  async generateDialogue(
    placeholder: DialoguePlaceholder,
    scene: SceneContext
  ): Promise<string> {
    const character = this.characters.get(placeholder.characterId);
    const target = placeholder.target ? 
      this.characters.get(placeholder.target) : null;
    
    // キャラクター固有のプロンプトを生成
    const prompt = this.buildPrompt(character, target, placeholder, scene);
    
    // LLMでセリフ生成
    const dialogue = await this.llmService.generate(prompt);
    
    // 後処理（禁止ワードチェック、方言変換など）
    return this.postProcess(dialogue, character);
  }

  private buildPrompt(
    character: CharacterProfile,
    target: CharacterProfile | null,
    placeholder: DialoguePlaceholder,
    scene: SceneContext
  ): string {
    return `
キャラクター: ${character.name}
年齢: ${character.age}
性格: ${this.describePersonality(character.personality)}
話し方: ${character.speechStyle.formality}
一人称: ${character.speechStyle.personalPronouns.first[0]}
語尾: ${character.speechStyle.sentenceEndings.join(', ')}

${target ? `
相手: ${target.name}
関係性: ${this.getRelationship(character, target)}
` : ''}

状況: ${scene.description}
意図: ${placeholder.intent}
感情: ${placeholder.emotion || 'neutral'}

このキャラクターが上記の意図を表現するセリフを1つ生成してください。
キャラクターの性格と話し方を必ず反映させてください。
`;
  }
}
```

### 3. バリエーション生成
```typescript
class DialogueVariationGenerator {
  async generateVariations(
    placeholder: DialoguePlaceholder,
    count: number = 3
  ): Promise<string[]> {
    const variations = [];
    
    for (let i = 0; i < count; i++) {
      const dialogue = await this.generator.generateDialogue(
        placeholder,
        { ...this.scene, variationSeed: i }
      );
      variations.push(dialogue);
    }
    
    return variations;
  }
}
```

## 具体例

### ケース1: 感謝を伝える
```typescript
// 太郎（20歳、男、カジュアル）のプロフィール
const taro = {
  speechStyle: {
    formality: 'casual',
    personalPronouns: { first: ['俺'], second: ['お前'] },
    sentenceEndings: ['だぜ', 'だな']
  }
};

// 花子（18歳、女、丁寧）のプロフィール  
const hanako = {
  speechStyle: {
    formality: 'normal',
    personalPronouns: { first: ['私'], second: ['〜さん'] },
    sentenceEndings: ['です', 'ます']
  }
};

// 生成されるセリフ例
太郎【感謝を伝える】 → 「サンキューな！助かったぜ」
花子【感謝を伝える】 → 「ありがとうございます。本当に助かりました」
```

### ケース2: 関係性による変化
```typescript
// 太郎→花子（友人）
太郎【挨拶する:normal:花子】 → 「よう、花子！」

// 太郎→先生（目上）
太郎【挨拶する:normal:先生】 → 「おはようございます、先生」

// 太郎→妹（家族）
太郎【挨拶する:normal:妹】 → 「おう、起きたか」
```

## エディター統合

### 執筆画面での表示
```typescript
interface DialogueEditorView {
  // プレースホルダー表示モード
  showPlaceholders: boolean;
  
  // リアルタイム変換
  realtimeConversion: boolean;
  
  // 変換候補の表示
  showVariations: boolean;
  
  // ハイライト
  highlightUnconverted: boolean;
}

// エディター上の表示例
// プレースホルダーモード:
// 太郎【感謝を伝える】
//
// 変換後モード:
// 太郎「サンキューな！助かったぜ」
//
// バリエーション表示:
// 太郎「サンキューな！助かったぜ」
//     「ありがとな、恩に着るぜ」
//     「助かった！借り作っちまったな」
```

## 高度な機能

### 1. 感情の段階的表現
```typescript
// 怒りレベルに応じた表現
太郎【怒る:level1】 → 「ちょっと待てよ」
太郎【怒る:level3】 → 「ふざけんな！」
太郎【怒る:level5】 → 「てめぇ、いい加減にしろ！」
```

### 2. 文脈依存の調整
```typescript
// 前後の文脈を考慮
if (scene.previousDialogue.includes('激しい口論')) {
  // より感情的な表現に調整
  adjustEmotionLevel(+2);
}
```

### 3. 成長による変化
```typescript
// 物語の進行に応じてキャラクターの話し方が変化
if (chapter > 10 && character.hasExperienced('重要な成長イベント')) {
  character.speechStyle.formality = 'normal'; // casualからnormalへ
}
```

## 利点

1. **執筆の流れを妨げない**: 詳細なセリフを考えずに物語を進められる
2. **キャラクターの一貫性**: プロフィールに基づいた統一的な話し方
3. **後からの調整が容易**: セリフだけを一括で再生成可能
4. **バリエーション検討**: 複数の候補から選択可能

この システムにより、作家は物語の流れに集中しながら、キャラクターの個性豊かなセリフを後から最適化できます。