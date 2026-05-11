import React from "react";
import { VIEWS } from "../constants/views";

export default function Sidebar({ activeView, setActiveView, onLogout }) {
  const LEAVE_VIEW = VIEWS.LEAVE ?? "LEAVE";
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-circle">BFP</div>
        <div className="logo-text">
          <div className="logo-title">BFP Pampanga</div>
          <div className="logo-subtitle">Internal Monitoring Console</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Overview</div>
        <button
          className={
            "nav-item" + (activeView === VIEWS.DASHBOARD ? " nav-item-active" : "")
          }
          onClick={() => setActiveView(VIEWS.DASHBOARD)}
        >
          <span className="nav-icon">🏠</span>
          <span>Dashboard</span>
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Operations</div>
        <button className="nav-item nav-item-disabled" disabled>
          <span className="nav-icon">📍</span>
          <span>Incidents &amp; stations</span>
          <span className="nav-pill">Soon</span>
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Admin</div>

        <button
          className={
            "nav-item" + (activeView === VIEWS.ROSTER ? " nav-item-active" : "")
          }
          onClick={() => setActiveView(VIEWS.ROSTER)}
        >
          <span className="nav-icon">👥</span>
          <span>Roster</span>
        </button>

        <button
          className={
            "nav-item" + (activeView === VIEWS.PDM ? " nav-item-active" : "")
          }
          onClick={() => setActiveView(VIEWS.PDM)}
        >
          <span className="nav-icon">📄</span>
          <span>PDM</span>
        </button>

        <button
          className={
            "nav-item" + (activeView === LEAVE_VIEW ? " nav-item-active" : "")
          }
          onClick={() => setActiveView(LEAVE_VIEW)}
        >
          <span className="nav-icon">🗓️</span>
          <span>Leave</span>
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="connection-indicator">
          <span className="dot-online" />
          <div>
            <div className="connection-label">Connected to BFP Pampanga</div>
            <div className="connection-sub">Secure channel</div>
          </div>
        </div>

        <button className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
