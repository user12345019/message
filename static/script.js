document.addEventListener("DOMContentLoaded", () => {

  let notificationCounts = {};
  const root = document.documentElement;
  const msgs = document.getElementById("messages");
  const currentUserId = window.currentUserId || null;
  const otherUserId = window.otherUserId || null;

  let shouldScroll = true;

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.innerText = text;
    return div.innerHTML;
  }

  function isNearBottom() {
    return msgs.scrollHeight - msgs.scrollTop <= msgs.clientHeight + 100;
  }

  const socket = io({
    transports: ["websocket", "polling"],
  });
  socket.on("connect", () => {
    if (currentUserId) {
      socket.emit("join", {
        user_id: currentUserId,
      });
    }
  });

  function toggleAway() {
    root.classList.toggle("away");
  }

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "i") {
      event.preventDefault();
      toggleAway();
    }
  });

  const profileButton = document.getElementById("profileButton");
  const profileMenu = document.getElementById("profileMenu");
  document.addEventListener("click", (e) => {
    if (
      profileMenu &&
      !profileMenu.contains(e.target) &&
      e.target !== profileButton
    ) {
      profileMenu.classList.remove("open");
    }
  });

  document.addEventListener("click", () => {
    if (profileMenu) profileMenu.classList.remove("open");
  });

  const notificationButton = document.getElementById("notificationButton");
  const notificationMenu = document.getElementById("notificationMenu");
  const notificationBadge = document.getElementById("badge");
  const notificationStatus = document.getElementById("notification-status");
  const notificationsList = document.getElementById("notifications");
  const clearNotifications = document.getElementById("clearNotifications");
  let notificationCount = 0;

  function updateTitleWithNotifications(count) {
    document.title =
      count > 0 ? `Home (${count}) - Google Drive` : `Home - Google Drive`;
  }

  async function fetchNotifications() {
    const res = await fetch("/get_notifications");
    const data = await res.json();
    notificationsList.innerHTML = "";
    data.forEach((notification) => {
      const li = document.createElement("li");
      if (notification.type === "private_message" && notification.data) {
        const a = document.createElement("a");
        a.href = `/private_chat/${notification.data.sender_id}`;
        a.textContent = notification.content;
        li.appendChild(a);
      } else {
        li.textContent = notification.content;
      }
      if (notification.read) {
        li.classList.add("read");
      }
      notificationsList.appendChild(li);
    });
    notificationCount = data.filter((n) => !n.read).length;
    notificationBadge.textContent = notificationCount;
    updateTitleWithNotifications(notificationCount);
    if (notificationCount > 0) {
      notificationBadge.classList.add("visible");
      notificationStatus.textContent = `You have ${notificationCount} new notification${
        notificationCount > 1 ? "s" : ""
      }`;
    } else {
      notificationBadge.classList.remove("visible");
      notificationStatus.textContent = "No notifications";
    }

    const counts = {};
    data.forEach((notification) => {
      if (
        notification.type === "private_message" &&
        notification.data &&
        !notification.read
      ) {
        const senderId = notification.data.sender_id;
        if (senderId) {
          counts[senderId] = (counts[senderId] || 0) + 1;
        }
      }
    });
    notificationCounts = counts;
  }

  if (notificationButton && notificationMenu) {
    notificationButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const opening = !notificationMenu.classList.contains("open");
      notificationMenu.classList.toggle("open");
      if (opening) {
        fetch("/mark_notifications_read", {
          method: "POST",
        }).then(() => {
          fetchNotifications();
        });
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (notificationMenu?.classList.contains("open")) {
      if (!notificationMenu.contains(e.target)) {
        notificationMenu.classList.remove("open");
      }
    }
  });

  if (clearNotifications) {
    clearNotifications.addEventListener("click", () => {
      fetch("/clear_notifications", {
        method: "POST",
      }).then(() => {
        notificationsList.innerHTML = "";
        notificationCount = 0;
        notificationBadge.textContent = "0";
        notificationBadge.classList.remove("visible");
        notificationStatus.textContent = "No notifications";
        notificationCounts = {};
        updateTitleWithNotifications(0);
      });
    });
  }

  setInterval(() => {
    if (!notificationMenu?.classList.contains("open")) {
      fetchNotifications();
    }
  }, 5000);

  fetchNotifications();

  socket.on("new_public_message", (data) => {
    const msgElem = document.createElement("p");
    msgElem.innerHTML = `<strong>${data.username}</strong> (${
      data.timestamp
    }): ${escapeHtml(data.text)}`;
    if (msgs) {
      msgs.appendChild(msgElem);
      if (isNearBottom()) {
        msgs.scrollTop = msgs.scrollHeight;
      }
    }
  });

  function fetchUsersList() {
    fetch("/get_users")
      .then((response) => response.json())
      .then((data) => {
        const usersList = document.getElementById("users")?.querySelector("ul");
        if (!usersList) return;
        usersList.innerHTML = "";
        data.forEach((user) => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = `/private_chat/${user.id}`;
          a.textContent = user.username;
          const count = notificationCounts[user.id] || 0;
          if (count > 0) {
            a.textContent += ` (${count})`;
          }
          li.appendChild(a);
          usersList.appendChild(li);
        });
      });
  }

  if (msgs) {
    msgs.scrollTop = msgs.scrollHeight;
    const observer = new MutationObserver(() => {
      if (shouldScroll && isNearBottom()) {
        msgs.scrollTop = msgs.scrollHeight;
      }
    });
    observer.observe(msgs, {
      childList: true,
    });
    msgs.addEventListener("scroll", () => {
      shouldScroll = isNearBottom();
    });
  }

  const profileBtn = document.getElementById("profileButton");
  const profileMn = document.getElementById("profileMenu");

  if (profileBtn) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileMn.classList.toggle("open");

      if (window.isAdmin && !document.getElementById("adminLink")) {
        const dashboardLi = document.createElement("li");
        const dashboardLink = document.createElement("a");
        dashboardLink.href = "/admin";
        dashboardLink.textContent = "Dashboard";
        dashboardLink.id = "adminLink";
        dashboardLi.appendChild(dashboardLink);
        profileMn.querySelector("ul").prepend(dashboardLi);
      }
    });
  }

  fetchNotifications();
  setInterval(fetchNotifications, 1000);
  fetchUsersList();
  setInterval(fetchUsersList, 1000);
});
