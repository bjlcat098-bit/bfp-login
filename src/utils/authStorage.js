// src/utils/authStorage.js
const AUTH_KEY = "bfp_auth";

export const setAuth = (value) =>
  sessionStorage.setItem(AUTH_KEY, value ? "true" : "false");

export const getAuth = () =>
  sessionStorage.getItem(AUTH_KEY) === "true";

export const clearAuth = () =>
  sessionStorage.removeItem(AUTH_KEY);
