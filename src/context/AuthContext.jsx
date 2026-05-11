// src/context/AuthContext.jsx
import React, { createContext, useContext, useMemo, useState } from "react";
import { clearAuth, getAuth, setAuth } from "../utils/authStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(getAuth());

  const login = () => {
    setAuth(true);
    setIsAuthenticated(true);
  };

  const logout = () => {
    clearAuth();
    setIsAuthenticated(false);
  };

  const value = useMemo(
    () => ({ isAuthenticated, login, logout }),
    [isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider />");
  }
  return ctx;
}
