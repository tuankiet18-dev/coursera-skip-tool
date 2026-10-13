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

  // 2. Graded Quiz / Assignment Submission — MUST be checked BEFORE peerMatch
  //    URL pattern: /learn/{slug}/assignment-submission/{itemId}/{quizSlug}/attempt
  const quizSubmitMatch = href.match(
    /\/learn\/([^/]+)\/assignment-submission\/([^/?#]+)/i
  );
  if (quizSubmitMatch) {
    return { courseSlug: quizSubmitMatch[1], itemType: 'gradedQuiz', itemId: quizSubmitMatch[2] };
  }

  // 3. Peer review URLs — Coursera uses several patterns:
  //    /learn/{slug}/peer/{itemId}
  //    /learn/{slug}/peer/{itemId}/give-feedback
  //    /learn/{slug}/peer/{itemId}/review
  //    /learn/{slug}/peer-review/{itemId}
  //    /learn/{slug}/peer-assignment/{itemId}
  //    /learn/{slug}/submit-revisions/{itemId}  (resubmit review)
  //    NOTE: assignment-submission is intentionally excluded — handled above as gradedQuiz
  const peerMatch = href.match(
    /\/learn\/([^/]+)\/(?:peer-review|peer|peer-assignment|submit-revisions)\/([^/?#]+)/i
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

  // 4. Fallback for any discussionPrompt URL variations
  const discMatch = href.match(/\/learn\/([^/]+)\/discussionPrompt\/([^/?#]+)/i);
  if (discMatch) {
    return { courseSlug: discMatch[1], itemType: 'discussionPrompt', itemId: discMatch[2] };
  }

  // 5. Any course page (/learn/{courseSlug}/...) e.g. home, week overview, syllabus
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
    return { success: true, step: 3, videoId: meta.videoId, key: 'successLecture', message: wt('successLecture') };
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
    return { success: false, key: 'notOnLesson', error: wt('notOnLesson') };
  }

  const { courseSlug, itemType, itemId } = context;

  // Nếu đang ở trang tổng quan khóa học (không ở bài học cụ thể)
  if (!itemId) {
    return {
      success: false,
      key: 'courseOverview',
      error: wt('courseOverview')
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

  // Nếu bài hiện tại là Graded Quiz — dùng AI
  if (itemType === 'gradedQuiz') {
    return await autoAnswerGradedQuiz();
  }

  const courseId = await getCourseId(courseSlug);
  if (!courseId) return { success: false, key: 'unknownError', error: wt('unknownError') };

  const userId = await getUserId(courseId);
  if (!userId) return { success: false, key: 'notLoggedIn', error: wt('notLoggedIn') };

  console.log(`[CourseraSkip] courseId=${courseId} | userId=${userId}`);

  if (itemType === 'lecture') {
    const result = await markLectureCompleted(userId, courseId, courseSlug, itemId);
    const suffix = result.retries ? ` (retry ×${result.retries})` : result.step === 'fallback-PUT' ? ' (fallback)' : '';
    const key = result.success ? 'successLecture' : null;
    const finalMsg = result.message || (result.success ? `${wt('successLecture')}${suffix}` : (result.error || wt('unknownError')));
    return { ...result, key, message: finalMsg, itemType, courseId, userId, itemId };
  }

  if (itemType === 'supplement') {
    const result = await markSupplementCompleted(userId, courseId, courseSlug, itemId);
    const suffix = result.fallback ? ' (fallback)' : '';
    const key = result.success ? 'successSupplement' : null;
    const finalMsg = result.success ? `${wt('successSupplement')}${suffix}` : (result.error || wt('unknownError'));
    return { ...result, key, message: finalMsg, itemType, courseId, userId, itemId };
  }

  return { success: false, key: 'unknownError', error: wt('unknownError') };
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
    notifyProgress({ status: 'error', code: 'NO_CONTEXT', key: 'notOnLesson', message: wt('notOnLesson') });
    return;
  }

  const { courseSlug } = context;
  notifyProgress({ status: 'loading', code: 'FETCHING_CURRICULUM', key: 'fetchingCurriculum', message: wt('fetchingCurriculum') });

  const material = await getAllCourseItems(courseSlug);
  if (!material || !material.linked || !material.linked['onDemandCourseMaterialItems.v2']) {
    notifyProgress({ status: 'error', code: 'FETCH_FAILED', key: 'unknownError', message: wt('unknownError') });
    return;
  }

  const items = material.linked['onDemandCourseMaterialItems.v2'].filter(
    (f) => f.contentSummary && (f.contentSummary.typeName.includes('lecture') || f.contentSummary.typeName.includes('supplement'))
  );

  const total = items.length;
  let completed = 0;
  
  if (total === 0) {
    notifyProgress({ status: 'error', code: 'NO_ITEMS', key: 'noItemsFound', message: wt('noItemsFound') });
    return;
  }

  const courseId = material.elements?.[0]?.id;
  if (!courseId) {
    notifyProgress({ status: 'error', code: 'NO_COURSE_ID', key: 'unknownError', message: wt('unknownError') });
    return;
  }

  const userId = await getUserId(courseId);
  if (!userId) {
    notifyProgress({ status: 'error', code: 'NO_USER_ID', key: 'notLoggedIn', message: wt('notLoggedIn') });
    return;
  }

  const batchSize = 5;
  notifyProgress({ status: 'starting', current: 0, total, key: 'startingBulkVR', params: { total }, message: wt('startingBulkVR', { total }) });

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
    notifyProgress({
      status: 'progress',
      current: completed,
      total,
      key: 'processingBulkCount',
      params: { current: completed, total },
      message: wt('processingBulkCount', { current: completed, total })
    });
    
    // Tạm nghỉ 2s giữa các batch để tránh bị server Coursera rate limit
    if (completed < total) {
      await sleep(2000);
    }
  }

  const status = failedCount === 0 ? 'completed' : (successCount > 0 ? 'partial' : 'error');
  const finalKey = failedCount === 0 ? 'completedBulk' : 'partialBulk';
  const finalParams = failedCount === 0 ? { total } : { success: successCount, failed: failedCount };
  const finalMsg = wt(finalKey, finalParams);

  notifyProgress({
    status,
    current: total,
    total,
    key: finalKey,
    params: finalParams,
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
    notifyProgress({ status: 'error', code: 'NO_CONTEXT', key: 'notOnLesson', message: wt('notOnLesson') });
    return;
  }

  const { courseSlug } = context;
  notifyProgress({ status: 'loading', code: 'FETCHING_CURRICULUM', key: 'fetchingDiscussions', message: wt('fetchingDiscussions') });

  const material = await getAllCourseItems(courseSlug);
  if (!material || !material.linked || !material.linked['onDemandCourseMaterialItems.v2']) {
    notifyProgress({ status: 'error', code: 'FETCH_FAILED', key: 'unknownError', message: wt('unknownError') });
    return;
  }

  // Lọc tất cả các bài Discussion Prompt trong toàn bộ khóa học
  const discussionItems = material.linked['onDemandCourseMaterialItems.v2'].filter(
    (f) => f.contentSummary && f.contentSummary.typeName && f.contentSummary.typeName.includes('discussionPrompt')
  );

  const total = discussionItems.length;
  if (total === 0) {
    notifyProgress({ status: 'error', code: 'NO_ITEMS', key: 'noItemsFound', message: wt('noItemsFound') });
    return;
  }

  const courseId = material.elements?.[0]?.id || await getCourseId(courseSlug);
  if (!courseId) {
    notifyProgress({ status: 'error', code: 'NO_COURSE_ID', key: 'unknownError', message: wt('unknownError') });
    return;
  }

  const userId = await getUserId(courseId);
  if (!userId) {
    notifyProgress({ status: 'error', code: 'NO_USER_ID', key: 'notLoggedIn', message: wt('notLoggedIn') });
    return;
  }

  const csrfToken = getCsrfToken();
  notifyProgress({ status: 'starting', current: 0, total, key: 'startingBulkDisc', params: { total }, message: wt('startingBulkDisc', { total }) });

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
      key: 'processingBulkCount',
      params: { current: completed, total },
      message: wt('processingBulkCount', { current: completed, total })
    });

    // Nghỉ 1.8s giữa các bài để tôn trọng rate limit của Coursera
    if (completed < total) {
      await sleep(1800);
    }
  }

  const status = failedCount === 0 ? 'completed' : (successCount > 0 ? 'partial' : 'error');
  const finalKey = failedCount === 0 ? 'completedBulkDisc' : 'partialBulk';
  const finalParams = failedCount === 0 ? { total } : { success: successCount, failed: failedCount };
  const finalMsg = wt(finalKey, finalParams);

  notifyProgress({
    status,
    current: total,
    total,
    key: finalKey,
    params: finalParams,
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
        key: 'peerAlreadySelected',
        message: wt('peerAlreadySelected')
      };
    }
    return {
      success: false,
      submitted: false,
      key: 'peerFormNotFound',
      error: wt('peerFormNotFound')
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
    key: 'peerSuccess',
    message: wt('peerSuccess')
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
        key: 'discReplySuccess',
        message: wt('discReplySuccess')
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
      key: 'discReplyReady',
      message: wt('discReplyReady')
    };
  }

  return {
    success: true,
    submitted: false,
    key: 'discReplyReady',
    message: wt('discReplyReady')
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
          key: 'discAlreadyAnswered',
          message: wt('discAlreadyAnswered'),
        };
      }

      // 2. Gửi trả lời qua API kèm retry nếu gặp 429
      const postRes = await postDiscussionAnswerWithRetry(courseId, questionId, csrfToken, answerText);
      if (postRes && (postRes.ok || postRes.status === 201)) {
        return {
          success: true,
          submitted: true,
          key: 'discReplySuccess',
          message: wt('discReplySuccess'),
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
// ===== AUTO GRADED QUIZ (AI-powered) =====
// =========================================================================

/**
 * Extract all quiz questions from the current page DOM.
 * Returns array of { index, questionText, type: 'single'|'multi', options: [{label, element}] }
 */
function extractQuizQuestions() {
  const questions = [];

  // Selector chains for question containers — Coursera has changed UI several times
  const questionContainerSelectors = [
    '[data-testid="question-form"]',
    '.rc-QuestionView',
    '[class*="QuestionView"]',
    '[data-testid*="quiz-question"]',
    '.css-qi35gx',           // common Coursera quiz wrapper class
    'form[data-testid]',
  ];

  let containers = [];
  for (const sel of questionContainerSelectors) {
    const found = Array.from(document.querySelectorAll(sel));
    if (found.length > 0) {
      containers = found;
      console.log(`[CourseraSkip] Quiz containers found via: ${sel} (${found.length})`);
      break;
    }
  }

  // Fallback: find all radio/checkbox groups by name attribute
  if (containers.length === 0) {
    console.log('[CourseraSkip] No quiz containers found — using input group fallback');
    const allInputs = Array.from(document.querySelectorAll('input[type="radio"], input[type="checkbox"]'));
    const groupNames = [...new Set(allInputs.map((i) => i.name).filter(Boolean))];
    groupNames.forEach((name, idx) => {
      const groupInputs = allInputs.filter((i) => i.name === name);
      if (groupInputs.length < 2) return;
      const type = groupInputs[0].type === 'radio' ? 'single' : 'multi';

      // Find question text from nearest label or heading
      let questionText = '';
      const firstInput = groupInputs[0];
      const closestHeading = firstInput.closest('[class*="question"], [class*="Question"], fieldset, form')?.querySelector('h3, h4, p, [class*="text"], [class*="prompt"]');
      if (closestHeading) questionText = closestHeading.innerText.trim();
      if (!questionText) questionText = `Câu ${idx + 1}`;

      const options = groupInputs.map((inp) => {
        const labelEl = inp.closest('label') || document.querySelector(`label[for="${inp.id}"]`);
        const label = labelEl ? labelEl.innerText.trim().replace(/^\s*[\u25CF\u25CB\u25A0\u25A1]\s*/, '') : `Option ${inp.value}`;
        return { label, element: inp };
      });

      questions.push({ index: idx, questionText, type, options });
    });
    return questions;
  }

  // Parse containers
  containers.forEach((container, idx) => {
    // Get question text
    const textSelectors = [
      '[data-testid="question-text"]',
      '[class*="question-text"]',
      '[class*="questionText"]',
      '.rc-CML',
      '[class*="prompt"]',
      'h3', 'h4', 'p',
    ];
    let questionText = '';
    for (const sel of textSelectors) {
      const el = container.querySelector(sel);
      if (el && el.innerText.trim()) {
        questionText = el.innerText.trim();
        break;
      }
    }
    if (!questionText) questionText = `Câu ${idx + 1}`;

    const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));

    const inputs = radios.length > 0 ? radios : checkboxes;
    if (inputs.length === 0) return;

    const type = radios.length > 0 ? 'single' : 'multi';

    const options = inputs.map((inp) => {
      const labelEl = inp.closest('label') || container.querySelector(`label[for="${inp.id}"]`);
      let label = '';
      if (labelEl) {
        // Remove the input itself from text extraction
        try {
          const clone = labelEl.cloneNode ? labelEl.cloneNode(true) : labelEl;
          if (clone && clone.querySelectorAll) {
            clone.querySelectorAll('input').forEach((e) => e.remove && e.remove());
          }
          label = (clone?.innerText || clone?.textContent || '').trim();
        } catch (_) {
          label = (labelEl.innerText || labelEl.textContent || '').trim();
        }
      }
      if (!label) label = inp.value || `Option ${inputs.indexOf(inp)}`;
      return { label, element: inp };
    });

    questions.push({ index: idx, questionText, type, options });
  });

  console.log(`[CourseraSkip] extractQuizQuestions: found ${questions.length} questions`);
  return questions;
}

/**
 * Build a structured prompt for Gemini.
 */
function buildGeminiPrompt(questions) {
  const lines = [
    'You are an AI assistant helping answer a graded online quiz. Read each question carefully and select the best answer(s).',
    'Return ONLY a valid JSON array in this exact format (no explanation, no thoughts, no markdown):',
    '[{"q":1,"answers":[0]},{"q":2,"answers":[1,3]}]',
    'Where "q" is the question number (1-based integer) and "answers" is a list of 0-based option indices.',
    'For single-choice, provide exactly 1 index. For multi-choice, provide the correct number of indices.',
    '',
    '=== QUESTIONS ===',
  ];

  questions.forEach((q, i) => {
    const typeLabel = q.type === 'multi' ? '(multi-choice — select all that apply)' : '(single-choice)';
    lines.push(`Q${i + 1} ${typeLabel}: ${q.questionText}`);
    q.options.forEach((opt, oi) => {
      lines.push(`  ${oi}) ${opt.label}`);
    });
    lines.push('');
  });

  lines.push('=== END OF QUESTIONS ===');
  lines.push('Return ONLY the JSON array. No markdown. No explanation.');

  return lines.join('\n');
}

/**
 * Call AI (Gemini, OpenAI, or Groq) via background service worker proxy, with retry on parse failure.
 */
async function callAiWithRetry(provider, apiKey, prompt, maxRetry = 2) {
  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    let response;
    try {
      response = await new Promise((resolve, reject) => {
        let responded = false;
        try {
          chrome.runtime.sendMessage({ action: 'callAiApi', provider, apiKey, prompt }, (res) => {
            responded = true;
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            resolve(res);
          });
        } catch (_) {}

        if (!responded && provider === 'gemini') {
          try {
            chrome.runtime.sendMessage({ action: 'callGeminiApi', apiKey, prompt }, (legacyRes) => {
              if (legacyRes !== undefined) {
                responded = true;
                resolve(legacyRes);
              }
            });
          } catch (_) {}
        }
      });
    } catch (e) {
      if (attempt === maxRetry) throw e;
      await sleep(1500);
      continue;
    }

    if (!response || !response.ok) {
      const errMsg = response?.error || `Unknown error from ${provider} API`;
      if (attempt === maxRetry) throw new Error(errMsg);
      await sleep(1500);
      continue;
    }

    // Extract text from AI response structure
    let rawText = '';
    if (typeof response.data?.text === 'string') {
      rawText = response.data.text;
    } else {
      const candidate = response.data?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const answerParts = parts.filter((p) => !p.thought && typeof p.text === 'string');
      rawText = answerParts.length > 0
        ? answerParts.map((p) => p.text).join('')
        : (parts[0]?.text || '');
    }

    console.log(`[CourseraSkip] ${provider} raw answer response:`, rawText.slice(0, 500));

    let parsed = null;
    const trimmed = rawText.trim();

    // 1. Direct JSON parse
    try {
      parsed = JSON.parse(trimmed);
    } catch (_) {}

    // 2. Strip markdown fences if direct parse failed
    if (!parsed || (!Array.isArray(parsed) && typeof parsed !== 'object')) {
      const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fenceMatch) {
        try {
          parsed = JSON.parse(fenceMatch[1].trim());
        } catch (_) {}
      }
    }

    // 3. Extract [ ... ] array slice if still not parsed
    if (!parsed || (!Array.isArray(parsed) && typeof parsed !== 'object')) {
      const startIdx = trimmed.indexOf('[');
      const endIdx = trimmed.lastIndexOf(']');
      if (startIdx !== -1 && endIdx > startIdx) {
        try {
          parsed = JSON.parse(trimmed.slice(startIdx, endIdx + 1));
        } catch (_) {}
      }
    }

    // 4. Unwrap if wrapped in object (e.g. { answers: [...] } or { questions: [...] })
    if (parsed && !Array.isArray(parsed) && typeof parsed === 'object') {
      if (Array.isArray(parsed.answers)) parsed = parsed.answers;
      else if (Array.isArray(parsed.questions)) parsed = parsed.questions;
      else if (Array.isArray(parsed.results)) parsed = parsed.results;
      else if (Array.isArray(parsed.data)) parsed = parsed.data;
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }

    console.log(`[CourseraSkip] JSON parse attempt ${attempt + 1} failed | raw:`, rawText.slice(0, 200));
    if (attempt === maxRetry) {
      throw new Error(`${provider.toUpperCase()} trả về định dạng không hợp lệ: không thể trích xuất danh sách đáp án JSON.`);
    }
    await sleep(1000);
  }
}

// Backward compatible alias
async function callGeminiWithRetry(apiKey, prompt, maxRetry = 2) {
  return callAiWithRetry('gemini', apiKey, prompt, maxRetry);
}

/**
 * Fill quiz answers into DOM and highlight the Submit button.
 * answersFromAI: [{q: 1, answers: [0]}, {q: 2, answers: [1,3]}, ...]
 */
function fillQuizAnswers(questions, answersFromAI) {
  let filled = 0;

  answersFromAI.forEach((item) => {
    const qNum = item.q ?? item.question ?? item.questionNumber;
    if (typeof qNum !== 'number') return;
    const qIdx = qNum - 1; // convert 1-based to 0-based
    const q = questions[qIdx];
    if (!q) return;

    let selectedIndices = [];
    if (Array.isArray(item.answers)) {
      selectedIndices = item.answers;
    } else if (Array.isArray(item.answer)) {
      selectedIndices = item.answer;
    } else if (typeof item.answer === 'number') {
      selectedIndices = [item.answer];
    } else if (typeof item.answers === 'number') {
      selectedIndices = [item.answers];
    }

    selectedIndices.forEach((optIdx) => {
      const opt = q.options[optIdx];
      if (!opt || !opt.element) return;

      const inp = opt.element;
      if (inp.disabled) return;

      // Use native click to trigger React/Vue/Angular synthetic events
      inp.click();

      // Also dispatch change event as some frameworks listen to it
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      inp.dispatchEvent(new Event('input', { bubbles: true }));

      console.log(`[CourseraSkip] Filled Q${qNum} option[${optIdx}]: ${opt.label}`);
      filled++;
    });
  });

  // Highlight Submit button — find by common selectors
  const submitSelectors = [
    'button[data-testid="submit-button"]',
    'button[type="submit"]',
    'button[data-testid*="submit"]',
    'button[class*="submit"]',
    'button[aria-label*="Submit"]',
    'button[aria-label*="submit"]',
  ];

  let submitBtn = null;
  for (const sel of submitSelectors) {
    submitBtn = document.querySelector(sel);
    if (submitBtn) break;
  }

  if (!submitBtn) {
    // Text-based fallback
    const allBtns = Array.from(document.querySelectorAll('button'));
    submitBtn = allBtns.find(
      (b) => /submit|nộp bài|hoàn thành/i.test(b.innerText)
    ) || null;
  }

  if (submitBtn) {
    submitBtn.style.outline = '3px solid #10b981';
    submitBtn.style.boxShadow = '0 0 12px rgba(16,185,129,0.6)';
    submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    console.log('[CourseraSkip] Submit button highlighted');
  }

  return { filled, submitHighlighted: !!submitBtn };
}

/**
 * Main orchestrator for AI quiz answering.
 */
async function autoAnswerGradedQuiz() {
  const context = getCourseContext();
  if (!context || context.itemType !== 'gradedQuiz') {
    return { success: false, error: 'Không phải trang Graded Quiz. Hãy mở trang làm bài quiz.' };
  }

  // 1. Get AI config
  let aiConfig = null;
  try {
    aiConfig = await new Promise((resolve) => {
      let resolved = false;
      const finish = (val) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      try {
        chrome.runtime.sendMessage({ action: 'getAiConfig' }, (res) => {
          if (res && res.keys) {
            finish(res);
          } else {
            chrome.runtime.sendMessage({ action: 'getGeminiApiKey' }, (legacyRes) => {
              finish({
                provider: 'gemini',
                keys: { gemini: legacyRes?.apiKey || null },
                apiKey: legacyRes?.apiKey || null,
              });
            });
          }
        });
      } catch (_) {}

      // If mock didn't handle getAiConfig synchronously, try getGeminiApiKey
      if (!resolved) {
        try {
          chrome.runtime.sendMessage({ action: 'getGeminiApiKey' }, (legacyRes) => {
            if (legacyRes !== undefined) {
              finish({
                provider: 'gemini',
                keys: { gemini: legacyRes?.apiKey || null },
                apiKey: legacyRes?.apiKey || null,
              });
            }
          });
        } catch (_) {}
      }

      // Safety timeout in case neither responds
      setTimeout(() => {
        if (!resolved) {
          finish(null);
        }
      }, 500);
    });
  } catch (e) {
    return { success: false, error: 'Không thể kết nối với extension background. Thử reload trang.' };
  }

  let activeProvider = aiConfig?.provider || 'gemini';
  let apiKey = aiConfig?.keys?.[activeProvider] || null;

  // Auto-switch to any configured provider if active provider key is empty
  if (!apiKey || !apiKey.trim()) {
    const keys = aiConfig?.keys || {};
    const available = Object.keys(keys).find((p) => keys[p] && keys[p].trim());
    if (available) {
      activeProvider = available;
      apiKey = keys[available];
      chrome.runtime.sendMessage({ action: 'setAiProvider', provider: activeProvider });
    }
  }

  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      key: 'quizNoApiKey',
      error: wt('quizNoApiKey')
    };
  }

  // 2. Extract questions
  const questions = extractQuizQuestions();
  if (questions.length === 0) {
    return {
      success: false,
      key: 'quizNoQuestions',
      error: wt('quizNoQuestions')
    };
  }

  const provDisplayName = AI_PROVIDERS[activeProvider]?.name || activeProvider.toUpperCase();
  console.log(`[CourseraSkip] Sending ${questions.length} questions to ${provDisplayName}...`);

  // 3. Build prompt and call AI
  const prompt = buildGeminiPrompt(questions);
  let answersFromAI;
  try {
    answersFromAI = await callAiWithRetry(activeProvider, apiKey, prompt);
  } catch (e) {
    return { success: false, error: `${provDisplayName} API: ${e.message}` };
  }

  if (!answersFromAI || answersFromAI.length === 0) {
    return { success: false, error: `${provDisplayName} API: no answer returned.` };
  }

  // 4. Fill answers into DOM
  const { filled, submitHighlighted } = fillQuizAnswers(questions, answersFromAI);

  return {
    success: true,
    submitted: false, // never auto-submit
    key: 'quizSuccess',
    params: { filled },
    message: wt('quizSuccess', { filled }),
    filled,
    totalQuestions: questions.length,
  };
}

// =========================================================================
// ===== IN-PAGE FLOATING WIDGET (Giao diện cố định trên trang Coursera) =====
// =========================================================================

const AI_PROVIDERS = {
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    placeholder: 'AIzaSy...',
    labelVi: 'Gemini API Key',
    labelEn: 'Gemini API Key',
    hintVi: 'Lấy key miễn phí tại Google AI Studio (aistudio.google.com)',
    hintEn: 'Get a free key at Google AI Studio (aistudio.google.com)',
    url: 'https://aistudio.google.com',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT)',
    placeholder: 'sk-proj-... / sk-...',
    labelVi: 'OpenAI (GPT) API Key',
    labelEn: 'OpenAI (GPT) API Key',
    hintVi: 'Lấy key tại OpenAI Platform (platform.openai.com)',
    hintEn: 'Get your key at OpenAI Platform (platform.openai.com)',
    url: 'https://platform.openai.com/api-keys',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    placeholder: 'gsk_...',
    labelVi: 'Groq API Key',
    labelEn: 'Groq API Key',
    hintVi: 'Lấy key siêu tốc, miễn phí tại GroqCloud (console.groq.com)',
    hintEn: 'Get a free, ultra-fast key at GroqCloud (console.groq.com)',
    url: 'https://console.groq.com/keys',
  },
};

let currentWidgetProvider = 'gemini';
// =========================================================================
const STORE_REVIEW_URL = 'https://chromewebstore.google.com/detail/coursera-skip-video-read/jjbgneddmjkolgmpamecbhfgjgdiajlf/reviews';

const WIDGET_I18N = {
  vi: {
    langBadge: 'VI',
    bulkLabel: 'Thao tác hàng loạt',
    confirmTitle: 'Chạy trên toàn bộ khóa học?',
    confirmBulkVR: 'Thao tác này đánh dấu hoàn thành mọi video và bài đọc trong khóa học trên tài khoản Coursera của bạn. Không thể hoàn tác từ tiện ích.',
    confirmBulkDisc: 'Thao tác này đăng phản hồi thảo luận trên toàn khóa học bằng tài khoản của bạn. Không thể hoàn tác các phản hồi đã đăng từ tiện ích.',
    btnCancel: 'Hủy',
    btnContinue: 'Tiếp tục',
    detected: 'ĐÃ NHẬN DIỆN BÀI HỌC',
    courseOverview: 'Trang tổng quan khóa học',
    typeLabel: 'Loại bài',
    btnCurrent: 'Hoàn thành bài hiện tại',
    btnBulkVR: 'Hoàn thành toàn bộ Video & Reading',
    btnBulkDisc: 'Hoàn thành toàn bộ Discussion',
    btnPeer: 'Tự động chấm bài bạn học',
    btnQuiz: 'AI Làm Quiz Tự Động',
    processingCurrent: 'Đang xử lý...',
    processingReview: 'Đang tự động chấm bài...',
    processingDiscussion: 'Đang đăng câu trả lời...',
    processingBulk: 'Đang khởi động...',
    fetchingCurriculum: 'Đang tải danh sách bài học...',
    fetchingDiscussions: 'Đang tải danh sách bài thảo luận...',
    startingBulkVR: 'Bắt đầu xử lý {total} bài học...',
    startingBulkDisc: 'Bắt đầu xử lý {total} bài thảo luận...',
    processingBulkCount: 'Đang xử lý: {current} / {total}',
    completedBulk: 'Hoàn thành toàn bộ {total} bài học Video & Reading!',
    completedBulkDisc: 'Hoàn thành toàn bộ {total} bài thảo luận!',
    partialBulk: 'Đã xử lý: {success} thành công, {failed} thất bại.',
    partialBulkAlert: 'Một số bài chưa thể hoàn thành.',
    successCurrent: 'Đã hoàn thành bài học.',
    successLecture: 'Video đã hoàn thành.',
    successSupplement: 'Bài đọc đã hoàn thành.',
    successReview: 'Đã chấm xong bài bạn học.',
    successDiscussion: 'Đã đăng thảo luận thành công.',
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
    settingsTitle: 'Cài đặt AI (Gemini / GPT / Groq)',
    apiKeyLabel: 'API Key',
    apiKeySave: 'Lưu',
    apiKeySaved: 'Đã lưu API key thành công!',
    apiKeyPlaceholder: 'AIza...',
    apiKeyHint: 'Chọn nhà cung cấp và nhập API key tương ứng.',
    settingsClose: 'Đóng',
    apiKeyActive: 'Đã lưu key',
    apiKeyNone: 'Chưa có key',
    apiKeyEnterNew: 'Dán key mới để thay đổi...',
    apiKeyDefaultPlaceholder: 'Dán API Key...',
    apiKeyDelete: 'Xóa key',
    apiKeyDeleted: 'Đã xóa API key!',
    apiKeyEmptyErr: 'Vui lòng nhập API key.',
    apiKeyPromptPaste: 'Vui lòng dán key mới vào ô nhập để thay đổi.',
    apiKeyPaste: 'Dán',
    apiKeyPasted: 'Đã dán key từ Clipboard!',
    apiKeyPromptInput: 'Dán API Key của bạn vào đây:',
    notOnLesson: 'Vui lòng mở trang bài học Coursera trước.',
    notEnrolled: 'Không có quyền. Hãy chắc chắn bạn đã đăng ký khóa học.',
    notLoggedIn: 'Vui lòng đăng nhập Coursera trước.',
    noItemsFound: 'Không tìm thấy bài học phù hợp trong khóa học.',
    unknownError: 'Đã xảy ra lỗi. Kiểm tra Console (F12).',
    peerAlreadySelected: 'Các tiêu chí đã được chọn trước đó. Bạn có thể kiểm tra và bấm nộp.',
    peerFormNotFound: 'Không tìm thấy form chấm bài. Hãy chắc chắn form đã tải xong.',
    peerSuccess: 'Đã chọn tiêu chí và điền nhận xét! Hãy kiểm tra và bấm nộp bài.',
    discAlreadyAnswered: 'Bạn đã đăng câu trả lời cho bài thảo luận này từ trước rồi!',
    discReplySuccess: 'Đã đăng câu trả lời thảo luận thành công!',
    discReplyReady: 'Đã điền câu trả lời. Hãy kiểm tra và bấm Reply nhé.',
    quizNoApiKey: 'Chưa nhập API Key. Bấm Cài đặt AI để thêm key.',
    quizNoQuestions: 'Không tìm thấy câu hỏi quiz nào trên trang.',
    quizSuccess: 'AI đã điền {filled} câu hỏi. Hãy kiểm tra lại và bấm nộp bài.',
  },
  en: {
    langBadge: 'EN',
    bulkLabel: 'Bulk actions',
    confirmTitle: 'Run on the whole course?',
    confirmBulkVR: 'This marks every video and reading in this course as completed on your Coursera account. It cannot be undone from here.',
    confirmBulkDisc: 'This posts discussion replies across the whole course using your account. Posted replies cannot be undone from here.',
    btnCancel: 'Cancel',
    btnContinue: 'Continue',
    detected: 'LESSON DETECTED',
    courseOverview: 'Course Overview',
    typeLabel: 'Type',
    btnCurrent: 'Complete Current Lesson',
    btnBulkVR: 'Complete All Video & Reading',
    btnBulkDisc: 'Complete All Discussions',
    btnPeer: 'Auto Grade Peer Review',
    btnQuiz: 'AI Auto-Answer Quiz',
    processingCurrent: 'Completing...',
    processingReview: 'Grading peer review...',
    processingDiscussion: 'Posting discussion...',
    processingBulk: 'Starting...',
    fetchingCurriculum: 'Loading course lessons...',
    fetchingDiscussions: 'Loading discussions...',
    startingBulkVR: 'Processing {total} lessons...',
    startingBulkDisc: 'Processing {total} discussions...',
    processingBulkCount: 'Processing: {current} / {total}',
    completedBulk: 'Completed all {total} lessons!',
    completedBulkDisc: 'Completed all {total} discussions!',
    partialBulk: 'Processed: {success} succeeded, {failed} failed.',
    partialBulkAlert: 'Some lessons could not be completed.',
    successCurrent: 'Lesson completed successfully.',
    successLecture: 'Video completed successfully.',
    successSupplement: 'Reading completed successfully.',
    successReview: 'Peer review graded successfully.',
    successDiscussion: 'Discussion posted successfully.',
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
    settingsTitle: 'AI Settings (Gemini / GPT / Groq)',
    apiKeyLabel: 'API Key',
    apiKeySave: 'Save',
    apiKeySaved: 'API key saved successfully!',
    apiKeyPlaceholder: 'AIza...',
    apiKeyHint: 'Select provider and enter your API key.',
    settingsClose: 'Close',
    apiKeyActive: 'Key saved',
    apiKeyNone: 'No key saved',
    apiKeyEnterNew: 'Paste new key to replace...',
    apiKeyDefaultPlaceholder: 'Paste API Key...',
    apiKeyDelete: 'Delete key',
    apiKeyDeleted: 'API key deleted!',
    apiKeyEmptyErr: 'Please enter an API key.',
    apiKeyPromptPaste: 'Please paste a new key into the box to replace.',
    apiKeyPaste: 'Paste',
    apiKeyPasted: 'Key pasted from clipboard!',
    apiKeyPromptInput: 'Paste your API Key here:',
    notOnLesson: 'Please open a Coursera lesson page first.',
    notEnrolled: 'Permission denied. Make sure you are enrolled in the course.',
    notLoggedIn: 'Please sign in to Coursera first.',
    noItemsFound: 'No eligible lessons found in this course.',
    unknownError: 'An error occurred. Check Console (F12).',
    peerAlreadySelected: 'Grading criteria already selected. Review and submit.',
    peerFormNotFound: 'Review form not found. Make sure review form is loaded.',
    peerSuccess: 'Grading criteria and feedback filled. Please review and submit.',
    discAlreadyAnswered: 'You have already answered this discussion prompt.',
    discReplySuccess: 'Discussion reply posted successfully!',
    discReplyReady: 'Discussion answer filled. Please review and click Reply.',
    quizNoApiKey: 'API key not configured. Open AI Settings to enter your key.',
    quizNoQuestions: 'No quiz questions found on this page.',
    quizSuccess: 'AI answered {filled} questions. Please review and submit.',
  }
};

let widgetShadow = null;
let currentWidgetLang = localStorage.getItem('coursera_skip_lang') || (navigator.language?.startsWith('vi') ? 'vi' : 'en');
let isWidgetProcessing = false;

// Sync language from chrome.storage.local across extension & widget
try {
  chrome.storage.local.get('coursera_skip_lang', (res) => {
    if (res && res.coursera_skip_lang) {
      currentWidgetLang = res.coursera_skip_lang;
      localStorage.setItem('coursera_skip_lang', currentWidgetLang);
      if (typeof updateWidgetLanguageUI === 'function') {
        updateWidgetLanguageUI();
      }
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.coursera_skip_lang) {
      currentWidgetLang = changes.coursera_skip_lang.newValue;
      localStorage.setItem('coursera_skip_lang', currentWidgetLang);
      if (typeof updateWidgetLanguageUI === 'function') {
        updateWidgetLanguageUI();
      }
    }
  });
} catch (_) {}

function wt(key, params = {}) {
  const dict = WIDGET_I18N[currentWidgetLang] || WIDGET_I18N.vi;
  let text = dict[key] || WIDGET_I18N.vi[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
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
    msgEl.textContent = (data.key && wt(data.key, data.params)) || data.message || wt('processingBulkCount', { current, total });
  } else if (data.status === 'completed') {
    wrap.style.display = 'block';
    fillEl.style.width = '100%';
    pctEl.textContent = '100%';
    msgEl.textContent = (data.key && wt(data.key, data.params)) || data.message || wt('completedBulk', { total: data.total || 1 });
    isWidgetProcessing = false;
    if (vrBtn) { vrBtn.disabled = false; vrBtn.classList.remove('loading'); }
    if (discBtn) { discBtn.disabled = false; discBtn.classList.remove('loading'); }
    if (currentBtn) { currentBtn.disabled = false; currentBtn.classList.remove('loading'); }

    const total = data.total || 1;
    try {
      chrome.storage.local.get('coursera_completed_count').then((res) => {
        const newCount = (res?.coursera_completed_count || 0) + (parseInt(total, 10) || 1);
        chrome.storage.local.set({ coursera_completed_count: newCount });
      });
    } catch (_) {}

    isRatingDismissedOrRatedWidget().then((isRated) => {
      if (!isRated) {
        showCelebrationPromptWidget({ totalLessons: parseInt(total, 10) || 1, isBulk: true });
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 1800);
      }
    });
  } else if (data.status === 'partial') {
    wrap.style.display = 'block';
    fillEl.style.width = '100%';
    pctEl.textContent = '100%';
    msgEl.textContent = (data.key && wt(data.key, data.params)) || data.message || wt('partialBulk', data.params || {});
    isWidgetProcessing = false;
    if (vrBtn) { vrBtn.disabled = false; vrBtn.classList.remove('loading'); }
    if (discBtn) { discBtn.disabled = false; discBtn.classList.remove('loading'); }
    if (currentBtn) { currentBtn.disabled = false; currentBtn.classList.remove('loading'); }
    showWidgetAlert('warning', (data.key && wt(data.key, data.params)) || data.message || wt('partialBulkAlert'));
  } else if (data.status === 'error') {
    wrap.style.display = 'none';
    isWidgetProcessing = false;
    if (vrBtn) { vrBtn.disabled = false; vrBtn.classList.remove('loading'); }
    if (discBtn) { discBtn.disabled = false; discBtn.classList.remove('loading'); }
    if (currentBtn) { currentBtn.disabled = false; currentBtn.classList.remove('loading'); }
    showWidgetAlert('error', (data.key && wt(data.key, data.params)) || data.message || wt('unknownError'));
  }
}

async function isRatingDismissedOrRatedWidget() {
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
    console.warn('[Widget] Storage check failed:', e);
  }
  return false;
}

async function markAsRatedWidget() {
  localStorage.setItem('coursera_has_rated', 'true');
  try {
    await chrome.storage.local.set({ coursera_has_rated: true });
  } catch (e) {
    console.warn('[Widget] Storage save failed:', e);
  }
}

async function handleWidgetAlreadyRated() {
  await markAsRatedWidget();
  if (!widgetShadow) return;
  const msgEl = widgetShadow.getElementById('cs-rating-msg');
  if (msgEl) msgEl.textContent = wt('ratingThankYou');
  const rateBtn = widgetShadow.getElementById('cs-btn-rate-store');
  if (rateBtn) rateBtn.style.display = 'none';
  const secActions = widgetShadow.querySelector('.cs-rating-secondary-actions');
  if (secActions) secActions.style.display = 'none';
  setTimeout(() => {
    const toast = widgetShadow.getElementById('cs-rating-toast');
    if (toast) toast.style.display = 'none';
  }, 1400);
}

async function handleWidgetCloseRating() {
  if (!widgetShadow) return;
  const toast = widgetShadow.getElementById('cs-rating-toast');
  if (toast) toast.style.display = 'none';
  const remindUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
  try {
    await chrome.storage.local.set({ coursera_remind_until: remindUntil });
  } catch (e) {}
}

async function handleWidgetReloadCoursera() {
  window.location.reload();
}

async function openWidgetReviewPage() {
  await markAsRatedWidget();
  if (widgetShadow) {
    const toast = widgetShadow.getElementById('cs-rating-toast');
    if (toast) toast.style.display = 'none';
  }
  window.open(STORE_REVIEW_URL, '_blank');
}

async function recordSingleLessonCompletedWidget() {
  try {
    const data = await chrome.storage.local.get('coursera_completed_count');
    const newCount = (data.coursera_completed_count || 0) + 1;
    await chrome.storage.local.set({ coursera_completed_count: newCount });
    const isDismissed = await isRatingDismissedOrRatedWidget();
    if (!isDismissed && (newCount === 5 || newCount === 25 || newCount === 50)) {
      showCelebrationPromptWidget({ totalLessons: newCount, isMilestone: true });
      return true;
    }
  } catch (e) {}
  return false;
}

async function showCelebrationPromptWidget(opts = {}) {
  const isDismissed = await isRatingDismissedOrRatedWidget();
  if (isDismissed) return;
  if (!widgetShadow) return;

  const toast = widgetShadow.getElementById('cs-rating-toast');
  if (!toast) return;

  const labelEl = widgetShadow.getElementById('cs-rating-label');
  const msgEl = widgetShadow.getElementById('cs-rating-msg');
  const reloadBtn = widgetShadow.getElementById('cs-btn-reload-coursera');
  const rateBtn = widgetShadow.getElementById('cs-btn-rate-store');
  const secActions = widgetShadow.querySelector('.cs-rating-secondary-actions');

  if (rateBtn) rateBtn.style.display = 'flex';
  if (secActions) secActions.style.display = 'flex';

  if (opts.isBulk) {
    const total = opts.totalLessons || 1;
    const mins = Math.max(15, total * 5);
    if (labelEl) labelEl.textContent = wt('ratingLabelBulk', { total });
    if (msgEl) msgEl.textContent = wt('rateToastMsgBulk', { mins });
    if (reloadBtn) reloadBtn.style.display = 'inline-flex';
  } else if (opts.isMilestone) {
    const total = opts.totalLessons || 5;
    if (labelEl) labelEl.textContent = wt('ratingLabelMilestone', { total });
    if (msgEl) msgEl.textContent = wt('rateToastMsgMilestone', { total });
    if (reloadBtn) reloadBtn.style.display = 'inline-flex';
  } else {
    if (labelEl) labelEl.textContent = wt('ratingLabel');
    if (msgEl) msgEl.textContent = wt('rateToastMsg');
    if (reloadBtn) reloadBtn.style.display = 'inline-flex';
  }

  toast.style.display = 'flex';
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
  const quizBtn = widgetShadow.getElementById('cs-btn-quiz');

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
    course: { en: 'Course Overview', vi: 'Trang khóa học' },
    lecture: { en: 'Video Lecture', vi: 'Bài giảng Video' },
    supplement: { en: 'Reading Material', vi: 'Tài liệu Đọc' },
    quiz: { en: 'Quiz Assessment', vi: 'Bài kiểm tra (Quiz)' },
    gradedQuiz: { en: 'Graded Quiz (AI)', vi: 'Graded Quiz (AI)' },
    programming: { en: 'Programming Lab', vi: 'Bài tập Thực hành' },
    peer: { en: 'Peer Review', vi: 'Bài tập Chấm chéo' },
    discussionPrompt: { en: 'Discussion Prompt', vi: 'Câu hỏi thảo luận' },
    dialogue: { en: 'Dialogue', vi: 'Hội thoại (Dialogue)' },
  };

  const currentType = ctx.itemType || 'course';
  const cfg = typeConfigMap[currentType] || { en: currentType, vi: currentType };

  if (typeIconEl) typeIconEl.style.display = 'none';
  if (typeTextEl) typeTextEl.textContent = currentWidgetLang === 'vi' ? cfg.vi : cfg.en;

  // Toggle buttons based on item type
  if (currentType === 'peer') {
    if (peerBtn) peerBtn.style.display = 'flex';
    if (currentBtn) currentBtn.style.display = 'none';
    if (quizBtn) quizBtn.style.display = 'none';
  } else if (currentType === 'gradedQuiz') {
    if (quizBtn) quizBtn.style.display = 'flex';
    if (currentBtn) currentBtn.style.display = 'none';
    if (peerBtn) peerBtn.style.display = 'none';
  } else {
    if (peerBtn) peerBtn.style.display = 'none';
    if (quizBtn) quizBtn.style.display = 'none';
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
  const txtQuiz = widgetShadow.getElementById('cs-txt-quiz');
  const settingsTitle = widgetShadow.getElementById('cs-settings-title');
  const apiKeyLabel = widgetShadow.getElementById('cs-api-key-label');
  const apiKeyHint = widgetShadow.getElementById('cs-api-key-hint');
  const saveKeyBtnEl = widgetShadow.getElementById('cs-save-key-btn');

  const deleteKeyTxt = widgetShadow.getElementById('cs-delete-key-txt');
  if (deleteKeyTxt) deleteKeyTxt.textContent = wt('apiKeyDelete');

  const pasteKeyTxt = widgetShadow.getElementById('cs-paste-key-txt');
  if (pasteKeyTxt) pasteKeyTxt.textContent = wt('apiKeyPaste');

  if (langBtn) langBtn.textContent = wt('langBadge');
  if (statusLabel) statusLabel.textContent = wt('detected');
  if (metaLabel) metaLabel.textContent = wt('typeLabel');
  if (txtCurrent) txtCurrent.textContent = wt('btnCurrent');
  if (txtBulkVR) txtBulkVR.textContent = wt('btnBulkVR');
  if (txtBulkDisc) txtBulkDisc.textContent = wt('btnBulkDisc');
  if (txtPeer) txtPeer.textContent = wt('btnPeer');
  if (txtQuiz) txtQuiz.textContent = wt('btnQuiz');
  const setTxt = (id, key) => { const el = widgetShadow.getElementById(id); if (el) el.textContent = wt(key); };
  setTxt('cs-txt-bulk-label', 'bulkLabel');
  setTxt('cs-txt-confirm-title', 'confirmTitle');
  setTxt('cs-txt-confirm-cancel', 'btnCancel');
  setTxt('cs-txt-confirm-ok', 'btnContinue');
  if (settingsTitle) settingsTitle.textContent = wt('settingsTitle');
  if (apiKeyLabel) apiKeyLabel.textContent = wt('apiKeyLabel');
  if (apiKeyHint) apiKeyHint.textContent = wt('apiKeyHint');
  if (saveKeyBtnEl) saveKeyBtnEl.textContent = wt('apiKeySave');

  const ratingLabelEl = widgetShadow.getElementById('cs-rating-label');
  const ratingMsgEl = widgetShadow.getElementById('cs-rating-msg');
  const rateBtnEl = widgetShadow.getElementById('cs-txt-btn-rate-store');
  const alreadyRatedEl = widgetShadow.getElementById('cs-txt-btn-already-rated');
  const reloadCourseraEl = widgetShadow.getElementById('cs-txt-btn-reload-coursera');

  if (ratingLabelEl) ratingLabelEl.textContent = wt('ratingLabel');
  if (ratingMsgEl) ratingMsgEl.textContent = wt('rateToastMsg');
  if (rateBtnEl) rateBtnEl.textContent = wt('btnRate');
  if (alreadyRatedEl) alreadyRatedEl.textContent = wt('btnAlreadyRated');
  if (reloadCourseraEl) reloadCourseraEl.textContent = wt('btnReloadCoursera');

  refreshWidgetApiKeyUI();
  updateWidgetContext();
}

function refreshWidgetApiKeyUI() {
  const targetShadow = (typeof window !== 'undefined' && window.widgetShadow) || widgetShadow;
  if (!targetShadow) return;
  const apiKeyInput = targetShadow.getElementById('cs-api-key-input');
  const deleteKeyBtn = targetShadow.getElementById('cs-delete-key-btn');
  const keyStatusBadge = targetShadow.getElementById('cs-key-status-badge');
  const keyMaskPreview = targetShadow.getElementById('cs-key-mask-preview');
  const apiKeyLabel = targetShadow.getElementById('cs-api-key-label');
  const apiKeyHint = targetShadow.getElementById('cs-api-key-hint');
  const settingsTitle = targetShadow.getElementById('cs-settings-title');
  const tabs = targetShadow.querySelectorAll ? targetShadow.querySelectorAll('.cs-provider-tab') : [];

  function applyConfig(cfg) {
    const activeProvider = cfg?.provider || 'gemini';
    const keys = cfg?.keys || {};

    if (!currentWidgetProvider) {
      currentWidgetProvider = activeProvider;
    }

    if (tabs && tabs.forEach) {
      tabs.forEach((tab) => {
        if (tab.dataset && tab.dataset.provider === currentWidgetProvider) {
          tab.className = 'cs-provider-tab active';
        } else if (tab.classList) {
          tab.className = 'cs-provider-tab';
        }
      });
    }

    const provInfo = AI_PROVIDERS[currentWidgetProvider] || AI_PROVIDERS.gemini;
    const key = keys[currentWidgetProvider] || (currentWidgetProvider === 'gemini' ? (cfg?.apiKey || null) : null);

    if (settingsTitle) {
      settingsTitle.textContent = wt('settingsTitle');
    }
    if (apiKeyLabel) {
      apiKeyLabel.textContent = currentWidgetLang === 'vi' ? provInfo.labelVi : provInfo.labelEn;
    }
    if (apiKeyHint) {
      apiKeyHint.textContent = currentWidgetLang === 'vi' ? provInfo.hintVi : provInfo.hintEn;
    }

    if (key && key.trim()) {
      const masked = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '••••••••';
      if (keyStatusBadge) {
        keyStatusBadge.textContent = `● ${wt('apiKeyActive')}`;
        keyStatusBadge.className = 'cs-key-status-badge active';
      }
      if (keyMaskPreview) {
        keyMaskPreview.textContent = `(${masked})`;
        keyMaskPreview.title = `Active key: ${masked}`;
      }
      if (apiKeyInput) {
        apiKeyInput.placeholder = wt('apiKeyEnterNew');
      }
      if (deleteKeyBtn) {
        deleteKeyBtn.style.display = 'inline-flex';
      }
    } else {
      if (keyStatusBadge) {
        keyStatusBadge.textContent = `○ ${wt('apiKeyNone')}`;
        keyStatusBadge.className = 'cs-key-status-badge empty';
      }
      if (keyMaskPreview) {
        keyMaskPreview.textContent = '';
      }
      if (apiKeyInput) {
        apiKeyInput.placeholder = `${provInfo.placeholder}`;
      }
      if (deleteKeyBtn) {
        deleteKeyBtn.style.display = 'none';
      }
    }
  }

  let called = false;
  try {
    chrome.runtime.sendMessage({ action: 'getAiConfig' }, (res) => {
      called = true;
      if (res && res.keys) {
        applyConfig(res);
      } else {
        // Fallback for mock in test environment
        chrome.runtime.sendMessage({ action: 'getGeminiApiKey' }, (geminiRes) => {
          applyConfig({
            provider: 'gemini',
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
          applyConfig({
            provider: 'gemini',
            keys: { gemini: geminiRes?.apiKey || null },
            apiKey: geminiRes?.apiKey || null,
          });
        }
      });
    } catch (_) {}
  }
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
      user-select: auto;
      line-height: 1.4;
    }

    /* Floating Badge (Collapsed FAB) */
    .cs-badge {
      display: none;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      user-select: none;
      -webkit-user-select: none;
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
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    }
    .cs-badge-icon svg {
      width: 22px;
      height: 22px;
      fill: #ffffff;
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
      user-select: none;
      -webkit-user-select: none;
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
      user-select: none;
      -webkit-user-select: none;
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
      box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
      flex-shrink: 0;
    }
    .cs-logo svg {
      width: 14px;
      height: 14px;
      fill: #ffffff;
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
      transition: all 0.2s;
    }
    .cs-icon-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .cs-icon-btn svg {
      display: block;
      width: 13px;
      height: 13px;
      stroke: currentColor;
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

    .cs-btn-bulk {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #f1f5f9;
    }
    .cs-btn-bulk .cs-btn-icon { color: var(--bulk-accent, #94a3b8); }
    .cs-btn-bulk:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.09);
      border-color: var(--bulk-accent, rgba(255, 255, 255, 0.2));
    }
    .cs-btn-bulk-vr { --bulk-accent: #10b981; }
    .cs-btn-bulk-disc { --bulk-accent: #38bdf8; }
    .cs-bulk-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 4px;
    }
    .cs-confirm {
      display: none;
      flex-direction: column;
      gap: 8px;
      background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 10px;
      padding: 10px 12px;
      animation: csFadeIn 0.2s ease;
    }
    .cs-confirm-title { font-size: 12px; font-weight: 700; color: #fbbf24; }
    .cs-confirm-msg { font-size: 12px; color: #cbd5e1; line-height: 1.4; }
    .cs-confirm-actions { display: flex; gap: 8px; }
    .cs-btn-outline {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #f1f5f9;
    }
    .cs-btn-outline:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1); }
    .cs-btn-confirm { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #111827; }
    button:focus-visible {
      outline: 2px solid #a5b4fc;
      outline-offset: 2px;
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

    .cs-btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .cs-btn-icon svg {
      display: block;
      width: 13px;
      height: 13px;
      stroke: currentColor;
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

    /* Quiz AI Button */
    .cs-btn-quiz {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
    }
    .cs-btn-quiz:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.5);
    }

    /* Celebration & Rating Toast */
    .cs-rating-toast {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(234, 179, 8, 0.3);
      border-radius: 10px;
      padding: 10px 12px;
      animation: csFadeIn 0.25s ease;
      display: flex;
      flex-direction: column;
      gap: 7px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      margin-top: 6px;
    }
    .cs-rating-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .cs-rating-label {
      font-size: 11px;
      font-weight: 700;
      color: #fde047;
      letter-spacing: 0.02em;
    }
    .cs-close-rating-btn {
      background: transparent;
      border: none;
      color: #64748b;
      cursor: pointer;
      font-size: 12px;
      padding: 2px 4px;
      line-height: 1;
      border-radius: 4px;
      transition: color 0.15s;
    }
    .cs-close-rating-btn:hover {
      color: #f1f5f9;
    }
    .cs-rating-msg {
      font-size: 10.5px;
      color: #94a3b8;
      line-height: 1.4;
    }
    .cs-btn-rate-store {
      background: #facc15;
      color: #0f172a;
      font-weight: 700;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      border: none;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    .cs-btn-rate-store:hover {
      background: #fde047;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(250, 204, 21, 0.35);
    }
    .cs-rating-secondary-actions {
      display: flex;
      gap: 6px;
      margin-top: 2px;
    }
    .cs-btn-subtle {
      flex: 1;
      padding: 5px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 500;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.03);
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cs-btn-subtle:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #f1f5f9;
      border-color: rgba(255, 255, 255, 0.16);
    }
    .cs-btn-subtle.cs-btn-already-rated:hover {
      border-color: rgba(34, 197, 94, 0.4);
      color: #86efac;
    }
    .cs-btn-subtle.cs-btn-reload-action {
      border-color: rgba(59, 130, 246, 0.25);
      color: #93c5fd;
    }
    .cs-btn-subtle.cs-btn-reload-action:hover {
      border-color: rgba(59, 130, 246, 0.5);
      color: #bfdbfe;
    }

    /* Settings Panel */
    .cs-settings {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 9px;
      animation: csFadeIn 0.2s ease;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }
    .cs-settings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .cs-settings-title {
      font-size: 11px;
      font-weight: 700;
      color: #a5b4fc;
      letter-spacing: 0.03em;
    }
    .cs-provider-tabs {
      display: flex;
      gap: 4px;
      background: rgba(30, 41, 59, 0.7);
      padding: 3px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .cs-provider-tab {
      flex: 1;
      padding: 5px 4px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      color: #94a3b8;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .cs-provider-tab:hover {
      color: #f1f5f9;
      background: rgba(255, 255, 255, 0.05);
    }
    .cs-provider-tab.active {
      background: rgba(99, 102, 241, 0.25);
      border-color: rgba(99, 102, 241, 0.5);
      color: #fff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }
    .cs-key-status-badge {
      font-size: 10px;
      padding: 2px 7px;
      border-radius: 10px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .cs-key-status-badge.active {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .cs-key-status-badge.empty {
      background: rgba(239, 68, 68, 0.12);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.25);
    }
    .cs-input-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .cs-input-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cs-input-label {
      font-size: 10px;
      font-weight: 600;
      color: #94a3b8;
    }
    .cs-key-mask-preview {
      font-size: 10px;
      color: #38bdf8;
      font-family: monospace;
      font-weight: 600;
    }
    .cs-input-row {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .cs-input-wrapper {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
      min-width: 0;
    }
    .cs-api-key-input {
      width: 100%;
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      padding: 6px 44px 6px 8px;
      font-size: 11px;
      color: #f1f5f9;
      font-family: monospace;
      outline: none;
      transition: all 0.2s;
      min-width: 0;
      user-select: text !important;
      -webkit-user-select: text !important;
      cursor: text !important;
      caret-color: #38bdf8 !important;
      pointer-events: auto !important;
    }
    .cs-paste-key-btn {
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 6px;
      padding: 6px 9px;
      font-size: 11px;
      font-weight: 600;
      color: #38bdf8;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .cs-paste-key-btn:hover {
      background: rgba(56, 189, 248, 0.25);
      color: #fff;
      border-color: rgba(56, 189, 248, 0.6);
      transform: translateY(-1px);
    }
    .cs-api-key-input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
    }
    .cs-api-key-input::placeholder {
      color: #64748b;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .cs-toggle-eye-btn, .cs-clear-input-btn {
      position: absolute;
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 2px 4px;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }
    .cs-toggle-eye-btn {
      right: 5px;
    }
    .cs-clear-input-btn {
      right: 23px;
    }
    .cs-toggle-eye-btn:hover, .cs-clear-input-btn:hover {
      color: #fff;
    }
    .cs-save-key-btn {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
    }
    .cs-save-key-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(99, 102, 241, 0.45);
    }
    .cs-settings-actions-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }
    .cs-btn-danger-outline {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
    }
    .cs-btn-danger-outline:hover {
      background: rgba(239, 68, 68, 0.2);
      border-color: rgba(239, 68, 68, 0.5);
      color: #fff;
    }
    .cs-settings-hint {
      font-size: 10px;
      color: #475569;
      line-height: 1.4;
      margin: 0;
    }
  `;

  const container = document.createElement('div');
  container.className = 'cs-widget-root';
  container.innerHTML = `
    <!-- Floating Badge -->
    <div class="cs-badge" id="cs-badge" title="Coursera Skip Tool">
      <div class="cs-badge-icon">
        <svg viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
      </div>
      <span class="cs-badge-pulse"></span>
    </div>

    <!-- Main Panel -->
    <div class="cs-panel" id="cs-panel">
      <!-- Header -->
      <div class="cs-header" id="cs-header">
        <div class="cs-brand">
          <div class="cs-logo">
            <svg viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
          </div>
          <span class="cs-title">Coursera Skip</span>
        </div>
        <div class="cs-header-actions">
          <button class="cs-pill-btn" id="cs-lang-btn" title="Switch Language" aria-label="Switch language">VI</button>
          <button class="cs-icon-btn" id="cs-settings-btn" title="AI Settings" aria-label="AI Settings">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button class="cs-icon-btn" id="cs-min-btn" title="Thu nhỏ" aria-label="Minimize">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
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
              <span id="cs-type-text">--</span>
            </span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="cs-actions">
          <button class="cs-btn cs-btn-primary" id="cs-btn-current">
            <span class="cs-btn-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <div class="cs-spinner"></div>
            <span class="cs-btn-text" id="cs-txt-current">Hoàn thành bài hiện tại</span>
          </button>

          <button class="cs-btn cs-btn-quiz" id="cs-btn-quiz" style="display: none;">
            <span class="cs-btn-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM4 11a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7zm5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>
            </span>
            <div class="cs-spinner"></div>
            <span class="cs-btn-text" id="cs-txt-quiz">AI Làm Quiz Tự Động</span>
          </button>

          <button class="cs-btn cs-btn-peer" id="cs-btn-peer" style="display: none;">
            <span class="cs-btn-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            <div class="cs-spinner"></div>
            <span class="cs-btn-text" id="cs-txt-peer">Tự động chấm bài bạn học</span>
          </button>

          <div class="cs-bulk-label" id="cs-txt-bulk-label">Thao tác hàng loạt</div>

          <button class="cs-btn cs-btn-bulk cs-btn-bulk-vr" id="cs-btn-bulk-vr">
            <span class="cs-btn-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
            </span>
            <div class="cs-spinner"></div>
            <span class="cs-btn-text" id="cs-txt-bulk-vr">Hoàn thành toàn bộ Video & Reading</span>
          </button>

          <button class="cs-btn cs-btn-bulk cs-btn-bulk-disc" id="cs-btn-bulk-disc">
            <span class="cs-btn-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            <div class="cs-spinner"></div>
            <span class="cs-btn-text" id="cs-txt-bulk-disc">Hoàn thành toàn bộ Discussion</span>
          </button>

          <div class="cs-confirm" id="cs-bulk-confirm" role="alertdialog" aria-labelledby="cs-txt-confirm-title" aria-describedby="cs-confirm-msg">
            <div class="cs-confirm-title" id="cs-txt-confirm-title">Chạy trên toàn bộ khóa học?</div>
            <div class="cs-confirm-msg" id="cs-confirm-msg"></div>
            <div class="cs-confirm-actions">
              <button class="cs-btn cs-btn-outline" id="cs-btn-confirm-cancel" type="button"><span id="cs-txt-confirm-cancel">Hủy</span></button>
              <button class="cs-btn cs-btn-confirm" id="cs-btn-confirm-ok" type="button"><span id="cs-txt-confirm-ok">Tiếp tục</span></button>
            </div>
          </div>

        </div>

        <!-- Settings Panel (hidden by default) -->
        <div class="cs-settings" id="cs-settings" style="display: none;">
          <div class="cs-settings-header">
            <span class="cs-settings-title" id="cs-settings-title">Cài đặt AI (Gemini / GPT / Groq)</span>
            <span class="cs-key-status-badge empty" id="cs-key-status-badge">○ Chưa có key</span>
          </div>

          <!-- Provider Tabs -->
          <div class="cs-provider-tabs" id="cs-provider-tabs">
            <button type="button" class="cs-provider-tab active" data-provider="gemini">Gemini</button>
            <button type="button" class="cs-provider-tab" data-provider="openai">OpenAI</button>
            <button type="button" class="cs-provider-tab" data-provider="groq">Groq</button>
          </div>

          <div class="cs-input-group">
            <div class="cs-input-label-row">
              <label class="cs-input-label" id="cs-api-key-label">Gemini API Key</label>
              <span class="cs-key-mask-preview" id="cs-key-mask-preview"></span>
            </div>
            <div class="cs-input-row">
              <div class="cs-input-wrapper">
                <input type="password" class="cs-api-key-input" id="cs-api-key-input" placeholder="AIza..." autocomplete="off" spellcheck="false" />
                <button type="button" class="cs-clear-input-btn" id="cs-clear-input-btn" title="Xóa ô nhập" style="display: none;">✕</button>
                <button type="button" class="cs-toggle-eye-btn" id="cs-toggle-eye-btn" title="Hiện/Ẩn key">👁️</button>
              </div>
              <button type="button" class="cs-paste-key-btn" id="cs-paste-key-btn" title="Dán key từ bộ nhớ tạm"><span id="cs-paste-key-txt">Dán</span></button>
              <button type="button" class="cs-save-key-btn" id="cs-save-key-btn">Lưu</button>
            </div>
          </div>
          <div class="cs-settings-actions-row">
            <button type="button" class="cs-btn-danger-outline" id="cs-delete-key-btn" style="display: none;">
              <span id="cs-delete-key-txt">Xóa key</span>
            </button>
          </div>
          <p class="cs-settings-hint" id="cs-api-key-hint">Lấy key miễn phí tại Google AI Studio (aistudio.google.com)</p>
          <p style="margin-top: 4px; font-size: 10px; color: #64748b; line-height: 1.3; text-align: center;">Key lưu cục bộ trên máy. Độc lập, không liên kết với Coursera Inc.</p>
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

        <!-- Smart Celebration & Rating Prompt -->
        <div class="cs-rating-toast" id="cs-rating-toast" style="display: none;">
          <div class="cs-rating-top">
            <span class="cs-rating-label" id="cs-rating-label">Lesson Completed</span>
            <button class="cs-close-rating-btn" id="cs-close-rating-btn" title="Close">✕</button>
          </div>
          <div class="cs-rating-msg" id="cs-rating-msg">Saved your time? Consider leaving a review on Chrome Web Store.</div>
          <button class="cs-btn-rate-store" id="cs-btn-rate-store" type="button">
            <span id="cs-txt-btn-rate-store">Rate on Store</span>
          </button>
          <div class="cs-rating-secondary-actions">
            <button class="cs-btn-subtle cs-btn-already-rated" id="cs-btn-already-rated" type="button">
              <span id="cs-txt-btn-already-rated">Already Rated</span>
            </button>
            <button class="cs-btn-subtle cs-btn-reload-action" id="cs-btn-reload-coursera" type="button" style="display: none;">
              <span id="cs-txt-btn-reload-coursera">Reload Page</span>
            </button>
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
  const settingsBtn = widgetShadow.getElementById('cs-settings-btn');
  const headerEl = widgetShadow.getElementById('cs-header');

  const btnCurrent = widgetShadow.getElementById('cs-btn-current');
  const btnQuiz = widgetShadow.getElementById('cs-btn-quiz');
  const btnBulkVR = widgetShadow.getElementById('cs-btn-bulk-vr');
  const btnBulkDisc = widgetShadow.getElementById('cs-btn-bulk-disc');
  const btnPeer = widgetShadow.getElementById('cs-btn-peer');

  const settingsPanel = widgetShadow.getElementById('cs-settings');
  const apiKeyInput = widgetShadow.getElementById('cs-api-key-input');
  const saveKeyBtn = widgetShadow.getElementById('cs-save-key-btn');
  const pasteKeyBtn = widgetShadow.getElementById('cs-paste-key-btn');
  const deleteKeyBtn = widgetShadow.getElementById('cs-delete-key-btn');
  const toggleEyeBtn = widgetShadow.getElementById('cs-toggle-eye-btn');
  const clearInputBtn = widgetShadow.getElementById('cs-clear-input-btn');

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

  // Initial load API key state
  refreshWidgetApiKeyUI();

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
    try {
      chrome.storage.local.set({ coursera_skip_lang: currentWidgetLang });
    } catch (_) {}
    updateWidgetLanguageUI();
  });

  // Settings panel toggle
  if (settingsBtn && settingsPanel) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = settingsPanel.style.display !== 'none';
      if (isVisible) {
        settingsPanel.style.display = 'none';
      } else {
        settingsPanel.style.display = 'flex';
        refreshWidgetApiKeyUI();
        if (apiKeyInput) {
          apiKeyInput.value = '';
          if (clearInputBtn) clearInputBtn.style.display = 'none';
          setTimeout(() => apiKeyInput.focus(), 80);
        }
      }
    });
  }

  // Keyboard shortcut protection, click/focus trap prevention & Enter to submit
  if (apiKeyInput) {
    apiKeyInput.addEventListener('mousedown', (e) => e.stopPropagation());
    apiKeyInput.addEventListener('pointerdown', (e) => e.stopPropagation());
    apiKeyInput.addEventListener('click', (e) => {
      e.stopPropagation();
      apiKeyInput.focus();
    });
    apiKeyInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveApiKey();
      }
    });
    apiKeyInput.addEventListener('keyup', (e) => e.stopPropagation());
    apiKeyInput.addEventListener('keypress', (e) => e.stopPropagation());
    apiKeyInput.addEventListener('input', () => {
      if (clearInputBtn) {
        clearInputBtn.style.display = apiKeyInput.value.length > 0 ? 'flex' : 'none';
      }
    });
  }

  // Paste API key button (clipboard readText with prompt fallback)
  if (pasteKeyBtn && apiKeyInput) {
    pasteKeyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      let pastedText = '';
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          pastedText = await navigator.clipboard.readText();
        }
      } catch (_) {}

      if (!pastedText || !pastedText.trim()) {
        const provName = AI_PROVIDERS[currentWidgetProvider]?.name || 'AI';
        pastedText = window.prompt(wt('apiKeyPromptInput') || `${provName} API Key:`, '') || '';
      }

      pastedText = pastedText.trim();
      if (pastedText) {
        apiKeyInput.value = pastedText;
        if (clearInputBtn) clearInputBtn.style.display = 'flex';
        showWidgetAlert('success', wt('apiKeyPasted'));
        apiKeyInput.focus();
      }
    });
  }

  // Provider tabs switching
  const providerTabs = widgetShadow.querySelectorAll('.cs-provider-tab');
  providerTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = tab.dataset.provider;
      if (p && p !== currentWidgetProvider) {
        currentWidgetProvider = p;
        chrome.runtime.sendMessage({ action: 'setAiProvider', provider: p });
        if (apiKeyInput) {
          apiKeyInput.value = '';
          if (clearInputBtn) clearInputBtn.style.display = 'none';
        }
        refreshWidgetApiKeyUI();
      }
    });
  });

  // Clear input button
  if (clearInputBtn && apiKeyInput) {
    clearInputBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      apiKeyInput.value = '';
      clearInputBtn.style.display = 'none';
      apiKeyInput.focus();
    });
  }

  // Toggle eye visibility
  if (toggleEyeBtn && apiKeyInput) {
    toggleEyeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleEyeBtn.textContent = '🙈';
      } else {
        apiKeyInput.type = 'password';
        toggleEyeBtn.textContent = '👁️';
      }
    });
  }

  // Delete saved API key
  if (deleteKeyBtn) {
    deleteKeyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const provider = currentWidgetProvider || 'gemini';
      const provName = AI_PROVIDERS[provider]?.name || provider;
      chrome.runtime.sendMessage({ action: 'removeAiKey', provider }, (res) => {
        if (apiKeyInput) apiKeyInput.value = '';
        if (clearInputBtn) clearInputBtn.style.display = 'none';
        showWidgetAlert('warning', `${wt('apiKeyDeleted')} (${provName})`);
        refreshWidgetApiKeyUI();
      });
    });
  }

  // Save API key handler
  function handleSaveApiKey() {
    if (!apiKeyInput) return;
    const key = apiKeyInput.value.trim();
    const provider = currentWidgetProvider || 'gemini';
    const provName = AI_PROVIDERS[provider]?.name || provider;

    if (!key) {
      chrome.runtime.sendMessage({ action: 'getAiConfig' }, (res) => {
        const existingKey = res?.keys?.[provider];
        if (existingKey) {
          showWidgetAlert('warning', wt('apiKeyPromptPaste'));
        } else {
          showWidgetAlert('error', wt('apiKeyEmptyErr'));
        }
      });
      return;
    }

    chrome.runtime.sendMessage({ action: 'setAiKey', provider, key }, (res) => {
      if (res && res.ok) {
        apiKeyInput.value = '';
        if (clearInputBtn) clearInputBtn.style.display = 'none';
        showWidgetAlert('success', `${wt('apiKeySaved')} (${provName})`);
        refreshWidgetApiKeyUI();
      } else {
        showWidgetAlert('error', wt('unknownError'));
      }
    });
  }

  if (saveKeyBtn) {
    saveKeyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSaveApiKey();
    });
  }

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
        showWidgetAlert('success', (res.key && wt(res.key, res.params)) || res.message || wt('successCurrent'));
        const prompted = await recordSingleLessonCompletedWidget();
        if (!prompted && res.submitted !== false) {
          setTimeout(() => { window.location.reload(); }, 1800);
        }
      } else {
        showWidgetAlert('error', (res?.key && wt(res.key, res.params)) || res?.error || res?.message || wt('unknownError'));
      }
    } catch (err) {
      showWidgetAlert('error', err.message || wt('unknownError'));
    } finally {
      btnCurrent.classList.remove('loading');
      btnCurrent.disabled = false;
    }
  });

  // Action: AI Quiz tự động
  if (btnQuiz) {
    btnQuiz.addEventListener('click', async () => {
      if (isWidgetProcessing) return;
      btnQuiz.classList.add('loading');
      btnQuiz.disabled = true;

      try {
        const res = await autoAnswerGradedQuiz();
        if (res && res.success) {
          showWidgetAlert('success', (res.key && wt(res.key, res.params)) || res.message);
          // No reload — user must verify and submit manually
        } else {
          showWidgetAlert('error', (res?.key && wt(res.key, res.params)) || res?.error || wt('unknownError'));
        }
      } catch (err) {
        showWidgetAlert('error', err.message || wt('unknownError'));
      } finally {
        btnQuiz.classList.remove('loading');
        btnQuiz.disabled = false;
      }
    });
  }

  // Action: Hoàn thành toàn bộ Video & Reading
  const bulkConfirmEl = widgetShadow.getElementById('cs-bulk-confirm');
  const bulkConfirmMsg = widgetShadow.getElementById('cs-confirm-msg');
  const bulkConfirmed = {};
  let pendingBulk = null;

  function hideBulkConfirm() {
    pendingBulk = null;
    bulkConfirmEl.style.display = 'none';
  }

  // Bulk actions ask for confirmation once per page load (per action kind).
  function requestBulk(kind, msgKey, btn, run) {
    if (isWidgetProcessing) return;
    const start = () => {
      btn.classList.add('loading');
      btn.disabled = true;
      run();
    };
    if (bulkConfirmed[kind]) return start();
    pendingBulk = { kind, start };
    bulkConfirmMsg.textContent = wt(msgKey);
    bulkConfirmEl.style.display = 'flex';
    widgetShadow.getElementById('cs-btn-confirm-ok').focus();
  }

  widgetShadow.getElementById('cs-btn-confirm-cancel').addEventListener('click', hideBulkConfirm);
  widgetShadow.getElementById('cs-btn-confirm-ok').addEventListener('click', () => {
    const job = pendingBulk;
    hideBulkConfirm();
    if (!job) return;
    bulkConfirmed[job.kind] = true;
    job.start();
  });

  btnBulkVR.addEventListener('click', () => {
    requestBulk('vr', 'confirmBulkVR', btnBulkVR, markAllItemsCompleted);
  });

  // Action: Hoàn thành toàn bộ Discussion
  btnBulkDisc.addEventListener('click', () => {
    requestBulk('disc', 'confirmBulkDisc', btnBulkDisc, markAllDiscussionsCompleted);
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
          showWidgetAlert('success', (res.key && wt(res.key, res.params)) || res.message);
          recordSingleLessonCompletedWidget();
        } else {
          showWidgetAlert('error', (res?.key && wt(res.key, res.params)) || res?.error || wt('unknownError'));
        }
      } catch (err) {
        showWidgetAlert('error', err.message || wt('unknownError'));
      } finally {
        btnPeer.classList.remove('loading');
        btnPeer.disabled = false;
      }
    });
  }

  // Rating Toast Event Listeners
  const rateBtn = widgetShadow.getElementById('cs-btn-rate-store');
  const alreadyRatedBtn = widgetShadow.getElementById('cs-btn-already-rated');
  const closeRatingBtn = widgetShadow.getElementById('cs-close-rating-btn');
  const reloadCourseraBtn = widgetShadow.getElementById('cs-btn-reload-coursera');

  if (rateBtn) rateBtn.addEventListener('click', openWidgetReviewPage);
  if (alreadyRatedBtn) alreadyRatedBtn.addEventListener('click', handleWidgetAlreadyRated);
  if (closeRatingBtn) closeRatingBtn.addEventListener('click', handleWidgetCloseRating);
  if (reloadCourseraBtn) reloadCourseraBtn.addEventListener('click', handleWidgetReloadCoursera);

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


