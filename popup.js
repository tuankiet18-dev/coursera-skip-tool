const STORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/coursera-skip-video-read/jjbgneddmjkolgmpamecbhfgjgdiajlf/reviews';

const I18N = {
  en: {
    langBadge: 'EN',
    detectedLabel: 'Lesson Detected',
    lessonTypeLabel: 'Type',
    emptyTitle: 'Ready to Automate',
    emptySub: 'Follow 3 simple steps to start:',
    step1: 'Enroll in your Coursera course',
    step2: 'Open any Video or Reading lesson',
    step3: 'Click Complete in this extension',
    guideActionBtnTab: '🔄 Refresh Detection',
    guideActionBtnOpen: '🚀 Open Coursera',
    btnSkipCurrent: 'Complete This Lesson',
    btnSkipAll: 'Complete Entire Course',
    processingCurrent: 'Completing...',
    successCurrent: '✅ Lesson completed! Reloading...',
    startingBulk: 'Starting automation...',
    fetchingCurriculum: 'Loading course lessons...',
    processingBulk: 'Processing: {current} / {total}',
    completedBulk: '✅ Done! All {total} lessons completed.',
    ratingLabel: '🎉 Completed!',
    ratingMsg: 'Saved your time? Give us 5 stars on Chrome Web Store!',
    btnRate: '⭐ Rate 5 Stars',
    notOnLesson: 'Please open a Coursera lesson page first.',
    notEnrolled: 'Permission denied. Make sure you are enrolled in the course.',
    unknownError: 'An error occurred. Check Console (F12).'
  },
  vi: {
    langBadge: 'VI',
    detectedLabel: 'Đã nhận diện bài học',
    lessonTypeLabel: 'Loại bài',
    emptyTitle: 'Sẵn sàng tự động hóa',
    emptySub: 'Làm theo 3 bước đơn giản để bắt đầu:',
    step1: 'Đăng ký (Enroll) vào khóa học',
    step2: 'Mở 1 bài Video hoặc Reading bất kỳ',
    step3: 'Mở tiện ích và bấm Hoàn thành',
    guideActionBtnTab: '🔄 Nhận diện lại',
    guideActionBtnOpen: '🚀 Mở Coursera',
    btnSkipCurrent: 'Hoàn thành bài hiện tại',
    btnSkipAll: 'Hoàn thành toàn bộ khóa học',
    processingCurrent: 'Đang xử lý...',
    successCurrent: '✅ Đã hoàn thành! Đang tải lại trang...',
    startingBulk: 'Đang bắt đầu...',
    fetchingCurriculum: 'Đang tải danh sách bài học...',
    processingBulk: 'Đang xử lý: {current} / {total}',
    completedBulk: '✅ Hoàn thành toàn bộ {total} bài học!',
    ratingLabel: '🎉 Đã xong bài học!',
    ratingMsg: 'Tiết kiệm thời gian cho bạn? Tặng tác giả 5 sao trên Cửa hàng nhé!',
    btnRate: '⭐ Đánh giá 5 sao',
    notOnLesson: 'Vui lòng mở trang bài học Coursera trước.',
    notEnrolled: 'Không có quyền. Hãy chắc chắn bạn đã đăng ký khóa học.',
    unknownError: 'Đã xảy ra lỗi. Kiểm tra Console (F12).'
  }
};

const TYPE_CONFIG = {
  lecture: { icon: '🎬', en: 'Video Lecture', vi: 'Bài giảng Video' },
  supplement: { icon: '📖', en: 'Reading Material', vi: 'Tài liệu Đọc' },
  quiz: { icon: '📝', en: 'Quiz Assessment', vi: 'Bài kiểm tra (Quiz)' },
  programming: { icon: '💻', en: 'Programming Lab', vi: 'Bài tập Thực hành' },
};

let currentLang = localStorage.getItem('coursera_skip_lang') || (navigator.language?.startsWith('vi') ? 'vi' : 'en');
let currentContext = null;

function t(key, params = {}) {
  const dict = I18N[currentLang] || I18N.en;
  let text = dict[key] || I18N.en[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}

function formatCourseSlug(slug) {
  if (!slug) return '--';
  return slug
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function updateUILanguage() {
  document.getElementById('txt-lang-badge').textContent = t('langBadge');
  document.getElementById('txt-detected-label').textContent = t('detectedLabel');
  document.getElementById('txt-lesson-type-label').textContent = t('lessonTypeLabel');
  document.getElementById('txt-empty-title').textContent = t('emptyTitle');
  document.getElementById('txt-empty-sub').textContent = t('emptySub');
  document.getElementById('txt-step-1').textContent = t('step1');
  document.getElementById('txt-step-2').textContent = t('step2');
  document.getElementById('txt-step-3').textContent = t('step3');
  document.getElementById('txt-rating-label').textContent = t('ratingLabel');
  document.getElementById('txt-rating-msg').textContent = t('ratingMsg');

  const skipCurrentBtn = document.getElementById('btn-skip-current');
  if (!skipCurrentBtn.classList.contains('loading')) {
    document.getElementById('txt-btn-skip-current').textContent = t('btnSkipCurrent');
  }

  const skipAllBtn = document.getElementById('btn-skip-all');
  if (!skipAllBtn.classList.contains('loading')) {
    document.getElementById('txt-btn-skip-all').textContent = t('btnSkipAll');
  }

  if (currentContext && currentContext.itemType) {
    renderTypePill(currentContext.itemType);
  }
}

function renderTypePill(itemType) {
  const config = TYPE_CONFIG[itemType] || { icon: '📄', en: itemType, vi: itemType };
  document.getElementById('lbl-type-icon').textContent = config.icon;
  document.getElementById('lbl-type-text').textContent = config[currentLang] || config.en || itemType;
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'vi' : 'en';
  localStorage.setItem('coursera_skip_lang', currentLang);
  updateUILanguage();
}

function showAlert(type, message) {
  const el = document.getElementById('result-alert');
  el.style.display = 'block';
  el.style.background = type === 'error' ? 'var(--error-bg)' : 'var(--success-bg)';
  el.style.border = type === 'error' ? '1px solid var(--error-bg)' : '1px solid var(--success-bg)';
  el.style.color = type === 'error' ? 'var(--error)' : 'var(--success)';
  el.textContent = message;
}

function hideAlert() {
  const el = document.getElementById('result-alert');
  el.style.display = 'none';
  el.textContent = '';
}

function setLoading(btnId, textId, loading, customTextKey) {
  const btn = document.getElementById(btnId);
  const textEl = document.getElementById(textId);
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
  if (textEl && customTextKey) {
    textEl.textContent = t(customTextKey);
  }
}

function openReviewPage() {
  localStorage.setItem('coursera_has_rated', 'true');
  const toast = document.getElementById('rating-toast');
  if (toast) toast.style.display = 'none';
  chrome.tabs.create({ url: STORE_REVIEW_URL });
}

function showRatingToast() {
  const hasRated = localStorage.getItem('coursera_has_rated');
  const dismissed = sessionStorage.getItem('coursera_rating_dismissed');
  if (!hasRated && !dismissed) {
    const toast = document.getElementById('rating-toast');
    if (toast) toast.style.display = 'flex';
  }
}

async function getActiveCourseraTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return { tab: null, isCoursera: false };
  const isCoursera = tab.url.startsWith('https://www.coursera.org');
  return { tab: isCoursera ? tab : null, isCoursera, rawTab: tab };
}

async function loadContext() {
  hideAlert();
  try {
    const { tab, isCoursera } = await getActiveCourseraTab();
    
    const guideBtnText = document.getElementById('txt-guide-action-btn');
    if (guideBtnText) {
      guideBtnText.textContent = isCoursera ? t('guideActionBtnTab') : t('guideActionBtnOpen');
    }

    if (!tab) throw new Error('Not on Coursera');

    const context = await chrome.tabs.sendMessage(tab.id, { action: 'getContext' });
    if (!context || context.error || !context.itemType) {
      throw new Error(context?.error || 'No context');
    }

    currentContext = context;

    document.getElementById('page-status').style.display = 'block';
    document.getElementById('action-buttons').style.display = 'flex';
    document.getElementById('empty-msg').style.display = 'none';

    document.getElementById('lbl-course').textContent = formatCourseSlug(context.courseSlug);
    renderTypePill(context.itemType);

    return context;
  } catch (_) {
    currentContext = null;
    document.getElementById('page-status').style.display = 'none';
    document.getElementById('action-buttons').style.display = 'none';
    document.getElementById('empty-msg').style.display = 'flex';
    return null;
  }
}

async function markCompleted() {
  hideAlert();
  setLoading('btn-skip-current', 'txt-btn-skip-current', true, 'processingCurrent');

  try {
    const { tab } = await getActiveCourseraTab();
    if (!tab) throw new Error(t('notOnLesson'));

    const result = await chrome.tabs.sendMessage(tab.id, { action: 'markCompleted' });
    if (result && result.success) {
      showAlert('success', t('successCurrent'));
      showRatingToast();
      setTimeout(() => {
        chrome.tabs.reload(tab.id);
      }, 1200);
    } else {
      const errorMsg = result?.error?.includes('403') || result?.error?.includes('401')
        ? t('notEnrolled')
        : (result?.error || t('unknownError'));
      showAlert('error', errorMsg);
    }
  } catch (error) {
    showAlert('error', error.message || t('unknownError'));
  } finally {
    setLoading('btn-skip-current', 'txt-btn-skip-current', false, 'btnSkipCurrent');
  }
}

async function markAllCompleted() {
  hideAlert();
  setLoading('btn-skip-all', 'txt-btn-skip-all', true, 'startingBulk');

  const progContainer = document.getElementById('bulk-progress-container');
  const progMsg = document.getElementById('bulk-progress-msg');
  const progBar = document.getElementById('bulk-progress-bar');
  const progPct = document.getElementById('bulk-progress-pct');

  progContainer.style.display = 'block';
  progMsg.textContent = t('startingBulk');
  progBar.style.width = '0%';
  progPct.textContent = '0%';

  try {
    const { tab } = await getActiveCourseraTab();
    if (!tab) throw new Error(t('notOnLesson'));

    const result = await chrome.tabs.sendMessage(tab.id, { action: 'markAllCompleted' });
    if (!result || !result.success) {
      throw new Error(result?.error || t('unknownError'));
    }
  } catch (error) {
    showAlert('error', error.message || t('unknownError'));
    setLoading('btn-skip-all', 'txt-btn-skip-all', false, 'btnSkipAll');
    progContainer.style.display = 'none';
  }
}

// Progress listener
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'progressUpdate') {
    const progContainer = document.getElementById('bulk-progress-container');
    const progMsg = document.getElementById('bulk-progress-msg');
    const progBar = document.getElementById('bulk-progress-bar');
    const progPct = document.getElementById('bulk-progress-pct');

    if (message.status === 'loading') {
      progMsg.textContent = t('fetchingCurriculum');
    } else if (message.status === 'starting' || message.status === 'progress') {
      const current = message.current || 0;
      const total = message.total || 1;
      const pct = Math.min(100, Math.round((current / total) * 100));
      progBar.style.width = `${pct}%`;
      progPct.textContent = `${pct}%`;
      progMsg.textContent = t('processingBulk', { current, total });
    } else if (message.status === 'completed') {
      const total = message.total || message.current || '';
      progBar.style.width = '100%';
      progPct.textContent = '100%';
      progMsg.textContent = t('completedBulk', { total });
      setLoading('btn-skip-all', 'txt-btn-skip-all', false, 'btnSkipAll');
      showRatingToast();

      setTimeout(async () => {
        const { tab } = await getActiveCourseraTab();
        if (tab) chrome.tabs.reload(tab.id);
      }, 1500);
    } else if (message.status === 'error') {
      showAlert('error', message.message || t('unknownError'));
      setLoading('btn-skip-all', 'txt-btn-skip-all', false, 'btnSkipAll');
      progContainer.style.display = 'none';
    } else if (typeof message.message === 'string') {
      progMsg.textContent = message.message;
    }
  }
});

// Event Listeners
document.getElementById('btn-lang-toggle').addEventListener('click', toggleLanguage);
document.getElementById('btn-skip-current').addEventListener('click', markCompleted);
document.getElementById('btn-skip-all').addEventListener('click', markAllCompleted);

document.getElementById('lnk-footer-rate').addEventListener('click', (e) => {
  e.preventDefault();
  openReviewPage();
});

document.getElementById('btn-rate-store').addEventListener('click', openReviewPage);
document.getElementById('btn-close-rating').addEventListener('click', () => {
  sessionStorage.setItem('coursera_rating_dismissed', 'true');
  const toast = document.getElementById('rating-toast');
  if (toast) toast.style.display = 'none';
});

document.getElementById('btn-guide-action').addEventListener('click', async () => {
  const { tab, isCoursera } = await getActiveCourseraTab();
  if (isCoursera) {
    loadContext();
  } else {
    chrome.tabs.create({ url: 'https://www.coursera.org' });
  }
});

// Init
updateUILanguage();
loadContext();
