import React, { useState } from "react";
import LightRays from "./LightRays";
import "./LoginPage.css";

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    if (typeof onLoginSuccess === "function") {
      onLoginSuccess();
    }
  };

  return (
    <div className="login-root">
      <LightRays className="light-rays" />

      <div className="login-shell">
        <div className="login-card">
          <h1 className="login-title">BFP LOGIN</h1>
          <p className="login-subtitle">BFP Pampanga Internal Console</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label">Username</label>
              <div className="login-input-row">
                <span className="login-input-icon">👤</span>
                <input
                  className="login-input"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-label">Password</label>
              <div className="login-input-row">
                <span className="login-input-icon">🔒</span>
                <input
                  className="login-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="login-eye-btn"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>

              {error && <div className="login-error">{error}</div>}
            </div>

            <button className="login-btn" type="submit">
              <span className="login-btn-icon">➡️</span>
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
