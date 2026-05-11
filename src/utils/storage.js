// src/utils/storage.js

const ROSTER_KEY = "bfp_roster_v1";
const PDM_KEY = "bfp_pdm_v1";

export function loadRoster() {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load roster from storage", e);
    return [];
  }
}

export function saveRoster(list) {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save roster", e);
  }
}

export function loadPdm() {
  try {
    const raw = localStorage.getItem(PDM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load PDM from storage", e);
    return [];
  }
}

export function savePdm(list) {
  try {
    localStorage.setItem(PDM_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save PDM", e);
  }
}
