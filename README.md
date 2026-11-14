# ShopSync

Shopify inventory and order sync app: Django + DRF + Celery (backend), React + Polaris (dashboard), React Native (mobile).

See [PLAN.md](PLAN.md) for the phase plan. Work in progress.

## Local setup (Docker)

```bash
cp .env.example .env      # then fill in the Shopify credentials
docker compose up -d --build
docker compose exec backend python manage.py migrate
curl localhost:8000/health   # {"status": "ok"}
docker compose exec backend pytest
```

Services: `db` (Postgres 16), `redis`, `backend` (Django on :8000), `worker` and `beat` (Celery).
API docs: http://localhost:8000/api/docs/

## Dashboard (local)

```bash
docker compose exec backend python manage.py seed_demo      # demo shop, 131 variants, 60 orders
docker compose exec backend python manage.py dev_token      # prints a local session token
echo "VITE_DEV_TOKEN=<token>" > frontend/.env.local         # then: docker compose up -d frontend
```

Open http://localhost:5173. Inside the Shopify admin the dashboard uses App Bridge session tokens instead.
Tests: `cd frontend && npm test`.

## Mobile app (React Native / Expo)

```bash
cd mobile && npm install
npx expo start            # scan the QR with Expo Go, or press w for the web preview
```

In the dashboard open **Settings -> Connect mobile app** to generate a link code, then paste it
into the app together with the API URL. Push notifications need a physical device.
