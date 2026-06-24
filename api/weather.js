// HomePlot weather — a Vercel serverless function.
// Reads the National Weather Service (api.weather.gov, no key) for a point and
// returns a short current outlook: today's high/low and a one-line forecast.
// This is the live 7-day forecast, NOT long-term climate normals, and the app
// labels it that way. Display-only, never scored.

const UA = "HomePlot neighborhood app (contact: support@homeplotapp.com)";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");

  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }

  try {
    // Step 1: resolve the point to a forecast grid.
    const pr = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, {
      headers: { "user-agent": UA, accept: "application/geo+json" },
    });
    if (!pr.ok) { res.status(200).json({ available: false }); return; }
    const pdata = await pr.json();
    const forecastUrl = pdata && pdata.properties && pdata.properties.forecast;
    if (!forecastUrl) { res.status(200).json({ available: false }); return; }

    // Step 2: pull the forecast periods.
    const fr = await fetch(forecastUrl, { headers: { "user-agent": UA, accept: "application/geo+json" } });
    if (!fr.ok) { res.status(200).json({ available: false }); return; }
    const fdata = await fr.json();
    const periods = (fdata && fdata.properties && fdata.properties.periods) || [];
    if (!periods.length) { res.status(200).json({ available: false }); return; }

    const day = periods.find((p) => p.isDaytime) || periods[0];
    const night = periods.find((p) => !p.isDaytime);

    res.status(200).json({
      available: true,
      high: day && day.temperature != null ? day.temperature : null,
      low: night && night.temperature != null ? night.temperature : null,
      unit: (day && day.temperatureUnit) || "F",
      summary: (day && day.shortForecast) || "",
      label: (day && day.name) || "Today",
      source: "NWS / NOAA",
    });
  } catch (err) {
    res.status(200).json({ available: false });
  }
}
