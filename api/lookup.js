// HomePlot lookup — a Vercel serverless function.
// Confirms a town is a real US place and returns a rough estimate. The API key
// stays here on the server (set ANTHROPIC_API_KEY in Vercel project settings),
// never in the browser. The app calls this at /api/lookup.

const RATING_KEYS = [
  "schools", "schoolAccess", "safety", "familySafety", "suburbGreen",
  "retailDining", "lotYard", "walk", "beach", "earthquake", "fire",
  "weather", "culture",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY." });
    return;
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const town = String(body.town || "").trim();
  const state = String(body.state || "").trim().toUpperCase();
  if (!town || state.length !== 2) {
    res.status(400).json({ error: "town and 2-letter state are required" });
    return;
  }

  const place = `${town}, ${state}`;
  const prompt = `You validate and estimate US places for a home-search app. Treat the name EXACTLY as written. Do NOT autocorrect, repair, or guess an intended place. Decide whether "${place}" is itself a real, correctly spelled US city, town, or neighborhood.
- If it is NOT a real place, OR it is misspelled, OR you would have to change the spelling to recognize it, OR you are not confident, respond ONLY with {"found":false,"matchedName":"<the real place you suspect was intended, or empty string>"}.
- If it IS a real, correctly spelled place exactly as written, respond ONLY with JSON, no markdown: {"found":true,"matchedName":"<official place name>","estPrice":<number, typical 3bd/2ba home price in USD>,"note":<string, max 12 words>,"schools":<0-10>,"schoolAccess":<0-10>,"safety":<0-10>,"familySafety":<0-10>,"suburbGreen":<0-10>,"retailDining":<0-10>,"lotYard":<0-10>,"walk":<0-10>,"beach":<0-10>,"earthquake":<0-10>,"fire":<0-10>,"weather":<0-10>,"culture":<0-10>}. Ratings are 0 (poor) to 10 (great); "earthquake" and "fire" mean SAFETY (10 = low risk). Do not include any demographic, racial, or ethnicity data.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      res.status(502).json({ error: "Lookup service error." });
      return;
    }
    const data = await r.json();
    const text = (data.content || []).map((b) => b.text || "").join("");
    const cleaned = text.replace(/```json|```/g, "").trim();
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(s >= 0 && e > s ? cleaned.slice(s, e + 1) : cleaned);

    if (!parsed || parsed.found !== true) {
      res.status(200).json({ found: false, matchedName: (parsed && parsed.matchedName) || "" });
      return;
    }
    const ratings = {};
    for (const k of RATING_KEYS) {
      if (parsed[k] != null) ratings[k] = Math.max(0, Math.min(10, Math.round(Number(parsed[k]))));
    }
    res.status(200).json({
      found: true,
      matchedName: parsed.matchedName || town,
      estPrice: parsed.estPrice ? Math.round(Number(parsed.estPrice)) : null,
      note: typeof parsed.note === "string" ? parsed.note.slice(0, 80) : "",
      ratings,
    });
  } catch (err) {
    res.status(502).json({ error: "Lookup failed." });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
