import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus, X, Crown, Trash2, Pencil, SlidersHorizontal,
  MapPin, RotateCcw, Sparkles, ChevronDown, ChevronUp, Wallet, Loader2,
  List, Table, Trophy, ExternalLink, Moon, Sun, Check, Users, Info
} from "lucide-react";

/* ----------------------------------------------------------------
   HomePlot — Plot your perfect neighborhood.
   Rebuilt on the Home Footprint scoring engine: a weighted average
   across the factors that matter to you, fully adjustable, starting
   empty. Includes the mortgage math and an AI auto-fill.

   Note: the race-based pieces of the original (the dual-verified
   White-plurality "TRUE MATCH" filter and the demographic scoring
   dimension) are deliberately not carried over. A public housing
   product that ranks neighborhoods by racial composition runs into
   the Fair Housing Act and App Review. Every other factor is here.
----------------------------------------------------------------- */

// Colors resolve through CSS variables so the whole UI follows the system
// light/dark appearance (Apple advises against an app-specific toggle; the
// header switch here is only for previewing both in the prototype).
const INK = "var(--text)";      // primary text
const PAPER = "var(--bg)";      // page background
const SURF = "var(--surface)";  // cards, inputs, sheets
const BRAND = "var(--brand)";   // primary fill (buttons, selected states)
const SLATE = "var(--text-dim)"; // secondary text
const LINE = "var(--line)";     // borders, tracks
const ONGOLD = "#16263F";       // text on gold/amber accents (always dark)
const CORAL = "#FF5A4D";        // accent: action / low score
const GOLD = "#F2B441";         // accent: leader / mid score
const TEAL = "#1FA98F";         // accent: high score

const LIGHT_VARS = {
  "--bg": "#F6F3EC", "--surface": "#FFFFFF", "--text": "#16263F",
  "--text-dim": "#4A5663", "--line": "#E3DECF", "--brand": "#16263F",
};
const DARK_VARS = {
  "--bg": "#0F1722", "--surface": "#1B2533", "--text": "#ECEFF3",
  "--text-dim": "#9AA6B5", "--line": "#2A3645", "--brand": "#33415A",
};

// Mirrors WEIGHTS_INIT from the original (×20 to fit 0–100 sliders),
// minus the Diversity dimension. Affordability and Commute are computed
// from numbers; the rest are quick 1–5 gut-checks.
const DIMENSIONS = [
  { key: "affordability", label: "Affordability", w: 40, auto: "price", blurb: "Price vs. your budget" },
  { key: "commute",       label: "Commute",        w: 20, auto: "miles", blurb: "Miles to your work" },
  { key: "schools",       label: "Schools",        w: 60, blurb: "Quality of nearby schools" },
  { key: "schoolAccess",  label: "School access",  w: 80, blurb: "Ease of getting into a top school" },
  { key: "safety",        label: "Safety",         w: 40, blurb: "Crime / how safe it feels" },
  { key: "familySafety",  label: "Family safety",  w: 60, blurb: "Safe for kids day to day" },
  { key: "suburbGreen",   label: "Suburb & green", w: 100, blurb: "Green space, suburban feel" },
  { key: "retailDining",  label: "Retail & dining", w: 100, blurb: "Shops, restaurants, services" },
  { key: "lotYard",       label: "Lot & yard",     w: 100, blurb: "Home and lot size for the money" },
  { key: "walk",          label: "Walkability",    w: 20, blurb: "Walk / bike / transit" },
  { key: "beach",         label: "Beach / coastal", w: 20, blurb: "Closeness to the coast" },
  { key: "earthquake",    label: "Quake safety",   w: 80, blurb: "Lower seismic risk" },
  { key: "fire",          label: "Fire safety",    w: 40, blurb: "Lower wildfire risk" },
  { key: "weather",       label: "Weather",        w: 20, blurb: "Year-round comfort" },
  { key: "culture",       label: "Culture & cool", w: 60, blurb: "Arts, vibe, character" },
];

const RATED = DIMENSIONS.filter((d) => !d.auto);

// Group the gut-check ratings so the add flow reads in three quick passes
// instead of one long list.
const RATING_GROUPS = [
  { title: "Home & schools", keys: ["schools", "schoolAccess", "lotYard"] },
  { title: "Safety", keys: ["safety", "familySafety", "earthquake", "fire"] },
  { title: "Lifestyle", keys: ["suburbGreen", "retailDining", "walk", "beach", "weather", "culture"] },
];
const DIM_BY_KEY = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d]));

// Persona presets: a one-tap starting shape for the priority sliders. Resident
// is the default (you'll live there); Investor weights price, value, and asset
// risk while de-emphasizing schools, commute, and family lifestyle. These are
// starting points to tune, not financial advice.
const RESIDENT_WEIGHTS = DIMENSIONS.reduce((a, d) => ({ ...a, [d.key]: d.w }), {});
const INVESTOR_WEIGHTS = {
  affordability: 100, commute: 0, schools: 40, schoolAccess: 20, safety: 60,
  familySafety: 40, suburbGreen: 40, retailDining: 60, lotYard: 80, walk: 60,
  beach: 40, earthquake: 80, fire: 80, weather: 20, culture: 40,
};
const PERSONAS = [
  { key: "resident", label: "Resident", blurb: "You'll live here", weights: RESIDENT_WEIGHTS },
  { key: "investor", label: "Investor", blurb: "You'll rent it out", weights: INVESTOR_WEIGHTS },
];

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

// Built-in starting estimates for common LA-area towns, used by "AI fill" when
// the live model can't be reached from this web preview. These are rough
// starting points to adjust, not verified data. The live, town-specific lookup
// runs through the backend in the shipped app. Rating order matches RATED:
// schools, schoolAccess, safety, familySafety, suburbGreen, retailDining,
// lotYard, walk, beach, earthquake, fire, weather, culture (0-10, 10 = great;
// for earthquake/fire, 10 = lower risk). "own" is the owner-occupied housing
// share from the U.S. Census (ACS); renter share is the remainder. Tenure is
// display-only context and is never part of the score.
const mkRatings = (arr) => RATED.reduce((a, d, i) => ({ ...a, [d.key]: arr[i] }), {});
const NORM = (s) => (s || "").trim().toLowerCase();
const LOCAL_ESTIMATES = {
  "redondo beach":  { price: 1450000, own: 53, note: "Beach town, strong schools",      r: [10,8,8,8,8,8,6,8,10,6,8,10,8] },
  "el segundo":     { price: 1300000, own: 42, note: "Small-town feel by the coast",     r: [10,10,10,10,8,8,6,8,8,6,8,10,6] },
  "manhattan beach":{ price: 2600000, own: 65, note: "Premier beach, top schools",       r: [10,10,10,10,8,8,6,8,10,6,8,10,8] },
  "hermosa beach":  { price: 1900000, own: 51, note: "Lively beach community",           r: [8,8,8,6,6,10,6,10,10,6,8,10,8] },
  "torrance":       { price: 1050000, own: 55, note: "Solid value, good schools",        r: [8,8,8,8,8,8,8,6,6,6,8,10,6] },
  "woodland hills": { price: 1080000, own: 54, note: "Big lots, great retail",           r: [8,8,8,8,10,10,10,4,2,6,4,8,8] },
  "calabasas":      { price: 1750000, own: 69, note: "Upscale suburb, top schools",      r: [10,10,10,10,10,8,10,4,2,6,4,8,8] },
  "santa monica":   { price: 2200000, own: 28, note: "Coastal city, walkable",           r: [8,6,6,6,8,10,4,10,10,6,8,10,10] },
  "culver city":    { price: 1500000, own: 55, note: "Central, creative, walkable",      r: [8,6,8,8,6,10,6,8,6,6,8,10,10] },
  "pasadena":       { price: 1400000, own: 43, note: "Historic, cultural, leafy",        r: [8,8,8,8,8,10,8,8,2,6,6,8,10] },
  "glendale":       { price: 1200000, own: 35, note: "Convenient, diverse dining",       r: [8,8,8,8,6,10,6,6,2,6,6,8,8] },
  "long beach":     { price: 950000,  own: 41, note: "Urban coastal, varied areas",      r: [6,6,6,6,6,10,6,8,8,6,8,10,8] },
};
// Owner / renter split from the U.S. Census (ACS), display-only. Returns null
// when there is no built-in figure for the town.
function tenureFor(town) {
  const hit = LOCAL_ESTIMATES[NORM(town)];
  if (!hit || hit.own == null) return null;
  return { owner: hit.own, renter: 100 - hit.own };
}
// Returns a usable fill: a curated table hit when available, otherwise a neutral
// baseline anchored to the budget.
function localEstimate(town, budget) {
  const hit = LOCAL_ESTIMATES[NORM(town)];
  if (hit) return { estPrice: hit.price, note: hit.note, ratings: mkRatings(hit.r), source: "table" };
  const b = Number(budget) || 0;
  return { estPrice: b, note: "", ratings: RATED.reduce((a, d) => ({ ...a, [d.key]: 5 }), {}), source: "baseline" };
}

const fmtMoney = (n) => (n ? "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—");

// Approximate town-center coordinates for the built-in towns, so commute
// distance can be auto-computed from a saved work location without a network
// call. Real, time-aware drive distance comes from the backend.
const TOWN_COORDS = {
  "el segundo": [33.919, -118.416], "redondo beach": [33.849, -118.388],
  "manhattan beach": [33.885, -118.411], "hermosa beach": [33.862, -118.400],
  "torrance": [33.836, -118.341], "woodland hills": [34.168, -118.605],
  "calabasas": [34.138, -118.661], "santa monica": [34.020, -118.491],
  "culver city": [34.021, -118.397], "pasadena": [34.148, -118.145],
  "glendale": [34.143, -118.255], "long beach": [33.770, -118.194],
};
const ROAD_FACTOR = 1.25; // rough circuity bump from straight-line toward road miles
function haversineMi(a, b) {
  const toRad = (d) => (d * Math.PI) / 180, R = 3958.8;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
// Estimated road miles from work to a built-in town; null if either is unknown.
function autoMiles(workCoords, town) {
  const tc = TOWN_COORDS[NORM(town)];
  if (!workCoords || !tc) return null;
  return Math.round(haversineMi(workCoords, tc) * ROAD_FACTOR);
}
const ratingTo100 = (r) => Math.max(0, Math.min(100, (Number(r) || 0) * 10)); // 0-10 rating -> 0-100, in 10s

// Continuous linear affordability, generalized from the original's
// fixed formula to your own budget. At/under budget = 100, falls to 0 at 2× budget.
function affordabilityScore(price, budget) {
  if (!budget || !price) return 50;
  if (price <= budget) return 100;
  if (price >= budget * 2) return 0;
  return Math.round(100 * (1 - (price - budget) / budget));
}

// Commute tiers, ported verbatim from calcScore.
function commuteScore(miles) {
  if (miles == null || miles === "") return 50;
  const d = Number(miles);
  if (d <= 2) return 100;
  if (d <= 5) return 90;
  if (d <= 10) return 75;
  if (d <= 20) return 55;
  if (d <= 35) return 35;
  return 10;
}

// Standard mortgage P&I + tax + PMI + HOA, ported from calcMonthly.
function calcMonthly(price, dpPct, rate, term, taxRate = 1.25, hoa = 0) {
  if (!price) return 0;
  const loan = price * (1 - dpPct / 100);
  const r = rate / 100 / 12;
  const n = term * 12;
  const pi = r > 0 ? (loan * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : loan / n;
  const tax = (price * taxRate) / 100 / 12;
  const pmi = (loan * pmiAnnualRate(dpPct)) / 12; // drops off near 20% equity in reality
  return Math.round(pi + tax + hoa + pmi);
}

// Rough rate estimate by credit tier, anchored to the ~6.5% 30-year average
// (mid-2026). Deltas approximate typical credit-based pricing. This is an
// estimate for budgeting, never a rate quote.
const CREDIT_TIERS = [
  { key: "760", label: "760+ (excellent)",     delta: 0.00 },
  { key: "740", label: "740-759 (very good)",  delta: 0.10 },
  { key: "720", label: "720-739 (very good)",  delta: 0.20 },
  { key: "700", label: "700-719 (good)",       delta: 0.35 },
  { key: "680", label: "680-699 (good)",       delta: 0.55 },
  { key: "660", label: "660-679 (fair)",       delta: 0.80 },
  { key: "640", label: "640-659 (fair)",       delta: 1.15 },
  { key: "620", label: "620-639 (poor)",       delta: 1.55 },
  { key: "lt620", label: "Below 620 (subprime)", delta: 2.10 },
];
const DEFAULT_BASE_RATE = 6.4; // top tier, 20%+ down, ~mid-2026
const creditDelta = (key) => (CREDIT_TIERS.find((t) => t.key === key)?.delta ?? 0);

// Private mortgage insurance kicks in under 20% down; rougher the lower you go.
function pmiAnnualRate(dpPct) {
  if (dpPct >= 20) return 0;
  if (dpPct >= 15) return 0.004;
  if (dpPct >= 10) return 0.006;
  if (dpPct >= 5) return 0.009;
  return 0.011;
}

// Local persistence for the deployed site. Wrapped in try/catch so it simply
// no-ops in sandboxed previews that block storage, and saves normally on a real
// host. Only durable user data is stored; transient UI state is not.
const LS_KEY = "homeplot.v1";
function loadSaved() {
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function saveSaved(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

export default function NeighborhoodFit() {
  const [saved] = useState(loadSaved);
  const [budget, setBudget] = useState(saved?.budget ?? "1000000");
  const [workZip, setWorkZip] = useState(saved?.workZip ?? "");
  const [workCoords, setWorkCoords] = useState(saved?.workCoords ?? null);
  const [workStatus, setWorkStatus] = useState("idle"); // idle | loading | ok | bad
  const [weights, setWeights] = useState(saved?.weights ?? DIMENSIONS.reduce((a, d) => ({ ...a, [d.key]: d.w }), {}));
  const [persona, setPersona] = useState(saved?.persona ?? "resident");
  const [hoods, setHoods] = useState(saved?.hoods ?? []);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showWeights, setShowWeights] = useState(false);
  const [showMortgage, setShowMortgage] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const [view, setView] = useState("ranked");
  const [celebrate, setCelebrate] = useState(false);
  const prevLeader = useRef(null);

  // Follow the system light/dark setting; `forced` lets the prototype preview
  // either mode (null = follow system).
  const [sysDark, setSysDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches : false
  );
  const [forced, setForced] = useState(saved?.forced ?? null);
  const dark = forced === null ? sysDark : forced;
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = (e) => setSysDark(e.matches);
    mq.addEventListener ? mq.addEventListener("change", fn) : mq.addListener(fn);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", fn) : mq.removeListener(fn); };
  }, []);

  // Mortgage assumptions. Rate is derived from a base (top-credit) rate plus a
  // credit-tier adjustment, so the monthly estimate reflects credit and down
  // payment instead of a single hand-typed rate.
  const [dp, setDp] = useState(saved?.dp ?? 20);
  const [credit, setCredit] = useState(saved?.credit ?? "760");
  const [baseRate, setBaseRate] = useState(saved?.baseRate ?? DEFAULT_BASE_RATE);
  const [term, setTerm] = useState(saved?.term ?? 30);
  const rate = useMemo(() => +(baseRate + creditDelta(credit)).toFixed(3), [baseRate, credit]);

  // Save durable user data whenever it changes (no-op where storage is blocked).
  useEffect(() => {
    saveSaved({ hoods, budget, workZip, workCoords, weights, persona, dp, credit, baseRate, term, forced });
  }, [hoods, budget, workZip, workCoords, weights, persona, dp, credit, baseRate, term, forced]);

  // Geocode a US ZIP to coordinates for auto commute distance. Light,
  // CORS-friendly ZIP lookup; full address + real drive time live in backend.
  useEffect(() => {
    const zip = workZip.trim();
    if (!/^\d{5}$/.test(zip)) { setWorkCoords(null); setWorkStatus(zip ? "bad" : "idle"); return; }
    let cancelled = false;
    setWorkStatus("loading");
    fetch(`https://api.zippopotam.us/us/${zip}`)
      .then((r) => { if (!r.ok) throw new Error("no zip"); return r.json(); })
      .then((d) => {
        if (cancelled) return;
        const p = d.places && d.places[0];
        if (!p) throw new Error("no place");
        setWorkCoords([Number(p.latitude), Number(p.longitude)]);
        setWorkStatus("ok");
      })
      .catch(() => { if (!cancelled) { setWorkCoords(null); setWorkStatus("bad"); } });
    return () => { cancelled = true; };
  }, [workZip]);

  const scored = useMemo(() => {
    const b = Number(budget) || 0;
    const list = hoods.map((h) => {
      const manualMi = (h.miles != null && h.miles !== "") ? Number(h.miles) : null;
      const effMiles = manualMi != null ? manualMi : autoMiles(workCoords, h.town);
      const dimScores = {};
      DIMENSIONS.forEach((d) => {
        if (d.auto === "price") dimScores[d.key] = affordabilityScore(Number(h.price), b);
        else if (d.auto === "miles") dimScores[d.key] = commuteScore(effMiles);
        else dimScores[d.key] = ratingTo100(h.ratings[d.key] ?? 5);
      });
      let wsum = 0, total = 0;
      DIMENSIONS.forEach((d) => { wsum += weights[d.key]; total += weights[d.key] * dimScores[d.key]; });
      const score = wsum ? Math.round(total / wsum) : 0;
      const strengths = DIMENSIONS
        .map((d) => ({ label: d.label, contribution: (weights[d.key] / 100) * dimScores[d.key], raw: dimScores[d.key] }))
        .sort((a, b2) => b2.contribution - a.contribution)
        .slice(0, 2)
        .filter((s) => s.raw >= 55);
      const monthly = calcMonthly(Number(h.price), dp, rate, term);
      return { ...h, score, dimScores, strengths, monthly, effMiles, commuteAuto: manualMi == null && effMiles != null };
    });
    return list.sort((a, b2) => b2.score - a.score);
  }, [hoods, weights, budget, dp, rate, term, workCoords]);

  // Celebrate when a different neighborhood takes the lead.
  useEffect(() => {
    const leaderId = scored[0]?.id ?? null;
    if (prevLeader.current !== null && leaderId !== null && leaderId !== prevLeader.current && scored.length >= 2) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1600);
      prevLeader.current = leaderId;
      return () => clearTimeout(t);
    }
    prevLeader.current = leaderId;
  }, [scored]);

  const upsert = (h) => {
    if (editing) setHoods((p) => p.map((x) => (x.id === h.id ? h : x)));
    else setHoods((p) => [...p, { ...h, id: Date.now() }]);
    setShowAdd(false); setEditing(null);
  };

  const loadSample = () => {
    setBudget("1500000");
    // A real run off the built-in data: four LA-area towns, with realistic
    // driving distances from El Segundo and the curated 0-10 ratings. Marked
    // as table estimates, so they carry the asterisk and Census tenure.
    const picks = [
      { town: "El Segundo", miles: 1 },
      { town: "Redondo Beach", miles: 5 },
      { town: "Santa Monica", miles: 12 },
      { town: "Woodland Hills", miles: 21 },
    ];
    setHoods(picks.map((p, i) => {
      const e = LOCAL_ESTIMATES[p.town.toLowerCase()];
      return { id: i + 1, town: p.town, state: "CA", name: `${p.town}, CA`, price: e.price, miles: p.miles, note: e.note, ratings: mkRatings(e.r), source: "table" };
    }));
  };

  const resetWeights = () => { setPersona("resident"); setWeights({ ...RESIDENT_WEIGHTS }); };
  const applyPreset = (p) => { setPersona(p.key); setWeights({ ...p.weights }); };

  return (
    <div style={{ ...(dark ? DARK_VARS : LIGHT_VARS), background: PAPER, minHeight: "100vh", color: INK, fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .nf-display { font-family: 'Bricolage Grotesque', sans-serif; letter-spacing: -0.02em; }
        .nf-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 99px; background: ${LINE}; outline: none; }
        .nf-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: ${BRAND}; cursor: pointer; border: 3px solid ${PAPER}; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
        .nf-slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: ${BRAND}; cursor: pointer; border: 3px solid ${PAPER}; }
        .nf-btn { transition: transform .12s ease, box-shadow .12s ease, background .12s ease; cursor: pointer; }
        .nf-btn:hover { transform: translateY(-1px); }
        .nf-card { transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease; }
        .nf-ring { transition: stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1); }
        @keyframes nfpop { from { transform: scale(.96); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes nfspin { to { transform: rotate(360deg) } }
        .nf-pop { animation: nfpop .25s ease; }
        .nf-spin { animation: nfspin .9s linear infinite; }
        .nf-cards { display: grid; grid-template-columns: 1fr; gap: 14px; align-items: start; }
        /* Use the extra width on landscape phones, tablets, and laptops. */
        @media (min-width: 760px) { .nf-cards { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1100px) { .nf-cards { grid-template-columns: 1fr 1fr 1fr; } }
        @media (prefers-reduced-motion: reduce) { .nf-ring,.nf-card,.nf-btn{transition:none!important} .nf-pop,.nf-spin{animation:none!important} }
        @keyframes nffall { 0% { transform: translateY(-12vh) rotate(0deg); opacity: 1 } 100% { transform: translateY(112vh) rotate(560deg); opacity: 0 } }
        .nf-confetti { position: fixed; inset: 0; pointer-events: none; z-index: 60; overflow: hidden; }
        .nf-confetti i { position: absolute; top: 0; width: 9px; height: 14px; border-radius: 2px; animation: nffall 1.5s cubic-bezier(.3,.7,.4,1) forwards; }
        .nf-link { display: inline-flex; align-items: center; gap: 4px; color: ${CORAL}; font-weight: 600; font-size: 12.5px; text-decoration: none; }
        .nf-link:hover { text-decoration: underline; }
        :focus-visible { outline: 2px solid ${CORAL}; outline-offset: 2px; border-radius: 6px; }
        :focus:not(:focus-visible) { outline: none; }
        input, select, textarea { color: var(--text); -webkit-text-fill-color: var(--text); }
        ::placeholder { color: var(--text-dim); opacity: 0.6; }
        @media (prefers-reduced-motion: reduce) { .nf-confetti { display: none } }
      `}</style>

      <header style={{ borderBottom: `1px solid ${LINE}`, background: PAPER, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 940, margin: "0 auto", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: BRAND, display: "grid", placeItems: "center" }}>
              <MapPin size={18} color={GOLD} />
            </div>
            <div>
              <div className="nf-display" style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}>HomePlot</div>
              <div style={{ fontSize: 12, color: SLATE, marginTop: 2, fontWeight: 500 }}>
                <span style={{ color: TEAL, fontWeight: 700 }}>Plot</span> your perfect neighborhood
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="nf-btn" onClick={() => setForced(!dark)} title="Preview light or dark"
              aria-label={dark ? "Switch to light appearance" : "Switch to dark appearance"}
              style={{ ...ghostBtn, padding: 9 }}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="nf-btn" onClick={() => { setEditing(null); setShowAdd(true); }}
              style={{ display: "flex", alignItems: "center", gap: 7, background: CORAL, border: "none", borderRadius: 10, padding: "9px 14px", fontWeight: 700, fontSize: 14, color: "#fff", boxShadow: "0 2px 0 #d8463b" }}>
              <Plus size={16} /> Add place
            </button>
            <button className="nf-btn" onClick={() => setShowWeights(true)} style={ghostBtn}>
              <SlidersHorizontal size={16} /> Priorities
            </button>
            <button className="nf-btn" onClick={() => setShowMortgage(true)} style={ghostBtn}>
              <Wallet size={16} /> Mortgage
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 940, margin: "0 auto", padding: "22px 20px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: SURF, border: `1px solid ${LINE}`, borderRadius: 14, padding: "14px 16px", marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: SLATE, fontSize: 13, fontWeight: 600 }}>
            <Wallet size={16} /> Your budget
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: INK, fontWeight: 700 }}>$</span>
            <input id="budget-input" value={budget ? Number(budget).toLocaleString("en-US") : ""} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric" placeholder="1,000,000"
              style={{ width: 140, fontSize: 16, fontWeight: 800, border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 10px", color: INK, WebkitTextFillColor: INK, fontFamily: "inherit", background: SURF }} />
          </div>
          <span style={{ fontSize: 12.5, color: SLATE }}>Places at or under budget score full points on affordability.</span>
          <div style={{ flexBasis: "100%", height: 0 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: SLATE, fontSize: 13, fontWeight: 600 }}>
            <MapPin size={16} /> Work ZIP
          </div>
          <input value={workZip} onChange={(e) => setWorkZip(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
            inputMode="numeric" placeholder="90245" maxLength={5}
            style={{ width: 92, fontSize: 15, fontWeight: 700, border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 10px", color: INK, WebkitTextFillColor: INK, fontFamily: "inherit", background: SURF }} />
          <span style={{ fontSize: 12.5, color: workStatus === "bad" ? CORAL : SLATE }}>
            {workStatus === "loading" ? "Finding…"
              : workStatus === "ok" ? "Commute miles auto-fill for built-in towns (straight-line estimate)."
              : workStatus === "bad" ? "Enter a valid 5-digit ZIP."
              : "Set it to auto-estimate distance to each town."}
          </span>
        </div>

        {scored.length === 0 ? (
          <div className="nf-pop" style={{ textAlign: "center", padding: "60px 20px", border: `2px dashed ${LINE}`, borderRadius: 18, background: SURF }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: PAPER, display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              <MapPin size={26} color={CORAL} />
            </div>
            <h2 className="nf-display" style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>Add your first place</h2>
            <p style={{ color: SLATE, maxWidth: 440, margin: "0 auto 18px", fontSize: 14.5, lineHeight: 1.55 }}>
              Drop in a neighborhood or town you're weighing. Give it a quick gut-check, or let AI fill it in. It starts ranking against the rest right away.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 22 }}>
              {[
                { n: "1", label: "Your budget", onClick: () => { const el = document.getElementById("budget-input"); if (el) { el.focus(); el.select && el.select(); } } },
                { n: "2", label: "Add places", onClick: () => { setEditing(null); setShowAdd(true); } },
                { n: "3", label: "Tune priorities", onClick: () => setShowWeights(true) },
              ].map((s) => (
                <button key={s.n} className="nf-btn" onClick={s.onClick}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(31,169,143,.12)", border: `1px solid ${TEAL}`, borderRadius: 999, padding: "7px 14px", fontWeight: 700, fontSize: 12.5, color: TEAL, fontFamily: "inherit", cursor: "pointer" }}>
                  <span style={{ display: "grid", placeItems: "center", width: 18, height: 18, borderRadius: 999, background: TEAL, color: "#fff", fontSize: 11, fontWeight: 800 }}>{s.n}</span>
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="nf-btn" onClick={() => { setEditing(null); setShowAdd(true); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: CORAL, border: "none", borderRadius: 11, padding: "12px 20px", fontWeight: 700, color: "#fff", fontSize: 15, boxShadow: "0 2px 0 #d8463b" }}>
                <Plus size={17} /> Add a place
              </button>
              <button className="nf-btn" onClick={loadSample}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: SURF, border: `1px solid ${LINE}`, borderRadius: 11, padding: "12px 18px", fontWeight: 600, color: INK, fontSize: 15 }}>
                <Sparkles size={16} color={GOLD} /> Try a sample
              </button>
            </div>
          </div>
        ) : (
          <>
            {scored.length >= 2 && <Verdict scored={scored} />}
            {scored.length >= 2 && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div style={{ display: "inline-flex", background: SURF, border: `1px solid ${LINE}`, borderRadius: 11, padding: 3, gap: 3 }}>
                  {[["ranked", "Ranked", List], ["compare", "Side by side", Table]].map(([key, label, Icon]) => (
                    <button key={key} onClick={() => setView(key)} className="nf-btn"
                      style={{ display: "flex", alignItems: "center", gap: 6, border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 13.5, fontFamily: "inherit", cursor: "pointer", background: view === key ? BRAND : "transparent", color: view === key ? "#fff" : SLATE }}>
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {view === "compare" && scored.length >= 2 ? (
              <CompareView scored={scored} />
            ) : (
              <div className="nf-cards">
                {scored.map((h, i) => (
                  <HoodCard key={h.id} h={h} rank={i}
                    expanded={expanded === h.id}
                    onToggle={() => setExpanded(expanded === h.id ? null : h.id)}
                    onEdit={() => { setEditing(h); setShowAdd(true); }}
                    onDelete={() => setHoods((p) => p.filter((x) => x.id !== h.id))} />
                ))}
              </div>
            )}
            {scored.some((h) => h.source === "ai" || h.source === "table") && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 14, fontSize: 12, color: SLATE }}>
                <span style={{ color: GOLD, fontWeight: 800 }}>*</span>
                <span>Estimated, not verified. These figures were filled by a lookup, not confirmed against official records. Open Edit to set your own numbers. Census owner/renter shares are real ACS data.</span>
              </div>
            )}
          </>
        )}
      </main>

      <footer style={{ textAlign: "center", padding: "10px 20px 36px", fontSize: 12, color: SLATE }}>
        HomePlot · Plot your perfect neighborhood
      </footer>

      {celebrate && <Confetti />}
      {showAdd && <AddModal initial={editing} budget={budget}
        onClose={() => { setShowAdd(false); setEditing(null); }} onSave={upsert} />}
      {showWeights && <WeightsModal weights={weights} setWeights={setWeights} persona={persona} applyPreset={applyPreset} onReset={resetWeights} onClose={() => setShowWeights(false)} />}
      {showMortgage && <MortgageModal dp={dp} setDp={setDp} credit={credit} setCredit={setCredit} baseRate={baseRate} setBaseRate={setBaseRate} term={term} setTerm={setTerm} rate={rate} budget={budget} onClose={() => setShowMortgage(false)} />}
    </div>
  );
}

/* ---------------- Card ---------------- */
function HoodCard({ h, rank, expanded, onToggle, onEdit, onDelete }) {
  const leader = rank === 0;
  const ringColor = h.score >= 75 ? TEAL : h.score >= 50 ? GOLD : CORAL;
  const tenure = tenureFor(h.town || h.name);
  const R = 30, C = 2 * Math.PI * R, off = C * (1 - h.score / 100);
  return (
    <div className="nf-card nf-pop" style={{
      background: SURF, border: leader ? `2px solid ${GOLD}` : `1px solid ${LINE}`,
      borderRadius: 16, padding: 16,
      boxShadow: leader ? "0 8px 24px rgba(242,180,65,.22)" : "0 1px 2px rgba(0,0,0,.03)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative", width: 76, height: 76, flexShrink: 0 }}>
          <svg width="76" height="76" viewBox="0 0 76 76">
            <circle cx="38" cy="38" r={R} fill="none" style={{ stroke: LINE }} strokeWidth="8" />
            <circle className="nf-ring" cx="38" cy="38" r={R} fill="none" stroke={ringColor}
              strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 38 38)" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <div className="nf-display" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{h.score}</div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3 className="nf-display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {h.name}{(h.source === "ai" || h.source === "table") && <span title="Estimated, not verified" style={{ color: GOLD, fontWeight: 800, marginLeft: 1 }}>*</span>}
            </h3>
            {leader && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: GOLD, color: ONGOLD, fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 99 }}>
                <Crown size={12} /> Best match
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, color: SLATE, fontSize: 13.5, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: INK }}>{fmtMoney(h.price)}</span>
            {h.monthly > 0 && <span>≈ {fmtMoney(h.monthly)}/mo</span>}
            {h.strengths.length > 0 && <span>Strong on {h.strengths.map((s) => s.label.toLowerCase()).join(" and ")}</span>}
          </div>
          {h.note && <div style={{ fontSize: 13, color: SLATE, marginTop: 4, fontStyle: "italic" }}>"{h.note}"</div>}
          {h.effMiles != null && (
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={13} />
              <span><b style={{ color: INK }}>{h.effMiles} mi</b> to work{h.commuteAuto ? <span style={{ opacity: .7 }}> · straight-line est.<span title="Estimated, not verified" style={{ color: GOLD, fontWeight: 800 }}>*</span></span> : <span style={{ opacity: .7 }}> · you entered this</span>}</span>
            </div>
          )}
          {tenure && (
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Users size={13} />
              <span><b style={{ color: INK }}>{tenure.owner}%</b> owner · <b style={{ color: INK }}>{tenure.renter}%</b> renter</span>
              <span style={{ opacity: .7 }}>· Census ACS</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
            <a className="nf-link" target="_blank" rel="noopener noreferrer"
              href={`https://www.zillow.com/homes/${encodeURIComponent(((h.town && h.state) ? `${h.town} ${h.state}` : h.name).trim().replace(/\s+/g, "-"))}_rb/`}>
              Zillow <ExternalLink size={12} />
            </a>
            <a className="nf-link" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/search?q=${encodeURIComponent((((h.town && h.state) ? `${h.town} ${h.state}` : h.name)) + " homes for sale site:redfin.com")}`}>
              Redfin <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="nf-btn" onClick={onEdit} title="Edit" style={iconBtn}><Pencil size={15} /></button>
          <button className="nf-btn" onClick={onDelete} title="Remove" style={iconBtn}><Trash2 size={15} /></button>
        </div>
      </div>
      <button onClick={onToggle} style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "none", color: SLATE, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        {expanded ? "Hide breakdown" : "See breakdown"} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 12, borderTop: `1px solid ${LINE}`, display: "grid", gap: 9 }}>
          {DIMENSIONS.map((d) => {
            const v = h.dimScores[d.key], col = v >= 75 ? TEAL : v >= 50 ? GOLD : CORAL;
            const star = (h.source === "ai" || h.source === "table") && d.key !== "commute";
            return (
              <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 120, fontSize: 13, color: SLATE, flexShrink: 0 }}>{d.label}</div>
                <div style={{ flex: 1, height: 8, background: LINE, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: `${v}%`, height: "100%", background: col, borderRadius: 99, transition: "width .5s ease" }} />
                </div>
                <div style={{ width: 38, textAlign: "right", fontSize: 12.5, fontWeight: 700 }}>{Math.round(v)}{star && <span title="Estimated, not verified" style={{ color: GOLD }}>*</span>}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Verdict (plain-English recommendation) ---------------- */
function Verdict({ scored }) {
  const leader = scored[0];
  const runner = scored[1];
  const leaderName = leader.town || leader.name;
  const runnerName = runner.town || runner.name;
  // "Wins on" should be factors where the leader actually leads the field, not
  // just its own highest scores. Rank those by how much they matter (weight x
  // score). Fall back to strongest factors if it leads on fewer than two.
  const fieldMax = {};
  DIMENSIONS.forEach((d) => { fieldMax[d.key] = Math.max(...scored.map((h) => h.dimScores[d.key])); });
  const leads = DIMENSIONS
    .filter((d) => leader.dimScores[d.key] >= fieldMax[d.key] - 0.01)
    .map((d) => ({ label: d.label, v: leader.dimScores[d.key] }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.label.toLowerCase());
  const strongest = DIMENSIONS
    .map((d) => ({ label: d.label, v: leader.dimScores[d.key] }))
    .sort((a, b) => b.v - a.v)
    .map((x) => x.label.toLowerCase());
  const winList = (leads.length >= 2 ? leads : [...leads, ...strongest.filter((l) => !leads.includes(l))]).slice(0, 2);
  const top = winList;
  const verb = leads.length >= 2 ? "wins on" : leads.length === 1 ? "leads on" : "is strongest on";
  const gap = DIMENSIONS
    .map((d) => ({ label: d.label, diff: runner.dimScores[d.key] - leader.dimScores[d.key] }))
    .sort((a, b) => b.diff - a.diff)[0];

  const pL = Number(leader.price), pR = Number(runner.price);
  let priceClause = "";
  if (pL && pR && pL !== pR) {
    const diff = fmtMoney(Math.abs(pL - pR));
    priceClause = pR < pL ? ` and saves you ${diff}` : ` though it costs ${diff} more`;
  }
  const rival = gap && gap.diff >= 12
    ? ` Its closest rival, ${runnerName}, edges it on ${gap.label.toLowerCase()}${priceClause}.`
    : priceClause ? ` ${runnerName} is close behind${priceClause}.` : ` ${runnerName} is close behind.`;

  const sentence = `${leaderName} is your best match, scoring ${leader.score}. It ${verb} ${top[0]} and ${top[1]}.${rival}`;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const ranking = scored.map((h, i) => `${i + 1}. ${h.name} — ${h.score}`).join("\n");
    const txt = `HomePlot ranking\n\n${ranking}\n\nThe verdict: ${sentence}`;
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="nf-pop" style={{
      background: SURF, border: `1px solid ${LINE}`, borderLeft: `4px solid ${GOLD}`,
      borderRadius: 14, padding: "16px 18px", marginBottom: 16, display: "flex", gap: 13, alignItems: "flex-start",
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(242,180,65,.16)", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Trophy size={19} color="#C98A14" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 3 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: SLATE }}>The verdict</div>
          <button onClick={share} className="nf-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "none", color: copied ? TEAL : SLATE, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", flexShrink: 0 }}>
            {copied ? <><Check size={13} strokeWidth={3} /> Copied</> : <><ExternalLink size={13} /> Share</>}
          </button>
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.5, color: INK }}>
          <strong>{leaderName}</strong> is your best match, scoring {leader.score}. It {verb} {top[0]} and {top[1]}.{rival}
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const colors = [CORAL, GOLD, TEAL, INK];
  const bits = Array.from({ length: 28 }, (_, i) => ({
    left: Math.random() * 100,
    bg: colors[i % colors.length],
    delay: Math.random() * 0.25,
    dur: 1.2 + Math.random() * 0.6,
  }));
  return (
    <div className="nf-confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}%`, background: b.bg, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }} />
      ))}
    </div>
  );
}

/* ---------------- Side-by-side comparison ---------------- */
function CompareView({ scored }) {
  const bestScore = Math.max(...scored.map((h) => h.score));
  const validPrices = scored.map((h) => Number(h.price)).filter((p) => p > 0);
  const bestPrice = validPrices.length ? Math.min(...validPrices) : null;
  const validMonthly = scored.map((h) => h.monthly).filter((m) => m > 0);
  const bestMonthly = validMonthly.length ? Math.min(...validMonthly) : null;
  const bestDim = {};
  DIMENSIONS.forEach((d) => { bestDim[d.key] = Math.max(...scored.map((h) => h.dimScores[d.key])); });

  const scoreColor = (v) => (v >= 75 ? TEAL : v >= 50 ? GOLD : CORAL);
  const rowLabel = { position: "sticky", left: 0, zIndex: 1, background: SURF, textAlign: "left", padding: "10px 14px", fontSize: 13, color: SLATE, fontWeight: 600, whiteSpace: "nowrap", borderRight: `1px solid ${LINE}` };
  const cell = { padding: "10px", textAlign: "center", borderLeft: `1px solid ${LINE}`, borderTop: `1px solid ${LINE}`, minWidth: 124 };
  const best = { background: "rgba(31,169,143,.14)" };
  const Tick = () => <Check size={12} color={TEAL} strokeWidth={3} style={{ verticalAlign: "middle", marginLeft: 4 }} />;

  return (
    <div className="nf-pop" style={{ background: SURF, border: `1px solid ${LINE}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...rowLabel, verticalAlign: "bottom", borderBottom: `1px solid ${LINE}` }}>Neighborhood</th>
              {scored.map((h, i) => (
                <th key={h.id} style={{ ...cell, verticalAlign: "bottom", borderTop: "none", borderBottom: `1px solid ${LINE}`, background: i === 0 ? "rgba(242,180,65,.10)" : SURF }}>
                  {i === 0 && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 3, background: GOLD, color: ONGOLD, fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 99, marginBottom: 6 }}>
                      <Crown size={11} /> Best
                    </div>
                  )}
                  <div className="nf-display" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.15 }}>{h.name}{(h.source === "ai" || h.source === "table") && <span title="Estimated, not verified" style={{ color: GOLD, fontWeight: 800 }}>*</span>}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" style={rowLabel}>Match score</th>
              {scored.map((h) => (
                <td key={h.id} style={{ ...cell, ...(h.score === bestScore ? best : {}) }}>
                  <span className="nf-display" style={{ fontSize: 22, fontWeight: 800, color: scoreColor(h.score) }}>{h.score}</span>
                  {h.score === bestScore && <Tick />}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" style={rowLabel}>Price</th>
              {scored.map((h) => {
                const p = Number(h.price);
                const b = bestPrice != null && p === bestPrice;
                return <td key={h.id} style={{ ...cell, ...(b ? best : {}), fontSize: 13.5, fontWeight: b ? 700 : 500 }}>{p ? fmtMoney(p) : "—"}{b && <Tick />}</td>;
              })}
            </tr>
            <tr>
              <th scope="row" style={rowLabel}>Est. monthly</th>
              {scored.map((h) => {
                const b = bestMonthly != null && h.monthly === bestMonthly;
                return <td key={h.id} style={{ ...cell, ...(b ? best : {}), fontSize: 13.5, fontWeight: b ? 700 : 500 }}>{h.monthly ? fmtMoney(h.monthly) : "—"}{b && <Tick />}</td>;
              })}
            </tr>
            {DIMENSIONS.map((d) => (
              <tr key={d.key}>
                <th scope="row" style={rowLabel}>{d.label}</th>
                {scored.map((h) => {
                  const v = Math.round(h.dimScores[d.key]);
                  const b = h.dimScores[d.key] === bestDim[d.key];
                  const star = (h.source === "ai" || h.source === "table") && d.key !== "commute";
                  return (
                    <td key={h.id} style={{ ...cell, ...(b ? best : {}) }}>
                      <div style={{ fontSize: 13, fontWeight: b ? 700 : 600, color: INK }}>{v}{star && <span title="Estimated, not verified" style={{ color: GOLD }}>*</span>}{b && <Tick />}</div>
                      <div style={{ height: 5, background: LINE, borderRadius: 99, overflow: "hidden", marginTop: 4 }}>
                        <div style={{ width: `${v}%`, height: "100%", background: scoreColor(v) }} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "10px 14px", fontSize: 12, color: SLATE, borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <Check size={13} color={TEAL} strokeWidth={3} /> marks the best in each row. Scroll sideways to see every neighborhood.
      </div>
    </div>
  );
}

/* ---------------- Add / edit ---------------- */
function AddModal({ initial, budget, onClose, onSave }) {
  const [town, setTown] = useState(initial?.town || "");
  const [stateCode, setStateCode] = useState(initial?.state || "");
  const [price, setPrice] = useState(initial?.price ? String(initial.price) : "");
  const [miles, setMiles] = useState(initial?.miles != null ? String(initial.miles) : "");
  const [note, setNote] = useState(initial?.note || "");
  const [ratings, setRatings] = useState(initial?.ratings || RATED.reduce((a, d) => ({ ...a, [d.key]: 5 }), {}));
  const [aiState, setAiState] = useState("idle"); // idle | loading | estimated | aiestimated | notfound | unreachable
  const [source, setSource] = useState(initial?.source || "user"); // user | table | ai
  const [suggest, setSuggest] = useState("");
  const valid = town.trim().length > 0 && stateCode.length > 0;
  const firedRef = useRef("");

  // Fill from the verified built-in set instantly when we have it. Otherwise do
  // a live lookup that FIRST makes the model confirm the place is a real US
  // town and return nothing if it can't. That lets any real US town be filled,
  // while a name that isn't real (a made-up town) gets no invented data. The
  // results for non-built-in towns are clearly labeled estimates, not facts.
  // The authoritative real-town check belongs in the backend (Census/geocoder),
  // which the shipped app routes through; this is the prototype's best effort.
  async function aiFill() {
    if (!town.trim() || !stateCode) return;
    const local = localEstimate(town, budget);
    if (local.source === "table") {
      setPrice(String(local.estPrice));
      setNote((n) => n || local.note);
      setRatings((r) => ({ ...r, ...local.ratings }));
      setSource("table");
      setAiState("estimated");
      return;
    }
    setAiState("loading");
    setSuggest("");
    try {
      // Calls this site's own backend function (/api/lookup), which keeps the
      // API key server-side and works for any real US town. Same origin, so no
      // CORS. In a sandboxed preview without the function it falls through to
      // "unreachable" and the built-in towns still work.
      const resp = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ town: town.trim(), state: stateCode }),
      });
      if (!resp.ok) throw new Error("unreachable");
      const parsed = await resp.json();
      // Accept a match when the model confirms a real place whose name lines up
      // with what was typed. We compare just the town portion (the model often
      // returns "Town, ST"), ignoring case, punctuation, and the state suffix,
      // so normal entries pass while genuine typos are still caught.
      const norm = (s) =>
        String(s || "")
          .toLowerCase()
          .split(",")[0]              // drop ", ST" if the model included it
          .replace(/[^a-z0-9 ]/g, "") // ignore punctuation like periods/apostrophes
          .replace(/\s+/g, " ")
          .trim();
      const typed = norm(town);
      const matched = norm(parsed && parsed.matchedName);
      const ok = parsed && parsed.found === true && (!matched || matched === typed);
      if (!ok) {
        if (parsed && parsed.matchedName && matched !== typed) setSuggest(String(parsed.matchedName));
        setAiState("notfound");
        return;
      }
      if (parsed.estPrice) setPrice(String(Math.round(parsed.estPrice)));
      if (parsed.note) setNote((n) => n || parsed.note);
      setRatings((r) => ({ ...r, ...(parsed.ratings || {}) }));
      setSource("ai");
      setAiState("aiestimated");
    } catch (err) {
      setAiState("unreachable");
    }
  }

  // Auto-run the lookup once both town and state are set, debounced, and only
  // once per town+state. Skips when editing an existing place or when a price
  // has already been entered, so it never clobbers what's there.
  useEffect(() => {
    if (initial) return;
    const key = `${town.trim().toLowerCase()}|${stateCode}`;
    if (!town.trim() || !stateCode || price) return;
    if (firedRef.current === key) return;
    const t = setTimeout(() => { firedRef.current = key; aiFill(); }, 700);
    return () => clearTimeout(t);
  }, [town, stateCode, price, initial]);

  return (
    <Overlay onClose={onClose}>
      <div className="nf-pop" style={modalStyle}>
        <ModalHead title={initial ? "Edit place" : "Add a place"} onClose={onClose} />
        <div style={{ padding: "4px 20px 20px", overflowY: "auto" }}>
          <Field label="Town or neighborhood">
            <div style={{ display: "flex", gap: 8 }}>
              <input autoFocus value={town} onChange={(e) => setTown(e.target.value)} placeholder="e.g. Cedar Grove" style={inputStyle} />
              <button className="nf-btn" onClick={aiFill} disabled={!town.trim() || aiState === "loading"}
                style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", background: BRAND, color: "#fff", border: "none", borderRadius: 10, padding: "0 13px", fontWeight: 600, fontSize: 13, fontFamily: "inherit", cursor: town.trim() ? "pointer" : "default", opacity: town.trim() ? 1 : 0.5 }}>
                {aiState === "loading" ? <Loader2 size={15} className="nf-spin" /> : <Sparkles size={15} color={GOLD} />} AI fill
              </button>
            </div>
            {aiState === "loading" && <div style={{ fontSize: 12, color: SLATE, marginTop: 5 }}>Checking {town.trim()}…</div>}
            {aiState === "estimated" && <div style={{ fontSize: 12, color: TEAL, marginTop: 5 }}>Filled a starting estimate for {town.trim()} (rough, not verified). Adjust anything that looks off.</div>}
            {aiState === "aiestimated" && <div style={{ fontSize: 12, color: TEAL, marginTop: 5 }}>AI estimate for {town.trim()} (a real place, but not verified data). Adjust anything that looks off.</div>}
            {aiState === "notfound" && (
              <div style={{ marginTop: 7, fontSize: 12.5, color: INK, background: "rgba(242,180,65,.14)", border: `1px solid ${GOLD}`, borderRadius: 9, padding: "8px 10px", display: "flex", gap: 7, alignItems: "flex-start" }}>
                <Info size={14} color={GOLD} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Couldn't confirm "{town.trim()}, {stateCode}" as a real US place, so nothing was filled.{suggest ? ` Did you mean ${suggest}?` : ""} Check the spelling, or enter the details yourself.</span>
              </div>
            )}
            {aiState === "unreachable" && (
              <div style={{ marginTop: 7, fontSize: 12.5, color: INK, background: "rgba(242,180,65,.14)", border: `1px solid ${GOLD}`, borderRadius: 9, padding: "8px 10px", display: "flex", gap: 7, alignItems: "flex-start" }}>
                <Info size={14} color={GOLD} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>The live lookup isn't reachable right now, so nothing was filled. Enter the price and ratings yourself.</span>
              </div>
            )}
          </Field>
          <Field label="State">
            <select value={stateCode} onChange={(e) => setStateCode(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer", color: stateCode ? INK : SLATE }}>
              <option value="">Select a state</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="Home price" style={{ flex: 1 }}>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="1425000" style={inputStyle} />
            </Field>
            <Field label="Miles to work" style={{ flex: 1 }}>
              <input value={miles} onChange={(e) => setMiles(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder="Auto from work ZIP" style={inputStyle} />
            </Field>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: INK, margin: "16px 0 4px" }}>Rate it</div>
          <div style={{ fontSize: 12.5, color: SLATE, marginBottom: 12 }}>0 (poor) to 10 (great). Affordability and commute come from the numbers above.</div>
          <div style={{ display: "grid", gap: 18 }}>
            {RATING_GROUPS.map((g) => (
              <div key={g.title}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: SLATE, marginBottom: 9 }}>{g.title}</div>
                <div style={{ display: "grid", gap: 11 }}>
                  {g.keys.map((k) => {
                    const d = DIM_BY_KEY[k];
                    return (
                      <div key={k}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d.label}</span>
                          <span style={{ fontSize: 12, color: SLATE }}>{d.blurb}</span>
                        </div>
                        <Dots value={ratings[k]} onChange={(v) => setRatings((r) => ({ ...r, [k]: v }))} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <Field label="Note (optional)" style={{ marginTop: 16 }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What stood out?" style={inputStyle} />
          </Field>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${LINE}`, display: "flex", gap: 10 }}>
          <button onClick={onClose} className="nf-btn" style={{ flex: 1, background: SURF, border: `1px solid ${LINE}`, borderRadius: 11, padding: 12, fontWeight: 600, color: INK, fontFamily: "inherit", fontSize: 14.5 }}>Cancel</button>
          <button disabled={!valid} className="nf-btn"
            onClick={() => onSave({ id: initial?.id, town: town.trim(), state: stateCode, name: `${town.trim()}, ${stateCode}`, price: Number(price) || 0, miles: miles === "" ? null : Number(miles), note: note.trim(), ratings, source })}
            style={{ flex: 2, background: valid ? CORAL : "#f0c4bf", border: "none", borderRadius: 11, padding: 12, fontWeight: 700, color: "#fff", fontFamily: "inherit", fontSize: 14.5, cursor: valid ? "pointer" : "default" }}>
            {initial ? "Save changes" : "Add place"}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ---------------- Priorities ---------------- */
function WeightsModal({ weights, setWeights, persona, applyPreset, onReset, onClose }) {
  return (
    <Overlay onClose={onClose}>
      <div className="nf-pop" style={modalStyle}>
        <ModalHead title="What matters to you" onClose={onClose} />
        <div style={{ padding: "4px 20px 8px" }}>
          <p style={{ fontSize: 13, color: SLATE, margin: "0 0 10px" }}>Pick a starting point, then slide each one up or down. Places re-rank instantly.</p>
          <div style={{ display: "flex", gap: 8 }}>
            {PERSONAS.map((p) => {
              const active = persona === p.key;
              return (
                <button key={p.key} onClick={() => applyPreset(p)} className="nf-btn"
                  style={{ flex: 1, textAlign: "left", border: `1px solid ${active ? BRAND : LINE}`, background: active ? BRAND : SURF, color: active ? "#fff" : INK, borderRadius: 11, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.label}</div>
                  <div style={{ fontSize: 11.5, color: active ? "rgba(255,255,255,.85)" : SLATE, marginTop: 2 }}>{p.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ padding: "0 20px 8px", overflowY: "auto", display: "grid", gap: 15 }}>
          {DIMENSIONS.map((d) => (
            <div key={d.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{d.label}</span>
                <span style={{ fontSize: 12.5, color: SLATE, fontWeight: 600 }}>{weightLabel(weights[d.key])}</span>
              </div>
              <input type="range" min="0" max="100" step="5" className="nf-slider" value={weights[d.key]}
                onChange={(e) => setWeights((w) => ({ ...w, [d.key]: Number(e.target.value) }))} />
            </div>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${LINE}`, display: "flex", gap: 10 }}>
          <button onClick={onReset} className="nf-btn" style={{ display: "flex", alignItems: "center", gap: 7, background: SURF, border: `1px solid ${LINE}`, borderRadius: 11, padding: "12px 14px", fontWeight: 600, color: SLATE, fontFamily: "inherit", fontSize: 14 }}>
            <RotateCcw size={15} /> Reset
          </button>
          <button onClick={onClose} className="nf-btn" style={{ flex: 1, background: BRAND, border: "none", borderRadius: 11, padding: 12, fontWeight: 700, color: "#fff", fontFamily: "inherit", fontSize: 14.5 }}>Done</button>
        </div>
      </div>
    </Overlay>
  );
}

/* ---------------- Mortgage ---------------- */
function MortgageModal({ dp, setDp, credit, setCredit, baseRate, setBaseRate, term, setTerm, rate, budget, onClose }) {
  const [price, setPrice] = useState(String(budget || 1000000));
  const rows = [
    { label: "Down payment", value: dp, set: setDp, suffix: "%", min: 0, max: 50, step: 1 },
    { label: "Loan term", value: term, set: setTerm, suffix: " yrs", min: 10, max: 30, step: 5 },
    { label: "Base rate (top credit)", value: baseRate, set: setBaseRate, suffix: "%", min: 3, max: 10, step: 0.05 },
  ];
  // Monthly breakdown for the entered home price.
  const p = Number(price) || 0;
  const loan = p * (1 - dp / 100);
  const mr = rate / 100 / 12, n = term * 12;
  const pi = mr > 0 ? (loan * mr * Math.pow(1 + mr, n)) / (Math.pow(1 + mr, n) - 1) : loan / n;
  const taxMo = (p * 1.25) / 100 / 12;
  const pmiMo = (loan * pmiAnnualRate(dp)) / 12;
  const monthly = Math.round(pi + taxMo + pmiMo);
  const usd = (v) => "$" + Math.round(v).toLocaleString("en-US");
  return (
    <Overlay onClose={onClose}>
      <div className="nf-pop" style={{ ...modalStyle, maxWidth: 440 }}>
        <ModalHead title="Mortgage estimate" onClose={onClose} />
        <div style={{ padding: "4px 20px 8px" }}>
          <p style={{ fontSize: 13, color: SLATE, marginTop: 0 }}>Estimates a monthly payment from your credit, down payment, and term, plus a 1.25% property-tax estimate. Under 20% down adds PMI. The same assumptions drive each card's monthly figure.</p>
        </div>
        <div style={{ padding: "0 20px 12px", display: "grid", gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Home price</div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: SLATE, fontSize: 14.5, fontWeight: 600 }}>$</span>
              <input inputMode="numeric" value={p ? p.toLocaleString("en-US") : ""} placeholder="1,000,000"
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
                style={{ ...inputStyle, paddingLeft: 24 }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Credit score</div>
            <select value={credit} onChange={(e) => setCredit(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {CREDIT_TIERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          {rows.map((r) => (
            <div key={r.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{r.value}{r.suffix}</span>
              </div>
              <input type="range" min={r.min} max={r.max} step={r.step} className="nf-slider" value={r.value}
                onChange={(e) => r.set(Number(e.target.value))} />
            </div>
          ))}
        </div>
        <div style={{ margin: "0 20px 14px", padding: "14px", background: "rgba(31,169,143,.10)", border: `1px solid ${TEAL}`, borderRadius: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>Est. monthly payment</span>
            <span className="nf-display" style={{ fontSize: 26, fontWeight: 800, color: TEAL }}>{usd(monthly)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: SLATE }}>
            <span>Rate {rate.toFixed(2)}%</span>
            <span>P&amp;I {usd(pi)} · Tax {usd(taxMo)}{pmiMo > 0 ? ` · PMI ${usd(pmiMo)}` : ""}</span>
          </div>
          <div style={{ fontSize: 11.5, color: SLATE, marginTop: 7, borderTop: `1px solid ${LINE}`, paddingTop: 7 }}>Estimate only, not a rate quote. Real rates change daily and depend on the lender, points, loan type, and your full finances. Excludes homeowners insurance and HOA dues.</div>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${LINE}` }}>
          <button onClick={onClose} className="nf-btn" style={{ width: "100%", background: BRAND, border: "none", borderRadius: 11, padding: 12, fontWeight: 700, color: "#fff", fontFamily: "inherit", fontSize: 14.5 }}>Done</button>
        </div>
      </div>
    </Overlay>
  );
}

function weightLabel(v) {
  if (v === 0) return "Ignore";
  if (v < 30) return "Minor";
  if (v < 55) return "Some";
  if (v < 80) return "Important";
  return "Top priority";
}

/* ---------------- Pieces ---------------- */
function Dots({ value, onChange }) {
  const v = value ?? 5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <input type="range" min="0" max="10" step="1" className="nf-slider" value={v}
        onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ width: 22, textAlign: "right", fontWeight: 700, fontSize: 14, color: INK }}>{v}</span>
    </div>
  );
}
function Field({ label, children, style }) {
  return (
    <div style={{ marginTop: 12, ...style }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = { width: "100%", fontSize: 15, border: `1px solid ${LINE}`, borderRadius: 10, padding: "11px 12px", color: INK, fontFamily: "inherit", outline: "none", background: SURF };
const ghostBtn = { display: "flex", alignItems: "center", gap: 7, background: SURF, border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 13px", fontWeight: 600, fontSize: 14, color: INK };
const iconBtn = { background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: 7, color: SLATE, cursor: "pointer" };
const modalStyle = { background: SURF, width: "100%", maxWidth: 470, maxHeight: "88vh", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(20,35,63,.32)" };
function ModalHead({ title, onClose }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 10px" }}>
      <h2 className="nf-display" style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{title}</h2>
      <button onClick={onClose} className="nf-btn" style={{ background: SURF, border: `1px solid ${LINE}`, borderRadius: 9, padding: 7, cursor: "pointer", color: SLATE }}><X size={17} /></button>
    </div>
  );
}
function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,35,63,.45)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", display: "grid", placeItems: "center" }}>{children}</div>
    </div>
  );
}
