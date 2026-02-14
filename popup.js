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
  const recentList = document.getElementById("recentList");
  const projectsList = document.getElementById("projectsList");
  const projectsEmpty = document.getElementById("projectsEmpty");
  const pinnedList = document.getElementById("pinnedList");
  const pinnedEmpty = document.getElementById("pinnedEmpty");
  const allSection = document.getElementById("allSection");
  const tabsContainer = document.querySelector(".tabs");

  let allConversations = [];
  let pinnedIds = new Set();

  // Tab switching
  tabsContainer.addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    const target = tab.dataset.tab;

    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    document.getElementById(`tab-${target}`).classList.add("active");
  });

  function loadAll() {
    loadPinnedIds().then(() => {
      loadRecentChats();
      loadProjects();
      loadPinnedChats();
      loadConversations();
    });
  }

  // Load pinned IDs first
  function loadPinnedIds() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_PINNED_IDS" }, (response) => {
        if (response && response.success) {
          pinnedIds = new Set(response.ids);
        }
        resolve();
      });
    });
  }

  // Load 5 most recent chats
  function loadRecentChats() {
    chrome.runtime.sendMessage(
      { type: "GET_RECENT_CONVERSATIONS", limit: 5 },
      (response) => {
        if (response && response.success) {
          renderRecentChats(response.conversations);
        }
      },
    );
  }

  function renderRecentChats(conversations) {
    recentList.innerHTML = "";

    if (conversations.length === 0) {
      recentList.innerHTML = '<p class="empty-hint">No recent chats yet</p>';
      return;
    }

    conversations.forEach((conv) => {
      recentList.appendChild(createChatItem(conv, true));
    });
  }

  // Load pinned chats
  function loadPinnedChats() {
    chrome.runtime.sendMessage(
      { type: "GET_PINNED_CONVERSATIONS" },
      (response) => {
        if (response && response.success && response.conversations.length > 0) {
          pinnedEmpty.style.display = "none";
          pinnedList.innerHTML = "";
          response.conversations.forEach((conv) => {
            pinnedList.appendChild(createChatItem(conv, true));
          });
        } else {
          pinnedList.innerHTML = "";
          pinnedEmpty.style.display = "block";
        }
      },
    );
  }

  // Create a chat item (used for recent, pinned, etc.)
  function createChatItem(conv, showPin) {
    const item = document.createElement("div");
    item.className = "recent-item";

    const isPinned = pinnedIds.has(conv.id);

    item.innerHTML = `
      <a class="recent-item-link" href="${conv.url || "https://chatgpt.com/c/" + conv.id}" target="_blank" rel="noopener">
        <div class="recent-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div class="recent-info">
          <span class="recent-title">${escapeHtml(conv.title)}</span>
          <span class="recent-meta">${conv.messageCount || 0} msgs &middot; ${formatDate(conv.lastUpdated)}</span>
        </div>
        <div class="recent-arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </div>
      </a>
      ${
        showPin
          ? `<button class="btn-pin ${isPinned ? "pinned" : ""}" data-id="${conv.id}" title="${isPinned ? "Unpin" : "Pin"}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${isPinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 17v5"/>
          <path d="M9 11V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7"/>
          <path d="M5 17h14"/>
          <path d="M7 11l-2 6h14l-2-6"/>
        </svg>
      </button>`
          : ""
      }
    `;

    // Pin/unpin handler
    const pinBtn = item.querySelector(".btn-pin");
    if (pinBtn) {
      pinBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = pinBtn.dataset.id;
        const action = pinnedIds.has(id)
          ? "UNPIN_CONVERSATION"
          : "PIN_CONVERSATION";
        chrome.runtime.sendMessage({ type: action, id }, () => {
          if (action === "PIN_CONVERSATION") {
            pinnedIds.add(id);
          } else {
            pinnedIds.delete(id);
          }
          loadRecentChats();
          loadPinnedChats();
          renderList(allConversations);
        });
      });
    }

    return item;
  }

  // Load projects/folders
  function loadProjects() {
    chrome.runtime.sendMessage({ type: "GET_PROJECTS" }, (response) => {
      if (response && response.success && response.projects.length > 0) {
        projectsEmpty.style.display = "none";
        renderProjects(response.projects);
      } else {
        projectsList.innerHTML = "";
        projectsEmpty.style.display = "block";
      }
    });
  }

  function renderProjects(projects) {
    projectsList.innerHTML = "";

    projects.forEach((proj) => {
      const item = document.createElement("a");
      item.className = "project-item";
      if (proj.url) {
        item.href = proj.url;
        item.target = "_blank";
        item.rel = "noopener";
      }

      const iconSvg =
        proj.type === "folder"
          ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
          : proj.type === "gpt"
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';

      const typeLabel =
        proj.type === "folder"
          ? "Folder"
          : proj.type === "gpt"
            ? "GPT"
            : "Project";

      item.innerHTML = `
        <div class="project-icon">${iconSvg}</div>
        <div class="project-info">
          <span class="project-title">${escapeHtml(proj.title)}</span>
          <span class="project-type">${typeLabel}</span>
        </div>
        ${
          proj.url
            ? `<div class="recent-arrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </div>`
            : ""
        }
      `;
      projectsList.appendChild(item);
    });
  }

  // Load all conversations (sorted newest first)
  function loadConversations() {
    chrome.runtime.sendMessage(
      { type: "GET_ALL_CONVERSATIONS" },
      (response) => {
        if (response && response.success) {
          // Sort newest to oldest
          allConversations = response.conversations.sort(
            (a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated),
          );
          stats.textContent = `${allConversations.length} conversation${allConversations.length !== 1 ? "s" : ""} saved`;
          renderList(allConversations);
        }
      },
    );
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
      const isPinned = pinnedIds.has(conv.id);

      item.innerHTML = `
        <div class="conv-header">
          <span class="conv-title">${escapeHtml(conv.title)}</span>
          <div class="conv-actions">
            <button class="btn-icon pin-btn ${isPinned ? "pinned" : ""}" data-id="${conv.id}" title="${isPinned ? "Unpin" : "Pin"}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="${isPinned ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 17v5"/>
                <path d="M9 11V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v7"/>
                <path d="M5 17h14"/>
                <path d="M7 11l-2 6h14l-2-6"/>
              </svg>
            </button>
            <a class="btn-icon open-btn" href="${conv.url || "https://chatgpt.com/c/" + conv.id}" target="_blank" rel="noopener" title="Open in ChatGPT">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
            <button class="btn-icon delete-btn" data-id="${conv.id}" title="Delete">&times;</button>
          </div>
        </div>
        <div class="conv-meta">
          <span>${conv.messageCount || 0} messages</span>
          <span>${formatDate(conv.lastUpdated)}</span>
        </div>
      `;

      // Click on row opens detail view
      item.addEventListener("click", (e) => {
        if (
          e.target.closest(".delete-btn") ||
          e.target.closest(".open-btn") ||
          e.target.closest(".pin-btn")
        )
          return;
        openDetail(conv);
      });

      // Pin button
      const pinBtn = item.querySelector(".pin-btn");
      pinBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = pinBtn.dataset.id;
        const action = pinnedIds.has(id)
          ? "UNPIN_CONVERSATION"
          : "PIN_CONVERSATION";
        chrome.runtime.sendMessage({ type: action, id }, () => {
          if (action === "PIN_CONVERSATION") {
            pinnedIds.add(id);
          } else {
            pinnedIds.delete(id);
          }
          loadPinnedChats();
          renderList(allConversations);
        });
      });

      const deleteBtn = item.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${conv.title}"?`)) {
          chrome.runtime.sendMessage(
            { type: "DELETE_CONVERSATION", id: conv.id },
            () => {
              loadAll();
            },
          );
        }
      });

      const openBtn = item.querySelector(".open-btn");
      openBtn.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      conversationList.appendChild(item);
    });
  }

  function openDetail(conv) {
    chrome.storage.local.get(`chat_${conv.id}`, (result) => {
      const full = result[`chat_${conv.id}`];
      if (!full) return;

      // Hide main sections
      document
        .querySelectorAll(".section, .divider, .tabs, .tab-content")
        .forEach((el) => (el.style.display = "none"));
      document.querySelector("header").style.display = "none";
      detailView.style.display = "block";

      detailTitle.textContent = full.title;
      detailMeta.innerHTML = `${full.messageCount || 0} messages &middot; Last updated ${formatDate(full.lastUpdated)} &middot; <a href="${full.url}" target="_blank">Open in ChatGPT</a>`;

      detailMessages.innerHTML = "";
      if (full.messages && full.messages.length > 0) {
        full.messages.forEach((msg) => {
          const msgEl = document.createElement("div");
          msgEl.className = `message message-${msg.role}`;
          msgEl.innerHTML = `
            <div class="message-role">${msg.role === "user" ? "You" : "ChatGPT"}</div>
            <div class="message-content">${escapeHtml(msg.content)}</div>
          `;
          detailMessages.appendChild(msgEl);
        });
      } else {
        detailMessages.innerHTML =
          '<p class="empty-hint">No messages captured yet. Open this chat in ChatGPT to capture its content.</p>';
      }
    });
  }

  backBtn.addEventListener("click", () => {
    detailView.style.display = "none";
    document.querySelector("header").style.display = "block";
    document.querySelector(".tabs").style.display = "flex";
    document.querySelector(".divider").style.display = "block";
    document.getElementById("allSection").style.display = "block";

    // Restore active tab content
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    const activeTab = document.querySelector(".tab.active");
    if (activeTab) {
      document
        .getElementById(`tab-${activeTab.dataset.tab}`)
        .classList.add("active");
    }
    document.querySelectorAll(".tab-content").forEach((c) => {
      c.style.display = "";
    });
  });

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase();
    if (!query) {
      renderList(allConversations);
      return;
    }
    const filtered = allConversations.filter((c) =>
      c.title.toLowerCase().includes(query),
    );
    renderList(filtered);
  });

  exportBtn.addEventListener("click", () => {
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
    if (
      confirm(
        "Are you sure you want to delete ALL saved conversations? This cannot be undone.",
      )
    ) {
      chrome.runtime.sendMessage({ type: "CLEAR_ALL" }, () => {
        loadAll();
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

  loadAll();
});
