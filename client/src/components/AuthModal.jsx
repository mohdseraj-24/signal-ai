import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api.js";
import { Icon } from "./Icons.jsx";

export default function AuthModal({ onClose, onSuccess, unavailable = false }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isSignup = mode === "signup";

  async function submit(e) {
    e.preventDefault();
    if (busy || unavailable) return;
    setError("");
    if (isSignup && password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      const body = isSignup ? { name, email, password } : { email, password };
      const data = await api(isSignup ? "/auth/register" : "/auth/login", { method: "POST", body });
      onSuccess(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
        <div className="modal-logo">
          <Icon name="spark" size={22} />
        </div>
        <h2 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h2>
        <p className="modal-sub">
          {isSignup ? "Save your chats and pick up on any device." : "Log in to see your saved chats."}
        </p>

        <div className="tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? "on" : ""} onClick={() => { setMode("login"); setError(""); }}>
            Log in
          </button>
          <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? "on" : ""} onClick={() => { setMode("signup"); setError(""); }}>
            Sign up
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          {isSignup && (
            <label>
              Name
              <input ref={firstRef} type="text" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={60} required placeholder="Your name" />
            </label>
          )}
          <label>
            Email
            <input ref={isSignup ? undefined : firstRef} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" />
          </label>
          <label>
            Password
            <span className="pw-field">
              <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete={isSignup ? "new-password" : "current-password"} required placeholder={isSignup ? "At least 8 characters" : "Your password"} />
              <button type="button" className="icon-btn" onClick={() => setShowPw(v => !v)} aria-label={showPw ? "Hide password" : "Show password"}>
                <Icon name={showPw ? "eyeOff" : "eye"} size={17} />
              </button>
            </span>
          </label>

          {unavailable && (
            <div className="form-error" role="alert">
              Login is not set up on this server yet. Add <code>MONGODB_URI</code> and <code>JWT_SECRET</code> in server/.env, then restart.
            </div>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}

          <button className="btn-primary" type="submit" disabled={busy || unavailable}>
            {busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="modal-note">Login is optional. You can chat for free without an account.</p>
      </div>
    </div>
  );
}
