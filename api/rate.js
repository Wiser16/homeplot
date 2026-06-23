// HomePlot live mortgage rate — a Vercel serverless function.
// Reads the current 30-year and 15-year fixed averages from Freddie Mac's
// public PMMS page and returns them as JSON. Cached at the edge for a day,
// since the survey only updates weekly (Thursdays). Falls back gracefully.

const FALLBACK = { rate30: 6.4, rate15: 5.8, asOf: null, source: "fallback" };

export default async function handler(req, res) {
  // Let the result cache for 12 hours; the survey changes once a week.
  res.setHeader("Cache-Control", "s-maxage=43200, stale-while-revalidate=86400");
  try {
    const r = await fetch("https://www.freddiemac.com/pmms", {
      headers: { "user-agent": "Mozilla/5.0 (HomePlot rate fetch)" },
    });
    if (!r.ok) {
      res.status(200).json(FALLBACK);
      return;
    }
    const html = await r.text();

    // The page states the averages in prose, e.g.
    // "30-year fixed-rate mortgage averaged 6.47%" and "15-year ... 5.81%".
    const rate30 = matchRate(html, /30-year[^%]*?(\d\.\d{1,3})\s*%/i);
    const rate15 = matchRate(html, /15-year[^%]*?(\d\.\d{1,3})\s*%/i);
    const asOf = matchAsOf(html);

    if (rate30 == null) {
      res.status(200).json(FALLBACK);
      return;
    }
    res.status(200).json({
      rate30,
      rate15: rate15 ?? null,
      asOf: asOf || null,
      source: "freddiemac-pmms",
    });
  } catch (err) {
    res.status(200).json(FALLBACK);
  }
}

function matchRate(html, re) {
  const m = html.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  // Sanity bound so a bad parse can never feed a wild number into the app.
  return n >= 1 && n <= 20 ? n : null;
}

function matchAsOf(html) {
  // e.g. "as of 06/18/2026" or "as of June 18, 2026"
  const m = html.match(/as of\s+([A-Za-z0-9,\/ ]{6,20})/i);
  return m ? m[1].trim() : null;
}
