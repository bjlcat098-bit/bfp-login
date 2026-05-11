// NewsBFP.jsx (HYBRID MODE + Per-Station Announcements)
// - Tries to load live RSS updates from official BFP feeds
// - If live feeds return 0 items, shows cached results (if any)
// - If still empty, shows manual "Official Announcements" fallback (stored in LocalStorage)
// - Manual announcements can be tagged per Unit/Station and filtered on Dashboard
//
// Sources:
// - BFP National RSS: https://bfp.gov.ph/feed/
// - BFP NCR Announcements RSS: https://ncr.bfp.gov.ph/category/announcements/feed/
// Note: browser-side RSS fetching is unreliable because many feeds/proxies block CORS. In localhost we skip live RSS and fall back to cache/manual announcements unless you add a server proxy.

import React, { useEffect, useMemo, useState } from "react";

const PDM_STORAGE_KEY = "bfp_pdm_v1";
const NEWS_CACHE_KEY = "bfp_news_cache_v1";
const MANUAL_KEY = "bfp_news_manual_v2"; // v2: adds unit/station field
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const FEEDS = [
  { name: "BFP National", url: "https://bfp.gov.ph/feed/" },
  { name: "BFP NCR Announcements", url: "https://ncr.bfp.gov.ph/category/announcements/feed/" },
];

const isLocalDev = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);

const parseAllOriginsJson = (payload) => {
  if (!payload || typeof payload !== "object") return "";
  return String(payload.contents || payload.body || "");
};

const fetchFeedText = async (url) => {
  if (isLocalDev) {
    throw new Error("LIVE_RSS_DISABLED_IN_LOCAL_DEV");
  }

  const attempts = [
    {
      kind: "text",
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    },
    {
      kind: "json",
      url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml, text/plain, */*" },
      });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      if (attempt.kind === "json") {
        const payload = await res.json();
        const xml = parseAllOriginsJson(payload);
        if (!xml) throw new Error("Empty proxy payload");
        return xml;
      }
      return await res.text();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to load feed");
};

const parseRss = (xmlText, sourceName) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "text/xml");
  const parserError = xml.querySelector("parsererror");
  if (parserError) return [];

  const items = Array.from(xml.querySelectorAll("item")).map((item) => {
    const title = item.querySelector("title")?.textContent?.trim() || "";
    const link = item.querySelector("link")?.textContent?.trim() || "";
    const pubDateRaw = item.querySelector("pubDate")?.textContent?.trim() || "";
    const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;

    const desc =
      item.querySelector("description")?.textContent?.trim() ||
      item.querySelector("content\:encoded")?.textContent?.trim() ||
      "";

    const snippet = desc
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220);

    return {
      kind: "live",
      source: sourceName,
      title,
      link,
      pubDate: pubDate && !isNaN(pubDate) ? pubDate.toISOString() : "",
      snippet,
    };
  });

  return items.filter((x) => x.title && x.link);
};

const loadJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveJson = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function NewsBFP({ limit = 6 }) {
  const [items, setItems] = useState([]);
  const [manual, setManual] = useState(() => loadJson(MANUAL_KEY, []));
  const [status, setStatus] = useState({ loading: true, error: "", note: "" });
  const [lastUpdated, setLastUpdated] = useState("");

  // Station / unit list comes from PDM, so it matches your real roster/PDM data
  const [pdmUnits, setPdmUnits] = useState(() => {
    const pdm = loadJson(PDM_STORAGE_KEY, []);
    const set = new Set(
      (Array.isArray(pdm) ? pdm : [])
        .map((p) => String(p?.unitAssignment || p?.unitCode || "").trim())
        .filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });

  const [unitFilter, setUnitFilter] = useState("ALL"); // ALL or exact station
  const [showManage, setShowManage] = useState(false);
  const [mTitle, setMTitle] = useState("");
  const [mBody, setMBody] = useState("");
  const [mUnit, setMUnit] = useState("ALL"); // ALL means applies to all units

  // Keep PDM units fresh (in case user updates PDM in another tab/view)
  useEffect(() => {
    const t = setInterval(() => {
      const pdm = loadJson(PDM_STORAGE_KEY, []);
      const set = new Set(
        (Array.isArray(pdm) ? pdm : [])
          .map((p) => String(p?.unitAssignment || p?.unitCode || "").trim())
          .filter(Boolean)
      );
      setPdmUnits(Array.from(set).sort((a, b) => a.localeCompare(b)));
    }, 2500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    saveJson(MANUAL_KEY, manual);
  }, [manual]);

  const sorted = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });
    return list.slice(0, limit);
  }, [items, limit]);

  const refresh = async ({ force = false } = {}) => {
    setStatus({ loading: true, error: "", note: "" });

    const cached = loadJson(NEWS_CACHE_KEY, null);
    const now = Date.now();

    if (!force && cached?.ts && now - cached.ts < CACHE_TTL_MS && Array.isArray(cached.items)) {
      setItems(cached.items);
      setLastUpdated(cached.ts ? new Date(cached.ts).toISOString() : "");
      setStatus({
        loading: false,
        error: "",
        note: cached.items?.length ? "" : "No live items in cache; showing announcements.",
      });
      return;
    }

    try {
      const all = [];
      for (const f of FEEDS) {
        const xml = await fetchFeedText(f.url);
        all.push(...parseRss(xml, f.name));
      }

      const seen = new Set();
      const deduped = all.filter((x) => {
        if (seen.has(x.link)) return false;
        seen.add(x.link);
        return true;
      });

      saveJson(NEWS_CACHE_KEY, { ts: now, items: deduped });

      if (!deduped.length) {
        const cachedNonEmpty =
          cached?.items && Array.isArray(cached.items) && cached.items.length ? cached.items : [];
        if (cachedNonEmpty.length) {
          const marked = cachedNonEmpty.map((x) => ({ ...x, kind: x.kind || "cached" }));
          setItems(marked);
          setLastUpdated(new Date(now).toISOString());
          setStatus({
            loading: false,
            error: "",
            note: "Live feeds returned no items. Showing cached news (if available) and announcements.",
          });
          return;
        }

        setItems([]);
        setLastUpdated(new Date(now).toISOString());
        setStatus({
          loading: false,
          error: "",
          note: "Live feeds returned no items. Showing official announcements fallback.",
        });
        return;
      }

      setItems(deduped);
      setLastUpdated(new Date(now).toISOString());
      setStatus({ loading: false, error: "", note: "" });
    } catch (e) {
      const cachedNonEmpty =
        cached?.items && Array.isArray(cached.items) && cached.items.length ? cached.items : [];
      if (cachedNonEmpty.length) {
        const marked = cachedNonEmpty.map((x) => ({ ...x, kind: x.kind || "cached" }));
        setItems(marked);
        setLastUpdated(cached?.ts ? new Date(cached.ts).toISOString() : "");
        setStatus({ loading: false, error: "", note: isLocalDev ? "Live RSS is disabled in localhost. Showing cached news and announcements. Add a server proxy later if you want live feed loading during development." : "Live feeds unavailable. Showing cached news and announcements." });
      } else {
        setItems([]);
        setStatus({ loading: false, error: "", note: isLocalDev ? "Live RSS is disabled in localhost. Showing official announcements fallback. Add a server proxy later if you want live feed loading during development." : "Live feeds unavailable. Showing official announcements fallback." });
      }
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addManual = () => {
    const t = mTitle.trim();
    const b = mBody.trim();
    if (!t || !b) return;

    const rec = {
      id: Date.now() + Math.random(),
      title: t,
      body: b,
      date: new Date().toISOString(),
      unit: mUnit === "ALL" ? "ALL" : mUnit, // ALL or station name
    };
    setManual((prev) => [rec, ...prev]);
    setMTitle("");
    setMBody("");
    setMUnit("ALL");
  };

  const deleteManual = (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    setManual((prev) => prev.filter((x) => x.id !== id));
  };

  const visibleManual = useMemo(() => {
    if (!Array.isArray(manual)) return [];
    if (unitFilter === "ALL") return manual;
    return manual.filter((m) => (m?.unit || "ALL") === "ALL" || (m?.unit || "") === unitFilter);
  }, [manual, unitFilter]);

  return (
    <div className="roster-card" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>📰 Latest BFP updates</h3>
          <div className="hint" style={{ marginTop: 4 }}>
            Sources: BFP National & BFP NCR feeds.
            {lastUpdated ? ` Last updated: ${fmtDate(lastUpdated)}.` : ""}
            {status.note ? ` ${status.note}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowManage((s) => !s)}
            title="Manage fallback announcements"
          >
            {showManage ? "Close" : "Manage"}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => refresh({ force: true })}
            disabled={status.loading}
            title="Refresh now"
          >
            {status.loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Live news */}
      <div style={{ marginTop: 12 }}>
        {sorted.length === 0 && !status.loading && (
          <div className="empty-state">No live news items right now (showing announcements below).</div>
        )}

        {sorted.map((n, idx) => (
          <div
            key={n.link || idx}
            style={{
              padding: "10px 0",
              borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span className="badge">{n.source || "BFP"}</span>
              {n.kind === "cached" && <span className="badge blue">Cached</span>}
              {n.pubDate && <span className="hint">{fmtDate(n.pubDate)}</span>}
            </div>

            <a
              href={n.link}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-block", marginTop: 6, fontWeight: 700 }}
            >
              {n.title}
            </a>

            {n.snippet && <div className="hint" style={{ marginTop: 6 }}>{n.snippet}…</div>}
          </div>
        ))}
      </div>

      {/* Manual fallback announcements */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="subsection-header" style={{ marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>📌 Official announcements (fallback)</h3>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="hint">Filter:</span>
            <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} style={{ minWidth: 240 }}>
              <option value="ALL">All Units/Stations</option>
              {pdmUnits.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="hint" style={{ marginBottom: 10 }}>
          Announcements tagged “All Units” will show for everyone. Station-tagged announcements show only when that station is selected.
        </div>

        {showManage && (
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            <input
              value={mTitle}
              onChange={(e) => setMTitle(e.target.value)}
              placeholder="Announcement title (e.g., Memo/Advisory)"
            />

            <textarea
              rows={3}
              value={mBody}
              onChange={(e) => setMBody(e.target.value)}
              placeholder="Details (short summary + reference no. if any)"
            />

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="hint">Applies to:</span>
              <select value={mUnit} onChange={(e) => setMUnit(e.target.value)} style={{ minWidth: 280 }}>
                <option value="ALL">All Units/Stations</option>
                {pdmUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>

              <button type="button" className="btn btn-primary" onClick={addManual}>
                Add announcement
              </button>

              <button type="button" className="btn btn-ghost" onClick={() => { setMTitle(""); setMBody(""); setMUnit("ALL"); }}>
                Clear
              </button>
            </div>
          </div>
        )}

        {visibleManual.length === 0 ? (
          <div className="empty-state">No announcements for this filter yet.</div>
        ) : (
          visibleManual.slice(0, 12).map((m, idx) => (
            <div
              key={m.id || idx}
              style={{
                padding: "10px 0",
                borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800 }}>{m.title}</div>
                    <span className="badge">{(m.unit || "ALL") === "ALL" ? "All Units" : m.unit}</span>
                  </div>
                  {m.date && <div className="hint">{fmtDate(m.date)}</div>}
                </div>

                {showManage && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => deleteManual(m.id)}
                    title="Delete"
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="hint" style={{ marginTop: 6 }}>{m.body}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
