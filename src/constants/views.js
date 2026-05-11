export const VIEWS = Object.freeze({
  DASHBOARD: "dashboard",
  ROSTER: "roster",
  PDM: "pdm",
  LEAVE: "leave",
});

export const TITLE_MAP = Object.freeze({
  [VIEWS.DASHBOARD]: "Dashboard overview",
  [VIEWS.ROSTER]: "Personnel roster",
  [VIEWS.PDM]: "Personnel data management",
  [VIEWS.LEAVE]: "Leave management",
});

export const SUBTITLE_MAP = Object.freeze({
  [VIEWS.DASHBOARD]: "Live status across incidents, stations and personnel.",
  [VIEWS.ROSTER]:
    "Capture official roster details and multiple designations per personnel.",
  [VIEWS.PDM]:
    "Store and manage detailed personnel data. Present designation always follows the roster.",
  [VIEWS.LEAVE]:
    "Leave ledger with automatic VL/SL computation based on BFP rules.",
});
