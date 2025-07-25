chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "focus_complete") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "128.png",
      title: "Lizard Focus Tracker",
      message: "Great job! You've completed your session. Take a break!"
    });
  }
});
