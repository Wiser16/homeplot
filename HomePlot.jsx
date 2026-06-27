import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus, X, Crown, Trash2, Pencil, SlidersHorizontal,
  MapPin, RotateCcw, Sparkles, ChevronDown, ChevronUp, Wallet, Loader2,
  List, Table, Trophy, ExternalLink, Moon, Sun, Check, Users, Info, Activity, Droplets, CloudSun, Wind, ChevronLeft, ChevronRight, Download, Map as MapIcon, Star
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
  "--bg": "#0F1722", "--surface": "#212E40", "--text": "#ECEFF3",
  "--text-dim": "#9AA6B5", "--line": "#36465A", "--brand": "#33415A",
};

// Mirrors WEIGHTS_INIT from the original (×20 to fit 0–100 sliders),
// minus the Diversity dimension. Affordability and Commute are computed
// from numbers; the rest are quick 1–5 gut-checks.
const DIMENSIONS = [
  { key: "affordability", label: "Affordability", w: 40, auto: "price", blurb: "Price vs. your budget" },
  { key: "safety",        label: "Safety",         w: 40, blurb: "Crime / how safe it feels" },
  { key: "familySafety",  label: "Family safety",  w: 60, blurb: "Safe for kids day to day" },
  { key: "schools",       label: "Schools",        w: 60, blurb: "Quality of nearby schools" },
  { key: "schoolAccess",  label: "School access",  w: 80, blurb: "Ease of getting into a top school" },
  { key: "suburbGreen",   label: "Suburb & green", w: 100, blurb: "Green space, suburban feel" },
  { key: "retailDining",  label: "Retail & dining", w: 100, blurb: "Shops, restaurants, services" },
  { key: "lotYard",       label: "Lot & yard",     w: 100, blurb: "Home and lot size for the money" },
  { key: "culture",       label: "Culture & cool", w: 60, blurb: "Arts, vibe, character" },
  { key: "walk",          label: "Walkability",    w: 35, blurb: "Walk / bike / transit" },
  { key: "commute",       label: "Commute",        w: 20, auto: "miles", blurb: "Miles to your work" },
  { key: "earthquake",    label: "Quake safety",   w: 80, blurb: "Lower seismic risk" },
  { key: "fire",          label: "Fire safety",    w: 40, blurb: "Lower wildfire risk" },
  { key: "beach",         label: "Beach / coastal", w: 20, blurb: "Closeness to the coast" },
  { key: "weather",       label: "Weather",        w: 20, blurb: "Year-round comfort" },
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
// Family: schools, safety, and space matter most.
const FAMILY_WEIGHTS = {
  affordability: 60, commute: 40, schools: 100, schoolAccess: 100, safety: 100,
  familySafety: 100, suburbGreen: 80, retailDining: 40, lotYard: 80, walk: 20,
  beach: 20, earthquake: 60, fire: 60, weather: 40, culture: 20,
};
// Young professional: commute, walkability, dining, and price.
const YOUNGPRO_WEIGHTS = {
  affordability: 80, commute: 80, schools: 10, schoolAccess: 10, safety: 60,
  familySafety: 20, suburbGreen: 40, retailDining: 100, lotYard: 20, walk: 100,
  beach: 60, earthquake: 40, fire: 40, weather: 60, culture: 100,
};
// Retiree: safety, low-maintenance, weather, walkability, healthcare-adjacent calm.
const RETIREE_WEIGHTS = {
  affordability: 80, commute: 10, schools: 10, schoolAccess: 10, safety: 100,
  familySafety: 40, suburbGreen: 80, retailDining: 60, lotYard: 40, walk: 80,
  beach: 60, earthquake: 80, fire: 80, weather: 100, culture: 60,
};
const PERSONAS = [
  { key: "resident", label: "Balanced", blurb: "A bit of everything", weights: RESIDENT_WEIGHTS },
  { key: "family", label: "Family", blurb: "Schools & safety first", weights: FAMILY_WEIGHTS },
  { key: "youngpro", label: "Young professional", blurb: "Commute, walk, nightlife", weights: YOUNGPRO_WEIGHTS },
  { key: "retiree", label: "Retiree", blurb: "Calm, safe, walkable", weights: RETIREE_WEIGHTS },
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
  "woodland hills": { price: 1080000, own: 54, note: "Big lots, great retail, Rams HQ",    r: [8,8,8,8,10,10,10,7.5,6,6,4,8,8] },
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
  const [notes, setNotes] = useState(saved?.notes ?? {}); // { [placeId]: "visit notes" }
  const [favs, setFavs] = useState(saved?.favs ?? {}); // { [placeId]: true }
  const [removed, setRemoved] = useState(saved?.removed ?? []); // recently removed places, newest first
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showWeights, setShowWeights] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showMortgage, setShowMortgage] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const [view, setView] = useState("ranked");
  const [exportMsg, setExportMsg] = useState(""); // "" | "Saved" | "Shared" | "Couldn't save"
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
  const [rateInfo, setRateInfo] = useState(null); // { rate30, rate15, asOf, source }
  const rate = useMemo(() => +(baseRate + creditDelta(credit)).toFixed(3), [baseRate, credit]);

  // Pull the current 30-year average from Freddie Mac (via our backend) once on
  // load, and use it as the base rate unless the person has set their own.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/rate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || !d.rate30) return;
        setRateInfo(d);
        // Only override when the user hasn't customized the base rate themselves.
        if (saved?.baseRate == null) setBaseRate(d.rate30);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Save durable user data whenever it changes (no-op where storage is blocked).
  useEffect(() => {
    saveSaved({ hoods, notes, favs, removed, budget, workZip, workCoords, weights, persona, dp, credit, baseRate, term, forced });
  }, [hoods, notes, favs, removed, budget, workZip, workCoords, weights, persona, dp, credit, baseRate, term, forced]);

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
      // Prefer a typed-in distance; otherwise measure from the work ZIP to the
      // place's own coordinates (works for any town, not just built-in ones),
      // falling back to the built-in table only if needed.
      const placeCoords = h.coords || TOWN_COORDS[NORM(h.town)] || null;
      const autoMi = workCoords && placeCoords ? Math.round(haversineMi(workCoords, placeCoords) * ROAD_FACTOR) : autoMiles(workCoords, h.town);
      const effMiles = manualMi != null ? manualMi : autoMi;
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
      return { id: i + 1, town: p.town, state: "CA", name: `${p.town}, CA`, price: e.price, miles: p.miles, note: e.note, ratings: mkRatings(e.r), source: "table", coords: TOWN_COORDS[p.town.toLowerCase()] || null };
    }));
  };

  const resetWeights = () => { setPersona("resident"); setWeights({ ...RESIDENT_WEIGHTS }); };
  const applyPreset = (p) => { setPersona(p.key); setWeights({ ...p.weights }); };
  // Bring a removed place back, with a fresh id so it doesn't collide.
  const restorePlace = (place) => {
    setHoods((p) => [...p, { ...place, id: Date.now() }]);
    setRemoved((r) => r.filter((x) => x.id !== place.id));
  };

  // Clear the whole saved session and return to a clean slate. Confirms first so
  // it can't wipe someone's work by accident.
  const resetAll = () => {
    if (typeof window !== "undefined" && window.confirm && !window.confirm("Clear all your places and settings and start fresh? This can't be undone.")) return;
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
    setHoods([]);
    setNotes({});
    setFavs({});
    setRemoved([]);
    setBudget("1000000");
    setWorkZip(""); setWorkCoords(null);
    setWeights({ ...RESIDENT_WEIGHTS }); setPersona("resident");
    setDp(20); setCredit("760");
    setBaseRate(rateInfo?.rate30 ?? DEFAULT_BASE_RATE); setTerm(30);
    setView("ranked"); setExpanded(null);
  };

  // Build a clean, printable one-page summary of the ranking and verdict, then
  // open the browser's print dialog, which offers "Save as PDF" on every device.
  // Far more useful and shareable than a raw data file for a home buyer.
  const exportSession = () => {
    const flash = (msg) => { setExportMsg(msg); setTimeout(() => setExportMsg(""), 2200); };
    if (!scored.length) return;

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const top = [...DIMENSIONS].sort((a, b2) => (weights[b2.key] || 0) - (weights[a.key] || 0)).filter((d) => (weights[d.key] || 0) > 0).slice(0, 4).map((d) => d.label);

    const rows = scored.map((h, i) => {
      const monthly = h.monthly ? fmtMoney(h.monthly) : "—";
      const factors = DIMENSIONS.map((d) => `<td style="text-align:center;padding:6px 8px;border-bottom:1px solid #eee">${Math.round(h.dimScores[d.key])}</td>`).join("");
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-weight:700">${i + 1}. ${esc(h.name)}${i === 0 ? ' <span style="color:#C98A14">★ Best</span>' : ""}</td>
        <td style="text-align:center;padding:6px 8px;border-bottom:1px solid #eee;font-weight:700">${h.score}</td>
        <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #eee">${fmtMoney(Number(h.price))}</td>
        <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #eee">${monthly}</td>
        ${factors}
      </tr>`;
    }).join("");

    const factorHead = DIMENSIONS.map((d) => `<th style="font-size:9px;font-weight:600;color:#667;padding:6px 4px;border-bottom:2px solid #16263F;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap">${esc(d.label)}</th>`).join("");

    const lead = scored[0];
    const leadName = lead.town || lead.name;
    const verdict = scored.length >= 2
      ? `<strong>${esc(leadName)}</strong> is the best match, scoring ${lead.score}, against your priorities: ${esc(top.join(", "))}.`
      : `${esc(leadName)} scored ${lead.score} against your priorities: ${esc(top.join(", "))}.`;

    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>HomePlot Comparison</title>
      <style>
        @page { margin: 14mm; }
        body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #16263F; margin: 0; padding: 16px; }
        h1 { font-size: 22px; margin: 0 0 2px; }
        .sub { color: #5b6b7d; font-size: 12px; margin-bottom: 14px; }
        .verdict { background: #f7f3e8; border-left: 4px solid #F2B441; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; }
        th { text-align: center; }
        .foot { margin-top: 18px; font-size: 10px; color: #889; }
        .bar { position: sticky; top: 0; display: flex; gap: 10px; justify-content: space-between; align-items: center; background: #16263F; color: #fff; padding: 10px 14px; margin: -16px -16px 16px; }
        .bar button { font: inherit; font-size: 14px; font-weight: 700; border: none; border-radius: 8px; padding: 9px 16px; cursor: pointer; }
        .bar .print { background: #1FA98F; color: #fff; }
        .bar .back { background: rgba(255,255,255,.15); color: #fff; }
        @media print { .bar { display: none; } body { padding: 0; } }
      </style></head><body>
      <div class="bar">
        <button class="back" onclick="window.close(); history.length>1 && history.back();">&larr; Back to HomePlot</button>
        <button class="print" onclick="window.print()">Save / Print PDF</button>
      </div>
      <h1>HomePlot — Neighborhood Comparison</h1>
      <div class="sub">Your priorities, ranked. Generated ${dateStr} · budget ${fmtMoney(Number(budget) || 0)}</div>
      <div class="verdict">${verdict}</div>
      <table>
        <thead><tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #16263F">Neighborhood</th>
          <th style="padding:6px 8px;border-bottom:2px solid #16263F">Match</th>
          <th style="padding:6px 8px;border-bottom:2px solid #16263F">Price</th>
          <th style="padding:6px 8px;border-bottom:2px solid #16263F">Est./mo</th>
          ${factorHead}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="foot">Scores marked on screen with an asterisk are estimates; the rest reflect your own inputs or official public data (U.S. Census, FEMA, USGS, NOAA). HomePlot · homeplotapp.com</div>
      </body></html>`;

    try {
      const w = window.open("", "_blank");
      if (!w) { flash("Allow pop-ups"); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      flash("Opened PDF");
    } catch {
      flash("Couldn't open");
    }
  };

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
        .nf-btn:active { transform: translateY(0) scale(.98); }
        .nf-card { transition: transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s ease, border-color .2s ease; }
        .nf-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(22,38,63,.10); }
        .nf-ring { transition: stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1); }
        @keyframes nfpop { from { transform: scale(.96); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes nfrise { from { transform: translateY(10px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes nfreveal { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes nfspin { to { transform: rotate(360deg) } }
        .nf-pop { animation: nfpop .25s ease; }
        .nf-rise { animation: nfrise .4s cubic-bezier(.2,.8,.2,1) both; }
        .nf-reveal { animation: nfreveal .3s ease both; }
        .nf-spin { animation: nfspin .9s linear infinite; }
        .nf-cards { display: grid; grid-template-columns: 1fr; gap: 14px; align-items: stretch; }
        /* Use the extra width on landscape phones, tablets, and laptops. */
        @media (min-width: 760px) { .nf-cards { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1100px) { .nf-cards { grid-template-columns: 1fr 1fr 1fr; } }
        @media (prefers-reduced-motion: reduce) { .nf-ring,.nf-card,.nf-btn{transition:none!important} .nf-pop,.nf-spin,.nf-rise,.nf-reveal{animation:none!important} }
        .nf-map-score { background: transparent !important; border: none !important; box-shadow: none !important; color: #fff !important; font-weight: 800 !important; font-size: 11px !important; }
        .nf-map-score::before { display: none !important; }
        .nf-work-marker { background: none; border: none; }
        .nf-work-wrap { display: flex; flex-direction: column; align-items: center; }
        .nf-work-pin { display: flex; align-items: center; justify-content: center; background: #16263F; color: #fff; font-size: 11px; font-weight: 800; letter-spacing: .04em; border: 2px solid #fff; border-radius: 7px; width: 54px; height: 24px; box-shadow: 0 2px 6px rgba(0,0,0,.35); }
        .nf-work-tip { width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid #16263F; margin-top: -1px; filter: drop-shadow(0 2px 1px rgba(0,0,0,.3)); }
        .leaflet-container { font-family: inherit; }
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
            {(hoods.length > 0 || workZip || budget !== "1000000") && (
              <span aria-hidden="true" style={{ width: 1, alignSelf: "stretch", background: LINE, margin: "2px 2px" }} />
            )}
            {hoods.length > 0 && (
              <button className="nf-btn" onClick={exportSession} style={{ ...ghostBtn, ...(exportMsg ? { color: TEAL, borderColor: TEAL } : {}) }} title="Save or email a clean PDF of your comparison">
                {exportMsg ? <><Check size={16} strokeWidth={3} /> {exportMsg}</> : <><Download size={16} /> Save PDF</>}
              </button>
            )}
            {(hoods.length > 0 || workZip || budget !== "1000000") && (
              <button className="nf-btn" onClick={resetAll} style={ghostBtn} title="Clear everything and start fresh">
                <RotateCcw size={16} /> Reset
              </button>
            )}
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
            <h2 className="nf-display" style={{ fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>Plot Your Perfect Neighborhood</h2>
            <p className="nf-display" style={{ fontSize: 15, fontWeight: 700, color: TEAL, margin: "0 0 10px", letterSpacing: .2 }}>Your places. Your priorities. Side by side.</p>
            <p style={{ color: INK, maxWidth: 460, margin: "0 auto 10px", fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
              Score and rank the towns you're weighing by what matters to <i>you</i>.
            </p>
            <p style={{ color: SLATE, maxWidth: 460, margin: "0 auto 18px", fontSize: 14, lineHeight: 1.55 }}>
              Backed by real data from the Census, USGS, FEMA, and more. Add a place to start, or let AI fill it in.
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
              <button className="nf-btn" onClick={loadSample}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: CORAL, border: "none", borderRadius: 11, padding: "12px 20px", fontWeight: 700, color: "#fff", fontSize: 15, boxShadow: "0 2px 0 #d8463b" }}>
                <Sparkles size={17} /> See a live example
              </button>
              <button className="nf-btn" onClick={() => { setEditing(null); setShowAdd(true); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: SURF, border: `1px solid ${LINE}`, borderRadius: 11, padding: "12px 18px", fontWeight: 600, color: INK, fontSize: 15 }}>
                <Plus size={16} /> Add your own place
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 12 }}>New here? Tap <b style={{ color: INK }}>See a live example</b> to load four LA towns, ranked, then change your priorities and watch them move.</div>
          </div>
        ) : (
          <>
            {scored.length >= 1 && (() => {
              const top = [...DIMENSIONS].sort((a, b2) => (weights[b2.key] || 0) - (weights[a.key] || 0)).filter((d) => (weights[d.key] || 0) > 0).slice(0, 4);
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 14, padding: "10px 14px", background: SURF, border: `1px solid ${LINE}`, borderRadius: 12 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: SLATE, letterSpacing: .3 }}>YOUR PRIORITIES</span>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {top.map((d) => (
                      <span key={d.key} style={{ fontSize: 12.5, fontWeight: 600, color: INK, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 99, padding: "3px 10px" }}>{d.label}</span>
                    ))}
                  </span>
                  <button onClick={() => setShowWeights(true)} className="nf-btn" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: TEAL, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                    <SlidersHorizontal size={13} /> Edit
                  </button>
                </div>
              );
            })()}
            {scored.length >= 2 && <Verdict scored={scored} />}
            {scored.length >= 2 && (
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div style={{ display: "inline-flex", background: SURF, border: `1px solid ${LINE}`, borderRadius: 11, padding: 3, gap: 3 }}>
                  {[["ranked", "Ranked", List], ["compare", "Compare", Table], ["map", "Map", MapIcon]].map(([key, label, Icon]) => (
                    <button key={key} onClick={() => setView(key)} className="nf-btn"
                      style={{ display: "flex", alignItems: "center", gap: 6, border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 13.5, fontFamily: "inherit", cursor: "pointer", background: view === key ? TEAL : "transparent", color: view === key ? "#fff" : SLATE }}>
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {view === "compare" && scored.length >= 2 ? (
              <CompareView scored={scored} />
            ) : view === "map" && scored.length >= 2 ? (
              <MapView scored={scored} workCoords={workCoords} dark={dark} />
            ) : (
              <div className="nf-cards">
                {scored.map((h, i) => (
                  <div key={h.id} className="nf-rise" style={{ animationDelay: `${Math.min(i * 60, 480)}ms`, height: "100%" }}>
                    <HoodCard h={h} rank={i} topPlace={scored[0]} dp={dp} rate={rate} term={term}
                      note={notes[h.id] || ""}
                      onNote={(text) => setNotes((n) => ({ ...n, [h.id]: text }))}
                      fav={!!favs[h.id]}
                      onFav={() => setFavs((f) => ({ ...f, [h.id]: !f[h.id] }))}
                      expanded={expanded === h.id}
                      onToggle={() => setExpanded(expanded === h.id ? null : h.id)}
                      onEdit={() => { setEditing(h); setShowAdd(true); }}
                      onDelete={() => {
                        setHoods((p) => p.filter((x) => x.id !== h.id));
                        setRemoved((r) => [h, ...r.filter((x) => x.id !== h.id)].slice(0, 8));
                      }} />
                  </div>
                ))}
              </div>
            )}
            {scored.some((h) => h.source === "ai" || h.source === "table") && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 14, fontSize: 12, color: SLATE, lineHeight: 1.5 }}>
                <span style={{ color: GOLD, fontWeight: 800 }}>*</span>
                <span>Scores marked with an asterisk are estimates, filled by a lookup, not confirmed against official records. Open Edit on any place to set your own numbers and the asterisk clears. The "Local data" section under each breakdown is real and cited: USGS earthquakes, FEMA flood, NOAA weather, and Census figures come straight from those official sources.</span>
              </div>
            )}
            {removed.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: .4, color: SLATE, opacity: .8, marginBottom: 8 }}>RECENTLY REMOVED · TAP TO RESTORE</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {removed.map((p) => (
                    <button key={p.id} onClick={() => restorePlace(p)} className="nf-btn"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: SURF, border: `1px solid ${LINE}`, borderRadius: 99, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, color: INK, cursor: "pointer", fontFamily: "inherit" }}>
                      <Plus size={13} color={TEAL} /> {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer style={{ textAlign: "center", padding: "10px 20px 36px", fontSize: 12, color: SLATE }}>
        <div style={{ marginBottom: 6, display: "flex", gap: 16, justifyContent: "center" }}>
          <button onClick={() => setShowMethod(true)} className="nf-btn" style={{ background: "none", border: "none", color: TEAL, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>How scoring works</button>
          <button onClick={() => setShowFeedback(true)} className="nf-btn" style={{ background: "none", border: "none", color: TEAL, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Send feedback</button>
        </div>
        <div style={{ marginBottom: 4 }}>Real data from official public sources: U.S. Census, FEMA, USGS, and NOAA. Mortgage base rate live from Freddie Mac.</div>
        HomePlot · Plot your perfect neighborhood
      </footer>

      {celebrate && <Confetti />}
      {showAdd && <AddModal initial={editing} budget={budget}
        onClose={() => { setShowAdd(false); setEditing(null); }} onSave={upsert} />}
      {showWeights && <WeightsModal weights={weights} setWeights={setWeights} persona={persona} applyPreset={applyPreset} onReset={resetWeights} onClose={() => setShowWeights(false)} />}
      {showMethod && <MethodModal onClose={() => setShowMethod(false)} />}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
      {showMortgage && <MortgageModal dp={dp} setDp={setDp} credit={credit} setCredit={setCredit} baseRate={baseRate} setBaseRate={setBaseRate} term={term} setTerm={setTerm} rate={rate} budget={budget} rateInfo={rateInfo} onClose={() => setShowMortgage(false)} />}
    </div>
  );
}

/* ---------------- Card ---------------- */
function HoodCard({ h, rank, topPlace, dp, rate, term, note, onNote, fav, onFav, expanded, onToggle, onEdit, onDelete }) {
  const leader = rank === 0;
  const ringColor = h.score >= 75 ? TEAL : h.score >= 50 ? GOLD : CORAL;
  const tenure = tenureFor(h.town || h.name);
  const coords = h.coords || TOWN_COORDS[NORM(h.town || h.name)] || null;
  const [quake, setQuake] = useState(null);
  const [flood, setFlood] = useState(null);
  const [weather, setWeather] = useState(null);
  const [census, setCensus] = useState(null);
  const [air, setAir] = useState(null);

  // Pull real, official, display-only data near this place (never scored). Each
  // fails silently and independently, so the card never depends on any of them.
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    const q = `lat=${coords[0]}&lng=${coords[1]}`;
    const grab = (path, set, ok = (d) => d && d.available) =>
      fetch(`${path}?${q}`).then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled && ok(d)) set(d); }).catch(() => {});
    grab("/api/quake", setQuake);
    grab("/api/flood", setFlood);
    grab("/api/weather", setWeather);
    grab("/api/census", setCensus);
    grab("/api/air", setAir);
    return () => { cancelled = true; };
  }, [coords && coords[0], coords && coords[1]]);

  const R = 30, C = 2 * Math.PI * R, off = C * (1 - h.score / 100);

  // When real Census property-tax data arrives, recompute the monthly payment
  // with the town's actual effective tax rate instead of the flat estimate.
  const realTaxRate = census && census.taxRate != null ? census.taxRate : null;
  const monthlyReal = realTaxRate != null && dp != null && rate != null && term != null
    ? calcMonthly(Number(h.price), dp, rate, term, realTaxRate)
    : null;
  const shownMonthly = monthlyReal != null ? monthlyReal : h.monthly;
  return (
    <div className="nf-card" style={{
      background: SURF, border: leader ? `2px solid ${GOLD}` : `1px solid ${LINE}`,
      borderRadius: 16, padding: 16,
      boxShadow: leader ? "0 8px 24px rgba(242,180,65,.22)" : "0 1px 2px rgba(0,0,0,.03)",
      display: "flex", flexDirection: "column", height: "100%",
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
            {shownMonthly > 0 && <span>≈ {fmtMoney(shownMonthly)}/mo{monthlyReal != null && <span style={{ opacity: .7 }} title={`Includes ${realTaxRate}% real property tax from Census`}> · real tax</span>}</span>}
            {h.strengths.length > 0 && <span>Strong on {h.strengths.map((s) => s.label.toLowerCase()).join(" and ")}</span>}
          </div>
          {h.note && <div style={{ fontSize: 13, color: SLATE, marginTop: 4, fontStyle: "italic" }}>"{h.note}"</div>}
          {h.effMiles != null && (
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={13} />
              <span><b style={{ color: INK }}>{h.effMiles} mi</b> to work{h.commuteAuto ? <span style={{ opacity: .7 }}> · straight-line est.<span title="Estimated, not verified" style={{ color: GOLD, fontWeight: 800 }}>*</span></span> : <span style={{ opacity: .7 }}> · you entered this</span>}</span>
            </div>
          )}
          {expanded && (census || tenure || quake || flood || weather || air) && (
            <div className="nf-reveal" style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${LINE}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .5, color: SLATE, opacity: .7, marginBottom: 2 }}>LOCAL DATA · OFFICIAL SOURCES</div>
          {(census || tenure) && (
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Users size={13} />
              {census ? (
                <>
                  {census.ownerPct != null && <span><b style={{ color: INK }}>{census.ownerPct}%</b> owner · <b style={{ color: INK }}>{census.renterPct}%</b> renter</span>}
                  {census.medianIncome != null && <span>· median income <b style={{ color: INK }}>${census.medianIncome.toLocaleString()}</b></span>}
                  {census.medianAge != null && <span>· median age <b style={{ color: INK }}>{census.medianAge}</b></span>}
                  {census.taxRate != null && <span>· property tax <b style={{ color: INK }}>{census.taxRate}%</b></span>}
                  <span style={{ opacity: .7 }}>· {census.source}</span>
                </>
              ) : (
                <>
                  <span><b style={{ color: INK }}>{tenure.owner}%</b> owner · <b style={{ color: INK }}>{tenure.renter}%</b> renter</span>
                  <span style={{ opacity: .7 }}>· Census ACS<span title="Estimated, not verified" style={{ color: GOLD, fontWeight: 800 }}>*</span></span>
                </>
              )}
            </div>
          )}
          {quake && quake.count > 0 && (
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Activity size={13} />
              <span><b style={{ color: INK }}>{quake.count}</b> quakes M{quake.minMag}+ within {quake.radiusKm}km{quake.maxMag ? <>, largest <b style={{ color: INK }}>M{quake.maxMag}</b></> : null}</span>
              <span style={{ opacity: .7 }}>· USGS, {quake.years}yr history</span>
            </div>
          )}
          {quake && quake.count === 0 && (
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Activity size={13} />
              <span>No significant quakes within {quake.radiusKm}km</span>
              <span style={{ opacity: .7 }}>· USGS, {quake.years}yr history</span>
            </div>
          )}
          {flood && (
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Droplets size={13} color={flood.highRisk ? CORAL : undefined} />
              <span style={{ color: flood.highRisk ? CORAL : SLATE }}>{flood.label}</span>
              <span style={{ opacity: .7 }}>· {flood.source}</span>
            </div>
          )}
          {weather && weather.high != null && (
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <CloudSun size={13} />
              <span>{weather.label}: <b style={{ color: INK }}>{weather.high}°{weather.unit}</b>{weather.low != null ? ` / ${weather.low}°` : ""}{weather.summary ? `, ${weather.summary}` : ""}</span>
              <span style={{ opacity: .7 }}>· {weather.source} forecast</span>
            </div>
          )}
          {air && air.aqi != null && (
            <div style={{ fontSize: 12.5, color: SLATE, marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Wind size={13} />
              <span>Air quality <b style={{ color: INK }}>{air.aqi}</b>{air.category ? ` (${air.category})` : ""}</span>
              <span style={{ opacity: .7 }}>· {air.source}</span>
            </div>
          )}
            </div>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
            <a className="nf-link" target="_blank" rel="noopener noreferrer"
              href={`https://www.zillow.com/homes/${encodeURIComponent(((h.town && h.state) ? `${h.town} ${h.state}` : h.name).trim().replace(/\s+/g, "-"))}_rb/`}>
              View listings <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="nf-btn" onClick={onFav} title={fav ? "Remove favorite" : "Mark as favorite"} style={{ ...iconBtn, color: fav ? GOLD : SLATE }}><Star size={15} fill={fav ? GOLD : "none"} /></button>
          <button className="nf-btn" onClick={onEdit} title="Edit" style={iconBtn}><Pencil size={15} /></button>
          <button className="nf-btn" onClick={onDelete} title="Remove" style={iconBtn}><Trash2 size={15} /></button>
        </div>
      </div>
      <button onClick={onToggle} style={{ marginTop: "auto", paddingTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "none", color: SLATE, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        {expanded ? "Hide breakdown" : "See breakdown"} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {expanded && (
        <div className="nf-reveal" style={{ marginTop: 10, paddingTop: 12, borderTop: `1px solid ${LINE}`, display: "grid", gap: 9 }}>
          {topPlace && topPlace.id !== h.id && (() => {
            // Why this place didn't win: the factors where it most gains and most
            // loses against the leader, weighted by nothing fancy, just the raw
            // per-factor gap so it's honest and easy to read.
            const diffs = DIMENSIONS.map((d) => ({ label: d.label, delta: Math.round(h.dimScores[d.key] - topPlace.dimScores[d.key]) }));
            const gains = diffs.filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 2);
            const losses = diffs.filter((x) => x.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 2);
            const lname = topPlace.town || topPlace.name;
            if (!gains.length && !losses.length) return null;
            return (
              <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 11px", marginBottom: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .4, color: SLATE, opacity: .8, marginBottom: 5 }}>VS {lname.toUpperCase()} (THE LEADER)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {gains.map((g) => (
                    <span key={g.label} style={{ fontSize: 12, fontWeight: 700, color: TEAL, background: "rgba(31,169,143,.12)", borderRadius: 99, padding: "2px 9px" }}>+{g.delta} {g.label}</span>
                  ))}
                  {losses.map((l) => (
                    <span key={l.label} style={{ fontSize: 12, fontWeight: 700, color: CORAL, background: "rgba(255,90,77,.12)", borderRadius: 99, padding: "2px 9px" }}>{l.delta} {l.label}</span>
                  ))}
                </div>
              </div>
            );
          })()}
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
          <div style={{ marginTop: 4, paddingTop: 10, borderTop: `1px dashed ${LINE}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: .5, color: SLATE, opacity: .7 }}>YOUR VISIT NOTES</div>
              <div style={{ fontSize: 10.5, color: SLATE, opacity: .6, display: "flex", alignItems: "center", gap: 4 }}>
                <Check size={11} /> Saved on this device
              </div>
            </div>
            <textarea
              value={note}
              onChange={(e) => onNote(e.target.value)}
              placeholder={`What did you notice about ${h.town || h.name}? Traffic, noise, the feel of the streets, anything you want to remember.`}
              rows={3}
              style={{ width: "100%", boxSizing: "border-box", background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, color: INK, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Map view (places as pins) ---------------- */
// Loads Leaflet once from a CDN (free OpenStreetMap tiles, no API key) and
// plots each place as a score-colored pin. Places without coordinates are
// listed below the map so nothing silently disappears.
function MapView({ scored, workCoords, dark }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(typeof window !== "undefined" && window.L);

  const withCoords = scored.map((h) => ({ h, c: h.coords || TOWN_COORDS[NORM(h.town || h.name)] || null })).filter((x) => x.c);
  const without = scored.filter((h) => !(h.coords || TOWN_COORDS[NORM(h.town || h.name)]));

  // Load Leaflet's CSS + JS from the CDN a single time.
  useEffect(() => {
    if (window.L) { setReady(true); return; }
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    if (!document.getElementById("leaflet-js")) {
      const s = document.createElement("script");
      s.id = "leaflet-js";
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = () => setReady(true);
      document.body.appendChild(s);
    } else {
      document.getElementById("leaflet-js").addEventListener("load", () => setReady(true));
    }
  }, []);

  // Build / rebuild the map when ready or when the places change.
  useEffect(() => {
    if (!ready || !window.L || !elRef.current) return;
    const L = window.L;
    if (!mapRef.current) {
      mapRef.current = L.map(elRef.current, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);
    }
    const map = mapRef.current;
    // Clear old markers.
    map.eachLayer((layer) => { if (layer instanceof L.Marker || layer instanceof L.CircleMarker) map.removeLayer(layer); });

    const pts = [];
    withCoords.forEach(({ h, c }, i) => {
      const color = h.score >= 75 ? "#1FA98F" : h.score >= 50 ? "#F2B441" : "#FF5A4D";
      const marker = L.circleMarker([c[0], c[1]], {
        radius: i === 0 ? 13 : 10,
        fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.95,
      }).addTo(map);
      marker.bindPopup(`<b>${h.name}</b><br>Match score ${h.score}${i === 0 ? " · Best" : ""}<br>${fmtMoney(h.price)}`);
      marker.bindTooltip(String(h.score), { permanent: true, direction: "center", className: "nf-map-score" });
      pts.push([c[0], c[1]]);
    });

    if (workCoords) {
      const icon = L.divIcon({
        className: "nf-work-marker",
        html: '<div class="nf-work-wrap"><div class="nf-work-pin"><span>Work</span></div><div class="nf-work-tip"></div></div>',
        iconSize: [54, 40],
        iconAnchor: [27, 40], // anchor at the tip so it points to the exact spot
        popupAnchor: [0, -40],
      });
      const w = L.marker([workCoords[0], workCoords[1]], { icon, zIndexOffset: 1000 }).addTo(map);
      w.bindPopup("<b>Your work</b>");
      pts.push([workCoords[0], workCoords[1]]);
    }

    if (pts.length === 1) map.setView(pts[0], 11);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] });
    setTimeout(() => map.invalidateSize(), 100); // settle after layout
  }, [ready, scored, workCoords]);

  return (
    <div className="nf-pop" style={{ background: SURF, border: `1px solid ${LINE}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: "8px 14px", fontSize: 12, color: SLATE, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 6 }}>
        <Info size={13} /> Your places, mapped. Pin color shows match score; the dark "Work" marker is your job. Tap any pin for details.
      </div>
      <div ref={elRef} style={{ height: "60vh", width: "100%", background: dark ? "#0F1722" : "#e8eef2" }} />
      {!ready && <div style={{ padding: 16, fontSize: 13, color: SLATE }}>Loading map…</div>}
      {without.length > 0 && (
        <div style={{ padding: "10px 14px", fontSize: 12.5, color: SLATE, borderTop: `1px solid ${LINE}` }}>
          Not mapped (no location found yet): {without.map((h) => h.name).join(", ")}. Re-add with AI fill to place them.
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
  // Confidence reflects how clear the win is: a wide gap over the runner-up is a
  // confident call; a narrow one is genuinely a close call, and saying so is more
  // honest than implying certainty.
  const scoreGap = leader.score - runner.score;
  const confidence = scoreGap >= 8 ? { label: "Clear winner", color: TEAL } : scoreGap >= 4 ? { label: "Moderate edge", color: GOLD } : { label: `Close call · ${scoreGap}-pt gap`, color: CORAL };

  // Structured highlights, computed honestly from the scores.
  // Why #1: the factors where the leader most leads the field.
  const whyWon = top.slice(0, 2).join(" and ");
  // Biggest trade-off: the leader's weakest factor relative to the field max.
  const tradeoff = DIMENSIONS
    .map((d) => ({ label: d.label, behind: fieldMax[d.key] - leader.dimScores[d.key] }))
    .sort((a, b) => b.behind - a.behind)[0];
  const tradeoffText = tradeoff && tradeoff.behind >= 10
    ? `Weakest on ${tradeoff.label.toLowerCase()}, where another place leads`
    : "No major weak spot against the field";
  // Savings vs runner-up (only when the leader is actually cheaper).
  const savings = (pL && pR && pR < pL) ? null : (pL && pR && pL < pR) ? fmtMoney(pR - pL) : null;
  const savingsText = savings
    ? `About ${savings} less than ${runnerName}`
    : (pL && pR && pR < pL) ? `${runnerName} is cheaper by ${fmtMoney(pL - pR)}` : "Similar price to the runner-up";

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
        <div style={{ marginTop: 10, display: "grid", gap: 5 }}>
          <div style={{ fontSize: 13, color: INK, display: "flex", gap: 7, alignItems: "baseline" }}>
            <Check size={13} color={TEAL} strokeWidth={3} style={{ flexShrink: 0, transform: "translateY(1px)" }} />
            <span><b>Why it ranked #1:</b> {whyWon}.</span>
          </div>
          <div style={{ fontSize: 13, color: INK, display: "flex", gap: 7, alignItems: "baseline" }}>
            <Info size={13} color={GOLD} style={{ flexShrink: 0, transform: "translateY(1px)" }} />
            <span><b>Biggest trade-off:</b> {tradeoffText}.</span>
          </div>
          <div style={{ fontSize: 13, color: INK, display: "flex", gap: 7, alignItems: "baseline" }}>
            <Wallet size={13} color={SLATE} style={{ flexShrink: 0, transform: "translateY(1px)" }} />
            <span><b>Cost vs runner-up:</b> {savingsText}.</span>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: confidence.color, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 99, padding: "3px 10px" }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: confidence.color }} /> {confidence.label}
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
  const rowLabel = { position: "sticky", left: 0, zIndex: 2, background: SURF, textAlign: "left", padding: "10px 14px", fontSize: 13, color: SLATE, fontWeight: 600, whiteSpace: "nowrap", borderRight: `1px solid ${LINE}` };
  const cell = { padding: "10px", textAlign: "center", borderLeft: `1px solid ${LINE}`, borderTop: `1px solid ${LINE}`, minWidth: 124 };
  const best = { background: "rgba(31,169,143,.14)" };
  const Tick = () => <Check size={12} color={TEAL} strokeWidth={3} style={{ verticalAlign: "middle", marginLeft: 4 }} />;
  const many = scored.length > 4;
  const scrollRef = useRef(null);
  const nudge = (dir) => { const el = scrollRef.current; if (el) el.scrollBy({ left: dir * Math.max(220, el.clientWidth * 0.6), behavior: "smooth" }); };
  const [diffOnly, setDiffOnly] = useState(false);

  return (
    <div className="nf-pop" style={{ background: SURF, border: `1px solid ${LINE}`, borderRadius: 16, overflow: "hidden", position: "relative" }}>
      <div style={{ padding: "12px 14px 10px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div className="nf-display" style={{ fontSize: 16, fontWeight: 800 }}>Compare Places Side by Side</div>
          <div style={{ fontSize: 12, color: SLATE, marginTop: 1 }}>Every place, every factor, lined up. <Check size={11} color={TEAL} strokeWidth={3} style={{ verticalAlign: "middle" }} /> marks the best in each row.</div>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: SLATE, fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} style={{ accentColor: TEAL, width: 15, height: 15 }} />
          Differences only
        </label>
      </div>
      {many && (
        <div style={{ padding: "8px 14px", fontSize: 12, color: SLATE, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Info size={13} /> Showing all {scored.length} places. Names and labels stay pinned as you scroll.</span>
          <span style={{ display: "flex", gap: 6 }}>
            <button onClick={() => nudge(-1)} className="nf-btn" aria-label="Scroll left" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: SURF, color: INK, cursor: "pointer" }}><ChevronLeft size={16} /></button>
            <button onClick={() => nudge(1)} className="nf-btn" aria-label="Scroll right" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: SURF, color: INK, cursor: "pointer" }}><ChevronRight size={16} /></button>
          </span>
        </div>
      )}
      <div ref={scrollRef} style={{ overflow: "auto", maxHeight: "72vh", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...rowLabel, top: 0, zIndex: 4, verticalAlign: "bottom", borderBottom: `1px solid ${LINE}` }}>Neighborhood</th>
              {scored.map((h, i) => (
                <th key={h.id} style={{ ...cell, position: "sticky", top: 0, zIndex: 3, verticalAlign: "bottom", borderTop: "none", borderBottom: `1px solid ${LINE}`, background: i === 0 ? "#fbf4e3" : SURF }}>
                  {i === 0 && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 3, background: GOLD, color: ONGOLD, fontSize: 12, fontWeight: 800, padding: "3px 9px", borderRadius: 99, marginBottom: 6 }}>
                      <Crown size={12} /> Best
                    </div>
                  )}
                  <div className="nf-display" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.15, color: i === 0 ? "#16263F" : "inherit" }}>{h.name}{(h.source === "ai" || h.source === "table") && <span title="Estimated, not verified" style={{ color: i === 0 ? "#b8860b" : GOLD, fontWeight: 800 }}>*</span>}</div>
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
            {DIMENSIONS.filter((d) => {
              if (!diffOnly) return true;
              // Hide rows where every place has the same rounded value.
              const vals = scored.map((h) => Math.round(h.dimScores[d.key]));
              return new Set(vals).size > 1;
            }).map((d) => (
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
  const [coords, setCoords] = useState(initial?.coords || TOWN_COORDS[NORM(initial?.town || "")] || null);
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
      setCoords(TOWN_COORDS[NORM(town)] || null);
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
      if (parsed.lat != null && parsed.lng != null) setCoords([Number(parsed.lat), Number(parsed.lng)]);
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
            onClick={() => onSave({ id: initial?.id, town: town.trim(), state: stateCode, name: `${town.trim()}, ${stateCode}`, price: Number(price) || 0, miles: miles === "" ? null : Number(miles), note: note.trim(), ratings, source, coords: coords || TOWN_COORDS[NORM(town)] || null })}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {PERSONAS.map((p) => {
              const active = persona === p.key;
              return (
                <button key={p.key} onClick={() => applyPreset(p)} className="nf-btn"
                  style={{ textAlign: "left", border: `1px solid ${active ? BRAND : LINE}`, background: active ? BRAND : SURF, color: active ? "#fff" : INK, borderRadius: 11, padding: "10px 12px", cursor: "pointer", fontFamily: "inherit" }}>
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
function MortgageModal({ dp, setDp, credit, setCredit, baseRate, setBaseRate, term, setTerm, rate, budget, rateInfo, onClose }) {
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
          <p style={{ fontSize: 13, color: SLATE, marginTop: 0 }}>Estimates a monthly payment from your credit, down payment, and term. Property tax starts at a 1.25% estimate, and switches to each town's real effective rate from the Census when that data is available. Under 20% down adds PMI.</p>
          {rateInfo && rateInfo.source === "freddiemac-pmms" && (
            <p style={{ fontSize: 12.5, color: TEAL, fontWeight: 600, marginTop: 0 }}>
              Base rate is live from Freddie Mac: {rateInfo.rate30}% for a 30-year fixed{rateInfo.asOf ? ` (as of ${rateInfo.asOf})` : ""}. Your credit tier adjusts from there.
            </p>
          )}
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
/* ---------------- Feedback (copy to clipboard, no email exposed) ---------------- */
function FeedbackModal({ onClose }) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const body = `HomePlot feedback:\n\n${text.trim()}\n\n(Sent from homeplotapp.com)`;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback: select the textarea so the user can copy manually.
      const el = document.getElementById("fb-text");
      if (el) { el.focus(); el.select(); }
    }
  };
  return (
    <Overlay onClose={onClose}>
      <div className="nf-pop" style={modalStyle}>
        <ModalHead title="Send feedback" onClose={onClose} />
        <div style={{ padding: "0 20px 20px" }}>
          <p style={{ fontSize: 13, color: SLATE, lineHeight: 1.5, marginTop: 0 }}>
            What's working, what's confusing, what you wish it did? Write it below, tap Copy, and paste it into an email, text, or message to whoever shared HomePlot with you. Thanks for helping make it better.
          </p>
          <textarea
            id="fb-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your thoughts, ideas, or anything that felt off…"
            rows={6}
            style={{ width: "100%", boxSizing: "border-box", background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, color: INK, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", lineHeight: 1.5, resize: "vertical", marginBottom: 12 }}
          />
          <button onClick={copy} disabled={!text.trim()}
            style={{ width: "100%", background: text.trim() ? TEAL : LINE, color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontWeight: 700, fontSize: 14, cursor: text.trim() ? "pointer" : "default", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {copied ? <><Check size={16} strokeWidth={3} /> Copied — now paste it to send</> : <>Copy my feedback</>}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ---------------- How scoring works ---------------- */
function MethodModal({ onClose }) {
  const Item = ({ title, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: INK, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 13, color: SLATE, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
  return (
    <Overlay onClose={onClose}>
      <div className="nf-pop" style={modalStyle}>
        <ModalHead title="How scoring works" onClose={onClose} />
        <div style={{ padding: "0 20px 20px", overflowY: "auto" }}>
          <Item title="It's your ranking, not a generic one">
            Every place gets a match score from 0 to 100. That score is a weighted average of 15 factors, and you control the weights. Slide a priority up and places re-rank instantly, so the order reflects what matters to <i>you</i>, not a fixed formula.
          </Item>
          <Item title="Where the numbers come from">
            Affordability is computed from each place's price against your budget. Commute is computed from real distance to your work ZIP. Some factor ratings (schools, safety, lifestyle) start as estimates, marked with a gold asterisk. Open Edit on any place to set your own number, and the asterisk clears.
          </Item>
          <Item title="What's real, cited data">
            Under each place's breakdown, the Local Data section pulls live from official sources: USGS (earthquake history), FEMA (flood zones), NOAA (weather), and the U.S. Census (demographics, property tax). The mortgage base rate is live from Freddie Mac. These are never estimates.
          </Item>
          <Item title="The honest part">
            Estimates are always labeled, real data is always cited, and nothing is hidden. The goal is a tool you can trust, where you can see exactly why a place ranked where it did, and adjust anything that doesn't match what you know.
          </Item>
          <button onClick={onClose} style={{ width: "100%", background: TEAL, color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>Got it</button>
        </div>
      </div>
    </Overlay>
  );
}
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
