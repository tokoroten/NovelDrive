import { useEffect, useRef, useMemo, useState } from 'react';
import { ConversationTurn, AgentResponse } from './types';
import { ConversationQueue, QueueEvent } from './ConversationQueue';
import { useAppStore } from './store';
import { getCurrentProvider, isProviderConfigured } from './llm';
import { Settings } from './components/Settings';
import { SessionHistory } from './components/SessionHistory';
import { VersionTimeline } from './components/VersionTimeline';
import { Sidebar } from './components/Sidebar';
import { AgentManager } from './components/AgentManager';
import { Help } from './components/Help';
import { sessionService } from './db';
import { Session } from './db/schema';

function App() {
  // 起動時のデバッグログ
  console.log('🚀 App starting...');
  console.log('📦 LocalStorage noveldrive-llm-model:', localStorage.getItem('noveldrive-llm-model'));
  console.log('📦 LocalStorage noveldrive-llm-provider:', localStorage.getItem('noveldrive-llm-provider'));
  console.log('📦 All LocalStorage keys:', Object.keys(localStorage).filter(k => k.startsWith('noveldrive-')));
  
  // Zustandストアから状態を取得 - v2 fix for cache issues
  const {
    agents,
    conversation,
    addConversationTurn,
    updateConversation,
    activeAgentIds,
    toggleAgent,
    documentContent,
    setDocumentContent,
    isRunning,
    setIsRunning,
    waitingForUser,
    setWaitingForUser,
    userTimeoutSeconds,
    setUserTimeoutSeconds,
    observerMode,
    setObserverMode,
    agentDelay,
    setAgentDelay,
    thinkingAgentId,
    setThinkingAgentId,
    queueLength,
    setQueueLength,
    userInput,
    setUserInput,
    targetAgent,
    setTargetAgent,
    currentSessionId,
    setCurrentSessionId,
    sessionTitle,
    setSessionTitle,
  } = useAppStore();
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 設定画面の表示状態
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showVersionTimeline, setShowVersionTimeline] = useState(false);
  const [showAgentManagerModal, setShowAgentManagerModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  
  // 会話キューの作成
  const conversationQueue = useMemo(() => new ConversationQueue(), []);
  
  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + B: サイドバーのトグル
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // APIキーが設定されているかチェック
  useEffect(() => {
    if (!isProviderConfigured()) {
      console.warn('⚠️ LLMプロバイダーが設定されていません。設定画面からAPIキーを入力してください。');
    }
  }, []);

  // 初期化: セッションの作成または復元
  useEffect(() => {
    let isMounted = true;
    const initSession = async () => {
      if (!currentSessionId && isMounted) {
        // 既存のセッションがあるか確認
        const existingSessions = await sessionService.getAllSessions();
        if (existingSessions.length > 0 && isMounted) {
          // 最新のセッションを使用
          const latestSession = existingSessions[0];
          setCurrentSessionId(latestSession.id);
          setSessionTitle(latestSession.title);
          setDocumentContent(latestSession.documentContent);
          updateConversation(() => latestSession.conversation);
          sessionService.setCurrentSessionId(latestSession.id);
        } else if (isMounted) {
          // 新しいセッションを作成
          const session = await sessionService.createSession();
          setCurrentSessionId(session.id);
          setSessionTitle(session.title);
          sessionService.setCurrentSessionId(session.id);
        }
      }
    };
    initSession();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // 自動保存（conversation, documentContent, activeAgentIdsが変更されたとき）
  useEffect(() => {
    if (!currentSessionId) return;

    const saveTimer = setTimeout(async () => {
      try {
        await sessionService.updateSession(currentSessionId, {
          documentContent,
          conversation,
          activeAgentIds,
          metadata: {
            characterCount: documentContent.length,
            totalTokens: conversation.reduce((sum, turn) => 
              sum + (turn.tokenUsage?.total_tokens || 0), 0
            ),
          },
        });
        console.log('✅ Session auto-saved');
      } catch (error) {
        console.error('Failed to auto-save session:', error);
      }
    }, 1000); // 1秒のデバウンス

    return () => clearTimeout(saveTimer);
  }, [conversation, documentContent, activeAgentIds, currentSessionId]);
  
  // 自動タイトル生成（1000文字を超えたとき）
  useEffect(() => {
    if (!currentSessionId || !documentContent || documentContent.length < 1000) return;
    
    // タイトルがまだデフォルトの場合のみ自動生成
    if (sessionTitle && !sessionTitle.includes('新しい作品')) return;
    
    // 既に生成中の場合はスキップ
    if (isGeneratingTitle) return;
    
    generateTitle();
  }, [documentContent, currentSessionId, sessionTitle]);
  
  // タイトルを生成する関数
  const generateTitle = async () => {
    if (!documentContent || documentContent.trim().length === 0) return;
    
    setIsGeneratingTitle(true);
    try {
      const provider = getCurrentProvider();
      if (!provider || !provider.isConfigured()) {
        console.warn('⚠️ LLMプロバイダーが設定されていません');
        return;
      }
      
      const currentModel = useAppStore.getState().llmModel;
      console.log(`🏷️ Generating title with: ${provider.name}, Model: ${currentModel}`);
      
      const messages = [
        {
          role: 'system' as const,
          content: 'あなたはプロの編集者です。与えられた小説の内容から、魅力的で簡潔なタイトルを提案してください。'
        },
        {
          role: 'user' as const,
          content: `以下の小説の内容を読んで、適切なタイトルを一つだけ提案してください。タイトルのみを返答し、それ以外の説明は不要です。

${documentContent.substring(0, 2000)}`
        }
      ];
      
      const response = await provider.createResponse(
        messages,
        [],
        { type: 'none' }
      );
      
      if (response.output_text && response.output_text.trim()) {
        const newTitle = response.output_text.trim().replace(/[「」“”"']/g, '');
        setSessionTitle(newTitle);
        
        // セッションを更新
        if (currentSessionId) {
          await sessionService.updateSession(currentSessionId, {
            title: newTitle
          });
        }
      }
    } catch (error) {
      console.error('Failed to generate title:', error);
    } finally {
      setIsGeneratingTitle(false);
    }
  };
  
  // タイトル編集を保存
  const saveTitle = async () => {
    if (!currentSessionId || !editingTitle.trim()) return;
    
    setSessionTitle(editingTitle);
    setIsEditingTitle(false);
    
    // セッションを更新
    try {
      await sessionService.updateSession(currentSessionId, {
        title: editingTitle
      });
    } catch (error) {
      console.error('Failed to save title:', error);
    }
  };
  
  // アクティブなエージェントのみを取得
  // const activeAgents = useMemo(() => {
  //   return agents.filter(agent => activeAgentIds.includes(agent.id));
  // }, [agents, activeAgentIds]);

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
        const currentTimeout = useAppStore.getState().userTimeoutSeconds;
        
        // ユーザーが入力中の場合はカウントダウンをリセット
        if (userInput.trim().length > 0) {
          setUserTimeoutSeconds(30);
          return;
        }
        
        if (currentTimeout <= 1) {
          // タイムアウト：ランダムなエージェントが発言
          handleUserTimeout();
          setUserTimeoutSeconds(30);
        } else {
          setUserTimeoutSeconds(currentTimeout - 1);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setUserTimeoutSeconds(30);
    }
  }, [waitingForUser, isRunning, observerMode, userInput]);


  // エージェントのターン処理（実際の処理）
  const processAgentTurnInternal = async (agentId: string, requestSessionId: string) => {
    // 現在の状態を取得
    const currentState = useAppStore.getState();
    const currentSessionId = currentState.currentSessionId;
    const currentIsRunning = currentState.isRunning;
    const currentActiveAgentIds = currentState.activeAgentIds;
    const currentConversation = Array.isArray(currentState.conversation) ? currentState.conversation : [];
    const currentDocumentContent = currentState.documentContent;
    
    console.log(`🎯 Processing turn for agent: ${agentId}, session: ${requestSessionId}, isRunning:`, currentIsRunning);
    
    // セッションIDが一致しない場合は処理をスキップ
    if (currentSessionId !== requestSessionId) {
      console.log(`⚠️ Session ID mismatch. Current: ${currentSessionId}, Request: ${requestSessionId}. Skipping.`);
      return;
    }
    console.log('🔍 Debug - localStorage active agents:', localStorage.getItem('noveldrive-active-agents'));
    
    // 会議が停止されている場合は処理を中止
    if (!currentIsRunning) {
      console.log('🛑 Conversation stopped, skipping agent turn');
      return;
    }
    
    // 最新のアクティブエージェントを取得
    console.log('🔍 Debug - currentActiveAgentIds:', currentActiveAgentIds);
    console.log('🔍 Debug - currentActiveAgentIds (detailed):', JSON.stringify(currentActiveAgentIds));
    console.log('🔍 Debug - Looking for agent:', agentId);
    console.log('🔍 Debug - All agents:', agents.map(a => a.id));
    const currentActiveAgents = agents.filter(agent => currentActiveAgentIds.includes(agent.id));
    console.log('🔍 Debug - Active agents:', currentActiveAgents.map(a => a.id));
    console.log('🔍 Debug - Active agents (detailed):', JSON.stringify(currentActiveAgents.map(a => ({ id: a.id, name: a.name }))));
    const agent = currentActiveAgents.find(a => a.id === agentId);
    if (!agent) {
      console.error(`Agent not found: ${agentId}`);
      console.error('Available active agents:', currentActiveAgents.map(a => a.id));
      // エージェントが見つからない場合、システムメッセージを追加
      const missingAgentName = agents.find(a => a.id === agentId)?.name || agentId;
      const systemMessage: ConversationTurn = {
        id: crypto.randomUUID(),
        speaker: 'system',
        message: `（${missingAgentName}は現在会話に参加していません。会話中にエージェントが変更されました）`,
        timestamp: new Date()
      };
      console.log('🔍 Debug - Adding system message, current conversation length:', currentConversation.length);
      updateConversation(prev => {
        console.log('🔍 Debug - prev conversation in updateConversation:', prev);
        return [...prev, systemMessage];
      });
      
      // ランダムなアクティブエージェントを選択して続行
      if (currentActiveAgents.length > 0 && currentIsRunning) {
        const randomAgent = currentActiveAgents[Math.floor(Math.random() * currentActiveAgents.length)];
        console.log(`🔄 Selecting random active agent: ${randomAgent.name}`);
        processAgentTurn(randomAgent.id);
      }
      return;
    }

    
    console.log(`🎯 Agent details: ${agent.name} (${agentId})`);
    console.log(`📄 Current document content: "${currentDocumentContent.substring(0, 100)}..."`);
    const safeConversation = Array.isArray(currentConversation) ? currentConversation : [];
    console.log(`💬 Current conversation length: ${safeConversation.length} turns`);
    console.log(`💬 Real conversation (non-thinking) length: ${safeConversation.filter(t => !t.isThinking).length} turns`);
    
    // 考え中の状態を表示
    setThinkingAgentId(agentId);
    const thinkingTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      speaker: agentId,
      message: '発言中...',
      timestamp: new Date(),
      isThinking: true
    };
    addConversationTurn(thinkingTurn);

    try {
      // API呼び出し前に再度isRunningをチェック
      if (!useAppStore.getState().isRunning) {
        console.log('🛑 Conversation stopped before API call, skipping');
        setThinkingAgentId(null);
        updateConversation(prev => prev.filter(turn => !(turn.speaker === agentId && turn.isThinking)));
        return;
      }
      
      // thinking状態でない全ての発言を取得
      const realMessages = safeConversation.filter(turn => !turn.isThinking);
      
      console.log(`📊 Building messages for ${agent.name}:`);
      console.log(`   Total turns in conversation: ${safeConversation.length}`);
      console.log(`   Real messages (non-thinking): ${realMessages.length}`);
      
      console.log(`📝 Preparing request for ${agent.name}:`);
      console.log(`  Document length: ${currentDocumentContent.length} chars`);
      console.log(`  Conversation history: ${realMessages.length} messages`);
      
      // 参加エージェント情報を生成
      const participatingAgents = currentActiveAgents.map(a => 
        `- ${a.name} (${a.id}): ${a.title}${a.canEdit ? ' [編集権限あり]' : ''}`
      ).join('\n');

      // メッセージ配列を構築（ChatCompletions API形式）
      const messages = [
        { 
          role: 'system' as const, 
          content: agent.systemPrompt + '\n\n【現在参加中のエージェント】\n' + participatingAgents + '\n\n重要: 上記のエージェントのみが会話に参加しています。これら以外のエージェントを指定しないでください。\n\n【ドキュメント編集の注意事項】\n- document_actionオブジェクトには必ず全てのフィールド(type, contents, diffs, content, target_agent)を含めてください。\n- 使用しないフィールドは空の値(contents=[], diffs=[], content="", target_agent="")にしてください。\n\n【編集タイプ】\n- "none": 編集なし。全フィールドを空にする。\n- "append": 既存のドキュメントの末尾に追記。contentsフィールドのみ使用。\n  例: {type: "append", contents: ["第1段落", "第2段落"], diffs: [], content: "", target_agent: ""}\n- "diff": 特定の箇所を差分更新。diffsフィールドのみ使用。\n  例: {type: "diff", contents: [], diffs: [{oldText: "変更前", newText: "変更後"}], content: "", target_agent: ""}\n- "request_edit": 他のエージェントに編集依頼。contentとtarget_agentフィールドを使用。\n  例: {type: "request_edit", contents: [], diffs: [], content: "編集依頼内容", target_agent: "agent_id"}\n\n【diff使用時の重要な注意】\n- oldTextは現在のドキュメントと完全に一致する必要があります（改行、スペース含む）\n- 削除する場合はnewTextを空文字("")にします\n- 全体の書き直しは禁止されています。必ず"append"または"diff"を使用してください。'
        },
        {
          role: 'user' as const,
          content: (realMessages.length > 0 ? 
                     `# これまでの会話\n\n${realMessages.map(turn => {
                       if (turn.speaker === 'user') {
                         const targetName = turn.targetAgent ? currentActiveAgents.find(a => a.id === turn.targetAgent)?.name : null;
                         return targetName 
                           ? `## 👤 ユーザー → ${targetName}\n\n${turn.message}\n`
                           : `## 👤 ユーザー\n\n${turn.message}\n`;
                       } else if (turn.speaker === 'system') {
                         return `## ⚙️ システム\n\n*${turn.message}*\n`;
                       } else {
                         const agentName = currentActiveAgents.find(a => a.id === turn.speaker)?.name || turn.speaker;
                         const agent = currentActiveAgents.find(a => a.id === turn.speaker);
                         const emoji = agent?.avatar || '💬';
                         return `## ${emoji} ${agentName}\n\n${turn.message}\n`;
                       }
                     }).join('\n---\n\n')}\n\n---\n\n` : '') +
                   `# 現在のドキュメント\n\n**文字数: ${currentDocumentContent.length}文字**\n\n\`\`\`markdown\n${currentDocumentContent}\n\`\`\`\n\n` +
                   (realMessages.length > 0 
                     ? '上記の会話を踏まえて、あなたの番です。必要に応じてドキュメントを確認・編集してください。必ず respond_to_conversation 関数を使って応答してください。'
                     : '現在のドキュメントを確認し、創作について自由に議論を始めてください。必要に応じて編集できます。必ず respond_to_conversation 関数を使って応答してください。')
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
        type: 'function' as const,
        name: 'respond_to_conversation',
        description: 'Respond to the conversation with a message and optional document action',
        parameters: {
          type: 'object' as const,
          properties: {
            speaker: {
              type: 'string',
              description: 'The ID of the agent speaking'
            },
            message: {
              type: 'string',
              description: 'The message content'
            },
            next_speaker: {
              type: 'object' as const,
              properties: {
                type: {
                  type: 'string',
                  enum: ['specific', 'random', 'user'],
                  description: 'Type of next speaker selection'
                },
                agent: {
                  type: ['string', 'null'],
                  enum: [...currentActiveAgents.map(a => a.id), null],
                  description: 'Agent ID when type is specific (must be one of the participating agents, null when type is not specific)'
                }
              },
              required: ['type', 'agent'],
              additionalProperties: false
            },
            document_action: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['none', 'diff', 'append', 'request_edit'],
                  description: 'Type of document action (use "none" for no action)'
                },
                contents: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Contents to append (for append type)'
                },
                diffs: {
                  type: 'array',
                  items: {
                    type: 'object' as const,
                    properties: {
                      oldText: { type: 'string' },
                      newText: { type: 'string' }
                    },
                    required: ['oldText', 'newText'],
                    additionalProperties: false
                  },
                  description: 'Diff edits (for diff type)'
                },
                content: {
                  type: 'string',
                  description: 'Content for request_edit'
                },
                target_agent: {
                  type: 'string',
                  enum: [...currentActiveAgents.filter(a => a.canEdit).map(a => a.id), ''],
                  description: 'Target agent for request_edit (must be one of the participating agents with edit permission, empty string if not applicable)'
                }
              },
              required: ['type', 'contents', 'diffs', 'content', 'target_agent'],
              additionalProperties: false,
              description: 'Document action: Always provide all fields. For unused fields: contents=[], diffs=[], content="", target_agent="". Only populate relevant fields based on type.'
            }
          },
          required: ['speaker', 'message', 'next_speaker', 'document_action'],
          additionalProperties: false
        },
        strict: true
      }];

      // 現在のLLMプロバイダーを使用
      const provider = getCurrentProvider();
      
      const currentModel = useAppStore.getState().llmModel;
      console.log(`🤖 Using LLM Provider: ${provider.name}, Model: ${currentModel}`);
      
      // プロバイダーを使ってレスポンスを生成
      const response = await provider.createResponse(
        messages,
        tools,
        { type: 'function', name: 'respond_to_conversation' }
      );

      console.log(`🔄 Response from ${provider.name}:`, response);
      
      // API応答を受け取った後、エージェントがまだアクティブか確認
      const agentStillActive = agents.find(a => a.id === agentId);
      if (!agentStillActive) {
        console.warn(`⚠️ Agent ${agentId} was removed during API call`);
        // 考え中の状態を削除
        setThinkingAgentId(null);
        updateConversation(prev => {
          // 最後のthinkingメッセージを削除
          const filtered = prev.filter(turn => !(turn.speaker === agentId && turn.isThinking));
          const systemMessage: ConversationTurn = {
            id: crypto.randomUUID(),
            speaker: 'system',
            message: `（${agent.name}は応答中に会話から除外されました）`,
            timestamp: new Date()
          };
          const newConversation = [...filtered, systemMessage];
          return newConversation;
        });
        
        // アクティブなエージェントがいる場合は、ランダムに選択して続行
        if (currentActiveAgents.length > 0 && currentIsRunning) {
          const randomAgent = currentActiveAgents[Math.floor(Math.random() * currentActiveAgents.length)];
          console.log(`🔄 Selecting random active agent after removal: ${randomAgent.name}`);
          processAgentTurn(randomAgent.id);
        }
        return;
      }
      
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
                type: 'random',
                agent: null
              },
              document_action: { type: 'none', contents: [], diffs: [], content: '', target_agent: '' }
            };
        console.log(`🔧 Using fallback response:`, agentResponse);
      }
      
      // ドキュメントアクションの処理
      if (agentResponse.document_action && agentResponse.document_action.type !== 'none') {
        const action = agentResponse.document_action;
        const agent = currentActiveAgents.find(a => a.id === agentId);
        console.log(`📄 Document action detected:`, action);
        
        if (action.type === 'append' && agent?.canEdit) {
          // 追記権限がある場合、ドキュメントに追記
          console.log(`➕ ${agent.name} is appending to the document`);
          const currentDoc = useAppStore.getState().documentContent;
          
          // 複数の内容を追記
          if (action.contents && action.contents.length > 0) {
            const newContent = action.contents.join('\n\n');
            const updatedContent = currentDoc + '\n\n' + newContent;
            setDocumentContent(updatedContent);
            
            // バージョンを保存
            if (currentSessionId) {
              sessionService.saveDocumentVersion(
                currentSessionId,
                updatedContent,
                agentId,
                { type: 'append', details: { agent: agent.name } }
              ).catch(error => console.error('Failed to save version:', error));
            }
          }
        } else if (action.type === 'diff' && agent?.canEdit) {
          // 差分更新権限がある場合、ドキュメントを差分更新
          console.log(`✏️ ${agent.name} is updating the document with diffs`);
          const currentDoc = useAppStore.getState().documentContent;
          let updatedDoc = currentDoc;
          
          // 各差分を適用
          if (action.diffs && action.diffs.length > 0) {
            let successfulDiffs = 0;
            let failedDiffs = 0;
            
            action.diffs.forEach((diff, index) => {
              // 完全一致でテキストを探す
              const oldTextIndex = updatedDoc.indexOf(diff.oldText);
              
              if (oldTextIndex !== -1) {
                // テキストが見つかった場合、置換
                updatedDoc = updatedDoc.substring(0, oldTextIndex) + 
                           diff.newText + 
                           updatedDoc.substring(oldTextIndex + diff.oldText.length);
                successfulDiffs++;
                console.log(`✅ Diff ${index + 1} applied successfully`);
              } else {
                // テキストが見つからない場合
                failedDiffs++;
                console.error(`❌ Diff ${index + 1} failed: Could not find exact text to replace`);
                console.error(`   Looking for: "${diff.oldText.substring(0, 50)}${diff.oldText.length > 50 ? '...' : ''}"`);
                
                // 部分一致を試みる（デバッグ用）
                const partialMatch = updatedDoc.includes(diff.oldText.trim());
                if (partialMatch) {
                  console.warn(`   ⚠️ Partial match found (trimmed). The text might have extra spaces or newlines.`);
                }
              }
            });
            
            if (successfulDiffs > 0) {
              setDocumentContent(updatedDoc);
              console.log(`📝 Document updated: ${successfulDiffs} diffs applied, ${failedDiffs} failed`);
              
              // バージョンを保存
              if (currentSessionId) {
                sessionService.saveDocumentVersion(
                  currentSessionId,
                  updatedDoc,
                  agentId,
                  { type: 'diff', details: { agent: agent.name, diffs: successfulDiffs } }
                ).catch(error => console.error('Failed to save version:', error));
              }
            } else {
              console.error(`❌ No diffs could be applied to the document`);
            }
          }
        } else if (action.type === 'request_edit' && action.target_agent !== null) {
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
        documentAction: agentResponse.document_action && agentResponse.document_action.type !== 'none' ? {
          type: agentResponse.document_action.type as 'diff' | 'append' | 'request_edit',
          contents: agentResponse.document_action.contents,
          diffs: agentResponse.document_action.diffs,
          target_agent: agentResponse.document_action.target_agent,
        } : undefined,
        tokenUsage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens
        } : undefined
      };
      
      // conversationを更新
      updateConversation(prev => {
        // 最後のthinkingメッセージを削除
        const filtered = prev.filter(turn => !(turn.speaker === agentId && turn.isThinking));
        return [...filtered, newTurn];
      });

      // 次の発言者を決定
      // 最新の状態を再度取得
      const latestState = useAppStore.getState();
      const latestIsRunning = latestState.isRunning;
      const latestActiveAgentIds = latestState.activeAgentIds;
      const latestActiveAgents = agents.filter(agent => latestActiveAgentIds.includes(agent.id));
      
      console.log('🔍 Checking if conversation should continue. isRunning:', latestIsRunning);
      console.log('📋 Agent response next_speaker:', JSON.stringify(agentResponse.next_speaker));
      console.log('🔍 Latest active agents:', latestActiveAgents.map(a => a.id));
      
      if (latestIsRunning) {
        // next_speakerが存在しない場合のフォールバック
        if (!agentResponse.next_speaker) {
          console.warn('⚠️ next_speaker is undefined, selecting random agent');
          const randomAgent = latestActiveAgents[Math.floor(Math.random() * latestActiveAgents.length)];
          conversationQueue.enqueue({
            type: 'agent_turn',
            agentId: randomAgent.id,
            sessionId: requestSessionId
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
            // 指定されたエージェントがアクティブかチェック
            const requestedAgent = latestActiveAgents.find(a => a.id === agentResponse.next_speaker.agent);
            if (requestedAgent) {
              nextAgentId = agentResponse.next_speaker.agent;
              console.log(`✅ Specific agent ${requestedAgent.name} is active`);
            } else {
              console.warn(`⚠️ Requested agent ${agentResponse.next_speaker.agent} is not active`);
              
              // システムメッセージを追加
              const inactiveAgentName = agents.find(a => a.id === agentResponse.next_speaker.agent)?.name || agentResponse.next_speaker.agent;
              const systemMessage: ConversationTurn = {
                id: crypto.randomUUID(),
                speaker: 'system',
                message: `（${agent.name}が${inactiveAgentName}を指定しましたが、現在会話に参加していません）`,
                timestamp: new Date()
              };
              addConversationTurn(systemMessage);
              
              if (currentState.observerMode) {
                // 観察モードの場合は自分自身に戻す
                console.log(`🔄 Observer mode: returning to self (${agentId})`);
                nextAgentId = agentId;
              } else {
                // 通常モードの場合はユーザーに戻す
                console.log(`👤 Returning to user due to inactive agent request`);
                setWaitingForUser(true);
                return; // ここで処理を終了
              }
            }
          } else if (agentResponse.next_speaker.type === 'random') {
            // randomの場合
            nextAgentId = latestActiveAgents[Math.floor(Math.random() * latestActiveAgents.length)].id;
          } else {
            console.error('⚠️ Invalid next_speaker configuration:', agentResponse.next_speaker);
            nextAgentId = latestActiveAgents[Math.floor(Math.random() * latestActiveAgents.length)].id;
          }
          
          console.log(`🎯 Next speaker: ${latestActiveAgents.find(a => a.id === nextAgentId)?.name} (${nextAgentId})`);
          
          // 次のエージェントのターンをキューに追加
          if (currentState.agentDelay > 0) {
            // 遅延がある場合
            setTimeout(() => {
              conversationQueue.enqueue({
                type: 'agent_turn',
                agentId: nextAgentId!,
                sessionId: requestSessionId
              });
            }, currentState.agentDelay);
          } else {
            // 遅延なしの場合は即座にキューに追加
            conversationQueue.enqueue({
              type: 'agent_turn',
              agentId: nextAgentId!,
              sessionId: requestSessionId
            });
          }
        }
        } else {
          console.log('🛑 Conversation stopped (isRunning is false)');
        }
        } else {
          // function_callでない場合のフォールバック
          console.warn(`⚠️ No function call in response, using fallback`);
          agentResponse = {
            speaker: agentId,
            message: response.output_text || 'エラーが発生しました',
            next_speaker: {
              type: 'random',
              agent: null
            },
            document_action: { type: 'none', contents: [], diffs: [], content: '', target_agent: '' }
          };
        }
      } else {
        // outputがない場合のフォールバック
        console.warn(`⚠️ No output in response, using fallback`);
        agentResponse = {
          speaker: agentId,
          message: response.output_text || 'エラーが発生しました',
          next_speaker: {
            type: 'random',
            agent: null
          },
          document_action: { type: 'none', contents: [], diffs: [], content: '', target_agent: '' }
        };
      }
    } catch (error) {
      console.error('❌ Error in agent turn:', error);
      
      // APIキー関連のエラーかチェック
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isApiKeyError = errorMessage.includes('APIキーが設定されていません') || 
                           errorMessage.includes('API Error') ||
                           errorMessage.includes('401') ||
                           errorMessage.includes('Unauthorized');
      
      console.error('Error details:', {
        agentId,
        agentName: agent?.name,
        error: errorMessage,
        isApiKeyError
      });
      
      // エラー時も考え中の状態を削除
      setThinkingAgentId(null);
      updateConversation(prev => {
        // 最後のthinkingメッセージを削除
        const filtered = prev.filter(turn => !(turn.speaker === agentId && turn.isThinking));
        // エラーメッセージを追加
        const errorTurn: ConversationTurn = {
          id: crypto.randomUUID(),
          speaker: 'system',
          message: isApiKeyError 
            ? `APIキーのエラーが発生しました。設定を確認してください。`
            : `エラーが発生しました: ${errorMessage}`,
          timestamp: new Date()
        };
        return [...filtered, errorTurn];
      });
      
      // APIキーエラーの場合は設定画面を開く
      if (isApiKeyError) {
        setIsRunning(false);
        setShowSettings(true);
      }
    }
  };

  // エージェントのターン処理（キューに追加）
  const processAgentTurn = (agentId: string) => {
    const sessionId = useAppStore.getState().currentSessionId;
    if (!sessionId) {
      console.error('No current session ID');
      return;
    }
    conversationQueue.enqueue({
      type: 'agent_turn',
      agentId,
      sessionId
    });
  };

  // キューイベントハンドラーの設定
  useEffect(() => {
    const handleQueueEvent = async (event: QueueEvent) => {
      if (event.type === 'agent_turn') {
        await processAgentTurnInternal(event.agentId, event.sessionId);
      }
    };

    conversationQueue.setEventHandler(handleQueueEvent);
    
    // キュー変更通知の設定
    conversationQueue.setOnQueueChange((length) => {
      setQueueLength(length);
    });
  }, []);

  // ユーザータイムアウト処理
  const handleUserTimeout = () => {
    const currentState = useAppStore.getState();
    setWaitingForUser(false);
    
    // 観察モードでなければシステムメッセージを追加
    if (!currentState.observerMode) {
      const timeoutMessage: ConversationTurn = {
        id: crypto.randomUUID(),
        speaker: 'system',
        message: '（ユーザーからの応答がなかったため、会話を続けます）',
        timestamp: new Date()
      };
      addConversationTurn(timeoutMessage);
    }
    
    // ランダムなエージェントが発言（isRunningがtrueの場合のみ）
    if (currentState.isRunning) {
      // 最新のアクティブエージェントを取得
      const currentActiveAgents = agents.filter(agent => currentState.activeAgentIds.includes(agent.id));
      if (currentActiveAgents.length > 0) {
        // 最後に発言したエージェントを取得
        const lastAgentMessage = currentState.conversation
          .filter(turn => turn.speaker !== 'user' && turn.speaker !== 'system' && !turn.isThinking)
          .pop();
        const lastAgentId = lastAgentMessage?.speaker;
        
        // 観察モードの場合、最後の発言者を除外（ただし、エージェントが1人の場合は除外しない）
        let eligibleAgents = currentActiveAgents;
        if (currentState.observerMode && lastAgentId && currentActiveAgents.length > 1) {
          eligibleAgents = currentActiveAgents.filter(agent => agent.id !== lastAgentId);
          console.log(`🔍 Excluding last speaker ${lastAgentId} from random selection`);
        }
        
        // ランダムに選択
        const randomAgent = eligibleAgents[Math.floor(Math.random() * eligibleAgents.length)];
        console.log(`🎲 Selected random agent: ${randomAgent.name} (${randomAgent.id})`);
        processAgentTurn(randomAgent.id);
      }
    }
  };

  // 会話の開始/停止
  const toggleConversation = () => {
    if (!isRunning) {
      console.log('🚀 Starting conversation');
      setIsRunning(true);
      setWaitingForUser(false);
      
      // APIキーが設定されているかチェック
      if (!isProviderConfigured()) {
        alert('APIキーが設定されていません。設定画面からAPIキーを入力してください。');
        setIsRunning(false);
        setShowSettings(true);
        return;
      }
      
      // キューをクリア
      conversationQueue.clear();
      
      // 最新のアクティブエージェントを取得
      const currentActiveAgents = agents.filter(agent => activeAgentIds.includes(agent.id));
      if (currentActiveAgents.length === 0) {
        console.error('No active agents available');
        setIsRunning(false);
        return;
      }
      
      // 既に会話が始まっているかチェック（ユーザーの発言があるか）
      const userMessages = conversation.filter(turn => turn.speaker === 'user' && !turn.isThinking);
      const hasUserMessages = userMessages.length > 0;
      
      if (!hasUserMessages) {
        // 会話がまだ始まっていない場合のみ、ランダムなエージェントから開始
        const startAgent = currentActiveAgents[Math.floor(Math.random() * currentActiveAgents.length)];
        console.log(`🎯 Starting with agent: ${startAgent.name}`);
        
        // 最初のエージェントをキューに追加
        processAgentTurn(startAgent.id);
      } else {
        console.log('📝 Conversation already has user messages, processing last user message');
        // 最後のユーザーメッセージを取得
        const lastUserMessage = userMessages[userMessages.length - 1];
        
        // ターゲットエージェントを決定
        let respondingAgentId: string;
        if (!lastUserMessage.targetAgent || lastUserMessage.targetAgent === 'random') {
          respondingAgentId = currentActiveAgents[Math.floor(Math.random() * currentActiveAgents.length)].id;
        } else {
          const targetAgentActive = currentActiveAgents.find(a => a.id === lastUserMessage.targetAgent);
          if (targetAgentActive) {
            respondingAgentId = lastUserMessage.targetAgent;
          } else {
            respondingAgentId = currentActiveAgents[Math.floor(Math.random() * currentActiveAgents.length)].id;
          }
        }
        
        // エージェントの応答を開始
        processAgentTurn(respondingAgentId);
      }
    } else {
      console.log('🛑 Stopping conversation');
      setIsRunning(false);
      setWaitingForUser(false);
      
      // 実行中のAPI呼び出しをキャンセル
      if (abortControllerRef.current) {
        console.log('🚫 Aborting ongoing API calls');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // 思考中のエージェントをクリア
      if (thinkingAgentId) {
        setThinkingAgentId(null);
        // 思考中メッセージを削除
        updateConversation(prev => prev.filter(turn => !(turn.isThinking)));
      }
      
      // キューをクリア
      conversationQueue.clear();
    }
  };

  // ユーザー入力の処理
  const handleUserInput = async () => {
    if (!userInput.trim()) return;

    // ユーザー待機状態を解除
    setWaitingForUser(false);

    // 既存のキューをクリア（ユーザー発言を優先）
    conversationQueue.clear();

    // 思考中のエージェントをクリア
    if (thinkingAgentId) {
      setThinkingAgentId(null);
      // 思考中メッセージを削除
      updateConversation(prev => prev.filter(turn => !(turn.isThinking)));
    }

    // ユーザーの発言を追加
    const userTurn: ConversationTurn = {
      id: crypto.randomUUID(),
      speaker: 'user',
      message: userInput,
      targetAgent: targetAgent !== 'random' ? targetAgent : undefined,
      timestamp: new Date()
    };

    addConversationTurn(userTurn);
    setUserInput('');
    
    // テキストエリアの高さをリセット
    if (textareaRef.current) {
      textareaRef.current.style.height = '42px';
    }

    // 最新のアクティブエージェントを取得
    const currentActiveAgents = agents.filter(agent => activeAgentIds.includes(agent.id));
    if (currentActiveAgents.length === 0) {
      console.error('No active agents available');
      return;
    }
    
    // 対象エージェントを決定
    let respondingAgentId: string;
    if (targetAgent === 'random') {
      respondingAgentId = currentActiveAgents[Math.floor(Math.random() * currentActiveAgents.length)].id;
    } else {
      // 指定されたエージェントがアクティブか確認
      const targetAgentActive = currentActiveAgents.find(a => a.id === targetAgent);
      if (targetAgentActive) {
        respondingAgentId = targetAgent;
      } else {
        console.warn(`⚠️ Target agent ${targetAgent} is not active, selecting random`);
        respondingAgentId = currentActiveAgents[Math.floor(Math.random() * currentActiveAgents.length)].id;
      }
    }

    // isRunningがtrueの場合のみ、エージェントの応答を生成
    if (isRunning) {
      processAgentTurn(respondingAgentId);
    } else {
      console.log('📝 Meeting not started yet, agent turn will be processed when meeting starts');
      // 会議が開始されていない場合は、ターゲット情報を保存しておく
      // （会議開始時に処理される）
    }
  };

  // 新しいセッションを作成
  const handleNewSession = async () => {
    if (documentContent.trim() || conversation.length > 0) {
      if (!confirm('現在の作品を保存して新しい作品を開始しますか？')) {
        return;
      }
    }
    
    // 新しいセッションを作成
    const session = await sessionService.createSession();
    setCurrentSessionId(session.id);
    setSessionTitle(session.title);
    setDocumentContent('');
    updateConversation(() => []);
    sessionService.setCurrentSessionId(session.id);
    
    // 状態をリセット
    setIsRunning(false);
    setWaitingForUser(false);
    conversationQueue.clear();
    
    console.log('✅ New session created:', session.title);
  };

  // セッションを読み込む
  const handleLoadSession = async (session: Session) => {
    // 現在の状態をクリア
    setIsRunning(false);
    setWaitingForUser(false);
    conversationQueue.clear();
    
    // セッションのデータを復元
    setCurrentSessionId(session.id);
    setSessionTitle(session.title);
    setDocumentContent(session.documentContent);
    
    // 会話履歴を復元（setConversationの代わりにupdateConversationを使用）
    updateConversation(() => session.conversation);
    
    // アクティブエージェントを復元
    session.activeAgentIds.forEach(agentId => {
      if (!activeAgentIds.includes(agentId)) {
        toggleAgent(agentId);
      }
    });
    
    // セッションサービスに現在のセッションIDを設定
    sessionService.setCurrentSessionId(session.id);
    
    console.log('✅ Session loaded:', session.title);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* サイドバー */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        currentSessionId={currentSessionId}
        onNewSession={handleNewSession}
        onLoadSession={handleLoadSession}
        onShowSettings={() => setShowSettings(true)}
        onShowVersionTimeline={() => setShowVersionTimeline(true)}
        onShowAgentManager={() => setShowAgentManagerModal(true)}
        onShowHelp={() => setShowHelp(true)}
        isRunning={isRunning}
      />
      
      {/* メインコンテンツ */}
      <div className={`flex h-screen bg-gray-100 flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        {/* 左側: チャット */}
        <div className="flex-1 flex flex-col">
        {/* ヘッダー */}
        <header className="bg-white shadow-sm px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {isEditingTitle ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveTitle();
                        } else if (e.key === 'Escape') {
                          setIsEditingTitle(false);
                          setEditingTitle(sessionTitle);
                        }
                      }}
                      onBlur={saveTitle}
                      className="text-2xl font-bold bg-transparent border-b-2 border-blue-500 outline-none"
                      autoFocus
                    />
                  ) : (
                    <>
                      <h1 className="text-2xl font-bold">{sessionTitle || '無題の作品'}</h1>
                      <button
                        onClick={() => {
                          setIsEditingTitle(true);
                          setEditingTitle(sessionTitle);
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="タイトルを編集"
                        aria-label="タイトルを編集"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M11.5 2.5L13.5 4.5L4.5 13.5L2 14L2.5 11.5L11.5 2.5Z" />
                          <path d="M10 4L12 6" />
                        </svg>
                      </button>
                      <button
                        onClick={generateTitle}
                        disabled={isGeneratingTitle || documentContent.length === 0}
                        className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="AIでタイトルを生成"
                        aria-label="AIでタイトルを生成"
                      >
                        {isGeneratingTitle ? (
                          <div className="animate-spin">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M8 2V6" />
                              <path d="M8 10V14" />
                              <path d="M2 8H6" />
                              <path d="M10 8H14" />
                            </svg>
                          </div>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="8" cy="8" r="6" />
                            <path d="M8 4V8L10 10" />
                            <path d="M4 2L2 4" />
                            <path d="M12 2L14 4" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600">NovelDrive - AIマルチエージェント執筆システム</p>
              </div>
              {queueLength > 0 && (
                <span className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                  キュー: {queueLength}件待機中
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* エージェントカウント表示 */}
              <span className="text-sm text-gray-600">
                エージェント: {activeAgentIds.length}/{agents.length}
              </span>
            </div>
          </div>
        </header>

        {/* 会話ログ */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {(Array.isArray(conversation) ? conversation : []).map((turn) => {
              const agent = agents.find(a => a.id === turn.speaker);
              const isUser = turn.speaker === 'user';
              const isSystem = turn.speaker === 'system';
              
              return (
                <div key={turn.id} className="flex gap-4">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center ${
                    thinkingAgentId === turn.speaker ? 'animate-pulse' : ''
                  }`}>
                    {isUser ? '👤' : isSystem ? '⚙️' : agent?.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold">
                        {isUser ? 'あなた' : isSystem ? 'システム' : agent?.name}
                      </span>
                      {agent?.title && (
                        <span className="text-xs text-gray-600">
                          {agent.title}
                        </span>
                      )}
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
                        {turn.timestamp instanceof Date ? turn.timestamp.toLocaleTimeString() : new Date(turn.timestamp).toLocaleTimeString()}
                      </span>
                      {turn.tokenUsage && (
                        <span className="text-xs text-gray-500 ml-2">
                          📊 {turn.tokenUsage.total_tokens}トークン
                        </span>
                      )}
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
                        <div className="whitespace-pre-wrap">{turn.message}</div>
                      )}
                    </div>
                    {/* ドキュメントアクションの表示 */}
                    {turn.documentAction && (
                      <div className="mt-2">
                        {turn.documentAction.type === 'diff' && (
                          <div className="text-sm bg-blue-50 text-blue-700 p-2 rounded">
                            <div className="flex items-center gap-2 mb-1">
                              <span>✏️ ドキュメントを差分更新しました（{turn.documentAction.diffs?.length || 0}箇所）</span>
                            </div>
                            {turn.documentAction.diffs && turn.documentAction.diffs.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {turn.documentAction.diffs.map((diff, index) => (
                                  <div
                                    key={index}
                                    className="group relative inline-block cursor-help"
                                  >
                                    <span className="text-xs text-blue-600 underline decoration-dotted">
                                      変更箇所 {index + 1}
                                    </span>
                                    <div className="absolute z-10 w-96 p-3 bg-white border border-gray-200 rounded-lg shadow-lg invisible group-hover:visible bottom-full left-0 mb-1">
                                      <div className="space-y-2">
                                        <div>
                                          <div className="text-xs font-semibold text-red-600 mb-1">変更前:</div>
                                          <div className="text-xs bg-red-50 p-2 rounded border border-red-200 whitespace-pre-wrap">
                                            {diff.oldText}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs font-semibold text-green-600 mb-1">変更後:</div>
                                          <div className="text-xs bg-green-50 p-2 rounded border border-green-200 whitespace-pre-wrap">
                                            {diff.newText}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {turn.documentAction.type === 'append' && (
                          <div className="flex items-center gap-2 text-sm bg-green-50 text-green-700 p-2 rounded">
                            <span>➕ ドキュメントに追記しました（{turn.documentAction.contents?.length || 0}段落）</span>
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
                {isRunning ? '会議を停止' : '会議開始'}
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
            <div className="flex gap-2 items-end">
              <select
                value={targetAgent}
                onChange={(e) => setTargetAgent(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
                disabled={activeAgentIds.length === 0}
              >
                <option value="random">TO: 誰でも</option>
                {agents.filter(agent => activeAgentIds.includes(agent.id)).map(agent => (
                  <option key={agent.id} value={agent.id}>
                    TO: {agent.avatar} {agent.name}
                  </option>
                ))}
              </select>
              <textarea
                ref={textareaRef}
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value);
                  // 自動的に高さを調整
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 144) + 'px'; // 144px = 6行分 (24px * 6)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleUserInput();
                  }
                }}
                placeholder="メッセージを入力... (Shift+Enterで改行)"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto"
                style={{ minHeight: '42px', maxHeight: '144px', height: '42px' }}
              />
              <button
                onClick={handleUserInput}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                disabled={!userInput.trim()}
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">📄 ドキュメントエディタ</h2>
            <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {documentContent.length}文字
            </span>
          </div>
        </div>
        
        {/* エディタ本体 */}
        <div className="flex-1 p-6">
          <textarea
            value={documentContent || ''}
            onChange={(e) => {
              const newContent = e.target.value;
              setDocumentContent(newContent);
              
              // デバウンスでバージョンを保存
              if (currentSessionId) {
                clearTimeout((window as any).documentVersionSaveTimer);
                (window as any).documentVersionSaveTimer = setTimeout(() => {
                  sessionService.saveDocumentVersion(
                    currentSessionId,
                    newContent,
                    'user',
                    { type: 'manual', details: { source: 'direct_edit' } }
                  ).catch(error => console.error('Failed to save version:', error));
                }, 2000); // 2秒後に保存
              }
            }}
            className="w-full h-full p-4 border rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ここに小説を書いてください..."
          />
          </div>
        </div>
      </div>

      {/* 設定画面 */}
      <Settings 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* 履歴画面 */}
      <SessionHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSessionSelect={handleLoadSession}
      />

      {/* エージェント管理 */}
      <AgentManager
        isOpen={showAgentManagerModal}
        onClose={() => setShowAgentManagerModal(false)}
      />
      {/* ヘルプ */}
      <Help
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* バージョンタイムライン */}
      <VersionTimeline
        isOpen={showVersionTimeline}
        onClose={() => setShowVersionTimeline(false)}
        sessionId={currentSessionId}
        currentContent={documentContent}
        onRestore={(content) => {
          setDocumentContent(content);
          console.log('✅ Document version restored');
        }}
      />
    </div>
  );
}

export default App;