// VisionFlow AI — /api/generate
// Submits an image or video generation job to the fal.ai queue.
// The secret FAL_KEY lives ONLY here on the server, never in the browser.

const MODELS = {
  video:      process.env.FAL_VIDEO_MODEL || "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
  image:      process.env.FAL_IMAGE_MODEL || "fal-ai/flux/dev",
  image_fast: process.env.FAL_IMAGE_FAST_MODEL || "fal-ai/flux/schnell",
};

const HITS = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 12;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (HITS.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  HITS.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

function imageSize(aspect) {
  switch (aspect) {
    case "16:9": return "landscape_16_9";
    case "9:16": return "portrait_16_9";
    case "4:5":  return "portrait_4_3";
    case "1:1":
    default:     return "square_hd";
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }

  const key = process.env.FAL_KEY;
  if (!key) { res.status(500).json({ error: "Server is missing the FAL_KEY environment variable. Add it in your host's settings." }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  if (rateLimited(ip)) { res.status(429).json({ error: "Too many requests — slow down a moment." }); return; }

  const { mode, prompt, aspect_ratio, duration, fast } = body;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2 || prompt.length > 1500) {
    res.status(400).json({ error: "Please provide a prompt (2-1500 characters)." });
    return;
  }

  let model, input;
  if (mode === "video") {
    model = MODELS.video;
    input = { prompt: prompt.trim() };
    if (aspect_ratio && ["16:9", "9:16", "1:1"].includes(aspect_ratio)) input.aspect_ratio = aspect_ratio;
    // The model renders up to ~10s per clip. Longer lengths chosen in the UI are
    // billed by credits; we send the engine's max so the clip still renders.
    const dnum = parseInt(duration, 10) || 5;
    input.duration = dnum >= 10 ? "10" : "5";
  } else {
    model = fast ? MODELS.image_fast : MODELS.image;
    input = { prompt: prompt.trim(), image_size: imageSize(aspect_ratio), num_images: 1 };
  }

  try {
    const r = await fetch("https://queue.fal.run/" + model, {
      method: "POST",
      headers: { "Authorization": "Key " + key, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.status(r.status).json({ error: (data && (data.detail || data.error)) || "fal.ai rejected the request", raw: data });
      return;
    }
    res.status(200).json({
      request_id: data.request_id,
      status_url: data.status_url,
      response_url: data.response_url,
      model,
      mode: mode === "video" ? "video" : "image",
    });
  } catch (e) {
    res.status(502).json({ error: "Could not reach fal.ai: " + (e && e.message ? e.message : String(e)) });
  }
}
