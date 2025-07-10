import { useState, useEffect, useRef } from 'react';
import { openai } from './openai-client';
import { agents } from './agents';
import { ConversationTurn, AgentResponse } from './types';

function App() {
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [currentResponseId, setCurrentResponseId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [targetAgent, setTargetAgent] = useState<string>('random');
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [userTimeoutSeconds, setUserTimeoutSeconds] = useState(30); // カウントダウン用
  const [observerMode, setObserverMode] = useState(false); // 観察モード
  const [agentDelay, setAgentDelay] = useState(0); // エージェント間の遅延（ミリ秒）
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const userTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // エージェントのターン処理
  const processAgentTurn = async (agentId: string, previousInput?: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    try {
      const input = previousInput || 
        (conversation.length > 0 
          ? `[前の発言者: ${conversation[conversation.length - 1].speaker}]\n${conversation[conversation.length - 1].message}\n\n必ずJSON形式で応答してください。`
          : '創作について自由に議論を始めてください。必ずJSON形式で応答してください。');

      const response = await openai.responses.create({
        model: 'gpt-4o',
        instructions: agent.systemPrompt,
        input,
        previous_response_id: currentResponseId || undefined,
        text: {
          format: {
            type: 'json_object'
          }
        }
      });

      const agentResponse: AgentResponse = JSON.parse(response.output_text || '{}');
      
      // 会話に追加
      const turn: ConversationTurn = {
        id: crypto.randomUUID(),
        speaker: agentId,
        message: agentResponse.message,
        responseId: response.id,
        timestamp: new Date()
      };

      setConversation(prev => [...prev, turn]);
      setCurrentResponseId(response.id);

      // 次の発言者を決定
      if (isRunning) {
        if (agentResponse.next_speaker.type === 'user') {
          // ユーザーの番
          setWaitingForUser(true);
        } else {
          const nextAgentId = agentResponse.next_speaker.type === 'specific' 
            ? agentResponse.next_speaker.agent 
            : agents[Math.floor(Math.random() * agents.length)].id;
          
          // 設定された遅延後に次のエージェントのターンを処理
          if (agentDelay > 0) {
            setTimeout(() => {
              if (isRunning) {
                processAgentTurn(nextAgentId);
              }
            }, agentDelay);
          } else {
            // 遅延なしの場合は即座に処理
            if (isRunning) {
              processAgentTurn(nextAgentId);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in agent turn:', error);
      setIsRunning(false);
    }
  };

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
      setConversation(prev => [...prev, timeoutMessage]);
    }
    
    // ランダムなエージェントが発言
    const randomAgent = agents[Math.floor(Math.random() * agents.length)];
    const prompt = observerMode 
      ? '続けて話しましょう。' 
      : '少し沈黙がありましたが、話を続けましょう。';
    processAgentTurn(randomAgent.id, prompt);
  };

  // 会話の開始/停止
  const toggleConversation = () => {
    if (!isRunning) {
      setIsRunning(true);
      setWaitingForUser(false);
      // ランダムなエージェントから開始
      const startAgent = agents[Math.floor(Math.random() * agents.length)];
      processAgentTurn(startAgent.id);
    } else {
      setIsRunning(false);
      setWaitingForUser(false);
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

    setConversation(prev => [...prev, userTurn]);
    setUserInput('');

    // 対象エージェントを決定
    const respondingAgentId = targetAgent === 'random' 
      ? agents[Math.floor(Math.random() * agents.length)].id
      : targetAgent;

    const targetAgentName = agents.find(a => a.id === respondingAgentId)?.name;
    const formattedInput = targetAgent === 'random'
      ? `[ユーザーからの発言]\n${userInput}`
      : `[ユーザーから${targetAgentName}への発言]\n${userInput}`;

    // エージェントの応答を生成
    processAgentTurn(respondingAgentId, formattedInput);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col">
        {/* ヘッダー */}
        <header className="bg-white shadow-sm px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">マルチエージェント会話デモ</h1>
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
                      isSystem ? 'bg-gray-100 text-gray-600 italic' : 'bg-white'
                    }`}>
                      {turn.message}
                    </div>
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
            <div className="flex gap-2 mb-2">
              <select
                value={targetAgent}
                onChange={(e) => setTargetAgent(e.target.value)}
                className="px-3 py-1 border rounded-lg text-sm"
              >
                <option value="random">誰でも</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.avatar} {agent.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
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
    </div>
  );
}

export default App;