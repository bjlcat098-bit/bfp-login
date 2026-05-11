import React, { useEffect, useMemo, useState } from "react";
import "./Dashboard.css";

const PDM_STORAGE_KEY = "bfp_pdm_v1";
const LEAVE_STORAGE_KEY = "bfp_leave_v2";

// CSC Omnibus Rules on Leave: 15 VL + 15 SL annually ≈ 1.25 per month each.
// We also support LWOP-aware accrual via "24 days actual service = 1 day credit" rule-of-thumb.
const MAX_MONTHLY_CREDIT = 1.25;
const DAYS_PER_LEAVE_CREDIT = 24;

const loadJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const saveJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const normalizeAcc = (a) => String(a || "").trim();

const isValidDate = (d) => d instanceof Date && !isNaN(d);

const startOfMonth = (y, m) => new Date(y, m, 1);
const endOfMonth = (y, m) => new Date(y, m + 1, 0);

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

// Inclusive day count (calendar days)
const daysBetweenInclusive = (from, to) => {
  const a = new Date(from);
  const b = new Date(to);
  if (!isValidDate(a) || !isValidDate(b)) return 0;
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
};

// Working-day count (Mon–Fri), inclusive. (Holidays not handled)
const workingDaysBetweenInclusive = (from, to) => {
  const a = new Date(from);
  const b = new Date(to);
  if (!isValidDate(a) || !isValidDate(b)) return 0;
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  if (b < a) return 0;

  let c = new Date(a);
  let count = 0;
  while (c <= b) {
    const dow = c.getDay(); // 0 Sun ... 6 Sat
    if (dow !== 0 && dow !== 6) count++;
    c.setDate(c.getDate() + 1);
  }
  return count;
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;

// Compute overlap days between two date ranges [a1,a2] and [b1,b2], inclusive.
// If workingOnly=true, counts Mon–Fri only.
const overlapDays = (a1, a2, b1, b2, workingOnly = false) => {
  const start = new Date(Math.max(new Date(a1).getTime(), new Date(b1).getTime()));
  const end = new Date(Math.min(new Date(a2).getTime(), new Date(b2).getTime()));
  if (!isValidDate(start) || !isValidDate(end) || end < start) return 0;
  const s = iso(start);
  const e = iso(end);
  return workingOnly ? workingDaysBetweenInclusive(s, e) : daysBetweenInclusive(s, e);
};

// Service months count (whole months elapsed), used for simple display only.
const monthsOfService = (startISO, asOfISO) => {
  if (!startISO) return 0;
  const start = new Date(startISO);
  const asOf = new Date(asOfISO);
  if (!isValidDate(start) || !isValidDate(asOf)) return 0;

  let months =
    (asOf.getFullYear() - start.getFullYear()) * 12 +
    (asOf.getMonth() - start.getMonth());

  if (asOf.getDate() < start.getDate()) months--;
  return Math.max(0, months);
};

// Compute accrued credits month-by-month using "actual service" days per month.
// We deduct LWOP (withPay === "NO" OR leaveType === "LWOP") days from the month.
const computeAccrual = ({ startISO, asOfISO, leaveRows }) => {
  if (!startISO) return { accruedVL: 0, accruedSL: 0, breakdown: [] };

  const start = new Date(startISO);
  const asOf = new Date(asOfISO);
  if (!isValidDate(start) || !isValidDate(asOf)) return { accruedVL: 0, accruedSL: 0, breakdown: [] };

  // start at month of start date
  let y = start.getFullYear();
  let m = start.getMonth();

  const endY = asOf.getFullYear();
  const endM = asOf.getMonth();

  let accruedVL = 0;
  let accruedSL = 0;
  const breakdown = [];

  // Pre-normalize LWOP ranges
  const lwop = (leaveRows || [])
    .filter((r) => {
      const lt = String(r.leaveType || "").toUpperCase();
      const wp = String(r.withPay || "YES").toUpperCase();
      return lt === "LWOP" || wp === "NO";
    })
    .map((r) => ({
      from: r.dateFrom,
      to: r.dateTo,
      days: Number(r.days || 0) || 0,
      // We assume calendar days for LWOP impact; agencies may handle differently for weekends/holidays.
      // Keep it consistent and transparent.
    }))
    .filter((r) => r.from && r.to);

  while (y < endY || (y === endY && m <= endM)) {
    const ms = startOfMonth(y, m);
    const me = endOfMonth(y, m);

    // Clip first/last month to service window
    const clipStart = new Date(Math.max(ms.getTime(), start.getTime()));
    const clipEnd = new Date(Math.min(me.getTime(), asOf.getTime()));

    if (clipEnd < clipStart) {
      // move next month
      m++;
      if (m > 11) { m = 0; y++; }
      continue;
    }

    const totalDays = daysBetweenInclusive(iso(clipStart), iso(clipEnd));

    // Count LWOP overlap in this month window
    let lwopDays = 0;
    for (const r of lwop) {
      lwopDays += overlapDays(r.from, r.to, iso(clipStart), iso(clipEnd), false);
    }

    const actualServiceDays = Math.max(0, totalDays - lwopDays);

    // Convert actual service days to leave credits for the month (cap at 1.25).
    const earned = clamp(actualServiceDays / DAYS_PER_LEAVE_CREDIT, 0, MAX_MONTHLY_CREDIT);

    accruedVL += earned;
    accruedSL += earned;

    breakdown.push({
      month: monthKey(y, m),
      windowDays: totalDays,
      lwopDays,
      actualServiceDays,
      earned: Number(earned.toFixed(3)),
    });

    m++;
    if (m > 11) { m = 0; y++; }
  }

  return {
    accruedVL: Number(accruedVL.toFixed(3)),
    accruedSL: Number(accruedSL.toFixed(3)),
    breakdown,
  };
};

// Next credit "due" date (display helper): end of current month, plus a warning if LWOP likely prevents full credit.
const computeNextCreditInfo = ({ asOfISO, leaveRows }) => {
  const today = new Date(asOfISO);
  if (!isValidDate(today)) return { nextCreditDate: "", eligibleThisMonth: true };

  const y = today.getFullYear();
  const m = today.getMonth();
  const eom = endOfMonth(y, m);

  // LWOP overlap for current month up to end-of-month
  const ms = startOfMonth(y, m);
  const totalDays = daysBetweenInclusive(iso(ms), iso(eom));

  const lwop = (leaveRows || []).filter((r) => {
    const lt = String(r.leaveType || "").toUpperCase();
    const wp = String(r.withPay || "YES").toUpperCase();
    return lt === "LWOP" || wp === "NO";
  });

  let lwopDays = 0;
  for (const r of lwop) {
    if (!r.dateFrom || !r.dateTo) continue;
    lwopDays += overlapDays(r.dateFrom, r.dateTo, iso(ms), iso(eom), false);
  }

  const actual = Math.max(0, totalDays - lwopDays);
  const eligibleThisMonth = actual >= DAYS_PER_LEAVE_CREDIT; // enough actual service to earn at least 1.0 credit
  return { nextCreditDate: iso(eom), eligibleThisMonth };
};

export default function Leave() {
  const [pdm, setPdm] = useState(() => loadJson(PDM_STORAGE_KEY, []));
  const [leaveRows, setLeaveRows] = useState(() => loadJson(LEAVE_STORAGE_KEY, []));
  const [search, setSearch] = useState("");

  // UI state
  const [workingDayCount, setWorkingDayCount] = useState(true); // default: Mon–Fri for Auto Days
  const [showDetails, setShowDetails] = useState(false);

  // form
  const [form, setForm] = useState({
    accntNo: "",
    leaveType: "VACATION", // VACATION | SICK | SPECIAL | LWOP | OTHER
    chargeTo: "VL",        // VL | SL | NONE
    dateFrom: "",
    dateTo: "",
    days: "",
    withPay: "YES",
    remarks: "",
  });

  useEffect(() => {
    saveJson(LEAVE_STORAGE_KEY, leaveRows);
  }, [leaveRows]);

  // keep PDM in sync (same pattern you used in PDM polling)
  useEffect(() => {
    const t = setInterval(() => setPdm(loadJson(PDM_STORAGE_KEY, [])), 1500);
    return () => clearInterval(t);
  }, []);

  const asOfISO = iso(new Date());

  const pdmByAcc = useMemo(() => {
    const m = new Map();
    (pdm || []).forEach((p) => m.set(normalizeAcc(p.accntNo), p));
    return m;
  }, [pdm]);

  const personnelOptions = useMemo(() => {
    const list = (pdm || [])
      .map((p) => ({
        accntNo: normalizeAcc(p.accntNo),
        label: `${normalizeAcc(p.accntNo)} — ${(p.rank || "").trim()} ${(p.lastName || "").trim()}, ${(p.firstName || "").trim()} (${(p.unitAssignment || p.unitCode || "").trim()})`.trim(),
      }))
      .filter((x) => x.accntNo);
    list.sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [pdm]);

  const handleChange = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const selectedPerson = useMemo(() => pdmByAcc.get(normalizeAcc(form.accntNo)) || null, [pdmByAcc, form.accntNo]);

  const computeAutoDays = () => {
    const from = form.dateFrom;
    const to = form.dateTo;
    if (!from || !to) return handleChange("days", "");
    const d = workingDayCount
      ? workingDaysBetweenInclusive(from, to)
      : daysBetweenInclusive(from, to);
    handleChange("days", d ? String(d) : "");
  };

  const addLeave = (e) => {
    e.preventDefault();
    const acc = normalizeAcc(form.accntNo);
    if (!acc) return alert("Account number is required.");
    if (!form.dateFrom || !form.dateTo) return alert("Date From and Date To are required.");

    const days = Number(form.days || 0) || 0;
    if (days <= 0) return alert("Days must be > 0 (click Auto Days or enter manually).");

    const rec = {
      id: Date.now() + Math.random(),
      accntNo: acc,
      leaveType: form.leaveType,
      chargeTo: form.chargeTo,
      dateFrom: form.dateFrom,
      dateTo: form.dateTo,
      days,
      withPay: form.withPay,
      remarks: form.remarks,
      createdAt: new Date().toISOString(),
    };

    setLeaveRows((prev) => [rec, ...prev]);
    setForm((p) => ({
      ...p,
      dateFrom: "",
      dateTo: "",
      days: "",
      remarks: "",
    }));
  };

  const removeLeave = (id) => {
    if (!window.confirm("Delete this leave record?")) return;
    setLeaveRows((prev) => prev.filter((x) => x.id !== id));
  };

  const exportLeaveToExcel = async () => {
    try {
      const XLSX = await import("xlsx-js-style");
      const XLSXMod = XLSX.default ?? XLSX;

      // Build balances
      const balances = computedBalances.map((p) => ({
        "Account Number": p.accntNo,
        "Name": p.name,
        "Unit": p.unit,
        "Service Start (basis)": p.startDate || "",
        "VL Accrued": p.accruedVL,
        "VL Used": p.usedVL,
        "VL Balance": p.balVL,
        "SL Accrued": p.accruedSL,
        "SL Used": p.usedSL,
        "SL Balance": p.balSL,
        "Next Credit Date": p.nextCreditDate || "",
        "Eligible This Month?": p.eligibleThisMonth ? "YES" : "MAYBE (LWOP)",
      }));

      // Build ledger
      const ledger = (leaveRows || []).map((r) => ({
        "Account Number": r.accntNo,
        "Leave Type": r.leaveType,
        "Charge To": r.chargeTo,
        "With Pay": r.withPay,
        "Date From": r.dateFrom,
        "Date To": r.dateTo,
        "Days": r.days,
        "Remarks": r.remarks || "",
        "Created At": r.createdAt ? String(r.createdAt).slice(0, 19) : "",
      }));

      const wb = XLSXMod.utils.book_new();

      const headerStyle = {
        font: { bold: true },
        fill: { fgColor: { rgb: "E5E7EB" } },
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "9CA3AF" } },
          bottom: { style: "thin", color: { rgb: "9CA3AF" } },
          left: { style: "thin", color: { rgb: "9CA3AF" } },
          right: { style: "thin", color: { rgb: "9CA3AF" } },
        },
      };

      const applyHeaderStyle = (ws) => {
        const range = XLSXMod.utils.decode_range(ws["!ref"]);
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSXMod.utils.encode_cell({ r: 0, c });
          if (ws[addr]) ws[addr].s = headerStyle;
        }
      };

      // Sheet 1: Balances
      const ws1 = XLSXMod.utils.json_to_sheet(balances, { skipHeader: false });
      applyHeaderStyle(ws1);
      XLSXMod.utils.book_append_sheet(wb, ws1, "Leave Balances");

      // Sheet 2: Ledger
      const ws2 = XLSXMod.utils.json_to_sheet(ledger, { skipHeader: false });
      applyHeaderStyle(ws2);
      XLSXMod.utils.book_append_sheet(wb, ws2, "Leave Ledger");

      XLSXMod.writeFile(wb, "BFP_Leave.xlsx");
    } catch (err) {
      console.error(err);
      alert("Leave export failed. Make sure 'xlsx-js-style' is installed (npm install xlsx-js-style).");
    }
  };

  // ===== COMPUTATION (BFP/CSC-aligned) =====
  const computedBalances = useMemo(() => {
    // For service start basis:
    // Prefer DEGS (entered government service). If blank, fallback to DEFS.
    const list = (pdm || []).map((p) => {
      const accntNo = normalizeAcc(p.accntNo);
      const name = `${(p.rank || "").trim()} ${(p.lastName || "").trim()}, ${(p.firstName || "").trim()}`.trim();
      const unit = (p.unitAssignment || p.unitCode || "").trim();

      const startDate = p.degs || p.defs || "";
      const personLeaves = (leaveRows || []).filter((r) => normalizeAcc(r.accntNo) === accntNo);

      const accr = computeAccrual({ startISO: startDate, asOfISO, leaveRows: personLeaves });

      // Used leave: only count when Charge To = VL/SL
      let usedVL = 0;
      let usedSL = 0;
      for (const r of personLeaves) {
        const days = Number(r.days || 0) || 0;
        const charge = String(r.chargeTo || "NONE").toUpperCase();
        if (charge === "VL") usedVL += days;
        if (charge === "SL") usedSL += days;
      }

      const balVL = Math.max(0, Number((accr.accruedVL - usedVL).toFixed(3)));
      const balSL = Math.max(0, Number((accr.accruedSL - usedSL).toFixed(3)));

      const nextInfo = computeNextCreditInfo({ asOfISO, leaveRows: personLeaves });

      return {
        accntNo,
        name,
        unit,
        startDate,
        months: monthsOfService(startDate, asOfISO),
        accruedVL: accr.accruedVL,
        accruedSL: accr.accruedSL,
        usedVL: Number(usedVL.toFixed(3)),
        usedSL: Number(usedSL.toFixed(3)),
        balVL,
        balSL,
        nextCreditDate: nextInfo.nextCreditDate,
        eligibleThisMonth: nextInfo.eligibleThisMonth,
        breakdown: accr.breakdown,
      };
    });

    // search filter
    const q = search.trim().toLowerCase();
    const filtered = !q
      ? list
      : list.filter((x) =>
          (x.accntNo || "").toLowerCase().includes(q) ||
          (x.name || "").toLowerCase().includes(q) ||
          (x.unit || "").toLowerCase().includes(q)
        );

    // sort: unit → name
    filtered.sort((a, b) => (a.unit || "").localeCompare(b.unit || "") || (a.name || "").localeCompare(b.name || ""));
    return filtered;
  }, [pdm, leaveRows, asOfISO, search]);

  const lowVLThreshold = 5;
  const lowSLThreshold = 5;

  return (
    <div className="data-page">
      <div className="roster-header">
        <div>
          <h2 className="roster-title">Leave Management</h2>
          <p className="roster-subtitle">
            Leave ledger with automatic VL/SL computation. Accrual uses monthly cap (1.25) and deducts LWOP from “actual service” days.
          </p>
        </div>
        <div className="mode-pill">
          <span className="mode-dot" />
          As of {asOfISO}
        </div>
      </div>

      <div className="roster-card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
          <button className="btn btn-primary" type="button" onClick={exportLeaveToExcel}>
            📤 Export Leave Excel
          </button>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={workingDayCount}
              onChange={(e) => setWorkingDayCount(e.target.checked)}
            />
            Auto Days counts working days (Mon–Fri)
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={showDetails}
              onChange={(e) => setShowDetails(e.target.checked)}
            />
            Show accrual details
          </label>
        </div>
      </div>

      <div className="data-page-grid">
        {/* LEFT: add leave */}
        <section className="data-card">
          <div className="data-card-header">
            <h2>Add leave record</h2>
            <span className="muted">Ledger-based</span>
          </div>

          <form className="data-form" onSubmit={addLeave}>
            <div className="data-form-grid">
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Personnel</label>
                <select
                  value={normalizeAcc(form.accntNo)}
                  onChange={(e) => handleChange("accntNo", e.target.value)}
                >
                  <option value="">Select personnel (from PDM)</option>
                  {personnelOptions.map((opt) => (
                    <option key={opt.accntNo} value={opt.accntNo}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <small className="hint">
                  This list comes from PDM. If someone is missing, add them in PDM first.
                </small>
              </div>

              <div className="field">
                <label>Account Number</label>
                <input
                  value={form.accntNo}
                  onChange={(e) => handleChange("accntNo", e.target.value)}
                  placeholder="e.g. 12345"
                />
              </div>

              <div className="field">
                <label>Leave Type</label>
                <select value={form.leaveType} onChange={(e) => handleChange("leaveType", e.target.value)}>
                  <option value="VACATION">Vacation</option>
                  <option value="SICK">Sick</option>
                  <option value="SPECIAL">Special</option>
                  <option value="LWOP">Leave Without Pay (LWOP)</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="field">
                <label>Charge To</label>
                <select value={form.chargeTo} onChange={(e) => handleChange("chargeTo", e.target.value)}>
                  <option value="VL">VL</option>
                  <option value="SL">SL</option>
                  <option value="NONE">None</option>
                </select>
                <small className="hint">Use “None” for special leaves not charged to VL/SL.</small>
              </div>

              <div className="field">
                <label>With Pay?</label>
                <select value={form.withPay} onChange={(e) => handleChange("withPay", e.target.value)}>
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </select>
                <small className="hint">If “No”, it will reduce monthly accrual.</small>
              </div>

              <div className="field">
                <label>Date From</label>
                <input type="date" value={form.dateFrom} onChange={(e) => handleChange("dateFrom", e.target.value)} />
              </div>

              <div className="field">
                <label>Date To</label>
                <input type="date" value={form.dateTo} onChange={(e) => handleChange("dateTo", e.target.value)} />
              </div>

              <div className="field">
                <label>Days</label>
                <input value={form.days} onChange={(e) => handleChange("days", e.target.value)} placeholder="Auto or manual" />
                <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={computeAutoDays}>
                  Auto Days
                </button>
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Remarks</label>
                <textarea rows={2} value={form.remarks} onChange={(e) => handleChange("remarks", e.target.value)} />
              </div>
            </div>

            {selectedPerson && (
              <div className="hint" style={{ marginTop: 10 }}>
                Filing for: <b>{`${(selectedPerson.rank || "").trim()} ${(selectedPerson.lastName || "").trim()}, ${(selectedPerson.firstName || "").trim()}`}</b>
                {" — "}
                {(selectedPerson.unitAssignment || selectedPerson.unitCode || "").trim()}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn-primary">Save leave record</button>
            </div>
          </form>
        </section>

        {/* RIGHT: balances + ledger */}
        <section className="data-card">
          <div className="data-card-header">
            <h2>Balances</h2>
            <span className="muted">{computedBalances.length} personnel</span>
          </div>

          <div className="data-card-body">
            <div className="search-wrap" style={{ marginBottom: 10 }}>
              <span className="search-icon">🔎</span>
              <input
                className="search-input"
                placeholder="Search by name / unit / account no."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Accnt no.</th>
                    <th>Name</th>
                    <th>Unit</th>
                    <th>Basis</th>
                    <th>VL</th>
                    <th>SL</th>
                    <th>Next credit</th>
                  </tr>
                </thead>
                <tbody>
                  {computedBalances.map((p) => {
                    const lowVL = p.balVL < lowVLThreshold;
                    const lowSL = p.balSL < lowSLThreshold;
                    const warnCredit = !p.eligibleThisMonth;

                    return (
                      <tr key={p.accntNo}>
                        <td>{p.accntNo}</td>
                        <td>{p.name}</td>
                        <td>{p.unit}</td>
                        <td>{p.startDate || "-"}</td>
                        <td>
                          <span className={`badge ${lowVL ? "danger" : "blue"}`}>{p.balVL}</span>
                          <div className="hint">used: {p.usedVL} / accrued: {p.accruedVL}</div>
                        </td>
                        <td>
                          <span className={`badge ${lowSL ? "danger" : "blue"}`}>{p.balSL}</span>
                          <div className="hint">used: {p.usedSL} / accrued: {p.accruedSL}</div>
                        </td>
                        <td>
                          <span className={`badge ${warnCredit ? "danger" : "blue"}`}>{p.nextCreditDate || "-"}</span>
                          <div className="hint">{warnCredit ? "LWOP may reduce credit" : "Expected month-end credit"}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {showDetails && (
              <div style={{ marginTop: 16 }}>
                <div className="subsection-header">
                  <h3>Accrual details (first 12 rows)</h3>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Accnt</th>
                        <th>Month</th>
                        <th>Window days</th>
                        <th>LWOP days</th>
                        <th>Actual service</th>
                        <th>Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computedBalances.slice(0, 12).flatMap((p) =>
                        (p.breakdown || []).slice(-2).map((b) => (
                          <tr key={`${p.accntNo}-${b.month}`}>
                            <td>{p.accntNo}</td>
                            <td>{b.month}</td>
                            <td>{b.windowDays}</td>
                            <td>{b.lwopDays}</td>
                            <td>{b.actualServiceDays}</td>
                            <td>{b.earned}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <small className="hint">
                  Earned is capped at 1.25 per month and reduced when LWOP reduces “actual service” below 24 days.
                </small>
              </div>
            )}

            <div className="subsection-header" style={{ marginTop: 18 }}>
              <h3>Leave Ledger</h3>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Accnt</th>
                    <th>Type</th>
                    <th>Charge</th>
                    <th>Pay</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Days</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRows.length === 0 && (
                    <tr><td colSpan={8} className="empty-state">No leave records yet.</td></tr>
                  )}
                  {leaveRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.accntNo}</td>
                      <td>{r.leaveType}</td>
                      <td>{r.chargeTo}</td>
                      <td>{r.withPay}</td>
                      <td>{r.dateFrom}</td>
                      <td>{r.dateTo}</td>
                      <td>{r.days}</td>
                      <td className="row-actions">
                        <button className="link-button danger" type="button" onClick={() => removeLeave(r.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <small className="hint" style={{ marginTop: 10, display: "block" }}>
              Notes: Auto Days counts Mon–Fri only (no holiday logic). LWOP impact uses calendar days. If you want official holiday/weekend-exclusion matching your HR process, tell me the exact office rule and I’ll adjust.
            </small>
          </div>
        </section>
      </div>
    </div>
  );
}
