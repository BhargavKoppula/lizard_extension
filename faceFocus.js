let webcam = document.getElementById("webcam");
let startBtn = document.getElementById("startBtn");
let stopBtn = document.getElementById("stopBtn");
let statusEl = document.getElementById("status");
let timerEl = document.getElementById("timer");
let sessionDropdown = document.getElementById("sessionDuration");
let customInput = document.getElementById("customDuration");

let stream = null;
let focusTime = 0;
let interval = null;
let lastActivity = Date.now();
let hasFocus = true;
let sessionDuration = 1500;

document.addEventListener("mousemove", () => lastActivity = Date.now());
document.addEventListener("keydown", () => lastActivity = Date.now());
document.addEventListener("visibilitychange", () => {
  hasFocus = !document.hidden;
});

sessionDropdown.addEventListener("change", () => {
  if (sessionDropdown.value === "custom") {
    customInput.style.display = "block";
  } else {
    customInput.style.display = "none";
  }
});

async function startWebcam() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcam.srcObject = stream;
    statusEl.textContent = "Status: Webcam Active";
  } catch (err) {
    statusEl.textContent = "Status: ❌ Webcam access denied";
    console.error("Webcam error", err);
  }
}

function formatTime(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function checkFocus() {
  const active = (Date.now() - lastActivity) < 10000;
  if (stream && hasFocus && active) {
    focusTime++;
    timerEl.textContent = formatTime(focusTime);
    statusEl.textContent = "Status: 🟢 Focused";

    if (focusTime === sessionDuration) {
      chrome.runtime.sendMessage({ type: "focus_complete" });
      stopSession();
    }
  } else {
    statusEl.textContent = "Status: ⚠️ Inactive";
  }
}

function startSession() {
  const selected = sessionDropdown.value;
  if (selected === "custom") {
    sessionDuration = parseInt(customInput.value) || 1500;
  } else {
    sessionDuration = parseInt(selected);
  }

  focusTime = 0;
  timerEl.textContent = "00:00:00";
  startWebcam();
  interval = setInterval(checkFocus, 1000);
  startBtn.disabled = true;
  stopBtn.style.display = "inline-block";
}

function stopSession() {
  clearInterval(interval);
  interval = null;
  startBtn.disabled = false;
  stopBtn.style.display = "none";
  statusEl.textContent = "Status: Session stopped";
}

startBtn.onclick = startSession;
stopBtn.onclick = stopSession;
