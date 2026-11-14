# ShopSync: Final Phase Plan

Shopify inventory and order sync app.
Stack: Django + DRF + Celery + PostgreSQL + Redis, React (Vite + Polaris), React Native (Expo).
Order: Backend (local, Docker) -> Frontend -> Mobile -> Live.

Repo layout:
```
shopsync/
  backend/    Django project
  frontend/   React + Vite + TypeScript + Polaris
  mobile/     React Native (Expo)
  docker-compose.yml
  README.md
```

## Part A: Backend (local, Docker)

### Phase 0: Setup (1-2 days)
- Create GitHub repo and monorepo folders.
- Create Shopify Partner account, development store, and app (Client ID / Secret).
- Install Docker Desktop, Python 3.12, Node 20.
- docker-compose.yml: postgres, redis, backend (runserver), celery worker, celery beat.
- .env.example, Makefile (up, down, migrate, test, seed).
- Tunnel for local webhooks and OAuth: ngrok or cloudflared.
- GitHub Actions: lint (ruff) + pytest.
Done when: `docker compose up` runs and /health returns 200.

### Phase 1: Foundation (3-4 days)
- Django + DRF, split settings, django-environ.
- Models: Shop, Location, Product, Variant, InventoryLevel, Order, OrderLine, WebhookEvent, SyncLog, AlertRule, Alert, DeviceToken.
- Shopify OAuth install + callback, encrypted access token storage.
- Session token (JWT) verification middleware for the embedded app.
- Admin site, pytest + factory_boy setup.
Done when: app installs on the dev store and a Shop row is created.

### Phase 2: Shopify integration (4-5 days)
- Admin GraphQL client: pagination, rate-limit/cost handling, retries.
- Full initial sync (products, variants, locations, inventory) as Celery task.
- Webhooks: products/create|update|delete, inventory_levels/update, orders/create|updated, app/uninstalled, plus GDPR webhooks.
- HMAC verification, idempotency on X-Shopify-Webhook-Id, return 200 fast and queue work.
- Celery retry with backoff, failed events kept for replay.
Done when: editing a product or placing an order in Shopify updates the DB.

### Phase 3: Business logic + API (3-4 days)
- Nightly reconciliation job (Shopify vs local).
- Low-stock rules per SKU/location, alert creation, email alerts.
- Two-way sync: update inventory from API back to Shopify.
- REST API (DRF): overview stats, inventory list/filter, orders, alerts, sync logs, settings, device token registration.
- OpenAPI schema (drf-spectacular), pagination, filtering.
Done when: all endpoints documented and covered by tests.

### Phase 4: Seed data + backend tests (2 days)
- Seed script: 15-25 apparel products, size x color variants, 2 locations, mixed stock (in, low, out).
- Script that creates test orders to fire webhooks.
- pytest: HMAC, idempotency, sync, alerts, permissions. Target 80%+ on core logic.
Done when: `make seed` and `make test` pass from a clean clone.

Backend gate: do not start the frontend until Phases 0-4 are done.

## Part B: Frontend (local, Docker)

### Phase 5: Web dashboard (4-5 days)
- Vite + React + TypeScript, Polaris, App Bridge, TanStack Query, Zod, React Router.
- Generate API types from the OpenAPI schema.
- Pages: Overview (KPIs, charts), Inventory (filter by location/status, edit stock), Orders, Alerts, Sync logs, Settings.
- Embedded in Shopify admin through App Bridge session tokens.
- Add `frontend` service to docker-compose.
- Tests: Vitest + React Testing Library, one Playwright smoke test.
Done when: the full flow works inside the dev store admin.

## Part C: Mobile app

### Phase 6: React Native (Expo) (3-4 days)
- Expo + TypeScript, Expo Router, TanStack Query, shared types/Zod schemas.
- Screens: login/connect shop, low-stock alerts, order feed, inventory search, quick stock adjust.
- Push notifications (Expo Notifications), backend sends on new alert.
- Test on a real phone with Expo Go against the local backend (tunnel).
Done when: a low-stock event produces a push notification on the phone.

## Part D: Live

### Phase 7: Deployment (2-3 days)
- Neon: create Postgres project, use pooled connection string, run migrations.
- Redis: Upstash (or Render Key Value) for Celery.
- Render: backend web service (Docker), Celery worker + beat. Env vars set.
- Vercel: deploy the frontend, set API URL.
- Update Shopify app URLs, redirect URLs and webhook endpoints to live domains.
- Sentry, UptimeRobot, CORS/CSRF/allowed hosts hardening.
- Mobile: EAS build (APK / internal distribution) pointing at the live API.
- Note: free Render web service sleeps; Shopify webhooks need a reply within about 5s. Use the paid starter plan or an uptime ping.
- Check current free-tier limits on each host before committing.
Done when: install the app on the dev store, place an order, see it in the live dashboard and on the phone.

### Phase 8: Portfolio launch (1 day)
- README: architecture diagram, setup steps, screenshots.
- 2-3 minute demo video.
- Add project card, skills (Django, DRF, Celery, Shopify, React, TypeScript, Polaris, React Native, Expo), hero line, update project count.

## Timeline
About 4 weeks part-time. If short on time, cut Phase 6 (mobile) first, then two-way sync.
