// 自律創作モードのUI管理

let currentSession = null;
let sessionTimer = null;
let activityTimer = null;
let currentOutputs = [];
let activeTab = 'writing';

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  await loadSchedules();
  setupEventListeners();
  setupIPCListeners();
  updateUI();
  
  // 既存のセッション状態を確認
  await checkExistingSession();
});

// スケジュールの読み込み
async function loadSchedules() {
  try {
    const result = await window.api.autonomous.getSchedules();
    if (result.success) {
      const select = document.getElementById('schedule-select');
      select.innerHTML = '';
      
      result.data.forEach(schedule => {
        const option = document.createElement('option');
        option.value = schedule.id;
        option.textContent = `${schedule.name} - ${schedule.description}`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Failed to load schedules:', error);
  }
}

// イベントリスナーの設定
function setupEventListeners() {
  // コントロールボタン
  document.getElementById('start-btn').addEventListener('click', startSession);
  document.getElementById('pause-btn').addEventListener('click', pauseSession);
  document.getElementById('stop-btn').addEventListener('click', stopSession);
  
  // エクスポートボタン
  document.getElementById('export-session-btn').addEventListener('click', exportSession);
  
  // タブ切り替え
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      switchTab(e.target.dataset.tab);
    });
  });
  
  // モーダル
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
}

// IPCイベントリスナーの設定
function setupIPCListeners() {
  window.api.autonomous.onEvent((event) => {
    handleAutonomousEvent(event);
  });
}

// セッション開始
async function startSession() {
  const projectId = localStorage.getItem('currentProjectId');
  if (!projectId) {
    showNotification('プロジェクトを選択してください', 'error');
    return;
  }
  
  const schedule = document.getElementById('schedule-select').value;
  
  try {
    const result = await window.api.autonomous.start({
      projectId,
      schedule
    });
    
    if (result.success) {
      currentSession = result.data;
      updateUI();
      startTimers();
      showNotification('自律創作セッションを開始しました', 'success');
    } else {
      showNotification(result.error || 'セッションの開始に失敗しました', 'error');
    }
  } catch (error) {
    console.error('Failed to start session:', error);
    showNotification('セッションの開始に失敗しました', 'error');
  }
}

// セッション一時停止
async function pauseSession() {
  try {
    const result = await window.api.autonomous.pause();
    
    if (result.success) {
      stopTimers();
      updateUI();
      showNotification('セッションを一時停止しました', 'info');
    } else {
      showNotification(result.error || '一時停止に失敗しました', 'error');
    }
  } catch (error) {
    console.error('Failed to pause session:', error);
    showNotification('一時停止に失敗しました', 'error');
  }
}

// セッション再開
async function resumeSession() {
  try {
    const result = await window.api.autonomous.resume();
    
    if (result.success) {
      startTimers();
      updateUI();
      showNotification('セッションを再開しました', 'success');
    } else {
      showNotification(result.error || '再開に失敗しました', 'error');
    }
  } catch (error) {
    console.error('Failed to resume session:', error);
    showNotification('再開に失敗しました', 'error');
  }
}

// セッション停止
async function stopSession() {
  const confirmed = await showConfirmModal(
    'セッションを終了しますか？',
    'セッションを終了すると、現在の進行状況が保存され、レポートが生成されます。'
  );
  
  if (!confirmed) return;
  
  try {
    const result = await window.api.autonomous.stop();
    
    if (result.success) {
      currentSession = null;
      stopTimers();
      updateUI();
      showNotification('セッションを終了しました', 'info');
      
      // セッションレポートを表示
      if (result.data.report) {
        displaySessionReport(result.data.report);
      }
    } else {
      showNotification(result.error || 'セッションの終了に失敗しました', 'error');
    }
  } catch (error) {
    console.error('Failed to stop session:', error);
    showNotification('セッションの終了に失敗しました', 'error');
  }
}

// 既存セッションの確認
async function checkExistingSession() {
  try {
    const result = await window.api.autonomous.getStatus();
    
    if (result.success && result.data) {
      currentSession = result.data;
      updateUI();
      startTimers();
      
      // 最新のアウトプットを読み込む
      await loadSessionOutputs(result.data.sessionId);
    }
  } catch (error) {
    console.error('Failed to check existing session:', error);
  }
}

// タイマーの開始
function startTimers() {
  // セッションタイマー
  sessionTimer = setInterval(updateSessionTime, 1000);
  
  // アクティビティタイマー
  activityTimer = setInterval(updateActivityTime, 1000);
}

// タイマーの停止
function stopTimers() {
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }
  
  if (activityTimer) {
    clearInterval(activityTimer);
    activityTimer = null;
  }
}

// セッション時間の更新
function updateSessionTime() {
  if (!currentSession) return;
  
  const elapsed = currentSession.elapsed || 0;
  const remaining = 24 * 60 * 60 * 1000 - elapsed;
  
  document.getElementById('elapsed-time').textContent = formatDuration(elapsed);
  document.getElementById('remaining-time').textContent = formatDuration(remaining);
}

// アクティビティ時間の更新
function updateActivityTime() {
  if (!currentSession || !currentSession.currentActivity) return;
  
  const activity = currentSession.currentActivity;
  const elapsed = activity.duration || 0;
  
  document.getElementById('activity-elapsed').textContent = formatDuration(elapsed);
}

// 自律イベントの処理
function handleAutonomousEvent(event) {
  switch (event.type) {
    case 'session:started':
      currentSession = event.data;
      updateUI();
      startTimers();
      break;
      
    case 'session:paused':
      updateUI();
      stopTimers();
      break;
      
    case 'session:resumed':
      updateUI();
      startTimers();
      break;
      
    case 'session:completed':
      currentSession = null;
      updateUI();
      stopTimers();
      displaySessionReport(event.data.report);
      break;
      
    case 'activity:started':
      updateCurrentActivity(event.data);
      addToActivityTimeline('started', event.data);
      break;
      
    case 'activity:completed':
      updateCurrentActivity(null);
      addToActivityTimeline('completed', event.data);
      updateMetrics();
      break;
      
    case 'activity:error':
      addToActivityTimeline('error', event.data);
      break;
      
    case 'checkpoint:saved':
      showNotification('チェックポイントを保存しました', 'info');
      break;
      
    case 'rest:started':
      updateCurrentActivity({ activity: 'rest', duration: event.data.duration });
      break;
      
    case 'agent:message':
      addAgentMessage(event.data);
      break;
  }
}

// 現在のアクティビティを更新
function updateCurrentActivity(data) {
  const indicator = document.getElementById('activity-indicator');
  const typeEl = document.getElementById('activity-type');
  const descEl = document.getElementById('activity-description');
  const timerEl = document.querySelector('.activity-timer');
  
  if (data) {
    const activityInfo = getActivityInfo(data.activity);
    typeEl.textContent = activityInfo.name;
    descEl.textContent = activityInfo.description;
    
    document.querySelector('.activity-icon').textContent = activityInfo.icon;
    
    if (data.duration) {
      document.getElementById('activity-duration').textContent = formatDuration(data.duration);
      timerEl.style.display = 'block';
    }
  } else {
    typeEl.textContent = '待機中';
    descEl.textContent = '次のアクティビティを準備中...';
    document.querySelector('.activity-icon').textContent = '🤖';
    timerEl.style.display = 'none';
  }
}

// アクティビティ情報の取得
function getActivityInfo(type) {
  const activities = {
    writing: { name: '執筆', icon: '✍️', description: 'コンテンツを生成しています' },
    brainstorming: { name: 'ブレインストーミング', icon: '💡', description: 'アイデアを発想しています' },
    reviewing: { name: 'レビュー', icon: '📝', description: 'コンテンツを評価しています' },
    plotting: { name: 'プロット構築', icon: '📋', description: 'ストーリー構造を開発しています' },
    character: { name: 'キャラクター開発', icon: '👥', description: 'キャラクターを深化させています' },
    worldbuilding: { name: '世界観構築', icon: '🌍', description: '世界観を拡張しています' },
    rest: { name: '休憩', icon: '☕', description: 'エージェントが休憩中です' }
  };
  
  return activities[type] || { name: type, icon: '🤖', description: '処理中...' };
}

// アクティビティタイムラインに追加
function addToActivityTimeline(status, data) {
  const timeline = document.getElementById('activity-timeline');
  const item = document.createElement('div');
  item.className = 'timeline-item';
  
  const activityInfo = getActivityInfo(data.activity);
  const time = new Date(data.startTime || new Date()).toLocaleTimeString();
  
  let statusIcon = '';
  let description = '';
  
  switch (status) {
    case 'started':
      statusIcon = '▶️';
      description = '開始しました';
      break;
    case 'completed':
      statusIcon = '✅';
      description = `完了 (${data.result?.metrics ? JSON.stringify(data.result.metrics) : ''})`;
      break;
    case 'error':
      statusIcon = '❌';
      description = `エラー: ${data.error}`;
      break;
  }
  
  item.innerHTML = `
    <div class="timeline-time">${time}</div>
    <div class="timeline-icon">${statusIcon}</div>
    <div class="timeline-content">
      <div class="timeline-title">${activityInfo.icon} ${activityInfo.name}</div>
      <div class="timeline-description">${description}</div>
    </div>
  `;
  
  timeline.insertBefore(item, timeline.firstChild);
  
  // 最大50件まで保持
  while (timeline.children.length > 50) {
    timeline.removeChild(timeline.lastChild);
  }
}

// メトリクスの更新
async function updateMetrics() {
  if (!currentSession) return;
  
  try {
    const result = await window.api.autonomous.getStatus();
    if (result.success && result.data) {
      const metrics = result.data.metrics;
      document.getElementById('words-written').textContent = metrics.wordsWritten.toLocaleString();
      document.getElementById('ideas-generated').textContent = metrics.ideasGenerated.toLocaleString();
      document.getElementById('chapters-completed').textContent = metrics.chaptersCompleted;
      document.getElementById('revisions-completed').textContent = metrics.revisionsCompleted;
      
      // API使用状況の更新
      const apiUsage = result.data.apiUsage;
      updateApiUsage(apiUsage);
    }
  } catch (error) {
    console.error('Failed to update metrics:', error);
  }
}

// API使用状況の更新
function updateApiUsage(usage) {
  const requestsPercent = (usage.requests / 100) * 100;
  const tokensPercent = (usage.tokensUsed / 100000) * 100;
  
  document.getElementById('requests-bar').style.width = `${Math.min(requestsPercent, 100)}%`;
  document.getElementById('tokens-bar').style.width = `${Math.min(tokensPercent, 100)}%`;
  
  document.getElementById('requests-count').textContent = usage.requests;
  document.getElementById('tokens-count').textContent = Math.round(usage.tokensUsed / 1000) + 'k';
  
  // 警告色の設定
  if (requestsPercent > 80) {
    document.getElementById('requests-bar').style.background = '#ff6b6b';
  } else if (requestsPercent > 60) {
    document.getElementById('requests-bar').style.background = '#ffd93d';
  }
  
  if (tokensPercent > 80) {
    document.getElementById('tokens-bar').style.background = '#ff6b6b';
  } else if (tokensPercent > 60) {
    document.getElementById('tokens-bar').style.background = '#ffd93d';
  }
}

// セッションアウトプットの読み込み
async function loadSessionOutputs(sessionId) {
  try {
    const result = await window.api.autonomous.getOutputs(sessionId, 50);
    if (result.success) {
      currentOutputs = result.data;
      displayOutputs();
    }
  } catch (error) {
    console.error('Failed to load outputs:', error);
  }
}

// アウトプットの表示
function displayOutputs() {
  const filteredOutputs = currentOutputs.filter(output => {
    if (activeTab === 'writing') return output.type === 'writing';
    if (activeTab === 'brainstorming') return output.type === 'brainstorming';
    if (activeTab === 'plotting') return output.type === 'plotting';
    if (activeTab === 'review') return output.type === 'review';
    return false;
  });
  
  const outputList = document.getElementById('output-list');
  
  if (filteredOutputs.length === 0) {
    outputList.innerHTML = '<div class="empty-state"><p>このカテゴリのアウトプットはまだありません。</p></div>';
    return;
  }
  
  outputList.innerHTML = '';
  
  filteredOutputs.slice(-20).reverse().forEach(output => {
    const item = document.createElement('div');
    item.className = 'output-item';
    
    const time = new Date(output.metadata.timestamp).toLocaleTimeString();
    const content = typeof output.content === 'string' ? output.content : JSON.stringify(output.content);
    
    item.innerHTML = `
      <div class="output-header">
        <span class="output-agent">${output.agentId}</span>
        <span class="output-time">${time}</span>
      </div>
      <div class="output-content-text">${content.substring(0, 300)}${content.length > 300 ? '...' : ''}</div>
    `;
    
    outputList.appendChild(item);
  });
}

// タブ切り替え
function switchTab(tab) {
  activeTab = tab;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  displayOutputs();
}

// エージェントメッセージの追加
function addAgentMessage(data) {
  const messageLog = document.getElementById('message-log');
  const item = document.createElement('div');
  item.className = 'message-item';
  
  const time = new Date().toLocaleTimeString();
  
  item.innerHTML = `
    <span class="message-time">${time}</span>
    <span class="message-agent">${data.agentId}:</span>
    <span class="message-content">${data.message}</span>
  `;
  
  messageLog.insertBefore(item, messageLog.firstChild);
  
  // 最大100件まで保持
  while (messageLog.children.length > 100) {
    messageLog.removeChild(messageLog.lastChild);
  }
}

// UI更新
async function updateUI() {
  if (!currentSession) {
    // セッション未開始
    document.getElementById('session-state').textContent = '未開始';
    document.getElementById('start-btn').disabled = false;
    document.getElementById('pause-btn').disabled = true;
    document.getElementById('stop-btn').disabled = true;
    document.getElementById('export-session-btn').style.display = 'none';
    document.getElementById('schedule-select').disabled = false;
    
    // メトリクスをリセット
    document.getElementById('words-written').textContent = '0';
    document.getElementById('ideas-generated').textContent = '0';
    document.getElementById('chapters-completed').textContent = '0';
    document.getElementById('revisions-completed').textContent = '0';
  } else {
    // セッション中
    const status = await window.api.autonomous.getStatus();
    if (status.success && status.data) {
      currentSession = status.data;
      
      document.getElementById('session-state').textContent = 
        currentSession.status === 'active' ? '実行中' :
        currentSession.status === 'paused' ? '一時停止中' : '終了';
      
      document.getElementById('start-btn').disabled = true;
      document.getElementById('pause-btn').disabled = currentSession.status !== 'active';
      document.getElementById('pause-btn').textContent = 
        currentSession.status === 'paused' ? '再開' : '一時停止';
      document.getElementById('pause-btn').onclick = 
        currentSession.status === 'paused' ? resumeSession : pauseSession;
      
      document.getElementById('stop-btn').disabled = false;
      document.getElementById('export-session-btn').style.display = 'inline-block';
      document.getElementById('schedule-select').disabled = true;
      
      updateSessionTime();
      updateMetrics();
    }
  }
}

// セッションレポートの表示
function displaySessionReport(report) {
  const content = `
    <h4>セッションレポート</h4>
    <p><strong>セッションID:</strong> ${report.sessionId}</p>
    <p><strong>実行時間:</strong> ${report.duration.hours}時間${report.duration.minutes}分</p>
    
    <h5>成果</h5>
    <ul>
      <li>執筆文字数: ${report.metrics.wordsWritten.toLocaleString()}</li>
      <li>生成アイデア: ${report.metrics.ideasGenerated}</li>
      <li>完了チャプター: ${report.metrics.chaptersCompleted}</li>
      <li>レビュー回数: ${report.metrics.revisionsCompleted}</li>
    </ul>
    
    <h5>アクティビティ内訳</h5>
    <ul>
      ${Object.entries(report.activitySummary).map(([type, data]) => 
        `<li>${getActivityInfo(type).name}: ${data.count}回 (${formatDuration(data.totalDuration)})</li>`
      ).join('')}
    </ul>
    
    <h5>API使用状況</h5>
    <ul>
      <li>リクエスト数: ${report.apiUsage.requests}</li>
      <li>トークン使用量: ${Math.round(report.apiUsage.tokensUsed / 1000)}k</li>
    </ul>
  `;
  
  showModal('セッション完了', content);
}

// セッションのエクスポート
async function exportSession() {
  if (!currentSession) return;
  
  try {
    const exportPath = await window.api.dialog.save({
      title: 'セッションデータをエクスポート',
      defaultPath: `noveldrive-session-${currentSession.sessionId}`,
      filters: [{ name: 'All Files', extensions: ['*'] }]
    });
    
    if (!exportPath) return;
    
    const result = await window.api.autonomous.export(currentSession.sessionId, exportPath);
    
    if (result.success) {
      showNotification(`セッションデータをエクスポートしました: ${exportPath}`, 'success');
    } else {
      showNotification(result.error || 'エクスポートに失敗しました', 'error');
    }
  } catch (error) {
    console.error('Failed to export session:', error);
    showNotification('エクスポートに失敗しました', 'error');
  }
}

// ユーティリティ関数
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function showNotification(message, type = 'info') {
  // 通知の実装（既存のシステムを使用）
  console.log(`[${type}] ${message}`);
}

function showModal(title, content) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').innerHTML = content;
  document.getElementById('confirm-modal').style.display = 'flex';
  document.getElementById('modal-confirm').style.display = 'none';
}

function closeModal() {
  document.getElementById('confirm-modal').style.display = 'none';
}

async function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').innerHTML = message;
    document.getElementById('confirm-modal').style.display = 'flex';
    document.getElementById('modal-confirm').style.display = 'inline-block';
    
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');
    
    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };
    
    const handleCancel = () => {
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      closeModal();
    };
    
    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}