# OpenAI Responses API 仕様書

## 概要

OpenAI Responses APIは、構造化された出力を生成するための新しいAPIエンドポイントです。従来のChat Completions APIの進化版として、より信頼性の高い構造化データの生成を可能にします。

## 基本的な使い方

### 1. シンプルなテキスト生成

```javascript
import OpenAI from "openai";
const client = new OpenAI();

const response = await client.responses.create({
    model: "gpt-4.1",
    input: "Write a one-sentence bedtime story about a unicorn."
});

console.log(response.output_text);
```

### 2. 構造化された入力形式

新しいAPIでは、`messages`配列の代わりに`input`パラメータを使用します：

```javascript
const response = await client.responses.create({
    model: "gpt-4.1",
    input: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Hello, how are you?" }
    ]
});
```

## Structured Outputs（構造化出力）

### 1. JSON Schema を使用した構造化

```javascript
const response = await client.responses.parse({
    model: "gpt-4o-2024-08-06",
    input: [
        { role: "system", content: "Extract the event information." },
        { role: "user", content: "Alice and Bob are going to a science fair on Friday." }
    ],
    text: {
        format: {
            type: "json_schema",
            name: "event_extraction",
            schema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    date: { type: "string" },
                    participants: {
                        type: "array",
                        items: { type: "string" }
                    }
                },
                required: ["name", "date", "participants"],
                additionalProperties: false
            },
            strict: true
        }
    }
});
```

### 2. Zodを使用した型安全な実装

```javascript
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const CalendarEvent = z.object({
    name: z.string(),
    date: z.string(),
    participants: z.array(z.string()),
});

const response = await client.responses.parse({
    model: "gpt-4o-2024-08-06",
    input: "Alice and Bob are going to a science fair on Friday.",
    text: {
        format: zodTextFormat(CalendarEvent, "event"),
    },
});

const event = response.output_parsed;
```

## Function Calling

関数呼び出しを使用して、より複雑な相互作用を実現できます：

```javascript
const response = await client.responses.create({
    model: "gpt-4.1",
    input: [
        { role: "user", content: "What's the weather in Tokyo?" }
    ],
    functions: [{
        name: "get_weather",
        description: "Get the current weather in a given location",
        parameters: {
            type: "object",
            properties: {
                location: {
                    type: "string",
                    description: "The city and state"
                },
                unit: {
                    type: "string",
                    enum: ["celsius", "fahrenheit"]
                }
            },
            required: ["location"]
        }
    }]
});
```

## レスポンス形式

### 基本的なレスポンス構造

```typescript
interface ResponseObject {
    id: string;
    object: "response";
    created_at: number;
    status: "completed" | "incomplete";
    error: null | ErrorObject;
    incomplete_details: null | IncompleteDetails;
    input: Message[];
    output: OutputMessage[];
    usage: UsageStats;
}
```

### 出力メッセージの形式

```typescript
interface OutputMessage {
    id: string;
    type: "message";
    role: "assistant";
    content: Content[];
}

interface Content {
    type: "text" | "refusal" | "function_call";
    text?: string;
    refusal?: string;
    function_call?: {
        name: string;
        arguments: string;
    };
}
```

## エラーハンドリング

### 1. Refusal（拒否）の処理

```javascript
if (response.output[0].content[0].type === "refusal") {
    console.log("Model refused:", response.output[0].content[0].refusal);
}
```

### 2. 不完全なレスポンスの処理

```javascript
if (response.status === "incomplete") {
    switch (response.incomplete_details.reason) {
        case "max_output_tokens":
            // トークン制限に達した
            break;
        case "content_filter":
            // コンテンツフィルターが作動
            break;
    }
}
```

## ストリーミング

リアルタイムでレスポンスを処理する場合：

```javascript
const stream = await client.responses.create({
    model: "gpt-4.1",
    input: "Tell me a story",
    stream: true,
});

for await (const event of stream) {
    console.log(event);
}
```

## ツールの使用

### Web検索ツール

```javascript
const response = await client.responses.create({
    model: "gpt-4.1",
    tools: [{ type: "web_search_preview" }],
    input: "What was a positive news story from today?",
});
```

### コンピュータ制御ツール

```javascript
const response = await client.responses.create({
    model: "gpt-4.1",
    tools: [{ type: "computer_use" }],
    input: "Take a screenshot of the desktop",
});
```

## 重要な制約事項

### JSON Schemaの制限

1. **必須フィールド**: すべてのフィールドは`required`として指定する必要があります
2. **additionalProperties**: 常に`false`に設定する必要があります
3. **ネスティング**: 最大5レベルまでのネスティングが可能
4. **プロパティ数**: 1つのオブジェクトに最大100個のプロパティ
5. **文字列長**: すべてのプロパティ名、定義名、enum値の合計で15,000文字まで
6. **Enum値**: 全体で最大500個のenum値

### サポートされている型

- `string`
- `number`
- `integer`
- `boolean`
- `array`
- `object`
- `null`
- `enum`
- `anyOf`

### サポートされていない機能

- `allOf`
- `not`
- `oneOf`
- `patternProperties`
- `unevaluatedProperties`

## ベストプラクティス

### 1. 明確なプロンプト設計

```javascript
// 良い例：具体的な指示
{
    role: "system",
    content: "You are a helpful assistant. Always respond in JSON format with keys: 'answer' and 'confidence'."
}

// 悪い例：曖昧な指示
{
    role: "system",
    content: "Respond in JSON."
}
```

### 2. スキーマの検証

```javascript
// Zodを使用した型安全な実装
const ResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        message: z.string(),
        timestamp: z.string()
    }),
    error: z.string().nullable()
});

// スキーマを事前に検証
try {
    const parsed = ResponseSchema.parse(response.output_parsed);
} catch (error) {
    console.error("Schema validation failed:", error);
}
```

### 3. エラーリカバリー

```javascript
async function getStructuredResponse(input, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await client.responses.parse({
                model: "gpt-4o-2024-08-06",
                input,
                text: { format: schema }
            });
            
            if (response.output_parsed) {
                return response.output_parsed;
            }
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
```

## 移行ガイド

### Chat Completions APIからの移行

```javascript
// 旧形式
const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
        { role: "user", content: "Hello" }
    ]
});
const content = completion.choices[0].message.content;

// 新形式
const response = await openai.responses.create({
    model: "gpt-4.1",
    input: [
        { role: "user", content: "Hello" }
    ]
});
const content = response.output_text;
```

### JSON Modeからの移行

```javascript
// 旧形式（JSON Mode）
const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [...],
    response_format: { type: "json_object" }
});

// 新形式（Structured Outputs）
const response = await openai.responses.parse({
    model: "gpt-4o-2024-08-06",
    input: [...],
    text: {
        format: {
            type: "json_schema",
            schema: {...},
            strict: true
        }
    }
});
```

## 料金とレート制限

- Responses APIの料金は、使用するモデルに基づいて計算されます
- レート制限は既存のChat Completions APIと同様です
- Structured Outputsを使用しても追加料金は発生しません

## まとめ

OpenAI Responses APIは、より信頼性の高い構造化出力を生成するための強力なツールです。適切なスキーマ設計とエラーハンドリングを組み合わせることで、堅牢なAIアプリケーションを構築できます。