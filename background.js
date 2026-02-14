// Background service worker
// Handles saving/retrieving conversations and projects from chrome.storage.local

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SAVE_CONVERSATION") {
    saveConversation(message.conversation).then(sendResponse);
    return true;
  }

  if (message.type === "GET_ALL_CONVERSATIONS") {
    getAllConversations().then(sendResponse);
    return true;
  }

  if (message.type === "GET_RECENT_CONVERSATIONS") {
    getRecentConversations(message.limit || 5).then(sendResponse);
    return true;
  }

  if (message.type === "DELETE_CONVERSATION") {
    deleteConversation(message.id).then(sendResponse);
    return true;
  }

  if (message.type === "EXPORT_ALL") {
    getAllConversations().then(sendResponse);
    return true;
  }

  if (message.type === "CLEAR_ALL") {
    chrome.storage.local.clear().then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === "SAVE_SIDEBAR_CONVERSATIONS") {
    saveSidebarConversations(message.conversations).then(sendResponse);
    return true;
  }

  if (message.type === "SAVE_PROJECTS") {
    saveProjects(message.projects).then(sendResponse);
    return true;
  }

  if (message.type === "GET_PROJECTS") {
    getProjects().then(sendResponse);
    return true;
  }
});

async function saveConversation(conversation) {
  try {
    const key = `chat_${conversation.id}`;
    const result = await chrome.storage.local.get(key);
    const existing = result[key];

    if (existing) {
      conversation.firstSaved = existing.firstSaved;
    } else {
      conversation.firstSaved = new Date().toISOString();
    }

    await chrome.storage.local.set({ [key]: conversation });

    const indexResult = await chrome.storage.local.get("chat_index");
    const index = indexResult.chat_index || [];
    const existingIdx = index.findIndex((item) => item.id === conversation.id);

    const indexEntry = {
      id: conversation.id,
      title: conversation.title,
      messageCount: conversation.messageCount,
      lastUpdated: conversation.lastUpdated,
      firstSaved: conversation.firstSaved,
      url: conversation.url,
    };

    if (existingIdx >= 0) {
      index[existingIdx] = indexEntry;
    } else {
      index.unshift(indexEntry);
    }

    await chrome.storage.local.set({ chat_index: index });
    return { success: true };
  } catch (err) {
    console.error("[GPT Tracker] Save error:", err);
    return { success: false, error: err.message };
  }
}

async function getAllConversations() {
  try {
    const result = await chrome.storage.local.get("chat_index");
    const index = result.chat_index || [];
    index.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    return { success: true, conversations: index };
  } catch (err) {
    return { success: false, conversations: [], error: err.message };
  }
}

async function getRecentConversations(limit) {
  try {
    const result = await chrome.storage.local.get("chat_index");
    const index = result.chat_index || [];
    index.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    return { success: true, conversations: index.slice(0, limit) };
  } catch (err) {
    return { success: false, conversations: [], error: err.message };
  }
}

async function saveSidebarConversations(conversations) {
  try {
    const indexResult = await chrome.storage.local.get("chat_index");
    const index = indexResult.chat_index || [];
    const existingIds = new Set(index.map((item) => item.id));
    let added = 0;

    for (const conv of conversations) {
      if (existingIds.has(conv.id)) continue;

      const key = `chat_${conv.id}`;
      conv.firstSaved = new Date().toISOString();
      await chrome.storage.local.set({ [key]: conv });

      index.unshift({
        id: conv.id,
        title: conv.title,
        messageCount: conv.messageCount || 0,
        lastUpdated: conv.lastUpdated,
        firstSaved: conv.firstSaved,
        url: conv.url,
      });

      existingIds.add(conv.id);
      added++;
    }

    if (added > 0) {
      await chrome.storage.local.set({ chat_index: index });
    }

    return { success: true, added };
  } catch (err) {
    console.error("[GPT Tracker] Sidebar save error:", err);
    return { success: false, error: err.message };
  }
}

async function saveProjects(projects) {
  try {
    const result = await chrome.storage.local.get("project_index");
    const existing = result.project_index || [];
    const existingIds = new Set(existing.map((p) => p.id));

    for (const proj of projects) {
      const idx = existing.findIndex((p) => p.id === proj.id);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...proj, lastSeen: new Date().toISOString() };
      } else {
        existing.push({ ...proj, firstSaved: new Date().toISOString(), lastSeen: new Date().toISOString() });
      }
    }

    await chrome.storage.local.set({ project_index: existing });
    return { success: true };
  } catch (err) {
    console.error("[GPT Tracker] Project save error:", err);
    return { success: false, error: err.message };
  }
}

async function getProjects() {
  try {
    const result = await chrome.storage.local.get("project_index");
    const projects = result.project_index || [];
    return { success: true, projects };
  } catch (err) {
    return { success: false, projects: [], error: err.message };
  }
}

async function deleteConversation(id) {
  try {
    const key = `chat_${id}`;
    await chrome.storage.local.remove(key);

    const indexResult = await chrome.storage.local.get("chat_index");
    const index = (indexResult.chat_index || []).filter((item) => item.id !== id);
    await chrome.storage.local.set({ chat_index: index });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
