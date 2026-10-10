import { Icon } from "./Icons.jsx";

function groupLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;
  const t = d.getTime();
  if (t >= startToday) return "Today";
  if (t >= startToday - day) return "Yesterday";
  if (t >= startToday - 7 * day) return "Previous 7 days";
  return "Older";
}

function groupConversations(list) {
  const order = ["Today", "Yesterday", "Previous 7 days", "Older"];
  const map = new Map(order.map(k => [k, []]));
  list.forEach(c => map.get(groupLabel(c.updatedAt)).push(c));
  return order.filter(k => map.get(k).length).map(k => ({ label: k, items: map.get(k) }));
}

export default function Sidebar({
  open, onClose, user, authEnabled, conversations, activeId, loadingList,
  onNew, onOpen, onDelete, onLoginClick, onLogout
}) {
  const groups = groupConversations(conversations);
  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Sidebar">
        <div className="side-top">
          <div className="brand">
            <div className="brand-logo"><Icon name="spark" size={20} /></div>
            <span>Signal AI</span>
          </div>
          <button type="button" className="icon-btn side-close" onClick={onClose} aria-label="Close sidebar">
            <Icon name="close" />
          </button>
        </div>

        <button type="button" className="new-chat" onClick={onNew}>
          <Icon name="plus" size={17} /> New chat
        </button>

        <nav className="history" aria-label="Chat history">
          {user ? (
            loadingList && conversations.length === 0 ? (
              <p className="side-hint">Loading chats…</p>
            ) : conversations.length === 0 ? (
              <p className="side-hint">No saved chats yet. Start a conversation and it will show up here.</p>
            ) : (
              groups.map(g => (
                <div key={g.label} className="group">
                  <div className="group-label">{g.label}</div>
                  {g.items.map(c => (
                    <div key={c.id} className={`history-item ${c.id === activeId ? "active" : ""}`}>
                      <button type="button" className="history-open" onClick={() => onOpen(c.id)} title={c.title}>
                        <Icon name="chat" size={15} />
                        <span>{c.title}</span>
                      </button>
                      <button type="button" className="history-del" onClick={() => onDelete(c.id)} aria-label={`Delete chat ${c.title}`}>
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )
          ) : (
            <p className="side-hint">
              You're chatting as a guest. Log in below to save your chats.
            </p>
          )}
        </nav>

        {/* Bottom-left: login option (guest) ya user profile */}
        <div className="side-bottom">
          {user ? (
            <div className="profile">
              <div className="profile-avatar">{initial}</div>
              <div className="profile-meta">
                <strong title={user.name}>{user.name}</strong>
                <span title={user.email}>{user.email}</span>
              </div>
              <button type="button" className="icon-btn" onClick={onLogout} aria-label="Log out" title="Log out">
                <Icon name="logout" />
              </button>
            </div>
          ) : (
            <button type="button" className="login-btn" onClick={onLoginClick}>
              <span className="login-ico"><Icon name="login" size={18} /></span>
              <span className="login-text">
                <strong>Log in</strong>
                <small>Save chats across devices</small>
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
