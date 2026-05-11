import React, { useEffect, useMemo, useRef, useState } from "react";
import XLSX from "xlsx-js-style";
import "./Dashboard.css";
import NewsBFP from "./NewsBFP";
import { VIEWS } from "./constants/views";

const ROSTER_STORAGE_KEY = "bfp_roster_v1";
const EDIT_PROFILE_PASSWORD = "1234";
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


const RANK_SHARE_AMOUNTS = {
  FSSUPT: 1000,
  FSUPT: 500,
  FCINSP: 400,
  FSINSP: 300,
  FINSP: 200,
  SFO4: 100,
  SFO3: 100,
  SFO2: 100,
  SFO1: 100,
  FO3: 50,
  FO2: 50,
  FO1: 50,
  NUP: 50,
};

const STRENGTH_BUCKETS = {
  TOTAL: "total",
  ACTIVE: "active",
  DETAILED: "detailed",
  LEAVE: "leave",
  OTHERS: "others",
};

const normalizeText = (value) => String(value || "").trim();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const normalizeRank = (value) => normalizeUpper(value);
const normalizeGender = (value) => normalizeUpper(value);
const normalizeStatus = (value) => normalizeLower(value);

const cmpStr = (a, b) =>
  normalizeUpper(a).localeCompare(normalizeUpper(b));

const unitIndex = (value) => {
  const idx = UNIT_ASSIGNMENT_ORDER.indexOf(normalizeText(value));
  return idx === -1 ? 999 : idx;
};

const rankIndex = (value) => {
  const idx = RANK_ORDER.indexOf(normalizeRank(value));
  return idx === -1 ? 999 : idx;
};

const isOnboarding = (person) => {
  const designations = Array.isArray(person?.designations) ? person.designations : [];
  const text = designations
    .map((designation) => designation?.designation || "")
    .join(" ")
    .toLowerCase();

  return text.includes("onboard");
};

const classifyStrengthStatus = (person) => {
  const status = normalizeStatus(
    person?.status || person?.presentStatus || person?.dutyStatus
  );

  if (status.includes("active")) return STRENGTH_BUCKETS.ACTIVE;
  if (status.includes("detail")) return STRENGTH_BUCKETS.DETAILED;
  if (status.includes("leave")) return STRENGTH_BUCKETS.LEAVE;
  return STRENGTH_BUCKETS.OTHERS;
};

const getRankDistribution = (roster) => {
  const counts = Object.fromEntries(
    RANK_ORDER.map((rank) => [rank, { total: 0, male: 0, female: 0 }])
  );

  roster.forEach((person) => {
    const rank = normalizeRank(person?.rank);
    if (!counts[rank]) return;

    counts[rank].total += 1;

    const gender = normalizeGender(person?.gender);
    if (gender.startsWith("M")) counts[rank].male += 1;
    else if (gender.startsWith("F")) counts[rank].female += 1;
  });

  return RANK_ORDER.map((rank) => ({
    rank,
    total: counts[rank].total,
    male: counts[rank].male,
    female: counts[rank].female,
  }));
};

const getRosterStrengthByUnit = (roster) => {
  const map = new Map();

  roster.forEach((person) => {
    const unit = normalizeText(person?.unitAssignment) || "UNASSIGNED";
    if (!map.has(unit)) {
      map.set(unit, {
        unit,
        total: 0,
        active: 0,
        detailed: 0,
        leave: 0,
        others: 0,
      });
    }

    const row = map.get(unit);
    row.total += 1;
    row[classifyStrengthStatus(person)] += 1;
  });

  return Array.from(map.values()).sort((left, right) => {
    const unitOrder = unitIndex(left.unit) - unitIndex(right.unit);
    return unitOrder !== 0 ? unitOrder : cmpStr(left.unit, right.unit);
  });
};

const formatPersonName = (person) => {
  const last = normalizeText(person?.lastName);
  const first = normalizeText(person?.firstName);
  const middle = normalizeText(person?.middleName);
  const middlePart = middle ? ` ${middle}` : "";
  const firstPart = `${first}${middlePart}`.trim();

  if (last && firstPart) return `${last}, ${firstPart}`;
  if (last) return last;
  if (firstPart) return firstPart;
  if (normalizeText(person?.accntNo)) return person.accntNo;
  return "Unnamed personnel";
};

const getDesignationSummary = (person) => {
  const unique = Array.from(
    new Set(
      (Array.isArray(person?.designations) ? person.designations : [])
        .map((designation) => normalizeText(designation?.designation))
        .filter(Boolean)
    )
  );

  if (!unique.length) return "—";
  if (unique.length <= 3) return unique.join(", ");
  return `${unique.slice(0, 3).join(", ")} +${unique.length - 3} more`;
};

const getLatestDesignation = (person) => {
  const designations = Array.isArray(person?.designations) ? person.designations : [];
  const sorted = [...designations].sort((left, right) =>
    normalizeText(right?.dateOfOrder).localeCompare(normalizeText(left?.dateOfOrder))
  );
  return sorted.find((designation) =>
    normalizeText(designation?.designation) || normalizeText(designation?.authority) || normalizeText(designation?.dateOfOrder)
  ) || null;
};

const getSortedDesignations = (person) => {
  const designations = Array.isArray(person?.designations) ? person.designations : [];
  return [...designations]
    .filter((designation) =>
      normalizeText(designation?.designation) || normalizeText(designation?.authority) || normalizeText(designation?.dateOfOrder)
    )
    .sort((left, right) =>
      normalizeText(right?.dateOfOrder).localeCompare(normalizeText(left?.dateOfOrder))
    );
};

const formatOrderDate = (value) => normalizeText(value) || '—';

const createEmptyDesignation = () => ({
  designation: "",
  authority: "",
  dateOfOrder: "",
});

const createEditablePersonDraft = (person) => ({
  accntNo: normalizeText(person?.accntNo),
  rank: normalizeText(person?.rank),
  lastName: normalizeText(person?.lastName),
  firstName: normalizeText(person?.firstName),
  middleName: normalizeText(person?.middleName),
  unitAssignment: normalizeText(person?.unitAssignment),
  unitCode: normalizeText(person?.unitCode),
  gender: normalizeText(person?.gender),
  status: normalizeText(person?.status || person?.presentStatus || person?.dutyStatus),
  remarks: normalizeText(person?.remarks),
  designations: getSortedDesignations(person).map((designation) => ({
    designation: normalizeText(designation?.designation),
    authority: normalizeText(designation?.authority),
    dateOfOrder: normalizeText(designation?.dateOfOrder),
  })),
});

const cleanEditablePersonDraft = (draft) => ({
  ...draft,
  designations: (Array.isArray(draft?.designations) ? draft.designations : [])
    .map((designation) => ({
      designation: normalizeText(designation?.designation),
      authority: normalizeText(designation?.authority),
      dateOfOrder: normalizeText(designation?.dateOfOrder),
    }))
    .filter(
      (designation) =>
        designation.designation || designation.authority || designation.dateOfOrder
    ),
});

const sortPersonnel = (people) =>
  [...people].sort((left, right) => {
    const rankOrder = rankIndex(left?.rank) - rankIndex(right?.rank);
    if (rankOrder !== 0) return rankOrder;

    const unitOrder = unitIndex(left?.unitAssignment) - unitIndex(right?.unitAssignment);
    if (unitOrder !== 0) return unitOrder;

    const last = cmpStr(left?.lastName, right?.lastName);
    if (last !== 0) return last;

    const first = cmpStr(left?.firstName, right?.firstName);
    if (first !== 0) return first;

    return cmpStr(left?.middleName, right?.middleName);
  });

const buildStrengthDetail = (unit, bucket) => {
  const cleanUnit = normalizeText(unit) || "UNASSIGNED";

  if (bucket === STRENGTH_BUCKETS.TOTAL) {
    return {
      kind: "unit",
      unit: cleanUnit,
      title: cleanUnit,
      subtitle: `Showing all personnel in ${cleanUnit}`,
    };
  }

  const labels = {
    [STRENGTH_BUCKETS.ACTIVE]: "Active",
    [STRENGTH_BUCKETS.DETAILED]: "Detailed",
    [STRENGTH_BUCKETS.LEAVE]: "On Leave",
    [STRENGTH_BUCKETS.OTHERS]: "Others",
  };

  return {
    kind: "unit-status",
    unit: cleanUnit,
    bucket,
    title: `${cleanUnit} — ${labels[bucket]}`,
    subtitle: `Showing ${labels[bucket].toLowerCase()} personnel in ${cleanUnit}`,
  };
};

const buildRankDetail = (rank) => ({
  kind: "rank",
  rank: normalizeRank(rank),
  title: `Rank: ${normalizeRank(rank)}`,
  subtitle: `Showing all personnel with rank ${normalizeRank(rank)}`,
});

const buildUnitRankDetail = (unit, rank) => ({
  kind: "unit-rank",
  unit: normalizeText(unit) || "UNASSIGNED",
  rank: normalizeRank(rank),
  title: `${normalizeText(unit) || "UNASSIGNED"} — ${normalizeRank(rank)}`,
  subtitle: `Showing personnel in ${normalizeText(unit) || "UNASSIGNED"} with rank ${normalizeRank(rank)}`,
});

const getRankCountsByUnit = (roster) => {
  const rows = new Map();

  roster.forEach((person) => {
    const unit = normalizeText(person?.unitAssignment) || "UNASSIGNED";
    const rank = normalizeRank(person?.rank);
    if (!rank) return;

    if (!rows.has(unit)) {
      rows.set(
        unit,
        Object.fromEntries([
          ["unit", unit],
          ...RANK_ORDER.map((rankName) => [rankName, 0]),
          ["total", 0],
        ])
      );
    }

    const row = rows.get(unit);
    if (!(rank in row)) row[rank] = 0;
    row[rank] += 1;
    row.total += 1;
  });

  return Array.from(rows.values()).sort((left, right) => {
    const unitOrder = unitIndex(left.unit) - unitIndex(right.unit);
    return unitOrder !== 0 ? unitOrder : cmpStr(left.unit, right.unit);
  });
};



const getRankShareRowsByUnit = (roster) => {
  const rows = new Map();

  roster.forEach((person) => {
    const unit = normalizeText(person?.unitAssignment) || "UNASSIGNED";
    const rank = normalizeRank(person?.rank);
    if (!RANK_SHARE_AMOUNTS[rank]) return;

    if (!rows.has(unit)) {
      rows.set(
        unit,
        Object.fromEntries([
          ["unit", unit],
          ...Object.keys(RANK_SHARE_AMOUNTS).map((rankName) => [rankName, 0]),
          ["totalShare", 0],
        ])
      );
    }

    const row = rows.get(unit);
    const amount = RANK_SHARE_AMOUNTS[rank];
    row[rank] += amount;
    row.totalShare += amount;
  });

  return Array.from(rows.values()).sort((left, right) => {
    const unitOrder = unitIndex(left.unit) - unitIndex(right.unit);
    return unitOrder !== 0 ? unitOrder : cmpStr(left.unit, right.unit);
  });
};

const downloadTextFile = (filename, content, mimeType = "text/plain;charset=utf-8;") => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const csvEscape = (value) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const toNameTokens = (value) =>
  normalizeLower(value)
    .replace(/[^a-z0-9,\s.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/[\s,.-]+/)
    .filter(Boolean);

const buildSearchStrings = (person) => {
  const first = normalizeText(person?.firstName);
  const middle = normalizeText(person?.middleName);
  const last = normalizeText(person?.lastName);
  const full = [first, middle, last].filter(Boolean).join(" ");
  const reverse = [last, first, middle].filter(Boolean).join(" ");
  const reverseShort = [last, first].filter(Boolean).join(" ");
  return [full, reverse, reverseShort, formatPersonName(person)]
    .map((item) => normalizeLower(item))
    .filter(Boolean);
};

	const findPersonnelByName = (roster, rawInput) => {
	  const query = normalizeText(rawInput);
	  if (!query) return null;

	  const normalizedQuery = query.replace(/\s+/g, "").toUpperCase();

	  // ✅ Try account number match first (flexible match)
	  const accountMatch = roster.find((person) => {
		const acc = normalizeText(person.accntNo)
		  .replace(/\s+/g, "")
		  .toUpperCase();

		return acc === normalizedQuery;
	  });

	  if (accountMatch) return accountMatch;

	  // ✅ Otherwise treat as name search
	  const lowerQuery = normalizeLower(query);
	  const tokens = toNameTokens(lowerQuery);
	  if (!tokens.length) return null;

	  const results = roster.map((person) => {
		const fields = buildSearchStrings(person);
		const haystack = fields.join(" ");

		let score = 0;

		if (fields.includes(lowerQuery)) score += 100;

		tokens.forEach((token) => {
		  if (haystack.includes(token)) score += 15;
		});

		if (normalizeLower(person.lastName) === tokens[0]) score += 30;

		return { person, score };
	  });

	  const matches = results
		.filter((r) => r.score > 0)
		.sort((a, b) => b.score - a.score);

	  return matches.length ? matches[0].person : null;
	};

export default function DashboardHome({ onNavigate } = {}) {
  const [roster, setRoster] = useState([]);
  const [detailFilter, setDetailFilter] = useState(null);
  const detailSectionRef = useRef(null);
  const [lookupInput, setLookupInput] = useState("");
  const [lookupResults, setLookupResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROSTER_STORAGE_KEY) || "[]";
      const parsed = JSON.parse(raw);
      setRoster(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRoster([]);
    }
  }, []);

  useEffect(() => {
    if (!detailFilter || !detailSectionRef.current) return;
    detailSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [detailFilter]);

  useEffect(() => {
    if (!selectedPerson) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedPerson(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPerson]);

  const strength = useMemo(() => getRosterStrengthByUnit(roster), [roster]);
  const rankDist = useMemo(() => getRankDistribution(roster), [roster]);
  const rankByUnit = useMemo(() => getRankCountsByUnit(roster), [roster]);
  const rankShareRows = useMemo(() => getRankShareRowsByUnit(roster), [roster]);

  const recap = useMemo(() => {
    const map = new Map();

    roster.forEach((person) => {
      const unit = normalizeText(person?.unitAssignment) || "Unassigned";
      if (!map.has(unit)) {
        map.set(unit, { unit, regMale: 0, regFemale: 0, opMale: 0, opFemale: 0 });
      }

      const row = map.get(unit);
      const gender = normalizeGender(person?.gender);

      if (isOnboarding(person)) {
        if (gender.startsWith("M")) row.opMale += 1;
        else if (gender.startsWith("F")) row.opFemale += 1;
      } else {
        if (gender.startsWith("M")) row.regMale += 1;
        else if (gender.startsWith("F")) row.regFemale += 1;
      }
    });

    const list = Array.from(map.values()).sort((left, right) => {
      const unitOrder = unitIndex(left.unit) - unitIndex(right.unit);
      return unitOrder !== 0 ? unitOrder : cmpStr(left.unit, right.unit);
    });

    const totals = list.reduce(
      (acc, row) => {
        acc.regMale += row.regMale;
        acc.regFemale += row.regFemale;
        acc.opMale += row.opMale;
        acc.opFemale += row.opFemale;
        return acc;
      },
      { regMale: 0, regFemale: 0, opMale: 0, opFemale: 0 }
    );

    return { list, totals };
  }, [roster]);

  const detailRows = useMemo(() => {
    if (!detailFilter) return [];

    const filtered = roster.filter((person) => {
      if (detailFilter.kind === "unit") {
        return (normalizeText(person?.unitAssignment) || "UNASSIGNED") === detailFilter.unit;
      }

      if (detailFilter.kind === "unit-status") {
        const sameUnit =
          (normalizeText(person?.unitAssignment) || "UNASSIGNED") === detailFilter.unit;
        return sameUnit && classifyStrengthStatus(person) === detailFilter.bucket;
      }

      if (detailFilter.kind === "rank") {
        return normalizeRank(person?.rank) === detailFilter.rank;
      }

      if (detailFilter.kind === "unit-rank") {
        return (
          (normalizeText(person?.unitAssignment) || "UNASSIGNED") === detailFilter.unit &&
          normalizeRank(person?.rank) === detailFilter.rank
        );
      }

      return false;
    });

    return sortPersonnel(filtered);
  }, [detailFilter, roster]);

  const handleLookupSubmit = () => {
    const names = lookupInput
      .split(/\r?\n/)
      .map((line) => normalizeText(line))
      .filter(Boolean)
      .slice(0, 20);

    const results = names.map((name) => {
      const match = findPersonnelByName(roster, name);
      return {
        query: name,
        match,
      };
    });

    setLookupResults(results);
  };

  const handleLookupClear = () => {
    setLookupInput("");
    setLookupResults([]);
  };

  const openPersonProfile = (person) => {
    setSelectedPerson(person);
    setProfileDraft(createEditablePersonDraft(person));
    setIsEditingProfile(false);
  };

  const closePersonProfile = () => {
    setSelectedPerson(null);
    setProfileDraft(null);
    setIsEditingProfile(false);
  };

  const handleProfileBackdrop = (event) => {
    if (event.target === event.currentTarget) {
      closePersonProfile();
    }
  };

  const handleStartEditProfile = () => {
    if (!selectedPerson) return;
    const entered = window.prompt("Enter password to edit this personnel profile:");
    if (entered === null) return;
    if (entered !== EDIT_PROFILE_PASSWORD) {
      alert("Incorrect password. Edit mode was not opened.");
      return;
    }
    setProfileDraft(createEditablePersonDraft(selectedPerson));
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    if (!selectedPerson) return;
    setProfileDraft(createEditablePersonDraft(selectedPerson));
    setIsEditingProfile(false);
  };

  const handleProfileFieldChange = (field, value) => {
    setProfileDraft((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const handleDesignationFieldChange = (index, field, value) => {
    setProfileDraft((prev) => ({
      ...(prev || {}),
      designations: (Array.isArray(prev?.designations) ? prev.designations : []).map((designation, designationIndex) =>
        designationIndex === index ? { ...designation, [field]: value } : designation
      ),
    }));
  };

  const handleAddDesignationRow = () => {
    setProfileDraft((prev) => ({
      ...(prev || {}),
      designations: [...(Array.isArray(prev?.designations) ? prev.designations : []), createEmptyDesignation()],
    }));
  };

  const handleRemoveDesignationRow = (index) => {
    setProfileDraft((prev) => ({
      ...(prev || {}),
      designations: (Array.isArray(prev?.designations) ? prev.designations : []).filter((_, designationIndex) => designationIndex !== index),
    }));
  };

  const handleSaveProfile = () => {
    if (!selectedPerson || !profileDraft) return;

    const cleaned = cleanEditablePersonDraft(profileDraft);
    const currentAccnt = normalizeText(selectedPerson?.accntNo);
    const currentLast = normalizeText(selectedPerson?.lastName);
    const currentFirst = normalizeText(selectedPerson?.firstName);
    const currentMiddle = normalizeText(selectedPerson?.middleName);

    const updatedRoster = roster.map((person) => {
      const sameAccount = currentAccnt && normalizeText(person?.accntNo) === currentAccnt;
      const sameName =
        normalizeText(person?.lastName) === currentLast &&
        normalizeText(person?.firstName) === currentFirst &&
        normalizeText(person?.middleName) === currentMiddle;

      if (!sameAccount && !sameName) return person;

      return {
        ...person,
        accntNo: cleaned.accntNo,
        rank: cleaned.rank,
        lastName: cleaned.lastName,
        firstName: cleaned.firstName,
        middleName: cleaned.middleName,
        unitAssignment: cleaned.unitAssignment,
        unitCode: cleaned.unitCode,
        gender: cleaned.gender,
        status: cleaned.status,
        remarks: cleaned.remarks,
        designations: cleaned.designations,
      };
    });

    setRoster(updatedRoster);
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(updatedRoster));

    const refreshedPerson = updatedRoster.find((person) => {
      const sameAccount = cleaned.accntNo && normalizeText(person?.accntNo) === cleaned.accntNo;
      const sameName =
        normalizeText(person?.lastName) === cleaned.lastName &&
        normalizeText(person?.firstName) === cleaned.firstName &&
        normalizeText(person?.middleName) === cleaned.middleName;
      return sameAccount || sameName;
    }) || {
      ...selectedPerson,
      ...cleaned,
    };

    setSelectedPerson(refreshedPerson);
    setProfileDraft(createEditablePersonDraft(refreshedPerson));
    setIsEditingProfile(false);
  };

  const handleEditInRoster = () => {
    if (!selectedPerson) return;

    const target = {
      accntNo: normalizeText(selectedPerson?.accntNo),
      lastName: normalizeText(selectedPerson?.lastName),
      firstName: normalizeText(selectedPerson?.firstName),
      middleName: normalizeText(selectedPerson?.middleName),
      source: "dashboard-profile",
      requestedAt: new Date().toISOString(),
    };

    localStorage.setItem("bfp_roster_edit_target", JSON.stringify(target));
    window.dispatchEvent(new CustomEvent("bfp:open-roster-edit", { detail: target }));

    closePersonProfile();

    if (typeof onNavigate === "function") {
      onNavigate(VIEWS?.ROSTER ?? "ROSTER");
    }
  };

  const handleExportRankWorkbook = () => {
    const shareRanks = Object.keys(RANK_SHARE_AMOUNTS);

    const blankZero = (value) => (value ? value : "");

    const shareSheetRows = [
      ["Station / Unit", ...shareRanks.map((rank) => `${rank} Share`), "Total Share"],
      ...rankShareRows.map((shareRow) => [
        shareRow.unit,
        ...shareRanks.map((rank) => blankZero(shareRow[rank] || 0)),
        blankZero(shareRow.totalShare || 0),
      ]),
      [
        "GRAND TOTAL",
        ...shareRanks.map((rank) => blankZero(rankShareRows.reduce((sum, row) => sum + (row[rank] || 0), 0))),
        blankZero(rankShareRows.reduce((sum, row) => sum + (row.totalShare || 0), 0)),
      ],
    ];

    const countSheetRows = [
      ["Station / Unit", ...shareRanks.map((rank) => `${rank} Count`), "Total Count"],
      ...rankByUnit.map((countRow) => [
        countRow.unit,
        ...shareRanks.map((rank) => blankZero(countRow[rank] || 0)),
        blankZero(shareRanks.reduce((sum, rank) => sum + (countRow[rank] || 0), 0)),
      ]),
      [
        "GRAND TOTAL",
        ...shareRanks.map((rank) => blankZero(rankByUnit.reduce((sum, row) => sum + (row[rank] || 0), 0))),
        blankZero(
          shareRanks.reduce(
            (sum, rank) => sum + rankByUnit.reduce((rankSum, row) => rankSum + (row[rank] || 0), 0),
            0
          )
        ),
      ],
    ];

    const workbook = XLSX.utils.book_new();
    const shareSheet = XLSX.utils.aoa_to_sheet(shareSheetRows);
    const countSheet = XLSX.utils.aoa_to_sheet(countSheetRows);

    const thinBorder = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    };

    const applySheetStyle = (sheet, rows) => {
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1:A1");
      for (let r = range.s.r; r <= range.e.r; r += 1) {
        for (let c = range.s.c; c <= range.e.c; c += 1) {
          const address = XLSX.utils.encode_cell({ r, c });
          if (!sheet[address]) {
            sheet[address] = { t: "s", v: "" };
          }

          const isHeader = r === 0;
          const isTotal = r === rows.length - 1;
          const isFirstCol = c === 0;
          const value = sheet[address].v;
          const isNumeric = typeof value === "number";

          sheet[address].s = {
            border: thinBorder,
            alignment: {
              horizontal: isFirstCol ? "left" : "center",
              vertical: "center",
            },
            font: {
              bold: isHeader || isTotal,
            },
            fill: isHeader
              ? { fgColor: { rgb: "D9EAF7" } }
              : isTotal
              ? { fgColor: { rgb: "F2F2F2" } }
              : undefined,
            numFmt: isNumeric ? '#,##0' : undefined,
          };
        }
      }
    };

    applySheetStyle(shareSheet, shareSheetRows);
    applySheetStyle(countSheet, countSheetRows);

    shareSheet["!cols"] = [
      { wch: 32 },
      ...shareRanks.map(() => ({ wch: 12 })),
      { wch: 14 },
    ];
    countSheet["!cols"] = [
      { wch: 32 },
      ...shareRanks.map(() => ({ wch: 12 })),
      { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(workbook, shareSheet, "Rank Share");
    XLSX.utils.book_append_sheet(workbook, countSheet, "Personnel Count");
    XLSX.writeFile(workbook, "rank-share-and-count-by-station.xlsx");
  };

  const totalPersonnel = roster.length;
  const totalOnboarding = roster.filter(isOnboarding).length;

  return (
    <div className="dash-home">
      <div className="kpi-grid">
        <div className="card kpi">
          <div className="kpi-label">Total personnel</div>
          <div className="kpi-value">{totalPersonnel}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Onboarding</div>
          <div className="kpi-value">{totalOnboarding}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Units</div>
          <div className="kpi-value">{recap.list.length}</div>
        </div>
      </div>

      <div className="card section">
        <div className="section-heading-row">
          <div>
            <h2>Personnel Strength by Unit</h2>
            <p className="section-caption">
              Click any unit or status count to see the matching personnel list.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table dashboard-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Total</th>
                <th>Active</th>
                <th>Detailed</th>
                <th>On Leave</th>
                <th>Others</th>
              </tr>
            </thead>
            <tbody>
              {strength.map((unit) => (
                <tr key={unit.unit}>
                  <td>
                    <button
                      type="button"
                      className="table-action-button table-action-button-text"
                      onClick={() => setDetailFilter(buildStrengthDetail(unit.unit, STRENGTH_BUCKETS.TOTAL))}
                    >
                      {unit.unit}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setDetailFilter(buildStrengthDetail(unit.unit, STRENGTH_BUCKETS.TOTAL))}
                    >
                      {unit.total}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setDetailFilter(buildStrengthDetail(unit.unit, STRENGTH_BUCKETS.ACTIVE))}
                    >
                      {unit.active}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setDetailFilter(buildStrengthDetail(unit.unit, STRENGTH_BUCKETS.DETAILED))}
                    >
                      {unit.detailed}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setDetailFilter(buildStrengthDetail(unit.unit, STRENGTH_BUCKETS.LEAVE))}
                    >
                      {unit.leave}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setDetailFilter(buildStrengthDetail(unit.unit, STRENGTH_BUCKETS.OTHERS))}
                    >
                      {unit.others}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <div className="section-heading-row">
          <div>
            <h2>Rank Distribution</h2>
            <p className="section-caption">
              Click a rank to show personnel with that rank.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table dashboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Total</th>
                <th>Male</th>
                <th>Female</th>
              </tr>
            </thead>
            <tbody>
              {rankDist.map((rank) => (
                <tr key={rank.rank}>
                  <td>
                    <button
                      type="button"
                      className="table-action-button table-action-button-text"
                      onClick={() => setDetailFilter(buildRankDetail(rank.rank))}
                    >
                      {rank.rank}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setDetailFilter(buildRankDetail(rank.rank))}
                    >
                      <span className="badge blue">{rank.total}</span>
                    </button>
                  </td>
                  <td>{rank.male}</td>
                  <td>{rank.female}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <div className="section-heading-row">
          <div>
            <h2>Personnel Count by Rank and Station</h2>
            <p className="section-caption">
              Separate table for personnel count per rank and station. Click any count to show the matching personnel list.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table dashboard-table rank-station-table">
            <thead>
              <tr>
                <th>Station / Unit</th>
                {RANK_ORDER.map((rank) => (
                  <th key={rank}>{rank}</th>
                ))}
                <th>Total Personnel</th>
              </tr>
            </thead>
            <tbody>
              {rankByUnit.map((row) => (
                <tr key={`count-${row.unit}`}>
                  <td className="rank-station-name">{row.unit}</td>
                  {RANK_ORDER.map((rank) => (
                    <td key={`count-${row.unit}-${rank}`}>
                      {row[rank] ? (
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => setDetailFilter(buildUnitRankDetail(row.unit, rank))}
                          title={`Show ${rank} personnel in ${row.unit}`}
                        >
                          <span className="badge">{row[rank]}</span>
                        </button>
                      ) : (
                        <span className="muted-cell">0</span>
                      )}
                    </td>
                  ))}
                  <td><span className="badge blue">{row.total}</span></td>
                </tr>
              ))}
              <tr className="rank-share-total-row">
                <td><strong>Grand Total</strong></td>
                {RANK_ORDER.map((rank) => {
                  const total = rankByUnit.reduce((sum, row) => sum + (row[rank] || 0), 0);
                  return <td key={`count-grand-${rank}`}><strong>{total}</strong></td>;
                })}
                <td><strong>{rankByUnit.reduce((sum, row) => sum + (row.total || 0), 0)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <div className="section-heading-row">
          <div>
            <h2>Personnel Unit Finder</h2>
            <p className="section-caption">
				Paste or type up to 20 personnel names or account numbers, one per line, to find their station or unit assignment.
			</p>
          </div>
        </div>

        <div className="personnel-lookup-card">
          <textarea
            className="lookup-textarea"
            rows={6}
            placeholder={`Dela Cruz, Juan
Juan Santos Reyes
Lopez, Maria`}
            value={lookupInput}
            onChange={(e) => setLookupInput(e.target.value)}
          />
          <div className="designation-library-actions">
            <button type="button" className="btn" onClick={handleLookupSubmit}>
              Find personnel
            </button>
            <button type="button" className="btn secondary" onClick={handleLookupClear}>
              Clear
            </button>
          </div>
          <p className="field-help">
			Only the first 20 non-empty entries will be checked.
			</p>
          {lookupResults.length ? (
            <div className="lookup-results-grid">
              {lookupResults.map((result, index) => (
                <div className="lookup-result-card" key={`${result.query}-${index}`}>
                  <div className="lookup-result-query">{result.query}</div>
                  {result.match ? (
                    <>
                      <div><strong>Name:</strong> <button type="button" className="table-action-button table-action-button-text" onClick={() => openPersonProfile(result.match)}>{formatPersonName(result.match)}</button></div>
                      <div><strong>Account No:</strong> {normalizeText(result.match.accntNo) || "—"}</div>
                      <div><strong>Rank:</strong> {normalizeText(result.match.rank) || "—"}</div>
                      <div><strong>Station / Unit:</strong> {normalizeText(result.match.unitAssignment) || "UNASSIGNED"}</div>
                      <div><strong>Designation:</strong> {getDesignationSummary(result.match)}</div>
                    </>
                  ) : (
                    <div className="lookup-result-missing">No matching personnel found.</div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {detailFilter ? (
        <div className="card section dashboard-detail-section" ref={detailSectionRef}>
          <div className="dashboard-detail-head">
            <div>
              <h2>{detailFilter.title}</h2>
              <p className="section-caption">{detailFilter.subtitle}</p>
            </div>
            <div className="dashboard-detail-actions">
              <span className="badge">{detailRows.length} result{detailRows.length === 1 ? "" : "s"}</span>
              <button
                type="button"
                className="btn small"
                onClick={() => setDetailFilter(null)}
              >
                Clear filter
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table dashboard-table dashboard-detail-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Account No</th>
                  <th>Rank</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Designation</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.length ? (
                  detailRows.map((person, index) => (
                    <tr key={`${person.accntNo || "NA"}-${person.lastName || ""}-${person.firstName || ""}-${index}`}>
                      <td><button type="button" className="table-action-button table-action-button-text" onClick={() => openPersonProfile(person)}>{formatPersonName(person)}</button></td>
                      <td>{normalizeText(person.accntNo) || "—"}</td>
                      <td>{normalizeText(person.rank) || "—"}</td>
                      <td>{normalizeText(person.unitAssignment) || "UNASSIGNED"}</td>
                      <td>{normalizeText(person.status || person.presentStatus || person.dutyStatus) || "—"}</td>
                      <td>{getDesignationSummary(person)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state-inline">No personnel matched this filter.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <details className="card section rank-share-dropdown">
        <summary className="rank-share-dropdown-summary">
          <div>
            <h2>Rank Share by Station</h2>
            <p className="section-caption">
              Click to open the rank share tools only when you need them.
            </p>
          </div>
        </summary>

        <div className="rank-share-dropdown-content">
          <div className="section-heading-row">
            <div>
              <p className="section-caption">
                Amount to share per station based on your fixed rank amounts. Use export to download the full table.
              </p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleExportRankWorkbook}
            >
              Export Excel workbook
            </button>
            <span className="field-help">Sheet 1: Rank Share · Sheet 2: Personnel Count</span>
          </div>

          <div className="table-wrap">
            <table className="data-table dashboard-table rank-share-table">
              <thead>
                <tr>
                  <th>Station / Unit</th>
                  {Object.keys(RANK_SHARE_AMOUNTS).map((rank) => (
                    <th key={rank}>{rank}</th>
                  ))}
                  <th>Total Share</th>
                </tr>
              </thead>
              <tbody>
                {rankShareRows.map((row) => (
                  <tr key={`share-${row.unit}`}>
                    <td className="rank-station-name">{row.unit}</td>
                    {Object.keys(RANK_SHARE_AMOUNTS).map((rank) => (
                      <td key={`share-${row.unit}-${rank}`}>
                        {row[rank] ? (
                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => setDetailFilter(buildUnitRankDetail(row.unit, rank))}
                            title={`Show ${rank} personnel in ${row.unit}`}
                          >
                            ₱{row[rank].toLocaleString()}
                          </button>
                        ) : (
                          <span className="muted-cell">₱0</span>
                        )}
                      </td>
                    ))}
                    <td><span className="badge blue">₱{(row.totalShare || 0).toLocaleString()}</span></td>
                  </tr>
                ))}
                <tr className="rank-share-total-row">
                  <td><strong>Grand Total</strong></td>
                  {Object.keys(RANK_SHARE_AMOUNTS).map((rank) => {
                    const total = rankShareRows.reduce((sum, row) => sum + (row[rank] || 0), 0);
                    return <td key={`grand-${rank}`}><strong>₱{total.toLocaleString()}</strong></td>;
                  })}
                  <td><strong>₱{rankShareRows.reduce((sum, row) => sum + (row.totalShare || 0), 0).toLocaleString()}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </details>

      {selectedPerson ? (
        <div className="dashboard-profile-overlay" onClick={handleProfileBackdrop}>
          <div className="card section dashboard-profile-modal" role="dialog" aria-modal="true" aria-label="Personnel profile">
            <div className="dashboard-profile-modal-head">
              <div>
                <h2>{isEditingProfile ? `Edit Profile: ${formatPersonName(selectedPerson)}` : formatPersonName(selectedPerson)}</h2>
                <p className="section-caption">
                  {isEditingProfile ? "Update personnel details and designation history, then save changes." : "Full personnel profile from the current roster."}
                </p>
              </div>
              <div className="dashboard-detail-actions">
                {!isEditingProfile ? (
                  <>
                    <button type="button" className="btn small" onClick={handleStartEditProfile}>Edit in popup</button>
                    <button type="button" className="btn small secondary" onClick={handleEditInRoster}>Open in Roster</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn small" onClick={handleSaveProfile}>Save changes</button>
                    <button type="button" className="btn small secondary" onClick={handleCancelEditProfile}>Cancel edit</button>
                  </>
                )}
                <button type="button" className="btn small dashboard-profile-close" onClick={closePersonProfile}>Close</button>
              </div>
            </div>

            <div className="profile-highlight-grid">
              <div className="profile-highlight-card">
                <div className="kpi-label">Rank</div>
                <div className="profile-highlight-value">
                  {isEditingProfile ? (
                    <input className="input" value={profileDraft?.rank || ""} onChange={(e) => handleProfileFieldChange("rank", e.target.value)} />
                  ) : (
                    normalizeText(selectedPerson.rank) || '—'
                  )}
                </div>
              </div>
              <div className="profile-highlight-card">
                <div className="kpi-label">Account No</div>
                <div className="profile-highlight-value">
                  {isEditingProfile ? (
                    <input className="input" value={profileDraft?.accntNo || ""} onChange={(e) => handleProfileFieldChange("accntNo", e.target.value)} />
                  ) : (
                    normalizeText(selectedPerson.accntNo) || '—'
                  )}
                </div>
              </div>
              <div className="profile-highlight-card">
                <div className="kpi-label">Station / Unit</div>
                <div className="profile-highlight-value">
                  {isEditingProfile ? (
                    <select
                      className="input"
                      value={profileDraft?.unitAssignment || ""}
                      onChange={(e) => {
                        const unit = e.target.value;
                        handleProfileFieldChange("unitAssignment", unit);
                        const unitCodeMap = {
                          "OPFM - PAMPANGA": "30500",
                          "Angeles City Fire Station": "30501",
                          "Apalit FS, Pampanga": "30502",
                          "Arayat FS, Pampanga": "30503",
                          "Bacolor FS, Pampanga": "30504",
                          "Candaba FS, Pampanga": "30505",
                          "Floridablanca FS, Pampanga": "30506",
                          "Guagua Fire Station": "30507",
                          "Lubao FS, Pampanga": "30508",
                          "Mabalacat City FS, Pampanga": "30509",
                          "Macabebe FS, Pampanga": "30510",
                          "Magalang FS, Pampanga": "30511",
                          "Masantol FS, Pampanga": "30512",
                          "Mexico FS, Pampanga": "30513",
                          "Minalin FS, Pampanga": "30514",
                          "Porac FS, Pampanga": "30515",
                          "City of San Fernando FS, Pampanga": "30516",
                          "San Luis FS, Pampanga": "30517",
                          "San Simon FS, Pampanga": "30518",
                          "Sasmuan FS, Pampanga": "30519",
                          "Sta Ana FS, Pampanga": "30520",
                          "Sta Rita FS, Pampanga": "30521",
                          "Sto. Tomas Fire Station": "30522",
                        };
                        handleProfileFieldChange("unitCode", unitCodeMap[unit] || "");
                      }}
                    >
                      <option value="">Select unit assignment</option>
                      {UNIT_ASSIGNMENT_ORDER.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  ) : (
                    normalizeText(selectedPerson.unitAssignment) || 'UNASSIGNED'
                  )}
                </div>
              </div>
            </div>

            <div className="profile-detail-grid">
              <div className="profile-info-card">
                <div className="profile-card-title">Personnel Details</div>
                {isEditingProfile ? (
                  <div className="profile-info-list" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                    <label><strong>Last Name</strong><input className="input" value={profileDraft?.lastName || ""} onChange={(e) => handleProfileFieldChange("lastName", e.target.value)} /></label>
                    <label><strong>First Name</strong><input className="input" value={profileDraft?.firstName || ""} onChange={(e) => handleProfileFieldChange("firstName", e.target.value)} /></label>
                    <label><strong>Middle Name</strong><input className="input" value={profileDraft?.middleName || ""} onChange={(e) => handleProfileFieldChange("middleName", e.target.value)} /></label>
                    <label><strong>Unit Code</strong><input className="input" value={profileDraft?.unitCode || ""} onChange={(e) => handleProfileFieldChange("unitCode", e.target.value)} /></label>
                    <label><strong>Gender</strong><input className="input" value={profileDraft?.gender || ""} onChange={(e) => handleProfileFieldChange("gender", e.target.value)} /></label>
                    <label><strong>Status</strong><input className="input" value={profileDraft?.status || ""} onChange={(e) => handleProfileFieldChange("status", e.target.value)} /></label>
                    <label style={{ gridColumn: "1 / -1" }}><strong>Remarks</strong><textarea className="lookup-textarea" rows={3} value={profileDraft?.remarks || ""} onChange={(e) => handleProfileFieldChange("remarks", e.target.value)} /></label>
                  </div>
                ) : (
                  <div className="profile-info-list">
                    <div><strong>Gender:</strong> {normalizeText(selectedPerson.gender) || '—'}</div>
                    <div><strong>Status:</strong> {normalizeText(selectedPerson.status || selectedPerson.presentStatus || selectedPerson.dutyStatus) || '—'}</div>
                    <div><strong>Remarks:</strong> {normalizeText(selectedPerson.remarks) || '—'}</div>
                    <div><strong>Unit Code:</strong> {normalizeText(selectedPerson.unitCode) || '—'}</div>
                  </div>
                )}
              </div>
              <div className="profile-info-card">
                <div className="profile-card-title">Latest Designation</div>
                {isEditingProfile ? (
                  <div className="profile-info-list">
                    <div>The latest designation is always taken from the most recent Date of Order below.</div>
                    <div><strong>Tip:</strong> Add, edit, or remove rows in the history table before saving.</div>
                  </div>
                ) : getLatestDesignation(selectedPerson) ? (
                  <div className="profile-info-list">
                    <div><strong>Designation:</strong> {normalizeText(getLatestDesignation(selectedPerson)?.designation) || '—'}</div>
                    <div><strong>Authority:</strong> {normalizeText(getLatestDesignation(selectedPerson)?.authority) || '—'}</div>
                    <div><strong>Date of Order:</strong> {formatOrderDate(getLatestDesignation(selectedPerson)?.dateOfOrder)}</div>
                  </div>
                ) : (
                  <div className="lookup-result-missing">No designation history recorded.</div>
                )}
              </div>
            </div>

            <div className="profile-history-card">
              <div className="profile-card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <span>Designation History</span>
                {isEditingProfile ? (
                  <button type="button" className="btn small" onClick={handleAddDesignationRow}>Add designation</button>
                ) : null}
              </div>
              <div className="table-wrap profile-history-wrap">
                <table className="data-table dashboard-table dashboard-detail-table profile-history-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Designation</th>
                      <th>Authority</th>
                      <th>Date of Order</th>
                      {isEditingProfile ? <th>Action</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {isEditingProfile ? (
                      (profileDraft?.designations?.length ? profileDraft.designations : [createEmptyDesignation()]).map((designation, index) => (
                        <tr key={`edit-designation-${index}`}>
                          <td>{index + 1}</td>
                          <td><input className="input" value={designation.designation || ""} onChange={(e) => handleDesignationFieldChange(index, "designation", e.target.value)} /></td>
                          <td><input className="input" value={designation.authority || ""} onChange={(e) => handleDesignationFieldChange(index, "authority", e.target.value)} /></td>
                          <td><input className="input" type="date" value={designation.dateOfOrder || ""} onChange={(e) => handleDesignationFieldChange(index, "dateOfOrder", e.target.value)} /></td>
                          <td><button type="button" className="btn small secondary" onClick={() => handleRemoveDesignationRow(index)}>Remove</button></td>
                        </tr>
                      ))
                    ) : getSortedDesignations(selectedPerson).length ? (
                      getSortedDesignations(selectedPerson).map((designation, index) => (
                        <tr key={`${normalizeText(designation.designation)}-${normalizeText(designation.authority)}-${normalizeText(designation.dateOfOrder)}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{normalizeText(designation.designation) || '—'}</td>
                          <td>{normalizeText(designation.authority) || '—'}</td>
                          <td>{formatOrderDate(designation.dateOfOrder)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={isEditingProfile ? "5" : "4"}><div className="empty-state-inline">No designation history found for this personnel.</div></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <NewsBFP limit={6} />
    </div>
  );
}

