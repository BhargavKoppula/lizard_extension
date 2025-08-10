// content_script.js
// Sends a ping to background on user activity in each tab.

(function() {
  // Throttle pings to at most one per 2s per tab
  let lastPing = 0;
  const THROTTLE_MS = 2000;

  function pingActivity() {
    const now = Date.now();
    if (now - lastPing < THROTTLE_MS) return;
    lastPing = now;
    try {
      chrome.runtime.sendMessage({ type: "user_activity", time: now });
    } catch (e) {
      // ignore
    }
  }

  window.addEventListener("mousemove", pingActivity, { passive: true });
  window.addEventListener("mousedown", pingActivity, { passive: true });
  window.addEventListener("keydown", pingActivity, { passive: true });
  window.addEventListener("scroll", pingActivity, { passive: true });
})();
