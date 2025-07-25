let webcam = document.getElementById("webcam");
let startBtn = document.getElementById("startBtn");
let statusEl = document.getElementById("status");
let timerEl = document.getElementById("timer");

let stream = null;
let focusTime = 0;
let interval = null;
let lastActivity = Date.now();
let hasFocus = true;

document.addEventListener("mousemove", () => lastActivity = Date.now());
document.addEventListener("keydown", () => lastActivity = Date.now());
document.addEventListener("visibilitychange", () => {
  hasFocus = !document.hidden;
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
  const active = (Date.now() - lastActivity) < 10000; // active in last 10s
  if (stream && hasFocus && active) {
    focusTime++;
    timerEl.textContent = formatTime(focusTime);

    if (focusTime === 1500) { // 25 minutes
      chrome.runtime.sendMessage({ type: "focus_complete" });
    }
  } else {
    statusEl.textContent = "Status: ⚠️ Not active";
  }
}

startBtn.onclick = async () => {
  await startWebcam();
  if (!interval) {
    interval = setInterval(checkFocus, 1000);
    startBtn.disabled = true;
  }
};
