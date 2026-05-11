import React, { useState } from "react";
import "./Dashboard.css";

import DashboardHome from "./DashboardHome";
import ROSTER from "./ROSTER";
import PDM from "./PDM";
import Leave from "./Leave";


import { useAuth } from "./context/AuthContext";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";

import { VIEWS, TITLE_MAP, SUBTITLE_MAP } from "./constants/views";

export default function Dashboard() {
  const { logout } = useAuth();

  const [activeView, setActiveView] = useState(VIEWS.DASHBOARD);
  const [theme, setTheme] = useState("dark");

  // Backward-compatible: if constants/views.js is not yet updated,
  // we still support the Leave page via the string literal "LEAVE".
  const LEAVE_VIEW = VIEWS.LEAVE ?? "LEAVE";

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  const renderContent = () => {
    if (activeView === VIEWS.ROSTER) return <ROSTER />;
    if (activeView === VIEWS.PDM) return <PDM />;
    if (activeView === LEAVE_VIEW) return <Leave />;
    return <DashboardHome onNavigate={setActiveView} />;
  };

  return (
    <div className={`app-shell ${theme}`}>
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        onLogout={logout}
      />

      <main className="main-area">
        <Topbar
          title={TITLE_MAP?.[activeView] || (activeView === LEAVE_VIEW ? "Leave Management" : "Dashboard")}
          subtitle={SUBTITLE_MAP?.[activeView] || (activeView === LEAVE_VIEW ? "Leave ledger and automatic leave balance computation" : "")}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <section className="content-area">{renderContent()}</section>
      </main>
    </div>
  );
}
