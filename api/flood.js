// HomePlot flood risk — a Vercel serverless function.
// Reads FEMA's National Flood Hazard Layer (public ArcGIS service, no key) at a
// point and reports whether it sits in a designated flood zone. Display-only,
// clearly cited, never scored. Answers at the town center, labeled as such.

// Layer 28 is the Flood Hazard Zones layer in FEMA's public NFHL MapServer.
const NFHL =
  "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=604800, stale-while-revalidate=2592000");

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }

  const url =
    NFHL +
    `?geometry=${encodeURIComponent(`${lng},${lat}`)}` +
    "&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects" +
    "&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json";

  try {
    const r = await fetch(url, { headers: { "user-agent": "HomePlot (neighborhood app)" } });
    if (!r.ok) {
      res.status(200).json({ available: false });
      return;
    }
    const data = await r.json();
    const feats = Array.isArray(data.features) ? data.features : [];
    if (feats.length === 0) {
      // No mapped zone at this point (often "outside high-risk areas").
      res.status(200).json({ available: true, zone: null, highRisk: false, label: "No high-risk flood zone mapped at town center", source: "FEMA NFHL" });
      return;
    }
    const a = feats[0].attributes || {};
    const zone = String(a.FLD_ZONE || "").trim();
    const subtype = String(a.ZONE_SUBTY || "").trim();

    // Zones beginning A or V are Special Flood Hazard Areas (1%-annual-chance).
    const highRisk = /^A|^V/i.test(zone);
    // Zone X with the 0.2% subtype is moderate (500-year) risk.
    const moderate = /^X/i.test(zone) && /0\.2|500/i.test(subtype);

    const label = highRisk
      ? `High-risk flood zone ${zone} at town center`
      : moderate
      ? "Moderate (500-year) flood zone at town center"
      : "Minimal flood risk at town center";

    res.status(200).json({
      available: true,
      zone: zone || null,
      subtype: subtype || null,
      highRisk,
      moderate,
      label,
      source: "FEMA NFHL",
    });
  } catch (err) {
    res.status(200).json({ available: false });
  }
}
