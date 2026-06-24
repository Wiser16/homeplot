// HomePlot demographics — a Vercel serverless function.
// Real owner/renter, median household income, median age, and education from
// the U.S. Census ACS 5-year Data Profiles. Needs a free CENSUS_API_KEY in
// Vercel; returns { available:false } until that's set, so the app degrades
// gracefully. Resolves a point to a Census place via the public geocoder, then
// queries the ACS. Display-only, never scored.

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=2592000, stale-while-revalidate=2592000");

  const key = process.env.CENSUS_API_KEY;
  if (!key) { res.status(200).json({ available: false, reason: "no-key" }); return; }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }

  try {
    // Step 1: point -> Census place (state + place FIPS) via the public geocoder.
    const geoUrl =
      "https://geocoding.geo.census.gov/geocoder/geographies/coordinates" +
      `?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current` +
      "&layers=Incorporated%20Places&format=json";
    const gr = await fetch(geoUrl, { headers: { "user-agent": "HomePlot" } });
    if (!gr.ok) { res.status(200).json({ available: false }); return; }
    const gdata = await gr.json();
    const places =
      gdata && gdata.result && gdata.result.geographies &&
      gdata.result.geographies["Incorporated Places"];
    if (!places || !places.length) { res.status(200).json({ available: false, reason: "no-place" }); return; }
    const stateFips = places[0].STATE;
    const placeFips = places[0].PLACE;
    const placeName = places[0].NAME;

    // Step 2: pull a few clean Data Profile variables for that place.
    // DP04_0046PE owner-occupied %, DP03_0062E median household income,
    // DP05_0018E median age, DP02_0068PE bachelor's-or-higher %.
    const vars = "NAME,DP04_0046PE,DP03_0062E,DP05_0018E,DP02_0068PE";
    const acsUrl =
      `https://api.census.gov/data/2023/acs/acs5/profile?get=${vars}` +
      `&for=place:${placeFips}&in=state:${stateFips}&key=${key}`;
    const ar = await fetch(acsUrl, { headers: { "user-agent": "HomePlot" } });
    if (!ar.ok) { res.status(200).json({ available: false }); return; }
    const adata = await ar.json();
    if (!Array.isArray(adata) || adata.length < 2) { res.status(200).json({ available: false }); return; }

    const row = adata[1];
    const ownerPct = num(row[1]);
    const income = num(row[2]);
    const medianAge = num(row[3]);
    const bachelorsPct = num(row[4]);

    res.status(200).json({
      available: true,
      place: placeName,
      ownerPct: ownerPct != null ? Math.round(ownerPct) : null,
      renterPct: ownerPct != null ? Math.round(100 - ownerPct) : null,
      medianIncome: income != null ? Math.round(income) : null,
      medianAge: medianAge != null ? +medianAge.toFixed(1) : null,
      bachelorsPct: bachelorsPct != null ? Math.round(bachelorsPct) : null,
      source: "U.S. Census ACS 5-year",
    });
  } catch (err) {
    res.status(200).json({ available: false });
  }
}

function num(v) {
  const n = Number(v);
  // Census uses large negative sentinels for "no data".
  return isFinite(n) && n > -100000 ? n : null;
}
