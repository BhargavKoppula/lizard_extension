let focusTime = 0;
let sessionDuration = 1500;
let interval = null;
let lastActivity = Date.now();
let hasFocus = true;
let stream = null;

async function startWebcam() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    return true;
  } catch (e) {
    console.error("Webcam access failed", e);
    return false;
  }
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function checkFocus() {
  const now = Date.now();
  const active = (now - lastActivity) < 10000 && hasFocus;

  if (stream && active) {
    focusTime++;
  }

  chrome.runtime.sendMessage({
    type: "update_time",
    time: formatTime(focusTime),
    active
  });

  if (focusTime >= sessionDuration) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "128.png",
      title: "Lizard Focus Tracker",
      message: "Great job! You've completed your session. Take a break!"
    });
    stopSession();
  }
}

function startSession(duration) {
  sessionDuration = duration;
  focusTime = 0;

  startWebcam().then(success => {
    if (success) {
      interval = setInterval(checkFocus, 1000);
    } else {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "128.png",
        title: "Lizard Focus Tracker",
        message: "Webcam access denied. Cannot start session."
      });
    }
  });

  chrome.windows.onFocusChanged.addListener(windowId => {
    hasFocus = windowId !== chrome.windows.WINDOW_ID_NONE;
  });

  chrome.idle.onStateChanged.addListener((newState) => {
    if (newState === "active") {
      lastActivity = Date.now();
    }
  });
}

function stopSession() {
  clearInterval(interval);
  interval = null;
  focusTime = 0;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "start_focus") {
    startSession(msg.duration);
  }

  if (msg.type === "stop_focus") {
    stopSession();
  }

  if (msg.type === "get_status") {
    sendResponse({
      type: "update_time",
      time: formatTime(focusTime),
      active: true
    });
  }
});
