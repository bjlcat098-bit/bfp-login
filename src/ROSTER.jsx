// ROSTER.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import "./Dashboard.css";

// ---- helpers ---------------------------------------------------------

const ROSTER_STORAGE_KEY = "bfp_roster_v1";
const DESIGNATION_LIBRARY_STORAGE_KEY = "bfp_roster_designation_library_v1";
const ROSTER_EDIT_TARGET_KEY = "bfp_roster_edit_target";

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
  Object.entries(UNIT_CODE_MAP).map(([code, assignment]) => [assignment, code])
);

const textValue = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

// ✅ Format ISO date (YYYY-MM-DD) to 9-Jan-2020
	const formatDateForExcel = (value) => {
	  if (!value) return "";

	  const d = new Date(value);
	  if (isNaN(d)) return "";

	  const day = d.getDate();
	  const month = d.toLocaleString("en-US", { month: "short" });
	  const year = d.getFullYear();

	  return `${day}-${month}-${year}`;
	};


const matchesRosterEditTarget = (person, target) => {
  if (!person || !target) return false;

  const targetAcc = textValue(target.accntNo);
  const targetLast = textValue(target.lastName).toUpperCase();
  const targetFirst = textValue(target.firstName).toUpperCase();
  const targetMiddle = textValue(target.middleName).toUpperCase();

  const personAcc = textValue(person.accntNo);
  const personLast = textValue(person.lastName).toUpperCase();
  const personFirst = textValue(person.firstName).toUpperCase();
  const personMiddle = textValue(person.middleName).toUpperCase();

  if (targetAcc && personAcc && targetAcc === personAcc) return true;

  return (
    targetLast &&
    targetFirst &&
    targetLast === personLast &&
    targetFirst === personFirst &&
    targetMiddle === personMiddle
  );
};

const normalizeKeyText = (value) => textValue(value).toUpperCase();

const designationIdentityKey = (designation) =>
  [designation?.designation, designation?.authority, designation?.dateOfOrder]
    .map(normalizeKeyText)
    .join("|");

const personIdentityKey = (person) => {
  const acc = normalizeKeyText(person?.accntNo);
  const last = normalizeKeyText(person?.lastName);
  const first = normalizeKeyText(person?.firstName);
  const middle = normalizeKeyText(person?.middleName);

  if (acc || last || first || middle) {
    return `PERSON:${acc}|${last}|${first}|${middle}`;
  }

  const itemNo = normalizeKeyText(person?.itemNo);
  if (itemNo) return `ITEM:${itemNo}`;

  return [
    "FALLBACK",
    normalizeKeyText(person?.rank),
    normalizeKeyText(person?.unitAssignment),
    normalizeKeyText(person?.unitCode),
  ].join(":");
};

const mergeDesignationLists = (...designationLists) => {
  const merged = new Map();

  designationLists
    .flat()
    .filter(Boolean)
    .forEach((designation) => {
      const cleaned = {
        id: designation?.id || Date.now() + Math.random(),
        designation: textValue(designation?.designation),
        authority: textValue(designation?.authority),
        dateOfOrder: textValue(designation?.dateOfOrder),
      };

      if (!cleaned.designation && !cleaned.authority && !cleaned.dateOfOrder) {
        return;
      }

      const key = designationIdentityKey(cleaned);
      if (!merged.has(key)) {
        merged.set(key, cleaned);
        return;
      }

      const existing = merged.get(key);
      merged.set(key, {
        ...existing,
        designation: cleaned.designation || existing.designation,
        authority: cleaned.authority || existing.authority,
        dateOfOrder: cleaned.dateOfOrder || existing.dateOfOrder,
      });
    });

  return Array.from(merged.values()).sort((a, b) =>
    textValue(a.dateOfOrder).localeCompare(textValue(b.dateOfOrder)) ||
    textValue(a.designation).localeCompare(textValue(b.designation)) ||
    textValue(a.authority).localeCompare(textValue(b.authority))
  );
};

const mergePersonnelRecords = (existing, incoming) => ({
  ...existing,
  ...incoming,
  id: existing?.id || incoming?.id || Date.now(),
  rank: textValue(incoming?.rank) || textValue(existing?.rank),
  itemNo: textValue(incoming?.itemNo) || textValue(existing?.itemNo),
  accntNo: textValue(incoming?.accntNo) || textValue(existing?.accntNo),
  lastName: textValue(incoming?.lastName) || textValue(existing?.lastName),
  firstName: textValue(incoming?.firstName) || textValue(existing?.firstName),
  middleName: textValue(incoming?.middleName) || textValue(existing?.middleName),
  unitCode: textValue(incoming?.unitCode) || textValue(existing?.unitCode),
  unitAssignment:
    textValue(incoming?.unitAssignment) || textValue(existing?.unitAssignment),
  gender: textValue(incoming?.gender) || textValue(existing?.gender),
  status: textValue(incoming?.status) || textValue(existing?.status),
  remarks: textValue(incoming?.remarks) || textValue(existing?.remarks),
  designations: mergeDesignationLists(
    existing?.designations || [],
    incoming?.designations || []
  ),
  __isNew: Boolean(existing?.__isNew),
  __editedFields: existing?.__editedFields || {},
  __editedDesigKeys: existing?.__editedDesigKeys || {},
});

const mergePersonnelLists = (currentList, incomingList) => {
  const merged = new Map();

  (currentList || []).forEach((person) => {
    merged.set(personIdentityKey(person), {
      ...person,
      designations: mergeDesignationLists(person?.designations || []),
    });
  });

  (incomingList || []).forEach((person) => {
    const key = personIdentityKey(person);
    if (!merged.has(key)) {
      merged.set(key, {
        ...person,
        designations: mergeDesignationLists(person?.designations || []),
        __isNew: Boolean(person?.__isNew),
        __editedFields: person?.__editedFields || {},
        __editedDesigKeys: person?.__editedDesigKeys || {},
      });
      return;
    }

    merged.set(key, mergePersonnelRecords(merged.get(key), person));
  });

  return Array.from(merged.values()).sort(
    (a, b) =>
      textValue(a.lastName).localeCompare(textValue(b.lastName)) ||
      textValue(a.firstName).localeCompare(textValue(b.firstName)) ||
      textValue(a.accntNo).localeCompare(textValue(b.accntNo))
  );
};

const emptyForm = {
  rank: "",
  itemNo: "",
  accntNo: "",
  lastName: "",
  firstName: "",
  middleName: "",
  unitCode: "",
  unitAssignment: "",
  gender: "",
  status: "",
  remarks: "",
};

const emptyDesignation = () => ({
  id: Date.now() + Math.random(),
  designation: "",
  authority: "",
  dateOfOrder: "",
});

const normalizeDesignationOption = (value) =>
  textValue(value).replace(/\s+/g, " " );

const uniqueDesignationOptions = (values) => {
  const seen = new Map();

  (values || []).forEach((value) => {
    const cleaned = normalizeDesignationOption(value);
    if (!cleaned) return;

    const key = cleaned.toUpperCase();
    if (!seen.has(key)) {
      seen.set(key, cleaned);
    }
  });

  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
};

const loadDesignationLibrary = () => {
  try {
    const raw = localStorage.getItem(DESIGNATION_LIBRARY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return uniqueDesignationOptions(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
};

const saveDesignationLibrary = (list) => {
  localStorage.setItem(
    DESIGNATION_LIBRARY_STORAGE_KEY,
    JSON.stringify(uniqueDesignationOptions(list))
  );
};

const loadRoster = () => {
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveRoster = (list) => {
  localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(list));
};

// sorting helpers
const RANK_ORDER = [
  "FSSUPT",
  "FSUPT",
  "FCINP",
  "FCINSP",
  "FSINP",
  "FSINSP",
  "FINSP",
  "SFO4",
  "SFO3",
  "SFO2",
  "SFO1",
  "FO3",
  "FO2",
  "FO1",
  "NUP",
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

const unitIndex = (unit) => {
  const u = String(unit || "").trim();
  const i = UNIT_ASSIGNMENT_ORDER.indexOf(u);
  return i === -1 ? 999 : i;
};

const sortForExport = (arr, mode) => {
  const list = [...(arr || [])];

  if (mode === "RANK") {
    list.sort(
      (a, b) =>
        rankIndex(a.rank) - rankIndex(b.rank) ||
        cmpStr(a.lastName, b.lastName) ||
        cmpStr(a.firstName, b.firstName) ||
        cmpStr(a.accntNo, b.accntNo)
    );
    return list;
  }

  if (mode === "UNIT_ASSIGNMENT") {
    list.sort(
      (a, b) =>
        unitIndex(a.unitAssignment) - unitIndex(b.unitAssignment) ||
        rankIndex(a.rank) - rankIndex(b.rank) ||
        cmpStr(a.lastName, b.lastName) ||
        cmpStr(a.firstName, b.firstName) ||
        cmpStr(a.accntNo, b.accntNo)
    );
    return list;
  }

  // default: LAST_NAME
  list.sort(
    (a, b) =>
      cmpStr(a.lastName, b.lastName) ||
      cmpStr(a.firstName, b.firstName) ||
      cmpStr(a.accntNo, b.accntNo)
  );
  return list;
};

// ---------------------------------------------------------------------

export default function ROSTER() {
  const [personnel, setPersonnel] = useState(loadRoster);
  const [form, setForm] = useState(emptyForm);
  const [designations, setDesignations] = useState([emptyDesignation()]);
  const [designationLibrary, setDesignationLibrary] = useState(loadDesignationLibrary);
  const [designationLibraryDraft, setDesignationLibraryDraft] = useState(() =>
    loadDesignationLibrary().join("\n")
  );
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  // PAGINATION STATE
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const autoOpenHandledRef = useRef(false);
  const [highlightedOpenId, setHighlightedOpenId] = useState(null);

  const [exportSortMode, setExportSortMode] = useState("LAST_NAME");
  const [showExportModal, setShowExportModal] = useState(false);
  const [pendingExportMode, setPendingExportMode] = useState(exportSortMode);

  useEffect(() => {
    saveRoster(personnel);
  }, [personnel]);

  useEffect(() => {
    saveDesignationLibrary(designationLibrary);
  }, [designationLibrary]);

  useEffect(() => {
    const tryOpenTarget = () => {
      try {
        const rawTarget = localStorage.getItem(ROSTER_EDIT_TARGET_KEY);
        if (!rawTarget) return;

        const target = JSON.parse(rawTarget);
        const matchedPerson = personnel.find((person) => matchesRosterEditTarget(person, target));
        if (!matchedPerson) return;

        autoOpenHandledRef.current = true;
        openPersonForEditing(matchedPerson);
        localStorage.removeItem(ROSTER_EDIT_TARGET_KEY);
      } catch {
        localStorage.removeItem(ROSTER_EDIT_TARGET_KEY);
      }
    };

    tryOpenTarget();
  }, [personnel]);

  useEffect(() => {
    const handleOpenRosterEdit = (event) => {
      const target = event?.detail;
      if (!target) return;

      const matchedPerson = personnel.find((person) => matchesRosterEditTarget(person, target));
      if (!matchedPerson) return;

      openPersonForEditing(matchedPerson);
      autoOpenHandledRef.current = true;
      localStorage.removeItem(ROSTER_EDIT_TARGET_KEY);
    };

    window.addEventListener("bfp:open-roster-edit", handleOpenRosterEdit);
    return () => window.removeEventListener("bfp:open-roster-edit", handleOpenRosterEdit);
  }, [personnel]);

  // RESET PAGE WHEN SEARCHING
  useEffect(() => {
    setPage(1);
  }, [search, personnel.length]);

  const designationOptions = useMemo(
    () =>
      uniqueDesignationOptions([
        ...designationLibrary,
        ...designations.map((row) => row.designation),
      ]),
    [designationLibrary, designations]
  );

  const syncDesignationLibrary = (nextList) => {
    const cleaned = uniqueDesignationOptions(nextList);
    setDesignationLibrary(cleaned);
    setDesignationLibraryDraft(cleaned.join("\n"));
    return cleaned;
  };

  const handleSaveDesignationLibrary = () => {
    const nextList = uniqueDesignationOptions(
      designationLibraryDraft.split(/\r?\n/)
    );
    syncDesignationLibrary(nextList);
    alert(`Saved ${nextList.length} designation option(s).`);
  };

  const handleClearDesignationLibrary = () => {
    if (!window.confirm("Clear the saved designation dropdown list?")) return;
    syncDesignationLibrary([]);
    alert("Designation dropdown list cleared.");
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAccntBlur = () => {
    if (!form.accntNo) return;

    const existing = personnel.find((p) => p.accntNo === form.accntNo.trim());
    if (!existing) return;

    setForm({
      rank: existing.rank || "",
      itemNo: existing.itemNo || "",
      accntNo: existing.accntNo || "",
      lastName: existing.lastName || "",
      firstName: existing.firstName || "",
      middleName: existing.middleName || "",
      unitCode: existing.unitCode || "",
      unitAssignment: existing.unitAssignment || "",
      gender: existing.gender || "",
      status: existing.status || "",
      remarks: existing.remarks || "",
    });

    setDesignations(
      (existing.designations && existing.designations.length
        ? existing.designations
        : [emptyDesignation()]
      ).map((d) => ({ ...d, id: d.id || Date.now() + Math.random() }))
    );

    setEditingId(existing.id);
  };

  const handleDesignationChange = (id, field, value) => {
    setDesignations((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const addDesignationRow = () => {
    setDesignations((prev) => [...prev, emptyDesignation()]);
  };

  const removeDesignationRow = (id) => {
    setDesignations((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length ? next : [emptyDesignation()];
    });
  };

  const clearForm = () => {
    setForm(emptyForm);
    setDesignations([emptyDesignation()]);
    setEditingId(null);
  };
  const openPersonForEditing = (person) => {
    if (!person) return;
    setEditingId(person.id);
    setHighlightedOpenId(person.id);
    setForm({
      rank: person.rank || "",
      itemNo: person.itemNo || "",
      accntNo: person.accntNo || "",
      lastName: person.lastName || "",
      firstName: person.firstName || "",
      middleName: person.middleName || "",
      unitCode: person.unitCode || "",
      unitAssignment: person.unitAssignment || "",
      gender: person.gender || "",
      status: person.status || "",
      remarks: person.remarks || "",
    });
    setDesignations(
      (person.designations && person.designations.length ? person.designations : [emptyDesignation()]).map((d) => ({
        ...d,
        id: d.id || Date.now() + Math.random(),
      }))
    );
    const matchIndex = filtered.findIndex((row) => row.id === person.id);
    if (matchIndex >= 0) {
      const nextPage = Math.floor(matchIndex / pageSize) + 1;
      setPage(nextPage);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => setHighlightedOpenId(null), 4000);
  };


  const clearHighlights = () => {
    if (!window.confirm("This will CLEAR ALL highlight markings. Continue?"))
      return;

    setPersonnel((prev) =>
      prev.map((p) => ({
        ...p,
        __isNew: false,
        __editedFields: {},
        __editedDesigKeys: {},
      }))
    );

    alert("Highlights cleared.");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.accntNo.trim()) {
      alert("Account number is required.");
      return;
    }

    const cleanedDesignations = designations
      .filter((d) => d.designation || d.authority || d.dateOfOrder)
      .map((d) => ({
        ...d,
        formatDateForExcel(d.dateOfOrder),
      }))
      .sort((a, b) => (a.dateOfOrder || "").localeCompare(b.dateOfOrder || ""));

    if (cleanedDesignations.length) {
      syncDesignationLibrary([
        ...designationLibrary,
        ...cleanedDesignations.map((d) => d.designation),
      ]);
    }

    const idToUse = editingId || Date.now();

    const existingPerson = editingId
      ? personnel.find((p) => p.id === editingId)
      : null;

    const editedFields = {};
    if (existingPerson) {
      Object.keys(emptyForm).forEach((key) => {
        const oldV = String(existingPerson[key] ?? "").trim();
        const newV = String(form[key] ?? "").trim();
        if (oldV !== newV) editedFields[key] = true;
      });
    }

    // FIX: Logic for Designation Highlighting
    // 1. Carry forward previous highlight keys to avoid losing highlights on name-only edits.
    // 2. Only mark a designation as edited if it is NEW or CHANGED.
    const previousEditedDesigKeys = existingPerson ? (existingPerson.__editedDesigKeys || {}) : {};
    const editedDesigKeys = { ...previousEditedDesigKeys };

    if (existingPerson) {
      // Build a Set of keys from EXISTING designations to compare against
      const existingKeysSet = new Set(
        (existingPerson.designations || []).map(ed => `${ed.designation}|${ed.authority}|${ed.dateOfOrder}`)
      );

      cleanedDesignations.forEach((d) => {
        const k = `${d.designation}|${d.authority}|${d.dateOfOrder}`;
        
        // Only mark as edited if the key is NOT in the existing set (means it's new)
        // If it IS in the existing set, it means it's unchanged -> DO NOT update (preserves previous status)
        if (!existingKeysSet.has(k)) {
          editedDesigKeys[k] = true;
        }
      });
    } else {
      // New person: mark all non-empty designations as edited
      cleanedDesignations.forEach((d) => {
        const k = `${d.designation}|${d.authority}|${d.dateOfOrder}`;
        if (d.designation || d.authority || d.dateOfOrder) {
          editedDesigKeys[k] = true;
        }
      });
    }

    const payload = {
      id: idToUse,
      ...form,
      accntNo: form.accntNo.trim(),
      designations: cleanedDesignations,

      __isNew: !existingPerson,
      __editedFields: existingPerson
        ? editedFields
        : Object.fromEntries(Object.keys(emptyForm).map((k) => [k, true])),
      __editedDesigKeys: editedDesigKeys,
    };

    setPersonnel((prev) => {
      const other = prev.filter((p) => p.id !== payload.id);
      return [...other, payload].sort((a, b) =>
        (a.lastName || "").localeCompare(b.lastName || "")
      );
    });

    clearForm();
  };

  const handleDeletePerson = (id) => {
    if (!window.confirm("Remove this personnel from roster?")) return;
    setPersonnel((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) clearForm();
  };

  const clearAllRosterData = () => {
    if (!window.confirm("This will DELETE ALL roster data. Continue?")) return;

    localStorage.removeItem(ROSTER_STORAGE_KEY);
    setPersonnel([]);
    clearForm();
    setSearch("");
    alert("Roster data cleared.");
  };

  const handleDeduplicate = () => {
    if (!window.confirm("This will scan for duplicate personnel entries and remove exact repeats. Continue?")) return;

    let removedCount = 0;
    setPersonnel((prev) => {
      const map = new Map();

      (prev || []).forEach((person) => {
        const key = personIdentityKey(person);
        if (!map.has(key)) {
          map.set(key, {
            ...person,
            designations: mergeDesignationLists(person?.designations || []),
          });
          return;
        }

        removedCount += 1;
        map.set(key, mergePersonnelRecords(map.get(key), person));
      });

      return Array.from(map.values()).sort(
        (a, b) =>
          textValue(a.lastName).localeCompare(textValue(b.lastName)) ||
          textValue(a.firstName).localeCompare(textValue(b.firstName)) ||
          textValue(a.accntNo).localeCompare(textValue(b.accntNo))
      );
    });

    alert(`Scan complete. Removed ${removedCount} duplicate entries.`);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return personnel;
    const q = search.trim().toLowerCase();
    return personnel.filter(
      (p) =>
        String(p.lastName || "").toLowerCase().includes(q) ||
        String(p.firstName || "").toLowerCase().includes(q) ||
        String(p.unitCode || "").toLowerCase().includes(q) ||
        String(p.unitAssignment || "").toLowerCase().includes(q) ||
        String(p.accntNo || "").toLowerCase().includes(q)
    );
  }, [search, personnel]);

  // PAGINATION LOGIC
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ===== Excel Export / Import (UPDATED WITH RECAP) =====

  const isoToExcelSerialUTC = (iso) => {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-").map(Number);
    if (!y || !m || !d) return "";
    const utc = Date.UTC(y, m - 1, d);
    return utc / 86400000 + 25569;
  };

  const exportToExcel = async (sortModeOverride) => {
    try {
      const XLSXMod = await import("xlsx-js-style");
      const XLSX = XLSXMod.default ?? XLSXMod;

      // ===== PROFESSIONAL STYLES =====
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
		  alignment: { vertical: "top", wrapText: true },
		  border: thinBorder,
		};

		const centerStyle = {
		  alignment: { horizontal: "center", vertical: "center", wrapText: true },
		  border: thinBorder,
		};

		const yellowFill = { fill: { fgColor: { rgb: "FFF59D" } } };

      const makeKey = (p) => personIdentityKey(p);

      const mergedMap = new Map();
      personnel.forEach((p) => {
        const key = makeKey(p);
        if (!mergedMap.has(key)) {
          mergedMap.set(key, {
            ...p,
            designations: [...(p.designations || [])],
            __desigSet: new Set(
              (p.designations || []).map(
                (d) => `${d.designation}|${d.authority}|${d.dateOfOrder}`
              )
            ),
          });
        } else {
          const existing = mergedMap.get(key);
          (p.designations || []).forEach((d) => {
            const k = `${d.designation}|${d.authority}|${d.dateOfOrder}`;
            if (!existing.__desigSet.has(k)) {
              existing.__desigSet.add(k);
              existing.designations.push({ ...d });
            }
          });
        }
      });

      const mergedPersonnel = Array.from(mergedMap.values()).map((p) => {
        if (p.__desigSet) delete p.__desigSet;
        p.designations = (p.designations || []).sort((a, b) =>
          String(a.dateOfOrder || "").localeCompare(String(b.dateOfOrder || ""))
        );
        return p;
      });

      const modeToUse = sortModeOverride || exportSortMode;
      const sorted = sortForExport(mergedPersonnel, modeToUse);

      // --- SHEET 1: ROSTER ---
      const header = [
        "RANK",
        "LAST NAME",
        "FIRST NAME",
        "MIDDLE NAME",
        "ITEM NO",
        "ACCNT NO",
        "UNIT CODE",
        "UNIT ASSIGNMENT",
        "DESIGNATION",
        "AUTHORITY",
        "DATE OF ORDER",
        "GENDER",
        "STATUS",
        "REMARKS",
      ];

      const data = [header];
      const merges = [];
      let currentRow = 1;

      for (const p of sorted) {
        const desigs =
          Array.isArray(p.designations) && p.designations.length
            ? p.designations
            : [
                {
                  designation: p.presentDesignation || "",
                  authority: "",
                  dateOfOrder: "",
                },
              ];

        desigs.forEach((d, idx) => {
          data.push([
            idx === 0 ? (p.rank || "") : "",
            idx === 0 ? (p.lastName || "") : "",
            idx === 0 ? (p.firstName || "") : "",
            idx === 0 ? (p.middleName || "") : "",
            idx === 0 ? (p.itemNo || "") : "",
            idx === 0 ? (p.accntNo || "") : "",
            idx === 0 ? (p.unitCode || "") : "",
            idx === 0 ? (p.unitAssignment || "") : "",
            d.designation || "",
            d.authority || "",
            d.dateOfOrder || "",
            idx === 0 ? (p.gender || "") : "",
            idx === 0 ? (p.status || "") : "",
            idx === 0 ? (p.remarks || "") : "",
          ]);
        });

        if (desigs.length > 1) {
          const start = currentRow;
          const end = currentRow + desigs.length - 1;
          for (let c = 0; c <= 7; c++)
            merges.push({ s: { r: start, c }, e: { r: end, c } });
          for (let c = 11; c <= 13; c++)
            merges.push({ s: { r: start, c }, e: { r: end, c } });
        }

        currentRow += desigs.length;
      }

      const ws = XLSX.utils.aoa_to_sheet(data);
	// ===== APPLY STYLING =====
		const range = XLSX.utils.decode_range(ws["!ref"]);

		// Style header
		for (let c = range.s.c; c <= range.e.c; c++) {
		  const addr = XLSX.utils.encode_cell({ r: 0, c });
		  if (ws[addr]) ws[addr].s = headerStyle;
		}

		// Style body
		for (let r = 1; r <= range.e.r; r++) {
		  for (let c = range.s.c; c <= range.e.c; c++) {
			const addr = XLSX.utils.encode_cell({ r, c });
			if (!ws[addr]) continue;

			const isCenter = [0, 4, 5, 6, 10, 11, 12].includes(c);
			ws[addr].s = isCenter ? centerStyle : bodyStyle;
		  }
		}

		// Freeze header row
		ws["!freeze"] = { xSplit: 0, ySplit: 1 };

		// Enable AutoFilter
		ws["!autofilter"] = { ref: ws["!ref"] };

		// Set row height
		ws["!rows"] = [{ hpt: 32 }, ...Array.from({ length: range.e.r }, () => ({ hpt: 22 }))];		
	  

      const colIndex = {
        rank: 0,
        lastName: 1,
        firstName: 2,
        middleName: 3,
        itemNo: 4,
        accntNo: 5,
        unitCode: 6,
        unitAssignment: 7,
        designation: 8,
        authority: 9,
        dateOfOrder: 10,
        gender: 11,
        status: 12,
        remarks: 13,
      };

      let rowCursor = 1;
      for (const p of sorted) {
        const desigs =
          Array.isArray(p.designations) && p.designations.length
            ? p.designations
            : [
                {
                  designation: p.presentDesignation || "",
                  authority: "",
                  dateOfOrder: "",
                },
              ];

        const edited = p.__editedFields || {};
        const isNew = !!p.__isNew;
        const desigEdited = p.__editedDesigKeys || {};

        const baseFields = [
          "rank",
          "lastName",
          "firstName",
          "middleName",
          "itemNo",
          "accntNo",
          "unitCode",
          "unitAssignment",
          "gender",
          "status",
          "remarks",
        ];

        for (let i = 0; i < desigs.length; i++) {
          const excelRow = rowCursor + i;

          if (i === 0) {
            baseFields.forEach((f) => {
              if (isNew || edited[f]) {
                const c = colIndex[f];
                const addr = XLSX.utils.encode_cell({ r: excelRow, c });
                if (ws[addr]) ws[addr].s = yellowFill;
              }
            });
          }

          const d = desigs[i];
          const k = `${String(d.designation || "").trim()}|${String(
            d.authority || ""
          ).trim()}|${String(d.dateOfOrder || "").trim()}`;
          const isDesigEdited = isNew || desigEdited[k];

          if (isDesigEdited) {
            [colIndex.designation, colIndex.authority, colIndex.dateOfOrder].forEach(
              (c) => {
                const addr = XLSX.utils.encode_cell({ r: excelRow, c });
                if (ws[addr]) ws[addr].s = yellowFill;
              }
            );
          }
        }

        rowCursor += desigs.length;
      }

      ws["!merges"] = merges;
      ws["!cols"] = [
        { wch: 8 },
        { wch: 18 },
        { wch: 18 },
        { wch: 10 },
        { wch: 12 },
        { wch: 10 },
        { wch: 28 },
        { wch: 30 },
        { wch: 22 },
        { wch: 14 },
        { wch: 10 },
        { wch: 14 },
        { wch: 25 },
      ];

      // --- SHEET 2: RECAPITULATION REPORT ---
      const isOnboarding = (p) => {
        const ds = Array.isArray(p?.designations) ? p.designations : [];
        const text = ds.map((d) => d?.designation || "").join(" ").toLowerCase();
        return text.includes("onboard");
      };

      const recapMap = new Map();
      mergedPersonnel.forEach((p) => {
        const unit = String(p.unitAssignment || "").trim() || "Unassigned";
        if (!recapMap.has(unit)) {
          recapMap.set(unit, { regMale: 0, regFemale: 0, opMale: 0, opFemale: 0 });
        }
        const g = String(p.gender || "").trim().toUpperCase();
        const male = g.startsWith("M");
        const female = g.startsWith("F");
        const op = isOnboarding(p);

        const row = recapMap.get(unit);
        if (op) {
          if (male) row.opMale += 1;
          else if (female) row.opFemale += 1;
        } else {
          if (male) row.regMale += 1;
          else if (female) row.regFemale += 1;
        }
      });

      // Sort recap by Unit Assignment Order
      const sortedUnits = Array.from(recapMap.keys()).sort((a, b) => unitIndex(a) - unitIndex(b));

      const recapHeader = [
        "Unit Assignment",
        "Male",
        "Female",
        "Total (Reg)",
        "OP Male",
        "OP Female",
        "Grand Total"
      ];
      const recapData = [recapHeader];

      let grandRegMale = 0, grandRegFemale = 0, grandOpMale = 0, grandOpFemale = 0;

      sortedUnits.forEach((unit) => {
        const r = recapMap.get(unit);
        const regTotal = r.regMale + r.regFemale;
        const opTotal = r.opMale + r.opFemale;
        const grand = regTotal + opTotal;

        recapData.push([unit, r.regMale, r.regFemale, regTotal, r.opMale, r.opFemale, grand]);

        grandRegMale += r.regMale;
        grandRegFemale += r.regFemale;
        grandOpMale += r.opMale;
        grandOpFemale += r.opFemale;
      });

      // Add Grand Total Row
      recapData.push([
        "GRAND TOTAL",
        grandRegMale,
        grandRegFemale,
        grandRegMale + grandRegFemale,
        grandOpMale,
        grandOpFemale,
        grandRegMale + grandRegFemale + grandOpMale + grandOpFemale
      ]);

      const wsRecap = XLSX.utils.aoa_to_sheet(recapData);
	  // ===== STYLE RECAP SHEET =====
		const recapRange = XLSX.utils.decode_range(wsRecap["!ref"]);

		// Header
		for (let c = recapRange.s.c; c <= recapRange.e.c; c++) {
		  const addr = XLSX.utils.encode_cell({ r: 0, c });
		  if (wsRecap[addr]) wsRecap[addr].s = headerStyle;
		}

		// Body
		for (let r = 1; r <= recapRange.e.r; r++) {
		  for (let c = recapRange.s.c; c <= recapRange.e.c; c++) {
			const addr = XLSX.utils.encode_cell({ r, c });
			if (!wsRecap[addr]) continue;
			wsRecap[addr].s = c === 0 ? bodyStyle : centerStyle;
		  }
		}

		// Freeze header
		wsRecap["!freeze"] = { xSplit: 0, ySplit: 1 };
		wsRecap["!autofilter"] = { ref: wsRecap["!ref"] };

      // Add basic column width for recap
      wsRecap["!cols"] = [
        { wch: 28 }, // Unit Assignment
        { wch: 8 },
        { wch: 8 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
      ];

      // --- CREATE WORKBOOK ---
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Roster");
      XLSX.utils.book_append_sheet(wb, wsRecap, "Recapitulation");

      XLSX.writeFile(wb, "BFP_Roster.xlsx");
    } catch (err) {
      console.error(err);
      alert("Excel export failed.");
    }
  };

  const importFromExcel = async (file, mode = "replace") => {
    if (!file) return;

    try {
      const XLSXModule = await import("xlsx");
      const XLSX = XLSXModule.default ?? XLSXModule;

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
        raw: true,
        blankrows: false,
      });

      if (!aoa.length) {
        alert("The Excel sheet is empty.");
        return;
      }

      const normalizeHeader = (value) =>
        String(value ?? "")
          .trim()
          .toUpperCase()
          .replace(/\s+/g, " ");

      const headerAliases = {
        "ACCOUNT NO": "ACCNT NO",
        "ACCOUNT NUMBER": "ACCNT NO",
        "ACCOUNT #": "ACCNT NO",
        "DESIGNATIONS": "DESIGNATION",
        "DATE ORDER": "DATE OF ORDER",
        "DATE OF ORDER ": "DATE OF ORDER",
        UNIT: "UNIT ASSIGNMENT",
      };

      const headers = (aoa[0] || []).map((header) => {
        const normalized = normalizeHeader(header);
        return headerAliases[normalized] || normalized;
      });

      const findCol = (...names) => {
        for (const name of names) {
          const normalized = headerAliases[normalizeHeader(name)] || normalizeHeader(name);
          const index = headers.indexOf(normalized);
          if (index !== -1) return index;
        }
        return -1;
      };

      const cols = {
        rank: findCol("RANK"),
        lastName: findCol("LAST NAME", "SURNAME"),
        firstName: findCol("FIRST NAME", "GIVEN NAME"),
        middleName: findCol("MIDDLE NAME", "MI"),
        itemNo: findCol("ITEM NO", "ITEM NUMBER"),
        accntNo: findCol("ACCNT NO", "ACCOUNT NO", "ACCOUNT NUMBER"),
        unitCode: findCol("UNIT CODE"),
        unitAssignment: findCol("UNIT ASSIGNMENT", "UNIT"),
        designation: findCol("DESIGNATION", "DESIGNATIONS"),
        authority: findCol("AUTHORITY"),
        dateOfOrder: findCol("DATE OF ORDER", "DATE ORDER"),
        gender: findCol("GENDER", "SEX"),
        status: findCol("STATUS"),
        remarks: findCol("REMARKS", "REMARK"),
      };

      const requiredColumns = ["lastName", "firstName", "designation", "authority", "dateOfOrder"];
      const missingColumns = requiredColumns.filter((name) => cols[name] === -1);
      if (missingColumns.length) {
        alert(`Missing required Excel headers: ${missingColumns.join(", ")}`);
        return;
      }

      const getCell = (row, colIndex) => (colIndex >= 0 ? row[colIndex] : "");

      const excelValueToISO = (value) => {
        if (value === null || value === undefined || value === "") return "";

        if (typeof value === "number") {
          const parsed = XLSX.SSF.parse_date_code(value);
          if (parsed?.y && parsed?.m && parsed?.d) {
            return [parsed.y, parsed.m, parsed.d]
              .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0"))
              .join("-");
          }
        }

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return [
            value.getFullYear(),
            String(value.getMonth() + 1).padStart(2, "0"),
            String(value.getDate()).padStart(2, "0"),
          ].join("-");
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "";

        return [
          parsed.getFullYear(),
          String(parsed.getMonth() + 1).padStart(2, "0"),
          String(parsed.getDate()).padStart(2, "0"),
        ].join("-");
      };

      const imported = [];
      let currentPerson = null;

      aoa.slice(1).forEach((row, index) => {
        const personRow = {
          rank: textValue(getCell(row, cols.rank)),
          itemNo: textValue(getCell(row, cols.itemNo)),
          accntNo: textValue(getCell(row, cols.accntNo)),
          lastName: textValue(getCell(row, cols.lastName)),
          firstName: textValue(getCell(row, cols.firstName)),
          middleName: textValue(getCell(row, cols.middleName)),
          unitCode: textValue(getCell(row, cols.unitCode)),
          unitAssignment: textValue(getCell(row, cols.unitAssignment)),
          gender: textValue(getCell(row, cols.gender)),
          status: textValue(getCell(row, cols.status)),
          remarks: textValue(getCell(row, cols.remarks)),
        };

        if (!personRow.unitAssignment && personRow.unitCode && UNIT_CODE_MAP[personRow.unitCode]) {
          personRow.unitAssignment = UNIT_CODE_MAP[personRow.unitCode];
        }
        if (!personRow.unitCode && personRow.unitAssignment && UNIT_ASSIGNMENT_TO_CODE[personRow.unitAssignment]) {
          personRow.unitCode = UNIT_ASSIGNMENT_TO_CODE[personRow.unitAssignment];
        }

        const designationRow = {
          id: Date.now() + Math.random() + index,
          designation: textValue(getCell(row, cols.designation)),
          authority: textValue(getCell(row, cols.authority)),
          dateOfOrder: excelValueToISO(getCell(row, cols.dateOfOrder)),
        };

        const hasIdentity = [
          personRow.rank,
          personRow.itemNo,
          personRow.accntNo,
          personRow.lastName,
          personRow.firstName,
          personRow.middleName,
          personRow.unitCode,
          personRow.unitAssignment,
          personRow.gender,
          personRow.status,
          personRow.remarks,
        ].some(Boolean);

        const hasDesignation = [
          designationRow.designation,
          designationRow.authority,
          designationRow.dateOfOrder,
        ].some(Boolean);

        if (!hasIdentity && !hasDesignation) return;

        if (hasIdentity) {
          currentPerson = {
            id: Date.now() + Math.random() + index,
            ...personRow,
            designations: [],
            __isNew: false,
            __editedFields: {},
            __editedDesigKeys: {},
          };
          imported.push(currentPerson);
        }

        if (!currentPerson) return;

        if (hasDesignation) {
          currentPerson.designations = mergeDesignationLists(
            currentPerson.designations,
            [designationRow]
          );
        }
      });

      const cleanedImported = imported
        .map((person) => ({
          ...person,
          designations: mergeDesignationLists(person.designations || []),
        }))
        .sort(
          (a, b) =>
            textValue(a.lastName).localeCompare(textValue(b.lastName)) ||
            textValue(a.firstName).localeCompare(textValue(b.firstName)) ||
            textValue(a.accntNo).localeCompare(textValue(b.accntNo))
        );

      if (!cleanedImported.length) {
        alert("No personnel rows were detected in the Excel file.");
        return;
      }

      if (mode === "replace") {
        const ok = window.confirm(
          `This will REPLACE your roster with ${cleanedImported.length} personnel. Continue?`
        );
        if (!ok) return;

        setPersonnel(cleanedImported);
        setSearch("");
        clearForm();
        alert(
          `Imported successfully: ${cleanedImported.length} personnel with ${cleanedImported.reduce(
            (sum, person) => sum + (person.designations?.length || 0),
            0
          )} designation entries.`
        );
        return;
      }

      setPersonnel((prev) => mergePersonnelLists(prev, cleanedImported));
      setSearch("");
      clearForm();
      alert(
        `Imported and merged successfully: ${cleanedImported.length} personnel with ${cleanedImported.reduce(
          (sum, person) => sum + (person.designations?.length || 0),
          0
        )} designation entries.`
      );
    } catch (err) {
      console.error(err);
      alert("Excel import failed.");
    }
  };

  // ====================== UI ======================

  return (
    <div className="roster-page">
      {/* Header */}
      <div className="roster-header">
        <div>
          <h2 className="roster-title">Personnel Roster</h2>
          <p className="roster-subtitle">
            Add, edit, import/export roster entries. Edited fields remain
              highlighted until cleared.
          </p>
        </div>
        <div className="mode-pill">
          <span className={`mode-dot ${editingId ? "editing" : ""}`} />
          {editingId ? "Editing mode" : "Add mode"}
        </div>
      </div>

      {/* Top Actions - UPDATED WITH IMPROVED UI - FIXED JSX ERROR */}
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
              className="btn"
              type="button"
              onClick={() => {
                setPendingExportMode(exportSortMode);
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
            <input
              id="rosterImportInput"
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                importFromExcel(file, "replace");
                e.target.value = "";
              }}
            />
            <button
              className="btn"
              type="button"
              onClick={() => document.getElementById("rosterImportInput")?.click()}
            >
              📥 Import Replace
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
                  if (file) importFromExcel(file, "merge");
                };
                input.click();
              }}
            >
              ➕ Import Add/Merge
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
            <button className="btn" type="button" onClick={clearHighlights}>
              🟡 Refresh Highlights
            </button>
            <button className="btn" type="button" onClick={handleDeduplicate}>
              🧹 Remove Duplicates
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
            <button className="btn btn-danger" type="button" onClick={clearAllRosterData}>
              🗑️ Clear Roster Data
            </button>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="data-page">
        <div className="data-page-grid">
          {/* LEFT – form */}
          <section className="data-card">
            <div className="data-card-header">
              <h2>{editingId ? "Edit personnel" : "Add personnel"}</h2>
              {editingId && <span className="badge">Editing existing</span>}
            </div>

            <form className="data-form" onSubmit={handleSubmit}>
              <div className="data-form-grid">
                <div className="field">
                  <label>Rank</label>
                  <input
                    value={form.rank}
                    onChange={(e) => handleChange("rank", e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Item no.</label>
                  <input
                    value={form.itemNo}
                    onChange={(e) => handleChange("itemNo", e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Account no.</label>
                  <input
                    value={form.accntNo}
                    onChange={(e) => handleChange("accntNo", e.target.value)}
                    onBlur={handleAccntBlur}
                    placeholder="Type an existing account no. to auto-fill."
                  />
                </div>

                <div className="field">
                  <label>Last name</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>First name</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => handleChange("firstName", e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Middle name</label>
                  <input
                    value={form.middleName}
                    onChange={(e) => handleChange("middleName", e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Unit code</label>
                  <input
                    value={form.unitCode}
                    onChange={(e) => handleChange("unitCode", e.target.value)}
                  />
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

                <div className="field">
                  <label>Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => handleChange("gender", e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div className="field">
                  <label>Status</label>
                  <input
                    value={form.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                    placeholder="Active, detailed, etc."
                  />
                </div>

                <div className="field">
                  <label>Remarks</label>
                  <textarea
                    rows={2}
                    value={form.remarks}
                    onChange={(e) => handleChange("remarks", e.target.value)}
                  />
                </div>
              </div>

              <div className="subsection-header">
                <h3>Designation history</h3>
                <p>Add multiple designations for this personnel.</p>
              </div>

              <details className="designation-library-card">
                <summary>
                  Designation dropdown list ({designationOptions.length})
                </summary>
                <p>
                  Paste one designation per line. This list is saved in this browser
                  and shown as dropdown suggestions while still allowing manual typing.
                </p>
                <textarea
                  rows={6}
                  value={designationLibraryDraft}
                  onChange={(e) => setDesignationLibraryDraft(e.target.value)}
                  placeholder={"Chief Administrative Branch\nChief Fire Prevention Branch\nOIC, Fire Station"}
                />
                <div className="designation-library-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleSaveDesignationLibrary}
                  >
                    Save list
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleClearDesignationLibrary}
                  >
                    Clear list
                  </button>
                </div>
              </details>

              <datalist id="roster-designation-options">
                {designationOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>

              <div className="designation-list">
                {designations.map((row, idx) => (
                  <div key={row.id} className="designation-row">
                    <div className="field">
                      <label>Designation</label>
                      <input
                        list="roster-designation-options"
                        value={row.designation}
                        onChange={(e) =>
                          handleDesignationChange(row.id, "designation", e.target.value)
                        }
                        placeholder="Type or pick from the dropdown list"
                      />
                      <div className="field-help">
                        Start typing to select from the saved list, or enter a new
                        designation manually.
                      </div>
                    </div>

                    <div className="field">
                      <label>Authority</label>
                      <input
                        value={row.authority}
                        onChange={(e) =>
                          handleDesignationChange(row.id, "authority", e.target.value)
                        }
                        placeholder="e.g. SO No. Memorandum"
                      />
                    </div>

                    <div className="field">
                      <label>Date of order</label>
                      <input
                        type="date"
                        value={row.dateOfOrder}
                        onChange={(e) =>
                          handleDesignationChange(row.id, "dateOfOrder", e.target.value)
                        }
                      />
                    </div>

                    <div className="designation-actions">
                      {designations.length > 1 && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => removeDesignationRow(row.id)}
                        >
                          ✕
                        </button>
                      )}
                      {idx === designations.length - 1 && (
                        <button type="button" className="btn-ghost" onClick={addDesignationRow}>
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingId ? "Update roster" : "Save to roster"}
                </button>
                <button type="button" className="btn-ghost" onClick={clearForm}>
                  Clear form
                </button>
              </div>
            </form>
          </section>

          {/* RIGHT – roster table */}
          <section className="data-card">
            <div className="data-card-header">
              <h2>Current roster</h2>
              <span className="muted">{personnel.length} personnel</span>
            </div>

            <div className="data-card-body">
              {/* Search Bar */}
              <div style={{ marginBottom: 10 }}>
                <div className="search-wrap">
                  <span className="search-icon">🔎</span>
                  <input
                    className="search-input"
                    placeholder="Search by name, unit, account no."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Last name</th>
                      <th>First name</th>
                      <th>Unit</th>
                      <th>Accnt no.</th>
                      <th>Present designation</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          No personnel yet. Add an entry using the form on the left.
                        </td>
                      </tr>
                    )}
                    {pageData.map((p) => {
                      const latest = (p.designations || [])[p.designations.length - 1];
                      return (
                        <tr
                          key={p.id}
                          className={`${editingId === p.id ? "row-editing" : ""} ${highlightedOpenId === p.id ? "row-opened-highlight" : ""}`.trim()}
                        >
                          <td>{p.rank}</td>
                          <td>{p.lastName}</td>
                          <td>{p.firstName}</td>
                          <td>{p.unitCode}</td>
                          <td>{p.accntNo}</td>
                          <td>{latest ? latest.designation : "-"}</td>
                          <td className="row-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => openPersonForEditing(p)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="link-button danger"
                              onClick={() => handleDeletePerson(p.id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination Bar */}
                <div className="pager-bar">
                  <div className="pager-left">
                    <span className="pager-text">{filtered.length} entries</span>
                  </div>
                  <div className="pager-right">
                    <button
                        className="btn btn-secondary"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Prev
                    </button>
                    <div className="pager-info">
                      Page <b>{page}</b> / {pageCount}
                    </div>
                    <button
                        className="btn btn-secondary"
                        disabled={page >= pageCount}
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      Next
                    </button>
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
            <h3 className="modal-title">Export Roster</h3>
            <p className="modal-subtitle">
              Choose how you want roster sorted.
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