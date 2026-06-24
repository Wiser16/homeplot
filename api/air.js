// HomePlot air quality — a Vercel serverless function.
// Current Air Quality Index near a point from the EPA's AirNow service. Needs a
// free AIRNOW_API_KEY in Vercel; returns { available:false } until set, so the
// app degrades gracefully. Display-only, never scored.

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=10800, stale-while-revalidate=43200");

  const key = process.env.AIRNOW_API_KEY;
  if (!key) { res.status(200).json({ available: false, reason: "no-key" }); return; }

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }

  try {
    const url =
      "https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json" +
      `&latitude=${lat}&longitude=${lng}&distance=50&API_KEY=${key}`;
    const r = await fetch(url, { headers: { "user-agent": "HomePlot" } });
    if (!r.ok) { res.status(200).json({ available: false }); return; }
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) {
      res.status(200).json({ available: true, aqi: null, label: "No recent AQI reading nearby", source: "EPA AirNow" });
      return;
    }
    // Take the worst (highest AQI) current reading among reported pollutants.
    const worst = data.reduce((m, d) => (Number(d.AQI) > Number(m.AQI || 0) ? d : m), data[0]);
    const aqi = Number(worst.AQI);
    const category = worst.Category && worst.Category.Name ? worst.Category.Name : aqiCategory(aqi);

    res.status(200).json({
      available: true,
      aqi: isFinite(aqi) ? aqi : null,
      category,
      pollutant: worst.ParameterName || null,
      source: "EPA AirNow",
    });
  } catch (err) {
    res.status(200).json({ available: false });
  }
}

function aqiCategory(aqi) {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very unhealthy";
  return "Hazardous";
}
