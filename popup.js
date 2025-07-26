document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const sessionDropdown = document.getElementById("sessionDuration");
  const customInput = document.getElementById("customDuration");
  const statusEl = document.getElementById("status");
  const timerEl = document.getElementById("timer");

  let sessionDuration = 1500;
  let focusTime = 0;
  let interval = null;
  let stream = null;
  let lastActivityTime = Date.now();
  let isPaused = false;

  function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function resetActivityTimer() {
    lastActivityTime = Date.now();
    if (isPaused) {
      statusEl.textContent = "Status: 🟢 Resumed";
      isPaused = false;
    }
  }

  function checkInactivity() {
    const inactiveThreshold = 10; // seconds
    const now = Date.now();
    const idleTime = (now - lastActivityTime) / 1000;

    if (idleTime > inactiveThreshold || document.hidden) {
      isPaused = true;
      statusEl.textContent = "Status: ⏸️ Inactive";
    }
  }

  function startTimer() {
    focusTime = 0;
    interval = setInterval(() => {
      checkInactivity();
      if (!isPaused) {
        focusTime++;
        timerEl.textContent = formatTime(focusTime);

        if (focusTime >= sessionDuration) {
          clearInterval(interval);
          if (stream) {
            stream.getTracks().forEach(t => t.stop());
            stream = null;
          }

          chrome.notifications?.create({
            type: "basic",
            iconUrl: "128.png",
            title: "Lizard",
            message: "Great job! You've focused for your full session. Take a break!"
          });

          statusEl.textContent = "Status: ✅ Completed";
          startBtn.disabled = false;
          stopBtn.style.display = "none";
        }
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
    focusTime = 0;
    timerEl.textContent = "00:00:00";
    statusEl.textContent = "Status: 🔴 Stopped";
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
    startWebcamAndSession();
  });

  stopBtn.addEventListener("click", () => {
    stopSession();
    startBtn.disabled = false;
    stopBtn.style.display = "none";
  });

  // 🔁 Track activity
  document.addEventListener("mousemove", resetActivityTimer);
  document.addEventListener("click", resetActivityTimer);
  document.addEventListener("keydown", resetActivityTimer);
  document.addEventListener("visibilitychange", resetActivityTimer);
});
