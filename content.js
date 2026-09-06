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
  //    /learn/{slug}/peer/{itemId}
  //    /learn/{slug}/peer/{itemId}/give-feedback
  //    /learn/{slug}/peer/{itemId}/review
  //    /learn/{slug}/peer-review/{itemId}
  //    /learn/{slug}/peer-assignment/{itemId}
  //    /learn/{slug}/submit-revisions/{itemId}  (resubmit review)
  //    /learn/{slug}/assignment-submission/{itemId}
  const peerMatch = href.match(
    /\/learn\/([^/]+)\/(?:peer-review|peer|peer-assignment|submit-revisions|assignment-submission)\/([^/?#]+)/i
  );
  if (peerMatch) {
    return { courseSlug: peerMatch[1], itemType: 'peer', itemId: peerMatch[2] };
  }

  // DOM heuristic: If the page has Coursera peer review rubric items or review forms in DOM
  const hasRubric = Boolean(
    document.querySelector(
      '.rc-FormPart, .c-peer-review-rubric-item, fieldset.c-peer-review-rubric, div[data-testid*="rubric-criterion"], .c-peer-review, div[data-testid*="peer-review"], div[data-testid*="give-feedback"]'
    )
  );
  if (hasRubric) {
    const slugMatch = href.match(/\/learn\/([^/?#]+)/i);
    if (slugMatch) {
      return { courseSlug: slugMatch[1], itemType: 'peer', itemId: 'review' };
    }
  }

  // 3. Fallback for any discussionPrompt URL variations
  const discMatch = href.match(/\/learn\/([^/]+)\/discussionPrompt\/([^/?#]+)/i);
  if (discMatch) {
    return { courseSlug: discMatch[1], itemType: 'discussionPrompt', itemId: discMatch[2] };
  }

  // 4. Any course page (/learn/{courseSlug}/...) e.g. home, week overview, syllabus
  const courseMatch = href.match(/\/learn\/([^/?#]+)/i);
  if (courseMatch && courseMatch[1]) {
    const slug = courseMatch[1];
    const excludedSlugs = ['my-learning', 'home', 'search', 'browse', 'programs', 'certificates', 'degrees'];
    if (!excludedSlugs.includes(slug.toLowerCase())) {
      return { courseSlug: slug, itemType: 'course', itemId: null };
    }
  }

  return null;
}

// ===== LẤY courseId VÀ userId =====

async function getCourseId(courseSlug) {
  try {
    const res = await courseraFetch(`${BASE}/api/onDemandCourses.v1?q=slug&slug=${courseSlug}&fields=id`);
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
  if (!context || !context.courseSlug) {
    return { success: false, error: 'Không nhận diện được khóa học. Hãy mở một trang khóa học Coursera.' };
  }

  const { courseSlug, itemType, itemId } = context;

  // Nếu đang ở trang tổng quan khóa học (không ở bài học cụ thể)
  if (!itemId) {
    return {
      success: false,
      error: 'Bạn đang ở trang tổng quan khóa học. Hãy mở 1 bài học cụ thể (Video, Reading, Discussion) để hoàn thành bài lẻ, hoặc bấm 1 trong 2 nút hoàn thành toàn bộ bên dưới!'
    };
  }

  console.log(`[CourseraSkip] ▶ type=${itemType} | slug=${courseSlug} | item=${itemId}`);

  // Nếu bài hiện tại là Discussion Prompt
  if (itemType === 'discussionPrompt') {
    return await autoPostDiscussion();
  }

  // Nếu bài hiện tại là Peer Review
  if (itemType === 'peer') {
    return await autoGradePeerReview();
  }

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

  return { success: false, error: `⚠️ Loại bài "${itemType}" chưa được hỗ trợ hoàn thành tự động.` };
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

function notifyProgress(data) {
  try {
    chrome.runtime.sendMessage({ action: 'progressUpdate', ...data });
  } catch (_) {}
  if (typeof updateFloatingWidgetProgress === 'function') {
    updateFloatingWidgetProgress(data);
  }
}

async function markAllItemsCompleted() {
  const context = getCourseContext();
  if (!context) {
    notifyProgress({ status: 'error', code: 'NO_CONTEXT', message: 'Không tìm thấy bài học. Hãy vào trang bài học.' });
    return;
  }

  const { courseSlug } = context;
  notifyProgress({ status: 'loading', code: 'FETCHING_CURRICULUM', message: 'Đang tải danh sách bài học...' });

  const material = await getAllCourseItems(courseSlug);
  if (!material || !material.linked || !material.linked['onDemandCourseMaterialItems.v2']) {
    notifyProgress({ status: 'error', code: 'FETCH_FAILED', message: 'Không lấy được giáo trình khóa học.' });
    return;
  }

  const items = material.linked['onDemandCourseMaterialItems.v2'].filter(
    (f) => f.contentSummary && (f.contentSummary.typeName.includes('lecture') || f.contentSummary.typeName.includes('supplement'))
  );

  const total = items.length;
  let completed = 0;
  
  if (total === 0) {
    notifyProgress({ status: 'error', code: 'NO_ITEMS', message: 'Không tìm thấy video hoặc bài đọc nào!' });
    return;
  }

  const courseId = material.elements?.[0]?.id;
  if (!courseId) {
    notifyProgress({ status: 'error', code: 'NO_COURSE_ID', message: 'Không lấy được ID khóa học.' });
    return;
  }

  const userId = await getUserId(courseId);
  if (!userId) {
    notifyProgress({ status: 'error', code: 'NO_USER_ID', message: 'Không lấy được User ID. Vui lòng đăng nhập Coursera.' });
    return;
  }

  const batchSize = 5;
  notifyProgress({ status: 'starting', current: 0, total, message: `Bắt đầu xử lý ${total} bài học...` });

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (item) => {
      try {
        const typeName = item.contentSummary.typeName;
        let res = null;
        if (typeName.includes('lecture')) {
           res = await markLectureCompleted(userId, courseId, courseSlug, item.id, true);
        } else if (typeName.includes('supplement')) {
           res = await markSupplementCompleted(userId, courseId, courseSlug, item.id);
        }
        if (res && res.success) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (e) {
        console.log('[CourseraSkip] Item error', item.id, e);
        failedCount++;
      }
    }));
    
    completed = Math.min(completed + batch.length, total);
    notifyProgress({ status: 'progress', current: completed, total, message: `Đang xử lý: ${completed} / ${total}` });
    
    // Tạm nghỉ 2s giữa các batch để tránh bị server Coursera rate limit
    if (completed < total) {
      await sleep(2000);
    }
  }

  const status = failedCount === 0 ? 'completed' : (successCount > 0 ? 'partial' : 'error');
  const finalMsg = failedCount === 0
    ? `✅ Hoàn thành toàn bộ ${total} bài học Video & Reading!`
    : `⚠️ Đã xử lý: ${successCount} thành công, ${failedCount} thất bại.`;

  notifyProgress({
    status,
    current: total,
    total,
    message: finalMsg,
    failedCount,
    successCount
  });
}

/**
 * Kiểm tra xem người dùng đã từng gửi câu trả lời cho questionId này chưa.
 * Phân trang bằng start/limit (limit=50, tối đa 250 items) để không bỏ sót câu trả lời cũ.
 * Ném lỗi nếu request API thất bại để caller không tự ý đăng bài khi chưa kiểm tra được.
 */
async function hasUserAnsweredDiscussion(courseId, questionId, userId) {
  const limit = 50;
  let start = 0;
  const maxItemsToCheck = 250;

  while (start < maxItemsToCheck) {
    const checkUrl = `${BASE}/api/onDemandCourseForumAnswers.v1/?q=courseForumQuestionId&courseForumQuestionId=${courseId}~${questionId}&fields=creatorId&limit=${limit}&start=${start}`;
    const checkRes = await courseraFetch(checkUrl);

    if (!checkRes.ok) {
      throw new Error(`API kiểm tra trùng lặp phản hồi mã lỗi HTTP ${checkRes.status}`);
    }

    const checkData = await checkRes.json();
    const elements = checkData?.elements || [];
    const found = elements.some((ans) => String(ans.creatorId) === String(userId));
    if (found) {
      return true;
    }

    if (elements.length < limit) {
      break;
    }
    start += limit;
  }

  return false;
}

/**
 * Gửi câu trả lời thảo luận kèm cơ chế retry khi gặp mã 429 (Rate Limit).
 * Tôn trọng Retry-After header hoặc chờ mặc định 5s.
 */
async function postDiscussionAnswerWithRetry(courseId, questionId, csrfToken, answerText, maxRetries = 3) {
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

  const answerFields = 'content,forumQuestionId,parentForumAnswerId,state,creatorId,createdAt,order,courseItemForumQuestionId';
  const answerUrl = `${BASE}/api/onDemandCourseForumAnswers.v1/?fields=${answerFields}&includes=profiles,children,userId`;

  let postRes = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    postRes = await courseraFetch(answerUrl, {
      method: 'POST',
      headers: { 'x-csrf3-token': csrfToken },
      body: JSON.stringify(answerBody),
    });

    if (postRes.ok || postRes.status === 201) {
      return postRes;
    }

    if (postRes.status === 429 && attempt < maxRetries) {
      const retryAfterHeader = postRes.headers?.get ? postRes.headers.get('Retry-After') : null;
      let waitTime = 5000;
      if (retryAfterHeader) {
        const parsed = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsed) && parsed > 0) {
          waitTime = parsed * 1000;
        }
      }
      console.log(`[CourseraSkip] Discussion POST rate limited (429). Retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await sleep(waitTime);
      continue;
    }

    break;
  }

  return postRes;
}

async function markAllDiscussionsCompleted() {
  const context = getCourseContext();
  if (!context || !context.courseSlug) {
    notifyProgress({ status: 'error', code: 'NO_CONTEXT', message: 'Không nhận diện được khóa học. Hãy mở trang khóa học Coursera.' });
    return;
  }

  const { courseSlug } = context;
  notifyProgress({ status: 'loading', code: 'FETCHING_CURRICULUM', message: 'Đang tải danh sách bài thảo luận...' });

  const material = await getAllCourseItems(courseSlug);
  if (!material || !material.linked || !material.linked['onDemandCourseMaterialItems.v2']) {
    notifyProgress({ status: 'error', code: 'FETCH_FAILED', message: 'Không lấy được giáo trình khóa học.' });
    return;
  }

  // Lọc tất cả các bài Discussion Prompt trong toàn bộ khóa học
  const discussionItems = material.linked['onDemandCourseMaterialItems.v2'].filter(
    (f) => f.contentSummary && f.contentSummary.typeName && f.contentSummary.typeName.includes('discussionPrompt')
  );

  const total = discussionItems.length;
  if (total === 0) {
    notifyProgress({ status: 'error', code: 'NO_ITEMS', message: 'Khóa học này không có bài thảo luận (Discussion Prompt) nào!' });
    return;
  }

  const courseId = material.elements?.[0]?.id || await getCourseId(courseSlug);
  if (!courseId) {
    notifyProgress({ status: 'error', code: 'NO_COURSE_ID', message: 'Không lấy được ID khóa học.' });
    return;
  }

  const userId = await getUserId(courseId);
  if (!userId) {
    notifyProgress({ status: 'error', code: 'NO_USER_ID', message: 'Không lấy được User ID. Vui lòng đăng nhập Coursera.' });
    return;
  }

  const csrfToken = getCsrfToken();
  notifyProgress({ status: 'starting', current: 0, total, message: `Bắt đầu xử lý ${total} bài thảo luận...` });

  let completed = 0;
  let successCount = 0;
  let failedCount = 0;
  let skippedDuplicate = 0;

  for (let i = 0; i < total; i++) {
    const item = discussionItems[i];
    try {
      // 1. Lấy prompt question ID
      const discussionFields = 'onDemandDiscussionPromptQuestions.v1(content,creatorId,createdAt,forumId,sessionId),promptType,question';
      const promptUrl = `${BASE}/api/onDemandDiscussionPrompts.v1/${userId}~${courseId}~${item.id}?fields=${discussionFields}&includes=question`;

      const promptRes = await courseraFetch(promptUrl);
      if (!promptRes.ok) {
        failedCount++;
      } else {
        const promptData = await promptRes.json();
        const courseItemForumQuestionId = promptData?.elements?.[0]?.promptType?.courseItemForumQuestionId
          ?? promptData?.elements?.[0]?.question?.courseItemForumQuestionId;

        if (!courseItemForumQuestionId) {
          failedCount++;
        } else {
          const parts = courseItemForumQuestionId.split('~');
          const questionId = parts[2] || parts[parts.length - 1];

          if (!questionId) {
            failedCount++;
          } else {
            // 2. Kiểm tra xem học viên đã từng đăng câu trả lời cho câu này chưa (chống spam trùng lặp)
            let alreadyAnswered = false;
            let checkFailed = false;
            try {
              alreadyAnswered = await hasUserAnsweredDiscussion(courseId, questionId, userId);
            } catch (checkErr) {
              console.log('[CourseraSkip] Duplicate check failed for item', item.id, checkErr);
              checkFailed = true;
              failedCount++;
            }

            if (!checkFailed) {
              if (alreadyAnswered) {
                console.log('[CourseraSkip] Discussion prompt already answered, skipping duplicate:', item.id);
                skippedDuplicate++;
                successCount++;
              } else {
                const answerText = getRandomDiscussionResponse();
                const postRes = await postDiscussionAnswerWithRetry(courseId, questionId, csrfToken, answerText);

                if (postRes && (postRes.ok || postRes.status === 201)) {
                  successCount++;
                } else {
                  console.log('[CourseraSkip] Failed to post discussion, HTTP status:', postRes?.status);
                  failedCount++;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.log('[CourseraSkip] Error posting discussion for item', item.id, e);
      failedCount++;
    }

    completed++;
    notifyProgress({
      status: 'progress',
      current: completed,
      total,
      message: `Đang xử lý thảo luận: ${completed} / ${total} (${item.name || 'Discussion'})`
    });

    // Nghỉ 1.8s giữa các bài để tôn trọng rate limit của Coursera
    if (completed < total) {
      await sleep(1800);
    }
  }

  const status = failedCount === 0 ? 'completed' : (successCount > 0 ? 'partial' : 'error');
  const finalMsg = failedCount === 0
    ? (skippedDuplicate > 0
        ? `✅ Hoàn thành toàn bộ ${total} bài thảo luận (${skippedDuplicate} bài đã trả lời từ trước)!`
        : `✅ Hoàn thành toàn bộ ${total} bài thảo luận trong khóa học!`)
    : `⚠️ Đã xử lý: ${successCount} thành công (${skippedDuplicate} bài đã có sẵn), ${failedCount} thất bại.`;

  notifyProgress({
    status,
    current: total,
    total,
    message: finalMsg,
    failedCount,
    successCount,
    skippedDuplicate
  });
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

function getTargetInputFromElement(el) {
  if (!el) return null;
  if (
    (typeof HTMLTextAreaElement !== 'undefined' && el instanceof HTMLTextAreaElement) ||
    (typeof HTMLInputElement !== 'undefined' && el instanceof HTMLInputElement) ||
    el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && (el.type === 'text' || !el.type)) ||
    (el.getAttribute && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '')) ||
    (el.getAttribute && el.getAttribute('role') === 'textbox') ||
    (el.classList && el.classList.contains('cml-editor'))
  ) {
    return el;
  }
  const inner = el.querySelector
    ? el.querySelector('textarea, input[type="text"], input:not([type]), div[contenteditable="true"], div[contenteditable=""], div[role="textbox"], .cml-editor')
    : null;
  return inner || el;
}

function fillTextInput(rawEl, text) {
  const el = getTargetInputFromElement(rawEl);
  if (!el) return;

  // Case 1: contenteditable div (Coursera modern UI / rich text editor)
  const isContentEditable = (el.getAttribute && el.getAttribute('contenteditable') !== null && el.getAttribute('contenteditable') !== 'false') ||
    (el.getAttribute && el.getAttribute('role') === 'textbox') ||
    (el.classList && el.classList.contains('cml-editor'));

  if (isContentEditable) {
    if (typeof el.focus === 'function') el.focus();
    if (typeof el.click === 'function') el.click();

    let inserted = false;
    try {
      if (typeof document !== 'undefined' && document.execCommand) {
        document.execCommand('selectAll', false, null);
        inserted = document.execCommand('insertText', false, text);
      }
    } catch (_) {}

    if (!inserted || !el.textContent || el.textContent.trim().length === 0) {
      el.textContent = text;
    }

    try {
      if (typeof InputEvent !== 'undefined') {
        el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }));
        el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      } else {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (_) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof KeyboardEvent !== 'undefined') {
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
    }
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return;
  }

  // Case 2: standard <textarea> or <input>
  if (typeof el.focus === 'function') el.focus();
  if (typeof el.click === 'function') el.click();
  try {
    if (typeof document !== 'undefined' && document.execCommand) {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    }
  } catch (_) {}

  // Chọn prototype chính xác theo loại element để tránh TypeError: Illegal invocation
  const isTextarea = (typeof HTMLTextAreaElement !== 'undefined' && el instanceof HTMLTextAreaElement) || el.tagName === 'TEXTAREA';
  const proto = isTextarea
    ? (typeof HTMLTextAreaElement !== 'undefined' ? HTMLTextAreaElement.prototype : Object.getPrototypeOf(el))
    : (typeof HTMLInputElement !== 'undefined' ? HTMLInputElement.prototype : Object.getPrototypeOf(el));

  const nativeInputSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (nativeInputSetter) {
    nativeInputSetter.call(el, text);
  } else {
    el.value = text;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

async function autoGradePeerReview() {
  console.log('[CourseraSkip] Starting Auto Peer Review...');

  let optionsSelected = 0;
  let textareasFilled = 0;

  // 1. Polling chờ rubric xuất hiện trên DOM (tối đa 6 giây để chống false-success khi React chưa render)
  // Tuyệt đối không đưa feedback input wrapper vào rubricSelectors
  const rubricSelectors = [
    '.rc-FormPart',
    '.rc-FormPartsQuestion',
    '.c-peer-review-rubric-item',
    'fieldset.c-peer-review-rubric',
    'div[data-testid*="rubric-criterion"]',
    'div[data-testid*="rubric-item"]',
  ];

  let rubricParts = [];
  const startTime = Date.now();
  const TIMEOUT_MS = 6000;

  while (Date.now() - startTime < TIMEOUT_MS) {
    for (const sel of rubricSelectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        rubricParts = Array.from(found);
        break;
      }
    }
    if (rubricParts.length > 0) break;

    // Fallback: tìm theo container peer review
    const container = document.querySelector(
      '.c-peer-review, [data-testid*="peer-review"], .rc-PeerReview, [data-testid*="give-feedback"], main'
    );
    if (container) {
      const groups = container.querySelectorAll('[role="radiogroup"], fieldset, .rc-FormPart, .rc-FormPartsQuestion');
      if (groups.length > 0) {
        rubricParts = Array.from(groups);
        break;
      }
    }
    await sleep(300);
  }

  const processedInputs = new Set();

  // 2. Duyệt qua từng tiêu chí rubric để chọn radio điểm cao nhất và điền feedback
  for (const part of rubricParts) {
    // Lọc các radio không bị disabled hoặc aria-disabled="true"
    const enabledRadios = Array.from(part.querySelectorAll('input[type="radio"]')).filter(
      (r) => !r.disabled && r.getAttribute('aria-disabled') !== 'true'
    );
    if (enabledRadios.length > 0) {
      let bestRadio = enabledRadios[enabledRadios.length - 1]; // default: option cuối cùng trong số enabled
      let maxScore = -1;

      enabledRadios.forEach((r) => {
        const labelEl = r.closest('label') || document.querySelector(`label[for="${r.id}"]`);
        const labelText = labelEl?.textContent || r.value || '';
        const scoreMatch = labelText.match(/(\d+)\s*(?:points?|pts?|điểm)/i);
        if (scoreMatch) {
          const score = parseInt(scoreMatch[1], 10);
          if (score > maxScore) { maxScore = score; bestRadio = r; }
        }
      });

      const wasChecked = bestRadio.checked || bestRadio.getAttribute('aria-checked') === 'true';
      if (!wasChecked) {
        if (typeof bestRadio.scrollIntoView === 'function') {
          bestRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        await sleep(150);
        bestRadio.click();
        bestRadio.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(50);
        if (bestRadio.checked || bestRadio.getAttribute('aria-checked') === 'true') {
          optionsSelected++;
        }
      } else {
        optionsSelected++;
      }
    }

    // Điền nhận xét trong tiêu chí này
    const feedbackEls = Array.from(part.querySelectorAll(
      'textarea, input[type="text"], div[contenteditable="true"], div[role="textbox"], div[data-testid="peer-review-multi-line-input-field"]'
    ));
    for (const rawEl of feedbackEls) {
      const el = getTargetInputFromElement(rawEl);
      if (!el || processedInputs.has(el)) continue;
      processedInputs.add(el);

      const currentText = el.value ?? el.textContent ?? '';
      if (currentText.trim().length === 0) {
        fillTextInput(el, getRandomReviewComment());
        textareasFilled++;
        await sleep(100);
      }
    }
  }

  // 3. Quét các ô nhận xét còn lại (được giới hạn scope trong peerContainer để tránh chạm vào thanh search/sidebar)
  const peerContainer = document.querySelector(
    '.c-peer-review, [data-testid*="peer-review"], .rc-PeerReview, [data-testid*="give-feedback"], main'
  ) || document.body;

  const allFeedbackEls = Array.from(peerContainer.querySelectorAll(
    'textarea, input[type="text"], div[data-testid="peer-review-multi-line-input-field"], div[contenteditable="true"][data-testid*="feedback"], div[contenteditable="true"][data-testid*="comment"], div[role="textbox"], .c-peer-review-submit-textarea-input-field'
  ));
  for (const rawEl of allFeedbackEls) {
    const el = getTargetInputFromElement(rawEl);
    if (!el || processedInputs.has(el)) continue;

    // Bỏ qua nếu element này đã nằm trong rubricParts đã xử lý
    if (rubricParts.some((p) => p.contains(rawEl) || p.contains(el))) continue;

    processedInputs.add(el);
    const currentText = el.value ?? el.textContent ?? '';
    if (currentText.trim().length === 0) {
      fillTextInput(el, getRandomReviewComment());
      textareasFilled++;
      await sleep(100);
    }
  }

  await sleep(400);

  // 4. Kiểm tra kết quả thực tế — tránh false-success khi không chấm được gì
  if (optionsSelected === 0 && textareasFilled === 0) {
    const anyChecked = peerContainer.querySelectorAll('input[type="radio"]:checked');
    if (anyChecked.length > 0) {
      return {
        success: true,
        submitted: false,
        message: 'ℹ️ Các tiêu chí chấm bài đã được chọn trước đó. Bạn có thể cuộn xuống kiểm tra và bấm nộp.'
      };
    }
    return {
      success: false,
      submitted: false,
      error: 'Không tìm thấy hoặc không thể điền tiêu chí chấm bài nào. Hãy đảm bảo form chấm bài của bạn học đã tải xong.'
    };
  }

  // 5. Tìm nút Submit Review — scroll to it & highlight viền tím, không tự bấm nộp để an toàn
  const submitBtn =
    peerContainer.querySelector('.rc-FormSubmit button[type="submit"]') ||
    peerContainer.querySelector('button[data-testid*="submit-review"]') ||
    Array.from(peerContainer.querySelectorAll('button[type="submit"], button')).find((b) => {
      const txt = (b.textContent || '').trim().toLowerCase();
      return (txt.includes('submit') || txt.includes('nộp')) && !txt.includes('cancel') && !txt.includes('hủy');
    });

  if (submitBtn) {
    if (typeof submitBtn.scrollIntoView === 'function') {
      submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const originalOutline = submitBtn.style?.outline;
    if (submitBtn.style) {
      submitBtn.style.outline = '3px solid #a855f7';
      submitBtn.style.boxShadow = '0 0 14px rgba(168, 85, 247, 0.6)';
      setTimeout(() => {
        if (submitBtn.style) {
          submitBtn.style.outline = originalOutline || '';
          submitBtn.style.boxShadow = '';
        }
      }, 4000);
    }
  }

  return {
    success: true,
    submitted: false,
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
  if (message.action === 'markAllDiscussionsCompleted') {
    markAllDiscussionsCompleted();
    sendResponse({ success: true, message: "Đã bắt đầu xử lý toàn bộ thảo luận." });
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
 * Fallback DOM: Tự động tìm khung soạn thảo trên trang, điền nội dung,
 * chờ nút Reply được enable (không còn disabled) rồi mới bấm.
 */
async function postDiscussionViaDOM(text) {
  // 1. Tìm ô soạn thảo (contenteditable div hoặc textarea)
  let editor = document.querySelector(
    'div[contenteditable="true"], div[role="textbox"], .cml-editor, div[data-testid*="editor"], textarea'
  );

  if (!editor) {
    const allDivs = Array.from(document.querySelectorAll('div, textarea'));
    editor = allDivs.find(d => {
      const ph = d.getAttribute('placeholder') || d.getAttribute('aria-label') || '';
      return ph.toLowerCase().includes('type your response') || ph.toLowerCase().includes('response');
    });
  }

  if (!editor) {
    return { success: false, error: 'Không tìm thấy ô nhập câu trả lời thảo luận trên trang.' };
  }

  editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
  editor.focus();
  editor.click();
  await sleep(300);

  // 2. Điền nội dung câu trả lời
  fillTextInput(editor, text);
  await sleep(400);

  // Helper tìm nút Reply
  function findReplyBtn() {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(b => {
      const txt = (b.textContent || '').trim().toLowerCase();
      return txt === 'reply' || txt === 'phản hồi' || txt === 'post' || txt === 'submit reply';
    }) || document.querySelector('button[data-testid*="reply"], button[data-testid*="comment-submit"], button[type="submit"]');
  }

  // Helper kiểm tra nút đã sẵn sàng để bấm (hết disabled)
  function isButtonReady(btn) {
    if (!btn) return false;
    if (btn.disabled) return false;
    if (btn.getAttribute('aria-disabled') === 'true') return false;
    if (btn.classList.contains('disabled') || btn.classList.contains('cds-button-disabled')) return false;
    const style = window.getComputedStyle(btn);
    if (style.pointerEvents === 'none') return false;
    if (style.opacity && parseFloat(style.opacity) < 0.6) return false;
    return true;
  }

  // 3. VÒNG LẶP CHỜ: Đợi nút Reply chuyển sang enabled (tối đa 8 giây)
  const startTime = Date.now();
  const TIMEOUT_MS = 8000;
  let replyBtn = findReplyBtn();

  console.log('[CourseraSkip] Waiting for Reply button to become enabled...');

  while (Date.now() - startTime < TIMEOUT_MS) {
    replyBtn = findReplyBtn();

    if (replyBtn && isButtonReady(replyBtn)) {
      console.log('[CourseraSkip] Reply button is enabled! Clicking now...');
      replyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(300);
      replyBtn.click();
      // Chờ phản hồi gửi đi đến server
      await sleep(1500);
      return {
        success: true,
        submitted: true,
        message: '✅ Đã điền câu trả lời và tự động bấm Reply thành công!'
      };
    }

    // Kích hoạt thêm sự kiện để nhắc React cập nhật trạng thái ô nhập nếu sau 1.5s vẫn chưa enable
    if (Date.now() - startTime > 1500 && Date.now() - startTime < 1800) {
      editor.focus();
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    }

    await sleep(250);
  }

  // Nếu sau 8s nút vẫn chưa enabled (ví dụ user cần duyệt lại)
  if (replyBtn) {
    replyBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    replyBtn.style.outline = '3px solid #0ea5e9';
    replyBtn.style.boxShadow = '0 0 12px #0ea5e9aa';
    return {
      success: true,
      submitted: false,
      message: '✅ Đã điền câu trả lời! Nút Reply đang chờ sẵn (viền xanh), bạn hãy kiểm tra và bấm Reply nhé.'
    };
  }

  return {
    success: true,
    submitted: false,
    message: '✅ Đã điền câu trả lời vào khung soạn thảo!'
  };
}

/**
 * Tự động đăng câu trả lời vào Discussion Prompt của bài học hiện tại.
 * Flow:
 *  1. Thử qua Coursera Forum API (nhanh & sạch)
 *  2. Nếu API không được → tự động fallback sang tương tác DOM trực tiếp (chờ nút enabled rồi mới bấm)
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

      if (!promptRes.ok) {
        return {
          success: false,
          error: `Không lấy được thông tin bài thảo luận từ API (HTTP ${promptRes.status}). Vui lòng thử lại.`,
        };
      }

      const promptData = await promptRes.json();
      const courseItemForumQuestionId = promptData?.elements?.[0]?.promptType?.courseItemForumQuestionId
        ?? promptData?.elements?.[0]?.question?.courseItemForumQuestionId;

      if (!courseItemForumQuestionId) {
        return {
          success: false,
          error: 'Không tìm thấy forum question ID của bài thảo luận này.',
        };
      }

      const parts = courseItemForumQuestionId.split('~');
      const questionId = parts[2] || parts[parts.length - 1];

      if (!questionId) {
        return {
          success: false,
          error: 'Định dạng question ID không hợp lệ.',
        };
      }

      // 1. Kiểm tra duplicate trước khi gọi bất kỳ API POST hay DOM fallback nào!
      let alreadyAnswered = false;
      try {
        alreadyAnswered = await hasUserAnsweredDiscussion(courseId, questionId, userId);
      } catch (checkErr) {
        console.log('[CourseraSkip] Duplicate check failed:', checkErr);
        return {
          success: false,
          error: `Không thể kiểm tra câu trả lời cũ (${checkErr.message}). Vui lòng thử lại để tránh gửi trùng lặp.`,
        };
      }

      if (alreadyAnswered) {
        return {
          success: true,
          submitted: false,
          skippedDuplicate: true,
          message: 'ℹ️ Bạn đã đăng câu trả lời cho bài thảo luận này từ trước rồi!',
        };
      }

      // 2. Gửi trả lời qua API kèm retry nếu gặp 429
      const postRes = await postDiscussionAnswerWithRetry(courseId, questionId, csrfToken, answerText);
      if (postRes && (postRes.ok || postRes.status === 201)) {
        return {
          success: true,
          submitted: true,
          message: '✅ Đã đăng câu trả lời thảo luận thành công! Coursera sẽ tự cập nhật tiến độ.',
        };
      }

      // API POST trả mã lỗi sau khi đã kiểm tra duplicate an toàn
      console.log('[CourseraSkip] API post discussion failed with status:', postRes?.status, 'falling back to DOM...');
      return await postDiscussionViaDOM(answerText);
    }
  } catch (apiErr) {
    console.log('[CourseraSkip] API post discussion exception:', apiErr);
    return {
      success: false,
      error: `Lỗi khi gửi thảo luận: ${apiErr.message}`,
    };
  }

  // --- CÁCH 2: Fallback qua tương tác DOM (chỉ khi không có userId/courseId) ---
  console.log('[CourseraSkip] Running DOM fallback for discussion post with polling...');
  return await postDiscussionViaDOM(answerText);
}

// =========================================================================
// ===== IN-PAGE FLOATING WIDGET (Giao diện cố định trên trang Coursera) =====
// =========================================================================

const WIDGET_I18N = {
  vi: {
    langBadge: 'VI',
    detected: 'ĐÃ NHẬN DIỆN BÀI HỌC',
    courseOverview: 'Trang tổng quan khóa học',
    typeLabel: 'Loại bài',
    btnCurrent: 'Hoàn thành bài hiện tại',
    btnBulkVR: 'Hoàn thành toàn bộ Video & Reading',
    btnBulkDisc: 'Hoàn thành toàn bộ Discussion',
    btnPeer: 'Tự động chấm bài bạn học',
    processingCurrent: 'Đang xử lý...',
    processingBulk: 'Đang khởi động...',
    rateToastMsg: 'Tiết kiệm thời gian? Đánh giá 5★ trên Cửa hàng nhé!'
  },
  en: {
    langBadge: 'EN',
    detected: 'LESSON DETECTED',
    courseOverview: 'Course Overview',
    typeLabel: 'Type',
    btnCurrent: 'Complete Current Lesson',
    btnBulkVR: 'Complete All Video & Reading',
    btnBulkDisc: 'Complete All Discussions',
    btnPeer: 'Auto Grade Peer Review',
    processingCurrent: 'Completing...',
    processingBulk: 'Starting...',
    rateToastMsg: 'Saved your time? Rate 5★ on Chrome Web Store!'
  }
};

let widgetShadow = null;
let currentWidgetLang = localStorage.getItem('coursera_skip_lang') || (navigator.language?.startsWith('vi') ? 'vi' : 'en');
let isWidgetProcessing = false;

function wt(key) {
  const dict = WIDGET_I18N[currentWidgetLang] || WIDGET_I18N.vi;
  return dict[key] || WIDGET_I18N.vi[key] || key;
}

function updateFloatingWidgetProgress(data) {
  if (!widgetShadow) return;
  const wrap = widgetShadow.getElementById('cs-progress-wrap');
  const msgEl = widgetShadow.getElementById('cs-prog-msg');
  const pctEl = widgetShadow.getElementById('cs-prog-pct');
  const fillEl = widgetShadow.getElementById('cs-prog-bar-fill');
  const currentBtn = widgetShadow.getElementById('cs-btn-current');
  const vrBtn = widgetShadow.getElementById('cs-btn-bulk-vr');
  const discBtn = widgetShadow.getElementById('cs-btn-bulk-disc');

  if (!wrap || !msgEl || !pctEl || !fillEl) return;

  if (data.status === 'loading' || data.status === 'starting' || data.status === 'progress') {
    wrap.style.display = 'block';
    isWidgetProcessing = true;
    if (vrBtn) vrBtn.disabled = true;
    if (discBtn) discBtn.disabled = true;
    if (currentBtn) currentBtn.disabled = true;

    const current = data.current || 0;
    const total = data.total || 1;
    const pct = Math.min(100, Math.round((current / total) * 100));

    pctEl.textContent = `${pct}%`;
    fillEl.style.width = `${pct}%`;
    msgEl.textContent = data.message || `Đang xử lý: ${current} / ${total}`;
  } else if (data.status === 'completed') {
    wrap.style.display = 'block';
    fillEl.style.width = '100%';
    pctEl.textContent = '100%';
    msgEl.textContent = data.message || '✅ Hoàn thành!';
    isWidgetProcessing = false;
    if (vrBtn) { vrBtn.disabled = false; vrBtn.classList.remove('loading'); }
    if (discBtn) { discBtn.disabled = false; discBtn.classList.remove('loading'); }
    if (currentBtn) { currentBtn.disabled = false; currentBtn.classList.remove('loading'); }

    setTimeout(() => {
      window.location.reload();
    }, 1800);
  } else if (data.status === 'partial') {
    wrap.style.display = 'block';
    fillEl.style.width = '100%';
    pctEl.textContent = '100%';
    msgEl.textContent = data.message || '⚠️ Hoàn thành một phần!';
    isWidgetProcessing = false;
    if (vrBtn) { vrBtn.disabled = false; vrBtn.classList.remove('loading'); }
    if (discBtn) { discBtn.disabled = false; discBtn.classList.remove('loading'); }
    if (currentBtn) { currentBtn.disabled = false; currentBtn.classList.remove('loading'); }
    showWidgetAlert('warning', data.message || 'Một số bài chưa thể hoàn thành.');
  } else if (data.status === 'error') {
    wrap.style.display = 'none';
    isWidgetProcessing = false;
    if (vrBtn) { vrBtn.disabled = false; vrBtn.classList.remove('loading'); }
    if (discBtn) { discBtn.disabled = false; discBtn.classList.remove('loading'); }
    if (currentBtn) { currentBtn.disabled = false; currentBtn.classList.remove('loading'); }
    showWidgetAlert('error', data.message || 'Đã xảy ra lỗi.');
  }
}

function showWidgetAlert(type, message) {
  if (!widgetShadow) return;
  const alertEl = widgetShadow.getElementById('cs-alert');
  if (!alertEl) return;
  alertEl.style.display = 'block';
  alertEl.className = `cs-alert cs-alert-${type}`;
  alertEl.textContent = message;
  setTimeout(() => {
    if (alertEl) alertEl.style.display = 'none';
  }, 6000);
}

function updateWidgetContext() {
  if (!widgetShadow) return;
  const ctx = getCourseContext();

  const statusCard = widgetShadow.getElementById('cs-status-card');
  const courseNameEl = widgetShadow.getElementById('cs-course-name');
  const typeTextEl = widgetShadow.getElementById('cs-type-text');
  const typeIconEl = widgetShadow.getElementById('cs-type-icon');
  const currentBtn = widgetShadow.getElementById('cs-btn-current');
  const peerBtn = widgetShadow.getElementById('cs-btn-peer');

  if (!ctx || !ctx.courseSlug) {
    if (statusCard) statusCard.style.display = 'none';
    return;
  }

  if (statusCard) statusCard.style.display = 'block';
  if (courseNameEl) {
    const formattedSlug = ctx.courseSlug
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    courseNameEl.textContent = formattedSlug;
  }

  const typeConfigMap = {
    course: { icon: '🎓', en: 'Course Overview', vi: 'Trang khóa học' },
    lecture: { icon: '🎬', en: 'Video Lecture', vi: 'Bài giảng Video' },
    supplement: { icon: '📖', en: 'Reading Material', vi: 'Tài liệu Đọc' },
    quiz: { icon: '📝', en: 'Quiz Assessment', vi: 'Bài kiểm tra (Quiz)' },
    programming: { icon: '💻', en: 'Programming Lab', vi: 'Bài tập Thực hành' },
    peer: { icon: '👥', en: 'Peer Review', vi: 'Bài tập Chấm chéo' },
    discussionPrompt: { icon: '💬', en: 'Discussion Prompt', vi: 'Câu hỏi thảo luận' },
    dialogue: { icon: '💬', en: 'Dialogue', vi: 'Hội thoại (Dialogue)' },
  };

  const currentType = ctx.itemType || 'course';
  const cfg = typeConfigMap[currentType] || { icon: '📄', en: currentType, vi: currentType };

  if (typeIconEl) typeIconEl.textContent = cfg.icon;
  if (typeTextEl) typeTextEl.textContent = currentWidgetLang === 'vi' ? cfg.vi : cfg.en;

  // Toggle peer button vs current button
  if (currentType === 'peer') {
    if (peerBtn) peerBtn.style.display = 'flex';
    if (currentBtn) currentBtn.style.display = 'none';
  } else {
    if (peerBtn) peerBtn.style.display = 'none';
    if (currentBtn) currentBtn.style.display = 'flex';
  }
}

function updateWidgetLanguageUI() {
  if (!widgetShadow) return;
  const langBtn = widgetShadow.getElementById('cs-lang-btn');
  const statusLabel = widgetShadow.getElementById('cs-status-label');
  const metaLabel = widgetShadow.getElementById('cs-meta-type-label');
  const txtCurrent = widgetShadow.getElementById('cs-txt-current');
  const txtBulkVR = widgetShadow.getElementById('cs-txt-bulk-vr');
  const txtBulkDisc = widgetShadow.getElementById('cs-txt-bulk-disc');
  const txtPeer = widgetShadow.getElementById('cs-txt-peer');

  if (langBtn) langBtn.textContent = wt('langBadge');
  if (statusLabel) statusLabel.textContent = wt('detected');
  if (metaLabel) metaLabel.textContent = wt('typeLabel');
  if (txtCurrent) txtCurrent.textContent = wt('btnCurrent');
  if (txtBulkVR) txtBulkVR.textContent = wt('btnBulkVR');
  if (txtBulkDisc) txtBulkDisc.textContent = wt('btnBulkDisc');
  if (txtPeer) txtPeer.textContent = wt('btnPeer');

  updateWidgetContext();
}

function initFloatingWidget() {
  // Chỉ tạo nếu đang ở trang khóa học và chưa tồn tại widget
  if (document.getElementById('coursera-skip-widget-host')) return;
  if (!window.location.href.includes('/learn/')) return;

  const host = document.createElement('div');
  host.id = 'coursera-skip-widget-host';
  widgetShadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      all: initial;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483647;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 13px;
      user-select: none;
      line-height: 1.4;
    }

    /* Floating Badge (Collapsed FAB) */
    .cs-badge {
      display: none;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
      cursor: pointer;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      border: 2px solid rgba(255, 255, 255, 0.2);
    }
    .cs-badge:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 10px 25px rgba(99, 102, 241, 0.6);
    }
    .cs-badge-icon {
      font-size: 22px;
      line-height: 1;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    .cs-badge-pulse {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #10b981;
      border: 2px solid #0f172a;
      box-shadow: 0 0 8px #10b981;
    }

    /* Main Floating Panel */
    .cs-panel {
      width: 320px;
      background: #0f172a;
      background-image: 
        radial-gradient(circle at 10% 10%, rgba(99, 102, 241, 0.2) 0%, transparent 50%),
        radial-gradient(circle at 90% 90%, rgba(16, 185, 129, 0.15) 0%, transparent 50%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05);
      color: #f8fafc;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: csFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Header (Draggable) */
    .cs-header {
      padding: 12px 14px;
      background: rgba(30, 41, 59, 0.6);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: move;
    }
    .cs-brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .cs-logo {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
    }
    .cs-title {
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.01em;
    }
    .cs-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cs-pill-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #a5b4fc;
      border-radius: 12px;
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }
    .cs-pill-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
    }
    .cs-icon-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.2s;
    }
    .cs-icon-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    /* Body */
    .cs-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Alert Banner */
    .cs-alert {
      padding: 8px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.35;
      animation: csFadeIn 0.2s ease;
    }
    .cs-alert-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
    }
    .cs-alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
    }
    .cs-alert-warning {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
    }

    /* Status Card */
    .cs-status-card {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px 12px;
    }
    .cs-status-top {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #10b981;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .cs-pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 6px #10b981;
      animation: csPulse 1.8s infinite;
    }
    .cs-course-name {
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 6px;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cs-meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 6px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .cs-meta-label {
      color: #64748b;
      font-size: 11px;
    }
    .cs-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.25);
    }

    /* Buttons */
    .cs-actions {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .cs-btn {
      width: 100%;
      border: none;
      padding: 9px 12px;
      border-radius: 8px;
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s ease;
      position: relative;
    }
    .cs-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }
    .cs-btn-primary {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
    }
    .cs-btn-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.45);
    }
    .cs-btn-magic {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
    }
    .cs-btn-magic:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    .cs-btn-discuss {
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);
    }
    .cs-btn-discuss:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
    }
    .cs-btn-peer {
      background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
      box-shadow: 0 2px 8px rgba(168, 85, 247, 0.25);
    }
    .cs-btn-peer:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(236, 72, 153, 0.45);
    }

    /* Progress UI */
    .cs-progress-wrap {
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 8px 10px;
      animation: csFadeIn 0.2s ease;
    }
    .cs-progress-info {
      font-size: 11px;
      color: #38bdf8;
      font-weight: 600;
      margin-bottom: 5px;
      display: flex;
      justify-content: space-between;
    }
    .cs-prog-bar-bg {
      width: 100%;
      height: 5px;
      background: rgba(0, 0, 0, 0.35);
      border-radius: 3px;
      overflow: hidden;
    }
    .cs-prog-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #38bdf8, #818cf8);
      width: 0%;
      transition: width 0.3s ease;
    }

    /* Spinner */
    .cs-spinner {
      display: none;
      width: 13px;
      height: 13px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: csSpin 0.8s linear infinite;
    }
    .cs-btn.loading .cs-spinner { display: block; }
    .cs-btn.loading .cs-btn-icon { display: none; }

    @keyframes csSpin { to { transform: rotate(360deg); } }
    @keyframes csPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } }
    @keyframes csFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  `;

  const container = document.createElement('div');
  container.className = 'cs-widget-root';
  container.innerHTML = `
    <!-- Floating Badge -->
    <div class="cs-badge" id="cs-badge" title="Coursera Skip Tool">
      <div class="cs-badge-icon">⚡</div>
      <span class="cs-badge-pulse"></span>
    </div>

    <!-- Main Panel -->
    <div class="cs-panel" id="cs-panel">
      <!-- Header -->
      <div class="cs-header" id="cs-header">
        <div class="cs-brand">
          <div class="cs-logo">⚡</div>
          <span class="cs-title">Coursera Skip</span>
        </div>
        <div class="cs-header-actions">
          <button class="cs-pill-btn" id="cs-lang-btn" title="Switch Language">VI</button>
          <button class="cs-icon-btn" id="cs-min-btn" title="Thu nhỏ">─</button>
        </div>
      </div>

      <!-- Body -->
      <div class="cs-body">
        <div class="cs-alert" id="cs-alert" style="display: none;"></div>

        <!-- Status Card -->
        <div class="cs-status-card" id="cs-status-card">
          <div class="cs-status-top">
            <span class="cs-pulse-dot"></span>
            <span class="cs-status-label" id="cs-status-label">ĐÃ NHẬN DIỆN BÀI HỌC</span>
          </div>
          <div class="cs-course-name" id="cs-course-name">--</div>
          <div class="cs-meta-row">
            <span class="cs-meta-label" id="cs-meta-type-label">Loại bài</span>
            <span class="cs-type-badge" id="cs-type-badge">
              <span id="cs-type-icon">🎬</span>
              <span id="cs-type-text">--</span>
            </span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="cs-actions">
          <button class="cs-btn cs-btn-primary" id="cs-btn-current">
            <span class="cs-btn-icon">⚡</span>
            <div class="cs-spinner"></div>
            <span class="cs-btn-text" id="cs-txt-current">Hoàn thành bài hiện tại</span>
          </button>

          <button class="cs-btn cs-btn-magic" id="cs-btn-bulk-vr">
            <span class="cs-btn-icon">🚀</span>
            <div class="cs-spinner"></div>
            <span class="cs-btn-text" id="cs-txt-bulk-vr">Hoàn thành toàn bộ Video & Reading</span>
          </button>

          <button class="cs-btn cs-btn-discuss" id="cs-btn-bulk-disc">
            <span class="cs-btn-icon">💬</span>
            <div class="cs-spinner"></div>
            <span class="cs-btn-text" id="cs-txt-bulk-disc">Hoàn thành toàn bộ Discussion</span>
          </button>

          <button class="cs-btn cs-btn-peer" id="cs-btn-peer" style="display: none;">
            <span class="cs-btn-icon">👥</span>
            <div class="cs-spinner"></div>
            <span class="cs-btn-text" id="cs-txt-peer">Tự động chấm bài bạn học</span>
          </button>
        </div>

        <!-- Progress UI -->
        <div class="cs-progress-wrap" id="cs-progress-wrap" style="display: none;">
          <div class="cs-progress-info">
            <span class="cs-prog-msg" id="cs-prog-msg">Đang khởi tạo...</span>
            <span class="cs-prog-pct" id="cs-prog-pct">0%</span>
          </div>
          <div class="cs-prog-bar-bg">
            <div class="cs-prog-bar-fill" id="cs-prog-bar-fill"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  widgetShadow.appendChild(style);
  widgetShadow.appendChild(container);
  document.body.appendChild(host);

  // Setup DOM elements
  const badgeEl = widgetShadow.getElementById('cs-badge');
  const panelEl = widgetShadow.getElementById('cs-panel');
  const minBtn = widgetShadow.getElementById('cs-min-btn');
  const langBtn = widgetShadow.getElementById('cs-lang-btn');
  const headerEl = widgetShadow.getElementById('cs-header');

  const btnCurrent = widgetShadow.getElementById('cs-btn-current');
  const btnBulkVR = widgetShadow.getElementById('cs-btn-bulk-vr');
  const btnBulkDisc = widgetShadow.getElementById('cs-btn-bulk-disc');
  const btnPeer = widgetShadow.getElementById('cs-btn-peer');

  // Load saved minimize state
  const isMinimized = localStorage.getItem('coursera_skip_widget_minimized') === 'true';
  if (isMinimized) {
    badgeEl.style.display = 'flex';
    panelEl.style.display = 'none';
  } else {
    badgeEl.style.display = 'none';
    panelEl.style.display = 'flex';
  }

  // Load saved position
  try {
    const savedPos = JSON.parse(localStorage.getItem('coursera_skip_widget_pos'));
    if (savedPos && savedPos.left && savedPos.top) {
      host.style.bottom = 'auto';
      host.style.right = 'auto';
      host.style.left = `${Math.min(window.innerWidth - 80, Math.max(10, savedPos.left))}px`;
      host.style.top = `${Math.min(window.innerHeight - 80, Math.max(10, savedPos.top))}px`;
    }
  } catch (_) {}

  // Minimize / Expand logic
  minBtn.addEventListener('click', () => {
    panelEl.style.display = 'none';
    badgeEl.style.display = 'flex';
    localStorage.setItem('coursera_skip_widget_minimized', 'true');
  });

  badgeEl.addEventListener('click', () => {
    badgeEl.style.display = 'none';
    panelEl.style.display = 'flex';
    localStorage.setItem('coursera_skip_widget_minimized', 'false');
    updateWidgetContext();
  });

  // Language switch
  langBtn.addEventListener('click', () => {
    currentWidgetLang = currentWidgetLang === 'vi' ? 'en' : 'vi';
    localStorage.setItem('coursera_skip_lang', currentWidgetLang);
    updateWidgetLanguageUI();
  });

  // Draggable logic on header
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  headerEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return; // Không kéo khi click button
    isDragging = true;
    const rect = host.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    headerEl.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const newLeft = e.clientX - dragOffsetX;
    const newTop = e.clientY - dragOffsetY;

    const clampedX = Math.max(10, Math.min(window.innerWidth - 340, newLeft));
    const clampedY = Math.max(10, Math.min(window.innerHeight - 150, newTop));

    host.style.bottom = 'auto';
    host.style.right = 'auto';
    host.style.left = `${clampedX}px`;
    host.style.top = `${clampedY}px`;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    headerEl.style.cursor = 'move';
    const rect = host.getBoundingClientRect();
    localStorage.setItem('coursera_skip_widget_pos', JSON.stringify({ left: rect.left, top: rect.top }));
  });

  // Action: Hoàn thành bài hiện tại
  btnCurrent.addEventListener('click', async () => {
    if (isWidgetProcessing) return;
    btnCurrent.classList.add('loading');
    btnCurrent.disabled = true;

    try {
      const res = await markCurrentItemCompleted();
      if (res && res.success) {
        showWidgetAlert('success', res.message || '✅ Đã hoàn thành bài học!');
        if (res.submitted !== false) {
          setTimeout(() => { window.location.reload(); }, 1800);
        }
      } else {
        showWidgetAlert('error', res?.error || res?.message || 'Có lỗi xảy ra.');
      }
    } catch (err) {
      showWidgetAlert('error', err.message || 'Lỗi không xác định.');
    } finally {
      btnCurrent.classList.remove('loading');
      btnCurrent.disabled = false;
    }
  });

  // Action: Hoàn thành toàn bộ Video & Reading
  btnBulkVR.addEventListener('click', async () => {
    if (isWidgetProcessing) return;
    btnBulkVR.classList.add('loading');
    btnBulkVR.disabled = true;
    markAllItemsCompleted();
  });

  // Action: Hoàn thành toàn bộ Discussion
  btnBulkDisc.addEventListener('click', async () => {
    if (isWidgetProcessing) return;
    btnBulkDisc.classList.add('loading');
    btnBulkDisc.disabled = true;
    markAllDiscussionsCompleted();
  });

  // Action: Chấm bài Peer Review
  if (btnPeer) {
    btnPeer.addEventListener('click', async () => {
      if (isWidgetProcessing) return;
      btnPeer.classList.add('loading');
      btnPeer.disabled = true;
      try {
        const res = await autoGradePeerReview();
        if (res && res.success) {
          showWidgetAlert('success', res.message);
        } else {
          showWidgetAlert('error', res?.error || 'Có lỗi khi chấm bài.');
        }
      } catch (err) {
        showWidgetAlert('error', err.message || 'Lỗi.');
      } finally {
        btnPeer.classList.remove('loading');
        btnPeer.disabled = false;
      }
    });
  }

  // Initial render
  updateWidgetLanguageUI();

  // Watch for SPA navigation changes
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      updateWidgetContext();
    }
  }, 1200);
}

// Khởi chạy widget tự động khi DOM sẵn sàng
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFloatingWidget);
} else {
  initFloatingWidget();
}


