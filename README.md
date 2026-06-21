# VisionFlow AI — real AI video & image generator

A deployable web app where users type a prompt and get **real** AI-generated
videos and images. The AI runs through [fal.ai](https://fal.ai); your secret API
key stays on the server and is never exposed to the browser.

```
visionflow-app/
├─ public/
│  └─ index.html        ← the studio UI (front-end)
├─ api/
│  ├─ generate.js       ← submits image/video jobs to fal.ai (uses FAL_KEY)
│  └─ poll.js           ← checks job status and returns the finished result
├─ package.json
├─ vercel.json
├─ .env.example
└─ .gitignore
```

---

## 1. Get your fal.ai key

1. Sign up at **https://fal.ai**
2. Open **https://fal.ai/dashboard/keys** and create an API key
3. Add some credit (pay-as-you-go). ~$10 is plenty to test.

> ⚠️ If you ever pasted a key in chat or committed it, **revoke it** and make a
> new one. A leaked key lets anyone spend your credits.

---

## 2. Deploy on Vercel (easiest, free tier works)

1. Put this folder in a GitHub repo (or use the Vercel CLI).
2. Go to **https://vercel.com** → **Add New… → Project** → import the repo.
3. In **Settings → Environment Variables**, add:
   - `FAL_KEY` = *your fal.ai key*
4. Click **Deploy**. Your app is live at `https://your-project.vercel.app`.

That's it — no build step, no dependencies to install.

### Local development (optional)

```bash
npm i -g vercel        # one-time
vercel dev             # runs the site + /api locally at http://localhost:3000
```
Create a `.env` file (copy `.env.example`) with your `FAL_KEY` for local runs.

---

## 3. How it works

- The browser calls **`/api/generate`** with the prompt + options.
- That function calls fal.ai using your **server-side** `FAL_KEY` and returns a
  job's `status_url`/`response_url` (these are **not** secret).
- The browser then polls **`/api/poll`** until the job is `COMPLETED`, and shows
  the real video/image, with download.

The key never reaches the browser, so visitors can't steal it.

---

## 4. Changing models / quality

Defaults (override with env vars — see `.env.example`):

| Type        | Default model                                          | Notes                    |
|-------------|--------------------------------------------------------|--------------------------|
| Video       | `fal-ai/kling-video/v2.5-turbo/pro/text-to-video`      | great quality/price      |
| Image       | `fal-ai/flux/dev`                                       | high quality             |
| Image (fast)| `fal-ai/flux/schnell`                                   | cheapest/fastest         |

Browse every model and its exact input fields at **https://fal.ai/models**.
Swap an ID by setting `FAL_VIDEO_MODEL` / `FAL_IMAGE_MODEL` in your env vars.

---

## 5. Rough costs (mid-2026)

- Images: ~**$0.01–0.15** each (FLUX is cheapest, Nano Banana pricier).
- Video: ~**$0.15–0.50** for a 5-second clip (Kling), more for Sora/4K.

You pay fal.ai per generation. **Price your plans above your costs.**

---

## 6. Turning this into a paid product (sell subscriptions)

This app generates real content, but it does **not** yet have accounts, payments,
or hard usage limits. The on-page counter is client-side only (display) and can
be bypassed. Before charging customers, add:

1. **Accounts / login** — e.g. [Supabase Auth](https://supabase.com) or
   [Clerk](https://clerk.com).
2. **Payments** — [Stripe](https://stripe.com) Checkout + Customer Portal, with a
   webhook that records each user's plan in your database.
3. **Server-side usage limits** — in `api/generate.js`, look up the signed-in
   user, check their plan + remaining quota in the database, and reject the
   request if they're out. (The current in-memory rate limit is only a basic
   guard against bursts and resets on every cold start.)
4. **Content moderation & ToS** — confirm fal.ai and each model permit your use
   case, and add a usage policy for your users.

Once you've got a Stripe account and an auth provider, this is a focused next
build — the generation engine is already done.
