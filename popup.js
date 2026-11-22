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
    guideActionBtnTab: 'Refresh Detection',
    guideActionBtnOpen: 'Open Coursera',
    btnSkipCurrent: 'Complete Current Lesson',
    btnSkipAll: 'Complete All Video & Reading',
    btnSkipAllDiscussions: 'Complete All Discussions',
    btnAutoReview: 'Auto Grade Peer Review',
    processingCurrent: 'Completing...',
    processingReview: 'Grading peer review...',
    processingDiscussion: 'Posting discussion...',
    successCurrent: 'Lesson completed successfully.',
    successLecture: 'Video completed successfully.',
    successSupplement: 'Reading completed successfully.',
    successReview: 'Peer review graded successfully.',
    successDiscussion: 'Discussion posted successfully.',
    startingBulk: 'Starting automation...',
    fetchingCurriculum: 'Loading course lessons...',
    fetchingDiscussions: 'Loading discussions...',
    startingBulkVR: 'Processing {total} lessons...',
    startingBulkDisc: 'Processing {total} discussions...',
    processingBulk: 'Processing: {current} / {total}',
    processingBulkCount: 'Processing: {current} / {total}',
    completedBulk: 'Completed all {total} lessons!',
    completedBulkDisc: 'Completed all {total} discussions!',
    partialBulk: 'Processed: {success} succeeded, {failed} failed.',
    partialBulkDetail: 'Processed: {success} succeeded, {failed} failed ({detail}).',
    partialBulkAlert: 'Some lessons could not be completed.',
    ratingLabel: 'Lesson Completed',
    ratingLabelBulk: 'Completed {total} Lessons',
    ratingLabelMilestone: 'Milestone: {total} Lessons',
    ratingMsg: 'Saved your time? Consider leaving a review on Chrome Web Store.',
    ratingMsgBulk: 'Saved ~{mins} mins. If you find this tool helpful, please leave a quick review on the Store!',
    ratingMsgMilestone: 'You have completed {total} lessons with this tool. Please rate us on Chrome Web Store!',
    rateToastMsg: 'Saved your time? Consider leaving a review on Chrome Web Store.',
    rateToastMsgBulk: 'Saved ~{mins} mins. If you find this tool helpful, please leave a quick review on the Store!',
    rateToastMsgMilestone: 'You have completed {total} lessons with this tool. Please rate us on Chrome Web Store!',
    btnRate: 'Rate on Store',
    btnAlreadyRated: 'Already Rated',
    btnReloadCoursera: 'Reload Page',
    ratingThankYou: 'Thank you for your support!',
    footerRate: 'Rate on Store',
    footerDonate: '☕ Support',
    footerGuide: '❓ Guide',
    bulkLabel: 'Bulk actions',
    confirmTitle: 'Run on the whole course?',
    confirmBulkVR: 'This marks every video and reading in this course as completed on your Coursera account. It cannot be undone from here.',
    confirmBulkDisc: 'This posts discussion replies across the whole course using your account. Posted replies cannot be undone from here.',
    btnCancel: 'Cancel',
    btnContinue: 'Continue',
    notOnLesson: 'Please open a Coursera lesson page first.',
    notEnrolled: 'Permission denied. Make sure you are enrolled in the course.',
    notLoggedIn: 'Please sign in to Coursera first.',
    noItemsFound: 'No eligible lessons found in this course.',
    unknownError: 'An error occurred. Check Console (F12).',
    settingsTitle: 'AI Settings (Gemini / GPT / Groq)',
    apiKeyLabel: 'API Key',
    apiKeySave: 'Save',
    apiKeySaved: 'API key saved successfully!',
    apiKeyActive: 'Key saved',
    apiKeyNone: 'No key saved',
    apiKeyEnterNew: 'Paste new key to replace...',
    apiKeyDefaultPlaceholder: 'Paste API Key...',
    apiKeyDelete: 'Delete key',
    apiKeyDeleted: 'API key deleted!',
    apiKeyEmptyErr: 'Please enter an API key.',
    apiKeyPromptPaste: 'Please paste a new key into the box to replace.',
    apiKeyHint: 'Select provider and enter your API key.',
    apiKeyPaste: 'Paste',
    apiKeyPasted: 'Key pasted from clipboard!',
    peerAlreadySelected: 'Grading criteria already selected. Review and submit.',
    peerFormNotFound: 'Review form not found. Make sure review form is loaded.',
    peerSuccess: 'Grading criteria and feedback filled. Please review and submit.',
    discAlreadyAnswered: 'You have already answered this discussion prompt.',
    discReplySuccess: 'Discussion reply posted successfully!',
    discReplyReady: 'Discussion answer filled. Please review and click Reply.',
    quizNoApiKey: 'API key not configured. Open AI Settings to enter your key.',
    quizNoQuestions: 'No quiz questions found on this page.',
    quizSuccess: 'AI answered {filled} questions. Please review and submit.',
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
    guideActionBtnTab: 'Nhận diện lại',
    guideActionBtnOpen: 'Mở Coursera',
    btnSkipCurrent: 'Hoàn thành bài hiện tại',
    btnSkipAll: 'Hoàn thành toàn bộ Video & Reading',
    btnSkipAllDiscussions: 'Hoàn thành toàn bộ Discussion',
    btnAutoReview: 'Tự động chấm bài bạn học',
    processingCurrent: 'Đang xử lý...',
    processingReview: 'Đang tự động chấm bài...',
    processingDiscussion: 'Đang đăng câu trả lời...',
    successCurrent: 'Đã hoàn thành bài học.',
    successLecture: 'Video đã hoàn thành.',
    successSupplement: 'Bài đọc đã hoàn thành.',
    successReview: 'Đã chấm xong bài bạn học.',
    successDiscussion: 'Đã đăng thảo luận thành công.',
    startingBulk: 'Đang bắt đầu...',
    fetchingCurriculum: 'Đang tải danh sách bài học...',
    fetchingDiscussions: 'Đang tải danh sách bài thảo luận...',
    startingBulkVR: 'Bắt đầu xử lý {total} bài học...',
    startingBulkDisc: 'Bắt đầu xử lý {total} bài thảo luận...',
    processingBulk: 'Đang xử lý: {current} / {total}',
    processingBulkCount: 'Đang xử lý: {current} / {total}',
    completedBulk: 'Hoàn thành toàn bộ {total} bài học Video & Reading!',
    completedBulkDisc: 'Hoàn thành toàn bộ {total} bài thảo luận!',
    partialBulk: 'Đã xử lý: {success} thành công, {failed} thất bại.',
    partialBulkDetail: 'Đã xử lý: {success} thành công, {failed} thất bại ({detail}).',
    partialBulkAlert: 'Một số bài chưa thể hoàn thành.',
    ratingLabel: 'Hoàn thành bài học',
    ratingLabelBulk: 'Hoàn thành {total} bài học',
    ratingLabelMilestone: 'Cột mốc {total} bài học',
    ratingMsg: 'Tiết kiệm thời gian cho bạn? Hãy để lại đánh giá trên Cửa hàng nhé.',
    ratingMsgBulk: 'Tiết kiệm ~{mins} phút học tập. Nếu thấy tiện ích hữu ích, hãy để lại đánh giá trên Cửa hàng nhé!',
    ratingMsgMilestone: 'Bạn đã hoàn thành {total} bài học cùng tiện ích. Hãy để lại đánh giá trên Cửa hàng nhé!',
    rateToastMsg: 'Tiết kiệm thời gian cho bạn? Hãy để lại đánh giá trên Cửa hàng nhé.',
    rateToastMsgBulk: 'Tiết kiệm ~{mins} phút học tập. Nếu thấy tiện ích hữu ích, hãy để lại đánh giá trên Cửa hàng nhé!',
    rateToastMsgMilestone: 'Bạn đã hoàn thành {total} bài học cùng tiện ích. Hãy để lại đánh giá trên Cửa hàng nhé!',
    btnRate: 'Đánh giá trên Cửa hàng',
    btnAlreadyRated: 'Đã đánh giá',
    btnReloadCoursera: 'Tải lại trang',
    ratingThankYou: 'Cảm ơn bạn đã luôn ủng hộ tiện ích!',
    footerRate: 'Đánh giá trên Cửa hàng',
    footerDonate: '☕ Ủng hộ',
    footerGuide: '❓ Hướng dẫn',
    bulkLabel: 'Thao tác hàng loạt',
    confirmTitle: 'Chạy trên toàn bộ khóa học?',
    confirmBulkVR: 'Thao tác này đánh dấu hoàn thành mọi video và bài đọc trong khóa học trên tài khoản Coursera của bạn. Không thể hoàn tác từ tiện ích.',
    confirmBulkDisc: 'Thao tác này đăng phản hồi thảo luận trên toàn khóa học bằng tài khoản của bạn. Không thể hoàn tác các phản hồi đã đăng từ tiện ích.',
    btnCancel: 'Hủy',
    btnContinue: 'Tiếp tục',
    notOnLesson: 'Vui lòng mở trang bài học Coursera trước.',
    notEnrolled: 'Không có quyền. Hãy chắc chắn bạn đã đăng ký khóa học.',
    notLoggedIn: 'Vui lòng đăng nhập Coursera trước.',
    noItemsFound: 'Không tìm thấy bài học phù hợp trong khóa học.',
    unknownError: 'Đã xảy ra lỗi. Kiểm tra Console (F12).',
    settingsTitle: 'Cài đặt AI (Gemini / GPT / Groq)',
    apiKeyLabel: 'API Key',
    apiKeySave: 'Lưu',
    apiKeySaved: 'Đã lưu API key thành công!',
    apiKeyActive: 'Đã lưu key',
    apiKeyNone: 'Chưa có key',
    apiKeyEnterNew: 'Dán key mới để thay đổi...',
    apiKeyDefaultPlaceholder: 'Dán API Key...',
    apiKeyDelete: 'Xóa key',
    apiKeyDeleted: 'Đã xóa API key!',
    apiKeyEmptyErr: 'Vui lòng nhập API key.',
    apiKeyPromptPaste: 'Vui lòng dán key mới vào ô nhập để thay đổi.',
    apiKeyHint: 'Chọn nhà cung cấp và nhập API key tương ứng.',
    apiKeyPaste: 'Dán',
    apiKeyPasted: 'Đã dán key từ Clipboard!',
    peerAlreadySelected: 'Các tiêu chí đã được chọn trước đó. Bạn có thể kiểm tra và bấm nộp.',
    peerFormNotFound: 'Không tìm thấy form chấm bài. Hãy chắc chắn form đã tải xong.',
    peerSuccess: 'Đã chọn tiêu chí và điền nhận xét! Hãy kiểm tra và bấm nộp bài.',
    discAlreadyAnswered: 'Bạn đã đăng câu trả lời cho bài thảo luận này từ trước rồi!',
    discReplySuccess: 'Đã đăng câu trả lời thảo luận thành công!',
    discReplyReady: 'Đã điền câu trả lời. Hãy kiểm tra và bấm Reply nhé.',
    quizNoApiKey: 'Chưa nhập API Key. Bấm Cài đặt AI để thêm key.',
    quizNoQuestions: 'Không tìm thấy câu hỏi quiz nào trên trang.',
    quizSuccess: 'AI đã điền {filled} câu hỏi. Hãy kiểm tra lại và bấm nộp bài.',
  }
};

const AI_PROVIDERS = {
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    placeholder: 'AIzaSy...',
    labelVi: 'Gemini API Key',
    labelEn: 'Gemini API Key',
    hintVi: 'Lấy key miễn phí tại Google AI Studio (aistudio.google.com)',
    hintEn: 'Get a free key at Google AI Studio (aistudio.google.com)',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT)',
    placeholder: 'sk-proj-... / sk-...',
    labelVi: 'OpenAI (GPT) API Key',
    labelEn: 'OpenAI (GPT) API Key',
    hintVi: 'Lấy key tại OpenAI Platform (platform.openai.com)',
    hintEn: 'Get your key at OpenAI Platform (platform.openai.com)',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    placeholder: 'gsk_...',
    labelVi: 'Groq API Key',
    labelEn: 'Groq API Key',
    hintVi: 'Lấy key siêu tốc, miễn phí tại GroqCloud (console.groq.com)',
    hintEn: 'Get a free, ultra-fast key at GroqCloud (console.groq.com)',
  },
};

let currentPopupProvider = 'gemini';

const TYPE_CONFIG = {
  course: { en: 'Course Overview', vi: 'Trang khóa học' },
  lecture: { en: 'Video Lecture', vi: 'Bài giảng Video' },
  supplement: { en: 'Reading Material', vi: 'Tài liệu Đọc' },
  quiz: { en: 'Quiz Assessment', vi: 'Bài kiểm tra (Quiz)' },
  programming: { en: 'Programming Lab', vi: 'Bài tập Thực hành' },
  peer: { en: 'Peer Review', vi: 'Bài tập Chấm chéo' },
  discussionPrompt: { en: 'Discussion Prompt', vi: 'Câu hỏi thảo luận' },
  dialogue: { en: 'Dialogue', vi: 'Hội thoại (Dialogue)' },
};

let currentLang = localStorage.getItem('coursera_skip_lang') || (navigator.language?.startsWith('vi') ? 'vi' : 'en');
let currentContext = null;
let lastIsCoursera = false;

try {
  chrome.storage.local.get('coursera_skip_lang', (res) => {
    if (res && res.coursera_skip_lang && res.coursera_skip_lang !== currentLang) {
      currentLang = res.coursera_skip_lang;
      localStorage.setItem('coursera_skip_lang', currentLang);
      updateUILanguage();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.coursera_skip_lang) {
      currentLang = changes.coursera_skip_lang.newValue;
      localStorage.setItem('coursera_skip_lang', currentLang);
      updateUILanguage();
    }
  });
} catch (_) {}

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

  const guideActionBtn = document.getElementById('txt-guide-action-btn');
  if (guideActionBtn) {
    guideActionBtn.textContent = lastIsCoursera ? t('guideActionBtnTab') : t('guideActionBtnOpen');
  }

  const rateBtnTxt = document.getElementById('txt-btn-rate-store');
  if (rateBtnTxt) rateBtnTxt.textContent = t('btnRate');
  const alreadyRatedTxt = document.getElementById('txt-btn-already-rated');
  if (alreadyRatedTxt) alreadyRatedTxt.textContent = t('btnAlreadyRated');
  const reloadCourseraTxt = document.getElementById('txt-btn-reload-coursera');
  if (reloadCourseraTxt) reloadCourseraTxt.textContent = t('btnReloadCoursera');
  const footerRateTxt = document.getElementById('txt-footer-rate');
  if (footerRateTxt) footerRateTxt.textContent = t('footerRate');
  document.getElementById('txt-bulk-label').textContent = t('bulkLabel');
  document.getElementById('txt-confirm-title').textContent = t('confirmTitle');
  document.getElementById('txt-confirm-cancel').textContent = t('btnCancel');
  document.getElementById('txt-confirm-ok').textContent = t('btnContinue');
  const footerGuideTxt = document.getElementById('txt-footer-guide');
  if (footerGuideTxt) footerGuideTxt.textContent = t('footerGuide');
  const footerDonateTxt = document.getElementById('txt-footer-donate');
  if (footerDonateTxt) footerDonateTxt.textContent = t('footerDonate');

  const skipCurrentBtn = document.getElementById('btn-skip-current');
  if (!skipCurrentBtn.classList.contains('loading')) {
    document.getElementById('txt-btn-skip-current').textContent = t('btnSkipCurrent');
  }

  const skipAllBtn = document.getElementById('btn-skip-all');
  if (!skipAllBtn.classList.contains('loading')) {
    document.getElementById('txt-btn-skip-all').textContent = t('btnSkipAll');
  }

  const autoReviewBtn = document.getElementById('btn-auto-review');
  if (autoReviewBtn && !autoReviewBtn.classList.contains('loading')) {
    document.getElementById('txt-btn-auto-review').textContent = t('btnAutoReview');
  }

  const skipAllDiscBtn = document.getElementById('btn-skip-all-discussions');
  if (skipAllDiscBtn && !skipAllDiscBtn.classList.contains('loading')) {
    document.getElementById('txt-btn-skip-all-discussions').textContent = t('btnSkipAllDiscussions');
  }

  const settingsTitle = document.getElementById('txt-popup-settings-title');
  if (settingsTitle) settingsTitle.textContent = t('settingsTitle');
  const apiKeyLabel = document.getElementById('txt-popup-api-key-label');
  if (apiKeyLabel) apiKeyLabel.textContent = t('apiKeyLabel');
  const saveKeyBtn = document.getElementById('popup-save-key-btn');
  if (saveKeyBtn) saveKeyBtn.textContent = t('apiKeySave');
  const pasteKeyTxt = document.getElementById('txt-popup-paste-key');
  if (pasteKeyTxt) pasteKeyTxt.textContent = t('apiKeyPaste');
  const deleteKeyTxt = document.getElementById('txt-popup-delete-key');
  if (deleteKeyTxt) deleteKeyTxt.textContent = t('apiKeyDelete');
  const apiKeyHint = document.getElementById('txt-popup-api-key-hint');
  if (apiKeyHint) apiKeyHint.textContent = t('apiKeyHint');

  refreshPopupApiKeyUI();

  if (currentContext && currentContext.itemType) {
    renderTypePill(currentContext.itemType);
  }
}

function refreshPopupApiKeyUI(preferredProvider) {
  const badge = document.getElementById('popup-key-status-badge');
  const mask = document.getElementById('popup-key-mask-preview');
  const input = document.getElementById('popup-api-key-input');
  const deleteBtn = document.getElementById('popup-delete-key-btn');
  const label = document.getElementById('txt-popup-api-key-label');
  const hint = document.getElementById('txt-popup-api-key-hint');
  const tabs = document.querySelectorAll('.provider-tab');

  function renderWithConfig(cfg) {
    if (preferredProvider && AI_PROVIDERS[preferredProvider]) {
      currentPopupProvider = preferredProvider;
    } else if (cfg?.activeProvider && AI_PROVIDERS[cfg.activeProvider]) {
      currentPopupProvider = cfg.activeProvider;
    }

    tabs.forEach((tab) => {
      if (tab.dataset.provider === currentPopupProvider) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    const provInfo = AI_PROVIDERS[currentPopupProvider] || AI_PROVIDERS.gemini;
    const keys = cfg?.keys || {};
    const key = keys[currentPopupProvider] || (currentPopupProvider === 'gemini' ? (cfg?.apiKey || null) : null);

    if (label) {
      label.textContent = currentLang === 'vi' ? provInfo.labelVi : provInfo.labelEn;
    }
    if (hint) {
      hint.textContent = currentLang === 'vi' ? provInfo.hintVi : provInfo.hintEn;
    }

    if (key && key.trim()) {
      const masked = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '••••••••';
      if (badge) {
        badge.textContent = `● ${t('apiKeyActive')}`;
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        badge.style.color = '#34d399';
        badge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
      }
      if (mask) mask.textContent = `(${masked})`;
      if (input) input.placeholder = t('apiKeyEnterNew');
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else {
      if (badge) {
        badge.textContent = `○ ${t('apiKeyNone')}`;
        badge.style.background = 'rgba(239, 68, 68, 0.12)';
        badge.style.color = '#f87171';
        badge.style.border = '1px solid rgba(239, 68, 68, 0.25)';
      }
      if (mask) mask.textContent = '';
      if (input) input.placeholder = provInfo.placeholder || t('apiKeyDefaultPlaceholder');
      if (deleteBtn) deleteBtn.style.display = 'none';
    }
  }

  let called = false;
  try {
    chrome.runtime.sendMessage({ action: 'getAiConfig' }, (res) => {
      called = true;
      if (res && res.keys) {
        renderWithConfig(res);
      } else {
        chrome.runtime.sendMessage({ action: 'getGeminiApiKey' }, (geminiRes) => {
          renderWithConfig({
            activeProvider: 'gemini',
            keys: { gemini: geminiRes?.apiKey || null },
            apiKey: geminiRes?.apiKey || null,
          });
        });
      }
    });
  } catch (_) {}

  if (!called) {
    try {
      chrome.runtime.sendMessage({ action: 'getGeminiApiKey' }, (geminiRes) => {
        if (!called && geminiRes !== undefined) {
          renderWithConfig({
            activeProvider: 'gemini',
            keys: { gemini: geminiRes?.apiKey || null },
            apiKey: geminiRes?.apiKey || null,
          });
        }
      });
    } catch (_) {}
  }
}

function renderTypePill(itemType) {
  const config = TYPE_CONFIG[itemType] || { en: itemType, vi: itemType };
  const iconEl = document.getElementById('lbl-type-icon');
  if (iconEl) iconEl.textContent = config.icon || '';
  const textEl = document.getElementById('lbl-type-text');
  if (textEl) textEl.textContent = config[currentLang] || config.en || itemType;
}

async function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'vi' : 'en';
  localStorage.setItem('coursera_skip_lang', currentLang);
  try {
    await chrome.storage.local.set({ coursera_skip_lang: currentLang });
  } catch (_) {}
  updateUILanguage();
}

function showAlert(type, message) {
  const el = document.getElementById('result-alert');
  el.style.display = 'block';
  if (type === 'warning') {
    el.style.background = 'rgba(245, 158, 11, 0.15)';
    el.style.border = '1px solid rgba(245, 158, 11, 0.3)';
    el.style.color = '#fbbf24';
  } else if (type === 'error') {
    el.style.background = 'var(--error-bg)';
    el.style.border = '1px solid var(--error-bg)';
    el.style.color = 'var(--error)';
  } else {
    el.style.background = 'var(--success-bg)';
    el.style.border = '1px solid var(--success-bg)';
    el.style.color = 'var(--success)';
  }
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

async function isRatingDismissedOrRated() {
  if (localStorage.getItem('coursera_has_rated') === 'true') {
    return true;
  }
  try {
    const data = await chrome.storage.local.get(['coursera_has_rated', 'coursera_remind_until']);
    if (data.coursera_has_rated === true) {
      return true;
    }
    if (data.coursera_remind_until && Date.now() < data.coursera_remind_until) {
      return true;
    }
  } catch (e) {
    console.warn('[Popup] Storage check failed:', e);
  }
  return false;
}

async function markAsRated() {
  localStorage.setItem('coursera_has_rated', 'true');
  try {
    await chrome.storage.local.set({ coursera_has_rated: true });
  } catch (e) {
    console.warn('[Popup] Storage save failed:', e);
  }
}

const GUIDE_URL = 'https://tuankiet18-dev.github.io/coursera-skip-privacy/guide.html';
const DONATE_URL = 'https://tuankiet18-dev.github.io/coursera-skip-privacy/donate.html';

async function openReviewPage() {
  await markAsRated();
  const toast = document.getElementById('rating-toast');
  if (toast) toast.style.display = 'none';
  chrome.tabs.create({ url: STORE_REVIEW_URL });
}

async function handleAlreadyRated() {
  await markAsRated();
  const msgEl = document.getElementById('txt-rating-msg');
  if (msgEl) msgEl.textContent = t('ratingThankYou');
  const rateBtn = document.getElementById('btn-rate-store');
  if (rateBtn) rateBtn.style.display = 'none';
  const secActions = document.querySelector('.rating-secondary-actions');
  if (secActions) secActions.style.display = 'none';
  setTimeout(() => {
    const toast = document.getElementById('rating-toast');
    if (toast) toast.style.display = 'none';
  }, 1400);
}

async function handleCloseRating() {
  const toast = document.getElementById('rating-toast');
  if (toast) toast.style.display = 'none';
  // Remind after 7 days
  const remindUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
  try {
    await chrome.storage.local.set({ coursera_remind_until: remindUntil });
  } catch (e) {}
}

async function handleReloadCoursera() {
  const { tab } = await getActiveCourseraTab();
  if (tab && tab.id) {
    chrome.tabs.reload(tab.id);
  }
}

async function recordSingleLessonCompleted() {
  try {
    const data = await chrome.storage.local.get('coursera_completed_count');
    const newCount = (data.coursera_completed_count || 0) + 1;
    await chrome.storage.local.set({ coursera_completed_count: newCount });
    if (newCount === 5 || newCount === 25 || newCount === 50) {
      const isDismissed = await isRatingDismissedOrRated();
      if (!isDismissed) {
        showCelebrationPrompt({ totalLessons: newCount, isMilestone: true });
      }
    }
  } catch (e) {}
}

async function showCelebrationPrompt(opts = {}) {
  const isDismissed = await isRatingDismissedOrRated();
  if (isDismissed) return;

  const toast = document.getElementById('rating-toast');
  if (!toast) return;

  const labelEl = document.getElementById('txt-rating-label');
  const msgEl = document.getElementById('txt-rating-msg');
  const reloadBtn = document.getElementById('btn-reload-coursera');
  const rateBtn = document.getElementById('btn-rate-store');
  const secActions = document.querySelector('.rating-secondary-actions');

  if (rateBtn) rateBtn.style.display = 'flex';
  if (secActions) secActions.style.display = 'flex';

  if (opts.isBulk) {
    const total = opts.totalLessons || 1;
    const mins = Math.max(15, total * 5);
    if (labelEl) labelEl.textContent = t('ratingLabelBulk', { total });
    if (msgEl) msgEl.textContent = t('ratingMsgBulk', { mins });
    if (reloadBtn) reloadBtn.style.display = 'inline-flex';
  } else if (opts.isMilestone) {
    const total = opts.totalLessons || 5;
    if (labelEl) labelEl.textContent = t('ratingLabelMilestone', { total });
    if (msgEl) msgEl.textContent = t('ratingMsgMilestone', { total });
    if (reloadBtn) reloadBtn.style.display = 'none';
  } else {
    if (labelEl) labelEl.textContent = t('ratingLabel');
    if (msgEl) msgEl.textContent = t('ratingMsg');
    if (reloadBtn) reloadBtn.style.display = 'none';
  }

  toast.style.display = 'flex';
  try {
    toast.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (_) {}
}

function showRatingToast() {
  showCelebrationPrompt();
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
    lastIsCoursera = !!isCoursera;

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

    // Switch buttons based on context
    const isPeer = context.itemType === 'peer';

    // 1. Hoàn thành bài hiện tại (hoặc nút Chấm bài nếu là Peer Review)
    if (isPeer) {
      document.getElementById('btn-auto-review').style.display = 'flex';
      document.getElementById('btn-skip-current').style.display = 'none';
    } else {
      document.getElementById('btn-auto-review').style.display = 'none';
      document.getElementById('btn-skip-current').style.display = 'flex';
    }

    // 2. Hoàn thành toàn bộ Video & Reading (luôn hiển thị trong khóa học)
    document.getElementById('btn-skip-all').style.display = 'flex';

    // 3. Hoàn thành toàn bộ Discussion (luôn hiển thị trong khóa học)
    document.getElementById('btn-skip-all-discussions').style.display = 'flex';

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
      const msg = (result.key && t(result.key, result.params)) || result.message || t('successCurrent');
      showAlert('success', msg);
      recordSingleLessonCompleted();
      if (result.submitted === true) {
        setTimeout(() => {
          chrome.tabs.reload(tab.id);
        }, 1200);
      }
    } else {
      const errorMsg = (result?.key && t(result.key, result.params)) ||
        (result?.error?.includes('403') || result?.error?.includes('401')
          ? t('notEnrolled')
          : (result?.error || t('unknownError')));
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

async function autoGradePeerReview() {
  hideAlert();
  setLoading('btn-auto-review', 'txt-btn-auto-review', true, 'processingReview');

  try {
    const { tab } = await getActiveCourseraTab();
    if (!tab) throw new Error(t('notOnLesson'));

    const result = await chrome.tabs.sendMessage(tab.id, { action: 'autoGradePeerReview' });
    if (result && result.success) {
      const msg = (result.key && t(result.key, result.params)) || result.message || t('successReview');
      showAlert('success', msg);
      recordSingleLessonCompleted();
    } else {
      const errorMsg = (result?.key && t(result.key, result.params)) || result?.error || t('unknownError');
      showAlert('error', errorMsg);
    }
  } catch (error) {
    showAlert('error', error.message || t('unknownError'));
  } finally {
    setLoading('btn-auto-review', 'txt-btn-auto-review', false, 'btnAutoReview');
  }
}

async function markAllDiscussionsCompleted() {
  hideAlert();
  setLoading('btn-skip-all-discussions', 'txt-btn-skip-all-discussions', true, 'startingBulk');

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

    const result = await chrome.tabs.sendMessage(tab.id, { action: 'markAllDiscussionsCompleted' });
    if (!result || !result.success) {
      throw new Error(result?.error || t('unknownError'));
    }
  } catch (error) {
    showAlert('error', error.message || t('unknownError'));
    setLoading('btn-skip-all-discussions', 'txt-btn-skip-all-discussions', false, 'btnSkipAllDiscussions');
    progContainer.style.display = 'none';
  }
}

// Progress listener
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.action === 'progressUpdate') {
    const progContainer = document.getElementById('bulk-progress-container');
    const progMsg = document.getElementById('bulk-progress-msg');
    const progBar = document.getElementById('bulk-progress-bar');
    const progPct = document.getElementById('bulk-progress-pct');

    if (message.status === 'loading') {
      progMsg.textContent = (message.key && t(message.key, message.params)) || message.message || t('fetchingCurriculum');
    } else if (message.status === 'starting' || message.status === 'progress') {
      const current = message.current || 0;
      const total = message.total || 1;
      const pct = Math.min(100, Math.round((current / total) * 100));
      progBar.style.width = `${pct}%`;
      progPct.textContent = `${pct}%`;
      progMsg.textContent = (message.key && t(message.key, message.params)) || message.message || t('processingBulk', { current, total });
    } else if (message.status === 'completed') {
      const total = message.total || message.current || '';
      progBar.style.width = '100%';
      progPct.textContent = '100%';
      progMsg.textContent = (message.key && t(message.key, message.params)) || message.message || t('completedBulk', { total });
      setLoading('btn-skip-all', 'txt-btn-skip-all', false, 'btnSkipAll');
      setLoading('btn-skip-all-discussions', 'txt-btn-skip-all-discussions', false, 'btnSkipAllDiscussions');

      // Tăng biến đếm tổng số bài đã hoàn thành
      try {
        const data = await chrome.storage.local.get('coursera_completed_count');
        const countNumber = parseInt(total, 10) || 1;
        await chrome.storage.local.set({ coursera_completed_count: (data.coursera_completed_count || 0) + countNumber });
      } catch (_) {}

      const isDismissedOrRated = await isRatingDismissedOrRated();
      if (!isDismissedOrRated) {
        showCelebrationPrompt({ totalLessons: parseInt(total, 10) || 1, isBulk: true });
      } else {
        setTimeout(async () => {
          const { tab } = await getActiveCourseraTab();
          if (tab) chrome.tabs.reload(tab.id);
        }, 1500);
      }
    } else if (message.status === 'partial') {
      const total = message.total || message.current || '';
      progBar.style.width = '100%';
      progPct.textContent = '100%';
      progMsg.textContent = (message.key && t(message.key, message.params)) || message.message || t('partialBulk');
      setLoading('btn-skip-all', 'txt-btn-skip-all', false, 'btnSkipAll');
      setLoading('btn-skip-all-discussions', 'txt-btn-skip-all-discussions', false, 'btnSkipAllDiscussions');
      showAlert('warning', t('partialBulkAlert'));
    } else if (message.status === 'error') {
      showAlert('error', (message.key && t(message.key, message.params)) || message.message || t('unknownError'));
      setLoading('btn-skip-all', 'txt-btn-skip-all', false, 'btnSkipAll');
      setLoading('btn-skip-all-discussions', 'txt-btn-skip-all-discussions', false, 'btnSkipAllDiscussions');
      progContainer.style.display = 'none';
    } else if (typeof message.message === 'string') {
      progMsg.textContent = message.message;
    }
  }
});

// Event Listeners
document.getElementById('btn-lang-toggle').addEventListener('click', toggleLanguage);
document.getElementById('btn-skip-current').addEventListener('click', markCompleted);
// Bulk actions ask for confirmation once per browser session (per action kind).
const BULK_CONFIRM_KEY = 'coursera_bulk_confirmed';
let pendingBulk = null;

async function bulkAlreadyConfirmed(kind) {
  try {
    const data = await chrome.storage.session.get(BULK_CONFIRM_KEY);
    return !!(data[BULK_CONFIRM_KEY] && data[BULK_CONFIRM_KEY][kind]);
  } catch (_) {
    return false;
  }
}

async function rememberBulkConfirmed(kind) {
  try {
    const data = await chrome.storage.session.get(BULK_CONFIRM_KEY);
    await chrome.storage.session.set({ [BULK_CONFIRM_KEY]: { ...(data[BULK_CONFIRM_KEY] || {}), [kind]: true } });
  } catch (_) {}
}

function hideBulkConfirm() {
  pendingBulk = null;
  document.getElementById('bulk-confirm').style.display = 'none';
}

async function requestBulk(kind, msgKey, run) {
  hideAlert();
  if (await bulkAlreadyConfirmed(kind)) return run();
  pendingBulk = { kind, run };
  document.getElementById('txt-confirm-msg').textContent = t(msgKey);
  const panel = document.getElementById('bulk-confirm');
  panel.style.display = 'flex';
  document.getElementById('btn-confirm-ok').focus();
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('btn-confirm-cancel').addEventListener('click', hideBulkConfirm);
document.getElementById('btn-confirm-ok').addEventListener('click', async () => {
  const job = pendingBulk;
  hideBulkConfirm();
  if (!job) return;
  await rememberBulkConfirmed(job.kind);
  job.run();
});

document.getElementById('btn-skip-all').addEventListener('click', () => requestBulk('vr', 'confirmBulkVR', markAllCompleted));
document.getElementById('btn-skip-all-discussions').addEventListener('click', () => requestBulk('disc', 'confirmBulkDisc', markAllDiscussionsCompleted));
document.getElementById('btn-auto-review').addEventListener('click', autoGradePeerReview);

document.getElementById('lnk-footer-rate').addEventListener('click', (e) => {
  e.preventDefault();
  openReviewPage();
});

document.getElementById('lnk-footer-guide').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: GUIDE_URL });
});

document.getElementById('lnk-footer-donate').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: DONATE_URL });
});

document.getElementById('btn-rate-store').addEventListener('click', openReviewPage);
document.getElementById('btn-already-rated').addEventListener('click', handleAlreadyRated);
document.getElementById('btn-close-rating').addEventListener('click', handleCloseRating);
const btnReloadCoursera = document.getElementById('btn-reload-coursera');
if (btnReloadCoursera) {
  btnReloadCoursera.addEventListener('click', handleReloadCoursera);
}

document.getElementById('btn-guide-action').addEventListener('click', async () => {
  const { tab, isCoursera } = await getActiveCourseraTab();
  if (isCoursera) {
    loadContext();
  } else {
    chrome.tabs.create({ url: 'https://www.coursera.org' });
  }
});

// Settings in Popup
const settingsToggleBtn = document.getElementById('btn-settings-toggle');
const popupSettings = document.getElementById('popup-settings');
const popupKeyInput = document.getElementById('popup-api-key-input');
const popupClearKeyBtn = document.getElementById('popup-clear-key-btn');
const popupToggleEyeBtn = document.getElementById('popup-toggle-eye-btn');
const popupPasteKeyBtn = document.getElementById('popup-paste-key-btn');
const popupSaveKeyBtn = document.getElementById('popup-save-key-btn');
const popupDeleteKeyBtn = document.getElementById('popup-delete-key-btn');
const popupProviderTabs = document.querySelectorAll('.provider-tab');

if (popupProviderTabs) {
  popupProviderTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const prov = tab.dataset.provider;
      if (prov && AI_PROVIDERS[prov]) {
        currentPopupProvider = prov;
        chrome.runtime.sendMessage({ action: 'setAiProvider', provider: prov }, () => {
          refreshPopupApiKeyUI(prov);
          if (popupKeyInput) {
            popupKeyInput.value = '';
            if (popupClearKeyBtn) popupClearKeyBtn.style.display = 'none';
            popupKeyInput.focus();
          }
        });
      }
    });
  });
}

if (settingsToggleBtn && popupSettings) {
  settingsToggleBtn.addEventListener('click', () => {
    const isVisible = popupSettings.style.display !== 'none';
    if (isVisible) {
      popupSettings.style.display = 'none';
    } else {
      popupSettings.style.display = 'block';
      refreshPopupApiKeyUI();
      if (popupKeyInput) {
        popupKeyInput.value = '';
        if (popupClearKeyBtn) popupClearKeyBtn.style.display = 'none';
        setTimeout(() => popupKeyInput.focus(), 80);
      }
    }
  });
}

if (popupKeyInput) {
  popupKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePopupSaveKey();
    }
  });
  popupKeyInput.addEventListener('input', () => {
    if (popupClearKeyBtn) {
      popupClearKeyBtn.style.display = popupKeyInput.value.length > 0 ? 'flex' : 'none';
    }
  });
}

if (popupClearKeyBtn && popupKeyInput) {
  popupClearKeyBtn.addEventListener('click', () => {
    popupKeyInput.value = '';
    popupClearKeyBtn.style.display = 'none';
    popupKeyInput.focus();
  });
}

if (popupToggleEyeBtn && popupKeyInput) {
  popupToggleEyeBtn.addEventListener('click', () => {
    if (popupKeyInput.type === 'password') {
      popupKeyInput.type = 'text';
      popupToggleEyeBtn.textContent = '🙈';
    } else {
      popupKeyInput.type = 'password';
      popupToggleEyeBtn.textContent = '👁️';
    }
  });
}

if (popupPasteKeyBtn && popupKeyInput) {
  popupPasteKeyBtn.addEventListener('click', async () => {
    try {
      let text = '';
      if (navigator.clipboard && navigator.clipboard.readText) {
        text = await navigator.clipboard.readText();
      }
      if (!text || !text.trim()) {
        const prov = AI_PROVIDERS[currentPopupProvider] || AI_PROVIDERS.gemini;
        const msg = currentLang === 'vi'
          ? `Dán ${prov.name} API Key của bạn vào đây:`
          : `Paste your ${prov.name} API Key here:`;
        text = window.prompt(msg);
      }
      if (text && text.trim()) {
        popupKeyInput.value = text.trim();
        if (popupClearKeyBtn) popupClearKeyBtn.style.display = 'flex';
        showAlert('success', t('apiKeyPasted'));
        popupKeyInput.focus();
      }
    } catch (_) {
      const prov = AI_PROVIDERS[currentPopupProvider] || AI_PROVIDERS.gemini;
      const msg = currentLang === 'vi'
        ? `Dán ${prov.name} API Key của bạn vào đây:`
        : `Paste your ${prov.name} API Key here:`;
      const text = window.prompt(msg);
      if (text && text.trim()) {
        popupKeyInput.value = text.trim();
        if (popupClearKeyBtn) popupClearKeyBtn.style.display = 'flex';
        showAlert('success', t('apiKeyPasted'));
        popupKeyInput.focus();
      }
    }
  });
}

if (popupDeleteKeyBtn) {
  popupDeleteKeyBtn.addEventListener('click', () => {
    const prov = currentPopupProvider || 'gemini';
    chrome.runtime.sendMessage({ action: 'removeAiKey', provider: prov }, (res) => {
      if (!res || !res.ok) {
        // Fallback for legacy
        chrome.runtime.sendMessage({ action: 'removeGeminiApiKey' }, () => {
          afterDelete();
        });
        return;
      }
      afterDelete();
    });

    function afterDelete() {
      if (popupKeyInput) popupKeyInput.value = '';
      if (popupClearKeyBtn) popupClearKeyBtn.style.display = 'none';
      showAlert('warning', t('apiKeyDeleted'));
      refreshPopupApiKeyUI(prov);
    }
  });
}

function handlePopupSaveKey() {
  if (!popupKeyInput) return;
  const key = popupKeyInput.value.trim();
  const prov = currentPopupProvider || 'gemini';
  if (!key) {
    chrome.runtime.sendMessage({ action: 'getAiConfig' }, (res) => {
      const existingKey = res?.keys?.[prov] || (prov === 'gemini' ? res?.apiKey : null);
      if (existingKey) {
        showAlert('warning', t('apiKeyPromptPaste'));
      } else {
        showAlert('error', t('apiKeyEmptyErr'));
      }
    });
    return;
  }
  chrome.runtime.sendMessage({ action: 'setAiKey', provider: prov, key }, (res) => {
    if (res && res.ok) {
      popupKeyInput.value = '';
      if (popupClearKeyBtn) popupClearKeyBtn.style.display = 'none';
      showAlert('success', t('apiKeySaved'));
      refreshPopupApiKeyUI(prov);
    } else {
      // Legacy fallback
      chrome.runtime.sendMessage({ action: 'setGeminiApiKey', key }, (legacyRes) => {
        if (legacyRes && legacyRes.ok) {
          popupKeyInput.value = '';
          if (popupClearKeyBtn) popupClearKeyBtn.style.display = 'none';
          showAlert('success', t('apiKeySaved'));
          refreshPopupApiKeyUI(prov);
        } else {
          showAlert('error', t('unknownError'));
        }
      });
    }
  });
}

if (popupSaveKeyBtn) {
  popupSaveKeyBtn.addEventListener('click', handlePopupSaveKey);
}

// Init
updateUILanguage();
loadContext();
