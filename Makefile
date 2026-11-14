up:
	docker compose up -d --build
down:
	docker compose down
migrate:
	docker compose exec backend python manage.py migrate
test:
	docker compose exec backend pytest
lint:
	docker compose exec backend ruff check .
logs:
	docker compose logs -f
