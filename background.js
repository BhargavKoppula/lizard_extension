// background.js
// Handles session lifecycle, activity logs, stats, storage, gamification, and notifications.

let session = {
  running: false,
  duration: 0,        // seconds (target)
  elapsed: 0,         // seconds counted (always increments until duration)
  focusSeconds: 0,    // seconds when considered focused
  focusLog: [],       // [{second:0, state:"focused"|"unfocused"}, ...]
  startTime: null,
  lastActivityAt: Date.now(),  // timestamp of last activity ping from content_script
  checkIntervalId: null,
  inactivityThreshold: 15 // seconds without activity => unfocused
};


// Utility
function formatTimeSec(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

// Load stats from storage
async function getStats() {
  return new Promise(resolve => {
    chrome.storage.local.get(["sessions", "points", "streaks"], data => {
      resolve(data);
    });
  });
}

// Save a completed session
function saveSessionRecord(record) {
  chrome.storage.local.get({ sessions: [] }, (res) => {
    const sessions = res.sessions || [];
    sessions.unshift(record);
    // Keep only last 100 sessions
    if (sessions.length > 100) sessions.splice(100);
    chrome.storage.local.set({ sessions });
  });
}

// Gamification: add points and update streaks
function awardPointsAndStreaks(record) {
  const pointsEarned = Math.max(1, Math.round(record.focusedSeconds / 60)); // 1 point per focused minute

  // NEW: award at least 1 point if completed with 80%+ focus
  if (record.focusedPct >= 80 && pointsEarned < 1) {
    pointsEarned = 1;
  }

  chrome.storage.local.get({ points: 0, streaks: {} }, (res) => {
    const newPoints = (res.points || 0) + pointsEarned;
    const streaks = res.streaks || {};

    // Update streak: if focusedSeconds >= 25min (1500s) counts as a day completed
    const completedToday = (
      record.focusedSeconds >= 1500 || // 25 min rule
      record.focusedPct >= 80          // OR 80% focus in any session
    );
    const todayKey = new Date(record.startTime).toISOString().slice(0,10);
    if (completedToday) {
      streaks[todayKey] = true;
    }
    // compute longest/current streak
    // (simple approach: compute consecutive days from today backwards)
    chrome.storage.local.set({ points: newPoints, streaks });
  });
}

// Compute summary from session
function computeSummary() {
  const focused = session.focusSeconds;
  const total = session.duration;
  const unfocused = Math.max(0, total - focused);
  const focusedPct = total > 0 ? Math.round((focused/total)*100) : 0;
  return {
    focusedSeconds: focused,
    unfocusedSeconds: unfocused,
    focusedPct,
    startTime: session.startTime,
    endTime: session.startTime + session.duration * 1000
  };
}

// Called every second when session is running
function tickSession() {
  if (!session.running) return;
  session.elapsed++;

  const gracePeriod = 5;
  let isFocused;

  if (session.elapsed <= gracePeriod) {
    // During grace period, always count as focused
    isFocused = true;
    session.focusLog.push({ second: session.elapsed - 1, state: "focused" });
    session.focusSeconds++;
    chrome.runtime.sendMessage({
      type: "update_time",
      time: formatTimeSec(session.elapsed),
      active: true
    });

    if (session.elapsed >= session.duration) {
      endSession();
    }
    return;
  }

  // After grace period → normal checks
  const now = Date.now();
  const idleSec = (now - session.lastActivityAt) / 1000;
  const userIdle = idleSec > session.inactivityThreshold;

  chrome.windows.getLastFocused({ populate: true }, (win) => {
    let tabActive = true;
    if (!win || win.focused === false) tabActive = false;

    isFocused = !userIdle && tabActive;
    session.focusLog.push({ second: session.elapsed - 1, state: isFocused ? "focused" : "unfocused" });
    if (isFocused) session.focusSeconds++;

    // Broadcast update
    chrome.runtime.sendMessage({
      type: "update_time",
      time: formatTimeSec(session.elapsed),
      active: isFocused
    });

    // Check if user idle for more than 5 minutes (300s)
if (userIdle && idleSec >= 300 && !session.notifiedIdle) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "128.png",
    title: "Still there? ⚠️",
    message: "You've been inactive for 5 minutes. Time to refocus?",
    priority: 0
  });
  session.notifiedIdle = true; // prevent repeat spam
}
    // If session is over
    if (session.elapsed >= session.duration) {
      endSession();
    }
  });
}

// Start a session: duration in seconds
function startSession(durationSec) {
  if (session.running) return;
  session.running = true;
  session.duration = durationSec;
  session.elapsed = 0;
  session.focusSeconds = 0;
  session.focusLog = [];
  session.startTime = Date.now();
  session.lastActivityAt = Date.now(); // initialize lastActivityAt with now so first seconds count as focused if user is active
  session.notifiedIdle = false;

  // Start tick every second
  session.checkIntervalId = setInterval(tickSession, 1000);

  // Send immediate update
  chrome.runtime.sendMessage({
    type: "update_time",
    time: formatTimeSec(0),
    active: true
  });
}

// Stop session early (user pressed Stop)
function stopSession() {
  if (!session.running) return;
  // We'll still compute stats for elapsed time
  session.running = false;
  if (session.checkIntervalId) clearInterval(session.checkIntervalId);
  session.checkIntervalId = null;

  const summary = computeSummary();
  const record = {
    ...summary,
    duration: session.duration,
    elapsed: session.elapsed,
    focusLog: session.focusLog,
    startTime: session.startTime
  };

  // save record and award gamification
  saveSessionRecord(record);
  awardPointsAndStreaks(record);
  checkAchievements(record);


  // send final update to popup
  chrome.runtime.sendMessage({ type: "session_complete", summary: record });

  // reset session fields (keep storage record)
  session.duration = 0;
  session.elapsed = 0;
  session.focusLog = [];
  session.focusSeconds = 0;
  session.startTime = null;
  session.lastActivityAt = 0;
  session.notifiedIdle = false;
  

  // notification after session stopped
  chrome.notifications.create({
  type: "basic",
  iconUrl: "128.png",   
  title: "Focus Session Complete ✅",
  message: `You stayed focused for ${record.focusedPct}% of your session!`
});

}

// End session naturally (complete)
function endSession() {
  // stop ticking and save
  if (session.checkIntervalId) clearInterval(session.checkIntervalId);
  session.running = false;
  session.checkIntervalId = null;
  session.notifiedIdle = false;

  const summary = computeSummary();
  const record = {
    ...summary,
    duration: session.duration,
    elapsed: session.elapsed,
    focusLog: session.focusLog,
    startTime: session.startTime
  };

  saveSessionRecord(record);
  awardPointsAndStreaks(record);
  checkAchievements(record);


  chrome.runtime.sendMessage({ type: "session_complete", summary: record });

  // reset
  session.duration = 0;
  session.elapsed = 0;
  session.focusLog = [];
  session.focusSeconds = 0;
  session.startTime = null;
  session.lastActivityAt = 0;

  // notification after session ended
  chrome.notifications.create({
  type: "basic",
  iconUrl: "128.png",   
  title: "Focus Session Complete ✅",
  message: `You stayed focused for ${record.focusedPct}% of your session!`
});
  
}

// toggle button logic
let userMode = "active"; // default

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "toggle_mode") {
    userMode = msg.mode; // "active" or "reading"
    session.inactivityThreshold = (userMode === "reading") ? 90 : 15;
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "notify_mode") {
    const mode = msg.mode;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "48.png",
      title: mode === "active" ? "Active Mode" : "Reading Mode",
      message: mode === "active"
        ? "Strict 15s idle limit – stay hands-on!"
        : "Relaxed 90s idle limit – perfect for reading.",
      priority: 0
    });
  }
});

// this is for checking the achievements
function checkAchievements(record) {
  chrome.storage.local.get({ achievements: {}, sessions: [] }, (res) => {
    const achievements = res.achievements || {};
    const sessions = res.sessions || [];

    // First session
    if (sessions.length >= 1 && !achievements.firstSession) {
      achievements.firstSession = true;
    }

    // 5 sessions
    if (sessions.length >= 5 && !achievements.fiveSessions) {
      achievements.fiveSessions = true;
    }

    // 10 hours focused (36000 seconds)
    const totalFocused = sessions.reduce((sum, s) => sum + (s.focusedSeconds || 0), 0);
    if (totalFocused >= 36000 && !achievements.tenHours) {
      achievements.tenHours = true;
    }

    // 5-day streak
    const streakKeys = Object.keys(res.streaks || {});
    const streakCount = streakKeys.length;
    if (streakCount >= 5 && !achievements.fiveDayStreak) {
      achievements.fiveDayStreak = true;
    }

    chrome.storage.local.set({ achievements });
  });
}




// Handle messages from popup / content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "start_focus") {
    const dur = parseInt(msg.duration) || 1500;
    startSession(dur);
    sendResponse({ status: "started" });
  } else if (msg.type === "stop_focus") {
    stopSession();
    sendResponse({ status: "stopped" });
  } else if (msg.type === "get_status") {
    sendResponse({
      type: "update_time",
      time: formatTimeSec(session.elapsed),
      active: session.running ? (session.focusLog.length ? session.focusLog[session.focusLog.length-1].state === "focused" : true) : false,
      running: session.running,
      elapsed: session.elapsed,
      duration: session.duration
    });
  } else if (msg.type === "user_activity") {
    // content_script pings active user activity
    session.lastActivityAt = msg.time || Date.now();
    // optional: wake the session if previously idle (we still continue)
    session.notifiedIdle = false; // reset so future idle can notify again
  }
  // return true to indicate async response if needed
});

// On install: initialize storage defaults
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["sessions", "points", "streaks"], (res) => {
    if (!res.sessions) chrome.storage.local.set({ sessions: [] });
    if (typeof res.points === "undefined") chrome.storage.local.set({ points: 0 });
    if (!res.streaks) chrome.storage.local.set({ streaks: {} });
  });
});
