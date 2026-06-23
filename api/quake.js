// HomePlot earthquake history — a Vercel serverless function.
// Returns real historical seismicity near a point, straight from the USGS
// public earthquake catalog (no API key needed). This is HISTORY near a
// location, a fair proxy for seismic risk, not an official hazard rating, and
// the app labels it that way.

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }

  // Look back ~45 years within ~50 km, counting only magnitude 3.5+ events
  // (large enough to matter, small enough to be meaningful for a town).
  const years = 45;
  const radiusKm = 50;
  const minMag = 3.5;
  const start = new Date(Date.now() - years * 365.25 * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);

  const url =
    "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson" +
    `&latitude=${lat}&longitude=${lng}&maxradiuskm=${radiusKm}` +
    `&starttime=${start}&minmagnitude=${minMag}&orderby=magnitude&limit=1000`;

  try {
    const r = await fetch(url, { headers: { "user-agent": "HomePlot (neighborhood app)" } });
    if (!r.ok) {
      res.status(200).json({ available: false });
      return;
    }
    const data = await r.json();
    const feats = Array.isArray(data.features) ? data.features : [];
    const count = feats.length;
    const maxMag = feats.reduce((m, f) => {
      const v = f && f.properties ? Number(f.properties.mag) : 0;
      return v > m ? v : m;
    }, 0);
    const strong = feats.filter((f) => f.properties && Number(f.properties.mag) >= 5).length;

    // A 0-10 score where 10 means low seismic activity, to match the app's
    // "earthquake = safety" convention. Eased so a quiet area scores high and a
    // very active one scores low, based on count and the largest event.
    const score = seismicityToScore(count, maxMag);

    res.status(200).json({
      available: true,
      count,
      maxMag: maxMag ? +maxMag.toFixed(1) : 0,
      strongCount: strong,
      years,
      radiusKm,
      minMag,
      score,
      source: "USGS earthquake catalog",
    });
  } catch (err) {
    res.status(200).json({ available: false });
  }
}

function seismicityToScore(count, maxMag) {
  // More quakes and bigger quakes lower the safety score. Tuned so that a
  // place with almost no history lands near 9-10 and a very active fault zone
  // lands near 2-3.
  let s = 10;
  if (count > 0) s -= Math.min(5, Math.log10(count + 1) * 2.5);
  if (maxMag >= 4) s -= Math.min(4, (maxMag - 4) * 1.3);
  return Math.max(0, Math.min(10, Math.round(s)));
}
