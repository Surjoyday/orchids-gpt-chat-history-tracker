document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const conversationList = document.getElementById("conversationList");
  const emptyState = document.getElementById("emptyState");
  const detailView = document.getElementById("detailView");
  const stats = document.getElementById("stats");
  const exportBtn = document.getElementById("exportBtn");
  const clearBtn = document.getElementById("clearBtn");
  const backBtn = document.getElementById("backBtn");
  const detailTitle = document.getElementById("detailTitle");
  const detailMeta = document.getElementById("detailMeta");
  const detailMessages = document.getElementById("detailMessages");

  let allConversations = [];

  function loadConversations() {
    chrome.runtime.sendMessage({ type: "GET_ALL_CONVERSATIONS" }, (response) => {
      if (response && response.success) {
        allConversations = response.conversations;
        stats.textContent = `${allConversations.length} conversation${allConversations.length !== 1 ? "s" : ""} saved`;
        renderList(allConversations);
      }
    });
  }

  function renderList(conversations) {
    conversationList.innerHTML = "";

    if (conversations.length === 0) {
      conversationList.style.display = "none";
      emptyState.style.display = "block";
      return;
    }

    conversationList.style.display = "block";
    emptyState.style.display = "none";

    conversations.forEach((conv) => {
      const item = document.createElement("div");
      item.className = "conversation-item";
      item.innerHTML = `
        <div class="conv-header">
          <span class="conv-title">${escapeHtml(conv.title)}</span>
          <button class="btn-icon delete-btn" data-id="${conv.id}" title="Delete">&times;</button>
        </div>
        <div class="conv-meta">
          <span>${conv.messageCount} messages</span>
          <span>${formatDate(conv.lastUpdated)}</span>
        </div>
      `;

      item.addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-btn")) return;
        openDetail(conv);
      });

      const deleteBtn = item.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${conv.title}"?`)) {
          chrome.runtime.sendMessage({ type: "DELETE_CONVERSATION", id: conv.id }, () => {
            loadConversations();
          });
        }
      });

      conversationList.appendChild(item);
    });
  }

  function openDetail(conv) {
    // Fetch full conversation data
    chrome.storage.local.get(`chat_${conv.id}`, (result) => {
      const full = result[`chat_${conv.id}`];
      if (!full) return;

      conversationList.style.display = "none";
      document.querySelector(".search-bar").style.display = "none";
      document.querySelector(".actions").style.display = "none";
      document.querySelector("header").style.display = "none";
      detailView.style.display = "block";

      detailTitle.textContent = full.title;
      detailMeta.innerHTML = `${full.messageCount} messages &middot; Last updated ${formatDate(full.lastUpdated)} &middot; <a href="${full.url}" target="_blank">Open in ChatGPT</a>`;

      detailMessages.innerHTML = "";
      full.messages.forEach((msg) => {
        const msgEl = document.createElement("div");
        msgEl.className = `message message-${msg.role}`;
        msgEl.innerHTML = `
          <div class="message-role">${msg.role === "user" ? "You" : "ChatGPT"}</div>
          <div class="message-content">${escapeHtml(msg.content)}</div>
        `;
        detailMessages.appendChild(msgEl);
      });
    });
  }

  backBtn.addEventListener("click", () => {
    detailView.style.display = "none";
    conversationList.style.display = "block";
    document.querySelector(".search-bar").style.display = "block";
    document.querySelector(".actions").style.display = "flex";
    document.querySelector("header").style.display = "block";
  });

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    if (!query) {
      renderList(allConversations);
      return;
    }
    const filtered = allConversations.filter(
      (c) => c.title.toLowerCase().includes(query)
    );
    renderList(filtered);
  });

  exportBtn.addEventListener("click", () => {
    // Get all full conversation data
    chrome.storage.local.get(null, (allData) => {
      const conversations = {};
      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith("chat_") && key !== "chat_index") {
          conversations[key] = value;
        }
      }

      const blob = new Blob([JSON.stringify(conversations, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chatgpt-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  clearBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete ALL saved conversations? This cannot be undone.")) {
      chrome.runtime.sendMessage({ type: "CLEAR_ALL" }, () => {
        loadConversations();
      });
    }
  });

  function formatDate(isoString) {
    if (!isoString) return "Unknown";
    const d = new Date(isoString);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  loadConversations();
});
