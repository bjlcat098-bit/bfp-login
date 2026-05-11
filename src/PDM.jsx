// PDM.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import "./Dashboard.css";

const PDM_STORAGE_KEY = "bfp_pdm_v1";
const ROSTER_STORAGE_KEY = "bfp_roster_v1";

// Constants
const UNIT_ASSIGNMENT_ORDER = [
  "OPFM - PAMPANGA",
  "Angeles City Fire Station",
  "Apalit FS, Pampanga",
  "Arayat FS, Pampanga",
  "Bacolor FS, Pampanga",
  "Candaba FS, Pampanga",
  "Floridablanca FS, Pampanga",
  "Guagua Fire Station",
  "Lubao FS, Pampanga",
  "Mabalacat City FS, Pampanga",
  "Macabebe FS, Pampanga",
  "Magalang FS, Pampanga",
  "Masantol FS, Pampanga",
  "Mexico FS, Pampanga",
  "Minalin FS, Pampanga",
  "Porac FS, Pampanga",
  "City of San Fernando FS, Pampanga",
  "San Luis FS, Pampanga",
  "San Simon FS, Pampanga",
  "Sasmuan FS, Pampanga",
  "Sta Ana FS, Pampanga",
  "Sta Rita FS, Pampanga",
  "Sto. Tomas Fire Station",
];

const UNIT_CODE_MAP = {
  "30500": "OPFM - PAMPANGA",
  "30501": "Angeles City Fire Station",
  "30502": "Apalit FS, Pampanga",
  "30503": "Arayat FS, Pampanga",
  "30504": "Bacolor FS, Pampanga",
  "30505": "Candaba FS, Pampanga",
  "30506": "Floridablanca FS, Pampanga",
  "30507": "Guagua Fire Station",
  "30508": "Lubao FS, Pampanga",
  "30509": "Mabalacat City FS, Pampanga",
  "30510": "Macabebe FS, Pampanga",
  "30511": "Magalang FS, Pampanga",
  "30512": "Masantol FS, Pampanga",
  "30513": "Mexico FS, Pampanga",
  "30514": "Minalin FS, Pampanga",
  "30515": "Porac FS, Pampanga",
  "30516": "City of San Fernando FS, Pampanga",
  "30517": "San Luis FS, Pampanga",
  "30518": "San Simon FS, Pampanga",
  "30519": "Sasmuan FS, Pampanga",
  "30520": "Sta Ana FS, Pampanga",
  "30521": "Sta Rita FS, Pampanga",
  "30522": "Sto. Tomas Fire Station",
};

const UNIT_ASSIGNMENT_TO_CODE = Object.fromEntries(
  Object.entries(UNIT_CODE_MAP).map(([code, unit]) => [unit, code])
);
const CODE_TO_UNIT = UNIT_CODE_MAP;
const UNIT_TO_CODE = UNIT_ASSIGNMENT_TO_CODE;

// ---- export / sort order --------------------------------------------

const RANK_ORDER = [
  "FSSUPT","FSUPT","FCINP","FCINSP","FSINP","FSINSP","FINSP",
  "SFO4","SFO3","SFO2","SFO1","FO3","FO2","FO1","NUP",
];

const rankIndex = (rank) => {
  const r = String(rank || "").trim().toUpperCase();
  const i = RANK_ORDER.indexOf(r);
  return i === -1 ? 999 : i;
};

const cmpStr = (a, b) =>
  String(a || "")
    .trim()
    .toUpperCase()
    .localeCompare(String(b || "").trim().toUpperCase());

const normalizeUnitText = (unit) =>
  String(unit || "")
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .trim();

const canonicalUnitAssignment = (unit, unitCode = "") => {
  const normalized = normalizeUnitText(unit);
  if (UNIT_ASSIGNMENT_ORDER.includes(normalized)) return normalized;

  const found = UNIT_ASSIGNMENT_ORDER.find(
    (u) => normalizeUnitText(u).toUpperCase() === normalized.toUpperCase()
  );
  if (found) return found;

  const byCode = CODE_TO_UNIT[String(unitCode || "").trim()];
  if (byCode) return byCode;

  return normalized;
};

const unitIndex = (unit, unitCode = "") => {
  const canonical = canonicalUnitAssignment(unit, unitCode);
  const i = UNIT_ASSIGNMENT_ORDER.indexOf(canonical);
  return i === -1 ? 999 : i;
};

const sortForExport = (arr, mode) => {
  const list = [...arr];

  if (mode === "LAST_NAME") {
    list.sort((a, b) =>
      cmpStr(a.lastName, b.lastName) ||
      cmpStr(a.firstName, b.firstName) ||
      (rankIndex(a.rank) - rankIndex(b.rank)) ||
      cmpStr(a.accntNo, b.accntNo)
    );
  } else if (mode === "RANK") {
    list.sort((a, b) =>
      (rankIndex(a.rank) - rankIndex(b.rank)) ||
      cmpStr(a.lastName, b.lastName) ||
      cmpStr(a.firstName, b.firstName) ||
      cmpStr(a.accntNo, b.accntNo)
    );
  } else if (mode === "UNIT_ASSIGNMENT") {
    const serviceKey = (v) => {
      const s = String(v || "").trim();
      if (!s) return "9999-99-99";
      const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
      const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m2) return `${m2[3]}-${m2[1].padStart(2,"0")}-${m2[2].padStart(2,"0")}`;
      const t = Date.parse(s);
      if (!Number.isNaN(t)) {
        const d = new Date(t);
        const y = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        return `${y}-${mo}-${da}`;
      }
      return "9999-99-99";
    };

    list.sort((a, b) =>
      (unitIndex(a.unitAssignment, a.unitCode) - unitIndex(b.unitAssignment, b.unitCode)) ||
      (rankIndex(a.rank) - rankIndex(b.rank)) ||
      cmpStr(serviceKey(a.defs), serviceKey(b.defs)) ||
      cmpStr(a.lastName, b.lastName) ||
      cmpStr(a.firstName, b.firstName) ||
      cmpStr(a.middleName, b.middleName) ||
      cmpStr(a.accntNo, b.accntNo)
    );
  }

  return list;
};

const emptyPdmForm = {
  accntNo: "",
  rank: "",
  itemNo: "",
  lastName: "",
  firstName: "",
  middleName: "",
  extName: "",
  unitCode: "",
  unitAssignment: "",
  presentDesignation: "",
  adminOps: "",
  region: "",
  dateOfBirth: "",
  civilStatus: "",
  gender: "",
  religion: "",
  permAddress: "",
  tertiaryCourse1: "",
  school1: "",
  tertiaryCourse2: "",
  school2: "",
  tertiaryCourse3: "",
  school3: "",
  graduateStudies1: "",
  gradSchool1: "",
  graduateStudies2: "",
  gradSchool2: "",
  graduateStudies3: "",
  gradSchool3: "",
  eligibility: [""],
  degs: "",
  prevAgencyDegs: "",
  deus: "",
  prevAgencyDeus: "",
  defs: "",
  dateOfCommissionship: "",
  modeOfCommissionship: "",
  highestMandatory: "",
  specializedTraining: "",
  dolp: "",
  longPay: "",
  tin: "",
  bpNumber: "",
  philHealth: "",
  pagibig: "",
  remarks: "",
  status: "",   // ← ADD THIS
};

function loadPdm() {
  try {
    const raw = localStorage.getItem(PDM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePdm(data) {
  localStorage.setItem(PDM_STORAGE_KEY, JSON.stringify(data));
}

function loadRoster() {
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// HELPER: Find latest designation by date
const getLatestDesignation = (designations) => {
  if (!designations || !designations.length) return "";

  // Sort designations by date (descending - most recent first)
  const sorted = [...designations].sort((a, b) => {
    const d1 = a.dateOfOrder ? new Date(a.dateOfOrder) : new Date("1900-01-01");
    const d2 = b.dateOfOrder ? new Date(b.dateOfOrder) : new Date("1900-01-01");
    return d2.getTime() - d1.getTime();
  });

  // Return designation of first item (most recent date)
  return sorted[0].designation || "";
};

// HELPER: Build full designation string (OLD → NEW)
const getFullDesignationChain = (designations) => {
  if (!Array.isArray(designations) || !designations.length) return "";

  const sorted = [...designations].sort((a, b) => {
    const d1 = a.dateOfOrder ? new Date(a.dateOfOrder) : new Date("1900-01-01");
    const d2 = b.dateOfOrder ? new Date(b.dateOfOrder) : new Date("1900-01-01");
    return d1.getTime() - d2.getTime(); // OLD → NEW
  });

  return sorted
    .map((d) => String(d.designation || "").trim())
    .filter(Boolean)
    .join(" / ");
};

// === LONG PAY CALCULATOR (based on DEFS) ===
// Every 5 years of DEFS = 1 Long Pay
const calculateLongPay = (defs) => {
  if (!defs) return "";

  const start = new Date(defs);
  if (isNaN(start)) return "";

  const today = new Date();

  let years = today.getFullYear() - start.getFullYear();
  const m = today.getMonth() - start.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < start.getDate())) {
    years--;
  }

  return Math.max(0, Math.floor(years / 5));
};

// ✅ FORMAT DATE LIKE: 9-Jan-2020
const formatDateForExcel = (value) => {
  if (!value) return "";

  const d = new Date(value);
  if (isNaN(d)) return "";

  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
};




export default function PDM() {
  const [entries, setEntries] = useState(loadPdm);
  const [form, setForm] = useState(emptyPdmForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [roster, setRoster] = useState(loadRoster);

  // PAGINATION STATE
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Modal States
  const [showExportModal, setShowExportModal] = useState(false);
  const [pendingExportMode, setPendingExportMode] = useState("LAST_NAME");
  const importModeRef = useRef("REPLACE");

  // Keep Unit Code and Unit Assignment always in sync
  useEffect(() => {
    const unit = form.unitAssignment;
    const code = form.unitCode;

    if (unit && UNIT_TO_CODE[unit] && UNIT_TO_CODE[unit] !== code) {
      setForm((prev) => ({ ...prev, unitCode: UNIT_TO_CODE[unit] }));
    }

    if (code && CODE_TO_UNIT[code] && CODE_TO_UNIT[code] !== unit) {
      setForm((prev) => ({ ...prev, unitAssignment: CODE_TO_UNIT[code] }));
    }
  }, [form.unitAssignment, form.unitCode]);

  // ===== FIX: Optimized Roster Sync (hash-based) =====
  const [rosterHash, setRosterHash] = useState("");

  useEffect(() => {
    const intervalId = setInterval(() => {
      try {
        const raw = localStorage.getItem(ROSTER_STORAGE_KEY) || "[]";
        if (raw === rosterHash) return; // no change → do nothing

        setRosterHash(raw);

        const latestRoster = JSON.parse(raw);
        const normalizeAcc = (a) => String(a || "").trim();
        const rosterMap = new Map(latestRoster.map((r) => [normalizeAcc(r.accntNo), r]));

        // Keep local roster state fresh too (used by handleAccntBlur fallback)
        setRoster(Array.isArray(latestRoster) ? latestRoster : []);

        setEntries((prev) =>
          prev.map((entry) => {
            const r = rosterMap.get(normalizeAcc(entry.accntNo));
            if (!r) return entry;

            const latestDesig = getLatestDesignation(r.designations || []);
            return latestDesig !== entry.presentDesignation
              ? { ...entry, presentDesignation: latestDesig }
              : entry;
          })
        );
      } catch (err) {
        console.error("Roster sync error:", err);
      }
    }, 1500); // slower, smarter polling

    return () => clearInterval(intervalId);
  }, [rosterHash]);

  useEffect(() => {
    savePdm(entries);
  }, [entries]);

  // RESET PAGE WHEN SEARCHING
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, unitFilter, entries.length]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const normalizeEligibility = (val) => {
    if (Array.isArray(val) && val.length) return val;
    if (typeof val === "string" && val.trim()) return [val];
    return [""];
  };

  const handleAccntBlur = () => {
    const acc = form.accntNo.trim();
    if (!acc) return;

    // Use freshest roster state from Polling Effect or LocalStorage
    const freshRoster = roster.length ? roster : loadRoster();
    const rosterPerson = freshRoster.find((p) => (p.accntNo || "").trim() === acc);

    if (!rosterPerson) return;

    // Calculate latest designation based on DATE
    const latestDesig = getLatestDesignation(rosterPerson.designations);

    // Apply roster-linked values first.
    setForm((prev) => ({
      ...prev,
      accntNo: acc,
      rank: rosterPerson.rank || prev.rank,
      itemNo: rosterPerson.itemNo || prev.itemNo,
      lastName: rosterPerson.lastName || prev.lastName,
      firstName: rosterPerson.firstName || prev.firstName,
      middleName: rosterPerson.middleName || prev.middleName,
      extName: rosterPerson.extName || prev.extName,
      unitCode: rosterPerson.unitCode || prev.unitCode,
      unitAssignment: rosterPerson.unitAssignment || prev.unitAssignment,
      presentDesignation: latestDesig, // FORCE UPDATE
      gender: rosterPerson.gender || prev.gender,
    }));

    // If there is already a PDM record for this account, merge it
    const existing = entries.find((e) => (e.accntNo || "").trim() === acc);
    if (existing) {
      setEditingId(existing.id);

      setForm((prev) => ({
        ...prev,
        ...existing,
        accntNo: acc,
        // keep roster-based designation (already set above)
        eligibility: normalizeEligibility(existing.eligibility),
      }));
    }
  };

  const clearForm = () => {
    setForm(emptyPdmForm);
    setEditingId(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.accntNo.trim()) {
      alert("Account number is required.");
      return;
    }

    const idToUse = editingId || Date.now();
    const existingPerson = editingId
      ? entries.find((p) => p.id === editingId)
      : null;

    // HIGHLIGHT LOGIC: Detect changed fields
    const editedFields = {};
    if (existingPerson) {
      Object.keys(emptyPdmForm).forEach((key) => {
        const oldV = String(existingPerson[key] ?? "").trim();
        const newV = String(form[key] ?? "").trim();

        // Special handling for eligibility array
        if (key === "eligibility") {
          const oldElig = JSON.stringify(normalizeEligibility(existingPerson.eligibility));
          const newElig = JSON.stringify(normalizeEligibility(form.eligibility));
          if (oldElig !== newElig) {
            editedFields.eligibility = true;
          }
        } else {
          if (oldV !== newV) editedFields[key] = true;
        }
      });
    }

    const payload = {
      id: idToUse,
      ...form,
      longPay: calculateLongPay(form.defs), // 🔥 force correct value
      accntNo: form.accntNo.trim(),
      eligibility: normalizeEligibility(form.eligibility).map((x) => x.trim()).filter(Boolean),

      // HIGHLIGHT STATE
      __isNew: !existingPerson,
      __editedFields: existingPerson
        ? editedFields
        : Object.fromEntries(Object.keys(emptyPdmForm).map((k) => [k, true])),
    };

    setEntries((prev) => {
      const other = prev.filter((e) => e.id !== payload.id);
      return [...other, payload].sort((a, b) =>
        (a.lastName || "").localeCompare(b.lastName || "")
      );
    });

    clearForm();
  };

  const handleDelete = (id) => {
    if (!window.confirm("Delete this PDM entry?")) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) clearForm();
  };

  const clearAllPdmData = () => {
    if (!window.confirm("This will DELETE ALL PDM data. Continue?")) return;

    localStorage.removeItem(PDM_STORAGE_KEY);
    setEntries([]);
    clearForm();
    setSearch("");
    alert("PDM data cleared.");
  };

  const handleRefreshHighlights = () => {
    if (!window.confirm("This will CLEAR ALL highlight markings. Continue?")) {
      return;
    }

    setEntries((prev) =>
      prev.map((p) => ({
        ...p,
        __isNew: false,
        __editedFields: {},
      }))
    );

    alert("Highlights cleared.");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesSearch = !q || [
        e.lastName,
        e.firstName,
        e.accntNo,
        e.unitCode,
        e.unitAssignment,
        e.rank,
        e.presentDesignation,
      ].some((v) => String(v || "").toLowerCase().includes(q));

      const matchesStatus = !statusFilter || String(e.status || "").trim() === statusFilter;
      const matchesUnit = !unitFilter || String(e.unitAssignment || "").trim() === unitFilter;
      return matchesSearch && matchesStatus && matchesUnit;
    });
  }, [entries, search, statusFilter, unitFilter]);

  const pdmStats = useMemo(() => {
    const withDesignation = entries.filter((e) => String(e.presentDesignation || "").trim()).length;
    const withEligibility = entries.filter((e) => normalizeEligibility(e.eligibility).some((x) => String(x || "").trim())).length;
    const withLongPay = entries.filter((e) => Number(calculateLongPay(e.defs) || 0) > 0).length;
    const uniqueUnits = new Set(entries.map((e) => String(e.unitAssignment || "").trim()).filter(Boolean)).size;
    return {
      total: entries.length,
      withDesignation,
      withEligibility,
      withLongPay,
      uniqueUnits,
    };
  }, [entries]);

  const activeFiltersCount = Number(Boolean(search.trim())) + Number(Boolean(statusFilter)) + Number(Boolean(unitFilter));
  const displayStatusOptions = Array.from(new Set(entries.map((e) => String(e.status || "").trim()).filter(Boolean))).sort((a, b) => cmpStr(a, b));

  // PAGINATION LOGIC
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportToExcel = async (sortModeOverride) => {
    try {
      const XLSX = await import("xlsx-js-style");
      const XLSXMod = XLSX.default ?? XLSX;

      // Map roster by account number for designation history
      const rosterMap = new Map(
        (loadRoster() || []).map((r) => [String(r.accntNo || "").trim(), r])
      );

      const buildMatrix = (data, courseKey) => {
        const units = UNIT_ASSIGNMENT_ORDER;
        const map = new Map();

        data.forEach((p) => {
          const course = String(p[courseKey] || "").trim();
          if (!course) return;

          const unit = p.unitAssignment || "UNASSIGNED";

          if (!map.has(course)) {
            map.set(course, Object.fromEntries(units.map((u) => [u, 0])));
            map.get(course).__TOTAL = 0;
          }

          map.get(course)[unit] = (map.get(course)[unit] || 0) + 1;
          map.get(course).__TOTAL++;
        });

        const header = ["COURSE", ...units, "TOTAL"];

        const rows = Array.from(map.entries()).map(([course, counts]) => [
          course,
          ...units.map((u) => counts[u] || 0),
          counts.__TOTAL || 0,
        ]);

        return [header, ...rows];
      };

      const yellowFill = { fill: { fgColor: { rgb: "FFF59D" } } };
      const thinBorder = {
        top: { style: "thin", color: { rgb: "7A8CA5" } },
        bottom: { style: "thin", color: { rgb: "7A8CA5" } },
        left: { style: "thin", color: { rgb: "7A8CA5" } },
        right: { style: "thin", color: { rgb: "7A8CA5" } },
      };
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { fgColor: { rgb: "1F4E78" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: thinBorder,
      };
      const bodyStyle = {
        alignment: { horizontal: "left", vertical: "top", wrapText: true },
        border: thinBorder,
      };
      const centerStyle = {
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: thinBorder,
      };

      const header = [
        "Account Number",
        "Rank",
        "Lastname",
        "Firstname",
        "Middle Name",
        "Ext name",
        "Unit Code",
        "Unit Assignment",
        "PRESENT DESIGNATION",
        "Admin/Operation",
        "ITEM NUMBER",
        "Region",
        "Date of Birth",
        "Civil Status",
        "Gender",
        "Religion",
        "Perm Address",
        "Tertiary Course 1",
        "School Attended 1",
        "Tertiary Course 2",
        "School Attended 2",
        "Tertiary Course 3",
        "School Attended 3",
        "Graduate Studies 1",
        "School Attended 1 (Grad)",
        "Graduate Studies 2",
        "School Attended 2 (Grad)",
        "Graduate Studies 3",
        "School Attended 3 (Grad)",
        "Eligibility (multiple)",
        "DEGS",
        "Previous Agency (DEGS)",
        "DEUS",
        "Previous Agency (DEUS)",
        "DEFS",
        "Date of Commissionship",
        "Mode of Commissionship",
        "HIGHEST MANDATORY TRAINING",
        "SPECIALIZED TRAINING",
        "DOLP",
        "Long Pay",
        "TIN",
        "BP Number",
        "PhilHealth No",
        "Pagibig ID",
        "Status",          // ← ADD
        "REMARKS",
      ];

      // CRITICAL FIX: Strict manual map to ensure Excel Header matches Object Key exactly.
      const KEY_MAP = {
        "Account Number": "accntNo",
        "Rank": "rank",
        "Lastname": "lastName",
        "Firstname": "firstName",
        "Middle Name": "middleName",
        "Ext name": "extName",
        "Unit Code": "unitCode",
        "Unit Assignment": "unitAssignment",
        "PRESENT DESIGNATION": "presentDesignation",
        "Admin/Operation": "adminOps",
        "ITEM NUMBER": "itemNo",
        "Region": "region",
        "Date of Birth": "dateOfBirth",
        "Civil Status": "civilStatus",
        "Gender": "gender",
        "Religion": "religion",
        "Perm Address": "permAddress",
        "Tertiary Course 1": "tertiaryCourse1",
        "School Attended 1": "school1",
        "Tertiary Course 2": "tertiaryCourse2",
        "School Attended 2": "school2",
        "Tertiary Course 3": "tertiaryCourse3",
        "School Attended 3": "school3",
        "Graduate Studies 1": "graduateStudies1",
        "School Attended 1 (Grad)": "gradSchool1",
        "Graduate Studies 2": "graduateStudies2",
        "School Attended 2 (Grad)": "gradSchool2",
        "Graduate Studies 3": "graduateStudies3",
        "School Attended 3 (Grad)": "gradSchool3",
        "Eligibility (multiple)": "eligibility",
        "DEGS": "degs",
        "Previous Agency (DEGS)": "prevAgencyDegs",
        "DEUS": "deus",
        "Previous Agency (DEUS)": "prevAgencyDeus",
        "DEFS": "defs",
        "Date of Commissionship": "dateOfCommissionship",
        "Mode of Commissionship": "modeOfCommissionship",
        "HIGHEST MANDATORY TRAINING": "highestMandatory",
        "SPECIALIZED TRAINING": "specializedTraining",
        "DOLP": "dolp",
        "Long Pay": "longPay",
        "TIN": "tin",
        "BP Number": "bpNumber",
        "PhilHealth No": "philHealth",
        "Pagibig ID": "pagibig",
        "Status": "status",     // ← ADD
        "REMARKS": "remarks",
      };

      const modeToUse = sortModeOverride || pendingExportMode;

      // Sorting (FIXED – uses official rank & unit order)
     const sorted = sortForExport(entries, modeToUse);

     const rows = sorted.map((e) => [
	  e.accntNo,
	  e.rank,
	  e.lastName,
	  e.firstName,
	  e.middleName,
	  e.extName,
	  e.unitCode,
	  canonicalUnitAssignment(e.unitAssignment, e.unitCode),

	  (() => {
		const r = rosterMap.get(String(e.accntNo || "").trim());
		return r
		  ? getFullDesignationChain(r.designations || [])
		  : e.presentDesignation;
	  })(),

	  e.adminOps,
	  e.itemNo,
	  e.region,

	  // ✅ FIXED DATE: Date of Birth
	  formatDateForExcel(e.dateOfBirth),

	  e.civilStatus,
	  e.gender,
	  e.religion,
	  e.permAddress,
	  e.tertiaryCourse1,
	  e.school1,
	  e.tertiaryCourse2,
	  e.school2,
	  e.tertiaryCourse3,
	  e.school3,
	  e.graduateStudies1,
	  e.gradSchool1,
	  e.graduateStudies2,
	  e.gradSchool2,
	  e.graduateStudies3,
	  e.gradSchool3,
	  (Array.isArray(e.eligibility) ? e.eligibility : []).join(", "),

	  // ✅ FIXED DATES: Service Dates
	  formatDateForExcel(e.degs),
	  e.prevAgencyDegs,
	  formatDateForExcel(e.deus),
	  e.prevAgencyDeus,
	  formatDateForExcel(e.defs),
	  formatDateForExcel(e.dateOfCommissionship),

	  e.modeOfCommissionship,
	  e.highestMandatory,
	  e.specializedTraining,

	  // ✅ FIXED DATE: DOLP
	  formatDateForExcel(e.dolp),

	  calculateLongPay(e.defs),
	  e.tin,
	  e.bpNumber,
	  e.philHealth,
	  e.pagibig,
	  e.status,
	  e.remarks,
	]);

      const wb = XLSXMod.utils.book_new();
      const ws = XLSXMod.utils.aoa_to_sheet([header, ...rows]);

      ws["!cols"] = [
        { wch: 16 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 },
        { wch: 12 }, { wch: 28 }, { wch: 34 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
        { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 30 }, { wch: 22 },
        { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 22 },
        { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 24 }, { wch: 26 },
        { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 18 },
        { wch: 22 }, { wch: 24 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 18 },
        { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 30 },
      ];
      ws["!rows"] = [{ hpt: 34 }, ...rows.map(() => ({ hpt: 28 }))];
      ws["!freeze"] = { xSplit: 2, ySplit: 1 };
      ws["!autofilter"] = { ref: ws["!ref"] };

      const wrapCols = new Set([7, 8, 16, 29, 31, 33, 36, 37, 38, 46]);
      const centeredCols = new Set([1, 6, 9, 10, 13, 14, 39, 40, 41, 42, 43, 44, 45]);

      const wsRange = XLSXMod.utils.decode_range(ws["!ref"]);
      for (let c = wsRange.s.c; c <= wsRange.e.c; c++) {
        const addr = XLSXMod.utils.encode_cell({ r: 0, c });
        if (ws[addr]) ws[addr].s = { ...headerStyle };
      }
      for (let r = 1; r <= wsRange.e.r; r++) {
        for (let c = wsRange.s.c; c <= wsRange.e.c; c++) {
          const addr = XLSXMod.utils.encode_cell({ r, c });
          if (!ws[addr]) continue;
          const style = centeredCols.has(c) ? { ...centerStyle } : { ...bodyStyle };
          if (wrapCols.has(c)) {
            style.alignment = { ...(style.alignment || {}), wrapText: true };
          }
          ws[addr].s = style;
        }
      }

      // HIGHLIGHT LOGIC
      let rowCursor = 1;
      for (const e of sorted) {
        const isNew = !!e.__isNew;
        const edited = e.__editedFields || {};
        for (let c = 0; c < header.length; c++) {
          const key = KEY_MAP[header[c]];
          if (isNew || edited[key]) {
            const addr = XLSXMod.utils.encode_cell({ r: rowCursor, c });
            if (ws[addr]) {
              ws[addr].s = {
                ...(ws[addr].s || (centeredCols.has(c) ? centerStyle : bodyStyle)),
                fill: yellowFill.fill,
              };
            }
          }
        }
        rowCursor++;
      }

      XLSXMod.utils.book_append_sheet(wb, ws, "PDM");

      // ===== COURSE MATRIX REPORTS =====

      const styleMatrixSheet = (sheet) => {
        if (!sheet["!ref"]) return;
        const range = XLSXMod.utils.decode_range(sheet["!ref"]);
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSXMod.utils.encode_cell({ r: 0, c });
          if (sheet[addr]) sheet[addr].s = { ...headerStyle };
        }
        for (let r = 1; r <= range.e.r; r++) {
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSXMod.utils.encode_cell({ r, c });
            if (!sheet[addr]) continue;
            sheet[addr].s = c === 0 ? { ...bodyStyle } : { ...centerStyle };
          }
        }
        const widthCount = range.e.c + 1;
        sheet["!cols"] = [{ wch: 28 }, ...Array.from({ length: Math.max(0, widthCount - 1) }, () => ({ wch: 16 }))];
        sheet["!rows"] = [{ hpt: 30 }, ...Array.from({ length: Math.max(0, range.e.r) }, () => ({ hpt: 22 }))];
        sheet["!freeze"] = { xSplit: 1, ySplit: 1 };
        sheet["!autofilter"] = { ref: sheet["!ref"] };
      };

      // 1st Tertiary
      const sheetT1 = XLSXMod.utils.aoa_to_sheet(
        buildMatrix(sorted, "tertiaryCourse1")
      );
      styleMatrixSheet(sheetT1);
      XLSXMod.utils.book_append_sheet(wb, sheetT1, "Tertiary 1");

      // 2nd Tertiary
      const sheetT2 = XLSXMod.utils.aoa_to_sheet(
        buildMatrix(sorted, "tertiaryCourse2")
      );
      styleMatrixSheet(sheetT2);
      XLSXMod.utils.book_append_sheet(wb, sheetT2, "Tertiary 2");

      // Graduate Studies 1
      const sheetG1 = XLSXMod.utils.aoa_to_sheet(
        buildMatrix(sorted, "graduateStudies1")
      );
      styleMatrixSheet(sheetG1);
      XLSXMod.utils.book_append_sheet(wb, sheetG1, "Graduate Studies 1");

      XLSXMod.writeFile(wb, "BFP_PDM.xlsx");
    } catch (err) {
      console.error(err);
      alert("Excel export failed. Make sure to 'xlsx-js-style' is installed (npm install xlsx-js-style).");
    }
  };

  const importFromExcel = async (file, mode = "REPLACE") => {
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!aoa.length) throw new Error("Empty sheet.");
      const rowData = aoa.slice(1); // Skip header

      const get = (row, idx) => {
        const v = row[idx];
        return v === null || v === undefined ? "" : String(v).trim();
      };

      const excelSerialToISO = (v) => {
        if (!v) return "";
        if (v === null || v === undefined || v === "") return "";
        if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
        if (typeof v === "number") {
          const date = new Date(Math.round((v - 25569) * 86400 * 1000));
          return isNaN(date) ? "" : date.toISOString().slice(0, 10);
        }
        const d = new Date(v);
        return isNaN(d) ? "" : d.toISOString().slice(0, 10);
      };

      const COL = {
        accntNo: 0, rank: 1, lastName: 2, firstName: 3, middleName: 4, extName: 5,
        unitCode: 6, unitAssignment: 7, presentDesignation: 8, adminOps: 9, itemNo: 10,
        region: 11, dateOfBirth: 12, civilStatus: 13, gender: 14, religion: 15, permAddress: 16,
        tertiaryCourse1: 17, school1: 18, tertiaryCourse2: 19, school2: 20, tertiaryCourse3: 21, school3: 22,
        graduateStudies1: 23, gradSchool1: 24, graduateStudies2: 25, gradSchool2: 26,
        graduateStudies3: 27, gradSchool3: 28, eligibility: 29, degs: 30, prevAgencyDegs: 31,
        deus: 32, prevAgencyDeus: 33, defs: 34, dateOfCommissionship: 35, modeOfCommissionship: 36,
        highestMandatory: 37, specializedTraining: 38, dolp: 39, longPay: 40, tin: 41,
        bpNumber: 42, philHealth: 43, pagibig: 44, status: 45, remarks: 45,
      };

      const makeEligibilityArray = (raw) => {
        const s = String(raw || "").trim();
        if (!s) return [""];
        const parts = s.split(/\r?\n|;|,/).map((x) => x.trim()).filter(Boolean);
        return parts.length ? parts : [s];
      };

      const imported = rowData
        .filter((row) => String(row[COL.accntNo] || "").trim() !== "")
        .map((row) => {
          const accntNo = get(row, COL.accntNo);
          return {
            id: Date.now() + Math.random(),
            accntNo,
            rank: get(row, COL.rank), itemNo: get(row, COL.itemNo),
            lastName: get(row, COL.lastName), firstName: get(row, COL.firstName),
            middleName: get(row, COL.middleName), extName: get(row, COL.extName),
            unitCode: get(row, COL.unitCode), unitAssignment: get(row, COL.unitAssignment),
            presentDesignation: "",
            adminOps: get(row, COL.adminOps), region: get(row, COL.region),
            dateOfBirth: excelSerialToISO(row[COL.dateOfBirth]),
            civilStatus: get(row, COL.civilStatus), gender: get(row, COL.gender),
            religion: get(row, COL.religion), permAddress: get(row, COL.permAddress),
            tertiaryCourse1: get(row, COL.tertiaryCourse1), school1: get(row, COL.school1),
            tertiaryCourse2: get(row, COL.tertiaryCourse2), school2: get(row, COL.school2),
            tertiaryCourse3: get(row, COL.tertiaryCourse3), school3: get(row, COL.school3),
            graduateStudies1: get(row, COL.graduateStudies1), gradSchool1: get(row, COL.gradSchool1),
            graduateStudies2: get(row, COL.graduateStudies2), gradSchool2: get(row, COL.gradSchool2),
            graduateStudies3: get(row, COL.graduateStudies3), gradSchool3: get(row, COL.gradSchool3),
            eligibility: makeEligibilityArray(get(row, COL.eligibility)),
            degs: get(row, COL.degs), prevAgencyDegs: get(row, COL.prevAgencyDegs),
            deus: get(row, COL.deus), prevAgencyDeus: get(row, COL.prevAgencyDeus),
            defs: get(row, COL.defs), dateOfCommissionship: excelSerialToISO(row[COL.dateOfCommissionship]),
            modeOfCommissionship: get(row, COL.modeOfCommissionship),
            highestMandatory: get(row, COL.highestMandatory), specializedTraining: get(row, COL.specializedTraining),
            dolp: get(row, COL.dolp), longPay: get(row, COL.longPay),
            tin: get(row, COL.tin), bpNumber: get(row, COL.bpNumber), philHealth: get(row, COL.philHealth),
            pagibig: get(row, COL.pagibig), status: get(row, COL.status), remarks: get(row, COL.remarks),
            // HIGHLIGHT LOGIC: Mark imported as new
            __editedFields: {},
          };
        });

      const normalizeAcc = (a) => String(a || "").trim();
      const existing = mode === "REPLACE" ? [] : entries;
      const byAcc = new Map(existing.map((e) => [normalizeAcc(e.accntNo), e]));

      imported.forEach((p) => {
        const acc = normalizeAcc(p.accntNo);
        if (!acc) return;

        if (!byAcc.has(acc)) {
          byAcc.set(acc, p);
          return;
        }
        const cur = byAcc.get(acc);
        const merged = { ...cur };
        Object.keys(emptyPdmForm).forEach((k) => {
          if (k === "presentDesignation") return; // always from roster

          if (k === "eligibility") {
            const incoming = Array.isArray(p.eligibility) ? p.eligibility : [String(p.eligibility || "")];
            const hasIncoming = incoming.join("").trim();
            if (hasIncoming) merged.eligibility = incoming;
            return;
          }
          const incoming = p[k];
          if (incoming !== null && incoming !== undefined && String(incoming).trim() !== "") {
            merged[k] = incoming;
          }
        });
        byAcc.set(acc, merged);
      });

      // Final Pass to Sync with Roster for Present Designation
      const finalList = Array.from(byAcc.values());
      const rosterMap = new Map((loadRoster() || []).map((r) => [normalizeAcc(r.accntNo), r]));
      const synced = finalList.map((e) => {
        const r = rosterMap.get(normalizeAcc(e.accntNo));
        if (!r) return e;
        const latestDesig = getLatestDesignation(r.designations || []);
        return { ...e, presentDesignation: latestDesig || "" };
      });

      synced.sort((a, b) => cmpStr(a.lastName, b.lastName) || cmpStr(a.firstName, b.firstName));

      const ok = window.confirm(
        mode === "REPLACE"
          ? `This will REPLACE your PDM with ${synced.length} records. Continue?`
          : `This will ADD/MERGE ${imported.length} rows into your PDM. Continue?`
      );
      if (!ok) return;

      setEntries(synced);
      setSearch("");
      clearForm();
      alert(mode === "REPLACE" ? `Imported (replaced): ${synced.length} records` : `Imported (merged): ${imported.length} rows`);
    } catch (err) {
      console.error(err);
      alert("PDM import failed. Make sure xlsx is installed (npm install xlsx).");
    }
  };

  // UI Helpers
  const addEligibilityRow = () => {
    setForm((prev) => ({ ...prev, eligibility: [...normalizeEligibility(prev.eligibility), ""] }));
  };

  const removeEligibilityRow = (idx) => {
    setForm((prev) => {
      const list = normalizeEligibility(prev.eligibility).filter((_, i) => i !== idx);
      return { ...prev, eligibility: list.length ? list : [""] };
    });
  };

  const setEligibilityValue = (idx, value) => {
    setForm((prev) => {
      const list = normalizeEligibility(prev.eligibility);
      list[idx] = value;
      return { ...prev, eligibility: list };
    });
  };

  // ===== UI =====
  return (
    <div className="data-page">
      {/* UI CHANGE: Matching Roster Header Layout */}
      <div className="roster-header">
        <div>
          <h2 className="roster-title">Personnel Data Management (PDM)</h2>
          <p className="roster-subtitle">
            Detailed personnel data. Present designation is always based on roster.
          </p>
        </div>
        <div className="mode-pill">
          <span className={`mode-dot ${editingId ? "editing" : ""}`} />
          {editingId ? "Editing mode" : "Add mode"}
        </div>
      </div>

      <div className="home-row" style={{ marginBottom: 14 }}>
        <div className="metric-card">
          <div className="metric-label">Total PDM records</div>
          <div className="metric-value">{pdmStats.total}</div>
          <div className="metric-sub">Complete personnel profiles saved locally</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">With designation sync</div>
          <div className="metric-value">{pdmStats.withDesignation}</div>
          <div className="metric-sub">Pulled from latest roster designation history</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Units represented</div>
          <div className="metric-value">{pdmStats.uniqueUnits}</div>
          <div className="metric-sub">{pdmStats.withEligibility} with eligibility • {pdmStats.withLongPay} with long pay</div>
        </div>
      </div>

      {/* UI CHANGE: Matching Roster Action Bar (Improved) - FIXED JSX ERROR */}
      <div className="roster-card" style={{ marginBottom: 14 }}>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          justifyContent: "space-between",
          alignItems: "flex-start"
        }}>

          {/* GROUP 1: Export */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            flex: "1",
            minWidth: "fit-content"
          }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setPendingExportMode(pendingExportMode);
                setShowExportModal(true);
              }}
            >
              📤 Export Excel
            </button>
          </div>

          {/* GROUP 2: Import */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            flex: "1",
            minWidth: "fit-content"
          }}>
            <button
              className="btn"
              type="button"
              onClick={() => {
                importModeRef.current = "REPLACE";
                document.getElementById("pdmImportInput")?.click();
              }}
            >
              📥 Replace
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".xlsx,.xls";
                input.onchange = (e) => {
                  const file = e.target.files?.[0];
                  if (file) importFromExcel(file, "MERGE");
                };
                input.click();
              }}
            >
              ➕ Add/Merge
            </button>
          </div>

          {/* GROUP 3: Tools */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            flex: "1",
            minWidth: "fit-content"
          }}>
            <button type="button" className="btn" onClick={handleRefreshHighlights}>
              🟡 Refresh Highlights
            </button>
          </div>

          {/* GROUP 4: Danger */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            flex: "1",
            minWidth: "fit-content"
          }}>
            <button type="button" className="btn btn-danger" onClick={clearAllPdmData}>
              🗑️ Clear PDM Data
            </button>
          </div>
        </div>
      </div>

      <input
        id="pdmImportInput"
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importFromExcel(file, importModeRef.current || "REPLACE");
          e.target.value = "";
        }}
      />

      <div className="data-page">
        <div className="data-page-grid">
          {/* LEFT – form */}
          <section className="data-card">
            <div className="data-card-header">
              <h2>{editingId ? "Edit personnel" : "Add personnel"}</h2>
              {editingId && <span className="badge">Editing existing</span>}
            </div>

            <form className="data-form" onSubmit={handleSubmit}>
              <div className="roster-card" style={{ marginBottom: 14, padding: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>Current profile snapshot</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <span className="badge blue">Acct: {form.accntNo || "—"}</span>
                      <span className="badge">Unit: {form.unitAssignment || form.unitCode || "—"}</span>
                      <span className="badge">Rank: {form.rank || "—"}</span>
                      <span className="badge green">Designation: {form.presentDesignation || "No roster designation"}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", maxWidth: 320 }}>
                    Type an existing account number to auto-fill identity, rank, unit, and latest roster designation.
                  </div>
                </div>
              </div>
              <div className="subsection-header">
                <h3>Identity</h3>
              </div>

              <div className="data-form-grid">
                <div className="field">
                  <label>Account Number</label>
                  <input
                    value={form.accntNo}
                    onChange={(e) => handleChange("accntNo", e.target.value)}
                    onBlur={handleAccntBlur}
                    placeholder="Enter existing Accnt no. from roster to auto-fill."
                  />
                </div>

                <div className="field">
                  <label>Rank</label>
                  <input value={form.rank} onChange={(e) => handleChange("rank", e.target.value)} />
                </div>

                <div className="field">
                  <label>Item Number</label>
                  <input
                    value={form.itemNo}
                    onChange={(e) => handleChange("itemNo", e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Last name</label>
                  <input value={form.lastName} onChange={(e) => handleChange("lastName", e.target.value)} />
                </div>

                <div className="field">
                  <label>First name</label>
                  <input value={form.firstName} onChange={(e) => handleChange("firstName", e.target.value)} />
                </div>

                <div className="field">
                  <label>Middle name</label>
                  <input value={form.middleName} onChange={(e) => handleChange("middleName", e.target.value)} />
                </div>

                <div className="field">
                  <label>Ext name</label>
                  <input value={form.extName} onChange={(e) => handleChange("extName", e.target.value)} />
                </div>

                <div className="field">
                  <label>Unit code</label>
                  <input value={form.unitCode} onChange={(e) => handleChange("unitCode", e.target.value)} />
                </div>

                <div className="field">
                  <label>Unit assignment</label>
                  <select
                    value={form.unitAssignment}
                    onChange={(e) => {
                      const unit = e.target.value;
                      handleChange("unitAssignment", unit);
                      handleChange("unitCode", UNIT_ASSIGNMENT_TO_CODE[unit] || "");
                    }}
                  >
                    <option value="">Select unit assignment</option>
                    {UNIT_ASSIGNMENT_ORDER.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Present designation</label>
                  <input value={form.presentDesignation} readOnly className="readonly-input" />
                  <small className="hint">
                    Read-only; always follows latest designation in roster.
                  </small>
                </div>

                <div className="field">
                  <label>Gender</label>
                  <select value={form.gender} onChange={(e) => handleChange("gender", e.target.value)}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div className="field">
                  <label>Status</label>
                  <input value={form.status} onChange={(e) => handleChange("status", e.target.value)} placeholder="Active, detailed, etc." />
                </div>

                <div className="field">
                  <label>Remarks</label>
                  <textarea rows={2} value={form.remarks} onChange={(e) => handleChange("remarks", e.target.value)} />
                </div>
              </div>

              <div className="subsection-header">
                <h3>Education</h3>
              </div>

              <div className="data-form-grid">
                <div className="field">
                  <label>Tertiary Course 1</label>
                  <input value={form.tertiaryCourse1} onChange={(e) => handleChange("tertiaryCourse1", e.target.value)} />
                </div>
                <div className="field">
                  <label>School Attended 1</label>
                  <input value={form.school1} onChange={(e) => handleChange("school1", e.target.value)} />
                </div>

                <div className="field">
                  <label>Tertiary Course 2</label>
                  <input value={form.tertiaryCourse2} onChange={(e) => handleChange("tertiaryCourse2", e.target.value)} />
                </div>
                <div className="field">
                  <label>School Attended 2</label>
                  <input value={form.school2} onChange={(e) => handleChange("school2", e.target.value)} />
                </div>

                <div className="field">
                  <label>Tertiary Course 3</label>
                  <input value={form.tertiaryCourse3} onChange={(e) => handleChange("tertiaryCourse3", e.target.value)} />
                </div>
                <div className="field">
                  <label>School Attended 3</label>
                  <input value={form.school3} onChange={(e) => handleChange("school3", e.target.value)} />
                </div>

                <div className="field">
                  <label>Graduate Studies 1</label>
                  <input value={form.graduateStudies1} onChange={(e) => handleChange("graduateStudies1", e.target.value)} />
                </div>
                <div className="field">
                  <label>School Attended 1 (Grad)</label>
                  <input value={form.gradSchool1} onChange={(e) => handleChange("gradSchool1", e.target.value)} />
                </div>

                <div className="field">
                  <label>Graduate Studies 2</label>
                  <input value={form.graduateStudies2} onChange={(e) => handleChange("graduateStudies2", e.target.value)} />
                </div>
                <div className="field">
                  <label>School Attended 2 (Grad)</label>
                  <input value={form.gradSchool2} onChange={(e) => handleChange("gradSchool2", e.target.value)} />
                </div>

                <div className="field">
                  <label>Graduate Studies 3</label>
                  <input value={form.graduateStudies3} onChange={(e) => handleChange("graduateStudies3", e.target.value)} />
                </div>
                <div className="field">
                  <label>School Attended 3 (Grad)</label>
                  <input value={form.gradSchool3} onChange={(e) => handleChange("gradSchool3", e.target.value)} />
                </div>
              </div>

              <div className="subsection-header">
                <h3>Eligibility</h3>
              </div>

              <div className="field">
                <label>Eligibility (multiple)</label>
                {(form.eligibility || [""]).map((val, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      value={val}
                      onChange={(e) => setEligibilityValue(idx, e.target.value)}
                      placeholder="Type eligibility"
                    />
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => removeEligibilityRow(idx)}
                      disabled={(form.eligibility || [""]).length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addEligibilityRow}>
                  + Add eligibility
                </button>
                <div className="hint">Use “Add eligibility” to add another row.</div>
              </div>

              <div className="subsection-header">
                <h3>Service / Commissionship</h3>
              </div>

              <div className="data-form-grid">
                <div className="field">
                  <label>DEGS</label>
                  <input value={form.degs} onChange={(e) => handleChange("degs", e.target.value)} />
                </div>
                <div className="field">
                  <label>Previous Agency (DEGS)</label>
                  <input value={form.prevAgencyDegs} onChange={(e) => handleChange("prevAgencyDegs", e.target.value)} />
                </div>

                <div className="field">
                  <label>DEUS</label>
                  <input value={form.deus} onChange={(e) => handleChange("deus", e.target.value)} />
                </div>
                <div className="field">
                  <label>Previous Agency (DEUS)</label>
                  <input value={form.prevAgencyDeus} onChange={(e) => handleChange("prevAgencyDeus", e.target.value)} />
                </div>

                <div className="field">
                  <label>DEFS</label>
                  <input
                    type="date"
                    value={form.defs}
                    onChange={(e) => {
                      const v = e.target.value;
                      handleChange("defs", v);
                      // auto compute Long Pay from DEFS
                      handleChange("longPay", calculateLongPay(v));
                    }}
                  />
                </div>

                <div className="field">
                  <label>Date of Commissionship</label>
                  <input type="date" value={form.dateOfCommissionship} onChange={(e) => handleChange("dateOfCommissionship", e.target.value)} />
                </div>

                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Mode of Commissionship</label>
                  <input
                    value={form.modeOfCommissionship}
                    onChange={(e) => handleChange("modeOfCommissionship", e.target.value)}
                    placeholder="e.g Lateral, PNPA, Rose from Ranks"
                  />
                </div>
              </div>

              <div className="subsection-header">
                <h3>Training</h3>
              </div>

              <div className="data-form-grid">
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Highest Mandatory Training</label>
                  <textarea rows={2} value={form.highestMandatory} onChange={(e) => handleChange("highestMandatory", e.target.value)} />
                </div>

                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Specialized Training</label>
                  <textarea rows={2} value={form.specializedTraining} onChange={(e) => handleChange("specializedTraining", e.target.value)} />
                </div>

                <div className="field">
                  <label>DOLP</label>
                  <input value={form.dolp} onChange={(e) => handleChange("dolp", e.target.value)} />
                </div>

                <div className="field">
                  <label>Long Pay</label>
                  <input
                    value={form.longPay}
                    readOnly
                    className="readonly-input"
                    style={{ background: "#f3f4f6", fontWeight: 700 }}
                  />
                  <small className="hint">
                    Automatically calculated from DEFS (5 years = 1 Long Pay)
                  </small>
                </div>
              </div>

              <div className="subsection-header">
                <h3>Government IDs</h3>
              </div>

              <div className="data-form-grid">
                <div className="field">
                  <label>TIN</label>
                  <input value={form.tin} onChange={(e) => handleChange("tin", e.target.value)} />
                </div>
                <div className="field">
                  <label>BP Number</label>
                  <input value={form.bpNumber} onChange={(e) => handleChange("bpNumber", e.target.value)} />
                </div>
                <div className="field">
                  <label>PhilHealth No</label>
                  <input value={form.philHealth} onChange={(e) => handleChange("philHealth", e.target.value)} />
                </div>
                <div className="field">
                  <label>Pagibig ID</label>
                  <input value={form.pagibig} onChange={(e) => handleChange("pagibig", e.target.value)} />
                </div>
              </div>

              <div className="field">
                <label>Remarks</label>
                <textarea rows={2} value={form.remarks} onChange={(e) => handleChange("remarks", e.target.value)} />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingId ? "Update PDM entry" : "Save to PDM"}
                </button>
                <button type="button" className="btn-ghost" onClick={clearForm}>
                  Clear form
                </button>
              </div>
            </form>
          </section>

          {/* RIGHT – list */}
          <section className="data-card">
            <div className="data-card-header">
              <h2>PDM records</h2>
              <span className="muted">{filtered.length} of {entries.length} entries</span>
            </div>

            <div className="data-card-body">
              <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                <div className="search-wrap">
                  <span className="search-icon">🔎</span>
                  <input
                    className="search-input"
                    placeholder="Search by name, rank, designation, unit code or account no."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All status</option>
                    {displayStatusOptions.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>

                  <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
                    <option value="">All units</option>
                    {UNIT_ASSIGNMENT_ORDER.map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span className="badge">{filtered.length} shown</span>
                  {!!activeFiltersCount && <span className="badge blue">{activeFiltersCount} active filter{activeFiltersCount > 1 ? "s" : ""}</span>}
                  <button type="button" className="btn btn-ghost" onClick={() => { setSearch(""); setStatusFilter(""); setUnitFilter(""); }}>
                    Reset filters
                  </button>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Accnt no.</th>
                      <th>Name</th>
                      <th>Unit</th>
                      <th>Present designation</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="empty-state">
                          No matching PDM entries. Try clearing filters or save from the form on the left.
                        </td>
                      </tr>
                    )}
                    {pageData.map((e) => (
                      <tr key={e.id}>
                        <td>{e.accntNo}</td>
                        <td>{e.rank} {e.lastName}, {e.firstName}</td>
                        <td>{e.unitCode}</td>
                        <td>{e.presentDesignation}</td>
                        <td className="row-actions">
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => {
                              setEditingId(e.id);
                              setForm({
                                ...emptyPdmForm,
                                ...e,
                                eligibility: normalizeEligibility(e.eligibility),
                              });
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="link-button danger"
                            onClick={() => handleDelete(e.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* UI CHANGE: Matching Roster Pagination Bar */}
                <div className="pager-bar">
                  <div className="pager-left">
                    <span className="pager-text">{filtered.length} entries</span>
                  </div>
                  <div className="pager-right">
                    <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                    <div className="pager-info">
                      Page <b>{page}</b> / {pageCount}
                    </div>
                    <button className="btn btn-secondary" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Next</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Export Sort Modal */}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="modal-title">Export PDM</h3>
            <p className="modal-subtitle">
              Choose how you want PDM sorted.
            </p>

            <div className="modal-options">
              <label className="radio-row">
                <input
                  type="radio"
                  name="exportSort"
                  value="LAST_NAME"
                  checked={pendingExportMode === "LAST_NAME"}
                  onChange={() => setPendingExportMode("LAST_NAME")}
                />
                <span>
                  <strong>Last Name</strong>
                  <div className="radio-sub">Alphabetical by last name</div>
                </span>
              </label>

              <label className="radio-row">
                <input
                  type="radio"
                  name="exportSort"
                  value="RANK"
                  checked={pendingExportMode === "RANK"}
                  onChange={() => setPendingExportMode("RANK")}
                />
                <span>
                  <strong>Rank</strong>
                  <div className="radio-sub">Uses rank order list</div>
                </span>
              </label>

              <label className="radio-row">
                <input
                  type="radio"
                  name="exportSort"
                  value="UNIT_ASSIGNMENT"
                  checked={pendingExportMode === "UNIT_ASSIGNMENT"}
                  onChange={() => setPendingExportMode("UNIT_ASSIGNMENT")}
                />
                <span>
                  <strong>Unit Assignment</strong>
                  <div className="radio-sub">Grouped by station/unit</div>
                </span>
              </label>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </button>

              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowExportModal(false);
                  exportToExcel(pendingExportMode);
                }}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
