// VisionFlow AI — /api/tts
// Generates a voiceover (text-to-speech) with a chosen voice via fal.ai.
// Uses the same server-side FAL_KEY. Poll the returned status_url with /api/poll.

const TTS_MODEL = process.env.FAL_TTS_MODEL || "fal-ai/gemini-tts";

// Voices supported by Gemini TTS. If you switch TTS_MODEL, update this list to
// match that model's voice names (see its page on https://fal.ai/models).
const VOICES = [
  "Zephyr","Puck","Charon","Kore","Fenrir","Leda","Orus","Aoede","Callirrhoe","Autonoe",
  "Enceladus","Iapetus","Umbriel","Algieba","Despina","Erinome","Algenib","Rasalgethi","Laomedeia","Achernar",
  "Alnilam","Schedar","Gacrux","Pulcherrima","Achird","Zubenelgenubi","Vindemiatrix","Sadachbia","Sadaltager","Sulafat",
];

const HITS = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now); HITS.set(ip, arr);
  return arr.length > 12;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }
  const key = process.env.FAL_KEY;
  if (!key) { res.status(500).json({ error: "Server is missing the FAL_KEY environment variable." }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  if (rateLimited(ip)) { res.status(429).json({ error: "Too many requests — slow down a moment." }); return; }

  const text = (body.text || "").toString().trim();
  let voice = (body.voice || "Kore").toString();
  if (!VOICES.includes(voice)) voice = "Kore";
  if (text.length < 2 || text.length > 2000) { res.status(400).json({ error: "Voiceover text must be 2-2000 characters." }); return; }

  const input = { prompt: text, voice: voice, output_format: "mp3" };

  try {
    const r = await fetch("https://queue.fal.run/" + TTS_MODEL, {
      method: "POST",
      headers: { "Authorization": "Key " + key, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { res.status(r.status).json({ error: (data && (data.detail || data.error)) || "fal.ai rejected the TTS request", raw: data }); return; }
    res.status(200).json({ request_id: data.request_id, status_url: data.status_url, response_url: data.response_url, voice });
  } catch (e) {
    res.status(502).json({ error: "Could not reach fal.ai: " + (e && e.message ? e.message : String(e)) });
  }
}

export { VOICES };
