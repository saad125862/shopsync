import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import OperationalError

from sync.management.commands import sync_shop
from sync.models import Shop, SyncLog


class _Null:
    def write(self, *_a, **_k):
        pass

    def flush(self):
        pass


@pytest.fixture
def shop(db):
    s = Shop(domain="x.myshopify.com")
    s.access_token = "tok"
    s.save()
    return s


def test_requires_an_installed_shop(db):
    with pytest.raises(CommandError):
        call_command("sync_shop", shop="nope.myshopify.com", stdout=_Null())


def test_retries_after_a_dropped_connection(shop, monkeypatch):
    calls = []

    def flaky(s):
        calls.append(1)
        if len(calls) == 1:
            raise OperationalError("SSL error: unexpected eof")
        return SyncLog.objects.create(shop=s, kind="full_sync", status="ok", detail="done")

    monkeypatch.setattr(sync_shop.services, "full_sync", flaky)
    # closing the real connection would break pytest's wrapping transaction; the call is what matters
    closed = []
    monkeypatch.setattr(sync_shop.connection, "close", lambda: closed.append(1))
    call_command("sync_shop", shop="x.myshopify.com", stdout=_Null(), stderr=_Null())
    assert len(calls) == 2 and closed == [1]  # reconnected once, then succeeded


def test_gives_up_after_the_retry_limit(shop, monkeypatch):
    monkeypatch.setattr(sync_shop.connection, "close", lambda: None)
    monkeypatch.setattr(
        sync_shop.services, "full_sync", lambda s: (_ for _ in ()).throw(OperationalError("x"))
    )
    with pytest.raises(CommandError):
        call_command("sync_shop", shop="x.myshopify.com", retries=2, stdout=_Null(), stderr=_Null())
