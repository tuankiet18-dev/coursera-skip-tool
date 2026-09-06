/**
 * Content Script - chạy trên mọi trang coursera.org
 *
 * FIX: Các API của Coursera (như onDemandVideos.v1, progressState) 
 * yêu cầu headers authentication (đặc biệt là X-Coursera-Application và CSRF token)
 * để không bị 403 Forbidden. Đã thêm cơ chế gắn headers tự động.
 */

const BASE = 'https://www.coursera.org';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== UTILITIES =====

function getCsrfToken() {
  const match = document.cookie.match(/(^|;\s*)csrf3-token=([^;]+)/);
  return match ? match[2] : '';
}

/**
 * Wrapper cho fetch để tự động thêm các headers bắt buộc của Coursera.
 * Nếu thiếu các headers này, API (đặc biệt là onDemandVideos.v1) sẽ trả về 403.
 */
async function courseraFetch(url, options = {}) {
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    'X-Coursera-Application': 'nautilus',
    'X-Coursera-Version': 'ondemand',
    ...options.headers,
  };
  
  if (!options.method || options.method.toUpperCase() === 'GET') {
    delete headers['Content-Type'];
  } else {
    headers['Content-Type'] = 'application/json';
  }

  const csrf = getCsrfToken();
  if (csrf) {
    headers['X-CSRF3-Token'] = csrf;
    headers['X-CSRFToken'] = csrf;
  }

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
}

function getCourseContext() {
  const href = window.location.href;

  // 1. Standard lesson types (lecture, supplement, quiz, programming, discussionPrompt, dialogue)
  const match = href.match(
    /\/learn\/([^/]+)\/(lecture|supplement|quiz|programming|discussionPrompt|dialogue)\/([^/?#]+)/i
  );
  if (match) {
    let itemType = match[2];
    if (itemType.toLowerCase() === 'discussionprompt') itemType = 'discussionPrompt';
    return { courseSlug: match[1], itemType, itemId: match[3] };
  }

  // 2. Peer review URLs — Coursera uses several patterns:
  //    /learn/{slug}/peer-review/{itemId}
  //    /learn/{slug}/peer-review/{itemId}/give-feedback
  //    /learn/{slug}/peer-review/{itemId}/review
  //    /learn/{slug}/submit-revisions/{itemId}  (resubmit review)
  const peerPatterns = [
    /\/learn\/([^/]+)\/peer-review\/([^/?#]+)/i,
    /\/learn\/([^/]+)\/submit-revisions\/([^/?#]+)/i,
  ];
  for (const pattern of peerPatterns) {
    const m = href.match(pattern);
    if (m) {
      return { courseSlug: m[1], itemType: 'peer', itemId: m[2] };
    }
  }

  // 3. Fallback for any discussionPrompt URL variations
  const discMatch = href.match(/\/learn\/([^/]+)\/discussionPrompt\/([^/?#]+)/i);
  if (discMatch) {
    return { courseSlug: discMatch[1], itemType: 'discussionPrompt', itemId: discMatch[2] };
  }

  return null;
}

// ===== LẤY courseId VÀ userId =====

async function getCourseId(courseSlug) {
  try {
    const res = await fetch(`${BASE}/api/onDemandCourses.v1?q=slug&slug=${courseSlug}&fields=id`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const id = data?.elements?.[0]?.id ?? null;
    if (id) console.log('[CourseraSkip] courseId:', id);
    return id;
  } catch (e) {
    console.log('[CourseraSkip] getCourseId lỗi:', e.message);
    return null;
  }
}

async function getUserId() {
  // Không dùng chrome.storage.local vì sẽ bị dính cache cũ khi đổi nick
  
  // CÁCH 1: Tìm trong các thẻ script (giống cách mã độc gốc làm)
  try {
    const scripts = document.getElementsByTagName('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (text && text.includes('"email_address"') && text.includes('"id"')) {
        const match = text.match(/"id"\s*:\s*(\d+)/);
        if (match && match[1]) {
          console.log('[CourseraSkip] userId từ script tag:', match[1]);
          return match[1];
        }
      }
      
      // Định dạng Apollo State của Coursera
      if (text && text.includes('ROOT_QUERY') && text.includes('userId')) {
        const match2 = text.match(/"userId"\s*:\s*(\d+)/);
        if (match2 && match2[1]) {
          console.log('[CourseraSkip] userId từ Apollo:', match2[1]);
          return match2[1];
        }
      }
    }
  } catch (e) {
    console.log('[CourseraSkip] Lỗi parse DOM:', e);
  }

  // CÁCH 2: Dùng API hợp lệ với đầy đủ CSRF headers
  try {
    const res = await courseraFetch(`${BASE}/api/users.v1?q=me&fields=id`);
    if (res.ok) {
      const data = await res.json();
      const userId = data?.elements?.[0]?.id ?? null;
      if (userId) {
        console.log('[CourseraSkip] userId từ API:', userId);
        return userId;
      }
    }
  } catch (e) {
    console.log('[CourseraSkip] API users.v1 lỗi:', e.message);
  }

  console.log('[CourseraSkip] Không lấy được userId.');
  return null;
}

// ===== API HELPERS =====


function extractVideoFromLecturePayload(data) {
  const linkedVideos = data?.linked?.['onDemandVideos.v1'];
  if (Array.isArray(linkedVideos) && linkedVideos.length > 0) {
    return linkedVideos[0];
  }
  const videoFromElement = data?.elements?.[0]?.video;
  if (videoFromElement) return videoFromElement;
  return null;
}

async function getVideoMeta(courseId, courseSlug, itemId) {
  const fields = [
    'onDemandVideos.v1(id%2Cduration%2Cname%2Csources%2Csubtitles%2CsubtitlesVtt%2CsubtitlesTxt)',
    'disableSkippingForward',
    'startMs',
    'endMs',
  ].join('%2C');

  const url = `${BASE}/api/onDemandLectureVideos.v1/${courseId}~${itemId}/?includes=video&fields=${fields}`;

  try {
    const res = await courseraFetch(url);
    console.log('[CourseraSkip] onDemandLectureVideos.v1 status:', res.status);
    if (res.ok) {
      const data = await res.json();
      const video = extractVideoFromLecturePayload(data);
      if (video) {
        let durationMs = video.duration;
        if (!durationMs) {
          try {
            const videoEl = document.querySelector('video');
            if (videoEl && videoEl.duration && isFinite(videoEl.duration)) {
              durationMs = Math.round(videoEl.duration * 1000);
            }
          } catch (e) {}
        }
        console.log('[CourseraSkip] videoId:', video.id, '| duration:', durationMs, 'ms');
        return { videoId: video.id, duration: durationMs };
      }
    }
  } catch (e) {
    console.log('[CourseraSkip] onDemandLectureVideos.v1 lỗi:', e.message);
  }

  try {
    const videoEl = document.querySelector('video');
    if (videoEl && videoEl.duration && isFinite(videoEl.duration)) {
      const durationMs = Math.round(videoEl.duration * 1000);
      console.log('[CourseraSkip] duration từ DOM video:', durationMs, 'ms');
      return { videoId: itemId, duration: durationMs };
    }
  } catch (e) {}

  return null;
}

async function reportVideoProgress(userId, courseId, videoId, duration) {
  const progressId = `${userId}~${courseId}~${videoId}`;
  const validDuration = (typeof duration === 'number' && isFinite(duration) && duration > 0) ? duration : 9999999;
  const viewedUpTo = Math.max(0, validDuration - 1000);
  console.log(`[CourseraSkip] reportProgress: viewedUpTo=${viewedUpTo}ms`);
  
  const methods = ['POST', 'PUT'];
  for (const method of methods) {
    try {
      const res = await courseraFetch(`${BASE}/api/onDemandVideoProgresses.v1/${progressId}`, {
        method: method,
        body: JSON.stringify({ viewedUpTo, videoProgressId: progressId }),
      });
      console.log(`[CourseraSkip] reportProgress (${method}) status:`, res.status);
      if (res.ok || res.status === 204) return true;
    } catch (e) {
      console.log(`[CourseraSkip] reportProgress (${method}) lỗi:`, e.message);
    }
  }
  return false;
}

// ===== CORE LOGIC =====

async function markLectureCompleted(userId, courseId, courseSlug, itemId, isBulk = false) {
  console.log(`[CourseraSkip] === B1: Thử complete ngay (${itemId}) ===`);
  const completeUrl = `${BASE}/api/opencourse.v1/user/${userId}/course/${courseSlug}/item/${itemId}/lecture/videoEvents/ended?autoEnroll=false`;
  try {
    const res1 = await courseraFetch(completeUrl, {
      method: 'POST',
      body: JSON.stringify({ contentRequestBody: {} }),
    });
    console.log('[CourseraSkip] B1 complete status:', res1.status);
    if (res1.ok) return { success: true, step: 1 };

    if (res1.status === 403 || res1.status === 401) {
      return { success: false, error: `Lỗi ${res1.status}: Không có quyền thực hiện. Hãy chắc chắn bạn đã enroll (đăng ký) khóa học.` };
    }
  } catch (e) {
    console.log('[CourseraSkip] B1 lỗi:', e.message);
  }

  console.log('[CourseraSkip] === B2: Lấy video metadata ===');
  const meta = await getVideoMeta(courseId, courseSlug, itemId);

  if (!meta) {
    console.log('[CourseraSkip] Không có meta → Fallback PUT progressState');
    const putVariants = [
      `${BASE}/api/opencourse.v1/user/${userId}/course/${courseId}/item/${itemId}/progressState`,
      `${BASE}/api/opencourse.v1/user/${userId}/course/${courseSlug}/item/${itemId}/progressState`,
    ];
    for (const url of putVariants) {
      try {
        const fbRes = await courseraFetch(url, {
          method: 'PUT',
          body: JSON.stringify({ progressState: 'COMPLETED' }),
        });
        console.log('[CourseraSkip] Fallback PUT status:', fbRes.status);
        if (fbRes.ok) return { success: true, step: 'fallback-PUT' };
        if (fbRes.status === 403 || fbRes.status === 401) {
          return { success: false, error: `Lỗi ${fbRes.status}: Không có quyền (chưa enroll).` };
        }
      } catch (e) {}
    }
    return { success: false, error: `Lỗi: Không lấy được video meta và Fallback PUT cũng thất bại. Cần tải lại trang.` };
  }

  console.log('[CourseraSkip] === B3: Báo cáo đã xem gần hết ===');
  const progressOk = await reportVideoProgress(userId, courseId, meta.videoId, meta.duration);

  // === B4: Đúng theo mã gốc - retry actions/complete đến khi backend xử lý xong ===
  // ĐÂY LÀ ĐIỂM QUAN TRỌNG: Gọi videoEvents/ended thay vì actions/complete
  console.log('[CourseraSkip] Retry URL:', completeUrl);
  
  const MAX_WAIT_MS = isBulk ? 20000 : 90000; // Trong bulk mode đợi tối đa 20s để server xử lý kịp
  const INTERVAL_MS = 3000;
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_WAIT_MS) {
    await sleep(INTERVAL_MS);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    try {
      const retryRes = await courseraFetch(completeUrl, {
        method: 'POST',
        body: JSON.stringify({ contentRequestBody: {} }),
      });
      console.log(`[CourseraSkip] B4 retry [${elapsed}s]: status=${retryRes.status}`);
      if (retryRes.ok) {
        return { success: true, step: 4, videoId: meta.videoId };
      }
      // Nếu 403/401 = không có quyền - dừng luôn
      if (retryRes.status === 403 || retryRes.status === 401) {
        return { success: false, error: `Lỗi ${retryRes.status}: Không có quyền (chưa enroll khóa học?).` };
      }
      // 404 = backend chưa xử lý xong tiến trình → tiếp tục retry
    } catch (e) {
      console.log('[CourseraSkip] B4 retry lỗi:', e.message);
    }
  }

  // Đã hết 90 giây - progress đã được lưu (PUT 204) nhưng backend chưa phản hồi
  if (progressOk) {
    return { success: true, step: 3, videoId: meta.videoId, message: '✅ Tiến trình đã lưu nhưng Coursera chưa cập nhật giao diện. Thử F5 lại trang sau 1 phút.' };
  }
  return { success: false, error: 'Báo cáo tiến trình thất bại sau 90 giây.' };
}

async function markSupplementCompleted(userId, courseId, courseSlug, itemId) {
  console.log('[CourseraSkip] === Đánh dấu Supplement hoàn thành ===');
  try {
    const supplementUrl = `${BASE}/api/onDemandSupplementCompletions.v1`;
    const res = await courseraFetch(supplementUrl, {
      method: 'POST',
      body: JSON.stringify({
        courseId: courseId,
        itemId: itemId,
        userId: Number(userId)
      }),
    });
    
    console.log('[CourseraSkip] Supplement status:', res.status);
    if (res.ok) return { success: true };

    if (res.status === 403 || res.status === 401) {
      return { success: false, error: `Lỗi ${res.status}: Không có quyền thực hiện. Đã enroll chưa?` };
    }
  } catch (e) {
    console.log('[CourseraSkip] Supplement lỗi:', e.message);
  }

  return { success: false, error: 'Báo cáo hoàn thành bài đọc thất bại.' };
}

// ===== HÀM ĐIỀU PHỐI CHÍNH =====

async function markCurrentItemCompleted() {
  const context = getCourseContext();
  if (!context) return { success: false, error: 'Không nhận diện được trang. Hãy mở đúng trang bài học (/learn/.../lecture/... hoặc /supplement/...).' };

  const { courseSlug, itemType, itemId } = context;
  console.log(`[CourseraSkip] ▶ type=${itemType} | slug=${courseSlug} | item=${itemId}`);

  const courseId = await getCourseId(courseSlug);
  if (!courseId) return { success: false, error: 'Không lấy được courseId từ API. Coursera có thể đã đổi định dạng API.' };

  const userId = await getUserId(courseId);
  if (!userId) return { success: false, error: 'Không lấy được userId. Hãy đảm bảo đã đăng nhập Coursera.' };

  console.log(`[CourseraSkip] courseId=${courseId} | userId=${userId}`);

  if (itemType === 'lecture') {
    const result = await markLectureCompleted(userId, courseId, courseSlug, itemId);
    const suffix = result.retries ? ` (retry ×${result.retries})` : result.step === 'fallback-PUT' ? ' (fallback)' : '';
    const finalMsg = result.message || (result.success ? `✅ Video đã hoàn thành!${suffix}` : `❌ ${result.error}`);
    return { ...result, message: finalMsg, itemType, courseId, userId, itemId };
  }

  if (itemType === 'supplement') {
    const result = await markSupplementCompleted(userId, courseId, courseSlug, itemId);
    return { ...result, message: result.success ? `✅ Bài đọc đã hoàn thành!${result.fallback ? ' (fallback)' : ''}` : `❌ ${result.error}`, itemType, courseId, userId, itemId };
  }

  return { success: false, message: `⚠️ Loại "${itemType}" chưa được hỗ trợ.`, itemType };
}

// ===== BULK COMPLETION =====

async function getAllCourseItems(courseSlug) {
  try {
    const includes = "modules,lessons,passableItemGroups,passableItemGroupChoices,passableLessonElements,items,tracks,gradePolicy,gradingParameters,embeddedContentMapping";
    const fields = "moduleIds,onDemandCourseMaterialModules.v1(name,slug,description,timeCommitment,lessonIds,optional,learningObjectives),onDemandCourseMaterialLessons.v1(name,slug,timeCommitment,elementIds,optional,trackId),onDemandCourseMaterialPassableItemGroups.v1(requiredPassedCount,passableItemGroupChoiceIds,trackId),onDemandCourseMaterialPassableItemGroupChoices.v1(name,description,itemIds),onDemandCourseMaterialPassableLessonElements.v1(gradingWeight,isRequiredForPassing),onDemandCourseMaterialItems.v2(name,originalName,slug,timeCommitment,contentSummary,isLocked,lockableByItem,itemLockedReasonCode,trackId,lockedStatus,itemLockSummary),onDemandCourseMaterialTracks.v1(passablesCount),onDemandGradingParameters.v1(gradedAssignmentGroups),contentAtomRelations.v1(embeddedContentSourceCourseId,subContainerId)";
    const url = `${BASE}/api/onDemandCourseMaterials.v2/?q=slug&slug=${courseSlug}&includes=${includes}&fields=${fields}&showLockedItems=true`;
    
    const res = await courseraFetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    console.log('[CourseraSkip] getAllCourseItems error:', e);
    return null;
  }
}

async function markAllItemsCompleted() {
  const context = getCourseContext();
  if (!context) {
    chrome.runtime.sendMessage({ action: 'progressUpdate', status: 'error', code: 'NO_CONTEXT', message: 'Không tìm thấy bài học. Hãy vào trang bài học.' });
    return;
  }

  const { courseSlug } = context;
  chrome.runtime.sendMessage({ action: 'progressUpdate', status: 'loading', code: 'FETCHING_CURRICULUM', message: 'Đang tải danh sách bài học...' });

  const material = await getAllCourseItems(courseSlug);
  if (!material || !material.linked || !material.linked['onDemandCourseMaterialItems.v2']) {
    chrome.runtime.sendMessage({ action: 'progressUpdate', status: 'error', code: 'FETCH_FAILED', message: 'Không lấy được giáo trình khóa học.' });
    return;
  }

  const items = material.linked['onDemandCourseMaterialItems.v2'].filter(
    (f) => f.contentSummary && (f.contentSummary.typeName.includes('lecture') || f.contentSummary.typeName.includes('supplement'))
  );

  const total = items.length;
  let completed = 0;
  
  if (total === 0) {
    chrome.runtime.sendMessage({ action: 'progressUpdate', status: 'error', code: 'NO_ITEMS', message: 'Không tìm thấy video hoặc bài đọc nào!' });
    return;
  }

  const courseId = material.elements?.[0]?.id;
  if (!courseId) {
    chrome.runtime.sendMessage({ action: 'progressUpdate', status: 'error', code: 'NO_COURSE_ID', message: 'Không lấy được ID khóa học.' });
    return;
  }

  const userId = await getUserId(courseId);
  if (!userId) {
    chrome.runtime.sendMessage({ action: 'progressUpdate', status: 'error', code: 'NO_USER_ID', message: 'Không lấy được User ID. Vui lòng đăng nhập Coursera.' });
    return;
  }

  const batchSize = 5;
  chrome.runtime.sendMessage({ action: 'progressUpdate', status: 'starting', current: 0, total, message: `Bắt đầu xử lý ${total} bài học...` });

  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (item) => {
      try {
        const typeName = item.contentSummary.typeName;
        if (typeName.includes('lecture')) {
           await markLectureCompleted(userId, courseId, courseSlug, item.id, true);
        } else if (typeName.includes('supplement')) {
           await markSupplementCompleted(userId, courseId, courseSlug, item.id);
        }
      } catch (e) {
        console.log('[CourseraSkip] Item error', item.id, e);
      }
    }));
    
    completed = Math.min(completed + batch.length, total);
    chrome.runtime.sendMessage({ action: 'progressUpdate', status: 'progress', current: completed, total, message: `Đang xử lý: ${completed} / ${total}` });
    
    // Tạm nghỉ 2s giữa các batch để tránh bị server Coursera rate limit
    if (completed < total) {
      await sleep(2000);
    }
  }

  chrome.runtime.sendMessage({ action: 'progressUpdate', status: 'completed', current: total, total, message: `✅ Hoàn thành toàn bộ ${total} bài học!` });
}

// ===== AUTO PEER REVIEW =====

const REVIEW_COMMENTS = [
  "Great job! The submission meets all required criteria and is well-organized.",
  "Very clear explanation and detailed work. Excellent solution!",
  "Well-structured assignment with thorough reasoning. Keep up the good work!",
  "Everything looks accurate, clearly presented, and satisfies all prompt requirements.",
  "Impressive effort and solid execution. Thoroughly enjoyed reading through your submission."
];

function getRandomReviewComment() {
  return REVIEW_COMMENTS[Math.floor(Math.random() * REVIEW_COMMENTS.length)];
}

function fillTextInput(el, text) {
  if (!el) return;

  // Case 1: contenteditable div (Coursera modern UI)
  if (el.getAttribute('contenteditable') !== null || el.getAttribute('role') === 'textbox') {
    el.focus();
    el.textContent = '';
    // Use execCommand to set text so React's synthetic events fire
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    } catch (_) {
      el.textContent = text;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // Case 2: standard <textarea> or <input>
  el.focus();
  el.click();
  try {
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  } catch (_) {}
  // Fallback: set value directly and fire events (for non-React forms)
  const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (nativeInputSetter) {
    nativeInputSetter.call(el, text);
  } else {
    el.value = text;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function autoGradePeerReview() {
  console.log('[CourseraSkip] Starting Auto Peer Review...');

  let optionsSelected = 0;
  let textareasFilled = 0;

  // 1. Find rubric sections using Coursera-specific selectors (tight scope, avoid nav/header)
  // Coursera uses .rc-FormPart per rubric criterion, or fieldset inside .c-peer-review-rubric
  const rubricSelectors = [
    '.rc-FormPart',
    '.c-peer-review-rubric-item',
    'fieldset.c-peer-review-rubric',
    'div[data-testid*="rubric-criterion"]',
    'div[data-testid*="rubric-item"]',
  ];

  let rubricParts = [];
  for (const sel of rubricSelectors) {
    const found = document.querySelectorAll(sel);
    if (found.length > 0) {
      rubricParts = Array.from(found);
      break;
    }
  }

  // Fallback: use radiogroups only if inside a peer-review container
  if (rubricParts.length === 0) {
    const peerContainer = document.querySelector(
      '.c-peer-review, [data-testid*="peer-review"], .rc-PeerReview, main'
    );
    if (peerContainer) {
      rubricParts = Array.from(peerContainer.querySelectorAll('[role="radiogroup"], fieldset'));
    }
  }

  for (const part of rubricParts) {
    // Select the radio with the highest score
    const radios = Array.from(part.querySelectorAll('input[type="radio"]'));
    if (radios.length > 0) {
      let bestRadio = radios[radios.length - 1]; // default: last option (usually highest)
      let maxScore = -1;

      radios.forEach((r) => {
        // Try to find associated label text to parse score
        const labelEl = r.closest('label') || document.querySelector(`label[for="${r.id}"]`);
        const labelText = labelEl?.textContent || r.value || '';
        const scoreMatch = labelText.match(/(\d+)\s*(?:points?|pts?|điểm)/i);
        if (scoreMatch) {
          const score = parseInt(scoreMatch[1], 10);
          if (score > maxScore) { maxScore = score; bestRadio = r; }
        }
      });

      if (!bestRadio.checked) {
        bestRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(150);
        bestRadio.click();
        bestRadio.dispatchEvent(new Event('change', { bubbles: true }));
        optionsSelected++;
      }
    }

    // Fill feedback textareas/contenteditable within this criterion
    const feedbackEls = Array.from(part.querySelectorAll(
      'textarea, input[type="text"], div[contenteditable="true"], div[role="textbox"]'
    ));
    for (const el of feedbackEls) {
      const currentText = el.value ?? el.textContent ?? '';
      if (currentText.trim().length === 0) {
        fillTextInput(el, getRandomReviewComment());
        textareasFilled++;
        await sleep(100);
      }
    }
  }

  // 2. Also catch any remaining empty feedback fields outside rubric parts
  const allFeedbackEls = Array.from(document.querySelectorAll(
    'textarea[placeholder], div[contenteditable="true"][data-testid*="feedback"], div[contenteditable="true"][data-testid*="comment"], .c-peer-review-submit-textarea-input-field'
  ));
  for (const el of allFeedbackEls) {
    const currentText = el.value ?? el.textContent ?? '';
    if (currentText.trim().length === 0) {
      fillTextInput(el, getRandomReviewComment());
      textareasFilled++;
      await sleep(100);
    }
  }

  await sleep(600);

  // 3. Find Submit Review button — scroll to it & highlight, but DON'T auto-click
  //    User must confirm and click manually to avoid accidental irreversible submission
  const submitBtn =
    document.querySelector('.rc-FormSubmit button[type="submit"]') ||
    document.querySelector('button[data-testid*="submit-review"]') ||
    Array.from(document.querySelectorAll('button[type="submit"]')).find(b => {
      const txt = (b.textContent || '').trim().toLowerCase();
      return txt.includes('submit') || txt.includes('nộp');
    });

  if (submitBtn) {
    submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Highlight the button briefly so user sees it
    const originalOutline = submitBtn.style.outline;
    submitBtn.style.outline = '3px solid #6366f1';
    submitBtn.style.boxShadow = '0 0 12px #6366f1aa';
    setTimeout(() => {
      submitBtn.style.outline = originalOutline;
      submitBtn.style.boxShadow = '';
    }, 3000);
  }

  return {
    success: true,
    message: submitBtn
      ? `✅ Đã chọn ${optionsSelected} tiêu chí và điền ${textareasFilled} nhận xét! Kiểm tra lại và bấm nút nộp (đã highlight màu tím) nhé.`
      : `✅ Đã chọn ${optionsSelected} tiêu chí và điền ${textareasFilled} nhận xét! Bạn có thể cuộn xuống để kiểm tra và nộp bài.`
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'markCompleted') {
    markCurrentItemCompleted()
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: `Lỗi: ${err.message}` }));
    return true;
  }
  if (message.action === 'markAllCompleted') {
    markAllItemsCompleted();
    sendResponse({ success: true, message: "Đã bắt đầu chạy ngầm." });
    return true;
  }
  if (message.action === 'autoGradePeerReview') {
    autoGradePeerReview()
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: `Lỗi: ${err.message}` }));
    return true;
  }
  if (message.action === 'checkDiscussionPrompt') {
    sendResponse(checkDiscussionPrompt());
    return false;
  }
  if (message.action === 'autoPostDiscussion') {
    autoPostDiscussion()
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: `Lỗi: ${err.message}` }));
    return true;
  }
  if (message.action === 'getContext') {
    sendResponse(getCourseContext() || { error: 'Không nhận diện được trang.' });
  }
});

// ===== AUTO DISCUSSION PROMPT =====

const DISCUSSION_RESPONSES = [
  "This lesson provided a clear and well-structured overview of the topic. I particularly appreciated how the key concepts were broken down step by step, making them much easier to understand and apply.",
  "After going through this material, I find the approach presented here both practical and insightful. It gave me a new perspective on how to tackle similar problems in real-world scenarios.",
  "The content covered in this lesson was very informative. I especially liked the examples used to illustrate the core ideas — they really helped connect theory to practice.",
  "This was a thought-provoking lesson. The framework introduced here aligns well with industry best practices and I can see how it can be directly applied to improve outcomes in various contexts.",
  "I found this lesson to be an excellent introduction to the subject. The explanation was concise yet comprehensive, and it raised several interesting points worth exploring further.",
  "The material in this lesson resonated with me because it addresses challenges that come up frequently in practice. Understanding these concepts helps me think more critically about the problems I encounter.",
  "This lesson did a great job of balancing depth and accessibility. The step-by-step breakdown made even the more complex ideas approachable, and I now feel more confident applying these concepts."
];

function getRandomDiscussionResponse() {
  return DISCUSSION_RESPONSES[Math.floor(Math.random() * DISCUSSION_RESPONSES.length)];
}

/**
 * Kiểm tra xem trang hiện tại có chứa Discussion Prompt không.
 * Hỗ trợ cả 2 trường hợp:
 *  1. Trang chuyên biệt: URL có dạng /learn/{slug}/discussionPrompt/{itemId}/...
 *  2. Trang nhúng: Discussion prompt nằm ở cuối bài lecture/supplement.
 * Trả về { hasDiscussion: bool, itemId: string|null }.
 */
function checkDiscussionPrompt() {
  const ctx = getCourseContext();
  if (ctx?.itemType === 'discussionPrompt') {
    return { hasDiscussion: true, itemId: ctx.itemId };
  }

  const discussionSelectors = [
    '[data-testid*="discussion-prompt"]',
    '.c-discussion-prompt',
    '.rc-DiscussionPrompt',
    '[data-testid="discussion-prompt-section"]',
    'div[class*="DiscussionPrompt"]',
  ];

  for (const sel of discussionSelectors) {
    if (document.querySelector(sel)) {
      return { hasDiscussion: true, itemId: ctx?.itemId || null };
    }
  }

  // Fallback: tìm tiêu đề / heading gợi ý Discussion Prompt
  const headings = document.querySelectorAll('h1, h2, h3, h4, [role="heading"]');
  for (const h of headings) {
    const text = (h.textContent || '').toLowerCase();
    if (text.includes('discussion prompt') || text.includes('thảo luận')) {
      return { hasDiscussion: true, itemId: ctx?.itemId || null };
    }
  }

  return { hasDiscussion: false, itemId: null };
}

/**
 * Fallback DOM: Tự động tìm khung soạn thảo trên trang và bấm nút Reply.
 */
async function postDiscussionViaDOM(text) {
  const editor = document.querySelector(
    'div[contenteditable="true"], div[role="textbox"], .cml-editor, div[data-testid*="editor"], textarea'
  );
  if (!editor) {
    return { success: false, error: 'Không tìm thấy ô nhập câu trả lời thảo luận trên trang.' };
  }

  editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
  editor.focus();
  editor.click();
  await sleep(250);

  fillTextInput(editor, text);
  await sleep(400);

  // Tìm nút Reply trên giao diện
  const replyBtn = Array.from(document.querySelectorAll('button')).find(b => {
    const txt = (b.textContent || '').trim().toLowerCase();
    return (txt === 'reply' || txt === 'phản hồi' || txt === 'post' || txt === 'đăng');
  }) || document.querySelector('button[data-testid*="reply"], button[type="submit"]');

  if (replyBtn) {
    replyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);
    if (!replyBtn.disabled) {
      replyBtn.click();
      return {
        success: true,
        message: '✅ Đã điền câu trả lời và bấm Reply thành công!'
      };
    }
    // Nếu nút bị disable, highlight để user bấm
    replyBtn.style.outline = '3px solid #0ea5e9';
    return {
      success: true,
      message: '✅ Đã điền câu trả lời! Vui lòng bấm nút Reply (viền xanh).'
    };
  }

  return {
    success: true,
    message: '✅ Đã điền câu trả lời vào khung soạn thảo!'
  };
}

/**
 * Tự động đăng câu trả lời vào Discussion Prompt của bài học hiện tại.
 * Flow:
 *  1. Thử qua Coursera Forum API (nhanh & sạch)
 *  2. Nếu API không được → tự động fallback sang tương tác DOM trực tiếp
 */
async function autoPostDiscussion() {
  console.log('[CourseraSkip] Starting Auto Discussion Post...');

  const ctx = getCourseContext();
  if (!ctx || !ctx.itemId) {
    return { success: false, error: 'Không nhận diện được bài học. Vui lòng mở trang bài giảng Coursera.' };
  }

  const { courseSlug, itemId } = ctx;
  const answerText = getRandomDiscussionResponse();

  // --- CÁCH 1: Thử gọi Coursera API ---
  try {
    const userId = await getUserId();
    const courseId = await getCourseId(courseSlug);
    const csrfToken = getCsrfToken();

    if (userId && courseId) {
      const discussionFields = [
        'onDemandDiscussionPromptQuestions.v1(content,creatorId,createdAt,forumId,sessionId,lastAnsweredBy,lastAnsweredAt,totalAnswerCount,topLevelAnswerCount,viewCount)',
        'promptType',
        'question',
      ].join(',');

      const promptUrl = `${BASE}/api/onDemandDiscussionPrompts.v1/${userId}~${courseId}~${itemId}?fields=${discussionFields}&includes=question`;
      console.log('[CourseraSkip] Fetching discussion prompt:', promptUrl);

      const promptRes = await courseraFetch(promptUrl);
      console.log('[CourseraSkip] onDemandDiscussionPrompts status:', promptRes.status);

      if (promptRes.ok) {
        const promptData = await promptRes.json();
        const courseItemForumQuestionId = promptData?.elements?.[0]?.promptType?.courseItemForumQuestionId
          ?? promptData?.elements?.[0]?.question?.courseItemForumQuestionId;

        if (courseItemForumQuestionId) {
          const parts = courseItemForumQuestionId.split('~');
          const questionId = parts[2] || parts[parts.length - 1];

          if (questionId) {
            await sleep(500);
            const answerBody = {
              content: {
                typeName: 'cml',
                definition: {
                  dtdId: 'discussion/1',
                  value: `<co-content><text>${answerText}</text></co-content>`,
                },
              },
              courseForumQuestionId: `${courseId}~${questionId}`,
            };

            const answerFields = 'content,forumQuestionId,parentForumAnswerId,state,creatorId,createdAt,order,upvoteCount,childAnswerCount,isFlagged,isUpvoted,courseItemForumQuestionId,parentCourseItemForumAnswerId';
            const answerUrl = `${BASE}/api/onDemandCourseForumAnswers.v1/?fields=${answerFields}&includes=profiles,children,userId`;

            console.log('[CourseraSkip] Posting discussion answer to:', answerUrl);
            const answerRes = await courseraFetch(answerUrl, {
              method: 'POST',
              headers: { 'x-csrf3-token': csrfToken },
              body: JSON.stringify(answerBody),
            });

            console.log('[CourseraSkip] Post answer status:', answerRes.status);
            if (answerRes.ok || answerRes.status === 201) {
              return {
                success: true,
                message: '✅ Đã đăng câu trả lời thảo luận thành công! Coursera sẽ tự cập nhật tiến độ.',
              };
            }
          }
        }
      }
    }
  } catch (apiErr) {
    console.log('[CourseraSkip] API post discussion failed, falling back to DOM...', apiErr);
  }

  // --- CÁCH 2: Fallback qua tương tác DOM ---
  console.log('[CourseraSkip] Running DOM fallback for discussion post...');
  return await postDiscussionViaDOM(answerText);
}

