(function () {
  const userAgent = 'coursera-locking-browser/0.6.3';

  try {
    Object.defineProperty(navigator, 'userAgent', {
      get: () => userAgent,
      configurable: false,
    });
  } catch (_e) {}

  window.coursera = window.coursera || {};
  console.warn(window.coursera);

  const shouldIntercept = (url) => typeof url === 'string' && url.startsWith('coursera-lock://');
  const shouldBlock = (url) =>
    typeof url === 'string' &&
    (url.includes('submission-start') || url.includes('submission-complete'));
  const intercept = (url) => {
    window.dispatchEvent(new CustomEvent('BypassCoursera_Intercept', { detail: url }));
  };

  const originalOpen = window.open;
  window.open = function (url, ...args) {
    if (shouldBlock(url)) {
      return null;
    }

    if (shouldIntercept(url)) {
      intercept(url);
      return { closed: false, focus: () => {}, close: () => {} };
    }

    return originalOpen.apply(this, [url, ...args]);
  };
})();
