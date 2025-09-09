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


});
