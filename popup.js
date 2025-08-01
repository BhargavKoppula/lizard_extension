document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const sessionDropdown = document.getElementById("sessionDuration");
  const customInput = document.getElementById("customDuration");
  const statusEl = document.getElementById("status");
  const timerEl = document.getElementById("timer");

  const statsBlock = document.createElement('div');
  statsBlock.id = "stats";
  statsBlock.style.marginTop = "20px";
  document.body.appendChild(statsBlock);

  let sessionDuration = 1500;
  let focusTime = 0;
  let totalTime = 0;
  let interval = null;
  let stream = null;
  let lastActivityTime = Date.now();
  let isPaused = false;
  let focusLog = [];
  let sessionStartTime = null;

  function formatTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function resetActivityTimer() {
    lastActivityTime = Date.now();
    if (isPaused) {
      isPaused = false;
      statusEl.textContent = "Status: 🟢 Resumed";
    }
  }

  function checkInactivity() {
    const inactiveThreshold = 10; // seconds
    const now = Date.now();
    const idleTime = (now - lastActivityTime) / 1000;

    isPaused = idleTime > inactiveThreshold || document.hidden;
    statusEl.textContent = isPaused ? "Status: ⏸️ Inactive" : "Status: 🟢 Focused";
  }

  function logFocusState() {
    const state = isPaused ? "unfocused" : "focused";
    focusLog.push({ second: totalTime, state });
    if (!isPaused) focusTime++;
  }

  function showStats() {
    const unfocusedTime = sessionDuration - focusTime;
    const focusPercent = Math.round((focusTime / sessionDuration) * 100);
    const unfocusPercent = 100 - focusPercent;

    const start = new Date(sessionStartTime).toLocaleTimeString();
    const end = new Date(sessionStartTime + sessionDuration * 1000).toLocaleTimeString();

    statsBlock.innerHTML = `
      <h3>📊 Session Summary</h3>
      <p>🟢 Focused: ${formatTime(focusTime)} (${focusPercent}%)</p>
      <p>⏸️ Unfocused: ${formatTime(unfocusedTime)} (${unfocusPercent}%)</p>
      <p>🕒 Start: ${start}</p>
      <p>🏁 End: ${end}</p>
    `;
  }

  function startTimer() {
    focusTime = 0;
    totalTime = 0;
    focusLog = [];
    sessionStartTime = Date.now();

    interval = setInterval(() => {
      checkInactivity();
      logFocusState();

      totalTime++;
      timerEl.textContent = formatTime(totalTime);

      if (totalTime >= sessionDuration) {
        clearInterval(interval);
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
          stream = null;
        }

        chrome.notifications?.create({
          type: "basic",
          iconUrl: "128.png",
          title: "Lizard",
          message: "Great job! You've completed your focus session!"
        });

        statusEl.textContent = "Status: ✅ Session Complete";
        startBtn.disabled = false;
        stopBtn.style.display = "none";
        showStats();
      }
    }, 1000);
  }

  async function startWebcamAndSession() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      statusEl.textContent = "Status: 🟢 Webcam active";
      resetActivityTimer();
      startTimer();
    } catch (err) {
      console.error("Webcam access denied", err);
      statusEl.textContent = "Status: ❌ Webcam access denied";
    }
  }

function stopSession() {
  if (interval) clearInterval(interval);
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  interval = null;

  // Still log the current state before ending
  logFocusState();

  statusEl.textContent = "Status: 🛑 Session Stopped";
  timerEl.textContent = formatTime(totalTime);
  stopBtn.style.display = "none";
  startBtn.disabled = false;

  showStats();  // <-- This will now show the summary even when user stops early
}

  sessionDropdown.addEventListener("change", () => {
    if (sessionDropdown.value === "custom") {
      customInput.style.display = "block";
    } else {
      customInput.style.display = "none";
      sessionDuration = parseInt(sessionDropdown.value);
    }
  });

  startBtn.addEventListener("click", () => {
    if (sessionDropdown.value === "custom") {
      const val = parseInt(customInput.value);
      if (!val || val <= 0) {
        alert("Enter a valid custom duration.");
        return;
      }
      sessionDuration = val;
    }

    startBtn.disabled = true;
    stopBtn.style.display = "inline-block";
    statsBlock.innerHTML = "";
    startWebcamAndSession();
  });

  stopBtn.addEventListener("click", () => {
    stopSession();
    startBtn.disabled = false;
    stopBtn.style.display = "none";
  });

  // Track user activity
  document.addEventListener("mousemove", resetActivityTimer);
  document.addEventListener("click", resetActivityTimer);
  document.addEventListener("keydown", resetActivityTimer);
  document.addEventListener("visibilitychange", resetActivityTimer);
});
