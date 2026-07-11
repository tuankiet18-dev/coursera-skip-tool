const TYPE_LABELS = {
  lecture: 'Lecture (Video)',
  supplement: 'Supplement (Reading)',
  quiz: 'Quiz',
  programming: 'Programming',
};

function showAlert(type, message) {
  const el = document.getElementById('result-alert');
  el.style.display = 'block';
  el.style.background = type === 'error' ? 'var(--error-bg)' : 'rgba(16, 185, 129, 0.1)';
  el.style.borderColor = type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
  el.style.color = type === 'error' ? 'var(--error-text)' : '#10b981';
  el.textContent = message;
}

function hideAlert() {
  const el = document.getElementById('result-alert');
  el.style.display = 'none';
  el.textContent = '';
}

function setLoading(btnId, loading, text) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
  if (text) {
    btn.querySelector('.btn-text').textContent = text;
  }
}

async function getActiveCourseraTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith('https://www.coursera.org')) {
    return null;
  }
  return tab;
}

async function loadContext() {
  try {
    const tab = await getActiveCourseraTab();
    if (!tab) throw new Error('Not on Coursera');

    const context = await chrome.tabs.sendMessage(tab.id, { action: 'getContext' });
    if (!context || context.error || !context.itemType) {
      throw new Error(context?.error || 'No context');
    }

    document.getElementById('page-status').style.display = 'block';
    document.getElementById('action-buttons').style.display = 'block';
    document.getElementById('empty-msg').style.display = 'none';

    document.getElementById('lbl-type').textContent = TYPE_LABELS[context.itemType] || context.itemType;
    document.getElementById('lbl-item').textContent = context.itemId || '-';
    document.getElementById('lbl-course').textContent = context.courseSlug || '-';

    return context;
  } catch (_) {
    document.getElementById('page-status').style.display = 'none';
    document.getElementById('action-buttons').style.display = 'none';
    document.getElementById('empty-msg').style.display = 'block';
    return null;
  }
}

async function markCompleted() {
  hideAlert();
  setLoading('btn-skip-current', true, 'Đang xử lý...');

  try {
    const tab = await getActiveCourseraTab();
    if (!tab) throw new Error('Vui lòng mở trang bài học Coursera trước.');

    const result = await chrome.tabs.sendMessage(tab.id, { action: 'markCompleted' });
    if (result && result.success) {
      showAlert('success', '✅ Đã hoàn thành! Đang tải lại trang...');
      setTimeout(() => {
        chrome.tabs.reload(tab.id);
      }, 1500);
    } else {
      showAlert('error', result?.error || 'Lỗi không xác định. Kiểm tra Console (F12).');
    }
  } catch (error) {
    showAlert('error', error.message);
  } finally {
    setLoading('btn-skip-current', false, 'Hoàn thành bài hiện tại');
  }
}

document.getElementById('btn-skip-current').addEventListener('click', markCompleted);

document.getElementById('btn-skip-all').addEventListener('click', async () => {
  hideAlert();
  setLoading('btn-skip-all', true, 'Đang khởi động...');
  
  const progContainer = document.getElementById('bulk-progress-container');
  const progMsg = document.getElementById('bulk-progress-msg');
  const progBar = document.getElementById('bulk-progress-bar');
  const progPct = document.getElementById('bulk-progress-pct');
  
  progContainer.style.display = 'block';
  progMsg.textContent = 'Đang khởi động tiến trình...';
  progBar.style.width = '0%';
  progPct.textContent = '0%';

  try {
    const tab = await getActiveCourseraTab();
    if (!tab) throw new Error('Vui lòng mở trang bài học Coursera trước.');

    const result = await chrome.tabs.sendMessage(tab.id, { action: 'markAllCompleted' });
    if (!result || !result.success) {
      throw new Error(result?.error || 'Lỗi không xác định khi bắt đầu.');
    }
  } catch (error) {
    showAlert('error', `Lỗi: ${error.message}`);
    setLoading('btn-skip-all', false, 'Hoàn thành toàn bộ khóa học');
    progContainer.style.display = 'none';
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'progressUpdate') {
    const msg = message.message;
    const progMsg = document.getElementById('bulk-progress-msg');
    const progBar = document.getElementById('bulk-progress-bar');
    const progPct = document.getElementById('bulk-progress-pct');
    
    progMsg.textContent = msg;

    // Parse progress if matching "Đang xử lý: X / Y"
    const match = msg.match(/Đang xử lý:\s*(\d+)\s*\/\s*(\d+)/);
    if (match) {
      const current = parseInt(match[1]);
      const total = parseInt(match[2]);
      const pct = Math.round((current / total) * 100);
      progBar.style.width = `${pct}%`;
      progPct.textContent = `${pct}%`;
    }
    
    if (msg.includes('✅ Hoàn thành toàn bộ')) {
       setLoading('btn-skip-all', false, 'Hoàn thành toàn bộ khóa học');
       progBar.style.width = '100%';
       progPct.textContent = '100%';
       
       progMsg.textContent = 'Hoàn thành! Đang tự động tải lại trang...';
       setTimeout(async () => {
         const tab = await getActiveCourseraTab();
         if (tab) chrome.tabs.reload(tab.id);
       }, 2000);
    }
  }
});

document.getElementById('btn-refresh').addEventListener('click', () => {
  hideAlert();
  loadContext();
});

loadContext();
