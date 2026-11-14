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
