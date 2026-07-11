/**
 * Background service worker.
 *
 * Intentionally does not read or store Coursera authentication cookies.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStorage') {
    chrome.storage.local.get(['userId'], (data) => {
      sendResponse(data);
    });
    return true;
  }
});
