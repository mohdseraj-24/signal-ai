import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import AuthModal from "./components/AuthModal.jsx";
import ChatMessage, { TypingIndicator } from "./components/ChatMessage.jsx";
import { Icon } from "./components/Icons.jsx";
import { api, ApiError, getToken, readStore, setToken, writeStore } from "./api.js";

const SUGGESTIONS = [
  { icon: "bulb", title: "Explain a concept", text: "Explain how React hooks work, in simple terms" },
  { icon: "bug", title: "Debug an error", text: "Help me debug: Cannot read properties of undefined" },
  { icon: "layers", title: "Plan a project", text: "Plan a full-stack web project step by step" },
  { icon: "code", title: "Write some code", text: "Write a JavaScript function to debounce another function" }
];

const GUEST_KEY = "signal_guest_chat";
const PREF_KEY = "signal_prefs";

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default function App() {
  const [config, setConfig] = useState(null);
  const [serverWaking, setServerWaking] = useState(false);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!getToken());
  const [authOpen, setAuthOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState(() => (getToken() ? [] : readStore(GUEST_KEY, [])));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const prefs = readStore(PREF_KEY, {});
  const [provider, setProvider] = useState(prefs.provider || "");
  const [model, setModel] = useState(prefs.model || "");
  const [theme, setTheme] = useState(
    prefs.theme || (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark")
  );

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const sessionRef = useRef(0); // chat badalne par purane reply ko ignore karne ke liye

  // ---------- theme ----------
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f4f5fb" : "#070a14");
  }, [theme]);

  useEffect(() => {
    writeStore(PREF_KEY, { provider, model, theme });
  }, [provider, model, theme]);

  // ---------- server config (retry: Render free tier cold start) ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 30 && !cancelled; attempt++) {
        try {
          const data = await api("/config");
          if (!cancelled) {
            setConfig(data);
            setServerWaking(false);
          }
          return;
        } catch {
          if (!cancelled) setServerWaking(true);
          await sleep(4000);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // valid provider/model select karo
  useEffect(() => {
    if (!config || !config.providers.length) return;
    const p = config.providers.find(x => x.id === provider) || config.providers.find(x => x.id === config.defaultProvider) || config.providers[0];
    if (p.id !== provider) setProvider(p.id);
    if (!p.models.includes(model)) setModel(p.defaultModel);
  }, [config, provider, model]);

  // ---------- restore session ----------
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 12 && !cancelled; attempt++) {
        try {
          const data = await api("/auth/me");
          if (!cancelled) setUser(data.user);
          break;
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) { setToken(null); break; }
          await sleep(4000); // server so raha ho sakta hai, dobara try
        }
      }
      if (!cancelled) setAuthReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ---------- guest chat ko browser mein save rakho ----------
  useEffect(() => {
    if (!authReady || user) return;
    writeStore(GUEST_KEY, messages.length ? messages.slice(-60) : null);
  }, [messages, user, authReady]);

  // ---------- history load ----------
  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await api("/conversations");
      setConversations(data.conversations);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) handleLogout(true);
    } finally {
      setLoadingList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  // ---------- scroll + textarea autosize ----------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [input]);

  // ---------- actions ----------
  function newChat() {
    sessionRef.current++;
    setMessages([]);
    setActiveId(null);
    setError("");
    setLoading(false);
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function handleLogout(expired = false) {
    sessionRef.current++;
    setToken(null);
    setUser(null);
    setConversations([]);
    setActiveId(null);
    setMessages([]);
    setLoading(false);
    setSidebarOpen(false);
    setError(expired === true ? "Your session expired. Please log in again." : "");
  }

  function handleAuthSuccess({ token, user: u }) {
    setToken(token);
    setUser(u);
    setAuthOpen(false);
    setSidebarOpen(false);
    setError("");
    // Guest chat chalti rahegi; agla message login ke baad save hone lagega
    writeStore(GUEST_KEY, null);
  }

  async function openConversation(id) {
    if (id === activeId) return setSidebarOpen(false);
    const session = ++sessionRef.current;
    setSidebarOpen(false);
    setError("");
    setLoading(false);
    try {
      const data = await api(`/conversations/${id}`);
      if (session !== sessionRef.current) return;
      setMessages(data.messages);
      setActiveId(data.id);
    } catch (err) {
      if (session !== sessionRef.current) return;
      if (err instanceof ApiError && err.status === 401) return handleLogout(true);
      setError(err.message);
      loadConversations();
    }
  }

  async function deleteConversation(id) {
    if (!window.confirm("Delete this chat? This cannot be undone.")) return;
    try {
      await api(`/conversations/${id}`, { method: "DELETE" });
      setConversations(list => list.filter(c => c.id !== id));
      if (id === activeId) newChat();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return handleLogout(true);
      setError(err.message);
    }
  }

  async function sendMessage(event, preset) {
    if (event) event.preventDefault();
    const question = (preset ?? input).trim();
    if (!question || loading) return;

    const session = sessionRef.current;
    const updated = [...messages, { role: "user", content: question }];
    setMessages(updated);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const data = await api("/chat", {
        method: "POST",
        body: { messages: updated, provider: provider || undefined, model: model || undefined, conversationId: activeId || undefined }
      });
      if (session !== sessionRef.current) return;
      setMessages([...updated, { role: "assistant", content: data.reply }]);
      if (data.conversationId) {
        setActiveId(data.conversationId);
        setConversations(list => {
          const rest = list.filter(c => c.id !== data.conversationId);
          return [{ id: data.conversationId, title: data.title || "New chat", updatedAt: new Date().toISOString() }, ...rest];
        });
      }
    } catch (err) {
      if (session !== sessionRef.current) return;
      if (err instanceof ApiError && err.status === 401 && user) return handleLogout(true);
      setError(err.message || "Unable to contact the API.");
    } finally {
      if (session === sessionRef.current) setLoading(false);
    }
  }

  const providers = config?.providers || [];
  const currentProvider = providers.find(p => p.id === provider);
  const noProvider = config && providers.length === 0;

  return (
    <div className="shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
        authEnabled={Boolean(config?.authEnabled)}
        conversations={conversations}
        activeId={activeId}
        loadingList={loadingList}
        onNew={newChat}
        onOpen={openConversation}
        onDelete={deleteConversation}
        onLoginClick={() => { setSidebarOpen(false); setAuthOpen(true); }}
        onLogout={() => handleLogout(false)}
      />

      <main className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <Icon name="menu" />
          </button>

          <div className="model-picker">
            {providers.length > 1 && (
              <select value={provider} onChange={e => setProvider(e.target.value)} aria-label="AI provider">
                {providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            )}
            {currentProvider && (
              <select value={model} onChange={e => setModel(e.target.value)} aria-label="Model">
                {currentProvider.models.map(m => (
                  <option key={m} value={m}>{providers.length > 1 ? m : `${currentProvider.label} · ${m}`}</option>
                ))}
              </select>
            )}
            {!currentProvider && <span className="model-skeleton">{serverWaking ? "Waking up server…" : "Connecting…"}</span>}
          </div>

          <div className="top-actions">
            <span className="status"><i /> Free</span>
            <button type="button" className="icon-btn" onClick={() => setTheme(t => (t === "dark" ? "light" : "dark"))} aria-label="Toggle theme" title="Toggle theme">
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
          </div>
        </header>

        {serverWaking && (
          <div className="banner" role="status">
            Server is waking up (free hosting can take ~30–60 seconds the first time). Hang tight…
          </div>
        )}
        {noProvider && (
          <div className="banner banner-warn" role="alert">
            No AI provider is configured on the server. Set <code>GROQ_API_KEY</code> and restart.
          </div>
        )}

        <section className="chat" aria-live="polite">
          <div className="chat-inner">
            {messages.length === 0 && (
              <div className="welcome">
                <div className="hero"><Icon name="spark" size={30} /></div>
                <span className="eyebrow">LESS NOISE · MORE SIGNAL</span>
                <h2>Ask anything.<br /><em>Get clarity.</em></h2>
                <p>Concise, factual answers you can act on. Free to use, no login needed.</p>
                <div className="suggestions">
                  {SUGGESTIONS.map(s => (
                    <button type="button" key={s.title} onClick={() => sendMessage(null, s.text)} disabled={loading}>
                      <span className="sug-ico"><Icon name={s.icon} size={17} /></span>
                      <span className="sug-text"><strong>{s.title}</strong><small>{s.text}</small></span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => <ChatMessage key={`${m.role}-${i}`} message={m} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </section>

        <div className="composer-wrap">
          {error && <div className="error" role="alert">{error}</div>}
          <form className="composer" onSubmit={sendMessage}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask your question…"
              rows={1}
              aria-label="Ask your question"
            />
            <button className="send" type="submit" disabled={loading || !input.trim()} aria-label="Send message">
              <Icon name="send" size={19} />
            </button>
          </form>
          <p className="hint">Enter to send · Shift + Enter for a new line · AI can make mistakes, verify important info</p>
        </div>
      </main>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={handleAuthSuccess} unavailable={Boolean(config) && !config.authEnabled} />}
    </div>
  );
}
