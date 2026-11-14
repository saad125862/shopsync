from django.db import connection
from django.http import JsonResponse


def health(request):
    """Liveness + DB check."""
    with connection.cursor() as cur:
        cur.execute("SELECT 1")
    return JsonResponse({"status": "ok"})
