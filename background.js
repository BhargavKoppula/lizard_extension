chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "focus_complete") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "128.png",
      title: "Lizard Focus Tracker",
      message: "Great job! You've focused for 25 minutes. Take a break!"
    });
  }
});
