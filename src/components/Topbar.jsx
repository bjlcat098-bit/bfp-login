import React from "react";

export default function Topbar({ title, subtitle, theme, onToggleTheme }) {
  return (
    <header className="topbar">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      <div className="topbar-right">
        <button className="theme-toggle" onClick={onToggleTheme}>
          <span className="theme-icon">{theme === "dark" ? "🌙" : "☀️"}</span>
          <span>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
        </button>

        <button className="env-pill">PRODUCTION</button>

        <div className="user-pill">
          <div className="user-info">
            <div className="user-role">Administrator</div>
            <div className="user-unit">Provincial Command</div>
          </div>
          <div className="user-avatar">AD</div>
        </div>
      </div>
    </header>
  );
}
