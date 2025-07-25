let sessionStartTime = null;
let sessionData = [];

function getCurrentTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    callback(tabs[0]);
  });
}

document.getElementById('startSession').addEventListener('click', () => {
  sessionStartTime = Date.now();
  sessionData = [];

  document.getElementById('startSession').disabled = true;
  document.getElementById('endSession').disabled = false;

  trackFocus();
});

document.getElementById('endSession').addEventListener('click', () => {
  const endTime = Date.now();
  const duration = Math.round((endTime - sessionStartTime) / 1000);

  const distractions = sessionData.filter(tab => tab.isDistracting).length;
  const focusScore = Math.max(0, 100 - (distractions * 10));

  document.getElementById('summary').innerHTML = `
    <p>Session Duration: ${duration} seconds</p>
    <p>Distractions: ${distractions}</p>
    <p><strong>Focus Score: ${focusScore}%</strong></p>
  `;

  document.getElementById('startSession').disabled = false;
  document.getElementById('endSession').disabled = true;
});

function trackFocus() {
  const distractingSites = ["youtube.com", "instagram.com", "reddit.com", "twitter.com"];

  const intervalId = setInterval(() => {
    getCurrentTab((tab) => {
      if (!tab || !tab.url) return;

      const isDistracting = distractingSites.some(site => tab.url.includes(site));
      sessionData.push({ time: Date.now(), url: tab.url, isDistracting });
    });
  }, 5000);
}