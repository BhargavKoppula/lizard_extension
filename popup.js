// popup.js
document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const sessionDropdown = document.getElementById("sessionDuration");
  const customInput = document.getElementById("customDuration");
  const statusEl = document.getElementById("status");
  const timerEl = document.getElementById("timer");
  const statsEl = document.getElementById("stats");
  const historyEl = document.getElementById("history");

  sessionDropdown.addEventListener("change", () => {
    if (sessionDropdown.value === "custom") {
      customInput.style.display = "block";
    } else {
      customInput.style.display = "none";
    }
  });

  startBtn.addEventListener("click", () => {
    let duration = sessionDropdown.value;
    if (duration === "custom") {
      duration = parseInt(customInput.value, 10);
      if (!duration || duration <= 0) {
        alert("Enter a valid duration in seconds.");
        return;
      }
    } else {
      duration = parseInt(duration, 10);
    }
    chrome.runtime.sendMessage({ type: "start_focus", duration }, (res) => {
      startBtn.disabled = true;
      stopBtn.style.display = "inline-block";
      statusEl.textContent = "Status: Started";
      statsEl.innerHTML = "";
    });
  });

  stopBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "stop_focus" }, (res) => {
      startBtn.disabled = false;
      stopBtn.style.display = "none";
      statusEl.textContent = "Status: Stopped (summary below)";
    });
  });
  
  //toggle button
  const toggleBtn = document.getElementById("mode-toggle");
    let currentMode = "active";

    toggleBtn.addEventListener("click", () => {
      currentMode = (currentMode === "active") ? "reading" : "active";
      toggleBtn.textContent = currentMode === "active" ? "Switch to Reading Mode" : "Switch to Active Mode";
      updatePopupMode(currentMode);
      chrome.runtime.sendMessage({ type: "notify_mode", mode: currentMode });
    });

    // changes the color of popup according to the mode
    function updatePopupMode(mode) {
      document.body.classList.remove("active-mode", "reading-mode");
      if (mode === "active") {
        document.body.classList.add("active-mode");
      } else if (mode === "reading") {
        document.body.classList.add("reading-mode");
      }
    }

  // Receive live updates and final session summary
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;
    if (msg.type === "update_time") {
      timerEl.textContent = msg.time;
      statusEl.textContent = msg.active ? "Status: 🟢 Focused" : "Status: ⚠️ Unfocused";
    } else if (msg.type === "session_complete") {
      displaySummary(msg.summary);
      // reload history
      loadHistory();
      //reload points
      loadPoints();  
      startBtn.disabled = false;
      stopBtn.style.display = "none";
    }
  });

  // Query status when popup opens
  chrome.runtime.sendMessage({ type: "get_status" }, (resp) => {
    if (resp && resp.time) {
      timerEl.textContent = resp.time;
      if (resp.running) {
        startBtn.disabled = true;
        stopBtn.style.display = "inline-block";
      } else {
        startBtn.disabled = false;
        stopBtn.style.display = "none";
      }
    }
  });

  function displaySummary(summary) {
    statsEl.innerHTML = `
      <strong>Session Summary</strong>
      <div>Focused: ${formatSec(summary.focusedSeconds)} (${summary.focusedPct}%)</div>
      <div>Unfocused: ${formatSec(summary.unfocusedSeconds)}</div>
      <div>Start: ${new Date(summary.startTime).toLocaleString()}</div>
      <div>End: ${new Date(summary.endTime).toLocaleString()}</div>
    `;
  }

  function formatSec(s) {
    const m = Math.floor(s/60);
    const sec = s%60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  }

  // Load recent sessions history
  function loadHistory() {
    chrome.storage.local.get({ sessions: [] }, (res) => {
      const sessions = res.sessions || [];
      if (!sessions.length) {
        historyEl.innerHTML = "<div>No sessions yet.</div>";
        return;
      }
      historyEl.innerHTML = sessions.slice(0,8).map(sess => {
        return `<div style="padding:6px 0;border-bottom:1px solid #eee;">
          <div><strong>${formatSec(sess.focusedSeconds)} focused</strong> (${sess.focusedPct}%)</div>
          <div style="font-size:12px;color:#666">${new Date(sess.startTime).toLocaleString()}</div>
        </div>`;
      }).join("");
    });
  }

  loadHistory();

// loads points obtained
  function loadPoints() {
    chrome.storage.local.get({ points: 0 }, (res) => {
      document.getElementById("pointsCounter").textContent = res.points || 0;
    });
  }

  loadPoints();

// loads last session summary
  function loadLastSession() {
  chrome.storage.local.get({ sessions: [] }, (res) => {
    const sessions = res.sessions || [];
    if (sessions.length > 0) {
      displaySummary(sessions[0]); // show most recent
    } else {
      statsEl.innerHTML = "<div>No sessions yet.</div>";
    }
  });
}

loadLastSession();

// loads weekly stats
function loadWeeklyStats() {
  chrome.storage.local.get({ sessions: [] }, (res) => {
    const sessions = res.sessions || [];
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const lastWeek = sessions.filter(s => s.startTime >= oneWeekAgo);

    if (lastWeek.length === 0) {
      document.getElementById("weeklyStats").innerHTML = "<div>No sessions this week.</div>";
      return;
    }

    const totalFocused = lastWeek.reduce((sum, s) => sum + (s.focusedSeconds || 0), 0);
    const totalDuration = lastWeek.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgFocus = totalDuration > 0 ? Math.round((totalFocused / totalDuration) * 100) : 0;

    document.getElementById("weeklyStats").innerHTML = `
      <strong>Weekly Stats</strong>
      <div>Total Focused: ${Math.floor(totalFocused/60)} min</div>
      <div>Average Focus: ${avgFocus}%</div>
      <div>Sessions: ${lastWeek.length}</div>
    `;
  });
}

loadWeeklyStats();

function loadWeeklyStats() {
  chrome.storage.local.get({ sessions: [] }, (res) => {
    const sessions = res.sessions || [];
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Filter last 7 days
    const lastWeek = sessions.filter(s => s.startTime >= oneWeekAgo);

    if (lastWeek.length === 0) {
      document.getElementById("weeklyStats").innerHTML = "<div>No sessions this week.</div>";
      return;
    }

    const totalFocused = lastWeek.reduce((sum, s) => sum + (s.focusedSeconds || 0), 0);
    const totalDuration = lastWeek.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgFocus = totalDuration > 0 ? Math.round((totalFocused / totalDuration) * 100) : 0;

    document.getElementById("weeklyStats").innerHTML = `
      <div>Total Focused: <strong>${Math.floor(totalFocused/60)} min</strong></div>
      <div>Average Focus: <strong>${avgFocus}%</strong></div>
      <div>Sessions: <strong>${lastWeek.length}</strong></div>
    `;

    // --- Chart data ---
    const days = Array(7).fill(0);

lastWeek.forEach(s => {
  const d = new Date(s.startTime);
  const dayIndex = d.getDay(); // 0=Sun ... 6=Sat
  days[dayIndex] += Math.floor((s.focusedSeconds || 0) / 60); // minutes
});


    drawWeeklyChart(days);
  });
}

// chart of weekly stats
function drawWeeklyChart(data) {
  const canvas = document.getElementById("weeklyChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const barWidth = 25;
  const gap = 10;
  const maxVal = Math.max(...data, 1);
  const labels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  data.forEach((val, i) => {
    const x = i * (barWidth + gap) + 15;
    const h = (val / maxVal) * 100;
    ctx.fillStyle = "#4caf50";
    ctx.fillRect(x, 120 - h, barWidth, h);
    ctx.fillStyle = "#333";
    ctx.font = "10px sans-serif";
    ctx.fillText(labels[i], x, 115);
  });
}
loadWeeklyStats();

// loads calander streaks
function loadStreaks() {
  chrome.storage.local.get({ streaks: {} }, (res) => {
    const streaks = res.streaks || {};
    const today = new Date();
    const days = [];

    // Show last 28 days
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0,10);
      days.push({ date: key, active: !!streaks[key] });
    }

    // Fill streak grid
    const grid = document.getElementById("streakGrid");
    grid.innerHTML = "";
    days.forEach(day => {
      const box = document.createElement("div");
      box.className = "streak-day " + (day.active ? "active" : "inactive");
      grid.appendChild(box);
    });

    // Compute streak numbers
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const allDates = Object.keys(streaks).sort();
    const oneDay = 24*60*60*1000;

    for (let i = 0; i < allDates.length; i++) {
      if (streaks[allDates[i]]) {
        if (i > 0) {
          const prev = new Date(allDates[i-1]);
          const curr = new Date(allDates[i]);
          if ((curr - prev) <= oneDay * 1.5) {
            tempStreak++;
          } else {
            tempStreak = 1;
          }
        } else {
          tempStreak = 1;
        }
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      }
    }

    // Compute current streak ending today
    currentStreak = 0;
    let check = new Date(today);
    while (streaks[check.toISOString().slice(0,10)]) {
      currentStreak++;
      check.setDate(check.getDate() - 1);
    }

    document.getElementById("streakStats").innerHTML = `
      <div>Current Streak: <strong>${currentStreak} days</strong></div>
      <div>Longest Streak: <strong>${longestStreak} days</strong></div>
    `;
  });
}
loadStreaks();


});
