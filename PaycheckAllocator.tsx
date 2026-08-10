import React, { useState, useEffect, useMemo, useRef } from "react";

/* ---------------------------------------------------------------
   Palette carried over from the Excel workbook's section colors
---------------------------------------------------------------- */
const NAVY = "#1F4E79";   // bills / allocated
const PURPLE = "#7030A0"; // reserves
const GOLD = "#7F5F00";   // free cash
const RED = "#B3261E";
const CREAM = "#F7F5EF";
const INK = "#2B2A26";
const LINE = "#E4DFD3";
const MUTE = "#8A8478";

const SANS = "'Helvetica Neue', Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

const STORAGE_KEY = "paycheck-allocator-v3";

const DEFAULT_BILLS = [
  { id: "b1", cat: "Mortgage", amount: 3300, dueDay: 1 },
  { id: "b2", cat: "Health Insurance", amount: 450, dueDay: 5 },
  { id: "b3", cat: "Car Insurance", amount: 150, dueDay: 10 },
  { id: "b4", cat: "Subscriptions", amount: 50, dueDay: 12 },
  { id: "b5", cat: "Utilities", amount: 150, dueDay: 18 },
  { id: "b6", cat: "Phone", amount: 80, dueDay: 20 },
  { id: "b7", cat: "Internet", amount: 60, dueDay: 22 },
  { id: "b8", cat: "Loan Payments", amount: 1500, dueDay: 28 },
];

const DEFAULT_SINKING = [
  { id: "s1", cat: "Groceries", amount: 2000 },
  { id: "s2", cat: "Transportation", amount: 150 },
  { id: "s3", cat: "Dining Out", amount: 120 },
  { id: "s4", cat: "Vacations", amount: 100 },
  { id: "s5", cat: "Clothing", amount: 200 },
  { id: "s6", cat: "Savings", amount: 200 },
];

const KEYWORDS = {
  Utilities: ["electric", "power", "utility", "utilities", "water", "trash", "energy", "txu"],
  Groceries: ["grocery", "groceries", "kroger", "aldi", "heb", "costco", "walmart", "target", "sprouts", "trader"],
  "Dining Out": ["dinner", "lunch", "breakfast", "restaurant", "canes", "chipotle", "coffee", "starbucks", "takeout", "doordash", "ubereats", "pizza", "bar", "brunch", "taco", "burger", "whataburger", "chickfila", "chick-fil-a"],
  Transportation: ["gas", "gas station", "fuel", "shell", "exxon", "chevron", "buccees", "quiktrip", "uber", "lyft", "parking", "toll", "car wash", "oil change"],
  Phone: ["phone", "verizon", "att", "t-mobile", "mint"],
  Internet: ["internet", "wifi", "broadband", "spectrum", "frontier"],
  Subscriptions: ["subscription", "netflix", "spotify", "hulu", "disney", "prime", "youtube", "icloud", "adobe"],
  Mortgage: ["mortgage", "rent", "escrow"],
  "Health Insurance": ["health insurance", "medical", "doctor", "pharmacy", "dentist", "copay"],
  "Car Insurance": ["car insurance", "auto insurance", "geico", "progressive", "allstate"],
  "Loan Payments": ["loan", "401k loan", "student loan", "car payment"],
  Clothing: ["clothes", "clothing", "shoes", "shirt", "jeans", "nike"],
  Vacations: ["vacation", "trip", "flight", "hotel", "airbnb", "travel"],
  Savings: ["savings", "emergency fund", "save"],
  Entertainment: ["movie", "concert", "tickets", "game", "steam", "xbox"],
};

const PAID_WORDS = ["paid", "spent", "bought", "charged", "purchased", "got"];
const PLAN_WORDS = ["plan", "planned", "planning", "due", "upcoming", "expect", "expected", "bill", "coming"];

const money = (n) => (n < 0 ? "-$" : "$") + Math.round(Math.abs(n)).toLocaleString();
const uid = (p) => p + Math.random().toString(36).slice(2, 9);
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthKeyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/* ---------------------------------------------------------------
   Parser
---------------------------------------------------------------- */
function parseEntry(text, categories, learned) {
  const raw = text.trim();
  if (!raw) return null;
  const working = " " + raw.toLowerCase() + " ";

  const amtMatch = raw.match(/\$\s*(\d+(?:\.\d{1,2})?)|(?:^|\s)(\d+(?:\.\d{1,2})?)(?=\s|$)/);
  const amount = amtMatch ? parseFloat(amtMatch[1] || amtMatch[2]) : null;

  let status = null;
  for (const w of PAID_WORDS) if (new RegExp(`\\b${w}\\b`).test(working)) { status = "paid"; break; }
  if (!status) for (const w of PLAN_WORDS) if (new RegExp(`\\b${w}\\b`).test(working)) { status = "planned"; break; }
  if (!status) status = "paid";

  let cat = null;
  const paren = raw.match(/\(([^)]+)\)/);
  if (paren) {
    const inner = paren[1].trim().toLowerCase();
    const isStatus = [...PAID_WORDS, ...PLAN_WORDS].some((w) => inner === w);
    if (!isStatus) {
      const hit = categories.find((c) => c.toLowerCase() === inner);
      if (hit) cat = hit;
      else {
        for (const [c, words] of Object.entries({ ...KEYWORDS, ...learned })) {
          if (words.some((w) => inner.includes(w))) { cat = c; break; }
        }
      }
      if (!cat) cat = paren[1].trim();
    }
  }
  if (!cat) {
    const sorted = [...categories].sort((a, b) => b.length - a.length);
    for (const c of sorted) if (working.includes(" " + c.toLowerCase())) { cat = c; break; }
  }
  if (!cat) {
    const merged = {};
    for (const [c, w] of Object.entries(KEYWORDS)) merged[c] = [...w];
    for (const [c, w] of Object.entries(learned)) merged[c] = [...(merged[c] || []), ...w];
    let best = null;
    for (const [c, words] of Object.entries(merged))
      for (const w of words)
        if (working.includes(w) && (!best || w.length > best.len)) best = { cat: c, len: w.length };
    if (best) cat = best.cat;
  }

  const desc = raw
    .replace(/\$\s*\d+(?:\.\d{1,2})?/g, "")
    .replace(/(?:^|\s)\d+(?:\.\d{1,2})?(?=\s|$)/g, " ")
    .replace(/\([^)]*\)/g, "")
    .replace(new RegExp(`\\b(${[...PAID_WORDS, ...PLAN_WORDS].join("|")})\\b`, "gi"), "")
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { amount, cat, status, desc: desc || cat || "Entry" };
}

/* ---------------------------------------------------------------
   Component
---------------------------------------------------------------- */
export default function PaycheckAllocator() {
  const [payday1, setPayday1] = useState(1);
  const [payday2, setPayday2] = useState(15);
  const [bills, setBills] = useState(DEFAULT_BILLS);
  const [sinking, setSinking] = useState(DEFAULT_SINKING);
  const [entries, setEntries] = useState([]);
  const [learned, setLearned] = useState({});
  const [months, setMonths] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");

  const [monthKey, setMonthKey] = useState(() => monthKeyOf(new Date()));
  const [activeCycle, setActiveCycle] = useState(() => (new Date().getDate() >= 15 ? 2 : 1));
  const [draft, setDraft] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res && res.value) {
          const d = JSON.parse(res.value);
          if (d.payday1) setPayday1(d.payday1);
          if (d.payday2) setPayday2(d.payday2);
          if (d.bills) setBills(d.bills);
          if (d.sinking) setSinking(d.sinking);
          if (d.entries) setEntries(d.entries);
          if (d.learned) setLearned(d.learned);
          if (d.months) setMonths(d.months);
        }
      } catch (e) { /* first run */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await window.storage.set(
          STORAGE_KEY,
          JSON.stringify({ payday1, payday2, bills, sinking, entries, learned, months }),
          false
        );
        setSaveState("saved");
      } catch (e) { setSaveState("error"); }
    }, 500);
    return () => clearTimeout(t);
  }, [payday1, payday2, bills, sinking, entries, learned, months, loaded]);

  const monthData = months[monthKey] || { p1: "", p2: "" };
  const setMonthAmount = (which, val) =>
    setMonths((prev) => ({
      ...prev,
      [monthKey]: { ...(prev[monthKey] || { p1: "", p2: "" }), [which]: val === "" ? "" : Number(val) },
    }));

  const categories = useMemo(() => {
    const s = new Set();
    bills.forEach((b) => s.add(b.cat));
    sinking.forEach((x) => s.add(x.cat));
    entries.forEach((e) => e.cat && s.add(e.cat));
    Object.keys(KEYWORDS).forEach((c) => s.add(c));
    return [...s];
  }, [bills, sinking, entries]);

  const preview = useMemo(() => parseEntry(draft, categories, learned), [draft, categories, learned]);

  /* ---- per-cycle computation ---- */
  const computeCycle = (cycle) => {
    const cycleEntries = entries.filter((e) => e.monthKey === monthKey && e.cycle === cycle);
    const map = new Map();
    const touch = (cat) => {
      if (!map.has(cat)) map.set(cat, { cat, allocated: 0, spent: 0, source: "" });
      return map.get(cat);
    };

    bills.forEach((b) => {
      const inC1 = b.dueDay >= payday1 && b.dueDay < payday2;
      if ((cycle === 1) === inC1) {
        const e = touch(b.cat);
        e.allocated += Number(b.amount) || 0;
        e.source = "bill";
        e.dueDay = b.dueDay;
      }
    });

    sinking.forEach((s) => {
      const e = touch(s.cat);
      e.allocated += (Number(s.amount) || 0) / 2;
      e.source = e.source || "reserve";
    });

    cycleEntries.filter((e) => e.status === "planned" && e.cat).forEach((p) => {
      const e = touch(p.cat);
      if (e.source === "bill") e.allocated = Number(p.amount) || 0;
      else { e.allocated += Number(p.amount) || 0; e.source = e.source || "planned"; }
      e.adjusted = true;
    });

    cycleEntries.filter((e) => e.status === "paid" && e.cat).forEach((p) => {
      touch(p.cat).spent += Number(p.amount) || 0;
    });

    const envelopes = [...map.values()].sort((a, b) => b.allocated - a.allocated);
    const allocated = envelopes.reduce((s, e) => s + e.allocated, 0);
    const overage = envelopes.reduce((s, e) => s + Math.max(0, e.spent - e.allocated), 0);
    const uncat = cycleEntries
      .filter((e) => e.status === "paid" && !e.cat)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const income = Number(cycle === 1 ? monthData.p1 : monthData.p2) || 0;
    const free = income - allocated - overage - uncat;
    const spent = envelopes.reduce((s, e) => s + e.spent, 0) + uncat;
    return { cycle, cycleEntries, envelopes, allocated, overage, uncat, income, free, spent };
  };

  const c1 = useMemo(() => computeCycle(1), [entries, bills, sinking, monthKey, months, payday1, payday2]);
  const c2 = useMemo(() => computeCycle(2), [entries, bills, sinking, monthKey, months, payday1, payday2]);
  const active = activeCycle === 1 ? c1 : c2;

  const monthIncome = c1.income + c2.income;
  const monthAllocated = c1.allocated + c2.allocated;
  const monthFree = c1.free + c2.free;
  const monthSpent = c1.spent + c2.spent;

  /* ---- actions ---- */
  const commit = () => {
    if (!preview || !preview.amount) return;
    setEntries((prev) => [
      { id: uid("e"), monthKey, cycle: activeCycle, amount: preview.amount, cat: preview.cat || null, status: preview.status, desc: preview.desc, ts: Date.now() },
      ...prev,
    ]);
    setDraft("");
    inputRef.current && inputRef.current.focus();
  };

  const setEntryCat = (id, cat) => {
    const entry = entries.find((e) => e.id === id);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, cat } : e)));
    if (entry && cat) {
      const token = entry.desc.toLowerCase().split(/\s+/).filter((w) => w.length > 3)[0];
      if (token) setLearned((prev) => ({ ...prev, [cat]: [...new Set([...(prev[cat] || []), token])] }));
    }
  };

  const toggleStatus = (id) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status: e.status === "paid" ? "planned" : "paid" } : e)));
  const moveEntry = (id, cycle) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, cycle } : e)));
  const removeEntry = (id) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const shiftMonth = (dir) => {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMonthKey(monthKeyOf(d));
  };

  const [yr, mo] = monthKey.split("-").map(Number);

  /* ---- styles ---- */
  const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 4, padding: 18, marginBottom: 16 };
  const eyebrow = (color) => ({ fontFamily: SANS, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color, fontWeight: 700, marginBottom: 8 });
  const inputBase = { padding: "8px 10px", fontSize: 14, border: "1px solid #D8D2C4", borderRadius: 3, fontFamily: SERIF, boxSizing: "border-box", background: "#fff", color: INK };

  return (
    <div style={{ minHeight: "100vh", background: CREAM, color: INK, fontFamily: SERIF, padding: "28px 16px 60px", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 620 }}>
        <header style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: SANS, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: GOLD, fontWeight: 700 }}>
            Paycheck Allocator
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 4 }}>
            <NavBtn onClick={() => shiftMonth(-1)}>‹</NavBtn>
            <h1 style={{ fontSize: 26, margin: 0, fontWeight: 400, minWidth: 190 }}>
              {MONTH_NAMES[mo - 1]} {yr}
            </h1>
            <NavBtn onClick={() => shiftMonth(1)}>›</NavBtn>
          </div>
        </header>

        {/* Both checks */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {[c1, c2].map((c) => {
            const isActive = activeCycle === c.cycle;
            const day = c.cycle === 1 ? payday1 : payday2;
            const pct = (v) => (c.income > 0 ? Math.min(100, (v / c.income) * 100) : 0);
            return (
              <div
                key={c.cycle}
                onClick={() => setActiveCycle(c.cycle)}
                style={{
                  flex: "1 1 240px",
                  background: "#fff",
                  border: `2px solid ${isActive ? GOLD : LINE}`,
                  borderRadius: 4,
                  padding: 16,
                  cursor: "pointer",
                  transition: "border-color .15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <span style={{ fontFamily: SANS, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, color: isActive ? GOLD : MUTE }}>
                    Check {c.cycle} · {ordinal(day)}
                  </span>
                  {isActive && <span style={{ fontFamily: SANS, fontSize: 9, color: GOLD }}>logging here</span>}
                </div>

                <input
                  type="number"
                  value={c.cycle === 1 ? monthData.p1 : monthData.p2}
                  placeholder="0"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setMonthAmount(c.cycle === 1 ? "p1" : "p2", e.target.value)}
                  style={{ ...inputBase, width: "100%", fontSize: 20, marginBottom: 10 }}
                />

                <div style={{ display: "flex", height: 10, borderRadius: 3, overflow: "hidden", marginBottom: 10, background: "#EEE8DA" }}>
                  <div style={{ width: `${pct(c.allocated)}%`, background: NAVY }} />
                  <div style={{ width: `${pct(c.overage + c.uncat)}%`, background: RED }} />
                  <div style={{ width: `${pct(Math.max(c.free, 0))}%`, background: GOLD }} />
                </div>

                <Row label="Allocated" value={"-" + money(c.allocated)} color={NAVY} />
                {c.overage + c.uncat > 0 && <Row label="Over / uncategorized" value={"-" + money(c.overage + c.uncat)} color={RED} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: `1px solid ${INK}22`, marginTop: 6, paddingTop: 8 }}>
                  <span style={{ fontFamily: SANS, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, color: c.free < 0 ? RED : GOLD }}>
                    {c.free < 0 ? "Short" : "Free"}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: c.free < 0 ? RED : GOLD }}>{money(c.free)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Month roll-up */}
        <div style={{ ...card, padding: "14px 18px" }}>
          <div style={eyebrow(INK)}>Month total</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Stat label="Income" value={money(monthIncome)} />
            <Stat label="Allocated" value={money(monthAllocated)} color={NAVY} />
            <Stat label="Spent so far" value={money(monthSpent)} color={PURPLE} />
            <Stat label={monthFree < 0 ? "Short" : "Free"} value={money(monthFree)} color={monthFree < 0 ? RED : GOLD} big />
          </div>
        </div>

        {/* Entry bar */}
        <div style={{ ...card, padding: 16 }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            placeholder="electric bill $110 utility (plan)"
            style={{ ...inputBase, width: "100%", fontSize: 17, padding: "12px 14px", border: `2px solid ${draft ? GOLD : "#D8D2C4"}` }}
          />
          <div style={{ minHeight: 28, marginTop: 10, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {draft && preview ? (
              <>
                <Chip label={preview.amount ? money(preview.amount) : "no amount"} color={preview.amount ? INK : RED} />
                <Chip label={preview.cat || "uncategorized"} color={preview.cat ? PURPLE : MUTE} />
                <Chip label={preview.status} color={preview.status === "paid" ? NAVY : GOLD} />
                <Chip label={`check ${activeCycle}`} color={GOLD} />
                <span style={{ fontFamily: SANS, fontSize: 11, color: MUTE, marginLeft: "auto" }}>
                  {preview.amount ? "press enter" : "add an amount"}
                </span>
              </>
            ) : (
              <span style={{ fontFamily: SANS, fontSize: 11, color: MUTE }}>
                Logs to check {activeCycle} — tap the other card to switch
              </span>
            )}
          </div>
        </div>

        {/* Envelopes for active check */}
        <div style={card}>
          <div style={eyebrow(NAVY)}>Check {activeCycle} envelopes</div>
          {active.envelopes.length === 0 && <Empty text="No allocations for this check yet." />}
          {active.envelopes.map((e) => {
            const over = e.spent > e.allocated;
            const fill = e.allocated > 0 ? Math.min(100, (e.spent / e.allocated) * 100) : 100;
            return (
              <div key={e.cat} style={{ padding: "8px 0", borderBottom: `1px dotted ${LINE}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
                  <span>
                    {e.cat}
                    {e.source === "bill" && <Tag text={`due ${e.dueDay}`} />}
                    {e.source === "reserve" && <Tag text="reserve" />}
                    {e.adjusted && <Tag text="adjusted" color={GOLD} />}
                  </span>
                  <span style={{ fontFamily: SANS, fontSize: 13, color: over ? RED : MUTE }}>
                    {money(e.spent)} / {money(e.allocated)}
                  </span>
                </div>
                <div style={{ height: 5, background: "#EEE8DA", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${fill}%`, height: "100%", background: over ? RED : e.source === "bill" ? NAVY : PURPLE }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Ledger */}
        <div style={card}>
          <div style={eyebrow(PURPLE)}>Check {activeCycle} entries</div>
          {active.cycleEntries.length === 0 && <Empty text="Nothing logged yet. Use the box above." />}
          {active.cycleEntries.map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 0", borderBottom: `1px dotted ${LINE}` }}>
              <button
                onClick={() => toggleStatus(e.id)}
                title="Toggle planned / paid"
                style={{ fontFamily: SANS, fontSize: 9, letterSpacing: 0.8, textTransform: "uppercase", border: `1px solid ${e.status === "paid" ? NAVY : GOLD}`, color: e.status === "paid" ? NAVY : GOLD, background: "transparent", borderRadius: 10, padding: "2px 8px", cursor: "pointer", flexShrink: 0 }}
              >
                {e.status}
              </button>
              <span style={{ flex: 1, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.desc}</span>
              <button
                onClick={() => moveEntry(e.id, e.cycle === 1 ? 2 : 1)}
                title="Move to the other check"
                style={{ fontFamily: SANS, fontSize: 10, border: `1px solid ${LINE}`, background: "transparent", color: MUTE, borderRadius: 3, padding: "2px 5px", cursor: "pointer" }}
              >
                →{e.cycle === 1 ? "2" : "1"}
              </button>
              <select
                value={e.cat || ""}
                onChange={(ev) => setEntryCat(e.id, ev.target.value || null)}
                style={{ fontFamily: SANS, fontSize: 11, border: `1px solid ${e.cat ? LINE : RED}`, borderRadius: 3, padding: "3px 4px", maxWidth: 110, background: "#fff", color: e.cat ? INK : RED }}
              >
                <option value="">uncategorized</option>
                {[...categories].sort().map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{ fontFamily: SANS, fontSize: 14, minWidth: 54, textAlign: "right" }}>{money(e.amount)}</span>
              <button onClick={() => removeEntry(e.id)} style={{ border: "none", background: "transparent", color: MUTE, cursor: "pointer", fontSize: 15 }}>×</button>
            </div>
          ))}
        </div>

        {/* Config */}
        <button
          onClick={() => setShowConfig((s) => !s)}
          style={{ width: "100%", padding: "10px 0", background: "transparent", border: `1px solid ${INK}33`, borderRadius: 3, fontFamily: SANS, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: INK, cursor: "pointer", marginBottom: 16 }}
        >
          {showConfig ? "Hide setup" : "Edit bills, reserves & paydays"}
        </button>

        {showConfig && (
          <div style={card}>
            <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
              <label style={{ fontFamily: SANS, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTE }}>
                Payday 1
                <input type="number" min={1} max={28} value={payday1} onChange={(e) => setPayday1(Number(e.target.value))} style={{ ...inputBase, width: 70, marginTop: 5 }} />
              </label>
              <label style={{ fontFamily: SANS, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: MUTE }}>
                Payday 2
                <input type="number" min={1} max={28} value={payday2} onChange={(e) => setPayday2(Number(e.target.value))} style={{ ...inputBase, width: 70, marginTop: 5 }} />
              </label>
            </div>

            <div style={eyebrow(NAVY)}>Bills — fixed due date</div>
            {bills.map((b) => (
              <div key={b.id} style={{ display: "flex", gap: 5, marginBottom: 5 }}>
                <input value={b.cat} onChange={(e) => setBills((p) => p.map((x) => (x.id === b.id ? { ...x, cat: e.target.value } : x)))} style={{ ...inputBase, flex: 1, minWidth: 0 }} />
                <input type="number" value={b.amount} onChange={(e) => setBills((p) => p.map((x) => (x.id === b.id ? { ...x, amount: Number(e.target.value) } : x)))} style={{ ...inputBase, width: 80 }} />
                <input type="number" min={1} max={28} value={b.dueDay} title="Due day" onChange={(e) => setBills((p) => p.map((x) => (x.id === b.id ? { ...x, dueDay: Number(e.target.value) } : x)))} style={{ ...inputBase, width: 52 }} />
                <button onClick={() => setBills((p) => p.filter((x) => x.id !== b.id))} style={{ border: "none", background: "transparent", color: RED, cursor: "pointer" }}>×</button>
              </div>
            ))}
            <button onClick={() => setBills((p) => [...p, { id: uid("b"), cat: "New bill", amount: 0, dueDay: 1 }])} style={{ fontFamily: SANS, fontSize: 11, background: "transparent", border: "none", color: NAVY, cursor: "pointer", marginBottom: 16 }}>
              + Add bill
            </button>

            <div style={eyebrow(PURPLE)}>Reserves — split evenly across both checks</div>
            {sinking.map((s) => (
              <div key={s.id} style={{ display: "flex", gap: 5, marginBottom: 5 }}>
                <input value={s.cat} onChange={(e) => setSinking((p) => p.map((x) => (x.id === s.id ? { ...x, cat: e.target.value } : x)))} style={{ ...inputBase, flex: 1, minWidth: 0 }} />
                <input type="number" value={s.amount} onChange={(e) => setSinking((p) => p.map((x) => (x.id === s.id ? { ...x, amount: Number(e.target.value) } : x)))} style={{ ...inputBase, width: 80 }} />
                <button onClick={() => setSinking((p) => p.filter((x) => x.id !== s.id))} style={{ border: "none", background: "transparent", color: RED, cursor: "pointer" }}>×</button>
              </div>
            ))}
            <button onClick={() => setSinking((p) => [...p, { id: uid("s"), cat: "New reserve", amount: 0 }])} style={{ fontFamily: SANS, fontSize: 11, background: "transparent", border: "none", color: PURPLE, cursor: "pointer" }}>
              + Add reserve
            </button>
          </div>
        )}

        <p style={{ fontFamily: SANS, fontSize: 10, color: MUTE, textAlign: "center" }}>
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Couldn't save — changes stay for this session only." : "Saved automatically."}{" "}
          Each month keeps its own checks and entries.
        </p>
      </div>
    </div>
  );
}

/* ---- small pieces ---- */
function NavBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ border: `1px solid ${LINE}`, background: "#fff", color: INK, borderRadius: 3, width: 28, height: 28, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>
      {children}
    </button>
  );
}
function Chip({ label, color }) {
  return <span style={{ fontFamily: SANS, fontSize: 11, border: `1px solid ${color}`, color, borderRadius: 10, padding: "2px 9px", whiteSpace: "nowrap" }}>{label}</span>;
}
function Tag({ text, color = MUTE }) {
  return <span style={{ fontFamily: SANS, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.6, color, border: `1px solid ${color}55`, borderRadius: 3, padding: "1px 4px", marginLeft: 6 }}>{text}</span>;
}
function Row({ label, value, color = INK }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
      <span style={{ color: MUTE, fontFamily: SANS, fontSize: 11 }}>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}
function Stat({ label, value, color = INK, big }) {
  return (
    <div style={{ flex: "1 1 90px" }}>
      <div style={{ fontFamily: SANS, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: MUTE }}>{label}</div>
      <div style={{ fontSize: big ? 22 : 17, color, fontWeight: big ? 700 : 400 }}>{value}</div>
    </div>
  );
}
function Empty({ text }) {
  return <div style={{ fontFamily: SANS, fontSize: 12, color: MUTE, padding: "6px 0" }}>{text}</div>;
}
