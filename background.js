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
    chrome.storage.local.set({ geminiApiKey: message.key }, () => {
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

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    })
      .then((r) => {
        if (!r.ok) {
          return r.text().then((t) => {
            sendResponse({ ok: false, error: `HTTP ${r.status}: ${t.slice(0, 200)}` });
          });
        }
        return r.json().then((data) => sendResponse({ ok: true, data }));
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }));

    return true; // keep message channel open for async response
  }
});
