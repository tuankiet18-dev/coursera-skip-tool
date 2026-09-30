/**
 * Background service worker.
 *
 * Intentionally does not read or store Coursera authentication cookies.
 * Handles Gemini API proxy calls from content script (MV3 restriction workaround).
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Legacy: storage get
  if (message.action === 'getStorage') {
    chrome.storage.local.get(['userId'], (data) => {
      sendResponse(data);
    });
    return true;
  }

  // Multi-Provider AI Configuration & Key Management
  if (message.action === 'getAiConfig') {
    chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'openaiApiKey', 'groqApiKey'], (data) => {
      sendResponse({
        provider: data.aiProvider || 'gemini',
        keys: {
          gemini: data.geminiApiKey || null,
          openai: data.openaiApiKey || null,
          groq: data.groqApiKey || null,
        },
      });
    });
    return true;
  }

  if (message.action === 'setAiKey') {
    const { provider, key } = message;
    const prop = provider === 'openai' ? 'openaiApiKey' : (provider === 'groq' ? 'groqApiKey' : 'geminiApiKey');
    if (!key || !key.trim()) {
      chrome.storage.local.remove([prop], () => {
        sendResponse({ ok: true });
      });
    } else {
      chrome.storage.local.set({ [prop]: key.trim(), aiProvider: provider }, () => {
        sendResponse({ ok: true });
      });
    }
    return true;
  }

  if (message.action === 'setAiProvider') {
    const { provider } = message;
    if (provider) {
      chrome.storage.local.set({ aiProvider: provider }, () => {
        sendResponse({ ok: true });
      });
    }
    return true;
  }

  if (message.action === 'removeAiKey') {
    const { provider } = message;
    const prop = provider === 'openai' ? 'openaiApiKey' : (provider === 'groq' ? 'groqApiKey' : 'geminiApiKey');
    chrome.storage.local.remove([prop], () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  // Legacy Gemini Key Management for backward compatibility
  if (message.action === 'getGeminiApiKey') {
    chrome.storage.local.get(['geminiApiKey'], (data) => {
      sendResponse({ apiKey: data.geminiApiKey || null });
    });
    return true;
  }

  if (message.action === 'setGeminiApiKey') {
    if (!message.key) {
      chrome.storage.local.remove(['geminiApiKey'], () => {
        sendResponse({ ok: true });
      });
    } else {
      chrome.storage.local.set({ geminiApiKey: message.key, aiProvider: 'gemini' }, () => {
        sendResponse({ ok: true });
      });
    }
    return true;
  }

  if (message.action === 'removeGeminiApiKey') {
    chrome.storage.local.remove(['geminiApiKey'], () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  // Unified AI Proxy: routes to Gemini, OpenAI, or Groq
  if (message.action === 'callAiApi') {
    const { provider = 'gemini', apiKey, prompt } = message;
    if (!apiKey) {
      sendResponse({ ok: false, error: 'No API key provided' });
      return true;
    }

    if (provider === 'openai') {
      callOpenAiProxy(apiKey, prompt).then(sendResponse);
    } else if (provider === 'groq') {
      callGroqProxy(apiKey, prompt).then(sendResponse);
    } else {
      callGeminiProxy(apiKey, prompt).then(sendResponse);
    }
    return true;
  }

  // Legacy Gemini API proxy
  if (message.action === 'callGeminiApi') {
    const { apiKey, prompt } = message;
    if (!apiKey) {
      sendResponse({ ok: false, error: 'No API key provided' });
      return true;
    }
    callGeminiProxy(apiKey, prompt).then(sendResponse);
    return true;
  }
});

// ==========================================
// Provider API Proxies
// ==========================================

async function callGeminiProxy(apiKey, prompt) {
  const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];

  async function tryCallGemini(modelIndex = 0, withThinkingConfig = true) {
    if (modelIndex >= candidateModels.length) {
      return { ok: false, error: 'Tất cả các model Gemini đều không khả dụng. Vui lòng kiểm tra lại API key.' };
    }

    const model = candidateModels[modelIndex];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const generationConfig = {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    };

    if (withThinkingConfig && !model.includes('1.5')) {
      generationConfig.thinkingConfig = {
        thinkingBudget: 0,
      };
    }

    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        }),
      });

      if (r.status === 404 && modelIndex + 1 < candidateModels.length) {
        return await tryCallGemini(modelIndex + 1, withThinkingConfig);
      }

      if (r.status === 400 && withThinkingConfig && generationConfig.thinkingConfig) {
        return await tryCallGemini(modelIndex, false);
      }

      if (!r.ok) {
        const t = await r.text();
        return { ok: false, error: `HTTP ${r.status}: ${t.slice(0, 200)}` };
      }

      const data = await r.json();
      return { ok: true, data };
    } catch (err) {
      if (modelIndex + 1 < candidateModels.length) {
        return await tryCallGemini(modelIndex + 1, withThinkingConfig);
      }
      return { ok: false, error: err.message };
    }
  }

  return await tryCallGemini(0);
}

async function callOpenAiProxy(apiKey, prompt) {
  const candidateModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];

  async function tryCallOpenAi(modelIndex = 0) {
    if (modelIndex >= candidateModels.length) {
      return { ok: false, error: 'Không thể kết nối đến OpenAI API. Vui lòng kiểm tra lại API key.' };
    }

    const model = candidateModels[modelIndex];
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant helping answer a graded online quiz. Return ONLY a valid JSON array of answers in this exact format: [{"q":1,"answers":[0]}]. Do not include markdown code block syntax. Do not include any explanations.',
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
        }),
      });

      if (r.status === 404 && modelIndex + 1 < candidateModels.length) {
        return await tryCallOpenAi(modelIndex + 1);
      }

      if (!r.ok) {
        const t = await r.text();
        if (r.status === 401) return { ok: false, error: 'API Key OpenAI không hợp lệ hoặc hết hạn.' };
        if (r.status === 429) return { ok: false, error: 'OpenAI rate limit hoặc hết quota tín dụng.' };
        return { ok: false, error: `OpenAI HTTP ${r.status}: ${t.slice(0, 200)}` };
      }

      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content || '';
      return { ok: true, data: { text: content, raw: data } };
    } catch (err) {
      if (modelIndex + 1 < candidateModels.length) {
        return await tryCallOpenAi(modelIndex + 1);
      }
      return { ok: false, error: `OpenAI error: ${err.message}` };
    }
  }

  return await tryCallOpenAi(0);
}

async function getGroqCandidateModels(apiKey) {
  const fallbackModels = [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
  ];

  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!r.ok) return fallbackModels;

    const data = await r.json();
    const rawList = Array.isArray(data?.data) ? data.data : [];

    // Filter out non-chat models (audio, guard, embeddings, vision only, etc.)
    const isExcluded = (id) =>
      /whisper|guard|prompt-guard|orpheus|embed|rerank|tts|audio/i.test(id);

    const availableIds = rawList
      .map((m) => m?.id)
      .filter((id) => typeof id === 'string' && id && !isExcluded(id));

    if (availableIds.length === 0) return fallbackModels;

    // Sort by priority/capability
    const priority = [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'llama3-70b-8192',
      'mixtral-8x7b-32768',
      'llama3-8b-8192',
      'gemma2-9b-it',
    ];

    availableIds.sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });

    return availableIds;
  } catch (_) {
    return fallbackModels;
  }
}

async function callGroqProxy(apiKey, prompt) {
  const candidateModels = await getGroqCandidateModels(apiKey);

  async function tryCallGroq(modelIndex = 0) {
    if (modelIndex >= candidateModels.length) {
      return {
        ok: false,
        error: 'Không tìm thấy model khả dụng trên Groq cho tài khoản này. Vui lòng kiểm tra Model Permissions trên console.groq.com hoặc dùng Gemini / OpenAI.',
      };
    }

    const model = candidateModels[modelIndex];
    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant helping answer a graded online quiz. Return ONLY a valid JSON array of answers in this exact format: [{"q":1,"answers":[0]}]. Do not include markdown code block syntax. Do not include any explanations.',
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
        }),
      });

      if ((r.status === 404 || r.status === 400) && modelIndex + 1 < candidateModels.length) {
        // Model not found or deprecated, try next model in candidate list
        return await tryCallGroq(modelIndex + 1);
      }

      if (!r.ok) {
        const t = await r.text();
        if (r.status === 401) return { ok: false, error: 'API Key Groq không hợp lệ hoặc hết hạn.' };
        if (r.status === 429) return { ok: false, error: 'Groq rate limit. Vui lòng thử lại sau vài giây.' };
        if (r.status === 404) {
          if (modelIndex + 1 < candidateModels.length) {
            return await tryCallGroq(modelIndex + 1);
          }
          return {
            ok: false,
            error: `Model Groq (${model}) không khả dụng hoặc tài khoản chưa được cấp quyền trên console.groq.com.`,
          };
        }
        return { ok: false, error: `Groq HTTP ${r.status}: ${t.slice(0, 200)}` };
      }

      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content || '';
      return { ok: true, data: { text: content, raw: data, model } };
    } catch (err) {
      if (modelIndex + 1 < candidateModels.length) {
        return await tryCallGroq(modelIndex + 1);
      }
      return { ok: false, error: `Groq error: ${err.message}` };
    }
  }

  return await tryCallGroq(0);
}
