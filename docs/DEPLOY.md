# Deploying ShopSync

Everything here runs on free or low-cost tiers. Do the steps in order. Accounts and secrets stay
with you; nothing below needs to be committed.

| Part | Host | Config in this repo |
|---|---|---|
| Postgres | Neon | (connection string only) |
| API + Celery worker + Redis | Render | `render.yaml`, `backend/Dockerfile.prod` |
| Web dashboard | Vercel | `frontend/vercel.json` |
| Mobile app | Expo EAS | `mobile/eas.json` |
| Shopify app settings | Shopify CLI | `shopify.app.toml` |

## 1. Neon (database)

1. Create a project and a database. Copy the **pooled** connection string (it contains `-pooler`).
2. Keep `?sslmode=require` on the end. This becomes `DATABASE_URL`.

## 2. Render (API, worker, Redis)

`render.yaml` is the **free demo mode** (one free web service, background jobs run inline, no nightly
reconcile). `render.paid.yaml` is the full setup with a Celery worker, beat and Redis (Starter plan, about
14 USD per month); rename it to `render.yaml` to use it.

1. Push this repo to GitHub (already done), then in Render choose **New > Blueprint** and select it.
2. Render reads `render.yaml` and asks for each value marked `sync: false`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled string from step 1 |
| `FIELD_ENCRYPTION_KEY` | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ALLOWED_HOSTS` | your API host, e.g. `shopsync-api.onrender.com` |
| `APP_URL`, `CSRF_TRUSTED_ORIGINS` | `https://shopsync-api.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | your Vercel URL (set after step 3, then redeploy) |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET` | Client ID and secret from the Shopify Dev Dashboard |
| `DEFAULT_FROM_EMAIL` | sender for alert emails (SMTP settings are optional; without them alerts are logged) |

3. The API container runs migrations on start. Check `https://<api>/health` returns `{"status": "ok"}`.
4. The worker runs Celery with beat (`-B`), so the nightly reconcile and failed-webhook replay run too.

**Plan note.** Free Render web services sleep after about 15 minutes idle and take 30 to 60 seconds to
wake. Shopify expects webhook replies within about 5 seconds and retries failures, so use the Starter
plan (about 7 USD per month) for the API while you demo, or ping `/health` every 5 minutes. Check
current prices and limits on each host; they change.

## 3. Vercel (dashboard)

1. Import the repo, set the **root directory** to `frontend`.
2. Environment variables (build time):
   - `VITE_API_URL` = `https://<api>.onrender.com`
   - `VITE_SHOPIFY_API_KEY` = Client ID
3. Deploy. `vercel.json` already sets the SPA rewrite and `frame-ancestors` so Shopify admin may embed it.
4. Copy the Vercel URL into Render's `CORS_ALLOWED_ORIGINS` and redeploy the API.

## 4. Shopify

1. Edit `shopify.app.toml`: `client_id`, `application_url` (Vercel), `redirect_urls` and the
   compliance webhook `uri` (Render).
2. Run `shopify app deploy` (Shopify CLI) to push the configuration, or enter the same values in the
   Dev Dashboard by hand.
3. In the Dev Dashboard, install the app on your dev store `shopsync-demo-oej0ck3f`.
   Flow: Shopify opens the dashboard, which sends you to `/auth/install` on the API, then OAuth
   returns to `/auth/callback`, which registers webhooks and queues the first sync.
4. Optional: `docker compose exec backend python manage.py seed_shopify --shop <store>.myshopify.com`
   against the live API (run as a Render shell command) to fill the store with the demo catalog,
   then `... seed_shopify --shop <store> --orders 5` to create test orders. Test orders need the extra
   scopes `write_draft_orders,write_orders` (add them in a new app version and re-approve the install);
   otherwise create an order by hand in Shopify admin (Orders > Create order).

## 5. Mobile app (EAS)

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android   # installable APK
```

Open the dashboard, go to **Settings > Connect mobile app**, generate a link code, and paste it into
the app with your API URL. Push notifications need a physical device and an EAS project id
(`eas init` adds it).

## Public demo for recruiters

The sign-in page has a **Try the live demo** button. It calls `POST /api/demo-login`, which returns a
6-hour, **read-only** token (writes return 403: no stock changes, settings, syncs or link codes).

- By default it targets a seeded fake store (`demo.shopsync.local`), which can never be installed.
- To showcase your real development store instead, set this variable on the Render service and redeploy:
  `DEMO_SHOP_DOMAIN=<your-store>.myshopify.com`
- The endpoint is rate limited (60 requests per hour per visitor) and can be switched off with `DEMO_ENABLED=False`.

## 6. Verify end to end

- [ ] `/health` is ok and `/api/docs/` loads
- [ ] App installs on the dev store, then the Setup guide shows "Run your first sync" done
- [ ] Editing a product or inventory level in Shopify admin updates ShopSync within seconds
- [ ] Placing a test order shows up under Orders
- [ ] Dropping a variant below the threshold creates an alert (and a push on a device)
- [ ] Changing stock in ShopSync changes it in Shopify, and Undo reverts it

## Rollback and secrets

- Rotate `SHOPIFY_API_SECRET` in the Dev Dashboard and Render if it ever leaks; link codes are signed
  with it, so rotating it also invalidates every mobile link code.
- Never commit `.env` files. Only `.env.example` and `.env.production.example` are tracked.
