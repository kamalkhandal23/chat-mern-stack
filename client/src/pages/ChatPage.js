// ------------------- ChatPage.jsx (PART 1) -------------------
import React, { useEffect, useState, useRef, useCallback } from 'react';
import API, { setAuthToken } from '../services/api';
import { connectSocket, getSocket } from '../services/socket';
import '../styles.css';

/* helpers */
function initials(name) {
  if (!name) return 'U';
  return name.split(' ')
    .map(s => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getUserIdFromToken() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || payload._id;
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [uploadPreview, setUploadPreview] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // UI state
  const [openRoomMenuId, setOpenRoomMenuId] = useState(null);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState(null);

  const messagesEndRef = useRef(null);
  const fileRef = useRef(null);
  const observerRef = useRef(null);
  const observeRefs = useRef(new Map());
  const socketRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);

  const token = localStorage.getItem('token');
  const userName = localStorage.getItem('userName') || 'You';
  const myUserId = getUserIdFromToken();

  // ---------------- SOCKET CONNECTION ----------------
  useEffect(() => {
    if (!token) return;

    setAuthToken(token);

    if (!getSocket()) socketRef.current = connectSocket(token);
    else socketRef.current = getSocket();

    const s = socketRef.current;
    s.removeAllListeners("message");
    // IMPORTANT: remove old listeners (fixes duplicate listeners)
    s.off('message');
    s.off('typing');
    s.off('message-updated');
    s.off('message-deleted');
    s.off('message-delivered');
    s.off('message-read');

    // FINAL FIX: safe message handler (NO DUPLICATES EVER)
    s.on('message', msg => {
      console.log("📥 CLIENT RECEIVED:", msg._id, "clientId=", msg.clientId);
    
      setMessages(prev => {
        console.log("📦 PREV_LENGTH:", prev.length);
    
        // 0. If server provided clientId and temp exists -> replace it
        if (msg.clientId) {
          const idxTmp = prev.findIndex(m => String(m._id) === String(msg.clientId));
          if (idxTmp !== -1) {
            return prev.map(m => String(m._id) === String(msg.clientId) ? msg : m);
          }
        }
    
        // 1. If message with same _id already exists -> ignore (no duplicate)
        if (prev.some(m => String(m._id) === String(msg._id))) {
          return prev;
        }
    
        // 2. EXTRA SAFEGUARD: sometimes client receives both tmp and server msg but clientId missing.
        //    If an existing message has same sender + text + timestamp very close (within 2s),
        //    treat server msg as the same and replace the tmp OR ignore duplicate append.
        const msgTime = msg.createdAt ? new Date(msg.createdAt).getTime() : null;
        const senderId = (msg.senderId && (msg.senderId._id || msg.senderId)) || null;
        if (msgTime && senderId) {
          const similarIdx = prev.findIndex(m => {
            const mSender = (m.senderId && (m.senderId._id || m.senderId)) || null;
            const mTime = m.createdAt ? new Date(m.createdAt).getTime() : null;
            return mSender && mSender === senderId &&
                   m.text === msg.text &&
                   mTime && Math.abs(mTime - msgTime) <= 2000;
          });
          if (similarIdx !== -1) {
            // If found similar temp message, replace it
            return prev.map((m, i) => i === similarIdx ? msg : m);
          }
        }
    
        // 3. otherwise append normally
        return [...prev, msg];
      });
    
      // mark delivered if not my msg
      const sender = msg.senderId?._id || msg.senderId;
      if (String(sender) !== String(myUserId)) {
        s.emit('message-delivered', { messageId: msg._id, roomId: msg.roomId });
      }
    });
    

    s.on('typing', ({ userId, isTyping }) => {
      setTypingUsers(prev => {
        const copy = { ...prev };
        if (isTyping) copy[userId] = true;
        else delete copy[userId];
        return copy;
      });
    });

    s.on('message-updated', updated =>
      setMessages(prev => prev.map(m => m._id === updated._id ? updated : m))
    );

    s.on('message-deleted', ({ _id }) =>
      setMessages(prev => prev.map(m =>
        m._id === _id ? { ...m, deleted: true } : m
      ))
    );

    s.on('message-delivered', ({ messageId, userId }) =>
      setMessages(prev => prev.map(m => {
        if (m._id !== messageId) return m;
        const delivered = new Set(m.deliveredTo || []);
        delivered.add(String(userId));
        return { ...m, deliveredTo: [...delivered] };
      }))
    );

    s.on('message-read', ({ messageId, userId }) =>
      setMessages(prev => prev.map(m => {
        if (m._id !== messageId) return m;
        const readBy = new Set(m.readBy || []);
        readBy.add(String(userId));
        return { ...m, readBy: [...readBy] };
      }))
    );

  }, [token, myUserId]);

 
// ------------------- ChatPage.jsx (PART 2) -------------------

// ---------------- LOAD ROOMS ----------------
useEffect(() => { loadRooms(); }, []);
function scrollToBottom() {
  if (messagesEndRef.current) {
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }
}
async function loadRooms() {
  setLoadingRooms(true);
  try {
    const res = await API.get('/rooms');
    const list = res.data;

    if (!list || list.length === 0) {
      const created = await API.post('/rooms', { name: 'General', isPrivate: false });
      setRooms([created.data]);
      setActiveRoom(created.data._id);
    } else {
      setRooms(list);
      setActiveRoom(prev => {
        if (prev && list.some(r => String(r._id) === String(prev))) {
          return prev;
        }
        return list[0]._id;
      });
    }
  } catch (err) {
    console.error('loadRooms error', err);
  } finally {
    setLoadingRooms(false);
  }
}

useEffect(() => {
  scrollToBottom();
}, [messages]);

useEffect(() => {
  scrollToBottom();
}, [activeRoom]);

// ---------------- LOAD MESSAGES PER ROOM ----------------
useEffect(() => {
  if (!activeRoom) return;
  loadMessages(activeRoom);

  const s = getSocket();
  if (s) s.emit('join-room', { roomId: activeRoom });

  return () => {
    const s2 = getSocket();
    if (s2) s2.emit('leave-room', { roomId: activeRoom });
  };
}, [activeRoom]);

async function loadMessages(roomId) {
  try {
    const res = await API.get(`/messages/${roomId}`);
    const list = res.data;
    setMessages(list);

    const s = getSocket();
    if (!s) return;

    list.forEach(m => {
      const sender = m.senderId?._id || m.senderId;
      if (String(sender) !== String(myUserId)) {
        s.emit('message-delivered', { messageId: m._id, roomId });
        s.emit('message-read', { messageId: m._id, roomId });
      }
    });
  } catch (err) {
    console.error('loadMessages error', err);
  }
}

// ---------------- READ RECEIPTS (IntersectionObserver) ----------------
useEffect(() => {
  if (observerRef.current) observerRef.current.disconnect();

  observerRef.current = new IntersectionObserver(entries => {
    const s = getSocket();
    if (!s) return;

    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const messageId = e.target.getAttribute('data-mid');
      s.emit('message-read', { messageId, roomId: activeRoom });
    });
  }, { root: document.querySelector('.messages'), threshold: 0.6 });

  observeRefs.current.forEach(node => {
    if (node) observerRef.current.observe(node);
  });

  return () => observerRef.current && observerRef.current.disconnect();
}, [messages, activeRoom]);

// ---------------- TYPING ----------------
const typingTimeoutRef = useRef(null);

function handleInputChange(e) {
  setText(e.target.value);

  const s = getSocket();
  if (!s) return;
  s.emit('typing', { roomId: activeRoom, isTyping: true });

  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  typingTimeoutRef.current = setTimeout(() => {
    s.emit('typing', { roomId: activeRoom, isTyping: false });
  }, 800);
}

// ---------------- UPLOAD ----------------
async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await API.post('/upload', form);
  return res.data;
}

const handleFileChange = e => {
  const file = e.target.files?.[0];
  if (!file) return;
  setUploadPreview({ file, url: URL.createObjectURL(file) });
};

// ---------------- SEND MESSAGE (NO DUPLICATES) ----------------
async function sendMessage(e) {
  e?.preventDefault();
  if (!text.trim() && !uploadPreview) return;

  const s = getSocket();
  if (!s) return;

  let attachments = [];

  if (uploadPreview?.file) {
    try {
      const uploaded = await uploadFile(uploadPreview.file);
      attachments = [uploaded];
    } catch (err) {
      console.error(err);
      alert('Upload failed');
      setUploadPreview(null);
      return;
    }
  }

  // guaranteed unique temp id
  const tmpId = 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2);

  // add optimistic message
  setMessages(prev => [
    ...prev,
    {
      _id: tmpId,
      roomId: activeRoom,
      senderId: { name: userName, _id: myUserId },
      text,
      attachments,
      createdAt: new Date().toISOString(),
      deliveredTo: [],
      readBy: []
    }
  ]);

  // send to server
  s.emit('send-message', {
    roomId: activeRoom,
    text,
    attachments,
    clientId: tmpId
  });

  setText('');
  setUploadPreview(null);
}
// ---------------- ROOM ACTIONS (CREATE / RENAME / DELETE) ----------------
const createRoom = async () => {
  const name = prompt('Room name');
  if (!name || !name.trim()) return;
  try {
    const res = await API.post('/rooms', { name: name.trim(), isPrivate: false });
    const room = res.data;
    setRooms(prev => [room, ...prev]);
    setActiveRoom(room._id);
    setOpenRoomMenuId(null);
    setEditingRoomId(null);
    setConfirmDeleteRoomId(null);
  } catch (err) {
    console.error('create room', err);
    alert('Create failed');
  }
};

const openRoomMenu = (ev, roomId) => {
  ev?.stopPropagation();
  setConfirmDeleteRoomId(null);
  setEditingRoomId(null);
  setOpenRoomMenuId(prev => prev === roomId ? null : roomId);
};

const startRename = (ev, room) => {
  ev?.stopPropagation();
  setEditingRoomId(room._id);
  setRenameValue(room.name || '');
  setOpenRoomMenuId(room._id);
  setConfirmDeleteRoomId(null);
};

const saveRename = async (roomId) => {
  const trimmed = (renameValue || '').trim();
  if (!trimmed) return alert('Name cannot be empty');

  try {
    const res = await API.put(`/rooms/${roomId}`, { name: trimmed });
    const updatedRoom = res.data;
    setRooms(prev => prev.map(r => String(r._id) === String(roomId) ? updatedRoom : r));
    setEditingRoomId(null);
    setOpenRoomMenuId(null);
  } catch (err) {
    console.error('rename error', err);
    alert('Rename failed');
  }
};

const startDeleteConfirm = (ev, roomId) => {
  ev?.stopPropagation();
  setConfirmDeleteRoomId(roomId);
  setOpenRoomMenuId(roomId);
  setEditingRoomId(null);
};

const cancelDeleteConfirm = (ev) => {
  ev?.stopPropagation();
  setConfirmDeleteRoomId(null);
};

const performDeleteRoom = async (ev, room) => {
  ev?.stopPropagation();
  if (!room || !room._id) return;
  try {
    await API.delete(`/rooms/${room._id}`);
    setRooms(prev => prev.filter(r => String(r._id) !== String(room._id)));
    setActiveRoom(prevActive => {
      if (String(prevActive) === String(room._id)) {
        const remaining = rooms.filter(r => String(r._id) !== String(room._id));
        return remaining.length ? remaining[0]._id : null;
      }
      return prevActive;
    });

    setOpenRoomMenuId(null);
    setConfirmDeleteRoomId(null);
    setEditingRoomId(null);
  } catch (err) {
    console.error('delete room', err);
    alert('Delete failed');
  }
};

// ---------------- EDIT / DELETE MESSAGE ----------------
const startEdit = msg => {
  setEditingMsgId(msg._id);
  setEditingText(msg.text || '');
};

const submitEdit = async e => {
  e.preventDefault();
  try {
    const res = await API.put(`/messages/${editingMsgId}`, { text: editingText });
    setMessages(prev =>
      prev.map(m => String(m._id) === String(editingMsgId) ? res.data : m)
    );
    setEditingMsgId(null);
    setEditingText('');
  } catch (err) {
    console.error(err);
    alert('Edit failed');
  }
};

const deleteMessage = async msg => {
  if (!window.confirm('Delete message?')) return;

  if (String(msg._id).startsWith('tmp-')) {
    setMessages(prev => prev.filter(m => String(m._id) !== String(msg._id)));
    return;
  }

  try {
    await API.delete(`/messages/${msg._id}`);
    setMessages(prev =>
      prev.map(m => String(m._id) === String(msg._id)
        ? { ...m, deleted: true }
        : m
      )
    );
  } catch (err) {
    console.error(err);
    alert('Delete failed');
  }
};

// ---------------- MESSAGE TICK ICONS ----------------
function renderTicks(m) {
  const sender = m.senderId?._id || m.senderId;
  if (String(sender) !== String(myUserId)) return null;

  if ((m.readBy || []).length > 0) return <span className="ticks double">✔✔</span>;
  if ((m.deliveredTo || []).length > 0) return <span className="ticks single">✔</span>;
  return <span className="ticks pending">•</span>;
}

// ---------------- IMAGE PREVIEW ----------------
const openImage = url => setPreviewImage(url);
const closeImage = () => setPreviewImage(null);

// Observer ref helper
const setObserveRef = useCallback((node, id) => {
  if (!id) return;
  if (node) {
    observeRefs.current.set(id, node);
    if (observerRef.current) observerRef.current.observe(node);
  } else {
    const n = observeRefs.current.get(id);
    if (n && observerRef.current) observerRef.current.unobserve(n);
    observeRefs.current.delete(id);
  }
}, []);
// ------------------- PART 4 / 5: UI Markup (Header, Messages, Input) -------------------

// Header menu outside click & ESC handling
useEffect(() => {
  function onDocClick(e) {
    if (menuOpen) {
      if (menuRef.current && menuRef.current.contains(e.target)) {
        // inside header menu — ignore
      } else if (menuButtonRef.current && menuButtonRef.current.contains(e.target)) {
        // clicked the button — ignore
      } else {
        setMenuOpen(false);
      }
    }

    // close per-room menu if click outside any .room-menu
    if (openRoomMenuId) {
      const roomMenuEls = document.querySelectorAll('.room-menu');
      let clickedInsideRoomMenu = false;
      roomMenuEls.forEach(el => { if (el.contains(e.target)) clickedInsideRoomMenu = true; });
      if (!clickedInsideRoomMenu) {
        setOpenRoomMenuId(null);
        setEditingRoomId(null);
        setConfirmDeleteRoomId(null);
      }
    }
  }

  function onEsc(e) {
    if (e.key === 'Escape') {
      setMenuOpen(false);
      setOpenRoomMenuId(null);
      setEditingRoomId(null);
      setConfirmDeleteRoomId(null);
    }
  }

  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onEsc);
  return () => {
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onEsc);
  };
}, [menuOpen, openRoomMenuId]);

const toggleMenu = (ev) => {
  ev?.stopPropagation();
  setMenuOpen(prev => !prev);
};

const doLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userName');
  window.location.href = '/login';
};

if (loadingRooms) return <div className="app-center"><div className="card">Loading rooms...</div></div>;

return (
  <div className="wh-chat-root">
    <aside className={`wh-sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="wh-top">
        <div className="brand">Chat</div>
        <div className="small">Hi, {userName}</div>
      </div>

      <div className="wh-rooms">
        {rooms.map(r => {
          const isActive = String(r._id) === String(activeRoom);
          return (
            <div
              key={r._1d || r._id}
              className={`wh-room ${isActive ? 'active' : ''}`}
              onClick={() => { setActiveRoom(r._id); setSidebarOpen(false); }}
              style={{ position: 'relative' }}
            >
              <div className="wh-avatar">{initials(r.name)}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="wh-room-name" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {/* <button
                      className="room-action-btn"
                      aria-label={`Room actions for ${r.name}`}
                      onClick={(ev) => openRoomMenu(ev, r._id)}
                      title="Room options"
                    >
                      ⋯
                    </button> */}
                  </div>
                </div>

                <div className="small">{r.members?.length || '-'} members</div>
              </div>

              {/* Inline room menu */}
              <div
                className={`room-menu ${openRoomMenuId === r._id ? 'open' : ''}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-hidden={openRoomMenuId === r._id ? 'false' : 'true'}
              >
                {editingRoomId === r._id ? (
                  <div className="room-menu-rename">
                    <input
                      type="text"
                      className="room-rename-input"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(r._id); if (e.key === 'Escape') { setEditingRoomId(null); } }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button className="btn" onClick={() => saveRename(r._id)}>Save</button>
                      <button className="btn secondary" onClick={() => { setEditingRoomId(null); setRenameValue(''); }}>Cancel</button>
                    </div>
                  </div>
                ) : confirmDeleteRoomId === r._id ? (
                  <div className="room-menu-confirm">
                    <div style={{ marginBottom: 8 }}>Delete "{r.name}"?</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn" onClick={(ev) => performDeleteRoom(ev, r)}>Yes</button>
                      <button className="btn secondary" onClick={cancelDeleteConfirm}>No</button>
                    </div>
                  </div>
                ) : (
                  <div className="room-menu-actions">
                    <button className="menu-item" onClick={(ev) => startRename(ev, r)}>Renae</button>
                    <button className="menu-item delete" onClick={(ev) => startDeleteConfirm(ev, r._id)}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: 12 }}>
        <button className="btn" onClick={createRoom}>+ New Room</button>
      </div>
    </aside>

    {sidebarOpen && (
      <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
    )}

    <main className="wh-main">
      <header className="wh-header" role="banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <button className="menu-hamburger" aria-label="Toggle menu" onClick={() => setSidebarOpen(prev => !prev)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            ☰
          </button>
          <div className="wh-header-avatar">{initials(rooms.find(r => String(r._id) === String(activeRoom))?.name || 'R')}</div>
          <div style={{ flex: 1 }}>
            <div className="wh-room-title">{rooms.find(r => String(r._id) === String(activeRoom))?.name || 'Select a room'}</div>
            <div className="small">Realtime • Persistent</div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button ref={menuButtonRef} className="menu-button" aria-haspopup="true" aria-expanded={menuOpen} onClick={toggleMenu} onMouseEnter={() => setMenuOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>

          <div ref={menuRef} className={`header-menu ${menuOpen ? 'open' : ''}`} onMouseLeave={() => setMenuOpen(false)} role="menu">
            <button className="menu-item" role="menuitem" onClick={() => { setMenuOpen(false); alert('Profile clicked'); }}>Profile</button>
            <button className="menu-item" role="menuitem" onClick={() => { setMenuOpen(false); alert('Settings clicked'); }}>Settings</button>
            <div className="divider" style={{ margin: '6px 0' }} />
            <button className="menu-item" role="menuitem" onClick={() => { setMenuOpen(false); doLogout(); }}>Logout</button>
          </div>
        </div>
      </header>

      <div className="messages" id="messages" role="log" aria-live="polite">
        {messages.map(m => {
          const senderId = m.senderId?._id || m.senderId;
          const isMine = String(senderId) === String(myUserId) || m.senderId?.name === userName;

          if (m.deleted)
            return (
              <div key={m._id} className={`message-row ${isMine ? 'mine' : 'other'}`}>
                <div className="bubble deleted">This message was deleted</div>
              </div>
            );

          return (
            <div key={m._id} className={`message-row ${isMine ? 'mine' : 'other'}`}>
              {!isMine && <div className="msg-sender">{m.senderId?.name}</div>}

              <div className="bubble-wrap" ref={el => setObserveRef(el, m._id)} data-mid={m._id}>
                <div className={`bubble ${isMine ? 'bubble-out' : 'bubble-in'}`}>
                  {m.attachments?.map((a, i) =>
                    a.fileType?.startsWith("image") ? (
                      <img key={i} src={a.url} className="attach-img" onClick={() => openImage(a.url)} alt={a.fileName || 'attachment'} />
                    ) : (
                      <a key={i} href={a.url} className="attach-file" target="_blank" rel="noreferrer">{a.fileName}</a>
                    )
                  )}

                  <div className="bubble-text">{m.text}</div>

                  <div className="bubble-meta">
                    <span className="time">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isMine && renderTicks(m)}
                  </div>
                </div>

                {isMine && (
                  <div className="msg-actions-vertical" aria-hidden>
                    <button className="icon-btn" onClick={() => startEdit(m)} title="Edit">
                      <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" /></svg>
                    </button>
                    <button className="icon-btn delete" onClick={() => deleteMessage(m)} title="Delete">
                      <svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="typing-row">{Object.keys(typingUsers).length > 0 && "Someone is typing..."}</div>

      {editingMsgId ? (
        <form className="wh-input" onSubmit={submitEdit}>
          <input value={editingText} onChange={e => setEditingText(e.target.value)} autoFocus />
          <div className="input-actions">
            <button className="btn secondary" type="button" onClick={() => { setEditingMsgId(null); setEditingText(''); }}>Cancel</button>
            <button className="btn" type="submit">Save</button>
          </div>
        </form>
      ) : (
        <form className="wh-input" onSubmit={sendMessage}>
          <input placeholder="Type a message" value={text} onChange={handleInputChange} />
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
          <div className="input-actions">
            <button type="button" className="btn secondary" onClick={() => fileRef.current.click()}>Attach</button>
            <button className="btn" type="submit">Send</button>
          </div>
        </form>
      )}

      {uploadPreview && (
        <div className="upload-preview">
          {uploadPreview.file.type.startsWith("image") ? <img src={uploadPreview.url} alt="preview" style={{ maxWidth: 120, borderRadius: 8 }} /> : uploadPreview.file.name}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={sendMessage}>Send</button>
            <button className="btn secondary" onClick={() => setUploadPreview(null)}>Cancel</button>
          </div>
        </div>
      )}
    </main>

    {previewImage && (
      <div className="lightbox-backdrop" onClick={closeImage}>
        <img className="lightbox-img" src={previewImage} alt="preview" />
        <div className="lightbox-close" onClick={closeImage}>&times;</div>
      </div>
    )}
  </div>
);
}