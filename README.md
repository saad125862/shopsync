# ShopSync

Inventory and order sync for Shopify, with a Shopify-admin-style dashboard and a companion mobile app.
Stock and orders flow from a Shopify store into ShopSync in real time; stock changes made in
ShopSync flow back to Shopify; low-stock alerts reach the owner by email and push.

```
                 webhooks (HMAC verified)            REST (session token)
  Shopify  ───────────────────────────►  Django API  ◄──────────────────►  React dashboard (Vercel)
  store    ◄── GraphQL (sync, adjust) ──  + Celery    ◄──────────────────►  React Native app (Expo)
                                            │  │
                                  Postgres ─┘  └─ Redis (queue, beat)
```

**Two sites, two audiences.** The Shopify store is what customers see (hosted by Shopify). ShopSync is
what the store owner uses: it runs inside Shopify admin as an embedded app and also stands alone.

## Features

- **Shopify OAuth install**, encrypted token storage, App Bridge session-token auth
- **Webhooks**: HMAC verification, idempotent by webhook id, fast 200 and queued processing, retries
  with backoff, failed-event replay, mandatory privacy (GDPR) webhooks
- **GraphQL sync**: first full sync, throttle-aware client, nightly reconcile that repairs drift
- **Low-stock alerts**: per-shop threshold with per-SKU and per-location overrides, email and Expo push
- **Two-way inventory**: adjust stock in ShopSync, it is pushed to Shopify; one-tap Undo
- **Dashboard** (React, Polaris, dark "Midnight ops" theme): Home with setup guide and sales overview,
  Products with variants and per-location stock, Orders with detail, Inventory, Alerts, Analytics,
  sync log, global search, notifications, keyboard shortcuts (`/`, `Ctrl+K`, `g` then a letter)
- **Mobile app** (React Native, Expo, "Sunset commerce" theme): Home, Orders, Products, Alerts, More,
  haptics and animation, push notifications, link-code sign-in
- **Sign-in and logout**: automatic inside Shopify admin; link code for standalone web and mobile

## Stack

Python, Django, Django REST Framework, Celery, PostgreSQL, Redis, TypeScript, React, Polaris,
TanStack Query, Vite, React Native, Expo, Docker, GitHub Actions, pytest, Vitest, Jest.

## Run locally (Docker)

```bash
cp .env.example .env                      # add Shopify credentials later; placeholders work for demo data
docker compose up -d --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py seed_demo      # 20 products, 131 variants, 60 orders
docker compose exec backend python manage.py dev_token      # prints a local sign-in token
echo "VITE_DEV_TOKEN=<token>" > frontend/.env.local         # then: docker compose up -d frontend
```

- Dashboard: http://localhost:5173
- API docs: http://localhost:8000/api/docs/
- Mobile: `cd mobile && npm install && npx expo start` (press `w` for the web preview, or scan the QR in Expo Go)

`dev_token` needs `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET` set in `.env` (any values work for local demo data).
To use a real store, install the app on a Shopify development store (needs a tunnel for the local
callback URLs), then `seed_shopify` can fill the store with demo products and test orders.

## Tests

```bash
docker compose exec backend pytest        # 47 tests: auth, OAuth, webhooks, sync, alerts, API, seed
cd frontend && npm test                   # 20 tests
cd mobile && npm test                     # 9 tests
```

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs lint, type checks, tests and builds for all three parts. It is currently disabled; re-enable it with `gh workflow enable CI`.

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md): Neon (Postgres), Render (API, worker, Redis), Vercel (dashboard),
Expo EAS (mobile), `shopify.app.toml` (Shopify config).

## Layout

```
backend/    Django project (config/, core/, sync/ = Shopify integration and API)
frontend/   React dashboard (src/pages, src/hooks, src/theme.css)
mobile/     Expo app (src/app = routes, src/components, src/lib)
design/     UI option sheet used to pick the themes
docs/       Deployment guide and portfolio copy
```

## Status

Built and tested locally against seeded data. Not yet exercised against a live Shopify store, a physical
phone (push notifications), or a hosted deployment: those need accounts and credentials, and the steps
are in the deploy guide. Product images appear once a real store is synced; the demo data uses
placeholder tiles.
