// Content script that runs on ChatGPT pages
// Captures conversations and sends them to the background worker for storage

(function () {
  "use strict";

  const SAVE_INTERVAL = 5000;
  let lastSavedContent = "";
  let sidebarScraped = false;

  // Safe wrapper for chrome.runtime.sendMessage
  function safeSendMessage(message, callback) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) {
        console.debug("[GPT Tracker] Extension context invalidated, skipping message");
        return;
      }
      chrome.runtime.sendMessage(message, function (response) {
        if (chrome.runtime.lastError) {
          console.debug("[GPT Tracker] Message error:", chrome.runtime.lastError.message);
        } else if (callback) {
          callback(response);
        }
      });
    } catch (e) {
      console.debug("[GPT Tracker] Send failed:", e.message);
    }
  }

  function getConversationId() {
    const url = window.location.pathname;
    const match = url.match(/\/c\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  }

  function getConversationTitle() {
    // Try to get title from the active nav item
    const activeNav = document.querySelector('nav a[class*="bg-"]');
    if (activeNav) {
      const titleEl = activeNav.querySelector("div") || activeNav;
      const text = titleEl.textContent.trim();
      if (text) return text;
    }
    // Fallback: page title
    const title = document.title.replace(" | ChatGPT", "").replace("ChatGPT", "").trim();
    return title || "Untitled Chat";
  }

  function parseMessages() {
    const messages = [];
    const messageEls = document.querySelectorAll("[data-message-author-role]");

    messageEls.forEach(function (el) {
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

    var conversation = {
      id: conversationId,
      title: getConversationTitle(),
      url: window.location.href,
      messages: messages,
      messageCount: messages.length,
      lastUpdated: new Date().toISOString(),
      firstSaved: null,
    };

    safeSendMessage({ type: "SAVE_CONVERSATION", conversation: conversation });
  }

  // Scrape sidebar to get list of all visible conversations
  function scrapeSidebar() {
    var sidebarLinks = document.querySelectorAll('nav a[href^="/c/"]');
    if (sidebarLinks.length === 0) return;

    var conversations = [];
    sidebarLinks.forEach(function (link) {
      var href = link.getAttribute("href");
      var match = href.match(/\/c\/([a-zA-Z0-9-]+)/);
      if (!match) return;

      var id = match[1];
      var titleEl = link.querySelector("div") || link;
      var title = titleEl.textContent.trim() || "Untitled Chat";

      conversations.push({
        id: id,
        title: title,
        url: "https://chatgpt.com" + href,
        messages: [],
        messageCount: 0,
        lastUpdated: new Date().toISOString(),
        firstSaved: null,
        fromSidebar: true,
      });
    });

    if (conversations.length > 0) {
      safeSendMessage(
        { type: "SAVE_SIDEBAR_CONVERSATIONS", conversations: conversations },
        function (response) {
          console.debug("[GPT Tracker] Saved " + conversations.length + " sidebar conversations");
        }
      );
    }
  }

  // Watch for sidebar to load / update
  function waitForSidebar() {
    var check = function () {
      var sidebarLinks = document.querySelectorAll('nav a[href^="/c/"]');
      if (sidebarLinks.length > 0) {
        scrapeSidebar();
        sidebarScraped = true;
      }
    };

    // Try immediately
    check();

    // Also observe DOM for sidebar rendering
    var observer = new MutationObserver(function () {
      check();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Stop observing after 30 seconds to save resources
    setTimeout(function () { observer.disconnect(); }, 30000);

    // Re-scrape sidebar every 30 seconds
    setInterval(scrapeSidebar, 30000);
  }

  // Monitor for URL changes (SPA navigation)
  var currentUrl = window.location.href;
  var urlObserver = new MutationObserver(function () {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      lastSavedContent = "";
      setTimeout(saveConversation, 2000);
      setTimeout(scrapeSidebar, 3000);
    }
  });

  urlObserver.observe(document.body, { childList: true, subtree: true });

  // Periodic save of current conversation
  setInterval(saveConversation, SAVE_INTERVAL);

  // Initial save after page loads
  setTimeout(saveConversation, 3000);

  // Start sidebar scraping
  waitForSidebar();

  console.debug("[GPT Tracker] Content script loaded");
})();
