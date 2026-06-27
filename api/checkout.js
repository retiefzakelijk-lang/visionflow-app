// VisionFlow AI — /api/checkout
// Creates a Stripe Checkout Session so customers can subscribe and pay.
// Your secret Stripe key lives ONLY here on the server (Vercel env var
// STRIPE_SECRET_KEY) and is never exposed to the browser.
//
// Prices are defined inline (price_data) so you don't have to pre-create
// Products/Prices in the Stripe dashboard — just add your key and go.

const PLANS = {
  starter: { name: "Starter", amount: 1299,  interval: "month" },
  pro:     { name: "Pro",     amount: 2499,  interval: "month" },
  ultra:   { name: "Ultra",   amount: 4999,  interval: "month" },
  max:     { name: "Max",     amount: 9999,  interval: "month" },
  year:    { name: "1 Year",  amount: 49900, interval: null }, // one-time payment
};

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Use POST" }); return; }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    res.status(500).json({ error: "Payments aren't set up yet. Add STRIPE_SECRET_KEY in your Vercel environment variables." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const plan = PLANS[(body.plan || "").toLowerCase()];
  if (!plan) { res.status(400).json({ error: "Unknown plan." }); return; }

  const origin = req.headers.origin || ("https://" + (req.headers.host || "visionflow-app-zeta.vercel.app"));
  const isSub = !!plan.interval;
  const email = (body.email || "").toString().trim();

  const p = new URLSearchParams();
  p.append("mode", isSub ? "subscription" : "payment");
  p.append("success_url", origin + "/picsart-style.html?paid=1#/welcome");
  p.append("cancel_url", origin + "/picsart-style.html#/pricing");
  p.append("allow_promotion_codes", "true");
  if (email) p.append("customer_email", email);
  p.append("line_items[0][quantity]", "1");
  p.append("line_items[0][price_data][currency]", "usd");
  p.append("line_items[0][price_data][unit_amount]", String(plan.amount));
  p.append("line_items[0][price_data][product_data][name]", "VisionFlow " + plan.name + (isSub ? " — monthly" : " — 1 year"));
  if (isSub) p.append("line_items[0][price_data][recurring][interval]", plan.interval);
  // record which plan was bought (handy for your webhook later)
  p.append("metadata[plan]", (body.plan || "").toLowerCase());

  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/x-www-form-urlencoded" },
      body: p.toString(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.status(r.status).json({ error: (data && data.error && data.error.message) || "Stripe rejected the request." });
      return;
    }
    res.status(200).json({ url: data.url, id: data.id });
  } catch (e) {
    res.status(502).json({ error: "Could not reach Stripe: " + (e && e.message ? e.message : String(e)) });
  }
}
