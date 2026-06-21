// VisionFlow AI — /api/poll
// Checks a fal.ai job's status and, once finished, returns the result.
// status_url / response_url are NOT secret, but we still verify they point
// at fal.ai (SSRF protection) and attach the secret key server-side.

const FAL_HOST = /^https:\/\/queue\.fal\.run\//;

export default async function handler(req, res) {
  const key = process.env.FAL_KEY;
  if (!key) { res.status(500).json({ error: "Server is missing the FAL_KEY environment variable." }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const status_url = (req.query && req.query.status_url) || body.status_url;
  const response_url = (req.query && req.query.response_url) || body.response_url;

  if (!status_url || !FAL_HOST.test(status_url)) { res.status(400).json({ error: "Invalid status_url" }); return; }

  try {
    const sr = await fetch(status_url, { headers: { "Authorization": "Key " + key } });
    const sdata = await sr.json().catch(() => ({}));
    const status = sdata.status || (sr.ok ? "IN_PROGRESS" : "ERROR");

    if (status === "COMPLETED") {
      const ru = response_url && FAL_HOST.test(response_url)
        ? response_url
        : status_url.replace(/\/status\/?$/, "");
      const rr = await fetch(ru, { headers: { "Authorization": "Key " + key } });
      const result = await rr.json().catch(() => ({}));
      res.status(200).json({ status: "COMPLETED", result });
      return;
    }

    res.status(200).json({ status, queue_position: sdata.queue_position });
  } catch (e) {
    res.status(502).json({ error: "Polling failed: " + (e && e.message ? e.message : String(e)) });
  }
}
