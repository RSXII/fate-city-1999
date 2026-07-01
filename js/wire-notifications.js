// ── Wire Notifications — unread badge + toast, polls Firebase ────────────────
// Requires the page to contain:
//   #wire-unread-dot   (the badge element)
//   #wire-toast        (the toast wrapper)
//   #wire-toast-text   (text node inside the toast)
// If any element is absent the function exits silently (safe on pages without
// the notification chrome).

import { dbGet } from "./firebase-db.js";

var LAST_SEEN_MAP_KEY = "wire-last-seen-map";

function getLastSeenMap() {
  try {
    var raw = localStorage.getItem(LAST_SEEN_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function startNotifications() {
  var dot = document.getElementById("wire-unread-dot");
  var toast = document.getElementById("wire-toast");
  var toastText = document.getElementById("wire-toast-text");
  if (!dot || !toast || !toastText) return;

  var toastTimer = null;
  var lastUnreadCount = 0;
  var isFirstPoll = true;

  function showToast(n) {
    toastText.textContent = n === 1 ? "New message" : n + " new messages";
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 4000);
  }

  async function pollUnread() {
    try {
      var data = await dbGet("messages");
      var lastSeenMap = getLastSeenMap();
      var unread = 0;
      if (data) {
        Object.keys(data).forEach(function (k) {
          var m = data[k];
          if (!m) return;
          var seen = lastSeenMap[m.sender] || 0;
          if (m.ts > seen) unread++;
        });
      }
      if (unread > 0) {
        dot.classList.add("show");
        if (!isFirstPoll && unread > lastUnreadCount) {
          showToast(unread - lastUnreadCount);
        }
      } else {
        dot.classList.remove("show");
      }
      lastUnreadCount = unread;
      isFirstPoll = false;
    } catch (e) {
      // network hiccup — retry next interval
    }
  }

  pollUnread();
  setInterval(pollUnread, 5000);
}
