import { useState, useEffect, useRef, useMemo } from 'react';
import { openai } from './openai-client';
import { agents } from './agents';
import { ConversationTurn, AgentResponse } from './types';
import { ConversationQueue, QueueEvent } from './ConversationQueue';

function App() {
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [targetAgent, setTargetAgent] = useState<string>('random');
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [userTimeoutSeconds, setUserTimeoutSeconds] = useState(30); // カウントダウン用
  const [observerMode, setObserverMode] = useState(false); // 観察モード
  const [agentDelay, setAgentDelay] = useState(0); // エージェント間の遅延（ミリ秒）
  const [documentContent, setDocumentContent] = useState<string>('# 小説のタイトル\n\n第1章\n\nここに物語を書き始めてください...'); // ドキュメント内容
  const [, setThinkingAgentId] = useState<string | null>(null); // 考え中のエージェントID
  const [queueLength, setQueueLength] = useState(0); // キューの長さ
  const conversationEndRef = useRef<HTMLDivElement>(null);
  // const userTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false); // isRunningの最新値を保持
  
  // 会話キューの作成
  const conversationQueue = useMemo(() => new ConversationQueue(), []);

  // isRunningの値をRefに同期
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // 自動スクロール
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // ユーザータイムアウトのカウントダウン
  useEffect(() => {
    if (waitingForUser && isRunning) {
      // 観察モードの場合は即座にタイムアウト処理
      if (observerMode) {
        const timeout = setTimeout(() => {
          handleUserTimeout();
        }, 2000); // 2秒後に自動継続
        return () => clearTimeout(timeout);
      }
      
      // 通常モードの場合はカウントダウン
      const interval = setInterval(() => {
        setUserTimeoutSeconds(prev => {
          // ユーザーが入力中の場合はカウントダウンをリセット
          if (userInput.trim().length > 0) {
            return 30;
          }
          
          if (prev <= 1) {
            // タイムアウト：ランダムなエージェントが発言
            handleUserTimeout();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setUserTimeoutSeconds(30);
    }
  }, [waitingForUser, isRunning, observerMode, userInput]);

  // conversationのRefを作成
  const conversationRef = useRef<ConversationTurn[]>([]);
  
  // conversationの値をRefに同期
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // エージェントのターン処理（実際の処理）
  const processAgentTurnInternal = async (agentId: string) => {
    console.log(`🎯 Processing turn for agent: ${agentId}, isRunning:`, isRunningRef.current);
    
    const agent = agents.find(a => a.id === agentId);
    if (!agent) {
      console.error(`Agent not found: ${agentId}`);
      return;
    }

    // 最新のconversation stateをRefから取得
    const currentConversation = conversationRef.current;
    
    console.log(`🎯 Agent details: ${agent.name} (${agentId})`);
    console.log(`📄 Current document content: "${documentContent.substring(0, 100)}..."`);
    console.log(`💬 Current conversation length: ${currentConversation.length} turns`);
    console.log(`💬 Real conversation (non-thinking) length: ${currentConversation.filter(t => !t.isThinking).length} turns`);
    
    // 考え中の状態を表示
    setThinkingAgentId(agentId);
    const thinkingTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      speaker: agentId,
      message: '発言中...',
      timestamp: new Date(),
      isThinking: true
    };
    setConversation(prev => [...prev, thinkingTurn]);

    try {
      // thinking状態でない全ての発言を取得
      const realMessages = currentConversation.filter(turn => !turn.isThinking);
      
      console.log(`📊 Building messages for ${agent.name}:`);
      console.log(`   Total turns in conversation: ${currentConversation.length}`);
      console.log(`   Real messages (non-thinking): ${realMessages.length}`);
      
      console.log(`📝 Preparing request for ${agent.name}:`);
      console.log(`  Document length: ${documentContent.length} chars`);
      console.log(`  Conversation history: ${realMessages.length} messages`);
      
      // メッセージ配列を構築（ChatCompletions API形式）
      const messages = [
        { 
          role: 'system' as const, 
          content: agent.systemPrompt 
        },
        {
          role: 'user' as const,
          content: `【現在のドキュメント】\n${documentContent}\n\n` +
                   (realMessages.length > 0 ? 
                     `【これまでの会話】\n${realMessages.map(turn => {
                       if (turn.speaker === 'user') {
                         const targetName = turn.targetAgent ? agents.find(a => a.id === turn.targetAgent)?.name : null;
                         return targetName 
                           ? `ユーザー → ${targetName}: ${turn.message}`
                           : `ユーザー: ${turn.message}`;
                       } else if (turn.speaker === 'system') {
                         return `[システム] ${turn.message}`;
                       } else {
                         const agentName = agents.find(a => a.id === turn.speaker)?.name || turn.speaker;
                         return `${agentName}: ${turn.message}`;
                       }
                     }).join('\n')}\n\n` : '') +
                   (realMessages.length > 0 
                     ? 'この会話の続きから、あなたの番です。必ず respond_to_conversation 関数を使って応答してください。'
                     : '創作について自由に議論を始めてください。必要に応じてドキュメントを編集できます。必ず respond_to_conversation 関数を使って応答してください。')
        }
      ];

      // デバッグ用：実際のメッセージ内容を出力
      console.log('📋 Full messages being sent:');
      messages.forEach((msg, index) => {
        console.log(`  [${index}] Role: ${msg.role}`);
        console.log(`       Content: ${msg.content.substring(0, 200)}...`);
      });

      // Function callingのツール定義
      const tools = [{
        type: "function" as const,
        name: "respond_to_conversation",
        description: "Respond to the conversation with a message and optional document action",
        parameters: {
          type: "object",
          properties: {
            speaker: {
              type: "string",
              description: "The ID of the agent speaking"
            },
            message: {
              type: "string",
              description: "The message content"
            },
            next_speaker: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["specific", "random", "user"],
                  description: "Type of next speaker selection"
                },
                agent: {
                  type: ["string", "null"],
                  description: "Agent ID when type is specific (null when type is not specific)"
                }
              },
              required: ["type", "agent"],
              additionalProperties: false
            },
            document_action: {
              type: ["object", "null"],
              properties: {
                type: {
                  type: "string",
                  enum: ["edit", "append", "request_edit"],
                  description: "Type of document action"
                },
                content: {
                  type: ["string", "null"],
                  description: "Content for the action"
                },
                target_agent: {
                  type: ["string", "null"],
                  description: "Target agent for request_edit"
                }
              },
              required: ["type", "content", "target_agent"],
              additionalProperties: false
            }
          },
          required: ["speaker", "message", "next_speaker"],
          additionalProperties: false
        },
        strict: true
      }];

      // APIリクエストペイロードを構築（新しいResponses API形式）
      const requestPayload = {
        model: 'gpt-4.1',
        input: messages,
        tools: tools,
        tool_choice: {
          type: "function" as const,
          name: "respond_to_conversation"
        }
      };
      
      // リクエストペイロードをコンソールに出力
      console.log('🚀 API Request Payload:');
      console.log(JSON.stringify(requestPayload, null, 2));
      
      const response = await (openai as any).responses.create(requestPayload);

      console.log(`🔄 Response from OpenAI:`, response);
      
      // トークン使用量を表示（Responses APIの場合はusageフィールドがある場合のみ）
      if (response.usage) {
        console.log(`📊 Token usage:`);
        console.log(`  Prompt tokens: ${response.usage.prompt_tokens}`);
        console.log(`  Completion tokens: ${response.usage.completion_tokens}`);
        console.log(`  Total tokens: ${response.usage.total_tokens}`);
        
        // トークン数が多い場合の警告
        if (response.usage.total_tokens > 100000) {
          console.warn(`⚠️ Token usage is high! Consider clearing old conversation history.`);
        }
      }
      
      let agentResponse: AgentResponse;
      
      // Responses APIのレスポンス処理
      console.log(`📄 Raw response:`, response);
      
      // outputがfunction_callの配列として返ってくる
      if (response.output && Array.isArray(response.output) && response.output.length > 0) {
        const functionCall = response.output[0];
        console.log(`🔧 Function call:`, functionCall);
        
        if (functionCall.type === 'function_call' && functionCall.arguments) {
          try {
            const functionArgs = JSON.parse(functionCall.arguments);
            agentResponse = functionArgs as AgentResponse;
            console.log(`📦 Parsed agent response:`, agentResponse);
          } catch (parseError) {
        console.error(`❌ JSON Parse Error:`, parseError);
            console.error(`Raw arguments that failed to parse:`, functionCall.arguments);
        
            // フォールバック応答を作成
            agentResponse = {
              speaker: agentId,
              message: response.output_text || 'エラーが発生しました',
              next_speaker: {
                type: 'random'
              }
            };
        console.log(`🔧 Using fallback response:`, agentResponse);
      }
      
      // ドキュメントアクションの処理
      if (agentResponse.document_action !== null) {
        const action = agentResponse.document_action;
        const agent = agents.find(a => a.id === agentId);
        console.log(`📄 Document action detected:`, action);
        
        if (action.type === 'edit' && agent?.canEdit && action.content !== null) {
          // 編集権限がある場合、ドキュメントを更新
          console.log(`✏️ ${agent.name} is editing the document`);
          setDocumentContent(action.content);
        } else if (action.type === 'append' && agent?.canEdit && action.content !== null) {
          // 追記権限がある場合、ドキュメントに追記
          console.log(`➕ ${agent.name} is appending to the document`);
          setDocumentContent(prev => prev + '\n\n' + action.content);
        } else if (action.type === 'request_edit' && action.target_agent !== null && action.content !== null) {
          // 編集リクエストの場合、メッセージに含める
          console.log(`📨 ${agent?.name} is requesting edit from ${action.target_agent}`);
          agentResponse.message += `\n\n【編集リクエスト → ${action.target_agent}】\n${action.content}`;
        }
      }
      
      // 考え中の状態を削除して、実際の発言に置き換える
      setThinkingAgentId(null);
      
      // 新しいターンを作成
      const newTurn: ConversationTurn = {
        id: crypto.randomUUID(),
        speaker: agentId,
        message: agentResponse.message,
        timestamp: new Date(),
        documentAction: agentResponse.document_action
      };
      
      // conversationを更新し、refも即座に更新
      setConversation(prev => {
        // 最後のthinkingメッセージを削除
        const filtered = prev.filter(turn => !(turn.speaker === agentId && turn.isThinking));
        const newConversation = [...filtered, newTurn];
        // refも即座に更新
        conversationRef.current = newConversation;
        return newConversation;
      });

      // 次の発言者を決定
      console.log('🔍 Checking if conversation should continue. isRunningRef:', isRunningRef.current);
      if (isRunningRef.current) {
        // next_speakerが存在しない場合のフォールバック
        if (!agentResponse.next_speaker) {
          console.warn('⚠️ next_speaker is undefined, selecting random agent');
          const randomAgent = agents[Math.floor(Math.random() * agents.length)];
          conversationQueue.enqueue({
            type: 'agent_turn',
            agentId: randomAgent.id
          });
          return;
        }

        if (agentResponse.next_speaker.type === 'user') {
          // ユーザーの番
          console.log(`👤 Next speaker: User`);
          setWaitingForUser(true);
        } else {
          let nextAgentId: string | undefined;
          
          if (agentResponse.next_speaker.type === 'specific' && agentResponse.next_speaker.agent !== null) {
            nextAgentId = agentResponse.next_speaker.agent;
          } else {
            // randomまたはagentがnullの場合
            nextAgentId = agents[Math.floor(Math.random() * agents.length)].id;
          }
          
          // 次のエージェントが存在するか確認
          const nextAgent = agents.find(a => a.id === nextAgentId);
          if (!nextAgent) {
            console.error(`❌ Next agent not found: ${nextAgentId}`);
            nextAgentId = agents[Math.floor(Math.random() * agents.length)].id;
          }
          
          console.log(`🎯 Next speaker: ${agents.find(a => a.id === nextAgentId)?.name} (${nextAgentId})`);
          
          // 次のエージェントのターンをキューに追加
          if (agentDelay > 0) {
            // 遅延がある場合
            setTimeout(() => {
              conversationQueue.enqueue({
                type: 'agent_turn',
                agentId: nextAgentId!
              });
            }, agentDelay);
          } else {
            // 遅延なしの場合は即座にキューに追加
            conversationQueue.enqueue({
              type: 'agent_turn',
              agentId: nextAgentId!
            });
          }
        }
        } else {
          console.log('🛑 Conversation stopped (isRunningRef.current is false)');
        }
        } else {
          // function_callでない場合のフォールバック
          console.warn(`⚠️ No function call in response, using fallback`);
          agentResponse = {
            speaker: agentId,
            message: response.output_text || 'エラーが発生しました',
            next_speaker: {
              type: 'random'
            }
          };
        }
      } else {
        // outputがない場合のフォールバック
        console.warn(`⚠️ No output in response, using fallback`);
        agentResponse = {
          speaker: agentId,
          message: response.output_text || 'エラーが発生しました',
          next_speaker: {
            type: 'random'
          }
        };
      }
    } catch (error) {
      console.error('❌ Error in agent turn:', error);
      console.error('Error details:', {
        agentId,
        agentName: agent?.name,
        error: error instanceof Error ? error.message : error
      });
      
      // エラー時も考え中の状態を削除
      setThinkingAgentId(null);
      setConversation(prev => {
        // 最後のthinkingメッセージを削除
        const filtered = prev.filter(turn => !(turn.speaker === agentId && turn.isThinking));
        // エラーメッセージを追加
        const errorTurn: ConversationTurn = {
          id: crypto.randomUUID(),
          speaker: 'system',
          message: `エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
          timestamp: new Date()
        };
        const newConversation = [...filtered, errorTurn];
        // refも即座に更新
        conversationRef.current = newConversation;
        return newConversation;
      });
      
      setIsRunning(false);
    }
  };

  // エージェントのターン処理（キューに追加）
  const processAgentTurn = (agentId: string) => {
    conversationQueue.enqueue({
      type: 'agent_turn',
      agentId
    });
  };

  // キューイベントハンドラーの設定
  useEffect(() => {
    conversationQueue.setEventHandler(async (event: QueueEvent) => {
      if (event.type === 'agent_turn') {
        await processAgentTurnInternal(event.agentId);
      }
    });
    
    // キュー変更通知の設定
    conversationQueue.setOnQueueChange((length) => {
      setQueueLength(length);
    });
  }, [conversationQueue]);

  // ユーザータイムアウト処理
  const handleUserTimeout = () => {
    setWaitingForUser(false);
    
    // 観察モードでなければシステムメッセージを追加
    if (!observerMode) {
      const timeoutMessage: ConversationTurn = {
        id: crypto.randomUUID(),
        speaker: 'system',
        message: '（ユーザーからの応答がなかったため、会話を続けます）',
        timestamp: new Date()
      };
      setConversation(prev => {
        const newConversation = [...prev, timeoutMessage];
        // refも即座に更新
        conversationRef.current = newConversation;
        return newConversation;
      });
    }
    
    // ランダムなエージェントが発言（isRunningがtrueの場合のみ）
    if (isRunningRef.current) {
      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      processAgentTurn(randomAgent.id);
    }
  };

  // 会話の開始/停止
  const toggleConversation = () => {
    if (!isRunning) {
      console.log('🚀 Starting conversation');
      setIsRunning(true);
      isRunningRef.current = true; // Refも即座に更新
      setWaitingForUser(false);
      
      // キューをクリア
      conversationQueue.clear();
      
      // ランダムなエージェントから開始
      const startAgent = agents[Math.floor(Math.random() * agents.length)];
      console.log(`🎯 Starting with agent: ${startAgent.name}`);
      
      // 最初のエージェントをキューに追加
      processAgentTurn(startAgent.id);
    } else {
      console.log('🛑 Stopping conversation');
      setIsRunning(false);
      isRunningRef.current = false; // Refも即座に更新
      setWaitingForUser(false);
      
      // キューをクリア
      conversationQueue.clear();
    }
  };

  // ユーザー入力の処理
  const handleUserInput = async () => {
    if (!userInput.trim()) return;

    // ユーザー待機状態を解除
    setWaitingForUser(false);

    // ユーザーの発言を追加
    const userTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      speaker: 'user',
      message: userInput,
      targetAgent: targetAgent !== 'random' ? targetAgent : undefined,
      timestamp: new Date()
    };

    setConversation(prev => {
      const newConversation = [...prev, userTurn];
      // refも即座に更新
      conversationRef.current = newConversation;
      return newConversation;
    });
    setUserInput('');

    // 対象エージェントを決定
    const respondingAgentId = targetAgent === 'random' 
      ? agents[Math.floor(Math.random() * agents.length)].id
      : targetAgent;

    // エージェントの応答を生成（previousInputは渡さず、processAgentTurn内でコンテキストを構築）
    processAgentTurn(respondingAgentId);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 左側: チャット */}
      <div className="flex-1 flex flex-col">
        {/* ヘッダー */}
        <header className="bg-white shadow-sm px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">マルチエージェント会話デモ</h1>
              {queueLength > 0 && (
                <span className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                  キュー: {queueLength}件待機中
                </span>
              )}
            </div>
          </div>
        </header>

        {/* 会話ログ */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {conversation.map((turn) => {
              const agent = agents.find(a => a.id === turn.speaker);
              const isUser = turn.speaker === 'user';
              const isSystem = turn.speaker === 'system';
              
              return (
                <div key={turn.id} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    {isUser ? '👤' : isSystem ? '⚙️' : agent?.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold">
                        {isUser ? 'あなた' : isSystem ? 'システム' : agent?.name}
                      </span>
                      {agent?.canEdit && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          編集可
                        </span>
                      )}
                      {turn.targetAgent && isUser && (
                        <span className="text-sm text-gray-500">
                          → {agents.find(a => a.id === turn.targetAgent)?.name}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {turn.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div className={`rounded-lg p-3 shadow-sm ${
                      isSystem ? 'bg-gray-100 text-gray-600 italic' : 
                      turn.isThinking ? 'bg-blue-50 border border-blue-200' : 
                      'bg-white'
                    }`}>
                      {turn.isThinking ? (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-blue-700">{turn.message}</span>
                        </div>
                      ) : (
                        turn.message
                      )}
                    </div>
                    {/* ドキュメントアクションの表示 */}
                    {turn.documentAction && (
                      <div className="mt-2">
                        {turn.documentAction.type === 'edit' && (
                          <div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 p-2 rounded">
                            <span>✏️ ドキュメントを編集しました</span>
                          </div>
                        )}
                        {turn.documentAction.type === 'append' && (
                          <div className="flex items-center gap-2 text-sm bg-green-50 text-green-700 p-2 rounded">
                            <span>➕ ドキュメントに追記しました</span>
                          </div>
                        )}
                        {turn.documentAction.type === 'request_edit' && (
                          <div className="flex items-center gap-2 text-sm bg-yellow-50 text-yellow-700 p-2 rounded">
                            <span>📨 {agents.find(a => a.id === turn.documentAction?.target_agent)?.name}に編集を依頼しました</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={conversationEndRef} />
          </div>
        </div>

        {/* 入力エリア */}
        <div className="bg-white border-t p-4">
          <div className="max-w-4xl mx-auto">
            {/* コントロールパネル */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    AI応答速度:
                  </label>
                  <select
                    value={agentDelay}
                    onChange={(e) => setAgentDelay(Number(e.target.value))}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value={0}>即座</option>
                    <option value={500}>0.5秒</option>
                    <option value={1000}>1秒</option>
                    <option value={1500}>1.5秒</option>
                    <option value={2000}>2秒</option>
                    <option value={3000}>3秒</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={observerMode}
                    onChange={(e) => setObserverMode(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    観察モード（発言しない）
                  </span>
                </label>
              </div>
              <button
                onClick={toggleConversation}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isRunning 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isRunning ? '会話を停止' : '会話を開始'}
              </button>
            </div>
            {waitingForUser && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <span className="text-blue-700 font-medium">
                  {observerMode ? '🔍 観察モード: エージェントの会話が自動継続されます' : '🎯 あなたの番です！発言してください'}
                </span>
                {!observerMode && (
                  <span className="text-blue-600 text-sm">
                    残り時間: {userTimeoutSeconds}秒
                    {userInput && ' (入力中...)'}
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <select
                value={targetAgent}
                onChange={(e) => setTargetAgent(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              >
                <option value="random">TO: 誰でも</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    TO: {agent.avatar} {agent.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleUserInput()}
                placeholder="メッセージを入力..."
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleUserInput}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                送信
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 右側: エディタ */}
      <div className="w-1/2 flex flex-col bg-white border-l">
        {/* エディタヘッダー */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold">📄 ドキュメントエディタ</h2>
        </div>
        
        {/* エディタ本体 */}
        <div className="flex-1 p-6">
          <textarea
            value={documentContent}
            onChange={(e) => setDocumentContent(e.target.value)}
            className="w-full h-full p-4 border rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ここに小説を書いてください..."
          />
        </div>
      </div>
    </div>
  );
}

export default App;