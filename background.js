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

  // Gemini API Key management
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
      chrome.storage.local.set({ geminiApiKey: message.key }, () => {
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

  // Gemini API proxy — content script cannot call external APIs directly in MV3
  if (message.action === 'callGeminiApi') {
    const { apiKey, prompt } = message;
    if (!apiKey) {
      sendResponse({ ok: false, error: 'No API key provided' });
      return true;
    }

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

      // Disable thinking budget on Flash models to prevent latency & wasted token budget
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

        // If model not found or deprecated (404), try next candidate model
        if (r.status === 404 && modelIndex + 1 < candidateModels.length) {
          return await tryCallGemini(modelIndex + 1, withThinkingConfig);
        }

        // If 400 Bad Request with thinkingConfig, retry without thinkingConfig
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

    tryCallGemini().then(sendResponse);
    return true; // keep message channel open for async response
  }
});
