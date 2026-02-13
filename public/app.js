(function () {
  const POLL_INTERVAL_MS = 3000;
  const API_BASE = '';

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function isValidEmail(s) {
    return typeof s === 'string' && EMAIL_REGEX.test(s.trim());
  }

  function getConversationId(email1, email2) {
    const a = (email1 || '').trim().toLowerCase();
    const b = (email2 || '').trim().toLowerCase();
    if (!a || !b) return '';
    return [a, b].sort().join('__');
  }

  function getOtherParticipant(conversationId, myEmail) {
    const parts = (conversationId || '').split('__');
    if (parts.length !== 2) return conversationId || '';
    const me = (myEmail || '').trim().toLowerCase();
    return parts[0] === me ? parts[1] : parts[0];
  }

  let state = {
    userEmail: '',
    conversations: [],
    activeConversation: null,
    lastSeenByConv: {},
    pollTimerId: null,
  };

  const loginScreen = document.getElementById('login-screen');
  const chatScreen = document.getElementById('chat-screen');
  const loginForm = document.getElementById('login-form');
  const userInput = document.getElementById('user');
  const sidebarAvatar = document.getElementById('sidebar-avatar');
  const sidebarUsername = document.getElementById('sidebar-username');
  const newChatBtn = document.getElementById('new-chat-btn');
  const conversationList = document.getElementById('conversation-list');
  const conversationListEmpty = document.getElementById('conversation-list-empty');
  const noChatSelected = document.getElementById('no-chat-selected');
  const chatPanel = document.getElementById('chat-panel');
  const chatHeader = document.getElementById('chat-header');
  const chatTitle = document.getElementById('chat-title');
  const chatSubtitle = document.getElementById('chat-subtitle');
  const chatAvatar = document.getElementById('chat-avatar');
  const messageList = document.getElementById('message-list');
  const sendForm = document.getElementById('send-form');
  const messageInput = document.getElementById('message-input');
  const newChatModal = document.getElementById('new-chat-modal');
  const newChatForm = document.getElementById('new-chat-form');
  const newChatInput = document.getElementById('new-chat-input');
  const newChatCancel = document.getElementById('new-chat-cancel');
  const loginErrorEl = document.getElementById('login-error');
  const newChatErrorEl = document.getElementById('new-chat-error');

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function avatarLetter(emailOrName) {
    const s = (emailOrName || '?').trim();
    const at = s.indexOf('@');
    if (at > 0) return s.charAt(0).toUpperCase();
    return s.charAt(0).toUpperCase();
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function showChat() {
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    sidebarUsername.textContent = state.userEmail;
    sidebarAvatar.textContent = avatarLetter(state.userEmail);
    refreshConversationList();
  }

  function refreshConversationList() {
    const url = API_BASE + '/api/conversations?from=' + encodeURIComponent(state.userEmail);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load conversations');
        return res.json();
      })
      .then((data) => {
        state.conversations = data.conversations || [];
        if (state.activeConversation) {
          const exists = state.conversations.some((c) => c.conversation === state.activeConversation);
          if (!exists) {
            state.conversations.unshift({
              conversation: state.activeConversation,
              otherParticipant: getOtherParticipant(state.activeConversation, state.userEmail),
              lastMessage: '',
              lastTimestamp: Date.now(),
            });
          }
        }
        renderConversationList();
      })
      .catch((err) => {
        console.error(err);
        state.conversations = [];
        renderConversationList();
      });
  }

  function ensureConversationInList(convId, otherParticipant) {
    const other = otherParticipant != null ? otherParticipant : getOtherParticipant(convId, state.userEmail);
    if (state.conversations.some((c) => c.conversation === convId)) return;
    state.conversations.unshift({
      conversation: convId,
      otherParticipant: other,
      lastMessage: '',
      lastTimestamp: Date.now(),
    });
    renderConversationList();
  }

  function renderConversationList() {
    const activeId = state.activeConversation;
    const list = state.conversations;
    conversationListEmpty.classList.toggle('hidden', list.length > 0);
    conversationList.innerHTML = '';
    list.forEach((c) => {
      const li = document.createElement('li');
      li.className = 'conv-item' + (c.conversation === activeId ? ' active' : '');
      li.dataset.conversation = c.conversation;
      const displayName = c.otherParticipant != null ? c.otherParticipant : getOtherParticipant(c.conversation, state.userEmail);
      const preview = (c.lastMessage || 'No messages yet').substring(0, 40);
      li.innerHTML =
        '<span class="avatar small">' +
        escapeHtml(avatarLetter(displayName)) +
        '</span>' +
        '<div class="conv-body">' +
        '<span class="conv-name">' +
        escapeHtml(displayName) +
        '</span>' +
        '<span class="conv-preview">' +
        escapeHtml(preview) +
        (c.lastMessage && c.lastMessage.length > 40 ? '…' : '') +
        '</span>' +
        '</div>' +
        '<span class="conv-time">' +
        (c.lastTimestamp ? formatTime(c.lastTimestamp) : '') +
        '</span>';
      li.addEventListener('click', () => selectConversation(c.conversation));
      conversationList.appendChild(li);
    });
  }

  function selectConversation(convId) {
    state.activeConversation = convId;
    const otherParticipant = getOtherParticipant(convId, state.userEmail);
    ensureConversationInList(convId, otherParticipant);
    renderConversationList();

    noChatSelected.classList.add('hidden');
    chatPanel.classList.remove('hidden');
    chatTitle.textContent = otherParticipant;
    chatSubtitle.textContent = 'Chat';
    chatAvatar.textContent = avatarLetter(otherParticipant);

    messageList.innerHTML = '';
    state.lastSeenByConv[convId] = state.lastSeenByConv[convId] || 0;
    loadMessagesFor(convId);
    startPolling();
  }

  function loadMessagesFor(convId) {
    const url =
      API_BASE +
      '/api/messages?conversation=' +
      encodeURIComponent(convId) +
      '&limit=50';
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load messages');
        return res.json();
      })
      .then((data) => {
        const list = data.messages || [];
        messageList.innerHTML = '';
        list.forEach((msg) => {
          appendMessage(msg, msg.from === state.userEmail);
          if (msg.timestamp > (state.lastSeenByConv[convId] || 0)) {
            state.lastSeenByConv[convId] = msg.timestamp;
          }
        });
        messageList.scrollTop = messageList.scrollHeight;
      })
      .catch((err) => {
        console.error(err);
        alert('Could not load messages.');
      });
  }

  function appendMessage(msg, isOwn) {
    const li = document.createElement('li');
    li.className = 'msg ' + (isOwn ? 'own' : 'other');
    li.dataset.id = msg.id;
    li.innerHTML =
      '<span class="msg-sender">' +
      escapeHtml(msg.from) +
      '</span>' +
      '<span class="msg-text">' +
      escapeHtml(msg.text) +
      '</span>' +
      '<span class="msg-time">' +
      formatTime(msg.timestamp) +
      '</span>';
    messageList.appendChild(li);
    messageList.scrollTop = messageList.scrollHeight;
  }

  function poll() {
    const convId = state.activeConversation;
    if (!convId) return;
    const since = state.lastSeenByConv[convId] || 0;
    const url =
      API_BASE +
      '/api/messages?conversation=' +
      encodeURIComponent(convId) +
      '&since=' +
      since;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Poll failed');
        return res.json();
      })
      .then((data) => {
        const list = data.messages || [];
        list.forEach((msg) => {
          if (document.querySelector('#message-list [data-id="' + msg.id + '"]')) return;
          appendMessage(msg, msg.from === state.userEmail);
          if (msg.timestamp > (state.lastSeenByConv[convId] || 0)) {
            state.lastSeenByConv[convId] = msg.timestamp;
          }
        });
        if (list.length > 0) refreshConversationList();
      })
      .catch((err) => {
        console.error('Poll error:', err);
      });
  }

  function startPolling() {
    stopPolling();
    state.pollTimerId = setInterval(poll, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (state.pollTimerId != null) {
      clearInterval(state.pollTimerId);
      state.pollTimerId = null;
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = (userInput.value || '').trim();
    if (loginErrorEl) loginErrorEl.classList.add('hidden');
    if (!email) return;
    if (!isValidEmail(email)) {
      if (loginErrorEl) {
        loginErrorEl.textContent = 'Please enter a valid email address.';
        loginErrorEl.classList.remove('hidden');
      } else {
        alert('Please enter a valid email address.');
      }
      return;
    }
    state.userEmail = email.toLowerCase();
    state.conversations = [];
    state.activeConversation = null;
    state.lastSeenByConv = {};
    showChat();
  });

  conversationList.addEventListener('click', (e) => {
    const li = e.target.closest('.conv-item');
    if (li && li.dataset.conversation) selectConversation(li.dataset.conversation);
  });

  newChatBtn.addEventListener('click', () => {
    newChatModal.classList.remove('hidden');
    newChatInput.value = '';
    if (newChatErrorEl) newChatErrorEl.classList.add('hidden');
    newChatInput.focus();
  });

  newChatCancel.addEventListener('click', () => {
    newChatModal.classList.add('hidden');
  });

  newChatModal.querySelector('.modal-backdrop').addEventListener('click', () => {
    newChatModal.classList.add('hidden');
  });

  newChatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const contactEmail = (newChatInput.value || '').trim();
    if (newChatErrorEl) newChatErrorEl.classList.add('hidden');
    if (!contactEmail) {
      if (newChatErrorEl) {
        newChatErrorEl.textContent = 'Please enter an email address.';
        newChatErrorEl.classList.remove('hidden');
      }
      return;
    }
    if (!isValidEmail(contactEmail)) {
      if (newChatErrorEl) {
        newChatErrorEl.textContent = 'Please enter a valid email address.';
        newChatErrorEl.classList.remove('hidden');
      } else {
        alert('Please enter a valid email address.');
      }
      return;
    }
    const contact = contactEmail.toLowerCase();
    if (contact === state.userEmail) {
      if (newChatErrorEl) {
        newChatErrorEl.textContent = "You can't chat with yourself.";
        newChatErrorEl.classList.remove('hidden');
      } else {
        alert("You can't chat with yourself.");
      }
      return;
    }
    newChatModal.classList.add('hidden');
    const convId = getConversationId(state.userEmail, contact);
    selectConversation(convId);
  });

  sendForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = (messageInput.value || '').trim();
    const convId = state.activeConversation;
    if (!text || !convId) return;

    const body = {
      conversation: convId,
      text: text,
      from: state.userEmail,
    };

    const btn = document.getElementById('send-btn');
    btn.disabled = true;

    fetch(API_BASE + '/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(d));
        return res.json();
      })
      .then((data) => {
        messageInput.value = '';
        const optimistic = {
          id: data.id,
          conversation: convId,
          from: state.userEmail,
          text: text,
          timestamp: data.timestamp,
        };
        appendMessage(optimistic, true);
        if (data.timestamp > (state.lastSeenByConv[convId] || 0)) {
          state.lastSeenByConv[convId] = data.timestamp;
        }
        refreshConversationList();
      })
      .catch((err) => {
        console.error(err);
        alert(err.error || 'Failed to send message');
      })
      .finally(() => {
        btn.disabled = false;
        messageInput.focus();
      });
  });

  if (typeof window !== 'undefined') {
    window.httpChat = { showLogin: () => { chatScreen.classList.add('hidden'); loginScreen.classList.remove('hidden'); stopPolling(); }, stopPolling };
  }
})();
