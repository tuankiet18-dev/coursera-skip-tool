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
  const match = window.location.href.match(
    /\/learn\/([^/]+)\/(lecture|supplement|quiz|programming)\/([^/?#]+)/
  );
  if (!match) return null;
  return { courseSlug: match[1], itemType: match[2], itemId: match[3] };
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
  if (message.action === 'getContext') {
    sendResponse(getCourseContext() || { error: 'Không nhận diện được trang.' });
  }
});
