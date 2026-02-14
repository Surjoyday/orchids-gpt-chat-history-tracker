// Content script that runs on ChatGPT pages
// Captures conversations and sends them to the background worker for storage

(function () {
  "use strict";

  const SAVE_INTERVAL = 5000; // Check every 5 seconds
  let lastSavedContent = "";

  function getConversationId() {
    const url = window.location.pathname;
    const match = url.match(/\/c\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  }

  function getConversationTitle() {
    // Try to get title from the active nav item
    const activeNav = document.querySelector("nav a.bg-token-sidebar-surface-secondary");
    if (activeNav) {
      const titleEl = activeNav.querySelector("div");
      if (titleEl) return titleEl.textContent.trim();
    }
    // Fallback: page title
    const title = document.title.replace(" | ChatGPT", "").replace("ChatGPT", "").trim();
    return title || "Untitled Chat";
  }

  function parseMessages() {
    const messages = [];
    // ChatGPT renders messages in article-like containers
    const messageEls = document.querySelectorAll('[data-message-author-role]');

    messageEls.forEach((el) => {
      const role = el.getAttribute("data-message-author-role");
      const contentEl = el.querySelector(".markdown, .whitespace-pre-wrap");
      const text = contentEl ? contentEl.innerText.trim() : el.innerText.trim();

      if (text) {
        messages.push({
          role: role || "unknown",
          content: text,
        });
      }
    });

    return messages;
  }

  function saveConversation() {
    const conversationId = getConversationId();
    if (!conversationId) return;

    const messages = parseMessages();
    if (messages.length === 0) return;

    const contentHash = JSON.stringify(messages);
    if (contentHash === lastSavedContent) return;
    lastSavedContent = contentHash;

    const conversation = {
      id: conversationId,
      title: getConversationTitle(),
      url: window.location.href,
      messages: messages,
      messageCount: messages.length,
      lastUpdated: new Date().toISOString(),
      firstSaved: null, // Will be set by background if new
    };

    chrome.runtime.sendMessage(
      { type: "SAVE_CONVERSATION", conversation },
      (response) => {
        if (chrome.runtime.lastError) {
          console.debug("[GPT Tracker] Save error:", chrome.runtime.lastError.message);
        }
      }
    );
  }

  // Monitor for URL changes (SPA navigation)
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      lastSavedContent = "";
      // Wait for new page to render
      setTimeout(saveConversation, 2000);
    }
  });

  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Periodic save
  setInterval(saveConversation, SAVE_INTERVAL);

  // Initial save after page loads
  setTimeout(saveConversation, 3000);

  console.debug("[GPT Tracker] Content script loaded");
})();
