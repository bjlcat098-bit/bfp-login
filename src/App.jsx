import React from "react";
import LoginPage from "./LoginPage";
import Dashboard from "./Dashboard";
import { useAuth } from "./context/AuthContext";

export default function App() {
  const { isAuthenticated, login } = useAuth();

  return isAuthenticated ? <Dashboard /> : <LoginPage onLoginSuccess={login} />;
}
